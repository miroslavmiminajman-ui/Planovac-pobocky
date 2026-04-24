import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { 
  Download, 
  Users, 
  Store, 
  Calculator, 
  TrendingUp,
  Clock,
  Target,
  Mail,
  Percent,
  Briefcase,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { StoreTargets, Employee, EmployeeShares, EmployeeTarget } from './types';

const INITIAL_TARGETS: StoreTargets = {
  obrat: 0,
  asr: 0,
  asr_s: 0,
  hodiny: 0,
  ars: 0,
  obrat_hod: 0,
  cct: 0,
  asr_hod: 0,
  nps: 0,
  apf: 0,
};

const HARDCODED_EMPLOYEES: Employee[] = [
  { id: '1', name: 'Miroslav Najman', role: 'STL', standard_hours: 160 },
  { id: '2', name: 'Kristýna Valentová', role: 'STL', standard_hours: 160 },
  { id: '3', name: 'Kris Vrážel', role: 'Prodejce', standard_hours: 160 },
  { id: '4', name: 'Richard Pospíšil', role: 'Prodejce', standard_hours: 160 },
  { id: '5', name: 'Lukáš Marek', role: 'Prodejce', standard_hours: 160 },
  { id: '6', name: 'Dan Pitro', role: 'Prodejce', standard_hours: 160 },
  { id: '7', name: 'David Venclíček', role: 'Prodejce', standard_hours: 160 },
  { id: '8', name: 'Tomáš Grulich', role: 'Skladník', standard_hours: 160 },
  { id: '9', name: 'Tomáš Kvapil', role: 'Skladník', standard_hours: 160 },
  { id: '10', name: 'Brigádníci', role: 'Brigádník', standard_hours: 160 },
];

export default function App() {
  const [targets, setTargets] = useState<StoreTargets>(() => {
    const saved = localStorage.getItem('planner_targets_v4');
    return saved ? JSON.parse(saved) : INITIAL_TARGETS;
  });

  const [employeePlannedHours, setEmployeePlannedHours] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('planner_employee_hours_v4');
    return saved ? JSON.parse(saved) : {};
  });

  const [employeeStandardHours, setEmployeeStandardHours] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('planner_std_hours_v4');
    if (saved) return JSON.parse(saved);
    const defaults: Record<string, number> = {};
    HARDCODED_EMPLOYEES.forEach(e => { defaults[e.id] = e.standard_hours || 160; });
    return defaults;
  });

  const [employeeShares, setEmployeeShares] = useState<Record<string, EmployeeShares>>(() => {
    const saved = localStorage.getItem('planner_employee_shares_v4');
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    localStorage.setItem('planner_targets_v4', JSON.stringify(targets));
  }, [targets]);

  useEffect(() => {
    localStorage.setItem('planner_employee_hours_v4', JSON.stringify(employeePlannedHours));
  }, [employeePlannedHours]);

  useEffect(() => {
    localStorage.setItem('planner_std_hours_v4', JSON.stringify(employeeStandardHours));
  }, [employeeStandardHours]);

  useEffect(() => {
    localStorage.setItem('planner_employee_shares_v4', JSON.stringify(employeeShares));
  }, [employeeShares]);

  const calculatedTargets = useMemo(() => {
    // Stage 1: Initial targets with sick/vacation correction
    const initial = HARDCODED_EMPLOYEES.map(emp => {
      const shares = employeeShares[emp.id] || { asr: 0, asr_s: 0, apf: 0 };
      const plannedHours = employeePlannedHours[emp.id] || 0;
      const stdHours = employeeStandardHours[emp.id] || 160;
      const isTargeted = emp.role === 'STL' || emp.role === 'Prodejce';
      
      // If planned hours < standard hours (sick/vacation), targets are downscaled
      const correctionScale = stdHours > 0 ? (Math.min(plannedHours, stdHours) / stdHours) : 1;

      return {
        ...emp,
        baseAsr: isTargeted ? (targets.asr * (shares.asr / 100)) : 0,
        baseAsrS: isTargeted ? (targets.asr_s * (shares.asr_s / 100)) : 0,
        baseApf: isTargeted ? (targets.apf * (shares.apf / 100)) : 0,
        baseObrat: isTargeted ? (targets.obrat * (shares.asr / 100)) : 0,
        baseCct: isTargeted ? (targets.cct * (shares.asr / 100)) : 0,
        correctionScale,
        planned_hours: plannedHours,
        standard_hours: stdHours,
        shares
      };
    });

    // Stage 2: Calculate the "Lost Opportunity" (Gap)
    // The goal is to ensure: sum(individual_targets) / total_planned_hours = targets.asr_hod
    const totalHours = initial.reduce((s, e) => s + e.planned_hours, 0);
    const targetTotalAsr = targets.asr_hod * totalHours;
    
    const currentTotalAsr = initial.reduce((s, e) => s + (e.baseAsr * e.correctionScale), 0);
    // Gap can be positive (increase targets) or negative (decrease if over-efficient) to reach the exact efficiency
    const asrGap = targetTotalAsr - currentTotalAsr;

    const currentTotalAsrs = initial.reduce((s, e) => s + (e.baseAsrS * e.correctionScale), 0);
    // For ASRs, we still anchor to the absolute targets.asr_s as per current UI inputs
    const asrsGap = Math.max(0, targets.asr_s - currentTotalAsrs);

    // Find "Prodejce" who will absorb the gap
    // Condition: role must be 'Prodejce' AND share must be > 0 (to honor 0% = 0 rule)
    const asrReceivers = initial.filter(e => e.role === 'Prodejce' && e.shares.asr > 0);
    const asrGapPerReceiver = asrReceivers.length > 0 ? (asrGap / asrReceivers.length) : 0;

    const asrsReceivers = initial.filter(e => e.role === 'Prodejce' && e.shares.asr_s > 0);
    const asrsGapPerReceiver = asrsReceivers.length > 0 ? (asrsGap / asrsReceivers.length) : 0;

    // Stage 3: Final distribution and rounding
    return initial.map((emp): EmployeeTarget => {
      const receivesAsrGap = emp.role === 'Prodejce' && emp.shares.asr > 0;
      const receivesAsrsGap = emp.role === 'Prodejce' && emp.shares.asr_s > 0;
      
      // Initial calculated value BEFORE rounding
      let indAsr = (emp.baseAsr * emp.correctionScale) + (receivesAsrGap ? asrGapPerReceiver : 0);
      let indAsrS = (emp.baseAsrS * emp.correctionScale) + (receivesAsrsGap ? asrsGapPerReceiver : 0);
      let indApf = emp.baseApf * emp.correctionScale;
      let indObrat = emp.baseObrat * emp.correctionScale;
      let indCct = emp.baseCct * emp.correctionScale;

      // Strict Enforcement: 0% share = 0 target
      if (emp.shares.asr === 0) indAsr = 0;
      if (emp.shares.asr_s === 0) indAsrS = 0;
      if (emp.shares.apf === 0) indApf = 0;
      // Note: Obrat and CCT use ASR share as fallback in this implementation
      if (emp.shares.asr === 0) {
        indObrat = 0;
        indCct = 0;
      }

      return {
        ...emp,
        obrat: Math.ceil(indObrat),
        asr: Math.ceil(indAsr),
        asr_s: Math.ceil(indAsrS),
        apf: Math.ceil(indApf),
        cct: Math.ceil(indCct),
        ars: indAsr > 0 ? (indAsrS / indAsr) * 100 : 0,
        obrat_hod: emp.planned_hours > 0 ? Math.ceil(indObrat / emp.planned_hours) : 0,
        asr_hod: emp.planned_hours > 0 ? Math.ceil(indAsr / emp.planned_hours) : 0,
        asrs_hod: emp.planned_hours > 0 ? Math.ceil(indAsrS / emp.planned_hours) : 0,
        share_obrat: emp.shares.asr,
        share_asr: emp.shares.asr,
      };
    });
  }, [targets, employeePlannedHours, employeeStandardHours, employeeShares]);

  const handleTargetChange = (field: keyof StoreTargets, value: string) => {
    const numVal = parseFloat(value) || 0;
    setTargets(prev => {
      const next = { ...prev, [field]: numVal };
      
      // Update derived values based on user requirements
      // ASRS is a ratio of total turnover (Obrat) based on ARS %
      next.asr_s = Math.ceil(next.obrat * (next.ars / 100));
      
      // Maintain the relationship between ASR, Hodiny, and ASR/hod
      if (field === 'asr' || field === 'hodiny') {
        next.asr_hod = next.hodiny > 0 ? (next.asr / next.hodiny) : 0;
      } else if (field === 'asr_hod') {
        // If user sets efficiency directly, we could update total ASR or just keep it as master.
        // For this app, let's update total ASR to keep state consistent.
        next.asr = next.asr_hod * next.hodiny;
      }

      if (field === 'obrat' || field === 'hodiny') {
        next.obrat_hod = next.hodiny > 0 ? (next.obrat / next.hodiny) : 0;
      } else if (field === 'obrat_hod') {
        next.obrat = next.obrat_hod * next.hodiny;
      }
      
      return next;
    });
  };

  const handlePlannedHoursChange = (id: string, value: string) => {
    setEmployeePlannedHours(prev => ({ ...prev, [id]: parseFloat(value) || 0 }));
  };

  const handleShareChange = (id: string, field: keyof EmployeeShares, value: string) => {
    setEmployeeShares(prev => ({
      ...prev,
      [id]: {
        ...(prev[id] || { asr: 0, asr_s: 0, apf: 0 }),
        [field]: parseFloat(value) || 0
      }
    }));
  };

  const handleStdHoursChange = (id: string, value: string) => {
    setEmployeeStandardHours(prev => ({ ...prev, [id]: parseFloat(value) || 0 }));
  };

  const totalPlannedObrat = calculatedTargets.reduce((s, e) => s + e.obrat, 0);
  const totalPlannedAsr = calculatedTargets.reduce((s, e) => s + e.asr, 0);
  const totalHours = calculatedTargets.reduce((s, e) => s + e.planned_hours, 0);

  const totalAsrShare = HARDCODED_EMPLOYEES.reduce((s, e) => s + (employeeShares[e.id]?.asr || 0), 0);
  const totalAsrsShare = HARDCODED_EMPLOYEES.reduce((s, e) => s + (employeeShares[e.id]?.asr_s || 0), 0);
  const totalApfShare = HARDCODED_EMPLOYEES.reduce((s, e) => s + (employeeShares[e.id]?.apf || 0), 0);

  return (
    <div className="min-h-screen flex flex-col bg-bg text-text-main font-sans">
      {/* Header */}
      <header className="bg-white px-6 py-4 border-b border-border flex justify-between items-center shrink-0">
        <div className="text-xl font-extrabold text-accent tracking-tight uppercase">
          Planner // Prodejna
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-6 text-sm font-medium text-text-muted">
            <div className="flex items-center gap-2">
              <div className={cn("w-2 h-2 rounded-full", totalAsrShare >= 100 ? "bg-success" : "bg-red-500")} />
              ASR: {totalAsrShare.toFixed(1)}%
            </div>
            <div className="flex items-center gap-2">
              <div className={cn("w-2 h-2 rounded-full", totalAsrsShare >= 100 ? "bg-success" : "bg-red-500")} />
              ASRs: {totalAsrsShare.toFixed(1)}%
            </div>
            <div className="flex items-center gap-2">
              <div className={cn("w-2 h-2 rounded-full", totalApfShare >= 100 ? "bg-success" : "bg-red-500")} />
              ApF: {totalApfShare.toFixed(1)}%
            </div>
          </div>
          <button 
            onClick={() => exportToExcel(calculatedTargets)}
            className="px-4 py-2 rounded-md bg-accent text-white text-sm font-semibold hover:bg-blue-700 transition-all"
          >
            Exportovat plán
          </button>
        </div>
      </header>

      <main className="flex-1 p-5 flex flex-col gap-5 overflow-hidden">
        {/* Targets Grid */}
        <section className="grid grid-cols-5 gap-3 shrink-0">
          <MetricInput 
            label="Celkový Obrat (CZK)" 
            value={targets.obrat} 
            onChange={(v) => handleTargetChange('obrat', v)} 
          />
          <MetricInput 
            label="Final Asist Revenue (ASR)" 
            value={targets.asr} 
            onChange={(v) => handleTargetChange('asr', v)} 
          />
          <MetricInput 
            label="ARs (%)" 
            value={targets.ars} 
            onChange={(v) => handleTargetChange('ars', v)} 
            suffix="%"
          />
          <MetricInput 
            label="Asist revenue services (ASRs)" 
            value={targets.asr_s} 
            readOnly
          />
          <MetricInput 
            label="Plán hodin" 
            value={targets.hodiny} 
            onChange={(v) => handleTargetChange('hodiny', v)} 
            suffix="h"
          />
          
          <MetricInput 
            label="Obrat / hod" 
            value={targets.obrat_hod} 
            readOnly
            suffix="Kč"
          />
          <MetricInput 
            label="ASR / hod" 
            value={targets.asr_hod} 
            onChange={(v) => handleTargetChange('asr_hod', v)}
            suffix="Kč"
            round
          />
          <MetricInput 
            label="CCT (E-maily)" 
            value={targets.cct} 
            onChange={(v) => handleTargetChange('cct', v)} 
          />
          <MetricInput 
            label="ApF (Firmy)" 
            value={targets.apf} 
            onChange={(v) => handleTargetChange('apf', v)} 
          />
          <MetricInput 
            label="Cíl NPS" 
            value={targets.nps} 
            onChange={(v) => handleTargetChange('nps', v)} 
          />
        </section>

        {/* Team Table Section */}
        <section className="flex-1 bg-white rounded-xl border border-border flex flex-col overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-border bg-slate-50 flex justify-between items-center">
            <h2 className="text-base font-bold flex items-center gap-2">
              <Users size={18} className="text-accent" />
              Plánování týmu
            </h2>
            <div className="text-xs text-text-muted font-medium">
              Celkem naplánováno: {totalHours.toFixed(1)} / {targets.hodiny} h
            </div>
          </div>
          
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 border-b border-border">
                  <th className="px-5 py-3 font-semibold text-text-muted">Člen týmu</th>
                  <th className="px-5 py-3 font-semibold text-text-muted">Role</th>
                  <th className="px-5 py-2 font-semibold text-text-muted text-center bg-blue-50/50">Podíl<br/>ASR %</th>
                  <th className="px-5 py-2 font-semibold text-text-muted text-center bg-blue-50/50">Podíl<br/>ASRs %</th>
                  <th className="px-5 py-2 font-semibold text-text-muted text-center bg-blue-50/50">Podíl<br/>ApF %</th>
                  <th className="px-5 py-3 font-semibold text-text-muted text-right">Smluvní h.</th>
                  <th className="px-5 py-3 font-semibold text-text-muted text-right">Plán. h.</th>
                  <th className="px-5 py-3 font-semibold text-text-muted text-right font-bold text-accent">Cíl ASR</th>
                  <th className="px-5 py-3 font-semibold text-text-muted text-right text-blue-600 font-bold">Cíl ASRs</th>
                  <th className="px-5 py-3 font-semibold text-text-muted text-right font-bold">Cíl ApF</th>
                  <th className="px-5 py-3 font-semibold text-text-muted text-right text-success font-bold">ASR/hod</th>
                  <th className="px-5 py-3 font-semibold text-text-muted text-right text-amber-500 font-bold">ASRs/hod</th>
                </tr>
              </thead>
              <tbody>
                {calculatedTargets.map((emp) => {
                  const isTargeted = emp.role === 'STL' || emp.role === 'Prodejce';
                  return (
                    <tr 
                      key={emp.id}
                      className={cn(
                        "border-b border-slate-100 transition-colors",
                        !isTargeted ? "bg-slate-50/50 text-text-muted" : "bg-white hover:bg-slate-50"
                      )}
                    >
                      <td className="px-5 py-3 font-bold">{emp.name}</td>
                      <td className="px-5 py-3">
                        <span className={cn(
                          "px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                          emp.role === 'STL' ? "bg-purple-100 text-purple-800" :
                          emp.role === 'Prodejce' ? "bg-blue-100 text-blue-800" :
                          "bg-slate-100 text-slate-600"
                        )}>
                          {emp.role}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-center bg-blue-50/30">
                        {isTargeted ? (
                          <input 
                            type="number" 
                            value={employeeShares[emp.id]?.asr || ''} 
                            onChange={(e) => handleShareChange(emp.id, 'asr', e.target.value)}
                            placeholder="0"
                            className="w-14 px-2 py-1 rounded border border-border text-center focus:ring-2 focus:ring-accent/20 outline-none font-medium text-xs"
                          />
                        ) : '-'}
                      </td>
                      <td className="px-5 py-3 text-center bg-blue-50/30">
                        {isTargeted ? (
                          <input 
                            type="number" 
                            value={employeeShares[emp.id]?.asr_s || ''} 
                            onChange={(e) => handleShareChange(emp.id, 'asr_s', e.target.value)}
                            placeholder="0"
                            className="w-14 px-2 py-1 rounded border border-border text-center focus:ring-2 focus:ring-accent/20 outline-none font-medium text-xs"
                          />
                        ) : '-'}
                      </td>
                      <td className="px-5 py-3 text-center bg-blue-50/30">
                        {isTargeted ? (
                          <input 
                            type="number" 
                            value={employeeShares[emp.id]?.apf || ''} 
                            onChange={(e) => handleShareChange(emp.id, 'apf', e.target.value)}
                            placeholder="0"
                            className="w-14 px-2 py-1 rounded border border-border text-center focus:ring-2 focus:ring-accent/20 outline-none font-medium text-xs"
                          />
                        ) : '-'}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <input 
                          type="number" 
                          value={employeeStandardHours[emp.id] || ''} 
                          onChange={(e) => handleStdHoursChange(emp.id, e.target.value)}
                          placeholder="0"
                          className="w-14 px-2 py-1 rounded border border-border text-right focus:ring-2 focus:ring-accent/20 outline-none text-xs bg-slate-50"
                        />
                      </td>
                      <td className="px-5 py-3 text-right">
                        <input 
                          type="number" 
                          value={employeePlannedHours[emp.id] || ''} 
                          onChange={(e) => handlePlannedHoursChange(emp.id, e.target.value)}
                          placeholder="0"
                          className="w-14 px-2 py-1 rounded border border-border text-right focus:ring-2 focus:ring-accent/20 outline-none text-xs"
                        />
                      </td>
                      <td className="px-5 py-3 text-right font-bold text-accent whitespace-nowrap">
                        {isTargeted ? Math.ceil(emp.asr).toLocaleString('cs-CZ') : '-'}
                      </td>
                      <td className="px-5 py-3 text-right font-bold text-blue-600 whitespace-nowrap">
                        {isTargeted ? Math.ceil(emp.asr_s).toLocaleString('cs-CZ') : '-'}
                      </td>
                      <td className="px-5 py-3 text-right font-bold whitespace-nowrap">
                        {isTargeted ? Math.ceil(emp.apf).toLocaleString('cs-CZ') : '-'}
                      </td>
                      <td className="px-5 py-3 text-right font-bold text-success whitespace-nowrap">
                        {isTargeted ? `${Math.ceil(emp.asr_hod).toLocaleString('cs-CZ')} Kč` : '-'}
                      </td>
                      <td className="px-5 py-3 text-right font-bold text-amber-500 whitespace-nowrap">
                        {isTargeted ? `${Math.ceil(emp.asrs_hod).toLocaleString('cs-CZ')} Kč` : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* Summary Bar */}
      <footer className="bg-sidebar text-white px-6 py-3 flex justify-around text-sm shrink-0">
        <div className="flex items-center gap-2">
          Rozdělené ASR: <strong className="text-success">{totalPlannedAsr.toLocaleString('cs-CZ')} Kč</strong>
        </div>
        <div className="flex items-center gap-2">
          Naplánované hodiny: <strong className="text-secondary">{totalHours.toFixed(1)} h</strong>
        </div>
        <div className="flex items-center gap-2">
          Skutečný ASR/hod: <strong className="text-success">
            {(totalHours > 0 ? Math.round(totalPlannedAsr / totalHours) : 0).toLocaleString('cs-CZ')} Kč
          </strong>
        </div>
        <div className="flex items-center gap-2">
          Status ASR: <strong className={cn(totalAsrShare >= 100 ? "text-success" : "text-red-400")}>
            {totalAsrShare >= 100 ? "Podíly OK" : "Zkontrolujte podíly"}
          </strong>
        </div>
      </footer>
    </div>
  );
}

function MetricInput({ label, value, onChange, readOnly, suffix, round }: { 
  label: string, 
  value: number, 
  onChange?: (v: string) => void,
  readOnly?: boolean,
  suffix?: string,
  round?: boolean
}) {
  const displayValue = value === 0 ? '' : (
    (round || readOnly) 
      ? Math.round(value) 
      : (value % 1 === 0 ? value : value.toFixed(2))
  );

  return (
    <div className={cn("p-3 px-4 rounded-lg border border-border shadow-sm", readOnly ? "bg-slate-50" : "bg-white")}>
      <span className="text-[11px] uppercase text-text-muted font-bold tracking-wider block mb-1">{label}</span>
      <div className="flex items-baseline gap-1">
        <input 
          type="number" 
          value={displayValue} 
          onChange={(e) => onChange?.(e.target.value)}
          placeholder="0"
          readOnly={readOnly}
          className={cn(
            "w-full bg-transparent text-lg font-bold outline-none",
            readOnly ? "text-text-main" : "text-accent"
          )}
        />
        {suffix && <span className="text-sm font-bold text-text-muted">{suffix}</span>}
      </div>
    </div>
  );
}

function exportToExcel(data: EmployeeTarget[]) {
  const worksheet = XLSX.utils.json_to_sheet(data.map(emp => ({
    'Jméno': emp.name,
    'Pozice': emp.role,
    'Podíl ASR %': emp.shares.asr,
    'Podíl ASRs %': emp.shares.asr_s,
    'Podíl ApF %': emp.shares.apf,
    'Smluvní h.': emp.standard_hours,
    'Plán h.': emp.planned_hours,
    'Cíl ASR': Math.ceil(emp.asr),
    'Cíl ASRs': Math.ceil(emp.asr_s),
    'Cíl ApF': Math.ceil(emp.apf),
    'ASR/hod': Math.ceil(emp.asr_hod),
    'ASRs/hod': Math.ceil(emp.asrs_hod),
  })));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Plan");
  XLSX.writeFile(workbook, "Plan_Prodejny_Manual.xlsx");
}
