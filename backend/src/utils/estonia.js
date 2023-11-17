/**
 * Format a number to a valid Estonian number string.
 * @param {number} number - The number to format.
 * @return {string} - A formatted number string.
 * @example
 * formatEstonianAmount(1234.56); // "1 234,56"
 * formatEstonianAmount(1234); // "1 234"
 * formatEstonianAmount(1234.5); // "1 234,5"
 */
function formatEstonianAmount(number) {
  const withCents = formatEstonianAmountWithCents(number);
  return withCents.replace(/,00$/, "");
}

function formatEstonianAmountWithCents(number) {
  const asString = String(number);
  const [integerPart, decimalPart] = asString.split(".");
  const integerWithSpaces = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const decimal = decimalPart ? "," + decimalPart.padEnd(2, "0") : ",00";

  const estonianAmount = integerWithSpaces + decimal;
  return estonianAmount;
}

module.exports = {
  formatEstonianAmount,
  formatEstonianAmountWithCents,
};
