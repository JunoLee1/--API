export interface HeadcountSnapshot {
  players: {
    own: number;
    loanIn: number;
    onLoanOut: number;
    total: number;
  };
  users: { admin: number; frontOffice: number; coachingStaff: number; total: number };
  staffRecords: { active: number };
}

export interface TransferBreakdown {
  type: string;
  count: number;
}

export interface AttendanceSummary {
  total: number;
  present: number;
  absentUnauthorized: number;
  lateUnauthorized: number;
  absentAuthorized: number;
  attendanceRate: number;
}

export interface IssueSummary {
  incidents: { type: string; count: number }[];
  totalIncidents: number;
  newInjuries: number;
  safeguardReports: number;
}

export interface HrMonthlyReport {
  period: { year: number; month: number };
  executiveSummary: {
    keyChanges: string[];
    playerHeadline: string;
  };
  headcount: HeadcountSnapshot;
  recruitment: {
    transfersIn: number;
    transfersOut: number;
    inBreakdown: TransferBreakdown[];
    outBreakdown: TransferBreakdown[];
    newContractsStarted: number;
    openCoachingRounds: number;
    openJobPostings: number;
  };
  turnover: {
    arrivals: number;
    departures: number;
    netChange: number;
    turnoverRate: number;
  };
  attendance: AttendanceSummary;
  issues: IssueSummary;
}

export interface MonthlyBreakdownRow {
  month: number;
  headcount: number;
  turnoverRate: number;
  attendanceRate: number;
  incidents: number;
}

export interface WageAnalysis {
  totalAnnualWage: number;
  avgSalary: number;
  minSalary: number;
  maxSalary: number;
  playerCount: number;
  distribution: { label: string; count: number }[];
}

export interface HrAnnualReport {
  year: number;
  kpi: {
    totalRecruitment: number;
    annualTurnoverRate: number;
    avgAttendanceRate: number;
    totalIncidents: number;
    avgHeadcount: number;
  };
  monthlyBreakdown: MonthlyBreakdownRow[];
  recruitment: { totalIn: number; totalOut: number };
  wageAnalysis: WageAnalysis;
  turnover: {
    annualRate: number;
    totalDepartures: number;
    peakMonth: number;
  };
  attendance: {
    annualRate: number;
    worstMonth: number;
    totalAbsences: number;
  };
  issues: {
    total: number;
    byType: { type: string; count: number }[];
    totalInjuries: number;
  };
}
