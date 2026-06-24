import React, { useState, useCallback, useEffect, Suspense } from 'react';
import localforage from 'localforage';
import { templates } from '../lib/templates';
import {
  addRequisition,
  getDepartments,
  logActivity,
  uploadAttachments
} from '../lib/store';
import { toast } from 'react-hot-toast';
import { resolveDeptCode } from './documentStudio/shared';
import {
  FileText, Table, Plus, Trash2, Save,
  Clock, X, HardDrive,
  FolderOpen, Edit3, Presentation,
} from 'lucide-react';

// Each editor pulls in a heavy, unrelated library (TipTap, Fortune-sheet, Quill+pptxgenjs) —
// lazy-loading them means a session that only ever opens the Word tab never downloads the
// Excel/PowerPoint engines' code at all, instead of one ~3.8MB bundle for all three upfront.
const RichTextEditor = React.lazy(() => import('./documentStudio/RichTextEditor'));
const SpreadsheetEditor = React.lazy(() => import('./documentStudio/SpreadsheetEditor'));
const PresentationEditor = React.lazy(() => import('./documentStudio/PresentationEditor'));
const SendToWorkflowModal = React.lazy(() => import('./documentStudio/SendToWorkflowModal'));

localforage.config({ name: 'CSS_RMS_Offline', storeName: 'drafts' });
const MAX_STORAGE_BYTES = 5 * 1024 * 1024; // 5MB max offline storage per department

const getObjectSize = (obj) => {
  try { return new Blob([JSON.stringify(obj)]).size; } catch(e) { return 0; }
};

const applyMemoFields = (html, fields) => {
  if (!html) return html;
  const replaceField = (key, value) => {
    const pattern = new RegExp(`(<span\\s+data-memo-${key}[^>]*>)([\\s\\S]*?)(</span>)`, 'i');
    return html.replace(pattern, `$1${value}$3`);
  };
  let nextHtml = html;
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      nextHtml = replaceField(key, value);
    }
  });
  return nextHtml;
};

const formatMemoRef = (deptCode) => {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const code = (deptCode || 'CSS').toUpperCase();
  return `CSSG/${code}/MO/${dd}/${mm}/${yyyy}/01`;
};

const formatMemoDate = () => {
  const d = new Date();
  return `${d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()}.`;
};

// ── Tab Button ──
const TabButton = ({ icon: Icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center space-x-2 px-5 py-3 rounded-xl text-sm font-bold transition-all ${
      active
        ? 'bg-primary/20 text-primary border border-primary/20 shadow-lg shadow-primary/10'
        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
    }`}
  >
    <Icon size={18} />
    <span>{label}</span>
  </button>
);

const EditorLoadingFallback = () => (
  <div className="glass bg-white/50 border border-border/50 rounded-2xl p-10 flex items-center justify-center min-h-[300px]">
    <div className="flex items-center gap-3 text-muted-foreground">
      <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      <span className="text-sm font-bold">Loading editor...</span>
    </div>
  </div>
);

const DocumentStudio = ({ user, onViewChange }) => {
  const [availableDepartments, setAvailableDepartments] = useState([]);
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);

  useEffect(() => {
    const fetchMetadata = async () => {
      const depts = await getDepartments();
      setAvailableDepartments(depts);
    };
    fetchMetadata();
  }, []);

  const handleSendToWorkflow = async (metadata) => {
    if (!currentActiveDraft) return;

    // UI feedback for refining if needed
    let isProcessing = true;
    const processingToast = toast.loading('Initializing and refining document flow...');

    try {
      // 1. AI Content Refinement (Optional but integrated)
      const contentToSend = metadata.aiPreview?.refinedContent || currentActiveDraft.data;
      const type = metadata.aiPreview?.type || (currentActiveDraft.title.toLowerCase().includes('memo') ? 'Memo' : 'Requisition');
      const finalAmount = metadata.aiPreview?.amount || 0;

      const selectedNames = metadata.departmentNames || [];
      const toLabel = selectedNames.join(' & ') || 'TARGET DEPARTMENT';
      const deptInfo = availableDepartments.find(d => d.id === user?.deptId) || {};
      const deptCode = resolveDeptCode(deptInfo, user?.department);

      const updatedContent = applyMemoFields(contentToSend, {
        ref: formatMemoRef(deptCode),
        date: formatMemoDate(),
        to: toLabel.toUpperCase(),
        from: (deptInfo.name || user?.department || '').toUpperCase(),
        'sender-name': deptInfo.headName || '',
        'sender-title': deptInfo.headTitle || ''
      });

      const payloads = (metadata.departmentIds || []).map((deptId) => ({
        title: currentActiveDraft.title,
        description: `Submitted from Document Studio: ${currentActiveDraft.title}`,
        departmentId: user?.deptId ? parseInt(user.deptId) : 1,
        targetDepartmentId: parseInt(deptId),
        type: type,
        status: 'pending',
        amount: finalAmount,
        urgency: metadata.priority || 'normal',
        content: updatedContent,
        createdBy: user?.name || 'Administrator',
        createdAt: new Date().toISOString()
      }));

      // 2. Submit requisitions
      const result = await addRequisition(payloads);

      // 3. Handle External Attachments
      if (metadata.files && metadata.files.length > 0 && Array.isArray(result)) {
         toast.loading('Uploading external attachments...', { id: processingToast });
         for (const req of result) {
            try {
               await uploadAttachments(req.id, metadata.files);
            } catch (err) {
               console.error("Attachment upload failed for one dept:", err);
            }
         }
      }

      await logActivity('Document Sent', `"${currentActiveDraft.title}" sent ${selectedNames.length} departments via Studio with security clearance.`);
      toast.success('Successfully sent to selected departments!', { id: processingToast });
      setIsSendModalOpen(false);
    } catch (err) {
      console.error("Scale-to-Workflow failed:", err);
      const msg = err.response?.data?.error || 'Failed to send document to departments';
      toast.error(msg, { id: processingToast });
    } finally {
      isProcessing = false;
    }
  };

  const [activeTab, setActiveTab] = useState('doc');

  // Drafts State
  const [draftsManagerOpen, setDraftsManagerOpen] = useState(false);
  const [allDrafts, setAllDrafts] = useState([]);
  const [currentDraftId, setCurrentDraftId] = useState(null);
  const [draftsSpaceUsed, setDraftsSpaceUsed] = useState(0);

  const localKey = `rms_drafts_${user?.department || 'global'}`;

  const loadDrafts = useCallback(async () => {
    const stored = await localforage.getItem(localKey);
    const drafts = Array.isArray(stored) ? stored : [];
    setAllDrafts(drafts);

    let totalSize = 0;
    drafts.forEach(d => { totalSize += (d.sizeBytes || 0); });
    setDraftsSpaceUsed(totalSize);
    return drafts;
  }, [localKey]);

  useEffect(() => {
    loadDrafts();
  }, [loadDrafts]);

  const initiateNewDraft = (type, templateKey = null) => {
    const newId = `draft_${Date.now()}`;
    const template = templateKey ? templates[templateKey] : null;
    const deptInfo = availableDepartments.find(d => d.id === user?.deptId) || {};
    const deptCode = resolveDeptCode(deptInfo, user?.department);

    // Pre-create the draft object to ensure it loads with template data immediately
    const newDraft = {
      id: newId,
      type,
      title: template ? template.title : (type === 'doc' ? 'Untitled Document' : type === 'sheet' ? 'Untitled Spreadsheet' : 'Untitled Presentation'),
      data: template
        ? (typeof template.data === 'function'
            ? template.data({
                deptCode,
                fromLabel: deptInfo.name || user?.department || '',
                toLabel: 'TARGET DEPARTMENT',
                subjectLabel: '[ENTER SUBJECT HERE]',
                headName: deptInfo.headName || '',
                headTitle: deptInfo.headTitle || '',
                date: new Date()
              })
            : template.data)
        : (type === 'sheet' ? [{ name: "Sheet1", celldata: [] }] : (type === 'slide' ? [{ id: Date.now(), html: '<h1 class="ql-align-center">New Slide</h1>' }] : '')),
      updatedAt: new Date().toISOString()
    };

    // Save it immediately so it's available for the next render
    const updateDrafts = async () => {
      const currentDrafts = Array.isArray(allDrafts) ? [...allDrafts, newDraft] : [newDraft];
      await localforage.setItem(localKey, currentDrafts);
      setAllDrafts(currentDrafts);
      setCurrentDraftId(newId);
      setActiveTab(type);
      setDraftsManagerOpen(false);
    };

    updateDrafts();
  };

  const handleAutosave = async ({ title, data }) => {
    // Resolve the ID and persist the draft in the SAME call — never split this into
    // "set the ID now, save it on the next call." If no further keystroke ever arrives
    // (or the editor unmounts/remounts before one does), that "next call" never happens,
    // currentDraftId points at an ID with no matching entry in allDrafts, and the editor
    // permanently blanks out since its render condition requires a matching draft to exist.
    const draftId = currentDraftId || `draft_${Date.now()}`;
    if (!currentDraftId) setCurrentDraftId(draftId);

    const currentDrafts = Array.isArray(allDrafts) ? [...allDrafts] : [];
    const draftIndex = currentDrafts.findIndex(d => d.id === draftId);

    const draftObj = {
      id: draftId,
      type: activeTab,
      title,
      data,
      updatedAt: new Date().toISOString()
    };
    draftObj.sizeBytes = getObjectSize(draftObj);

    if (draftIndex >= 0) {
      currentDrafts[draftIndex] = draftObj;
    } else {
      currentDrafts.push(draftObj);
    }

    // Size limit check
    let sizeCalc = 0;
    currentDrafts.forEach(d => { sizeCalc += (d.sizeBytes || 0); });

    if (sizeCalc > MAX_STORAGE_BYTES) {
      alert("Storage limit reached! Please delete older offline drafts.");
      return;
    }

    await localforage.setItem(localKey, currentDrafts);
    setAllDrafts(currentDrafts);
    setDraftsSpaceUsed(sizeCalc);
  };

  const deleteDraft = async (id) => {
    const filtered = allDrafts.filter(d => d.id !== id);
    await localforage.setItem(localKey, filtered);
    await loadDrafts();
    if (currentDraftId === id) setCurrentDraftId(null);
  };

  const loadDraftIntoEditor = (draft) => {
    setCurrentDraftId(draft.id);
    setActiveTab(draft.type);
    setDraftsManagerOpen(false);
  };

  const currentActiveDraft = allDrafts.find(d => d.id === currentDraftId);

  return (
    <div className="max-w-full space-y-8 pb-20 relative">

        <div className="space-y-4 w-full px-2 lg:px-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-3 md:space-y-0">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight flex items-center space-x-3">
            <Edit3 className="text-primary" />
            <span>Document <span className="text-primary">Studio</span></span>
          </h1>
          <p className="text-muted-foreground text-xs lg:text-sm mt-1 font-medium">
            Create, edit, and export documents. <span className="text-emerald-600 font-bold hidden sm:inline">Offline Auto-Save is Active.</span>
          </p>
        </div>

          <button
            onClick={() => setDraftsManagerOpen(true)}
            className="flex flex-col items-center justify-center bg-white border border-border/60 shadow-sm rounded-2xl px-5 py-3 hover:bg-muted/30 transition-all group"
          >
            <div className="flex items-center space-x-2 text-foreground font-bold">
              <FolderOpen size={18} className="text-primary group-hover:scale-110 transition-transform" />
              <span>Drafts ({allDrafts.length})</span>
            </div>
            <div className="text-[10px] text-muted-foreground font-mono mt-1 w-full bg-muted/50 rounded-full overflow-hidden h-1.5 relative">
               <div className="absolute top-0 left-0 h-full bg-primary" style={{ width: `${(draftsSpaceUsed/MAX_STORAGE_BYTES)*100}%`}}></div>
            </div>
            <p className="text-[9px] text-muted-foreground font-mono mt-1 uppercase">
              {(draftsSpaceUsed / 1024).toFixed(1)} KB / 5 MB
            </p>
          </button>
        </div>
        </div>

        {/* Tab Switcher */}
        {!currentDraftId ? (
          <div className="glass bg-white/50 border border-primary/20 rounded-3xl p-6 lg:p-10 text-center flex flex-col items-center justify-center min-h-[300px] w-full">
            <h2 className="text-lg lg:text-xl font-bold text-foreground mb-1">Start a New Document</h2>
            <p className="text-xs lg:text-sm text-muted-foreground mb-8 max-w-sm">Launch a new rich text document, spreadsheet, or presentation workspace.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full px-4 lg:px-8">
              {/* Blank Document */}
              <button
                onClick={() => initiateNewDraft('doc')}
                className="flex flex-col items-center justify-center p-6 bg-white border border-border/60 hover:border-primary/40 hover:bg-white rounded-2xl shadow-sm transition-all hover:scale-[1.02] group"
              >
                <div className="w-12 h-12 bg-primary/5 rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary/10 transition-colors text-primary">
                  <Plus size={24} />
                </div>
                <span className="font-bold text-sm">Blank Doc</span>
              </button>

              {/* Memo Template */}
              <button
                onClick={() => initiateNewDraft('doc', 'memo')}
                className="flex flex-col items-center justify-center p-6 bg-white border border-border/60 hover:border-primary/40 hover:bg-white rounded-2xl shadow-sm transition-all hover:scale-[1.02] group"
              >
                <div className="w-12 h-12 bg-primary/5 rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary/10 transition-colors text-primary">
                  <FileText size={24} />
                </div>
                <span className="font-bold text-sm">Internal Memo</span>
              </button>

              {/* Material Request Template */}
              <button
                onClick={() => initiateNewDraft('doc', 'materialRequest')}
                className="flex flex-col items-center justify-center p-6 bg-white border border-border/60 hover:border-primary/40 hover:bg-white rounded-2xl shadow-sm transition-all hover:scale-[1.02] group"
              >
                <div className="w-12 h-12 bg-primary/5 rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary/10 transition-colors text-primary">
                  <Save size={24} />
                </div>
                <span className="font-bold text-sm">Material Request</span>
              </button>

              {/* More Types */}
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => initiateNewDraft('sheet')}
                  className="flex items-center space-x-3 w-full p-3 bg-emerald-50 text-emerald-700 font-bold rounded-xl hover:bg-emerald-100 transition-all text-xs"
                >
                  <Table size={16} /> <span>New Sheet</span>
                </button>
                <button
                  onClick={() => initiateNewDraft('slide')}
                  className="flex items-center space-x-3 w-full p-3 bg-orange-50 text-orange-700 font-bold rounded-xl hover:bg-orange-100 transition-all text-xs"
                >
                  <Presentation size={16} /> <span>New Slide</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center space-x-3 p-1.5 glass bg-white/80 border border-border/50 rounded-2xl w-fit shadow-sm">
              <TabButton icon={FileText} label="Document Editor" active={activeTab === 'doc'} onClick={() => { setActiveTab('doc'); initiateNewDraft('doc'); }} />
              <TabButton icon={Table} label="Spreadsheet" active={activeTab === 'sheet'} onClick={() => { setActiveTab('sheet'); initiateNewDraft('sheet'); }} />
              <TabButton icon={Presentation} label="Presentation" active={activeTab === 'slide'} onClick={() => { setActiveTab('slide'); initiateNewDraft('slide'); }} />
            </div>

            {/* Active Editor */}
          <Suspense fallback={<EditorLoadingFallback />}>
          {currentDraftId && activeTab === 'doc' && currentActiveDraft && (
          <RichTextEditor
            key={currentDraftId}
            loadedDraft={currentActiveDraft}
            onAutosave={handleAutosave}
            onSend={() => setIsSendModalOpen(true)}
            currentUser={user}
            departments={availableDepartments}
          />
        )}
        {currentDraftId && activeTab === 'sheet' && currentActiveDraft && (
          <SpreadsheetEditor key={currentDraftId} loadedDraft={currentActiveDraft} onAutosave={handleAutosave} />
        )}
        {currentDraftId && activeTab === 'slide' && currentActiveDraft && (
          <PresentationEditor key={currentDraftId} loadedDraft={currentActiveDraft} onAutosave={handleAutosave} />
        )}
          </Suspense>

        <Suspense fallback={null}>
          {isSendModalOpen && (
            <SendToWorkflowModal
              isOpen={isSendModalOpen}
              onClose={() => setIsSendModalOpen(false)}
              onSend={handleSendToWorkflow}
              departments={availableDepartments}
              initialTitle={currentActiveDraft?.title}
              currentUser={user}
              content={currentActiveDraft?.data}
            />
          )}
        </Suspense>
          </>
        )}
      {/* Drafts Manager Modal */}
      {draftsManagerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[80vh] overflow-hidden shadow-2xl flex flex-col border border-border/50 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-border/50 flex items-center justify-between bg-muted/10">
              <div>
                <h2 className="text-xl font-bold text-foreground flex items-center space-x-2">
                  <HardDrive size={20} className="text-primary" />
                  <span>Department Drafts</span>
                </h2>
                <p className="text-xs text-muted-foreground mt-1">Manage auto-saved documents for {user?.department}</p>
              </div>
              <button onClick={() => setDraftsManagerOpen(false)} className="p-2 hover:bg-muted text-muted-foreground rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-muted/5 custom-scrollbar">
              {allDrafts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FolderOpen size={48} className="mx-auto text-muted-foreground/30 mb-4" />
                  <p className="font-bold">No saved drafts found.</p>
                  <p className="text-xs mt-1">Start a new document to see it appear here.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {allDrafts.map(draft => (
                    <div key={draft.id} className="bg-white border border-border/50 rounded-2xl p-4 flex flex-col group hover:border-primary/30 transition-all hover:shadow-md">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <div className={`p-2 rounded-lg ${draft.type === 'doc' ? 'bg-blue-500/10 text-blue-600' : draft.type === 'sheet' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-orange-500/10 text-orange-600'}`}>
                            {draft.type === 'doc' ? <FileText size={16} /> : draft.type === 'sheet' ? <Table size={16} /> : <Presentation size={16} />}
                          </div>
                          <div>
                            <h3 className="font-bold text-sm text-foreground truncate max-w-[150px]">{draft.title}</h3>
                            <p className="text-[10px] text-muted-foreground font-mono uppercase mt-0.5">{(draft.sizeBytes / 1024).toFixed(1)} KB</p>
                          </div>
                        </div>
                        <button onClick={() => deleteDraft(draft.id)} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <div className="text-xs text-muted-foreground mb-4 flex items-center space-x-1">
                        <Clock size={12} />
                        <span>{new Date(draft.updatedAt).toLocaleString()}</span>
                      </div>

                      <button
                        onClick={() => loadDraftIntoEditor(draft)}
                        className="w-full mt-auto flex items-center justify-center space-x-2 bg-muted hover:bg-primary/10 hover:text-primary text-foreground font-bold text-xs py-2 rounded-xl transition-all"
                      >
                        <Edit3 size={14} />
                        <span>Resume Editing</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      </div>
  );
};

export default DocumentStudio;
