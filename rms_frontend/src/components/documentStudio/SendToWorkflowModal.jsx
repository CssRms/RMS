import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { aiAPI, deptAPI } from '../../lib/api';
import { useAIFeatures } from '../../context/AIFeaturesContext';
import {
  ArrowLeft, Send, Zap, CheckCircle2, Loader2, AlertTriangle, Paperclip, Image as ImageIcon, X,
} from 'lucide-react';

const SendToWorkflowModal = ({ isOpen, onClose, onSend, departments, initialTitle, currentUser, content }) => {
  const [targetDeptIds, setTargetDeptIds] = useState([]);
  const [priority, setPriority] = useState('normal');
  const [files, setFiles] = useState([]);
  const [isRefining, setIsRefining] = useState(false);
  const [aiPreview, setAiPreview] = useState(null);
  const [activationMap, setActivationMap] = useState({});
  const [checkingActivation, setCheckingActivation] = useState({});
  const { aiEnabled } = useAIFeatures();

  const isDeptUser = currentUser?.role === 'department';
  const baseDepartments = departments.filter(d => d.name !== 'Super Admin');
  const allowedDepartments = (isDeptUser && currentUser?.deptId)
    ? baseDepartments.filter(d => d.id === currentUser.deptId)
    : baseDepartments;

  useEffect(() => {
    if (!isOpen) {
      setTargetDeptIds([]);
      setPriority('normal');
      setFiles([]);
      setAiPreview(null);
      return;
    }
    if (isDeptUser && currentUser?.deptId) {
      setTargetDeptIds([String(currentUser.deptId)]);
      checkActivation(currentUser.deptId);
    }
  }, [isOpen, isDeptUser, currentUser?.deptId]);

  const checkActivation = async (deptId) => {
    if (activationMap[deptId]) return;
    setCheckingActivation(prev => ({ ...prev, [deptId]: true }));
    try {
      const res = await deptAPI.checkActivation(deptId);
      setActivationMap(prev => ({ ...prev, [deptId]: res }));
    } catch {
      setActivationMap(prev => ({ ...prev, [deptId]: { activated: false } }));
    } finally {
      setCheckingActivation(prev => ({ ...prev, [deptId]: false }));
    }
  };

  const handleAiRefine = async () => {
    if (!content || content.trim().length < 10) {
      toast.error('Document content is too short for AI refinement.');
      return;
    }
    setIsRefining(true);
    try {
      const res = await aiAPI.refineDraft(content, 'pro');
      setAiPreview({
        refinedContent: res.refinedDescription,
        type: res.documentType,
        amount: res.totalAmount
      });
      toast.success('AI Refinement Complete (Grammar & Metadata Verified)');
    } catch (err) {
      toast.error('AI Refinement failed.');
    } finally {
      setIsRefining(false);
    }
  };

  const handleFileChange = (e) => {
    const newFiles = Array.from(e.target.files || []);
    setFiles(prev => [...prev, ...newFiles]);
  };

  const removeFile = (idx) => setFiles(prev => prev.filter((_, i) => i !== idx));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] bg-background flex flex-col overflow-y-auto safe-p-top p-4 sm:p-6 lg:p-8 custom-scrollbar animate-in fade-in duration-300">

      <div className="max-w-[1920px] mx-auto w-full flex flex-col gap-6 flex-1 h-full min-h-screen pb-10">

        {/* Top Header / Back Button */}
        <div className="flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl flex items-center gap-2 transition-all font-bold text-xs uppercase tracking-wider shadow-sm group"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            Back to Studio
          </button>
        </div>

        <div className="glass bg-white/95 w-full flex-1 rounded-[2rem] border border-border/40 shadow-xl relative flex flex-col overflow-hidden">

          <div className="p-6 lg:p-8 border-b border-border/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0 bg-white/50">
            <div className="space-y-1">
              <h2 className="text-2xl sm:text-3xl font-black text-foreground tracking-tighter leading-tight flex items-center space-x-3">
                <Send size={24} className="text-primary" />
                <span>Send to Workflow</span>
              </h2>
              <div className="flex items-center space-x-2 pt-2">
                <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                <span className="text-[9px] font-black uppercase tracking-widest text-primary/60">Routing Template Configurator</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground font-medium hidden sm:block">Configuring: "{initialTitle}"</p>
          </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {/* AI Refinement Nudge — hidden when AI features disabled */}
          {aiEnabled && (
            <div className={`p-4 rounded-2xl border transition-all ${
              aiPreview ? 'bg-emerald-50 border-emerald-200' : 'bg-primary/5 border-primary/10'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${aiPreview ? 'bg-emerald-500/10 text-emerald-600' : 'bg-primary/10 text-primary'}`}>
                    <Zap size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">AI Polish & Verify</h3>
                    <p className="text-[10px] text-muted-foreground">Checks grammar and certifies document category.</p>
                  </div>
                </div>
                <button
                  onClick={handleAiRefine}
                  disabled={isRefining}
                  className="px-4 py-2 bg-white border border-border rounded-xl text-xs font-bold shadow-sm hover:border-primary/30 transition-all flex items-center gap-2"
                >
                  {isRefining ? <Loader2 size={14} className="animate-spin" /> : aiPreview ? <CheckCircle2 size={14} className="text-emerald-500" /> : <Zap size={14} />}
                  {aiPreview ? 'Repolish' : 'Polish Content'}
                </button>
              </div>
              {aiPreview && (
                <div className="mt-3 pt-3 border-t border-emerald-100 grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <div className="text-[10px] font-black uppercase text-emerald-700 tracking-widest bg-emerald-100 px-2 py-0.5 rounded">Category: {aiPreview.type}</div>
                  </div>
                  {aiPreview.amount > 0 && (
                    <div className="flex items-center gap-2 text-right justify-end">
                      <div className="text-[10px] font-black uppercase text-primary tracking-widest bg-primary/10 px-2 py-0.5 rounded">₦{aiPreview.amount.toLocaleString()}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Target Departments</label>
              <div className="max-h-56 overflow-y-auto bg-muted/20 border border-border/40 rounded-2xl p-3 space-y-1">
                {allowedDepartments.map(d => {
                  const status = activationMap[d.id];
                  const loading = checkingActivation[d.id];
                  const isGlobalAdmin = currentUser?.role === 'global_admin';
                  const isBlocked = status && !status.activated && !isGlobalAdmin;

                  return (
                    <div key={d.id} className="group">
                      <label className={`flex items-center justify-between p-2 rounded-xl transition-all ${
                        targetDeptIds.includes(String(d.id)) ? 'bg-primary/5' : 'hover:bg-white/50'
                      }`}>
                        <div className="flex items-center space-x-2 text-sm font-medium">
                          <input
                            type="checkbox"
                            className="rounded-lg border-border"
                            checked={targetDeptIds.includes(String(d.id))}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setTargetDeptIds(prev => checked ? [...prev, String(d.id)] : prev.filter(id => id !== String(d.id)));
                              if (checked) checkActivation(d.id);
                            }}
                            disabled={isDeptUser || isBlocked}
                          />
                          <span className={isBlocked ? 'text-muted-foreground line-through decoration-red-500/50' : ''}>{d.name}</span>
                        </div>
                        {loading && <Loader2 size={12} className="animate-spin text-muted-foreground" />}
                        {isBlocked && (
                          <div title="This department head has not uploaded a digital signature." className="text-red-500">
                            <AlertTriangle size={14} />
                          </div>
                        )}
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-6">
               <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Priority</label>
                <div className="grid grid-cols-3 gap-2">
                  {['normal', 'urgent', 'critical'].map(p => (
                    <button
                      key={p}
                      onClick={() => setPriority(p)}
                      className={`py-2 rounded-xl text-[10px] font-bold uppercase transition-all border ${
                        priority === p ? 'bg-primary text-white border-primary shadow-md shadow-primary/20' : 'bg-white border-border text-muted-foreground hover:border-primary/30'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1 flex items-center justify-between">
                  <span>External Attachments</span>
                  <span className="text-[9px] font-bold text-primary">{files.length} selected</span>
                </label>
                <div
                  onClick={() => document.getElementById('studio-attachments').click()}
                  className="border-2 border-dashed border-border/60 rounded-2xl p-4 flex flex-col items-center justify-center hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer group"
                >
                  <Paperclip size={18} className="text-muted-foreground group-hover:text-primary mb-1" />
                  <span className="text-[10px] font-bold text-muted-foreground group-hover:text-primary">Click to attach files</span>
                  <input id="studio-attachments" type="file" multiple className="hidden" onChange={handleFileChange} />
                </div>
                {files.length > 0 && (
                  <div className="grid grid-cols-1 gap-1.5 mt-2 max-h-24 overflow-y-auto pr-1">
                     {files.map((file, i) => (
                       <div key={i} className="flex items-center justify-between bg-white border border-border/40 p-2 rounded-xl animate-in slide-in-from-left-2 duration-200">
                          <div className="flex items-center gap-2 overflow-hidden">
                             <ImageIcon size={12} className="text-primary shrink-0" />
                             <span className="text-[10px] font-medium truncate">{file.name}</span>
                          </div>
                          <button onClick={(e) => { e.stopPropagation(); removeFile(i); }} className="text-red-400 hover:text-red-600 transition-colors">
                             <X size={12} />
                          </button>
                       </div>
                     ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 bg-muted/20 border-t border-border/40 flex items-center gap-3 shrink-0">
          <button onClick={onClose} className="flex-1 py-3 font-bold text-sm text-muted-foreground hover:bg-muted rounded-xl transition-all">Cancel</button>
          <button
            disabled={targetDeptIds.length === 0}
            onClick={() => onSend({
              departmentIds: targetDeptIds,
              departmentNames: allowedDepartments.filter(d => targetDeptIds.includes(String(d.id))).map(d => d.name),
              priority,
              aiPreview,
              files
            })}
            className="flex-[3] py-3 px-8 bg-primary text-white font-bold text-sm rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-3"
          >
            <Send size={18} />
            <span>Send to Workflow</span>
          </button>
        </div>
      </div>
     </div>
    </div>
  );
};

export default SendToWorkflowModal;
