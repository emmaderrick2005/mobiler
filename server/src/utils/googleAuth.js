const { OAuth2Client } = require("google-auth-library");

let cachedClient;

function getClient() {
  if (!cachedClient) {
    cachedClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  }
  return cachedClient;
}

// Verifies a Google ID token (the `credential` returned by Google Identity
// Services on the client) and returns the verified profile, or throws if
// it's invalid/expired/for the wrong audience. No client secret needed —
// verification only requires knowing our own Client ID to check the
// token's `aud` claim, plus Google's public keys (fetched automatically).
async function verifyGoogleToken(idToken) {
  if (!process.env.GOOGLE_CLIENT_ID) {
    throw new Error("GOOGLE_CLIENT_ID is not configured");
  }
  const client = getClient();
  const ticket = await client.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload || !payload.email) {
    throw new Error("Google token did not include an email");
  }
  return {
    email: payload.email,
    emailVerified: payload.email_verified,
    name: payload.name || payload.email.split("@")[0],
    googleId: payload.sub,
  };
}

module.exports = { verifyGoogleToken };
