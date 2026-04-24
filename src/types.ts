export interface StoreTargets {
  obrat: number;
  asr: number;
  asr_s: number; // Service Asist Revenue
  hodiny: number;
  ars: number;   // Calculated or input ratio
  obrat_hod: number;
  cct: number;
  asr_hod: number;
  nps: number;
  apf: number;
}

export interface Employee {
  id: string;
  name: string;
  role: 'STL' | 'Prodejce' | 'Skladník' | 'Brigádník';
  standard_hours?: number;
}

export interface EmployeeShares {
  asr: number;   // percentage 0-100
  asr_s: number; // percentage 0-100
  apf: number;   // percentage 0-100
}

export interface EmployeeTarget extends Employee {
  obrat: number;
  asr: number;
  asr_s: number;
  planned_hours: number;
  ars: number;
  obrat_hod: number;
  cct: number;
  asr_hod: number;
  asrs_hod: number;
  apf: number;
  share_obrat: number;
  share_asr: number;
}
