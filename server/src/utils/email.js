const { Resend } = require("resend");

// Thin wrapper around Resend so the rest of the app only ever calls
// sendEmail(to, subject, text) without caring how delivery works.
//
// Uses Resend's HTTPS API rather than raw SMTP: Render (and several other
// PaaS hosts) block or silently drop outbound SMTP connections on ports
// 587/465 to prevent their shared infrastructure being used to spam-relay,
// which caused every SMTP send attempt to hang or fail with a connection
// timeout. An HTTPS API call goes over port 443, the same port our own app
// already uses for everything else, so it isn't subject to that block.
let cachedClient;

function getClient() {
  if (!process.env.RESEND_API_KEY) return null;
  if (!cachedClient) {
    cachedClient = new Resend(process.env.RESEND_API_KEY);
  }
  return cachedClient;
}

// html is optional — Resend (and most inbox spam filters) score a
// well-formed multipart email (text + html) more favorably than a
// text-only one from an unfamiliar sender, though a verified custom
// domain remains the biggest lever we don't have yet.
async function sendEmail(to, subject, text, html) {
  const client = getClient();
  if (!client) {
    return { sent: false, reason: "no-provider-configured" };
  }
  try {
    const { data, error } = await client.emails.send({
      // Resend's shared address for accounts without a verified sending
      // domain — can only deliver to the email the Resend account itself
      // was created with until a custom domain is verified.
      from: process.env.RESEND_FROM || "Mobiler <onboarding@resend.dev>",
      to,
      subject,
      text,
      ...(html ? { html } : {}),
    });
    if (error) {
      return { sent: false, reason: error.message || String(error) };
    }
    return { sent: true, response: { messageId: data?.id } };
  } catch (err) {
    return { sent: false, reason: err.message };
  }
}

module.exports = { sendEmail };
