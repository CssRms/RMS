import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, ArrowRight, CheckCircle2, Building2, Eye, EyeOff, Smartphone, HelpCircle, X, PhoneCall, ChevronDown, GitBranch } from 'lucide-react';
import { getDepartments } from '../lib/store';
import { toast } from 'react-hot-toast';

// ── Animated background SVG elements ────────────────────────────────────────
const ButterflyIcon = ({ color, size = 30 }) => (
  <svg width={size} height={Math.round(size * 0.72)} viewBox="0 0 44 32" fill={color}>
    <ellipse cx="13" cy="11" rx="12" ry="7.5" transform="rotate(-18 13 11)" />
    <ellipse cx="13" cy="22" rx="9" ry="5.5" transform="rotate(18 13 22)" />
    <ellipse cx="31" cy="11" rx="12" ry="7.5" transform="rotate(18 31 11)" />
    <ellipse cx="31" cy="22" rx="9" ry="5.5" transform="rotate(-18 31 22)" />
    <ellipse cx="22" cy="16" rx="1.5" ry="8" />
  </svg>
);

const LeafIcon = ({ color, size = 26 }) => (
  <svg width={Math.round(size * 0.75)} height={size} viewBox="0 0 30 40" fill={color}>
    <path d="M15 38C7 28 4 20 4 14C4 5 15 1 15 1C15 1 26 5 26 14C26 20 23 28 15 38Z" />
    <path d="M15 37 Q15 20 15 5" fill="none" stroke="rgba(0,0,0,0.18)" strokeWidth="1.2" />
  </svg>
);

const TractorIcon = ({ color, size = 36 }) => (
  <svg width={Math.round(size * 1.65)} height={size} viewBox="0 0 60 37" fill={color}>
    <rect x="18" y="10" width="28" height="17" rx="2.5" />
    <rect x="33" y="4" width="14" height="12" rx="2" opacity="0.9" />
    <circle cx="22" cy="28" r="9" fill="none" stroke={color} strokeWidth="2.5" />
    <circle cx="22" cy="28" r="4.5" opacity="0.55" />
    <circle cx="43" cy="30" r="6" fill="none" stroke={color} strokeWidth="2" />
    <circle cx="43" cy="30" r="2.5" opacity="0.55" />
    <rect x="35" y="0" width="3" height="7" rx="1.5" opacity="0.75" />
    <path d="M18 27 L46 27" stroke={color} strokeWidth="1.5" opacity="0.25" fill="none" />
  </svg>
);

const RMS_ANIM_CSS = `
  @keyframes rmsFloat {
    0%,100% { transform: translateY(0)     rotate(0deg);  }
    33%      { transform: translateY(-14px) rotate(5deg);  }
    66%      { transform: translateY(-6px)  rotate(-3deg); }
  }
  @keyframes rmsWander {
    0%   { transform: translate(0,0)       rotate(0deg)   scaleX(1);  }
    20%  { transform: translate(14px,-18px) rotate(14deg)  scaleX(-1); }
    40%  { transform: translate(-7px,-32px) rotate(-7deg)  scaleX(1);  }
    60%  { transform: translate(18px,-22px) rotate(17deg)  scaleX(-1); }
    80%  { transform: translate(-9px,-10px) rotate(-9deg)  scaleX(1);  }
    100% { transform: translate(0,0)       rotate(0deg)   scaleX(1);  }
  }
  @keyframes rmsSway {
    0%,100% { transform: rotate(-11deg) translateY(0);     }
    50%      { transform: rotate(11deg)  translateY(-10px); }
  }
  @keyframes rmsBobble {
    0%,100% { transform: translateX(0)    translateY(0);   }
    30%      { transform: translateX(7px)  translateY(-9px); }
    70%      { transform: translateX(-5px) translateY(-4px); }
  }
`;

const BG_ELS = [
  { C: ButterflyIcon, color:'#fbbf24', size:34, style:{ top:'8%',    left:'10%'  }, anim:'rmsWander 7s ease-in-out infinite',          delay:'0s'   },
  { C: ButterflyIcon, color:'#f97316', size:24, style:{ top:'52%',   right:'7%'  }, anim:'rmsWander 9.5s ease-in-out infinite reverse', delay:'1.5s' },
  { C: ButterflyIcon, color:'#f87171', size:20, style:{ top:'28%',   left:'62%'  }, anim:'rmsWander 6.5s ease-in-out infinite',         delay:'3.5s' },
  { C: LeafIcon,      color:'#fb923c', size:32, style:{ top:'11%',   right:'13%' }, anim:'rmsSway 4.5s ease-in-out infinite',           delay:'1s',   origin:'bottom center' },
  { C: LeafIcon,      color:'#fde047', size:22, style:{ bottom:'22%',left:'12%'  }, anim:'rmsSway 5.5s ease-in-out infinite reverse',   delay:'0.5s', origin:'bottom center' },
  { C: LeafIcon,      color:'#f87171', size:18, style:{ top:'68%',   right:'20%' }, anim:'rmsFloat 5s ease-in-out infinite',            delay:'2.5s' },
  { C: LeafIcon,      color:'#fbbf24', size:28, style:{ top:'42%',   left:'4%'   }, anim:'rmsSway 6s ease-in-out infinite',             delay:'2s',   origin:'bottom center' },
  { C: TractorIcon,   color:'#fb923c', size:30, style:{ bottom:'17%',left:'5%'   }, anim:'rmsBobble 6s ease-in-out infinite',           delay:'0s'   },
  { C: TractorIcon,   color:'#fde047', size:22, style:{ bottom:'38%',right:'4%'  }, anim:'rmsBobble 8s ease-in-out infinite reverse',   delay:'4s'   },
];

const AnimBg = ({ mobile = false }) => (
  <div className={`absolute inset-0 pointer-events-none overflow-hidden ${mobile ? 'lg:hidden z-0' : 'z-[1]'}`}>
    {BG_ELS.map(({ C, color, size, style, anim, delay, origin }, i) => (
      <div key={i} className="absolute" style={{ ...style, animation: anim, animationDelay: delay, transformOrigin: origin || 'center', opacity: mobile ? 0.16 : 0.62 }}>
        <C color={color} size={size} />
      </div>
    ))}
  </div>
);
// ────────────────────────────────────────────────────────────────────────────

const Login = () => {
  const [selectedDept, setSelectedDept] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [departments, setDepartments] = useState([]);
  const [showAccessCode, setShowAccessCode] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [showMfa, setShowMfa] = useState(false);

  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showForgotCode, setShowForgotCode] = useState(false);
  const [ictPhone, setIctPhone] = useState('');
  const [deptDropOpen, setDeptDropOpen] = useState(false);
  const [subDropOpen, setSubDropOpen] = useState(false);
  const [loginType, setLoginType] = useState(''); // 'dept' | 'subunit'
  const deptDropRef = useRef(null);
  const subDropRef = useRef(null);
  const { deptLogin } = useAuth();

  // Split departments into main and sub-units
  const mainDepts = departments.filter(d => d.type !== 'Sub-Account');
  const subUnits  = departments.filter(d => d.type === 'Sub-Account');

  useEffect(() => {
    const fetchDepts = async () => {
      const depts = await getDepartments();
      setDepartments(depts);
    };
    fetchDepts();

    fetch('/api/public/support-phone')
      .then(r => r.json())
      .then(d => { if (d?.value) setIctPhone(d.value); })
      .catch(() => {});

    // Close dropdowns on outside click
    const handleOutside = (e) => {
      if (deptDropRef.current && !deptDropRef.current.contains(e.target)) setDeptDropOpen(false);
      if (subDropRef.current && !subDropRef.current.contains(e.target)) setSubDropOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);

    // PWA Install Logic
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsStandalone(true);
    }

    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) {
      toast("To install: Open browser menu and select 'Add to Home Screen'", { icon: '📲' });
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      if (!selectedDept) {
        throw new Error("Please select a department or sub-unit");
      }
      // Unify login to use the department portal (Backend now handles Super Admin role internally)
      await deptLogin(selectedDept, accessCode, mfaCode);
    } catch (err) {
      const status = err.response?.status;
      let displayString;
      if (status === 401) {
        displayString = err.response?.data?.error || 'Incorrect access code. Please try again.';
      } else if (status === 429) {
        displayString = 'Too many attempts. Please wait a moment and try again.';
      } else if (status >= 500 || status === 502 || status === 503) {
        displayString = 'The server is temporarily unavailable. Please try again in a few seconds.';
      } else if (!navigator.onLine || err.code === 'ERR_NETWORK' || err.message === 'Network Error') {
        displayString = 'No internet connection. Please check your network and try again.';
      } else {
        displayString = err.response?.data?.error || err.message || 'Authentication failed. Please try again.';
      }
      setError(displayString);
      setIsSubmitting(false);
    }
  };

  return (
    <>
    <style>{RMS_ANIM_CSS}</style>
    <div className="min-h-screen bg-background flex flex-col lg:flex-row relative overflow-hidden">
      {/* Mobile animated bg layer — behind the form on white */}
      <AnimBg mobile />

      {/* ── Left Branding Panel (Desktop Only) ── */}
      <div className="hidden lg:flex lg:w-[45%] bg-gradient-to-br from-[hsl(var(--primary))] via-[hsl(var(--primary)/0.88)] to-[hsl(var(--primary)/0.65)] text-white relative overflow-hidden flex-col justify-between p-12">
        {/* Darkening overlay for deeper green */}
        <div className="absolute inset-0 bg-black/25 z-0" />
        {/* Desktop animated elements */}
        <AnimBg />
        <div className="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full -translate-y-1/3 translate-x-1/3 blur-sm z-[2]"></div>
        <div className="absolute bottom-0 left-0 w-56 h-56 bg-white/5 rounded-full translate-y-1/3 -translate-x-1/3 z-[2]"></div>

        {/* Branding Card Wrapper */}
        <div className="relative z-10 border border-white/20 bg-white/5 backdrop-blur-sm rounded-[40px] px-10 py-14 flex flex-col items-center justify-center text-center my-auto gap-10">

          {/* Logo + Company name */}
          <div className="flex flex-col items-center gap-4">
            <img
              src="/CSS_Group.png"
              alt="CSS Group Logo"
              className="max-w-[176px] w-auto h-auto object-contain drop-shadow-xl rounded-xl"
            />
            <div>
              <p className="text-xs font-black uppercase tracking-[0.3em] text-white/50">CSS Group of Companies</p>
              <div className="mt-1.5 w-10 h-[2px] bg-white/20 mx-auto rounded-full" />
            </div>
          </div>

          {/* Headline */}
          <div className="space-y-3">
            <h1 className="text-5xl font-black tracking-tight leading-[1.1] text-white">
              Requisition<br />
              <span className="italic text-white/80 font-extrabold text-4xl">Management</span>
            </h1>
            <p className="text-sm text-white/60 leading-relaxed max-w-[220px] mx-auto font-medium">
              Streamlined enterprise workflow for requisitions, memos, and procurement across all CSS Group departments.
            </p>
          </div>

          {/* Feature list */}
          <div className="w-full space-y-2.5 border-t border-white/10 pt-8">
            {['End-to-end approval tracking', 'Offline draft capability', 'Multi-department oversight'].map((item, i) => (
              <div key={i} className="flex items-center justify-center gap-3">
                <CheckCircle2 size={14} className="text-white/40 shrink-0" />
                <span className="text-[13px] font-semibold text-white/70 tracking-wide">{item}</span>
              </div>
            ))}
          </div>

        </div>

        {/* Footer info (Outside Card) */}
        <div className="relative z-10">
          <div className="flex items-center space-x-4 text-[9px] text-white/40 uppercase tracking-widest">
            <span>RMS</span>
            <div className="w-1 h-1 rounded-full bg-white/30"></div>
            <span>ISO ----</span>
          </div>
        </div>
      </div>

      {/* ── Right Form Panel ── */}
      <div className="flex-1 flex items-center justify-center p-5 lg:p-12 relative z-10">
        <div className="w-full max-w-sm border border-border/60 rounded-2xl p-8 bg-white shadow-sm lg:border-0 lg:shadow-none lg:bg-transparent lg:p-0">

          {/* Mobile logo + app name (Banner Style) */}
          <div className="lg:hidden -mx-8 -mt-8 mb-8 bg-primary p-6 rounded-t-2xl flex items-center space-x-4 border-b border-white/10">
            <div className="w-20 h-11 rounded-xl overflow-hidden shrink-0 bg-white/10 p-0.5">
              <img src="/CSS_Group.png" alt="Logo" className="w-full h-full object-cover object-center" />
            </div>
            <div>
              <h1 className="text-base font-black text-white tracking-[0.1em] italic uppercase">RMS</h1>
              <p className="text-[10px] text-white/80 uppercase tracking-[0.3em] font-bold leading-none">Portal</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="text-center space-y-1.5">
              <h2 className="text-2xl font-bold tracking-tight text-foreground">Sign In to Dashboard</h2>
              <h3 className="text-base font-semibold text-foreground">Welcome back</h3>
              <p className="text-sm text-muted-foreground">Authenticate to access the RMS portal</p>
            </div>

            {error && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive text-xs px-4 py-3 rounded-xl mb-5 flex items-center space-x-2">
                <div className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse"></div>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              {/* ── Dept / Sub-Unit selector ── */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  {loginType === 'subunit' ? 'Sub-Unit' : 'Department / Unit'}
                </label>
                <div className="flex gap-2">

                  {/* DEPARTMENT / UNIT button */}
                  <div ref={deptDropRef} className="relative flex-1">
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => { setDeptDropOpen(v => !v); setSubDropOpen(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-3 rounded-xl border text-sm transition-all disabled:opacity-50
                        ${loginType === 'dept' && selectedDept
                          ? 'border-primary bg-primary/5 text-foreground font-semibold'
                          : 'border-border bg-white text-muted-foreground hover:border-primary/50'}`}
                    >
                      <Building2 size={15} className={loginType === 'dept' && selectedDept ? 'text-primary shrink-0' : 'text-muted-foreground/50 shrink-0'} />
                      <span className="flex-1 text-left truncate text-xs">
                        {loginType === 'dept' && selectedDept ? selectedDept : 'Dept / Unit'}
                      </span>
                      {loginType === 'dept' && selectedDept ? (
                        <X size={12} className="text-muted-foreground hover:text-red-500 shrink-0" onClick={(e) => { e.stopPropagation(); setSelectedDept(''); setLoginType(''); }} />
                      ) : (
                        <ChevronDown size={13} className={`shrink-0 transition-transform ${deptDropOpen ? 'rotate-180' : ''}`} />
                      )}
                    </button>
                    {deptDropOpen && mainDepts.length > 0 && (
                      <div className="absolute top-full left-0 w-full mt-1 z-50 bg-white border border-border rounded-xl shadow-xl overflow-hidden">
                        <div className="max-h-48 overflow-y-auto">
                          {mainDepts.map(d => (
                            <button
                              key={d.id}
                              type="button"
                              onClick={() => { setSelectedDept(d.name); setLoginType('dept'); setDeptDropOpen(false); }}
                              className={`w-full text-left px-3 py-2.5 text-sm flex items-center gap-2 hover:bg-primary/5 transition-colors
                                ${selectedDept === d.name && loginType === 'dept' ? 'bg-primary/8 text-primary font-semibold' : 'text-foreground'}`}
                            >
                              <Building2 size={13} className="text-muted-foreground/50 shrink-0" />
                              <span className="truncate">{d.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* SUB-UNITS button */}
                  <div ref={subDropRef} className="relative flex-1">
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => { setSubDropOpen(v => !v); setDeptDropOpen(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-3 rounded-xl border text-sm transition-all disabled:opacity-50
                        ${loginType === 'subunit' && selectedDept
                          ? 'border-violet-400 bg-violet-50 text-foreground font-semibold'
                          : 'border-border bg-white text-muted-foreground hover:border-violet-300'}`}
                    >
                      <GitBranch size={15} className={loginType === 'subunit' && selectedDept ? 'text-violet-600 shrink-0' : 'text-muted-foreground/50 shrink-0'} />
                      <span className="flex-1 text-left truncate text-xs">
                        {loginType === 'subunit' && selectedDept ? selectedDept : 'Sub-Units'}
                      </span>
                      {loginType === 'subunit' && selectedDept ? (
                        <X size={12} className="text-muted-foreground hover:text-red-500 shrink-0" onClick={(e) => { e.stopPropagation(); setSelectedDept(''); setLoginType(''); }} />
                      ) : (
                        <ChevronDown size={13} className={`shrink-0 transition-transform ${subDropOpen ? 'rotate-180' : ''}`} />
                      )}
                    </button>
                    {subDropOpen && (
                      <div className="absolute top-full left-0 w-full mt-1 z-50 bg-white border border-border rounded-xl shadow-xl overflow-hidden">
                        {subUnits.length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-4 px-3 italic">No sub-units available.</p>
                        ) : (
                          <div className="max-h-48 overflow-y-auto">
                            {subUnits.map(d => (
                              <button
                                key={d.id}
                                type="button"
                                onClick={() => { setSelectedDept(d.name); setLoginType('subunit'); setSubDropOpen(false); }}
                                className={`w-full text-left px-3 py-2.5 text-sm flex items-center gap-2 hover:bg-violet-50 transition-colors
                                  ${selectedDept === d.name && loginType === 'subunit' ? 'bg-violet-50 text-violet-700 font-semibold' : 'text-foreground'}`}
                              >
                                <GitBranch size={13} className="text-violet-400 shrink-0" />
                                <span className="truncate">{d.name}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Access Code</label>
                <div className="relative group">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 group-focus-within:text-primary transition-colors" size={16} />
                  <input
                    type={showAccessCode ? "text" : "password"}
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full bg-white border border-border rounded-xl pl-10 pr-12 py-3 text-sm text-foreground placeholder-muted-foreground/60 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all disabled:opacity-50 font-mono tracking-widest"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowAccessCode(!showAccessCode)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-primary transition-colors"
                  >
                    {showAccessCode ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {selectedDept === 'Super Admin' && (
                <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-300">
                  <label className="text-[11px] font-medium text-primary uppercase tracking-wider flex items-center justify-between">
                    <span>MFA Security PIN</span>
                    <span className="text-[9px] lowercase opacity-60">Required for Admin</span>
                  </label>
                  <div className="relative group">
                    <Smartphone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-primary/50 group-focus-within:text-primary transition-colors" size={16} />
                    <input
                      type="text"
                      maxLength={6}
                      value={mfaCode}
                      onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                      disabled={isSubmitting}
                      className="w-full bg-primary/5 border border-primary/20 rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder-primary/30 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all disabled:opacity-50 font-mono tracking-[0.5em] text-center"
                      placeholder="000000"
                      required
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3 px-4 rounded-xl transition-all shadow-md shadow-primary/15 flex items-center justify-center space-x-2 active:scale-[0.98] disabled:opacity-50 text-sm h-12"
              >
                <span>{isSubmitting ? "Authenticating..." : "Enter RMS Portal"}</span>
                {!isSubmitting && <ArrowRight size={16} />}
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => setShowForgotCode(true)}
                  className="text-[11px] text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1.5 group"
                >
                  <HelpCircle size={12} className="group-hover:scale-110 transition-transform" />
                  Forgot your access code?
                </button>
              </div>
            </form>
          </div>

          <div className="mt-8 text-center">
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-[0.2em]">© 2026 CSS Group of Companies</p>
          </div>
        </div>
      </div>

      {/* ── Forgot Access Code Modal ── */}
      {showForgotCode && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 animate-in zoom-in-95 duration-200 relative">
            <button
              onClick={() => setShowForgotCode(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all"
            >
              <X size={16} />
            </button>

            <div className="flex flex-col items-center text-center space-y-5">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <PhoneCall size={28} className="text-primary" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-lg font-bold text-foreground tracking-tight">Need Help With Your Code?</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Contact the ICT Department to reset your access code.
                </p>
              </div>

              <div className="w-full bg-primary/5 border border-primary/15 rounded-2xl p-5 text-left">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <PhoneCall size={16} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-foreground uppercase tracking-tight">ICT Department</p>
                    <p className="text-[10px] text-muted-foreground">Technical Support</p>
                  </div>
                </div>
                {ictPhone ? (
                  <a
                    href={`tel:${ictPhone}`}
                    className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-all active:scale-[0.98]"
                  >
                    <PhoneCall size={15} />
                    Call {ictPhone}
                  </a>
                ) : (
                  <p className="text-xs text-muted-foreground italic text-center">
                    Please contact the ICT Department directly.
                  </p>
                )}
              </div>

              <p className="text-[10px] text-muted-foreground/70 leading-relaxed italic">
                They will verify your identity and issue a new code promptly.
              </p>

              <button
                onClick={() => setShowForgotCode(false)}
                className="w-full py-3 rounded-xl border border-border/50 text-muted-foreground text-sm font-semibold hover:bg-muted/40 transition-all active:scale-[0.98]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PWA Floating Install Button ── */}
      {!isStandalone && (
        <button
          onClick={handleInstallApp}
          className="fixed bottom-6 right-6 z-[100] glass border border-primary/20 bg-white/40 hover:bg-white/60 text-primary py-2.5 px-5 rounded-full shadow-2xl flex items-center space-x-2.5 transition-all active:scale-95 group animate-in slide-in-from-bottom-10"
        >
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
            <Smartphone size={16} />
          </div>
          <div className="text-left pr-1">
            <p className="text-[10px] font-black uppercase tracking-widest leading-none opacity-60">Install App</p>
            <p className="text-xs font-bold leading-tight mt-0.5">RMS Portal</p>
          </div>
        </button>
      )}
    </div>
    </>
  );
};

export default Login;
