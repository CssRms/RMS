import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, ArrowRight, CheckCircle2, Building2, Eye, EyeOff, Smartphone, HelpCircle, X, PhoneCall, ChevronDown, GitBranch } from 'lucide-react';
import { getDepartments } from '../lib/store';
import { toast } from 'react-hot-toast';

// ── Realistic botanical / farm SVG icons ────────────────────────────────────
const SunflowerIcon = ({ color = '#fbbf24', size = 40 }) => {
  const r = size / 2;
  const petal = size * 0.32;
  const center = size * 0.22;
  return (
    <svg width={size} height={size + size * 0.55} viewBox={`0 0 ${size} ${size + size * 0.55}`} fill="none">
      {/* stem */}
      <path d={`M${r} ${size * 0.9} Q${r - size * 0.12} ${size * 1.1} ${r - size * 0.06} ${size * 1.5}`}
        stroke="#4ade80" strokeWidth={size * 0.07} strokeLinecap="round" />
      {/* leaf on stem */}
      <ellipse cx={r - size * 0.18} cy={size * 1.18} rx={size * 0.17} ry={size * 0.09}
        fill="#4ade80" transform={`rotate(-35 ${r - size * 0.18} ${size * 1.18})`} opacity="0.9" />
      {/* 8 petals */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => (
        <ellipse
          key={i}
          cx={r + Math.cos((deg - 90) * Math.PI / 180) * (r - center * 0.4)}
          cy={r + Math.sin((deg - 90) * Math.PI / 180) * (r - center * 0.4)}
          rx={petal * 0.38}
          ry={petal * 0.72}
          fill={color}
          opacity="0.92"
          transform={`rotate(${deg} ${r + Math.cos((deg - 90) * Math.PI / 180) * (r - center * 0.4)} ${r + Math.sin((deg - 90) * Math.PI / 180) * (r - center * 0.4)})`}
        />
      ))}
      {/* center dark */}
      <circle cx={r} cy={r} r={center} fill="#78350f" />
      <circle cx={r} cy={r} r={center * 0.65} fill="#92400e" />
      {/* center dots */}
      {[0, 60, 120, 180, 240, 300].map((deg, i) => (
        <circle key={i}
          cx={r + Math.cos(deg * Math.PI / 180) * center * 0.38}
          cy={r + Math.sin(deg * Math.PI / 180) * center * 0.38}
          r={center * 0.1} fill="#fbbf24" opacity="0.7" />
      ))}
    </svg>
  );
};

const TropicalLeafIcon = ({ color = '#fb923c', size = 36 }) => (
  <svg width={size * 0.68} height={size} viewBox="0 0 34 52" fill="none">
    {/* main leaf */}
    <path d="M17 50 C5 36 1 24 1 15 C1 5 17 0 17 0 C17 0 33 5 33 15 C33 24 29 36 17 50Z" fill={color} opacity="0.88" />
    {/* center vein */}
    <path d="M17 48 Q16 30 17 4" stroke="rgba(0,0,0,0.2)" strokeWidth="1.4" strokeLinecap="round" fill="none" />
    {/* side veins */}
    {[12, 20, 28, 36].map((y, i) => (
      <g key={i}>
        <path d={`M17 ${y} Q10 ${y - 4} 6 ${y - 2}`} stroke="rgba(0,0,0,0.15)" strokeWidth="0.9" fill="none" strokeLinecap="round" />
        <path d={`M17 ${y} Q24 ${y - 4} 28 ${y - 2}`} stroke="rgba(0,0,0,0.15)" strokeWidth="0.9" fill="none" strokeLinecap="round" />
      </g>
    ))}
    {/* shine */}
    <path d="M20 6 Q26 12 25 24" stroke="rgba(255,255,255,0.22)" strokeWidth="2.5" strokeLinecap="round" fill="none" />
  </svg>
);

const FlowerIcon = ({ color = '#f87171', size = 32 }) => {
  const r = size / 2;
  const pRadius = r * 0.55;
  return (
    <svg width={size} height={size + size * 0.5} viewBox={`0 0 ${size} ${size + size * 0.5}`} fill="none">
      {/* stem */}
      <path d={`M${r} ${size * 0.88} Q${r + size * 0.1} ${size * 1.1} ${r + size * 0.05} ${size * 1.45}`}
        stroke="#4ade80" strokeWidth={size * 0.065} strokeLinecap="round" />
      {/* leaf */}
      <ellipse cx={r + size * 0.16} cy={size * 1.15} rx={size * 0.15} ry={size * 0.08}
        fill="#4ade80" transform={`rotate(30 ${r + size * 0.16} ${size * 1.15})`} opacity="0.85" />
      {/* 5 petals */}
      {[0, 72, 144, 216, 288].map((deg, i) => (
        <ellipse key={i}
          cx={r + Math.cos((deg - 90) * Math.PI / 180) * pRadius}
          cy={r + Math.sin((deg - 90) * Math.PI / 180) * pRadius}
          rx={r * 0.32} ry={r * 0.52}
          fill={color} opacity="0.9"
          transform={`rotate(${deg} ${r + Math.cos((deg - 90) * Math.PI / 180) * pRadius} ${r + Math.sin((deg - 90) * Math.PI / 180) * pRadius})`}
        />
      ))}
      {/* center */}
      <circle cx={r} cy={r} r={r * 0.28} fill="#fde047" />
      <circle cx={r} cy={r} r={r * 0.14} fill="#fbbf24" />
    </svg>
  );
};

const DetailedTractorIcon = ({ color = '#fbbf24', size = 48 }) => {
  const s = size / 48;
  return (
    <svg width={size * 1.6} height={size} viewBox="0 0 76 48" fill="none">
      {/* rear large wheel */}
      <circle cx="22" cy="33" r="14" stroke={color} strokeWidth="2.8" fill="none" />
      <circle cx="22" cy="33" r="9" stroke={color} strokeWidth="1.2" fill="none" opacity="0.4" />
      <circle cx="22" cy="33" r="3" fill={color} opacity="0.7" />
      {/* wheel spokes */}
      {[0, 60, 120, 180, 240, 300].map((deg, i) => (
        <line key={i}
          x1={22 + Math.cos(deg * Math.PI / 180) * 3.5}
          y1={33 + Math.sin(deg * Math.PI / 180) * 3.5}
          x2={22 + Math.cos(deg * Math.PI / 180) * 8.5}
          y2={33 + Math.sin(deg * Math.PI / 180) * 8.5}
          stroke={color} strokeWidth="1.5" opacity="0.6" strokeLinecap="round" />
      ))}
      {/* front small wheel */}
      <circle cx="57" cy="37" r="8" stroke={color} strokeWidth="2.2" fill="none" />
      <circle cx="57" cy="37" r="4.5" stroke={color} strokeWidth="1" fill="none" opacity="0.4" />
      <circle cx="57" cy="37" r="2" fill={color} opacity="0.7" />
      {/* wheel spokes front */}
      {[0, 90, 180, 270].map((deg, i) => (
        <line key={i}
          x1={57 + Math.cos(deg * Math.PI / 180) * 2.5}
          y1={37 + Math.sin(deg * Math.PI / 180) * 2.5}
          x2={57 + Math.cos(deg * Math.PI / 180) * 4}
          y2={37 + Math.sin(deg * Math.PI / 180) * 4}
          stroke={color} strokeWidth="1.2" opacity="0.55" strokeLinecap="round" />
      ))}
      {/* body / chassis */}
      <path d="M22 33 L22 20 L36 18 L50 20 L57 24 L57 37" stroke={color} strokeWidth="1.2" fill="none" opacity="0.3" />
      {/* engine hood */}
      <rect x="33" y="18" width="22" height="13" rx="2.5" fill={color} opacity="0.82" />
      {/* cab */}
      <rect x="13" y="10" width="22" height="16" rx="3" fill={color} opacity="0.75" />
      {/* cab window */}
      <rect x="16" y="12" width="8" height="8" rx="1.5" fill="rgba(255,255,255,0.35)" />
      <rect x="26" y="12" width="6" height="8" rx="1.5" fill="rgba(255,255,255,0.2)" />
      {/* exhaust stack */}
      <rect x="50" y="5" width="4" height="14" rx="2" fill={color} opacity="0.7" />
      <ellipse cx="52" cy="4" rx="3.5" ry="2" fill={color} opacity="0.5" />
      {/* exhaust puff */}
      <circle cx="52" cy="1.5" r="1.8" fill={color} opacity="0.25" />
      {/* fender over rear wheel */}
      <path d="M8 22 Q14 16 22 18 Q30 19 33 22" stroke={color} strokeWidth="2.5" fill="none" opacity="0.6" strokeLinecap="round" />
      {/* ground shadow */}
      <ellipse cx="36" cy="47" rx="26" ry="2.5" fill={color} opacity="0.12" />
    </svg>
  );
};

const PalmLeafIcon = ({ color = '#ffffff', size = 38 }) => (
  <svg width={size} height={size * 1.1} viewBox="0 0 38 42" fill="none">
    {/* stem */}
    <path d="M19 40 Q18 32 19 22" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" />
    {/* fronds */}
    <path d="M19 22 Q4 16 2 6" stroke={color} strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.85" />
    <path d="M19 22 Q14 8 16 2" stroke={color} strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.85" />
    <path d="M19 22 Q24 8 22 2" stroke={color} strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.85" />
    <path d="M19 22 Q34 16 36 6" stroke={color} strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.85" />
    <path d="M19 22 Q6 22 2 18" stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none" opacity="0.6" />
    <path d="M19 22 Q32 22 36 18" stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none" opacity="0.6" />
    {/* small leaf fills */}
    {[[4, 8], [15, 3], [22, 3], [35, 7]].map(([cx, cy], i) => (
      <ellipse key={i} cx={cx} cy={cy} rx="4.5" ry="2.2" fill={color} opacity="0.35"
        transform={`rotate(${i * 25 - 30} ${cx} ${cy})`} />
    ))}
  </svg>
);

// ── Watermark scrolling text ──────────────────────────────────────────────────
const WatermarkBg = () => {
  const phrase = 'CSS RMS • CSS RMS • CSS RMS • CSS RMS • ';
  const rows = [
    { top: '4%',  dur: 22, dir: 'normal',  delay: '0s'   },
    { top: '16%', dur: 28, dir: 'reverse', delay: '-8s'  },
    { top: '28%', dur: 20, dir: 'normal',  delay: '-14s' },
    { top: '40%', dur: 26, dir: 'reverse', delay: '-4s'  },
    { top: '52%', dur: 24, dir: 'normal',  delay: '-18s' },
    { top: '64%', dur: 30, dir: 'reverse', delay: '-10s' },
    { top: '76%', dur: 21, dir: 'normal',  delay: '-6s'  },
    { top: '88%', dur: 27, dir: 'reverse', delay: '-2s'  },
  ];
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0" style={{ opacity: 0.055 }}>
      {rows.map((r, i) => (
        <div key={i} style={{
          position: 'absolute',
          top: r.top,
          left: 0,
          whiteSpace: 'nowrap',
          animation: `rmsMarquee ${r.dur}s linear infinite`,
          animationDirection: r.dir,
          animationDelay: r.delay,
          fontSize: '13px',
          fontWeight: 900,
          color: 'white',
          letterSpacing: '0.25em',
          textTransform: 'uppercase',
          fontFamily: 'system-ui, sans-serif',
          transform: 'rotate(-8deg)',
          transformOrigin: 'left center',
        }}>
          {phrase.repeat(6)}
        </div>
      ))}
    </div>
  );
};

// ── CSS animations ────────────────────────────────────────────────────────────
const RMS_ANIM_CSS = `
  @keyframes rmsFloat {
    0%,100% { transform: translateY(0)     rotate(0deg);   }
    33%      { transform: translateY(-12px) rotate(4deg);   }
    66%      { transform: translateY(-5px)  rotate(-3deg);  }
  }
  @keyframes rmsSway {
    0%,100% { transform: rotate(-12deg) translateY(0);    }
    50%      { transform: rotate(12deg)  translateY(-9px); }
  }
  @keyframes rmsSwayAlt {
    0%,100% { transform: rotate(-8deg) scale(1);    }
    50%      { transform: rotate(10deg) scale(1.04); }
  }
  @keyframes rmsBobble {
    0%,100% { transform: translateX(0)    translateY(0);    }
    25%      { transform: translateX(6px)  translateY(-7px);  }
    75%      { transform: translateX(-5px) translateY(-3px);  }
  }
  @keyframes rmsDrive {
    0%,100% { transform: translateX(0)   translateY(0); }
    25%      { transform: translateX(4px) translateY(-5px); }
    50%      { transform: translateX(8px) translateY(0); }
    75%      { transform: translateX(4px) translateY(-4px); }
  }
  @keyframes rmsPulse {
    0%,100% { transform: scale(1)    rotate(0deg); }
    50%      { transform: scale(1.07) rotate(5deg); }
  }
  @keyframes rmsMarquee {
    0%   { transform: rotate(-8deg) translateX(0); }
    100% { transform: rotate(-8deg) translateX(-50%); }
  }
  @keyframes rmsSpin {
    0%   { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const BG_ELS = [
  // Sunflowers — yellow, lively sway
  { C: SunflowerIcon, color: '#fbbf24', size: 42, style: { top: '6%',    left: '8%'   }, anim: 'rmsSway 4.5s ease-in-out infinite',          delay: '0s',   origin: 'bottom center' },
  { C: SunflowerIcon, color: '#fde047', size: 30, style: { top: '60%',   right: '6%'  }, anim: 'rmsSway 5.5s ease-in-out infinite reverse',   delay: '1.5s', origin: 'bottom center' },
  { C: SunflowerIcon, color: '#fbbf24', size: 24, style: { top: '35%',   left: '3%'   }, anim: 'rmsSway 6s ease-in-out infinite',             delay: '3s',   origin: 'bottom center' },
  // Tropical leaves — orange, swaying
  { C: TropicalLeafIcon, color: '#fb923c', size: 38, style: { top: '10%', right: '10%' }, anim: 'rmsSway 5s ease-in-out infinite',             delay: '1s',   origin: 'bottom center' },
  { C: TropicalLeafIcon, color: '#f97316', size: 26, style: { bottom: '20%', left: '10%' }, anim: 'rmsSway 6.5s ease-in-out infinite reverse', delay: '2s',   origin: 'bottom center' },
  { C: TropicalLeafIcon, color: '#fde047', size: 32, style: { top: '48%', right: '3%'  }, anim: 'rmsSwayAlt 5s ease-in-out infinite',          delay: '4s',   origin: 'bottom center' },
  // Flowers — red, floating
  { C: FlowerIcon,    color: '#f87171', size: 34, style: { top: '22%',   left: '58%'  }, anim: 'rmsFloat 5.5s ease-in-out infinite',          delay: '0.5s' },
  { C: FlowerIcon,    color: '#ef4444', size: 26, style: { bottom: '35%',right: '15%' }, anim: 'rmsPulse 4.5s ease-in-out infinite',          delay: '2.5s' },
  { C: FlowerIcon,    color: '#fca5a5', size: 20, style: { top: '75%',   left: '55%'  }, anim: 'rmsFloat 7s ease-in-out infinite reverse',    delay: '1s'   },
  // Palm leaves — white, floating
  { C: PalmLeafIcon,  color: '#ffffff', size: 36, style: { top: '30%',   left: '64%'  }, anim: 'rmsSway 7s ease-in-out infinite',             delay: '3.5s', origin: 'bottom center' },
  { C: PalmLeafIcon,  color: '#ffffff', size: 26, style: { bottom: '28%',left: '38%'  }, anim: 'rmsSwayAlt 6s ease-in-out infinite reverse',  delay: '1.5s', origin: 'bottom center' },
  // Tractors — yellow/white, driving bobble
  { C: DetailedTractorIcon, color: '#fde047', size: 40, style: { bottom: '13%', left: '3%' }, anim: 'rmsDrive 5s ease-in-out infinite',        delay: '0s'   },
  { C: DetailedTractorIcon, color: '#ffffff', size: 28, style: { bottom: '42%', right: '2%' }, anim: 'rmsDrive 7s ease-in-out infinite reverse', delay: '3.5s' },
];

const AnimBg = ({ mobile = false }) => (
  <div className={`absolute inset-0 pointer-events-none overflow-hidden ${mobile ? 'lg:hidden z-0' : 'z-[1]'}`}>
    {!mobile && <WatermarkBg />}
    {BG_ELS.map(({ C, color, size, style, anim, delay, origin }, i) => (
      <div key={i} className="absolute" style={{
        ...style,
        animation: anim,
        animationDelay: delay,
        transformOrigin: origin || 'center',
        opacity: mobile ? 0.13 : 0.72,
        filter: mobile ? 'none' : 'drop-shadow(0 2px 6px rgba(0,0,0,0.18))',
      }}>
        <C color={color} size={size} />
      </div>
    ))}
  </div>
);
// ─────────────────────────────────────────────────────────────────────────────

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

    const handleOutside = (e) => {
      if (deptDropRef.current && !deptDropRef.current.contains(e.target)) setDeptDropOpen(false);
      if (subDropRef.current && !subDropRef.current.contains(e.target)) setSubDropOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);

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
    if (outcome === 'accepted') setDeferredPrompt(null);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      if (!selectedDept) throw new Error("Please select a department or sub-unit");
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
      {/* Mobile animated bg */}
      <AnimBg mobile />

      {/* ── Left Branding Panel (Desktop) ── */}
      <div className="hidden lg:flex lg:w-[45%] bg-gradient-to-br from-[hsl(var(--primary))] via-[hsl(var(--primary)/0.88)] to-[hsl(var(--primary)/0.65)] text-white relative overflow-hidden flex-col justify-between p-12">
        <div className="absolute inset-0 bg-black/28 z-0" />
        <AnimBg />
        <div className="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full -translate-y-1/3 translate-x-1/3 blur-sm z-[2]" />
        <div className="absolute bottom-0 left-0 w-56 h-56 bg-white/5 rounded-full translate-y-1/3 -translate-x-1/3 z-[2]" />

        {/* Branding Card */}
        <div className="relative z-10 border border-white/20 bg-white/5 backdrop-blur-sm rounded-[40px] px-10 py-10 flex flex-col items-center justify-center text-center my-auto gap-0">

          {/* ── Section 1: Logo identity ── */}
          <div className="flex items-center gap-4 w-full justify-center mb-6">
            <img
              src="/CSS_Group.png"
              alt="CSS Group Logo"
              className="w-[72px] h-[72px] object-contain drop-shadow-xl rounded-2xl shrink-0 ring-2 ring-white/10"
            />
            <div className="text-left">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 leading-none">CSS Group of</p>
              <p className="text-lg font-black uppercase tracking-[0.18em] text-white leading-tight">Companies</p>
            </div>
          </div>

          <div className="w-full h-px bg-white/10 mb-7" />

          {/* ── Section 2: Product name ── */}
          <div className="mb-2">
            <span className="inline-block px-3 py-0.5 rounded-full bg-white/10 text-[9px] font-black uppercase tracking-[0.35em] text-white/50 mb-4">
              Enterprise Portal
            </span>
          </div>
          <h1 className="text-[52px] font-black tracking-tight leading-[0.95] text-white mb-2">
            Requisition
          </h1>
          <h2 className="text-[32px] italic font-extrabold text-white/70 leading-none mb-5">
            Management
          </h2>
          <p className="text-[12px] text-white/50 leading-relaxed max-w-[210px] mx-auto font-medium mb-8">
            Streamlined enterprise workflow for requisitions, memos, and procurement across all CSS Group departments.
          </p>

          <div className="w-full h-px bg-white/10 mb-7" />

          {/* ── Section 3: Feature pills ── */}
          <div className="w-full flex flex-col gap-2.5">
            {[
              { label: 'End-to-end approval tracking', icon: '✓' },
              { label: 'Offline draft capability',     icon: '✓' },
              { label: 'Multi-department oversight',   icon: '✓' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/5 border border-white/8 hover:bg-white/8 transition-colors">
                <span className="w-5 h-5 rounded-full bg-white/15 flex items-center justify-center text-white text-[10px] font-black shrink-0">{item.icon}</span>
                <span className="text-[12px] font-semibold text-white/65 tracking-wide text-left">{item.label}</span>
              </div>
            ))}
          </div>

        </div>

        {/* Footer */}
        <div className="relative z-10">
          <div className="flex items-center space-x-4 text-[9px] text-white/40 uppercase tracking-widest">
            <span>RMS</span>
            <div className="w-1 h-1 rounded-full bg-white/30" />
            <span style={{ textTransform: 'uppercase', fontStyle: 'italic', letterSpacing: '0.1em' }}>ISO coming soon</span>
          </div>
        </div>
      </div>

      {/* ── Right Form Panel ── */}
      <div className="flex-1 flex items-center justify-center p-5 lg:p-12 relative z-10">
        <div className="w-full max-w-sm border border-border/60 rounded-2xl p-8 bg-white shadow-sm lg:border-0 lg:shadow-none lg:bg-transparent lg:p-0">

          {/* Mobile logo banner */}
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
                <div className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  {loginType === 'subunit' ? 'Sub-Unit' : 'Department / Unit'}
                </label>
                <div className="flex gap-2">

                  {/* DEPARTMENT dropdown */}
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

                  {/* SUB-UNITS dropdown */}
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
                <p className="text-xs text-muted-foreground leading-relaxed">Contact the ICT Department to reset your access code.</p>
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
                  <p className="text-xs text-muted-foreground italic text-center">Please contact the ICT Department directly.</p>
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

      {/* ── PWA Install Button ── */}
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
