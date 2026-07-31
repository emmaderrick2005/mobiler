const bcrypt = require("bcryptjs");

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

// No SMS provider is configured for this project, so "sending" just logs to
// the server console. Swap this out for a real provider (e.g. Twilio,
// Africa's Talking) when one is wired up.
function sendOtpSms(phone, code) {
  console.log(`[OTP] Sending code ${code} to ${phone} (expires in ${OTP_TTL_MS / 1000}s)`);
}

module.exports = {
  OTP_TTL_MS,
  RESEND_COOLDOWN_MS,
  MAX_ATTEMPTS,
  generateCode,
  hashCode,
  compareCode,
  sendOtpSms,
};
