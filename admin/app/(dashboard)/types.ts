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
