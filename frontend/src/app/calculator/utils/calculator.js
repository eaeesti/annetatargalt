// https://github.com/owid/notebooks/blob/main/PabloArriagada/global_distribution_giving_what_we_can/pip_global_percentiles.csv
import PIP_GLOBAL_PERCENTILES from "../data/pip_global_percentiles.json";

import { range } from "./utils";

// https://github.com/owid/notebooks/blob/main/PabloArriagada/global_distribution_giving_what_we_can/wdi_ppp.csv
const ESTONIA_PPP = 0.7982072518265738;

const DAYS_PER_YEAR = 365.2425;
const DAYS_PER_MONTH = DAYS_PER_YEAR / 12;

const interpolate = (x, x0, x1, y0, y1) => {
  return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
};

export const monthlyToYearly = (monthlyIncome) => monthlyIncome * 12;

export const monthlyToDaily = (monthlyIncome) => monthlyIncome / DAYS_PER_MONTH;

export const dailyToMonthly = (dailyIncome) => dailyIncome * DAYS_PER_MONTH;

export const internationalizeIncome = (incomeEUR) => incomeEUR / ESTONIA_PPP;

export const getPercentile = (dailyIncomeIUSD) => {
  const smaller_percentile = PIP_GLOBAL_PERCENTILES.findLast(
    (percentile) => percentile.daily_household_income <= dailyIncomeIUSD
  );
  const greater_percentile = PIP_GLOBAL_PERCENTILES.find(
    (percentile) => percentile.daily_household_income >= dailyIncomeIUSD
  );

  if (!greater_percentile) {
    return smaller_percentile.percentile;
  }

  if (!smaller_percentile) {
    return greater_percentile.percentile;
  }

  if (smaller_percentile.percentile === greater_percentile.percentile) {
    return smaller_percentile.percentile;
  }

  const interpolated_percentile = interpolate(
    dailyIncomeIUSD,
    smaller_percentile.daily_household_income,
    greater_percentile.daily_household_income,
    smaller_percentile.percentile,
    greater_percentile.percentile
  );

  return interpolated_percentile;
};

export const getIncome = (percentile) => {
  const smallerIncome = PIP_GLOBAL_PERCENTILES.findLast(
    (p) => p.percentile <= percentile
  );
  const greaterIncome = PIP_GLOBAL_PERCENTILES.find(
    (p) => p.percentile >= percentile
  );

  if (!greaterIncome) {
    return smallerIncome.daily_household_income;
  }

  if (!smallerIncome) {
    return greaterIncome.daily_household_income;
  }

  if (smallerIncome.percentile === greaterIncome.percentile) {
    return smallerIncome.daily_household_income;
  }

  const interpolatedIncome = interpolate(
    percentile,
    smallerIncome.percentile,
    greaterIncome.percentile,
    smallerIncome.daily_household_income,
    greaterIncome.daily_household_income
  );

  return interpolatedIncome;
};

// https://github.com/centre-for-effective-altruism/how-rich-am-i/blob/master/src/lib/calculate/index.js
export const getEstonianIncomePercentile = (monthlyIncomeEUR) => {
  const dailyIncomeEUR = monthlyToDaily(monthlyIncomeEUR);
  const internationalizedDailyIncomeIUSD =
    internationalizeIncome(dailyIncomeEUR);
  const percentile = getPercentile(internationalizedDailyIncomeIUSD);
  return percentile;
};

export const getHistogramData = () => {
  return range(1, 100).map((percentage) => ({
    percentage,
    international_dollars: getIncome(percentage),
  }));
  // return INCOME_CENTILES;
};

const equivalizationFactor = (adults, children) => {
  const equivalizedAdults = !adults ? 0 : 0.3 + adults * 0.7;
  const equivalizedChildren = children * 0.5;
  return equivalizedAdults + equivalizedChildren;
};

export const equivalizeIncome = (income, adults = 0, children = 0) => {
  return income / equivalizationFactor(adults, children);
};
