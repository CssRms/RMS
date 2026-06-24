import React, { useState } from 'react';
import { Download, ChevronDown, X, Loader2, CloudOff, Cloud, AlertCircle } from 'lucide-react';

// ── Export Menu ──
export const ExportMenu = ({ onExport, formats }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative z-50">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-center gap-1.5 w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-[11px] lg:text-sm px-2 lg:px-5 py-3 rounded-xl transition-all shadow-lg shadow-primary/20"
      >
        <Download size={16} className="shrink-0" />
        <span className="truncate">Export</span>
        <ChevronDown size={14} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 glass bg-white/90 border border-border/50 rounded-2xl p-2 z-50 shadow-xl">
          {formats.map(f => (
            <button
              key={f.type}
              onClick={() => { onExport(f.type); setOpen(false); }}
              className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm text-foreground hover:bg-muted hover:text-primary transition-all"
            >
              <f.icon size={16} className="text-primary" />
              <span>{f.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Export Confirm/Preview Modal ──
export const ExportConfirmModal = ({ open, title, exporting, onConfirm, onClose, children }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-border/50 flex items-center justify-between shrink-0">
          <h3 className="font-black text-lg text-foreground">{title}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 bg-muted/20 custom-scrollbar">{children}</div>
        <div className="px-6 py-4 border-t border-border/50 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl border border-border/60 font-bold text-sm hover:bg-muted">Cancel</button>
          <button
            onClick={onConfirm}
            disabled={exporting}
            className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm flex items-center gap-2 disabled:opacity-60"
          >
            {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            <span>{exporting ? 'Preparing File...' : 'Confirm & Download'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Toolbar Ribbon Group (mirrors Word's labeled Home-tab sections: Clipboard, Font, Paragraph...) ──
export const ToolbarGroup = ({ label, children }) => (
  <div className="flex flex-col items-center justify-between gap-1 px-1 shrink-0">
    <div className="flex-1 flex items-center">{children}</div>
    <span className="text-[7px] font-black uppercase tracking-wider text-muted-foreground/50 whitespace-nowrap">{label}</span>
  </div>
);

// ── Save Indicator ──
export const SaveIndicator = ({ saving, lastSaved, error }) => (
  <div className={`flex items-center space-x-2 text-[10px] font-mono font-bold px-3 py-1.5 rounded-full ${error ? 'bg-destructive/10 text-destructive' : 'bg-muted/30 text-muted-foreground'}`}>
    {error ? (
      <>
        <AlertCircle size={12} />
        <span>{error}</span>
      </>
    ) : saving ? (
      <>
        <CloudOff size={12} className="animate-pulse" />
        <span>Saving Draft Locally...</span>
      </>
    ) : (
      <>
        <Cloud size={12} className="text-emerald-500" />
        <span>Saved Securely Locally</span>
      </>
    )}
  </div>
);

// Resolves a department's short code used in document reference numbers (e.g. CSSG/ICT/MO/...).
// Shared by the main DocumentStudio orchestrator (new-draft template prefill) and
// RichTextEditor (in-editor template picker) — must stay in sync between the two.
export const resolveDeptCode = (deptInfo, fallbackLabel) => {
  if (deptInfo?.code) return deptInfo.code;
  const name = (deptInfo?.name || fallbackLabel || '').toLowerCase();
  if (name.includes('isac')) return 'ISC';
  return (deptInfo?.name || fallbackLabel || 'CSS').slice(0, 3);
};
