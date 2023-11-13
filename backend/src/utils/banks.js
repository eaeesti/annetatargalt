const { urlWithParams } = require("./string");

function createRecurringPaymentLink(bank, paymentInfo, amount) {
  let baseUrl;
  let params;

  if (bank === "swedbank") {
    baseUrl =
      "https://www.swedbank.ee/private/d2d/payments2/standing_order/new";
    params = {
      "standingOrder.beneficiaryAccountNumber": paymentInfo.iban,
      "standingOrder.beneficiaryName": paymentInfo.recipient,
      "standingOrder.amount": amount,
      "standingOrder.details": paymentInfo.description,
    };
  } else if (bank === "lhv") {
    baseUrl = "https://www.lhv.ee/portfolio/payment_standing_add.cfm";
    params = {
      i_receiver_name: paymentInfo.recipient,
      i_receiver_account_no: paymentInfo.iban,
      i_payment_desc: paymentInfo.description,
      i_amount: amount,
    };
  } else if (bank === "seb") {
    baseUrl = "https://e.seb.ee/ip/ipank";
    params = {
      UID: "b889b482-f137-45b9-aa61-f4a67f0649c7",
      act: "ADDSOSMARTPAYM",
      lang: "EST",
      field1: "benname",
      value1: paymentInfo.recipient,
      field3: "benacc",
      value3: paymentInfo.iban,
      field10: "desc",
      value10: paymentInfo.description,
      field11: "refid",
      value11: "",
      field5: "amount",
      value5: amount,
      sofield1: "frequency",
      sovalue1: 3,
      paymtype: "REMSEBEE",
      field6: "currency",
      value6: "EUR",
      sofield2: "startdt",
      sofield3: "enddt",
      sovalue4: "CIF",
      sofield4: "paymtype",
    };
  } else if (bank === "coop") {
    const redirectUrl = "https://i.cooppank.ee/permpmtnew";
    baseUrl = "https://i.cooppank.ee/sso/";
    params = {
      return: urlWithParams(redirectUrl, {
        SaajaKonto: paymentInfo.iban,
        SaajaNimi: paymentInfo.recipient,
        MaksePohjus: paymentInfo.description,
        Vaaring: "EUR",
        MakseSumma: amount,
      }),
    };
  } else {
    throw new Error("Unknown bank");
  }

  return urlWithParams(baseUrl, params);
}

module.exports = {
  createRecurringPaymentLink,
};
