const bcrypt = require("bcryptjs");
const email = require("./email");

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

// Sends via SMTP when SMTP_HOST/SMTP_USER/SMTP_PASS are set (see
// utils/email.js); otherwise falls back to a console log so the flow still
// works end to end in local dev without a real email account.
async function sendOtpEmail(recipientEmail, code) {
  const subject = "Your Mobiler verification code";
  const text = `Your Mobiler verification code is ${code}. It expires in ${
    OTP_TTL_MS / 60000
  } minutes.`;

  const result = await email.sendEmail(recipientEmail, subject, text);

  if (result.sent) {
    console.log(`[OTP] Email sent to ${recipientEmail} (messageId: ${result.response?.messageId})`);
  } else if (devCodeEnabled()) {
    console.log(`[OTP] (no email provider) code ${code} for ${recipientEmail}`);
  } else {
    console.warn(`[OTP] Email not sent to ${recipientEmail}: ${result.reason}`);
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
  sendOtpEmail,
  devCodeEnabled,
};
