// Thin wrapper around Twilio so the rest of the app only ever calls
// sendSms(phone, message) and doesn't care how delivery works.
let cachedClient;

function getClient() {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) return null;
  if (!cachedClient) {
    cachedClient = require("twilio")(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
  }
  return cachedClient;
}

// Twilio needs E.164 (+<country><number>). Local numbers in this app are
// entered like "0700000001"; default the country code to Uganda (256)
// since the seed data and demo accounts are Kampala-based.
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
  if (!process.env.TWILIO_FROM_NUMBER) {
    return { sent: false, reason: "TWILIO_FROM_NUMBER not configured" };
  }
  try {
    const to = normalizePhone(phone);
    const response = await client.messages.create({
      to,
      from: process.env.TWILIO_FROM_NUMBER,
      body: message,
    });
    return { sent: true, response: { sid: response.sid, status: response.status } };
  } catch (err) {
    return { sent: false, reason: err.message };
  }
}

module.exports = { sendSms, normalizePhone };
