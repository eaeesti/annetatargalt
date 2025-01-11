export const formatNumber = (number) => {
  const asString = String(number);
  const [integerPart, decimalPart] = asString.split(".");
  const integerWithSpaces = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const number =
    integerWithSpaces + (decimalPart ? "," + decimalPart : "");
  return number;
};

export const round = (number, digits = 0) => {
  return Math.round(number * 10 ** digits) / 10 ** digits;
};

export const roundMoney = (money) => {
  if (round(money) !== Number(money)) return money.toFixed(2);
  return money.toFixed(0);
};
