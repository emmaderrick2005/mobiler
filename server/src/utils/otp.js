const bcrypt = require("bcryptjs");
const sms = require("./sms");

const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function hashCode(code) {
  return bcrypt.hash(code, 10);
}

function compareCode(code, codeHash) {
  return bcrypt.compare(code, codeHash);
}

// Codes are only ever echoed back in API responses (or logged in full) when
// explicitly opted into via ENABLE_DEV_OTP=true. Defaults closed so a
// deploy that forgets to set NODE_ENV doesn't leak verification codes.
function devCodeEnabled() {
  return process.env.ENABLE_DEV_OTP === "true" && process.env.NODE_ENV !== "production";
}

// Sends via Africa's Talking when AT_USERNAME/AT_API_KEY are set (see
// utils/sms.js); otherwise falls back to a console log so the flow still
// works end to end in local dev without a real SMS account.
async function sendOtpSms(phone, code) {
  const message = `Your Cash Delivery verification code is ${code}. It expires in ${
    OTP_TTL_MS / 60000
  } minutes.`;

  const result = await sms.sendSms(phone, message);

  if (!result.sent) {
    if (devCodeEnabled()) {
      console.log(`[OTP] (no SMS provider) code ${code} for ${phone}`);
    } else {
      console.warn(`[OTP] SMS not sent to ${phone}: ${result.reason}`);
    }
  }

  return result;
}

module.exports = {
  OTP_TTL_MS,
  RESEND_COOLDOWN_MS,
  MAX_ATTEMPTS,
  generateCode,
  hashCode,
  compareCode,
  sendOtpSms,
  devCodeEnabled,
};
