import { useState, useEffect, useCallback } from 'react';
import { hrAPI } from '../lib/api';
import { getHREmployees, getHRAttendance } from '../lib/store';
import {
  Clock, ChevronLeft, ChevronRight, Download,
  CheckCircle2, XCircle, AlertTriangle, CalendarDays,
  Users, TrendingUp, Fingerprint, RefreshCw, Wifi,
  WifiOff, ChevronDown, Calendar, Info, Loader2,
  Shield, Activity,
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

const STATUS_CONFIG = {
  P:  { label: 'P',  bg: 'bg-emerald-100 text-emerald-700', title: 'Present'  },
  L:  { label: 'L',  bg: 'bg-amber-100 text-amber-700',     title: 'Late'     },
  A:  { label: 'A',  bg: 'bg-red-100 text-red-700',         title: 'Absent'   },
  H:  { label: 'H',  bg: 'bg-blue-100 text-blue-700',       title: 'Holiday'  },
  LV: { label: 'LV', bg: 'bg-indigo-100 text-indigo-700',   title: 'On Leave' },
  WE: { label: '—',  bg: 'bg-muted/30 text-muted-foreground/30', title: 'Weekend' },
  '': { label: '·',  bg: 'bg-muted/20 text-muted-foreground/20', title: 'No Data' },
};

const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
const isWeekend = (year, month, day) => {
  const dow = new Date(year, month, day).getDay();
  return dow === 0 || dow === 6;
};

const fmtTime = dt => dt ? new Date(dt).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—';
const fmtHours = h => h != null ? `${Math.floor(h)}h ${Math.round((h % 1) * 60)}m` : '—';
const todayISO = () => new Date().toISOString().slice(0, 10);

// ── CSV Export (monthly) ──────────────────────────────────────────────────────
const exportCSV = (employees, days, attendanceMap, year, month) => {
  const header = ['Employee', 'Staff ID', 'Department', ...days.map(d => `${d}/${month+1}`), 'Present', 'Absent', 'Late'];
  const rows = employees.map(emp => {
    const record = attendanceMap[emp.id] || {};
    let p = 0, a = 0, l = 0;
    const cells = days.map(d => {
      const status = isWeekend(year, month, d) ? 'WE' : (record[d] || '');
      if (status === 'P') p++;
      else if (status === 'A') a++;
      else if (status === 'L') l++;
      return STATUS_CONFIG[status]?.title || '—';
    });
    return [`${emp.firstName} ${emp.lastName}`, emp.staffId || '', emp.department || '', ...cells, p, a, l];
  });
  const csv = [header, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Attendance_${MONTHS[month]}_${year}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

const exportDailyCSV = (rows, date) => {
  const header = ['Staff ID', 'First Name', 'Last Name', 'Other Name', 'Department', 'Status', 'Check-In', 'Check-Out', 'Hours Worked'];
  const data = rows.map(r => [
    r.staffId, r.firstName, r.lastName, r.otherName || '', r.department || '',
    r.isPresent ? 'Present' : 'Absent',
    fmtTime(r.firstPunch), fmtTime(r.lastPunch), r.hoursWorked != null ? r.hoursWorked.toFixed(2) : '0',
  ]);
  const csv = [header, ...data].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Biometric_Attendance_${date}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

// ── Tab: Monthly Manual Tracker ───────────────────────────────────────────────
const MonthlyTab = ({ onViewChange }) => {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [employees, setEmployees] = useState([]);
  const [attendanceMap, setAttendanceMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [editCell, setEditCell] = useState(null);

  const totalDays = getDaysInMonth(year, month);
  const workDays = Array.from({ length: totalDays }, (_, i) => i + 1).filter(d => !isWeekend(year, month, d));
  const allDays  = Array.from({ length: totalDays }, (_, i) => i + 1);

  const load = async () => {
    setLoading(true);
    try {
      const [empRes, attRes] = await Promise.allSettled([
        getHREmployees(),
        getHRAttendance({ year, month: month + 1 }),
      ]);
      if (empRes.status === 'fulfilled') {
        const emps = Array.isArray(empRes.value) ? empRes.value : (empRes.value?.results || []);
        setEmployees(emps.filter(e => e.status === 'active' || !e.status));
      }
      if (attRes.status === 'fulfilled') {
        const records = Array.isArray(attRes.value) ? attRes.value : (attRes.value?.results || []);
        const map = {};
        records.forEach(r => {
          if (!map[r.employeeId]) map[r.employeeId] = {};
          const day = new Date(r.date).getDate();
          map[r.employeeId][day] = r.status;
        });
        setAttendanceMap(map);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [year, month]);

  const prevMonth = () => { if (month === 0) { setYear(y => y-1); setMonth(11); } else setMonth(m => m-1); };
  const nextMonth = () => { if (month === 11) { setYear(y => y+1); setMonth(0); } else setMonth(m => m+1); };

  const handleStatusSelect = async (status) => {
    if (!editCell) return;
    const { empId, day } = editCell;
    const prev = attendanceMap[empId]?.[day];
    setAttendanceMap(m => ({ ...m, [empId]: { ...(m[empId] || {}), [day]: status } }));
    setEditCell(null);
    try {
      const date = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      await hrAPI.markAttendance({ employeeId: empId, date, status });
    } catch {
      setAttendanceMap(m => ({ ...m, [empId]: { ...(m[empId] || {}), [day]: prev } }));
      toast.error('Failed to save attendance.');
    }
  };

  const totalPresent  = employees.reduce((s, e) => s + Object.values(attendanceMap[e.id]||{}).filter(v=>v==='P').length, 0);
  const totalAbsent   = employees.reduce((s, e) => s + Object.values(attendanceMap[e.id]||{}).filter(v=>v==='A').length, 0);
  const totalLate     = employees.reduce((s, e) => s + Object.values(attendanceMap[e.id]||{}).filter(v=>v==='L').length, 0);
  const possibleDays  = employees.length * workDays.length;
  const attendanceRate= possibleDays > 0 ? Math.round(((totalPresent+totalLate)/possibleDays)*100) : 0;

  return (
    <div className="space-y-5">
      {/* Month navigator */}
      <div className="glass bg-white/70 rounded-2xl border border-border/40 p-4 flex items-center justify-between">
        <button onClick={prevMonth} className="p-2.5 rounded-xl hover:bg-muted border border-border/40 text-muted-foreground hover:text-foreground transition-colors"><ChevronLeft size={18}/></button>
        <div className="text-center">
          <h2 className="text-2xl font-black text-foreground tracking-tighter">{MONTHS[month]} {year}</h2>
          <p className="text-[10px] text-muted-foreground/60 font-mono mt-0.5">{workDays.length} working days · {employees.length} active employees</p>
        </div>
        <button onClick={nextMonth} className="p-2.5 rounded-xl hover:bg-muted border border-border/40 text-muted-foreground hover:text-foreground transition-colors"><ChevronRight size={18}/></button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Attendance Rate', value: `${attendanceRate}%`, icon: TrendingUp,   color: 'emerald' },
          { label: 'Total Present',   value: totalPresent,         icon: CheckCircle2, color: 'blue'    },
          { label: 'Total Absent',    value: totalAbsent,          icon: XCircle,      color: 'red'     },
          { label: 'Late Arrivals',   value: totalLate,            icon: AlertTriangle, color: 'amber'  },
        ].map(s => (
          <div key={s.label} className="glass bg-white/70 rounded-2xl border border-border/40 p-4 flex items-center gap-3 shadow-sm">
            <div className={`w-10 h-10 rounded-xl bg-${s.color}-500/10 border border-${s.color}-500/20 text-${s.color}-600 flex items-center justify-center shrink-0`}>
              <s.icon size={18}/>
            </div>
            <div>
              <p className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-widest">{s.label}</p>
              <p className="text-2xl font-black text-foreground tracking-tighter">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(STATUS_CONFIG).filter(([k]) => k !== '' && k !== 'WE').map(([key, cfg]) => (
          <div key={key} className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-black ${cfg.bg} border border-current/20`}>
            <span className="w-4 h-4 rounded flex items-center justify-center font-black text-[9px] bg-current/10">{cfg.label}</span>
            {cfg.title}
          </div>
        ))}
      </div>

      {/* Export */}
      <div className="flex justify-end">
        <button onClick={() => exportCSV(employees, allDays, attendanceMap, year, month)}
          className="flex items-center gap-2 px-5 py-2.5 bg-white border border-border/50 text-foreground rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-primary hover:text-white hover:border-primary transition-all shadow-sm active:scale-95">
          <Download size={14}/> Export CSV
        </button>
      </div>

      {/* Grid */}
      <div className="glass bg-white/70 backdrop-blur-3xl rounded-[2rem] border border-border/40 shadow-2xl shadow-primary/5 overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">{[...Array(5)].map((_,i)=><div key={i} className="h-12 bg-muted/40 rounded-xl animate-pulse"/>)}</div>
        ) : employees.length === 0 ? (
          <div className="py-20 text-center space-y-4 p-8">
            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto opacity-40"><Users size={32} className="text-muted-foreground"/></div>
            <p className="text-xl font-black text-foreground">No Active Employees</p>
            <p className="text-sm text-muted-foreground">Add employees in the directory first.</p>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="text-left" style={{ minWidth: `${Math.max(900, 160 + allDays.length*42)}px` }}>
              <thead>
                <tr className="border-b border-border/30">
                  <th className="sticky left-0 z-10 bg-[#FAF9F6] px-5 py-4 text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.2em] min-w-[160px]">Employee</th>
                  {allDays.map(d => {
                    const we = isWeekend(year, month, d);
                    const dow = ['Su','Mo','Tu','We','Th','Fr','Sa'][new Date(year,month,d).getDay()];
                    return (
                      <th key={d} className={`px-1 py-4 text-center text-[9px] font-black uppercase tracking-widest min-w-[36px] ${we ? 'text-muted-foreground/30' : 'text-muted-foreground/60'}`}>
                        <div>{d}</div><div className="text-[8px] opacity-60">{dow}</div>
                      </th>
                    );
                  })}
                  <th className="px-5 py-4 text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.2em] text-center">P</th>
                  <th className="px-3 py-4 text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.2em] text-center">A</th>
                  <th className="px-3 py-4 text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.2em] text-center">L</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp, idx) => {
                  const rec = attendanceMap[emp.id] || {};
                  let p=0, a=0, l=0;
                  return (
                    <tr key={emp.id} className={`border-b border-border/10 ${idx%2===0?'bg-white/30':'bg-white/10'} hover:bg-white/60 transition-colors`}>
                      <td className="sticky left-0 z-10 bg-inherit px-5 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 text-primary text-[9px] font-black flex items-center justify-center shrink-0">
                            {`${emp.firstName?.[0]||''}${emp.lastName?.[0]||''}`.toUpperCase()}
                          </div>
                          <div>
                            <p className="text-[11px] font-bold text-foreground whitespace-nowrap">{emp.firstName} {emp.lastName}</p>
                            <p className="text-[9px] text-muted-foreground/60 truncate max-w-[100px]">{emp.staffId || emp.department || ''}</p>
                          </div>
                        </div>
                      </td>
                      {allDays.map(d => {
                        const we = isWeekend(year, month, d);
                        const status = we ? 'WE' : (rec[d] || '');
                        const cfg = STATUS_CONFIG[status] || STATUS_CONFIG[''];
                        if (status==='P') p++; else if (status==='A') a++; else if (status==='L') l++;
                        return (
                          <td key={d} onClick={() => !we && setEditCell({ empId: emp.id, day: d })}
                            title={cfg.title} className={`px-1 py-2.5 text-center cursor-${we?'default':'pointer'} relative`}>
                            <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-[9px] font-black transition-all ${cfg.bg} ${!we?'hover:scale-110 hover:shadow-sm':''}`}>{cfg.label}</span>
                            {editCell?.empId === emp.id && editCell?.day === d && (
                              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50 bg-white rounded-2xl border border-border/60 shadow-2xl p-2 flex gap-1.5 animate-in zoom-in-90 duration-150">
                                {['P','L','A','H','LV'].map(s => {
                                  const c = STATUS_CONFIG[s];
                                  return (
                                    <button key={s} onClick={e => { e.stopPropagation(); handleStatusSelect(s); }} title={c.title}
                                      className={`w-8 h-8 rounded-lg text-[9px] font-black transition-all hover:scale-110 ${c.bg}`}>{c.label}</button>
                                  );
                                })}
                                <button onClick={e => { e.stopPropagation(); setEditCell(null); }}
                                  className="w-8 h-8 rounded-lg text-[9px] font-black bg-muted text-muted-foreground hover:bg-muted/80 transition-all">×</button>
                              </div>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-5 py-2.5 text-center text-[12px] font-black text-emerald-600">{p}</td>
                      <td className="px-3 py-2.5 text-center text-[12px] font-black text-red-600">{a}</td>
                      <td className="px-3 py-2.5 text-center text-[12px] font-black text-amber-600">{l}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {editCell && <div className="fixed inset-0 z-40" onClick={() => setEditCell(null)}/>}
    </div>
  );
};

// ── Tab: Daily Biometric View ─────────────────────────────────────────────────
const DailyTab = () => {
  const [date, setDate]       = useState(todayISO());
  const [dept, setDept]       = useState('');
  const [rows, setRows]       = useState([]);
  const [depts, setDepts]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState({ present: 0, absent: 0, flagged: 0 });

  const loadDepts = async () => {
    try {
      const res = await hrAPI.getEmployees({ limit: 500 });
      const emps = Array.isArray(res) ? res : (res?.results || []);
      const unique = [...new Set(emps.map(e => e.department).filter(Boolean))].sort();
      setDepts(unique);
    } catch {}
  };

  const loadDaily = useCallback(async () => {
    setLoading(true);
    try {
      const params = { date };
      if (dept) params.department = dept;
      const data = await hrAPI.getDailyAttendance(params);
      const results = data?.results || [];
      setRows(results);
      setSummary({
        present: results.filter(r => r.isPresent).length,
        absent:  results.filter(r => !r.isPresent).length,
        flagged: results.filter(r => r.isFlagged).length,
      });
    } catch (e) {
      toast.error('Failed to load daily attendance.');
      console.error(e);
    } finally { setLoading(false); }
  }, [date, dept]);

  useEffect(() => { loadDepts(); }, []);
  useEffect(() => { loadDaily(); }, [loadDaily]);

  const presentPct = rows.length > 0 ? Math.round((summary.present / rows.length) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="glass bg-white/70 rounded-2xl border border-border/40 p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Calendar size={15} className="text-muted-foreground"/>
          <input type="date" value={date} max={todayISO()} onChange={e => setDate(e.target.value)}
            className="text-sm font-semibold bg-transparent border-0 outline-none text-foreground cursor-pointer"/>
        </div>
        <div className="w-px h-5 bg-border/40"/>
        <div className="relative">
          <select value={dept} onChange={e => setDept(e.target.value)}
            className="pl-3 pr-8 py-1.5 rounded-xl border border-border/40 text-[12px] font-semibold bg-white appearance-none cursor-pointer text-foreground">
            <option value="">All Departments</option>
            {depts.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"/>
        </div>
        <button onClick={loadDaily} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/40 text-[11px] font-black text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''}/> Refresh
        </button>
        <div className="ml-auto">
          <button onClick={() => exportDailyCSV(rows, date)} disabled={rows.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-border/50 text-foreground rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-primary hover:text-white hover:border-primary transition-all shadow-sm active:scale-95 disabled:opacity-40">
            <Download size={13}/> Export CSV
          </button>
        </div>
      </div>

      {/* Summary pills */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700">
          <CheckCircle2 size={16}/>
          <span className="text-sm font-black">{summary.present} Present</span>
          <span className="text-xs opacity-60">({presentPct}%)</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-700">
          <XCircle size={16}/>
          <span className="text-sm font-black">{summary.absent} Absent</span>
        </div>
        {summary.flagged > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700">
            <AlertTriangle size={16}/>
            <span className="text-sm font-black">{summary.flagged} Flagged</span>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="glass bg-white/70 backdrop-blur-3xl rounded-[2rem] border border-border/40 shadow-2xl shadow-primary/5 overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">{[...Array(6)].map((_,i)=><div key={i} className="h-12 bg-muted/40 rounded-xl animate-pulse"/>)}</div>
        ) : rows.length === 0 ? (
          <div className="py-20 text-center space-y-4 p-8">
            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto opacity-40"><Fingerprint size={32} className="text-muted-foreground"/></div>
            <p className="text-xl font-black text-foreground">No Records Found</p>
            <p className="text-sm text-muted-foreground">No active employees or no punches recorded for this date.</p>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left" style={{ minWidth: '680px' }}>
              <thead>
                <tr className="border-b border-border/30">
                  <th className="px-5 py-4 text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.2em]">Staff</th>
                  <th className="px-4 py-4 text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.2em]">Department</th>
                  <th className="px-4 py-4 text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.2em] text-center">Status</th>
                  <th className="px-4 py-4 text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.2em] text-center">Check-In</th>
                  <th className="px-4 py-4 text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.2em] text-center">Check-Out</th>
                  <th className="px-4 py-4 text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.2em] text-center">Hours</th>
                  <th className="px-4 py-4 text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.2em] text-center">Punches</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr key={r.staffId} className={`border-b border-border/10 ${idx%2===0?'bg-white/30':'bg-white/10'} hover:bg-white/60 transition-colors ${r.isFlagged?'ring-1 ring-amber-400/40':''}`}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-xl text-[9px] font-black flex items-center justify-center shrink-0 border ${r.isPresent ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700' : 'bg-red-500/10 border-red-500/20 text-red-600'}`}>
                          {`${r.firstName?.[0]||''}${r.lastName?.[0]||''}`.toUpperCase()}
                        </div>
                        <div>
                          <p className="text-[12px] font-bold text-foreground whitespace-nowrap">{r.firstName} {r.lastName}{r.otherName ? ` ${r.otherName}` : ''}</p>
                          <p className="text-[9px] font-mono text-muted-foreground/60">{r.staffId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-muted-foreground whitespace-nowrap">{r.department || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      {r.isPresent ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-700 text-[10px] font-black border border-emerald-200">
                          <CheckCircle2 size={11}/> Present
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-100 text-red-700 text-[10px] font-black border border-red-200">
                          <XCircle size={11}/> Absent
                        </span>
                      )}
                      {r.isFlagged && (
                        <span className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 text-[9px] font-black border border-amber-200" title={r.flagReason}>
                          <AlertTriangle size={9}/> Flagged
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-[12px] font-mono font-semibold text-foreground">{fmtTime(r.firstPunch)}</td>
                    <td className="px-4 py-3 text-center text-[12px] font-mono font-semibold text-foreground">{fmtTime(r.lastPunch)}</td>
                    <td className="px-4 py-3 text-center text-[11px] font-semibold text-foreground">{fmtHours(r.hoursWorked)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-[10px] font-black border border-primary/20">
                        {r.punchCount}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Tab: ZKTeco Device & Sync ─────────────────────────────────────────────────
const ZKSyncTab = () => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const data = await hrAPI.getZKTecoStatus();
      setStatus(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadStatus(); }, []);

  const fmtAgo = ts => {
    if (!ts) return 'Never';
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs/24)}d ago`;
  };

  const copyToClipboard = txt => {
    navigator.clipboard.writeText(txt).then(() => toast.success('Copied!'));
  };

  return (
    <div className="space-y-5">
      {/* Live status */}
      <div className="glass bg-white/70 rounded-2xl border border-border/40 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[13px] font-black text-foreground uppercase tracking-widest">Device Status</h3>
          <button onClick={loadStatus} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/40 text-[11px] font-black text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <RefreshCw size={12} className={loading?'animate-spin':''}/> Refresh
          </button>
        </div>
        {loading ? (
          <div className="space-y-2">{[...Array(3)].map((_,i)=><div key={i} className="h-8 bg-muted/40 rounded-xl animate-pulse"/>)}</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-3 rounded-xl bg-muted/30 border border-border/30">
              <p className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-widest mb-1">Last Punch Received</p>
              <p className="text-[13px] font-black text-foreground">{fmtAgo(status?.lastPunchAt)}</p>
              {status?.lastPunchAt && <p className="text-[9px] text-muted-foreground/50 font-mono mt-0.5">{new Date(status.lastPunchAt).toLocaleString()}</p>}
            </div>
            <div className="p-3 rounded-xl bg-muted/30 border border-border/30">
              <p className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-widest mb-1">Today's Punches</p>
              <p className="text-2xl font-black text-primary">{status?.todayPunches ?? '—'}</p>
              <p className="text-[9px] text-muted-foreground/50 mt-0.5">{status?.totalPunches ?? 0} total all-time</p>
            </div>
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <p className="text-[9px] font-black text-amber-700 uppercase tracking-widest mb-1">Flagged Punches</p>
              <p className="text-2xl font-black text-amber-700">{status?.flaggedPunches ?? 0}</p>
              <p className="text-[9px] text-amber-600/70 mt-0.5">Possible conspiracy / batch</p>
            </div>
          </div>
        )}
      </div>

      {/* ADMS Setup guide */}
      <div className="glass bg-white/70 rounded-2xl border border-border/40 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary"><Wifi size={15}/></div>
          <div>
            <h3 className="text-[13px] font-black text-foreground">Option A — Cloud Push (ADMS)</h3>
            <p className="text-[11px] text-muted-foreground">Device pushes punches directly to Railway in real-time. No PC needed.</p>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <p className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest mb-1">Set on the ZKTeco device:</p>
            <div className="bg-muted/30 rounded-xl p-3 flex items-center justify-between gap-3 border border-border/30">
              <span className="text-[12px] font-mono text-foreground break-all">{status?.admsEndpoint || 'Loading…'}</span>
              <button onClick={() => status?.admsEndpoint && copyToClipboard(status.admsEndpoint)}
                className="shrink-0 px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-[10px] font-black hover:bg-primary/20 transition-colors">Copy</button>
            </div>
          </div>
          <ol className="text-[11px] text-muted-foreground space-y-1.5 list-decimal list-inside">
            <li>On device: go to <strong className="text-foreground">Comm → Cloud Server</strong> (or ADMS)</li>
            <li>Set <strong className="text-foreground">Server Address</strong> to the URL above</li>
            <li>Set <strong className="text-foreground">Port</strong> to <code className="font-mono">443</code> (HTTPS) or <code className="font-mono">80</code> (HTTP)</li>
            <li>Enable <strong className="text-foreground">Real-time Upload</strong> and save</li>
            <li>The enroll number on the device must match the <strong className="text-foreground">Staff ID</strong> in the portal</li>
          </ol>
        </div>
      </div>

      {/* Sync agent guide */}
      <div className="glass bg-white/70 rounded-2xl border border-border/40 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600"><Activity size={15}/></div>
          <div>
            <h3 className="text-[13px] font-black text-foreground">Option B — Local Sync Agent</h3>
            <p className="text-[11px] text-muted-foreground">Run a script on any PC on the same LAN as the device. Works with your phone hotspot too.</p>
          </div>
        </div>
        <div className="space-y-3">
          <div className="bg-muted/30 rounded-xl p-3 border border-border/30 space-y-2">
            <p className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest">1. Download the agent file from the project root</p>
            <code className="text-[11px] font-mono text-foreground block">zk-sync-agent.js</code>
          </div>
          <div className="bg-muted/30 rounded-xl p-3 border border-border/30 space-y-1">
            <p className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest">2. Create .env next to it</p>
            <pre className="text-[10px] font-mono text-foreground whitespace-pre-wrap">{`ZKTECO_IP=192.168.1.100
RAILWAY_API_URL=https://your-app.up.railway.app
ZKTECO_SYNC_SECRET=your-secret`}</pre>
          </div>
          <div className="bg-muted/30 rounded-xl p-3 border border-border/30 space-y-1">
            <p className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest">3. Install & run</p>
            <pre className="text-[10px] font-mono text-foreground whitespace-pre-wrap">{`npm install node-zklib dotenv

# Run once manually:
node zk-sync-agent.js

# Or auto-sync every 30 minutes:
node zk-sync-agent.js --schedule=30`}</pre>
          </div>
        </div>
      </div>

      {/* Security note */}
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-800">
        <Shield size={16} className="mt-0.5 shrink-0"/>
        <div className="text-[11px] space-y-1">
          <p className="font-black">Security tips</p>
          <ul className="space-y-0.5 text-blue-700">
            <li>• Set <code className="font-mono bg-blue-500/10 px-1 rounded">ZKTECO_SYNC_SECRET</code> in Railway env vars — the agent must use the same value</li>
            <li>• The ADMS endpoint does not require a token (ZKTeco devices cannot send auth headers), so keep your Railway URL private</li>
            <li>• Conspiracy detection flags ≥10 different staff punching within 60 seconds — review those in the Daily tab</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

// ── Root Component ────────────────────────────────────────────────────────────
const AttendanceTracker = ({ onViewChange }) => {
  const [tab, setTab] = useState('daily');

  const tabs = [
    { id: 'daily',   label: 'Daily Biometric',  icon: Fingerprint  },
    { id: 'monthly', label: 'Monthly Calendar',  icon: CalendarDays },
    { id: 'zksync',  label: 'ZKTeco / Sync',     icon: Wifi         },
  ];

  return (
    <div className="max-w-full mx-auto space-y-5 pb-20 animate-slide-up px-1">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-4xl font-black text-foreground tracking-tighter leading-tight">
          Attendance <span className="text-primary italic font-serif">Tracker</span>
        </h1>
        <p className="text-muted-foreground text-[13px] font-medium">
          Biometric punches from ZKTeco devices sync automatically — or run the agent from any PC.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 bg-muted/40 rounded-2xl p-1.5 w-fit border border-border/30">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
              tab === t.id
                ? 'bg-white text-foreground shadow-sm border border-border/40'
                : 'text-muted-foreground hover:text-foreground hover:bg-white/50'
            }`}>
            <t.icon size={13}/> {t.label}
          </button>
        ))}
      </div>

      {tab === 'daily'   && <DailyTab/>}
      {tab === 'monthly' && <MonthlyTab/>}
      {tab === 'zksync'  && <ZKSyncTab/>}
    </div>
  );
};

export default AttendanceTracker;
