const nodemailer = require("nodemailer");

// Thin wrapper around nodemailer so the rest of the app only ever calls
// sendEmail(to, subject, text) and doesn't care which SMTP provider is
// behind it (Gmail, Resend, SendGrid, Mailgun, etc. all speak SMTP).
let cachedTransporter;

function getTransporter() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return cachedTransporter;
}

async function sendEmail(to, subject, text) {
  const transporter = getTransporter();
  if (!transporter) {
    return { sent: false, reason: "no-provider-configured" };
  }
  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
    });
    return { sent: true, response: { messageId: info.messageId } };
  } catch (err) {
    return { sent: false, reason: err.message };
  }
}

module.exports = { sendEmail };
