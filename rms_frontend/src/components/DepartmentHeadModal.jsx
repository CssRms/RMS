import React, { useState, useEffect } from 'react';
import { Save, X, Eye, EyeOff } from 'lucide-react';

const DepartmentHeadModal = ({ isOpen, department, onSave, onClose }) => {
  const [headName, setHeadName] = useState('');
  const [headTitle, setHeadTitle] = useState('');
  const [headEmail, setHeadEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!department) return;
    const isIsac = department.name?.toLowerCase().includes('isac') || department.code?.toLowerCase() === 'isc';
    setHeadName(department.headName || (isIsac ? 'Dr. Victor Umunnakwe' : ''));
    setHeadTitle(department.headTitle || (isIsac ? 'ISAC Coordinator' : ''));
    setHeadEmail(department.headEmail || '');
    setPassword('');
    setConfirmPassword('');
  }, [department]);

  if (!isOpen) return null;

  const passwordMismatch = password && confirmPassword && password !== confirmPassword;
  const canSave =
    headName.trim() &&
    headTitle.trim() &&
    headEmail.trim() &&
    password.trim().length >= 6 &&
    confirmPassword.trim() === password.trim();

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/90 backdrop-blur-md" />
      <div className="glass bg-white/95 w-full max-w-lg rounded-3xl border border-border/50 shadow-2xl relative overflow-hidden flex flex-col">
        <div className="p-6 border-b border-border/50 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-foreground">Set Department Details</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Department head details and a login password are required to activate your account.
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              title="Cancel and log out"
              className="shrink-0 p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
            >
              <X size={18} />
            </button>
          )}
        </div>
        <div className="p-6 space-y-4 overflow-y-auto max-h-[65vh]">
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest pl-1">Head Name</label>
            <input
              value={headName}
              onChange={(e) => setHeadName(e.target.value)}
              className="w-full bg-muted/20 border border-border/50 rounded-xl p-4 focus:ring-2 focus:ring-primary/20 outline-none"
              placeholder="Full name"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest pl-1">Head Title</label>
            <input
              value={headTitle}
              onChange={(e) => setHeadTitle(e.target.value)}
              className="w-full bg-muted/20 border border-border/50 rounded-xl p-4 focus:ring-2 focus:ring-primary/20 outline-none"
              placeholder="Title / Position"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest pl-1">Email Address</label>
            <input
              type="email"
              value={headEmail}
              onChange={(e) => setHeadEmail(e.target.value)}
              className="w-full bg-muted/20 border border-border/50 rounded-xl p-4 focus:ring-2 focus:ring-primary/20 outline-none"
              placeholder="email@company.com"
            />
          </div>

          <div className="border-t border-border/30 pt-4 space-y-4">
            <p className="text-xs font-bold text-primary uppercase tracking-widest pl-1">Set Your Login Password</p>
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest pl-1">New Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-muted/20 border border-border/50 rounded-xl p-4 pr-12 focus:ring-2 focus:ring-primary/20 outline-none font-mono tracking-widest"
                  placeholder="Minimum 6 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-primary transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest pl-1">Confirm Password</label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`w-full bg-muted/20 border rounded-xl p-4 pr-12 focus:ring-2 outline-none font-mono tracking-widest ${
                    passwordMismatch
                      ? 'border-destructive/60 focus:ring-destructive/20'
                      : 'border-border/50 focus:ring-primary/20'
                  }`}
                  placeholder="Repeat password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-primary transition-colors"
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {passwordMismatch && (
                <p className="text-xs text-destructive pl-1">Passwords do not match</p>
              )}
            </div>
          </div>
        </div>
        <div className="p-6 border-t border-border/50 bg-muted/20 space-y-3">
          {onClose && (
            <p className="text-[10px] text-muted-foreground/60 text-center italic">
              Closing this window will log you out. Complete setup to access the dashboard.
            </p>
          )}
          <button
            onClick={async () => {
              if (!canSave) return;
              setSaving(true);
              await onSave({
                headName: headName.trim(),
                headTitle: headTitle.trim(),
                headEmail: headEmail.trim(),
                password: password.trim(),
              });
              setSaving(false);
            }}
            disabled={saving || !canSave}
            className="w-full bg-primary text-primary-foreground font-bold py-3 rounded-xl shadow-lg shadow-primary/20 flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            <Save size={16} />
            <span>{saving ? 'Saving...' : 'Save & Activate Department'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default DepartmentHeadModal;
