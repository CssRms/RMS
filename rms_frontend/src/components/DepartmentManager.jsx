import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRef } from 'react';
import {
  Plus, Trash2, Building2, Briefcase, Search,
  Eye, EyeOff, Pencil, X, Save, Loader2, KeyRound,
  CheckCircle2, RotateCcw, Info, User, Mail, Phone, Hash, BadgeCheck, Download,
  Upload, PenTool, AlertTriangle
} from 'lucide-react';
import { getDepartments, addDepartment, deleteDepartment } from '../lib/store';
import { deptAPI, reqAPI, settingsAPI } from '../lib/api';
import { toast } from 'react-hot-toast';
import ConfirmModal from './ConfirmModal';

// ── Auto-generated Department Seal SVG ────────────────────────────────────────
const DepartmentSeal = ({ name, id = '' }) => {
  const cx = 125, cy = 125;
  const color = '#1a5c1a';
  const date = new Date().toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric'
  }).toUpperCase();

  const uid = id ? `${id}` : name.replace(/[^a-zA-Z0-9]/g, '_');
  const arcR = 93;
  const topId = `sealTop_${uid}`;
  const botId = `sealBot_${uid}`;

  const len = name.length;
  const fontSize = len <= 14 ? 12.5 : len <= 22 ? 11 : 9.5;
  const letterSpacing = len <= 14 ? 2 : len <= 22 ? 1.2 : 0.8;

  return (
    <svg viewBox="0 0 250 250" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
      <defs>
        {/* Top arc: sweep=1 → path goes over the top, text reads left-to-right outward */}
        <path id={topId} d={`M ${cx - arcR},${cy} a ${arcR},${arcR} 0 0,1 ${arcR * 2},0`} />
        {/* Bottom arc: sweep=0 → path goes under the bottom, text reads left-to-right inward */}
        <path id={botId} d={`M ${cx - arcR},${cy} a ${arcR},${arcR} 0 0,0 ${arcR * 2},0`} />
      </defs>

      {/* White background */}
      <circle cx={cx} cy={cy} r={120} fill="white" />

      {/* Outer double rings */}
      <circle cx={cx} cy={cy} r={116} fill="none" stroke={color} strokeWidth="4.5" />
      <circle cx={cx} cy={cy} r={107} fill="none" stroke={color} strokeWidth="1.5" />

      {/* Inner ring */}
      <circle cx={cx} cy={cy} r={72} fill="none" stroke={color} strokeWidth="1.5" />

      {/* Department name on top arc */}
      <text fontSize={fontSize} fontWeight="bold" fontFamily="Arial, sans-serif"
        letterSpacing={letterSpacing} fill={color}>
        <textPath href={`#${topId}`} startOffset="50%" textAnchor="middle">
          {name.toUpperCase()}
        </textPath>
      </text>

      {/* "DEPARTMENT" on bottom arc */}
      <text fontSize="10" fontWeight="bold" fontFamily="Arial, sans-serif"
        letterSpacing="2.5" fill={color}>
        <textPath href={`#${botId}`} startOffset="50%" textAnchor="middle">
          DEPARTMENT
        </textPath>
      </text>

      {/* Diamond separators at equator */}
      <text x={cx - arcR - 4} y={cy + 4} fontSize="8" fill={color} textAnchor="middle">◆</text>
      <text x={cx + arcR + 4} y={cy + 4} fontSize="8" fill={color} textAnchor="middle">◆</text>

      {/* CSS Farms logo centered */}
      <image href="/CSS_Group.png" x={cx - 45} y={cy - 32} width="90" height="50"
        preserveAspectRatio="xMidYMid meet" />

      {/* Thin divider below logo */}
      <line x1={cx - 44} y1={cy + 22} x2={cx + 44} y2={cy + 22} stroke={color} strokeWidth="0.8" />

      {/* Date below divider */}
      <text x={cx} y={cy + 35} textAnchor="middle" fontSize="8" fontFamily="Arial, sans-serif"
        fontWeight="bold" letterSpacing="1" fill={color}>{date}</text>
    </svg>
  );
};

// ── Seal View Modal ────────────────────────────────────────────────────────────
const SealViewModal = ({ dept, onClose }) => {
  const handleDownload = async () => {
    const svgEl = document.getElementById('seal-svg-export');
    if (!svgEl) return;

    // Inline CSS_Group.png as base64 so the downloaded SVG is self-contained
    let logoDataUrl = null;
    try {
      const res = await fetch('/CSS_Group.png');
      const blob = await res.blob();
      logoDataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
    } catch { /* logo unavailable — download without it */ }

    const clone = svgEl.cloneNode(true);
    if (logoDataUrl) {
      const imgEl = clone.querySelector('image');
      if (imgEl) imgEl.setAttribute('href', logoDataUrl);
    }

    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(clone);
    const dlBlob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(dlBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${dept.name.replace(/\s+/g, '_')}_Seal.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border/30">
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Department Seal</h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">{dept.name} · Auto-generated · Live Date</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-xl text-muted-foreground transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Seal preview */}
        <div className="p-8 flex items-center justify-center">
          <div id="seal-svg-export" className="w-60 h-60 drop-shadow-xl">
            <DepartmentSeal name={dept.name} id={String(dept.id)} />
          </div>
        </div>

        {/* Info strip */}
        <div className="mx-6 mb-4 p-3 bg-primary/5 rounded-xl flex items-start gap-2">
          <Info size={12} className="text-primary shrink-0 mt-0.5" />
          <p className="text-[10px] text-primary/80 font-medium leading-relaxed">
            This seal is auto-generated for <strong>{dept.name}</strong>. The date shown is always today's date. It appears as a watermark on official PDF documents from this department.
          </p>
        </div>

        {/* Download button */}
        <div className="px-6 pb-6">
          <button
            onClick={handleDownload}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-primary/30 text-primary font-bold text-xs uppercase tracking-widest hover:bg-primary/5 transition-all active:scale-[0.98]"
          >
            <Download size={14} />
            Download Seal (SVG)
          </button>
        </div>
      </div>
    </div>
  );
};


// ── Edit Department Modal ─────────────────────────────────────────────────────
const EditDeptModal = ({ dept, onClose, onSaved }) => {
  // Parse existing headName into surname / firstName / otherName parts
  const existingParts = (dept.headName || '').trim().split(/\s+/);
  const [form, setForm] = useState({
    name: dept.name || '',
    type: dept.type || 'Operational',
    headStaffId:   dept.staffId || '',
    headSurname:   existingParts[0] || '',
    headFirstName: existingParts[1] || '',
    headOtherName: existingParts.slice(2).join(' ') || '',
    headTitle: dept.headTitle || '',
    headEmail: dept.headEmail || '',
    phone: dept.phone || '',
  });
  const [newCode, setNewCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resettingCode, setResettingCode] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Department name is required.'); return; }
    if (!form.headStaffId.trim()) { toast.error('Staff ID is required.'); return; }
    if (!form.headSurname.trim()) { toast.error('Surname is required.'); return; }
    if (!form.headFirstName.trim()) { toast.error('First name is required.'); return; }
    if (!form.headEmail.trim()) { toast.error('Official email is required.'); return; }
    if (!form.phone.trim()) { toast.error('Contact phone is required — used to SMS the access code.'); return; }
    const combinedName = [form.headSurname, form.headFirstName, form.headOtherName].map(s => s.trim()).filter(Boolean).join(' ');
    setSaving(true);
    try {
      await deptAPI.updateDepartment(dept.id, { ...form, headName: combinedName, staffId: form.headStaffId.trim().toUpperCase() });
      toast.success(`${form.name} updated successfully.`);
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to update department.');
    } finally { setSaving(false); }
  };

  const handleResetCode = async () => {
    if (!newCode.trim() || newCode.trim().length < 4) {
      toast.error('New password must be at least 4 characters.');
      return;
    }
    setResettingCode(true);
    try {
      await deptAPI.resetAccessCode(dept.id, newCode.trim());
      toast.success(`Password reset for ${dept.name}. The department will need to log in with the new password.`);
      setNewCode('');
      onSaved();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to reset password.');
    } finally { setResettingCode(false); }
  };

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="sticky top-0 bg-white rounded-t-3xl px-6 pt-6 pb-4 border-b border-border/30 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Building2 size={18} />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Edit Department</h3>
                <p className="text-[10px] text-muted-foreground font-mono mt-0.5 truncate max-w-[200px]">{dept.name}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-muted rounded-xl text-muted-foreground transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <p className="text-[9px] font-black text-muted-foreground/50 uppercase tracking-[0.25em]">Basic Information</p>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Department Name</label>
              <input value={form.name} onChange={set('name')} className="w-full border border-border/50 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {['Operational', 'Strategic'].map(t => (
                <button key={t} type="button" onClick={() => setForm(f => ({ ...f, type: t }))}
                  className={`py-2.5 rounded-xl border text-xs font-bold uppercase tracking-tight transition-all ${form.type === t ? 'bg-primary/10 border-primary/50 text-primary' : 'border-border/50 text-muted-foreground hover:border-border'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Head Info */}
          <div className="space-y-4">
            <p className="text-[9px] font-black text-muted-foreground/50 uppercase tracking-[0.25em]">Head Official</p>
            {[
              { key: 'headStaffId',   label: 'Staff ID',         icon: Hash,       placeholder: 'e.g. CSS001', required: true },
              { key: 'headSurname',   label: 'Surname',          icon: User,       placeholder: 'e.g. Musa', required: true },
              { key: 'headFirstName', label: 'First Name',        icon: User,       placeholder: 'e.g. Chindo', required: true },
              { key: 'headOtherName', label: 'Other Name',        icon: User,       placeholder: 'e.g. James (optional)' },
              { key: 'headTitle',     label: 'Designation / Title', icon: BadgeCheck, placeholder: 'General Manager' },
              { key: 'headEmail',     label: 'Official Email',    icon: Mail,       placeholder: 'head@cssgroup.internal', type: 'email', required: true },
              { key: 'phone',         label: 'Contact Phone',     icon: Phone,      placeholder: '+234 800 000 0000', required: true },
            ].map(({ key, label, icon: Icon, placeholder, type, required }) => (
              <div key={key} className="relative">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1">
                  {label}{required && <span className="text-red-500 ml-0.5">*</span>}
                </label>
                <div className="flex items-center border border-border/50 rounded-xl focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10 bg-white">
                  <Icon size={14} className="text-muted-foreground ml-3 shrink-0" />
                  <input value={form[key]} onChange={set(key)} type={type || 'text'} placeholder={placeholder} required={required}
                    className="flex-1 px-3 py-3 text-sm font-medium bg-transparent outline-none" />
                </div>
              </div>
            ))}
          </div>

          <button type="submit" disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-bold py-3 rounded-xl text-xs uppercase tracking-widest hover:bg-primary/90 transition-all disabled:opacity-50 shadow-lg shadow-primary/20 active:scale-95">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Saving…' : 'Save Department'}
          </button>
        </form>

        {/* Access Code Reset */}
        <div className="px-6 pb-6">
          <div className="border-t border-border/30 pt-6 space-y-4">
            <div className="flex items-center gap-2">
              <KeyRound size={14} className="text-amber-500" />
              <p className="text-[9px] font-black text-muted-foreground/50 uppercase tracking-[0.25em]">Reset Password</p>
              {dept.codeChangedByDept && (
                <span className="text-[9px] font-black text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full uppercase tracking-widest">
                  Dept-modified
                </span>
              )}
            </div>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[10px] text-amber-700 font-medium leading-relaxed flex items-start gap-2">
              <Info size={12} className="shrink-0 mt-0.5" />
              <span>
                {dept.codeChangedByDept
                  ? `This department has changed their password from the original. Resetting here will override their custom password.`
                  : `Enter a new password to replace the current one. The department will use this new password on their next login.`}
              </span>
            </div>
            <div className="flex gap-3">
              <div className="flex-1 flex items-center border border-border/50 rounded-xl focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-400/10 bg-white">
                <KeyRound size={14} className="text-muted-foreground ml-3 shrink-0" />
                <input
                  value={newCode}
                  onChange={e => setNewCode(e.target.value)}
                  type={showCode ? 'text' : 'password'}
                  placeholder="New password (min 4 chars)"
                  className="flex-1 px-3 py-3 text-sm font-mono bg-transparent outline-none"
                />
                <button type="button" onClick={() => setShowCode(v => !v)} className="px-3 text-muted-foreground hover:text-foreground">
                  {showCode ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <button
                type="button"
                onClick={handleResetCode}
                disabled={resettingCode || !newCode.trim()}
                className="flex items-center gap-1.5 px-4 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs uppercase tracking-widest transition-all disabled:opacity-40 shrink-0 shadow-md shadow-amber-500/20"
              >
                {resettingCode ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


// ── Main Component ────────────────────────────────────────────────────────────
const DepartmentManager = ({ onViewChange }) => {
  const { user } = useAuth();
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [pendingDept, setPendingDept] = useState(null);
  const [editingDept, setEditingDept] = useState(null);
  const [sealDept, setSealDept] = useState(null);
  const [newDeptData, setNewDeptData] = useState({ name: '', type: 'Operational', accessCode: '', headStaffId: '', headSurname: '', headFirstName: '', headOtherName: '', headTitle: '', headEmail: '', phone: '' });

  // Flash-free: default null (unknown/hidden) until the real setting resolves, so the
  // Head Official section never flashes visible-then-hidden when it's actually disabled.
  const [deptCreationHeadDetailsEnabled, setDeptCreationHeadDetailsEnabled] = useState(null);

  const [showAccessCode, setShowAccessCode] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadingSigFor, setUploadingSigFor] = useState(null);
  const [sigTimestamps, setSigTimestamps] = useState({});

  const sigFileRef = useRef(null);

  const handleAdminSigUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !uploadingSigFor) return;
    const deptId = uploadingSigFor;
    setUploadingSigFor(`uploading_${deptId}`);
    try {
      await reqAPI.adminUploadDeptSignature(deptId, file);
      setSigTimestamps(prev => ({ ...prev, [deptId]: Date.now() }));
      toast.success('Signature updated and department notified.');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Upload failed.');
    } finally { setUploadingSigFor(null); }
  };

  const loadDepts = async () => {
    const data = await getDepartments();
    setDepartments(data);
    setLoading(false);
  };

  useEffect(() => { loadDepts(); }, []);

  useEffect(() => {
    settingsAPI.get('dept_creation_head_details_enabled')
      .then(res => setDeptCreationHeadDetailsEnabled(res?.value !== 'false'))
      .catch(() => setDeptCreationHeadDetailsEnabled(true)); // fail open — don't get stuck hidden over a network blip
  }, []);

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!newDeptData.name || !newDeptData.accessCode) {
      toast.error('Department name and password are required.');
      return;
    }
    // Defense in depth — the live check already blocks the button, but guard here too
    // in case the loaded department list is momentarily stale.
    const trimmedName = newDeptData.name.trim().toLowerCase();
    if (departments.some(d => (d.name || '').trim().toLowerCase() === trimmedName)) {
      toast.error(`A department named "${newDeptData.name.trim()}" already exists. Please choose a different name.`);
      return;
    }
    const headDetailsOn = deptCreationHeadDetailsEnabled === true;
    const headName = [newDeptData.headSurname, newDeptData.headFirstName, newDeptData.headOtherName].map(s => s.trim()).filter(Boolean).join(' ');
    const payload = headDetailsOn
      ? { ...newDeptData, headName, staffId: newDeptData.headStaffId.trim().toUpperCase() }
      : { name: newDeptData.name, type: newDeptData.type, accessCode: newDeptData.accessCode };
    setIsProcessing(true);
    try {
      await new Promise(r => setTimeout(r, 400));
      await addDepartment(payload);
      await loadDepts();
      setIsAddModalOpen(false);
      const deptName = newDeptData.name;
      setNewDeptData({ name: '', type: 'Operational', accessCode: '', headStaffId: '', headSurname: '', headFirstName: '', headOtherName: '', headTitle: '', headEmail: '', phone: '' });
      toast.success(`${deptName} Department added`);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to create department.');
    } finally {
      setIsProcessing(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDept) return;
    setIsProcessing(true);
    await new Promise(r => setTimeout(r, 400));
    await deleteDepartment(pendingDept.id);
    await loadDepts();
    setIsProcessing(false);
    setIsDeleteModalOpen(false);
    toast.error(`${pendingDept.name} Department removed`);
    setPendingDept(null);
  };

  const strategic = departments.filter(d => d.type === 'Strategic');
  const operational = departments.filter(d => d.type === 'Operational');
  const filteredS = strategic.filter(d => d.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredO = operational.filter(d => d.name.toLowerCase().includes(searchTerm.toLowerCase()));

  if (loading) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center space-y-6">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center text-primary">
            <Briefcase size={24} className="animate-pulse" />
          </div>
        </div>
        <p className="text-sm font-bold text-primary tracking-widest uppercase animate-pulse">Syncing Corporate Hierarchy</p>
      </div>
    );
  }

  return (
    <>
    <div className="max-w-6xl mx-auto space-y-10 pb-20">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight flex items-center space-x-3">
              <Briefcase className="text-primary" />
              <span>Department <span className="text-primary">Manager</span></span>
            </h1>
            <p className="text-muted-foreground text-sm mt-1 font-medium">
              Manage operational units and strategic control departments.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search departments..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="bg-white/80 border border-border/50 rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 w-56 shadow-sm"
              />
            </div>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 px-5 rounded-xl transition-all shadow-lg shadow-primary/20 flex items-center gap-2 text-sm"
            >
              <Plus size={17} />
              Add Department
            </button>
          </div>
        </div>

        {/* Info box — seal vs signature */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 flex items-start gap-3 p-4 bg-indigo-500/5 border border-indigo-500/15 rounded-2xl">
            <Eye size={16} className="text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Department Seal (Auto-generated)</p>
              <p className="text-[10px] text-muted-foreground font-medium mt-0.5 leading-relaxed">
                Each department gets a unique seal generated automatically with their name and today's date. Click the <strong>eye icon</strong> on any department card to view or download it. It is embedded as a watermark on official PDF documents.
              </p>
            </div>
          </div>
          <div className="flex-1 flex items-start gap-3 p-4 bg-emerald-500/5 border border-emerald-500/15 rounded-2xl">
            <BadgeCheck size={16} className="text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Head Officer Signature</p>
              <p className="text-[10px] text-muted-foreground font-medium mt-0.5 leading-relaxed">
                The handwritten signature of the department head — uploaded by the department themselves via their <strong>Dept Profile</strong> page. It auto-embeds above the signature line on PDFs.
              </p>
            </div>
          </div>
        </div>

        {/* Unified Corporate Hierarchy Table */}
        <div className="glass bg-white/70 rounded-3xl border border-border/50 p-6 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between mb-5 px-1">
            <div>
              <h3 className="text-base font-bold text-foreground">Corporate Hierarchy & Credentials</h3>
              <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
                Manage all units, their passwords, and official signatures in one centralized directory.
              </p>
            </div>
            <div className="flex items-center gap-4">
               <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{departments.length} Units Synchronized</span>
            </div>
          </div>

          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse border-separate border-spacing-0">
              <thead>
                <tr className="bg-muted/30 text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                  <th className="py-4 px-4 rounded-tl-xl border-y border-l">Unit Name</th>
                  <th className="py-4 px-4 border-y">Category</th>
                  <th className="py-4 px-4 border-y">Login Code</th>
                  <th className="py-4 px-4 border-y">Signature</th>
                  <th className="py-4 px-4 border-y">Staff ID</th>
                  <th className="py-4 px-4 border-y">First Name</th>
                  <th className="py-4 px-4 border-y">Surname</th>
                  <th className="py-4 px-4 border-y">Other Name</th>
                  <th className="py-4 px-4 border-y">Official Email</th>
                  <th className="py-4 px-4 border-y">Contact Phone</th>
                  <th className="py-4 px-4 rounded-tr-xl border-y border-r text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {departments
                  .filter(d => d.name.toLowerCase().includes(searchTerm.toLowerCase()))
                  .map((dept) => {
                    const displayCode = dept.accessCodeLabel || dept.accessCode || null;
                    return (
                      <tr key={dept.id} className="hover:bg-primary/[0.02] transition-colors group">
                        <td className="py-4 px-4 text-xs font-bold text-foreground border-l border-border/10">{dept.name}</td>
                        <td className="py-4 px-4">
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${dept.type === 'Strategic' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                            {dept.type}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          {displayCode ? (
                            <div className="flex flex-col gap-0.5">
                              <span className={`text-xs font-mono font-bold ${dept.codeChangedByDept ? 'line-through text-muted-foreground/30 decoration-red-400 decoration-2' : 'text-foreground'}`}>
                                {displayCode}
                              </span>
                              {dept.codeChangedByDept && (
                                <span className="text-[8px] font-black bg-amber-500 text-white px-1.5 py-0.5 rounded-md uppercase tracking-wider w-fit">
                                  ✓ Changed by Dept
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[9px] text-muted-foreground/40 italic">Not set</span>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          {(() => {
                            const ts = sigTimestamps[dept.id] || 0;
                            const isUploading = uploadingSigFor === `uploading_${dept.id}`;
                            return (
                              <div className="flex flex-col items-center gap-1.5 min-w-[80px]">
                                <div className="w-16 h-10 rounded-lg border border-border/40 bg-muted/20 overflow-hidden flex items-center justify-center">
                                  <img
                                    src={`/api/departments/${dept.id}/signature/image?t=${ts}`}
                                    alt="sig"
                                    className="max-w-full max-h-full object-contain"
                                    onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                                  />
                                  <div style={{ display: 'none' }} className="w-full h-full items-center justify-center">
                                    <PenTool size={12} className="text-muted-foreground/30" />
                                  </div>
                                </div>
                                <button
                                  disabled={isUploading}
                                  onClick={() => { setUploadingSigFor(dept.id); sigFileRef.current?.click(); }}
                                  className="text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-lg bg-primary/10 hover:bg-primary hover:text-white text-primary transition-all flex items-center gap-1 disabled:opacity-50"
                                  title={`Set/override signature for ${dept.name}`}
                                >
                                  {isUploading ? <Loader2 size={9} className="animate-spin" /> : <Upload size={9} />}
                                  {isUploading ? 'Saving…' : 'Set'}
                                </button>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="py-4 px-4 text-xs font-mono font-bold text-muted-foreground">{dept.staffId || '—'}</td>
                        {(() => {
                          const parts = (dept.headName || '').trim().split(/\s+/).filter(Boolean);
                          const surname   = parts[0] || '—';
                          const firstName = parts[1] || '—';
                          const otherName = parts.slice(2).join(' ') || '—';
                          return (
                            <>
                              <td className="py-4 px-4 text-xs text-muted-foreground font-medium">{firstName}</td>
                              <td className="py-4 px-4 text-xs text-muted-foreground font-medium">{surname}</td>
                              <td className="py-4 px-4 text-xs text-muted-foreground/70 font-medium">{otherName}</td>
                            </>
                          );
                        })()}
                        <td className="py-4 px-4 text-xs text-primary font-medium">{dept.headEmail || '—'}</td>
                        <td className="py-4 px-4 text-xs text-muted-foreground font-medium">{dept.phone || '—'}</td>
                        <td className="py-4 px-4 border-r border-border/10">
                          <div className="flex items-center justify-center space-x-1">
                            <button onClick={() => setEditingDept(dept)} className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-lg transition-all" title="Edit Unit">
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => setSealDept(dept)} className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-lg transition-all" title="View Seal">
                              <Eye size={14} />
                            </button>
                            <button onClick={() => { setPendingDept(dept); setIsDeleteModalOpen(true); }} className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-lg transition-all" title="Delete Unit">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
            {departments.filter(d => d.name.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 && (
               <div className="py-20 text-center">
                  <p className="text-sm text-muted-foreground italic">No departments match your search criteria.</p>
               </div>
            )}
          </div>
        </div>

      </div>



      {/* Hidden file input for admin signature override */}
      <input
        type="file"
        ref={sigFileRef}
        className="hidden"
        accept="image/png,image/jpeg"
        onChange={handleAdminSigUpload}
      />

      {/* Seal View Modal */}
      {sealDept && (
        <SealViewModal dept={sealDept} onClose={() => setSealDept(null)} />
      )}

      {/* Edit Modal */}
      {editingDept && (
        <EditDeptModal
          dept={editingDept}
          onClose={() => setEditingDept(null)}
          onSaved={() => { loadDepts(); setEditingDept(null); }}
        />
      )}

      {/* Add Modal — compact centered overlay, same style as Edit Department (keeps sidebar visible) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setIsAddModalOpen(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="sticky top-0 bg-white rounded-t-3xl px-6 pt-6 pb-4 border-b border-border/30 z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <Building2 size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Add New Department</h3>
                    <p className="text-[10px] text-muted-foreground font-mono mt-0.5">System Context Active</p>
                  </div>
                </div>
                <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-muted rounded-xl text-muted-foreground transition-colors">
                  <X size={16} />
                </button>
              </div>
            </div>

            {(() => {
              const trimmedNewName = newDeptData.name.trim().toLowerCase();
              const nameClash = !!trimmedNewName && departments.some(d => (d.name || '').trim().toLowerCase() === trimmedNewName);
              return (
            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Department Name</label>
                <input type="text" value={newDeptData.name} onChange={e => setNewDeptData(d => ({ ...d, name: e.target.value }))}
                  placeholder="e.g. Finance & Accounts"
                  className={`w-full bg-muted/30 border rounded-xl p-4 outline-none ${nameClash ? 'border-red-400 focus:ring-2 focus:ring-red-200' : 'border-border/50 focus:ring-2 focus:ring-primary/20'}`} />
                {nameClash && (
                  <p className="text-[11px] text-red-600 font-semibold flex items-center gap-1.5">
                    <AlertTriangle size={12} className="shrink-0" />
                    A department named "{newDeptData.name.trim()}" already exists. Please choose a different name.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Login Password</label>
                <div className="relative">
                  <input type={showAccessCode ? 'text' : 'password'} value={newDeptData.accessCode}
                    onChange={e => setNewDeptData(d => ({ ...d, accessCode: e.target.value }))}
                    placeholder="e.g. HATCH-2026"
                    className="w-full bg-muted/30 border border-border/50 rounded-xl p-4 pr-12 focus:ring-2 focus:ring-primary/20 outline-none font-mono" />
                  <button type="button" onClick={() => setShowAccessCode(v => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-primary">
                    {showAccessCode ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {['Operational', 'Strategic'].map(type => (
                  <button key={type} type="button" onClick={() => setNewDeptData(d => ({ ...d, type }))}
                    className={`p-4 rounded-xl border transition-all text-xs font-bold uppercase ${newDeptData.type === type ? 'bg-primary/10 border-primary/50 text-primary' : 'bg-white border-border/50 text-muted-foreground hover:border-border'}`}>
                    {type}
                  </button>
                ))}
              </div>

              {/* Head Official Details — hidden entirely when Super Admin disables this setting */}
              {deptCreationHeadDetailsEnabled === true && (
              <div className="space-y-3 pt-1">
                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-border/40" />
                  <p className="text-[9px] font-black text-muted-foreground/50 uppercase tracking-[0.25em] shrink-0">Head Official</p>
                  <div className="h-px flex-1 bg-border/40" />
                </div>
                {[
                  { key: 'headStaffId',   label: 'Staff ID',          placeholder: 'e.g. CSS001',                icon: Hash,       required: true },
                  { key: 'headSurname',   label: 'Surname',          placeholder: 'e.g. Adeyemi',               icon: User,       required: true },
                  { key: 'headFirstName', label: 'First Name',        placeholder: 'e.g. John',                  icon: User,       required: true },
                  { key: 'headOtherName', label: 'Other Name',        placeholder: 'e.g. Chukwuemeka (optional)', icon: User },
                  { key: 'headTitle',     label: 'Position / Title',  placeholder: 'e.g. General Manager',       icon: BadgeCheck, required: true },
                  { key: 'headEmail',     label: 'Official Email',    placeholder: 'e.g. head@cssgroup.internal', icon: Mail, type: 'email', required: true },
                  { key: 'phone',         label: 'Contact Phone',     placeholder: '+234 800 000 0000',          icon: Phone,      type: 'tel', required: true },
                ].map(({ key, label, placeholder, icon: Icon, type, required }) => (
                  <div key={key} className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                      {label}{required && <span className="text-red-500 ml-0.5">*</span>}
                    </label>
                    <div className="flex items-center border border-border/50 rounded-xl focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10 bg-white">
                      <Icon size={14} className="text-muted-foreground ml-3 shrink-0" />
                      <input
                        value={newDeptData[key]}
                        onChange={e => setNewDeptData(d => ({ ...d, [key]: e.target.value }))}
                        type={type || 'text'}
                        placeholder={placeholder}
                        required={required}
                        className="flex-1 px-3 py-3 text-sm font-medium bg-transparent outline-none"
                      />
                    </div>
                  </div>
                ))}
                <p className="text-[10px] text-muted-foreground/70 italic pl-1">
                  Phone is used to SMS the access code to the head official when their account is set up.
                </p>
              </div>
              )}

              {deptCreationHeadDetailsEnabled === false && (
                <p className="text-[10px] text-muted-foreground/70 italic pl-1 pt-1">
                  Head Official details are currently disabled in System Settings. This department will be created without a head — assign one later via Edit.
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 px-4 py-3 rounded-xl border border-border font-bold text-sm hover:bg-muted transition-all">
                  Cancel
                </button>
                <button type="submit" disabled={
                    isProcessing || nameClash || !newDeptData.name.trim() || !newDeptData.accessCode.trim() ||
                    (deptCreationHeadDetailsEnabled === true && (
                      !newDeptData.headStaffId.trim() || !newDeptData.headSurname.trim() || !newDeptData.headFirstName.trim() ||
                      !newDeptData.headTitle.trim() || !newDeptData.headEmail.trim() || !newDeptData.phone.trim()
                    ))
                  }
                  className="flex-1 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {isProcessing ? <><Loader2 size={14} className="animate-spin" /><span>Creating…</span></> : <span>Create Department</span>}
                </button>
              </div>
            </form>
              );
            })()}
          </div>
        </div>
      )}

      <ConfirmModal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} onConfirm={confirmDelete}
        isProcessing={isProcessing} title="Delete Department"
        message={`Are you sure you want to permanently delete "${pendingDept?.name}"? This action cannot be undone.`} />

    </>
  );
};

export default DepartmentManager;
