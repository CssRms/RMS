import { useState, useEffect } from 'react';
import {
  Plus, Users, KeyRound, ToggleLeft, ToggleRight, Pencil, X,
  Check, Loader2, Copy, UserPlus, UserMinus,
  ShieldAlert, Building2, ChevronDown, ChevronUp, ShieldCheck, Award, Trash2,
  FileText, User, Clock, Route, Globe, Lock
} from 'lucide-react';
import { subAccountAPI, deptAPI } from '../lib/api';
import { toast } from 'react-hot-toast';

// ── tiny helpers ──────────────────────────────────────────────────────────────
const Badge = ({ children, color = 'gray' }) => {
  const colors = {
    green:  'bg-green-50 text-green-700 border-green-200',
    red:    'bg-red-50 text-red-600 border-red-200',
    gray:   'bg-gray-50 text-gray-500 border-gray-200',
    blue:   'bg-blue-50 text-blue-700 border-blue-200',
  };
  return (
    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${colors[color]}`}>
      {children}
    </span>
  );
};

// ── Code reveal box ──────────────────────────────────────────────────────────
const CodeBox = ({ code, onDismiss }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="mt-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-2">
      <p className="text-[10px] font-black text-amber-700 uppercase tracking-wider">New Password — Copy now, it won't show again</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 font-mono text-lg font-black text-amber-900 tracking-[0.25em] bg-white border border-amber-200 rounded-xl px-4 py-2 text-center select-all">
          {code}
        </code>
        <button onClick={copy} className="p-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white transition-colors">
          {copied ? <Check size={15} /> : <Copy size={15} />}
        </button>
      </div>
      <button onClick={onDismiss} className="w-full text-[10px] font-semibold text-amber-600 hover:text-amber-800 transition-colors text-center mt-1">
        I've saved the code — dismiss
      </button>
    </div>
  );
};

// ── User manager for one sub-account ────────────────────────────────────────
const UserManager = ({ sub, availableUsers, onRefresh }) => {
  const [assigning, setAssigning] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState('');

  const unassigned = availableUsers.filter(u => u.departmentId !== sub.id);
  const assigned = sub.users || [];

  const assign = async () => {
    if (!selectedUserId) return;
    setAssigning(selectedUserId);
    try {
      await subAccountAPI.assignUser(sub.id, selectedUserId);
      toast.success('User assigned.');
      setSelectedUserId('');
      onRefresh();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to assign user.');
    } finally { setAssigning(null); }
  };

  const remove = async (userId) => {
    setRemoving(userId);
    try {
      await subAccountAPI.removeUser(sub.id, userId);
      toast.success('User removed from sub-account.');
      onRefresh();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to remove user.');
    } finally { setRemoving(null); }
  };

  return (
    <div className="mt-4 space-y-3">
      {assigned.length === 0 ? (
        <p className="text-[11px] text-muted-foreground text-center py-3 italic">No staff assigned yet.</p>
      ) : (
        <div className="space-y-1.5">
          {assigned.map(u => (
            <div key={u.id} className="flex items-center justify-between px-3 py-2 bg-muted/30 rounded-xl border border-border/30">
              <div>
                <p className="text-[12px] font-semibold text-foreground">{u.name}</p>
                <p className="text-[10px] text-muted-foreground">{u.email}</p>
              </div>
              <button
                onClick={() => remove(u.id)}
                disabled={removing === u.id}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-40"
                title="Remove from sub-account"
              >
                {removing === u.id ? <Loader2 size={13} className="animate-spin" /> : <UserMinus size={13} />}
              </button>
            </div>
          ))}
        </div>
      )}

      {unassigned.length > 0 && (
        <div className="flex items-center gap-2">
          <select
            value={selectedUserId}
            onChange={e => setSelectedUserId(e.target.value)}
            className="flex-1 text-xs border border-border/50 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">— Select a staff member —</option>
            {unassigned.map(u => (
              <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
            ))}
          </select>
          <button
            onClick={assign}
            disabled={!selectedUserId || !!assigning}
            className="p-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-40"
          >
            {assigning ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
          </button>
        </div>
      )}
    </div>
  );
};

// ── Toggle switch ─────────────────────────────────────────────────────────────
const Toggle = ({ on, onChange, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    onClick={() => !disabled && onChange(!on)}
    disabled={disabled}
    className={`relative inline-flex items-center shrink-0 rounded-full border-2 border-transparent transition-all duration-200 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed ${
      on
        ? 'bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.15)]'
        : 'bg-gray-200'
    }`}
    style={{ width: 44, height: 24 }}
  >
    <span className={`inline-block rounded-full bg-white shadow-sm transition-transform duration-200 ${on ? 'translate-x-[20px]' : 'translate-x-0'}`}
      style={{ width: 20, height: 20 }} />
  </button>
);

// ── Privilege editor for one sub-account ─────────────────────────────────────
const PrivilegeEditor = ({ sub, onUpdatePrivilege }) => {
  const [cashOn, setCashOn]             = useState(!!sub.cashPrivilege || sub.privilegeAmount != null);
  const [cashInput, setCashInput]       = useState(sub.privilegeAmount != null ? String(sub.privilegeAmount) : '');
  const [editingCash, setEditingCash]   = useState(false);
  const [memoOn, setMemoOn]             = useState(!!sub.memoPrivilege);
  const [materialOn, setMaterialOn]     = useState(!!sub.materialPrivilege);
  const [savingCash, setSavingCash]     = useState(false);
  const [savingToggles, setSavingToggles] = useState(false);

  // Direct route state
  const [directRouteOn, setDirectRouteOn]           = useState(!!sub.directRoute);
  // pendingDirectRoute: toggle is visually ON but NOT yet saved — waiting for ≥1 dept selection
  const [pendingDirectRoute, setPendingDirectRoute] = useState(false);
  const [allowedDeptIds, setAllowedDeptIds]         = useState(Array.isArray(sub.allowedRouteDeptIds) ? sub.allowedRouteDeptIds : []);
  const [allDepts, setAllDepts]                     = useState([]);
  const [loadingDepts, setLoadingDepts]             = useState(false);
  const [savingRoute, setSavingRoute]               = useState(false);
  const [selectedDeptToAdd, setSelectedDeptToAdd]   = useState('');

  // Load departments when Direct Route is toggled on
  useEffect(() => {
    if (!directRouteOn || allDepts.length > 0) return;
    setLoadingDepts(true);
    deptAPI.getDepartments()
      .then(d => setAllDepts((Array.isArray(d) ? d : []).filter(dept => !dept.isSubAccount && dept.name?.toLowerCase() !== 'super admin')))
      .catch(() => {})
      .finally(() => setLoadingDepts(false));
  }, [directRouteOn]);

  const fmt = n => n != null ? `₦${Number(n).toLocaleString()}` : null;

  // ── Shared helper: save a new allowed-dept list (also commits directRoute if pending) ──
  const saveAllowedDepts = async (nextIds, prevIds) => {
    setAllowedDeptIds(nextIds);
    setSelectedDeptToAdd('');
    setSavingRoute(true);
    try {
      const payload = { allowedRouteDeptIds: nextIds.length ? nextIds : null };
      if (pendingDirectRoute) payload.directRoute = true;
      await subAccountAPI.setPrivilege(sub.id, payload);
      if (pendingDirectRoute) {
        setPendingDirectRoute(false);
        onUpdatePrivilege({ directRoute: true, allowedRouteDeptIds: nextIds });
        toast.success('Direct routing enabled.');
      } else {
        onUpdatePrivilege({ allowedRouteDeptIds: nextIds });
        toast.success(nextIds.length > prevIds.length ? 'Department added.' : 'Department removed.');
      }
    } catch (err) {
      setAllowedDeptIds(prevIds); // revert
      if (pendingDirectRoute) setDirectRouteOn(false);
      toast.error(err?.response?.data?.error || 'Failed to update.');
    } finally { setSavingRoute(false); }
  };

  const saveCash = async () => {
    const trimmed = cashInput.trim();
    const amount = trimmed === '' ? null : parseFloat(trimmed.replace(/,/g, ''));
    if (trimmed !== '' && (isNaN(amount) || amount < 0)) {
      toast.error('Enter a valid positive amount, or leave blank to remove.'); return;
    }
    setSavingCash(true);
    try {
      await subAccountAPI.setPrivilege(sub.id, { maxAmount: amount });
      toast.success(amount == null ? 'Cash limit removed.' : `Cash limit set to ₦${amount.toLocaleString()}.`);
      setEditingCash(false);
      onUpdatePrivilege({ privilegeAmount: amount });
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to update.');
    } finally { setSavingCash(false); }
  };

  const saveToggle = async (field, value, extraPayload = {}) => {
    setSavingToggles(true);
    const labels = { cashPrivilege: 'Cash', memoPrivilege: 'Memo', materialPrivilege: 'Material' };
    try {
      await subAccountAPI.setPrivilege(sub.id, { [field]: value, ...extraPayload });
      toast.success(`${labels[field] || field} requests ${value ? 'enabled' : 'disabled'}.`);
      onUpdatePrivilege({ [field]: value, ...extraPayload });
    } catch (err) {
      if (field === 'cashPrivilege') setCashOn(!value);
      if (field === 'memoPrivilege') setMemoOn(!value);
      if (field === 'materialPrivilege') setMaterialOn(!value);
      toast.error(err?.response?.data?.error || 'Failed to update.');
    } finally { setSavingToggles(false); }
  };

  const handleCashToggle = (v) => {
    setCashOn(v);
    if (!v) {
      setCashInput('');
      setEditingCash(false);
      setSavingToggles(true);
      subAccountAPI.setPrivilege(sub.id, { cashPrivilege: false, maxAmount: null })
        .then(() => { toast.success('Cash requests disabled.'); onUpdatePrivilege({ cashPrivilege: false, privilegeAmount: null }); })
        .catch(err => { setCashOn(true); toast.error(err?.response?.data?.error || 'Failed to disable cash requests.'); })
        .finally(() => setSavingToggles(false));
    } else {
      saveToggle('cashPrivilege', true);
    }
  };
  const handleMemoToggle = (v) => { setMemoOn(v); saveToggle('memoPrivilege', v); };
  const handleMaterialToggle = (v) => { setMaterialOn(v); saveToggle('materialPrivilege', v); };

  const handleDirectRouteToggle = async (v) => {
    if (v) {
      // Turning ON — only save immediately if dept list already has entries
      setDirectRouteOn(true);
      if (allowedDeptIds.length === 0) {
        // Enter pending state: show picker, don't save until ≥1 dept is chosen
        setPendingDirectRoute(true);
      } else {
        setSavingRoute(true);
        try {
          await subAccountAPI.setPrivilege(sub.id, { directRoute: true });
          toast.success('Direct routing enabled.');
          onUpdatePrivilege({ directRoute: true });
        } catch (err) {
          setDirectRouteOn(false);
          toast.error(err?.response?.data?.error || 'Failed to update routing setting.');
        } finally { setSavingRoute(false); }
      }
    } else {
      // Turning OFF
      if (pendingDirectRoute) {
        // Never saved — just revert local state, no API call
        setDirectRouteOn(false);
        setPendingDirectRoute(false);
      } else {
        setDirectRouteOn(false);
        setSavingRoute(true);
        try {
          await subAccountAPI.setPrivilege(sub.id, { directRoute: false });
          toast.success('Direct routing disabled — requests go through you first.');
          onUpdatePrivilege({ directRoute: false });
        } catch (err) {
          setDirectRouteOn(true);
          toast.error(err?.response?.data?.error || 'Failed to update routing setting.');
        } finally { setSavingRoute(false); }
      }
    }
  };

  // Called when user picks from the dropdown
  const handleDeptDropdownChange = (val) => {
    if (val === '__all__') {
      // "All Departments" — add every available dept at once
      const allIds = allDepts.map(d => d.id);
      const next = [...new Set([...allowedDeptIds, ...allIds])];
      if (next.length === allowedDeptIds.length) return; // nothing new
      saveAllowedDepts(next, allowedDeptIds);
    } else {
      setSelectedDeptToAdd(val);
    }
  };

  const addAllowedDept = () => {
    const id = parseInt(selectedDeptToAdd);
    if (!id || allowedDeptIds.includes(id)) return;
    saveAllowedDepts([...allowedDeptIds, id], allowedDeptIds);
  };

  const removeAllowedDept = (id) => {
    const next = allowedDeptIds.filter(d => d !== id);
    // Block removing last dept when direct route is already saved ON
    if (next.length === 0 && directRouteOn && !pendingDirectRoute) {
      toast.error('At least one department must remain. Disable direct routing first if you want to remove all.');
      return;
    }
    saveAllowedDepts(next, allowedDeptIds);
  };

  const availableDepts = allDepts.filter(d => !allowedDeptIds.includes(d.id));
  const allSelected    = allDepts.length > 0 && availableDepts.length === 0;

  return (
    <div className="mt-3 border-t border-border/20 pt-3 space-y-0">
      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5 mb-2">
        <Award size={10} className="text-amber-500" /> Privilege Settings
      </p>

      {/* Cash Requests toggle + optional limit */}
      <div className="py-2 border-t border-border/10">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-foreground">Cash Requests</p>
            <p className="text-[9px] text-muted-foreground/60">Can create &amp; handle cash requests</p>
          </div>
          <Toggle on={cashOn} onChange={handleCashToggle} disabled={savingToggles} />
        </div>
        {cashOn && (
          <div className="mt-2 pl-1 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground/70 italic">Amount limit <span className="text-muted-foreground/40">(optional)</span></span>
              {!editingCash && (
                <button onClick={() => setEditingCash(true)} className="text-[10px] font-bold text-primary hover:underline">
                  {sub.privilegeAmount != null ? 'Edit limit' : 'Set limit'}
                </button>
              )}
            </div>
            {!editingCash ? (
              <p className="text-[11px] text-muted-foreground/70">
                {sub.privilegeAmount != null
                  ? <><span className="font-black text-amber-700">≤ {fmt(sub.privilegeAmount)}</span> <span className="italic">— max per request</span></>
                  : <span className="italic text-muted-foreground/50">No limit — unlimited cash requests</span>}
              </p>
            ) : (
              <div className="flex gap-2 items-center">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 text-sm font-bold">₦</span>
                  <input type="number" min="0" step="any" value={cashInput}
                    onChange={e => setCashInput(e.target.value)} autoFocus placeholder="e.g. 50000"
                    onKeyDown={e => { if (e.key === 'Enter') saveCash(); if (e.key === 'Escape') setEditingCash(false); }}
                    className="w-full border border-border/50 rounded-xl pl-8 pr-3 py-1.5 text-sm bg-white outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <button onClick={saveCash} disabled={savingCash} className="p-2 rounded-xl bg-primary text-white hover:bg-primary/90 disabled:opacity-40">
                  {savingCash ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                </button>
                {sub.privilegeAmount != null && (
                  <button onClick={() => { setCashInput(''); saveCash(); }} disabled={savingCash}
                    title="Remove limit" className="p-2 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-40">
                    <Trash2 size={13} />
                  </button>
                )}
                <button onClick={() => setEditingCash(false)} className="p-2 rounded-xl border border-border/40 text-muted-foreground">
                  <X size={13} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Memo toggle */}
      <div className="flex items-center justify-between py-2 border-t border-border/10">
        <div>
          <p className="text-[11px] font-semibold text-foreground">Memo Requests</p>
          <p className="text-[9px] text-muted-foreground/60">Can create &amp; handle memo requests</p>
        </div>
        <Toggle on={memoOn} onChange={handleMemoToggle} disabled={savingToggles} />
      </div>

      {/* Material toggle */}
      <div className="flex items-center justify-between py-2 border-t border-border/10">
        <div>
          <p className="text-[11px] font-semibold text-foreground">Material Requests</p>
          <p className="text-[9px] text-muted-foreground/60">Can create &amp; handle material requests</p>
        </div>
        <Toggle on={materialOn} onChange={handleMaterialToggle} disabled={savingToggles} />
      </div>

      {/* Direct Route toggle + allowed departments */}
      <div className="py-2 border-t border-border/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`p-1 rounded-lg ${directRouteOn ? (pendingDirectRoute ? 'bg-amber-50' : 'bg-blue-50') : 'bg-muted/40'}`}>
              {directRouteOn
                ? (pendingDirectRoute ? <Lock size={11} className="text-amber-500" /> : <Globe size={11} className="text-blue-600" />)
                : <Lock size={11} className="text-muted-foreground/60" />}
            </div>
            <div>
              <p className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
                Direct Routing
                {pendingDirectRoute && (
                  <span className="text-[8px] font-black uppercase tracking-wide text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                    Not saved
                  </span>
                )}
              </p>
              <p className="text-[9px] text-muted-foreground/60">
                {directRouteOn ? 'Can send requests directly to departments' : 'All requests route through you first'}
              </p>
            </div>
          </div>
          <Toggle on={directRouteOn} onChange={handleDirectRouteToggle} disabled={savingRoute} />
        </div>

        {/* Pending warning — shown when toggle is ON but no depts selected yet */}
        {pendingDirectRoute ? (
          <div className="mt-2 px-2.5 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-[9px] leading-relaxed">
            <span className="font-black">Action required —</span> Select at least one department below (or choose "All Departments") to save direct routing.
          </div>
        ) : (
          <div className={`mt-2 px-2.5 py-2 rounded-xl text-[9px] leading-relaxed ${directRouteOn ? 'bg-blue-50/60 border border-blue-100 text-blue-700' : 'bg-amber-50/60 border border-amber-100 text-amber-700'}`}>
            {directRouteOn
              ? <><span className="font-black">ON —</span> This unit can choose which department to send requests to directly.</>
              : <><span className="font-black">OFF —</span> Every request this unit creates will be automatically routed to you (the head) first.</>
            }
          </div>
        )}

        {/* Allowed departments — only when direct route is ON */}
        {directRouteOn && (
          <div className="mt-3 pl-1 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-foreground/70 flex items-center gap-1">
                <Route size={9} className="text-blue-500" /> Allowed Departments
                {pendingDirectRoute && <span className="text-red-500 ml-0.5">*</span>}
              </span>
              <span className={`text-[9px] italic font-semibold ${pendingDirectRoute && allowedDeptIds.length === 0 ? 'text-red-400' : 'text-muted-foreground/50'}`}>
                {allSelected
                  ? 'All departments'
                  : allowedDeptIds.length === 0
                    ? (pendingDirectRoute ? 'Required — pick at least one' : 'None')
                    : `${allowedDeptIds.length} selected`}
              </span>
            </div>

            {/* Selected dept chips */}
            {allowedDeptIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {allowedDeptIds.map(id => {
                  const dept = allDepts.find(d => d.id === id);
                  return (
                    <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 border border-blue-200 text-blue-700 text-[9px] font-bold">
                      {dept?.name || `Dept #${id}`}
                      <button onClick={() => removeAllowedDept(id)} disabled={savingRoute}
                        className="hover:text-red-500 disabled:opacity-40 transition-colors ml-0.5">
                        <X size={9} />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            {/* Add department dropdown */}
            {loadingDepts ? (
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60 py-1">
                <Loader2 size={11} className="animate-spin" /> Loading departments…
              </div>
            ) : !allSelected ? (
              <div className="flex gap-2 items-center">
                <select
                  value={selectedDeptToAdd}
                  onChange={e => handleDeptDropdownChange(e.target.value)}
                  className={`flex-1 text-xs border rounded-xl px-3 py-1.5 bg-white outline-none focus:ring-2 transition-colors
                    ${pendingDirectRoute && allowedDeptIds.length === 0
                      ? 'border-amber-300 focus:ring-amber-200'
                      : 'border-border/50 focus:ring-primary/20'}`}
                >
                  <option value="">— Add a department —</option>
                  <option value="__all__">✓ All Departments</option>
                  {availableDepts.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                <button
                  onClick={addAllowedDept}
                  disabled={!selectedDeptToAdd || selectedDeptToAdd === '__all__' || savingRoute}
                  className="p-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 transition-all"
                  title="Add to allowed list"
                >
                  {savingRoute ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                </button>
              </div>
            ) : (
              <p className="text-[9px] text-blue-600 font-bold italic flex items-center gap-1">
                <Check size={10} /> All departments selected — unit can route to anyone.
              </p>
            )}

            <p className="text-[9px] text-muted-foreground/40 italic">
              Choose "All Departments" to allow any department, or add specific ones to restrict where this unit can send requests.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Single sub-account card ──────────────────────────────────────────────────
const SubAccountCard = ({ sub, availableUsers, onRefresh, onUpdatePrivilege, showParent = false, isAdmin = false }) => {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(sub.name);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [newCode, setNewCode] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reqs, setReqs] = useState(null);
  const [loadingReqs, setLoadingReqs] = useState(false);

  const saveEdit = async () => {
    if (!editName.trim() || editName.trim() === sub.name) { setEditing(false); return; }
    setSaving(true);
    try {
      await subAccountAPI.update(sub.id, { name: editName.trim() });
      toast.success('Sub-account updated.');
      onRefresh();
      setEditing(false);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to update.');
    } finally { setSaving(false); }
  };

  const toggle = async () => {
    setToggling(true);
    try {
      await subAccountAPI.toggle(sub.id);
      toast.success(sub.isDisabled ? 'Sub-account enabled.' : 'Sub-account disabled.');
      onRefresh();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to toggle.');
    } finally { setToggling(false); }
  };

  const resetCode = async () => {
    setResetting(true);
    try {
      const res = await subAccountAPI.resetCode(sub.id);
      setNewCode(res.accessCode);
      toast.success('New password generated.');
      // Do NOT call onRefresh() here — it triggers setLoading(true) which unmounts this card
      // and destroys the newCode state before the user can copy it. Refresh happens on dismiss.
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to reset code.');
    } finally { setResetting(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await subAccountAPI.delete(sub.id);
      toast.success(`"${sub.name}" deleted. All its records are preserved.`);
      onRefresh();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to delete sub-account.');
    } finally { setDeleting(false); setConfirmDelete(false); }
  };

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${sub.isDisabled ? 'border-red-200 opacity-75' : 'border-border/50'}`}>
      {/* Card header */}
      <div className="px-4 py-3 flex items-center gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${sub.isDisabled ? 'bg-red-50 border border-red-200' : 'bg-primary/8 border border-primary/20'}`}>
          <Building2 size={16} className={sub.isDisabled ? 'text-red-400' : 'text-primary'} />
        </div>

        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="flex items-center gap-1.5">
              <input
                autoFocus
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(false); }}
                className="flex-1 text-sm font-bold border border-primary/40 rounded-lg px-2 py-0.5 outline-none focus:ring-1 focus:ring-primary/30"
              />
              <button onClick={saveEdit} disabled={saving} className="text-primary hover:text-primary/80 disabled:opacity-40">
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              </button>
              <button onClick={() => setEditing(false)} className="text-muted-foreground hover:text-foreground">
                <X size={13} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-bold text-foreground truncate">{sub.name}</p>
              <Badge color={sub.isDisabled ? 'red' : 'green'}>{sub.isDisabled ? 'Disabled' : 'Active'}</Badge>
            </div>
          )}
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {showParent && sub.parentDept?.name && (
              <span className="text-[10px] text-violet-600 font-semibold">{sub.parentDept.name} ·</span>
            )}
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <User size={10} />
              {sub.headName
                ? <span className="font-semibold text-foreground/70">{sub.headName}</span>
                : <span className="italic text-muted-foreground/60">Not set yet</span>}
            </span>
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <FileText size={10} />
              <span className={sub.reqCount > 0 ? 'font-bold text-primary' : ''}>
                {sub.reqCount} request{sub.reqCount !== 1 ? 's' : ''}
              </span>
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => setEditing(true)} title="Rename" className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/8 transition-all">
            <Pencil size={13} />
          </button>
          <button onClick={resetCode} disabled={resetting} title="Reset password" className="p-1.5 rounded-lg text-muted-foreground hover:text-amber-600 hover:bg-amber-50 transition-all disabled:opacity-40">
            {resetting ? <Loader2 size={13} className="animate-spin" /> : <KeyRound size={13} />}
          </button>
          <button onClick={toggle} disabled={toggling} title={sub.isDisabled ? 'Enable' : 'Disable'} className="p-1.5 rounded-lg transition-all disabled:opacity-40 text-muted-foreground hover:text-foreground">
            {toggling ? <Loader2 size={13} className="animate-spin" /> : sub.isDisabled ? <ToggleLeft size={16} /> : <ToggleRight size={16} className="text-green-600" />}
          </button>
          <button onClick={() => setConfirmDelete(true)} title="Delete sub-account" className="p-1.5 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-all">
            <Trash2 size={13} />
          </button>
          <button onClick={async () => {
            const next = !expanded;
            setExpanded(next);
            if (next && reqs === null) {
              setLoadingReqs(true);
              try { setReqs(await subAccountAPI.getRequisitions(sub.id)); }
              catch { setReqs([]); }
              finally { setLoadingReqs(false); }
            }
          }} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-all">
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </div>

      {/* Admin — permanent password always visible */}
      {isAdmin && !newCode && sub.accessCodeLabel && (
        <div className="px-4 pb-3 pt-1 flex items-center justify-between gap-3 bg-amber-50/60 border-t border-amber-100">
          <span className="text-[9px] font-black text-amber-700 uppercase tracking-widest shrink-0">Password</span>
          <code className="font-mono text-sm font-black text-amber-900 tracking-[0.25em] flex-1 text-center select-all">{sub.accessCodeLabel}</code>
          <button
            onClick={() => { navigator.clipboard.writeText(sub.accessCodeLabel); toast.success('Code copied!'); }}
            className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-100 transition-all"
            title="Copy code"
          >
            <Copy size={12} />
          </button>
        </div>
      )}

      {/* New code reveal — one-time for dept heads; also shown for admin after reset */}
      {newCode && (
        <div className="px-4 pb-3">
          <CodeBox code={newCode} onDismiss={() => { setNewCode(null); onRefresh(); }} />
        </div>
      )}

      {/* Expanded: requisitions + privileges */}
      {expanded && (
        <div className="border-t border-border/30">

          {/* ── Requisitions list ── */}
          <div className="px-4 pt-3 pb-3">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <FileText size={11} /> Requests Created
            </p>
            {loadingReqs ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 size={16} className="animate-spin text-muted-foreground" />
              </div>
            ) : !reqs || reqs.length === 0 ? (
              <p className="text-[11px] text-muted-foreground/60 italic py-2 text-center">No requests created yet.</p>
            ) : (
              <div className="space-y-1.5">
                {reqs.map(r => {
                  const statusColor = {
                    draft: 'bg-gray-100 text-gray-500',
                    pending: 'bg-blue-50 text-blue-600',
                    approved: 'bg-green-50 text-green-700',
                    rejected: 'bg-red-50 text-red-600',
                    treated: 'bg-emerald-50 text-emerald-700',
                    published: 'bg-violet-50 text-violet-700',
                  }[r.status?.toLowerCase()] || 'bg-gray-100 text-gray-500';
                  const typeColor = {
                    Cash: 'bg-amber-50 text-amber-700 border-amber-200',
                    Material: 'bg-indigo-50 text-indigo-700 border-indigo-200',
                    Memo: 'bg-purple-50 text-purple-700 border-purple-200',
                  }[r.type] || 'bg-gray-50 text-gray-600 border-gray-200';
                  return (
                    <div key={r.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/30 border border-border/30 hover:bg-muted/50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold text-foreground truncate">
                          #{r.id} — {r.title || 'Untitled'}
                        </p>
                        {r.targetDepartment?.name && (
                          <p className="text-[9px] text-muted-foreground/60">To: {r.targetDepartment.name}</p>
                        )}
                      </div>
                      <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${typeColor} shrink-0`}>
                        {r.type}
                      </span>
                      <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full ${statusColor} shrink-0`}>
                        {r.status}
                      </span>
                      <span className="text-[9px] text-muted-foreground/50 shrink-0 flex items-center gap-0.5">
                        <Clock size={9} />
                        {new Date(r.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Privilege editor ── */}
          <div className="px-4 pb-4 border-t border-border/20 pt-3">
            <PrivilegeEditor sub={sub} onUpdatePrivilege={onUpdatePrivilege} />
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {confirmDelete && (
        <div className="px-4 pb-4 pt-3 border-t-2 border-red-200 bg-red-50/60 space-y-3">
          <div className="flex items-start gap-2">
            <Trash2 size={15} className="text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-black text-red-800">Delete "{sub.name}"?</p>
              <p className="text-[11px] text-red-700/80 mt-0.5 leading-relaxed">
                This sub-account will be permanently removed from the system. It will no longer appear in any list and cannot log in.
              </p>
              <p className="text-[11px] text-green-700 font-semibold mt-1.5 leading-relaxed">
                ✓ All {sub.reqCount} request{sub.reqCount !== 1 ? 's' : ''}, signatures, and history are fully preserved — nothing is lost.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleDelete} disabled={deleting}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black transition-all disabled:opacity-50">
              {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
              {deleting ? 'Deleting…' : 'Yes, Delete'}
            </button>
            <button onClick={() => setConfirmDelete(false)} disabled={deleting}
              className="flex-1 py-2 rounded-xl border border-border/60 text-xs font-bold text-muted-foreground hover:bg-muted/40 transition-all">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Main panel ────────────────────────────────────────────────────────────────
const SubAccountsPanel = ({ isAdmin = false }) => {
  const [subs, setSubs] = useState([]);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newCode, setNewCode] = useState(null);
  const [newSubName, setNewSubName] = useState('');

  // Name-clash conflict resolution
  const [conflict, setConflict] = useState(null); // { deletedSub: {...}, suggestedName: '' }
  const [altName, setAltName] = useState('');      // editable version of suggestedName
  const [resolving, setResolving] = useState(false);

  // Admin dept selector
  const [departments, setDepartments] = useState([]);
  const [selectedDeptId, setSelectedDeptId] = useState('');

  // The parentId to use for all API calls
  const parentId = isAdmin ? (selectedDeptId ? parseInt(selectedDeptId) : null) : null;

  useEffect(() => {
    if (!isAdmin) return;
    deptAPI.getDepartments().then(d => {
      const nonSub = (Array.isArray(d) ? d : []).filter(dept => !dept.isSubAccount && dept.name?.toLowerCase() !== 'super admin');
      setDepartments(nonSub);
    }).catch(() => {});
  }, [isAdmin]);

  const load = async () => {
    setLoading(true);
    try {
      const [subsData, usersData] = await Promise.all([
        subAccountAPI.list(parentId || undefined),
        subAccountAPI.availableUsers(parentId || undefined).catch(() => [])
      ]);
      setSubs(Array.isArray(subsData) ? subsData : []);
      setAvailableUsers(Array.isArray(usersData) ? usersData : []);
    } catch (err) {
      toast.error('Failed to load sub-accounts.');
    } finally { setLoading(false); }
  };

  useEffect(() => {
    // For dept heads load immediately; for admin load when dept selected (or show all)
    if (!isAdmin || selectedDeptId !== undefined) load();
  }, [selectedDeptId, isAdmin]);

  const create = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    setConflict(null);
    try {
      const res = await subAccountAPI.create(newName.trim(), parentId || undefined);
      setNewCode(res.accessCode);
      setNewSubName(res.name);
      setNewName('');
      setShowCreate(false);
      load();
      toast.success(`"${res.name}" created.`);
    } catch (err) {
      const data = err?.response?.data;
      if (err?.response?.status === 409 && data?.conflict === 'deleted') {
        // Deleted sub-account with same name exists — show resolution panel
        setConflict(data);
        setAltName(data.suggestedName || '');
      } else {
        toast.error(data?.error || 'Failed to create sub-account.');
      }
    } finally { setCreating(false); }
  };

  const resolveReactivate = async () => {
    if (!conflict?.deletedSub?.id) return;
    setResolving(true);
    try {
      const res = await subAccountAPI.reactivate(conflict.deletedSub.id);
      setNewCode(res.accessCode);
      setNewSubName(res.name);
      setConflict(null);
      setNewName('');
      setShowCreate(false);
      load();
      toast.success(`"${res.name}" reactivated — all previous records restored.`);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to reactivate.');
    } finally { setResolving(false); }
  };

  const resolveCreateNew = async () => {
    const name = altName.trim();
    if (!name) return;
    setResolving(true);
    try {
      const res = await subAccountAPI.create(name, parentId || undefined);
      setNewCode(res.accessCode);
      setNewSubName(res.name);
      setConflict(null);
      setNewName('');
      setShowCreate(false);
      load();
      toast.success(`"${res.name}" created as a new sub-account.`);
    } catch (err) {
      const data = err?.response?.data;
      if (err?.response?.status === 409 && data?.conflict === 'deleted') {
        setConflict(data);
        setAltName(data.suggestedName || '');
        toast.error('That name also conflicts — try a different name.');
      } else {
        toast.error(data?.error || 'Failed to create sub-account.');
      }
    } finally { setResolving(false); }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-black text-foreground uppercase tracking-wide">Sub-Accounts / Units</h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {isAdmin
              ? 'View and manage sub-accounts across all departments.'
              : 'Create child units that log in with their own password and submit requests under your department.'}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(v => !v)}
          disabled={isAdmin && !selectedDeptId}
          title={isAdmin && !selectedDeptId ? 'Select a department first' : undefined}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-[11px] font-black uppercase tracking-wider hover:bg-primary/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus size={13} /> New Unit
        </button>
      </div>

      {/* Admin dept selector */}
      {isAdmin && (
        <div className="flex items-center gap-2">
          <select
            value={selectedDeptId}
            onChange={e => setSelectedDeptId(e.target.value)}
            className="flex-1 text-xs border border-border/50 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">— All Departments —</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 space-y-3">
          <p className="text-[10px] font-black text-primary uppercase tracking-wider">
            New Sub-Account / Unit{isAdmin && selectedDeptId ? ` — ${departments.find(d => String(d.id) === selectedDeptId)?.name || ''}` : ''}
          </p>
          <div className="flex gap-2">
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') create(); if (e.key === 'Escape') setShowCreate(false); }}
              placeholder="e.g. Finance - Procurement"
              className="flex-1 border border-border/50 rounded-xl px-3 py-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-primary/20"
            />
            <button
              onClick={create}
              disabled={creating || !newName.trim()}
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5"
            >
              {creating ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Create
            </button>
            <button onClick={() => setShowCreate(false)} className="p-2.5 rounded-xl border border-border/40 text-muted-foreground hover:text-foreground transition-all">
              <X size={14} />
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground italic">
            A password will be auto-generated and shown once. Staff members can then log in using the unit name + this password.
          </p>
        </div>
      )}

      {/* ── Name conflict resolution panel ─────────────────────────────────── */}
      {conflict && (
        <div className="border border-amber-200 bg-amber-50/60 rounded-2xl p-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Header */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center flex-shrink-0 mt-0.5">
              <ShieldAlert size={15} className="text-amber-600" />
            </div>
            <div>
              <p className="text-[11px] font-black text-amber-800 uppercase tracking-wide">Name Conflict Detected</p>
              <p className="text-[11px] text-amber-700 mt-0.5 leading-relaxed">
                A deleted sub-account named <span className="font-black">"{conflict.deletedSub.name}"</span> already exists under this department.
                Choose what you'd like to do:
              </p>
            </div>
            <button onClick={() => setConflict(null)} className="ml-auto p-1 rounded-lg text-amber-500 hover:text-amber-700 flex-shrink-0">
              <X size={13} />
            </button>
          </div>

          {/* Option A — Reactivate */}
          <div className="bg-white border border-emerald-200 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center text-[10px] font-black text-emerald-700">A</div>
              <p className="text-[11px] font-black text-emerald-800">Reactivate "{conflict.deletedSub.name}"</p>
            </div>
            <p className="text-[10px] text-muted-foreground/70 leading-relaxed pl-7">
              Restore the deleted sub-account exactly as it was — all its previous requests, history, and records come back. A new login password will be generated.
            </p>
            <div className="pl-7">
              <button
                onClick={resolveReactivate}
                disabled={resolving}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700 disabled:opacity-50 transition-all"
              >
                {resolving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                Reactivate Sub-Account
              </button>
            </div>
          </div>

          {/* Option B — Create with new name */}
          <div className="bg-white border border-blue-200 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center text-[10px] font-black text-blue-700">B</div>
              <p className="text-[11px] font-black text-blue-800">Create a brand new sub-account</p>
            </div>
            <p className="text-[10px] text-muted-foreground/70 leading-relaxed pl-7">
              Start fresh with a different name. The deleted sub-account stays as-is. Edit the suggested name below or type your own.
            </p>
            <div className="pl-7 flex gap-2 items-center">
              <input
                value={altName}
                onChange={e => setAltName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') resolveCreateNew(); }}
                placeholder="Enter a different name…"
                className="flex-1 border border-border/50 rounded-xl px-3 py-1.5 text-xs bg-white outline-none focus:ring-2 focus:ring-blue-200 min-w-0"
              />
              <button
                onClick={resolveCreateNew}
                disabled={resolving || !altName.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 text-white text-[11px] font-bold hover:bg-blue-700 disabled:opacity-50 transition-all flex-shrink-0"
              >
                {resolving ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                Create New
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New code reveal after creation */}
      {newCode && (
        <div>
          <p className="text-[10px] font-bold text-muted-foreground mb-1">Access code for <span className="text-foreground">{newSubName}</span></p>
          <CodeBox code={newCode} onDismiss={() => { setNewCode(null); setNewSubName(''); }} />
        </div>
      )}

      {/* Sub-account list */}
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 size={20} className="animate-spin text-muted-foreground/40" />
        </div>
      ) : subs.length === 0 ? (
        <div className="py-10 text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-muted/40 border border-border/30 flex items-center justify-center mx-auto">
            <Users size={20} className="text-muted-foreground/40" />
          </div>
          <p className="text-sm text-muted-foreground font-medium">No sub-accounts yet</p>
          <p className="text-[11px] text-muted-foreground/60">Create your first unit above to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {subs.map(sub => (
            <SubAccountCard
              key={sub.id}
              sub={sub}
              availableUsers={availableUsers}
              onRefresh={load}
              onUpdatePrivilege={updates => setSubs(prev => prev.map(s => s.id === sub.id ? { ...s, ...updates } : s))}
              showParent={isAdmin && !selectedDeptId}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      )}

      <div className="p-4 bg-muted/20 rounded-2xl border border-border/20 flex items-start gap-3">
        <ShieldAlert size={14} className="text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-[10px] text-muted-foreground/80 leading-relaxed">
          Sub-accounts log in using their unit name and password, exactly like a department. They can submit requests, use chat, and view their own records. You see all their activity and requests merged into your dashboard. Sub-accounts cannot create further sub-accounts.
        </p>
      </div>
    </div>
  );
};

export default SubAccountsPanel;
