import { useState, useEffect } from 'react';
import {
  Plus, Users, KeyRound, ToggleLeft, ToggleRight, Pencil, X,
  Check, Loader2, Copy, Eye, EyeOff, UserPlus, UserMinus, RefreshCw,
  ShieldAlert, Building2, ChevronDown, ChevronUp
} from 'lucide-react';
import { subAccountAPI } from '../lib/api';
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
      <p className="text-[10px] font-black text-amber-700 uppercase tracking-wider">New Access Code — Copy now, it won't show again</p>
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

// ── Single sub-account card ──────────────────────────────────────────────────
const SubAccountCard = ({ sub, availableUsers, onRefresh }) => {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(sub.name);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [newCode, setNewCode] = useState(null);

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
      toast.success('New access code generated.');
      onRefresh();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to reset code.');
    } finally { setResetting(false); }
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
          <p className="text-[10px] text-muted-foreground mt-0.5">{sub.userCount} user{sub.userCount !== 1 ? 's' : ''} · {sub.reqCount} request{sub.reqCount !== 1 ? 's' : ''}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => setEditing(true)} title="Rename" className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/8 transition-all">
            <Pencil size={13} />
          </button>
          <button onClick={resetCode} disabled={resetting} title="Reset access code" className="p-1.5 rounded-lg text-muted-foreground hover:text-amber-600 hover:bg-amber-50 transition-all disabled:opacity-40">
            {resetting ? <Loader2 size={13} className="animate-spin" /> : <KeyRound size={13} />}
          </button>
          <button onClick={toggle} disabled={toggling} title={sub.isDisabled ? 'Enable' : 'Disable'} className="p-1.5 rounded-lg transition-all disabled:opacity-40 text-muted-foreground hover:text-foreground">
            {toggling ? <Loader2 size={13} className="animate-spin" /> : sub.isDisabled ? <ToggleLeft size={16} /> : <ToggleRight size={16} className="text-green-600" />}
          </button>
          <button onClick={() => setExpanded(v => !v)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-all">
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </div>

      {/* New code reveal */}
      {newCode && (
        <div className="px-4 pb-3">
          <CodeBox code={newCode} onDismiss={() => setNewCode(null)} />
        </div>
      )}

      {/* Expanded user management */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-border/30 pt-3">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider mb-2">Staff Members</p>
          <UserManager sub={sub} availableUsers={availableUsers} onRefresh={onRefresh} />
        </div>
      )}
    </div>
  );
};

// ── Main panel ────────────────────────────────────────────────────────────────
const SubAccountsPanel = () => {
  const [subs, setSubs] = useState([]);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newCode, setNewCode] = useState(null);
  const [newSubName, setNewSubName] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [subsData, usersData] = await Promise.all([
        subAccountAPI.list(),
        subAccountAPI.availableUsers().catch(() => [])
      ]);
      setSubs(Array.isArray(subsData) ? subsData : []);
      setAvailableUsers(Array.isArray(usersData) ? usersData : []);
    } catch (err) {
      toast.error('Failed to load sub-accounts.');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await subAccountAPI.create(newName.trim());
      setNewCode(res.accessCode);
      setNewSubName(res.name);
      setNewName('');
      setShowCreate(false);
      load();
      toast.success(`"${res.name}" created.`);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to create sub-account.');
    } finally { setCreating(false); }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-black text-foreground uppercase tracking-wide">Sub-Accounts / Units</h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Create child units that log in with their own access code and submit requests under your department.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(v => !v)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-[11px] font-black uppercase tracking-wider hover:bg-primary/90 transition-all"
        >
          <Plus size={13} /> New Unit
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 space-y-3">
          <p className="text-[10px] font-black text-primary uppercase tracking-wider">New Sub-Account / Unit</p>
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
            An access code will be auto-generated and shown once. Staff members can then log in using the unit name + this code.
          </p>
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
            />
          ))}
        </div>
      )}

      <div className="p-4 bg-muted/20 rounded-2xl border border-border/20 flex items-start gap-3">
        <ShieldAlert size={14} className="text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-[10px] text-muted-foreground/80 leading-relaxed">
          Sub-accounts log in using their unit name and access code, exactly like a department. They can submit requests, use chat, and view their own records. You see all their activity and requests merged into your dashboard. Sub-accounts cannot create further sub-accounts.
        </p>
      </div>
    </div>
  );
};

export default SubAccountsPanel;
