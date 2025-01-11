const baseURL = "https://theforexapi.com/api";

// 2022-11-24
const defaults = {
  USD: {
    EUR: 0.9603380389897245,
    JPY: 138.19264381062135,
    BGN: 1.878229136656103,
    CZK: 23.42456544703736,
    DKK: 7.1419379621626815,
    GBP: 0.82524728704504,
    HUF: 396.9365216556228,
    PLN: 4.509555363487949,
    RON: 4.725343320848939,
    SEK: 10.426678190723136,
    CHF: 0.9428598866801114,
    ISK: 140.68952271199464,
    NOK: 9.933256506290215,
    HRK: 7.24767118025545,
    TRY: 18.627580908479786,
    AUD: 1.4802650532987613,
    BRL: 5.330260251608567,
    CAD: 1.3342936713723232,
    CNY: 7.148948429847307,
    HKD: 7.809853068280036,
    IDR: 15649.044463651207,
    INR: 81.65706328627678,
    KRW: 1327.4560645347162,
    MXN: 19.350907519446846,
    MYR: 4.494958225295305,
    NZD: 1.5939690771151447,
    PHP: 56.65226159608182,
    SGD: 1.3751080380293865,
    THB: 35.780274656679154,
    ZAR: 17.021607605877268,
  },
  EUR: {
    USD: 1.0413,
    JPY: 143.9,
    BGN: 1.9558,
    CZK: 24.392,
    DKK: 7.4369,
    GBP: 0.85933,
    HUF: 413.33,
    PLN: 4.6958,
    RON: 4.9205,
    SEK: 10.8573,
    CHF: 0.9818,
    ISK: 146.5,
    NOK: 10.3435,
    HRK: 7.547,
    TRY: 19.3969,
    AUD: 1.5414,
    BRL: 5.5504,
    CAD: 1.3894,
    CNY: 7.4442,
    HKD: 8.1324,
    IDR: 16295.35,
    INR: 85.0295,
    KRW: 1382.28,
    MXN: 20.1501,
    MYR: 4.6806,
    NZD: 1.6598,
    PHP: 58.992,
    SGD: 1.4319,
    THB: 37.258,
    ZAR: 17.7246,
  },
};

export const fetchRate = async (base, to) => {
  const requestURL = `${baseURL}/latest?base=${base}&symbols=${to}`;
  const response = await fetch(requestURL);
  const data = response.json();
  return data.rates[to];
};

export const convert = (amount, base, to) => {
  const rate = fetchRate(base, to);
  return rate * amount;
};
