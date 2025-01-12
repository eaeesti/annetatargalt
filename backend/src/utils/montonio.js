const jwt = require("jsonwebtoken");
const montonioUrl = process.env.MONTONIO_URL;

const montonio = {
  fetchRedirectUrl: async (payload) => {
    const token = montonio.createOrderToken(payload);
    const url = `${montonioUrl}/orders`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: token }),
      });
      const data = await response.json();
      return data.paymentUrl;
    } catch (error) {
      throw "Failed to fetch redirect URL";
    }
  },

  createOrderToken: (payload) => {
    const payloadWithKey = {
      accessKey: process.env.MONTONIO_PUBLIC,
      ...payload,
    };
    const token = jwt.sign(payloadWithKey, process.env.MONTONIO_PRIVATE, {
      algorithm: "HS256",
      expiresIn: "10m",
    });
    return token;
  },

  decodeOrderToken: (orderToken) => {
    const decoded = jwt.verify(orderToken, process.env.MONTONIO_PRIVATE);

    if (decoded.accessKey === process.env.MONTONIO_PUBLIC) {
      return decoded;
    } else {
      throw "Invalid public key";
    }
  },
};

module.exports = montonio;
