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
    days30: { current: PeriodStats; prior: PeriodStats };
    days90: { current: PeriodStats; prior: PeriodStats };
    days365: { current: PeriodStats; prior: PeriodStats };
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
