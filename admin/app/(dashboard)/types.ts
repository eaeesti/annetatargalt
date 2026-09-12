export type PeriodStats = {
  total: number;
  count: number;
};

export type DashboardStats = {
  totalDonations: { count: number; sum: number };
  totalDonors: number;
  activeDonors: number;
  mrr: number;
  periods: {
    currentMonth: { current: PeriodStats; prior: PeriodStats; from: string };
    lastMonth: { current: PeriodStats; prior: PeriodStats; from: string };
    currentQuarter: { current: PeriodStats; prior: PeriodStats; from: string };
    lastQuarter: { current: PeriodStats; prior: PeriodStats; from: string };
    currentYear: { current: PeriodStats; prior: PeriodStats; from: string };
    lastYear: { current: PeriodStats; prior: PeriodStats; from: string };
  };
};

export type MonthlyTotalsRow = {
  month: string;
  total: number;
  count: number;
  avgAmount: number;
};

export type ActiveDonorsRow = {
  month: string;
  activeDonors: number;
};

export type RecurringChurnRow = {
  month: string;
  active: number;
  newDonors: number;
  churned: number;
};

export type DashboardCharts = {
  monthlyTotals: MonthlyTotalsRow[];
  activeDonorsPerMonth: ActiveDonorsRow[];
  recurringChurn: RecurringChurnRow[];
};
