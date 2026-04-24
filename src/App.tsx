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
  AlertCircle,
  Trash2,
  ChevronUp,
  ChevronDown,
  GripVertical
} from 'lucide-react';
import { motion, AnimatePresence, Reorder } from 'motion/react';
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
  const [employees, setEmployees] = useState<Employee[]>(() => {
    const saved = localStorage.getItem('planner_employees_v5');
    if (saved) return JSON.parse(saved);
    return HARDCODED_EMPLOYEES;
  });

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
    localStorage.setItem('planner_employees_v5', JSON.stringify(employees));
  }, [employees]);

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
    const initial = employees.map(emp => {
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
    // The goal is to hit the EXACT store target regardless of planned vs budgeted hours
    const totalHours = initial.reduce((s, e) => s + e.planned_hours, 0);
    
    // We anchor to the absolute targets entered in the top grid
    const targetTotalAsr = targets.asr;
    const targetTotalAsrs = targets.asr_s;
    const targetTotalApf = targets.apf;
    const targetTotalObrat = targets.obrat;
    const targetTotalCct = targets.cct;
    
    const currentTotalAsr = initial.reduce((s, e) => s + (e.baseAsr * e.correctionScale), 0);
    const asrGap = targetTotalAsr - currentTotalAsr;

    const currentTotalAsrs = initial.reduce((s, e) => s + (e.baseAsrS * e.correctionScale), 0);
    const asrsGap = targetTotalAsrs - currentTotalAsrs;

    const currentTotalApf = initial.reduce((s, e) => s + (e.baseApf * e.correctionScale), 0);
    const apfGap = targetTotalApf - currentTotalApf;

    const currentTotalObrat = initial.reduce((s, e) => s + (e.baseObrat * e.correctionScale), 0);
    const obratGap = targetTotalObrat - currentTotalObrat;

    const currentTotalCct = initial.reduce((s, e) => s + (e.baseCct * e.correctionScale), 0);
    const cctGap = targetTotalCct - currentTotalCct;

    // Find "Prodejce" (or targeted roles) who will absorb the gap
    const asrReceivers = initial.filter(e => (e.role === 'STL' || e.role === 'Prodejce') && e.shares.asr > 0);
    const asrGapPerReceiver = asrReceivers.length > 0 ? (asrGap / asrReceivers.length) : 0;

    const asrsReceivers = initial.filter(e => (e.role === 'STL' || e.role === 'Prodejce') && e.shares.asr_s > 0);
    const asrsGapPerReceiver = asrsReceivers.length > 0 ? (asrsGap / asrsReceivers.length) : 0;

    const apfReceivers = initial.filter(e => (e.role === 'STL' || e.role === 'Prodejce') && e.shares.apf > 0);
    const apfGapPerReceiver = apfReceivers.length > 0 ? (apfGap / apfReceivers.length) : 0;

    // Stage 3: Final distribution and rounding
    const result = initial.map((emp): EmployeeTarget => {
      const receivesAsrGap = (emp.role === 'STL' || emp.role === 'Prodejce') && emp.shares.asr > 0;
      const receivesAsrsGap = (emp.role === 'STL' || emp.role === 'Prodejce') && emp.shares.asr_s > 0;
      const receivesApfGap = (emp.role === 'STL' || emp.role === 'Prodejce') && emp.shares.apf > 0;
      
      let indAsr = (emp.baseAsr * emp.correctionScale) + (receivesAsrGap ? asrGapPerReceiver : 0);
      let indAsrS = (emp.baseAsrS * emp.correctionScale) + (receivesAsrsGap ? asrsGapPerReceiver : 0);
      let indApf = (emp.baseApf * emp.correctionScale) + (receivesApfGap ? apfGapPerReceiver : 0);
      let indObrat = (emp.baseObrat * emp.correctionScale) + (receivesAsrGap ? (obratGap / asrReceivers.length) : 0);
      let indCct = (emp.baseCct * emp.correctionScale) + (receivesAsrGap ? (cctGap / asrReceivers.length) : 0);

      // Strict Enforcement: 0% share = 0 target
      if (emp.shares.asr === 0) indAsr = 0;
      if (emp.shares.asr_s === 0) indAsrS = 0;
      if (emp.shares.apf === 0) indApf = 0;
      if (emp.shares.asr === 0) {
        indObrat = 0;
        indCct = 0;
      }

      return {
        ...emp,
        obrat: Math.round(indObrat),
        asr: Math.round(indAsr),
        asr_s: Math.round(indAsrS),
        apf: Math.round(indApf),
        cct: Math.round(indCct),
        ars: indAsr > 0 ? (indAsrS / indAsr) * 100 : 0,
        obrat_hod: emp.planned_hours > 0 ? Math.round(indObrat / emp.planned_hours) : 0,
        asr_hod: emp.planned_hours > 0 ? Math.round(indAsr / emp.planned_hours) : 0,
        asrs_hod: emp.planned_hours > 0 ? Math.round(indAsrS / emp.planned_hours) : 0,
        share_obrat: emp.shares.asr,
        share_asr: emp.shares.asr,
      };
    });

    // Final reconciliation to ensure the sum of rounded values exactly matches the target
    const applyReconciliation = (arr: EmployeeTarget[], field: 'asr' | 'asr_s' | 'apf' | 'obrat', targetVal: number) => {
      const currentSum = arr.reduce((s, e) => s + e[field], 0);
      const diff = Math.round(targetVal) - currentSum;
      if (diff !== 0) {
        // Apportion to the first receiver with non-zero share or anyone targeted
        const shareField = field === 'obrat' ? 'asr' : (field === 'asr' ? 'asr' : field === 'asr_s' ? 'asr_s' : 'apf');
        let targetInd = arr.findIndex(e => 
          (e.role.toUpperCase() === 'STL' || e.role.toUpperCase() === 'PRODEJCE') && 
          (e.shares[shareField] > 0)
        );
        
        // Fallback to any active employee if no prodejce/STL found
        if (targetInd === -1) {
          targetInd = arr.findIndex(e => e.shares[shareField] > 0);
        }
        
        if (targetInd !== -1) {
          arr[targetInd][field] += diff;
          // Recalculate derived efficiencies for this specific employee
          if (arr[targetInd].planned_hours > 0) {
            if (field === 'asr') arr[targetInd].asr_hod = Math.round(arr[targetInd].asr / arr[targetInd].planned_hours);
            if (field === 'asr_s') arr[targetInd].asrs_hod = Math.round(arr[targetInd].asr_s / arr[targetInd].planned_hours);
            if (field === 'obrat') arr[targetInd].obrat_hod = Math.round(arr[targetInd].obrat / arr[targetInd].planned_hours);
          }
        }
      }
    };

    applyReconciliation(result, 'asr', targets.asr);
    applyReconciliation(result, 'asr_s', targets.asr_s);
    applyReconciliation(result, 'apf', targets.apf);
    applyReconciliation(result, 'obrat', targets.obrat);

    return result;
  }, [targets, employees, employeePlannedHours, employeeStandardHours, employeeShares]);

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

  const handleEmployeeUpdate = (id: string, field: keyof Employee, value: string) => {
    setEmployees(prev => prev.map(emp => 
      emp.id === id ? { ...emp, [field]: value } : emp
    ));
  };

  const handleAddEmployee = () => {
    const newId = crypto.randomUUID();
    setEmployees(prev => [...prev, {
      id: newId,
      name: 'Nový člen',
      role: 'Prodejce',
      standard_hours: 160
    }]);
    // Initialize standard hours for the new member
    setEmployeeStandardHours(prev => ({ ...prev, [newId]: 160 }));
  };

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleDeleteEmployee = (id: string) => {
    if (deleteConfirmId === id) {
      setEmployees(prev => prev.filter(emp => emp.id !== id));
      setDeleteConfirmId(null);
    } else {
      setDeleteConfirmId(id);
      // Auto cancel after 3 seconds
      setTimeout(() => setDeleteConfirmId(prev => prev === id ? null : prev), 3000);
    }
  };

  const handleReorder = (newOrder: Employee[]) => {
    setEmployees(newOrder);
  };

  const footerTotals = useMemo(() => {
    const all = calculatedTargets;
    // For averages, only include people who are actually planned to work (hours > 0)
    // and specifically include STL, Prodejce, Skladník, Brigádník if they have hours > 0
    const activeForAverage = all.filter(e => e.planned_hours > 0);
    
    return {
      asr: all.reduce((s, e) => s + (e.asr || 0), 0),
      asr_s: all.reduce((s, e) => s + (e.asr_s || 0), 0),
      apf: all.reduce((s, e) => s + (e.apf || 0), 0),
      asr_hod: activeForAverage.length > 0 ? activeForAverage.reduce((s, e) => s + e.asr_hod, 0) / activeForAverage.length : 0,
      asrs_hod: activeForAverage.length > 0 ? activeForAverage.reduce((s, e) => s + e.asrs_hod, 0) / activeForAverage.length : 0,
    };
  }, [calculatedTargets]);

  const totalPlannedObrat = calculatedTargets.reduce((s, e) => s + e.obrat, 0);
  const totalPlannedAsr = calculatedTargets.reduce((s, e) => s + e.asr, 0);
  const totalHours = calculatedTargets.reduce((s, e) => s + e.planned_hours, 0);

  const totalAsrShare = employees.reduce((s, e) => s + (employeeShares[e.id]?.asr || 0), 0);
  const totalAsrsShare = employees.reduce((s, e) => s + (employeeShares[e.id]?.asr_s || 0), 0);
  const totalApfShare = employees.reduce((s, e) => s + (employeeShares[e.id]?.apf || 0), 0);

  return (
    <div className="min-h-screen flex flex-col bg-bg text-text-main font-sans">
      {/* Header */}
      <header className="bg-white px-6 py-4 border-b border-border flex justify-between items-center shrink-0">
        <div className="text-xl font-extrabold text-accent tracking-tight uppercase">
          CÍLE POBOČKY
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
            <div className="flex items-center gap-4">
              <div className="text-xs text-text-muted font-medium">
                Celkem naplánováno: {totalHours.toFixed(1)} / {targets.hodiny} h
              </div>
              <button 
                onClick={handleAddEmployee}
                className="px-3 py-1.5 rounded-md bg-blue-50 text-accent text-xs font-bold hover:bg-blue-100 transition-colors flex items-center gap-1.5 border border-blue-100"
              >
                + Přidat člena
              </button>
            </div>
          </div>
          
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 border-b border-border">
                  <th className="w-8 px-2"></th>
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
                  <th className="px-5 py-3 w-10"></th>
                </tr>
              </thead>
              <Reorder.Group 
                as="tbody" 
                axis="y" 
                values={employees} 
                onReorder={handleReorder}
              >
                {calculatedTargets.map((emp, index) => {
                  const isTargeted = emp.role === 'STL' || emp.role === 'Prodejce';
                  const sourceEmp = employees.find(e => e.id === emp.id)!;
                  const isDeleting = deleteConfirmId === emp.id;
                  
                  return (
                    <Reorder.Item 
                      as="tr" 
                      key={emp.id} 
                      value={sourceEmp}
                      className={cn(
                        "border-b border-slate-100 transition-colors group relative",
                        !isTargeted ? "bg-slate-50/50 text-text-muted" : "bg-white hover:bg-slate-50"
                      )}
                    >
                      <td className="px-2 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500">
                        <GripVertical size={16} />
                      </td>
                      <td className="px-5 py-3">
                        <input 
                          type="text" 
                          value={emp.name}
                          onChange={(e) => handleEmployeeUpdate(emp.id, 'name', e.target.value)}
                          className={cn(
                            "w-full bg-transparent border-none outline-none font-bold focus:ring-0 p-0",
                            !isTargeted && "text-text-muted"
                          )}
                        />
                      </td>
                      <td className="px-5 py-3">
                        <select 
                          value={emp.role}
                          onChange={(e) => handleEmployeeUpdate(emp.id, 'role', e.target.value)}
                          className={cn(
                            "appearance-none bg-transparent border-none outline-none text-[10px] font-bold uppercase tracking-wider p-0 pr-2 focus:ring-0 cursor-pointer",
                            emp.role === 'STL' ? "text-purple-800" :
                            emp.role === 'Prodejce' ? "text-blue-800" :
                            "text-slate-600"
                          )}
                        >
                          <option value="STL">STL</option>
                          <option value="Prodejce">Prodejce</option>
                          <option value="Skladník">Skladník</option>
                          <option value="Brigádník">Brigádník</option>
                        </select>
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
                      <td className="px-2 py-3">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                          <button 
                            onClick={() => handleDeleteEmployee(emp.id)}
                            className={cn(
                              "p-1.5 rounded transition-all flex items-center gap-1",
                              isDeleting 
                                ? "bg-red-500 text-white px-2 text-[10px] font-bold" 
                                : "hover:bg-red-50 text-red-300 hover:text-red-500"
                            )}
                            title={isDeleting ? "Klikněte znovu pro smazání" : "Smazat člena"}
                          >
                            {isDeleting ? "SMAZAT?" : <Trash2 size={14} />}
                          </button>
                        </div>
                      </td>
                    </Reorder.Item>
                  );
                })}
              </Reorder.Group>
              <tfoot className="sticky bottom-0 bg-white border-t-2 border-slate-200 z-10 shadow-[0_-2px_6px_rgba(0,0,0,0.05)]">
                <tr className="font-bold text-text-main divide-x divide-slate-100">
                  <td colSpan={8} className="px-5 py-3 text-right text-text-muted uppercase text-[10px] tracking-wider bg-slate-50/50">
                    Kontrolní součty / průměry
                  </td>
                  <td className="px-5 py-3 text-right text-accent whitespace-nowrap bg-blue-50/20">
                    {footerTotals.asr.toLocaleString('cs-CZ')}
                  </td>
                  <td className="px-5 py-3 text-right text-blue-600 whitespace-nowrap">
                    {footerTotals.asr_s.toLocaleString('cs-CZ')}
                  </td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    {footerTotals.apf.toLocaleString('cs-CZ')}
                  </td>
                  <td className="px-5 py-3 text-right text-success whitespace-nowrap bg-green-50/10">
                    {Math.round(footerTotals.asr_hod).toLocaleString('cs-CZ')} Kč
                  </td>
                  <td className="px-5 py-3 text-right text-amber-500 whitespace-nowrap bg-amber-50/10">
                    {Math.round(footerTotals.asrs_hod).toLocaleString('cs-CZ')} Kč
                  </td>
                  <td className="bg-slate-50/50"></td>
                </tr>
              </tfoot>
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
          Naplánované hodiny: <strong className={cn(totalHours <= targets.hodiny ? "text-success" : "text-red-400")}>{totalHours.toFixed(1)} h</strong>
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
