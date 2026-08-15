const nodemailer = require("nodemailer");
const dns = require("dns").promises;

// Thin wrapper around nodemailer so the rest of the app only ever calls
// sendEmail(to, subject, text) and doesn't care which SMTP provider is
// behind it (Gmail, Resend, SendGrid, Mailgun, etc. all speak SMTP).

// Some hosts (Render included) resolve providers like Gmail's SMTP to an
// IPv6 address they can't actually route to, failing with ENETUNREACH.
// Neither dns.setDefaultResultOrder("ipv4first") nor a `family: 4` option
// reliably stops nodemailer's underlying socket from trying it anyway, so
// resolve to a literal IPv4 address ourselves and connect to that instead
// — `tls.servername` keeps TLS certificate validation working against the
// real hostname even though we're dialing an IP.
async function resolveIPv4(hostname) {
  try {
    const addresses = await dns.resolve4(hostname);
    return addresses[0];
  } catch {
    return hostname;
  }
}

function configured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

async function buildTransporter() {
  const host = await resolveIPv4(process.env.SMTP_HOST);
  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      servername: process.env.SMTP_HOST,
    },
  });
}

async function sendEmail(to, subject, text) {
  if (!configured()) {
    return { sent: false, reason: "no-provider-configured" };
  }
  try {
    // Resolved fresh per send (cheap relative to the SMTP handshake itself)
    // so a stale cached IP can't cause failures if the provider rotates.
    const transporter = await buildTransporter();
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
