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

// Sends via Resend when RESEND_API_KEY is set (see utils/email.js);
// otherwise falls back to a console log so the flow still works end to end
// in local dev without a real email account.
async function sendOtpEmail(recipientEmail, code) {
  const subject = "Your Mobiler verification code";
  const minutes = OTP_TTL_MS / 60000;
  const text = `Your Mobiler verification code is ${code}. It expires in ${minutes} minutes.`;
  // A well-formed text+html multipart message reads as more legitimate to
  // spam filters than text-only — kept plain (no external images/links,
  // no urgent language) since those are their own spam signals, especially
  // from a sender without a verified domain yet.
  const html = `
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
      <p style="font-size: 15px; margin: 0 0 16px;">Your Mobiler verification code is:</p>
      <p style="font-size: 32px; font-weight: 700; letter-spacing: 4px; margin: 0 0 16px; text-align: center; background: #f4f4f5; padding: 16px; border-radius: 8px;">${code}</p>
      <p style="font-size: 13px; color: #6b7280; margin: 0;">This code expires in ${minutes} minutes. If you didn't request this, you can ignore this email.</p>
    </div>
  `.trim();

  const result = await email.sendEmail(recipientEmail, subject, text, html);

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
