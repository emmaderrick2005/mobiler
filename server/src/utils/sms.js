// Thin wrapper around Africa's Talking so the rest of the app only ever
// calls sendSms(phone, message) and doesn't care how delivery works.
let cachedClient;

function getClient() {
  if (!process.env.AT_USERNAME || !process.env.AT_API_KEY) return null;
  if (!cachedClient) {
    cachedClient = require("africastalking")({
      username: process.env.AT_USERNAME,
      apiKey: process.env.AT_API_KEY,
    });
  }
  return cachedClient;
}

// Africa's Talking needs E.164 (+<country><number>). Local numbers in this
// app are entered like "0700000001"; default the country code to Uganda
// (256) since the seed data and demo accounts are Kampala-based.
function normalizePhone(phone) {
  const trimmed = phone.replace(/[\s-]/g, "");
  if (trimmed.startsWith("+")) return trimmed;
  const countryCode = process.env.SMS_DEFAULT_COUNTRY_CODE || "256";
  return `+${countryCode}${trimmed.replace(/^0+/, "")}`;
}

async function sendSms(phone, message) {
  const client = getClient();
  if (!client) {
    return { sent: false, reason: "no-provider-configured" };
  }
  try {
    const to = normalizePhone(phone);
    const response = await client.SMS.send({ to: [to], message });
    return { sent: true, response };
  } catch (err) {
    return { sent: false, reason: err.message };
  }
}

module.exports = { sendSms, normalizePhone };
