const jwt = require("jsonwebtoken");
const montonioURL = process.env.MONTONIO_URL;

module.exports = {
  createPaymentURL: (payload) => {
    const payloadWithKey = {
      access_key: process.env.MONTONIO_PUBLIC,
      ...payload,
    };
    const token = jwt.sign(payloadWithKey, process.env.MONTONIO_PRIVATE, {
      algorithm: "HS256",
      expiresIn: "10m",
    });
    const URL = `${montonioURL}?payment_token=${token}`;
    return URL;
  },

  decodePaymentToken: (paymentToken) => {
    const decoded = jwt.verify(paymentToken, process.env.MONTONIO_PRIVATE);

    if (decoded.access_key === process.env.MONTONIO_PUBLIC) {
      return decoded;
    } else {
      throw "Invalid public key";
    }
  },
};
