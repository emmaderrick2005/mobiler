const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../prisma");
const otp = require("../utils/otp");
const { validatePassword } = require("../utils/password");
const { verifyGoogleToken } = require("../utils/googleAuth");
const crypto = require("crypto");

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

async function issueOtp(userId, recipientEmail) {
  const code = otp.generateCode();
  const codeHash = await otp.hashCode(code);
  await prisma.phoneOtp.create({
    data: {
      userId,
      codeHash,
      expiresAt: new Date(Date.now() + otp.OTP_TTL_MS),
    },
  });
  // Fire-and-forget: a slow or failing email provider shouldn't block the
  // register/login/forgot-password response the user is waiting on.
  otp.sendOtpEmail(recipientEmail, code).catch((err) => {
    console.error("[OTP] sendOtpEmail rejected unexpectedly", err);
  });
  // Hand the code back to the client only when explicitly opted into (see
  // otp.devCodeEnabled) — lets the flow be tested without a real email
  // account, without leaking codes once deployed for real users.
  return otp.devCodeEnabled() ? code : undefined;
}

async function checkResendCooldown(userId) {
  const last = await prisma.phoneOtp.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  if (last && Date.now() - last.createdAt.getTime() < otp.RESEND_COOLDOWN_MS) {
    const retryAfter = Math.ceil(
      (otp.RESEND_COOLDOWN_MS - (Date.now() - last.createdAt.getTime())) / 1000
    );
    return { error: "Please wait before requesting another code", retryAfter };
  }
  return null;
}

// Validates the latest unconsumed OTP for a user against a submitted code.
// On success, marks it consumed and returns the record; on failure, returns
// { status, error } describing what went wrong (and bumps attempts when the
// code itself was simply wrong).
async function consumeOtp(userId, code) {
  const record = await prisma.phoneOtp.findFirst({
    where: { userId, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!record) {
    return { status: 400, error: "No pending code. Request a new one." };
  }
  if (record.expiresAt < new Date()) {
    return { status: 400, error: "Code has expired. Request a new one." };
  }
  if (record.attempts >= otp.MAX_ATTEMPTS) {
    return { status: 429, error: "Too many attempts. Request a new code." };
  }

  const valid = await otp.compareCode(String(code).trim(), record.codeHash);
  if (!valid) {
    await prisma.phoneOtp.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    return { status: 401, error: "Incorrect code" };
  }

  await prisma.phoneOtp.update({ where: { id: record.id }, data: { consumedAt: new Date() } });
  return { record };
}

router.post("/register", async (req, res) => {
  const { name, email, phone, password, role } = req.body;

  if (!name || !email || !phone || !password || !role) {
    return res.status(400).json({ error: "All fields are required" });
  }
  if (!["CUSTOMER", "AGENT"].includes(role)) {
    return res.status(400).json({ error: "role must be CUSTOMER or AGENT" });
  }
  const passwordError = validatePassword(password);
  if (passwordError) {
    return res.status(400).json({ error: passwordError });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: "Email already registered" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { name, email, phone, passwordHash, role, phoneVerified: false },
  });

  if (role === "AGENT") {
    await prisma.agentProfile.create({
      data: {
        userId: user.id,
        lat: 0,
        lng: 0,
        radiusKm: 5,
        cashOnHand: 0,
        airtelFloat: 0,
        mtnFloat: 0,
        isOnline: false,
      },
    });
  }

  const devCode = await issueOtp(user.id, user.email);
  res.status(201).json({
    requiresOtp: true,
    userId: user.id,
    email: user.email,
    ...(devCode ? { devCode } : {}),
  });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: "Invalid credentials" });

  if (!user.phoneVerified) {
    const devCode = await issueOtp(user.id, user.email);
    return res.status(403).json({
      error: "Email not verified",
      requiresOtp: true,
      userId: user.id,
      email: user.email,
      ...(devCode ? { devCode } : {}),
    });
  }

  const token = signToken(user);
  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
});

router.post("/verify-otp", async (req, res) => {
  const { userId, code } = req.body;
  if (!userId || !code) {
    return res.status(400).json({ error: "userId and code are required" });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(404).json({ error: "User not found" });

  const result = await consumeOtp(userId, code);
  if (result.error) return res.status(result.status).json({ error: result.error });

  await prisma.user.update({ where: { id: user.id }, data: { phoneVerified: true } });

  const token = signToken(user);
  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
});

router.post("/resend-otp", async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "userId is required" });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(404).json({ error: "User not found" });
  if (user.phoneVerified) {
    return res.status(409).json({ error: "Email is already verified" });
  }

  const cooldown = await checkResendCooldown(userId);
  if (cooldown) return res.status(429).json(cooldown);

  const devCode = await issueOtp(user.id, user.email);
  res.json({ requiresOtp: true, userId: user.id, email: user.email, ...(devCode ? { devCode } : {}) });
});

router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "email is required" });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(404).json({ error: "No account with that email" });

  const cooldown = await checkResendCooldown(user.id);
  if (cooldown) return res.status(429).json(cooldown);

  const devCode = await issueOtp(user.id, user.email);
  res.json({ requiresOtp: true, userId: user.id, email: user.email, ...(devCode ? { devCode } : {}) });
});

router.post("/reset-password", async (req, res) => {
  const { userId, code, newPassword } = req.body;
  if (!userId || !code || !newPassword) {
    return res.status(400).json({ error: "userId, code, and newPassword are required" });
  }
  const passwordError = validatePassword(newPassword);
  if (passwordError) {
    return res.status(400).json({ error: passwordError });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(404).json({ error: "User not found" });

  const result = await consumeOtp(userId, code);
  if (result.error) return res.status(result.status).json({ error: result.error });

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, phoneVerified: true },
  });

  const token = signToken(user);
  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
});

// Google sign-in, step 1: verify the ID token from Google Identity
// Services. Existing accounts log straight in. New accounts can't be
// created yet — Google doesn't hand us a phone number or a role
// (customer/agent), so the client collects those next and calls
// /google/complete with the same credential.
router.post("/google", async (req, res) => {
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ error: "credential is required" });

  let profile;
  try {
    profile = await verifyGoogleToken(credential);
  } catch (err) {
    return res.status(401).json({ error: "Invalid Google credential" });
  }

  const user = await prisma.user.findUnique({ where: { email: profile.email } });
  if (!user) {
    return res.json({ needsProfile: true, email: profile.email, name: profile.name });
  }

  // Google already proved they control this inbox — at least as strong a
  // signal as our own OTP, so don't force existing-but-unverified accounts
  // through that flow too.
  if (!user.phoneVerified) {
    await prisma.user.update({ where: { id: user.id }, data: { phoneVerified: true } });
  }

  const token = signToken(user);
  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
});

// Google sign-in, step 2: only reached for accounts /google didn't find.
// Re-verifies the same credential rather than trusting client-supplied
// email/name, then creates the account with the phone/role collected in
// between.
router.post("/google/complete", async (req, res) => {
  const { credential, phone, role } = req.body;
  if (!credential || !phone || !role) {
    return res.status(400).json({ error: "credential, phone, and role are required" });
  }
  if (!["CUSTOMER", "AGENT"].includes(role)) {
    return res.status(400).json({ error: "role must be CUSTOMER or AGENT" });
  }

  let profile;
  try {
    profile = await verifyGoogleToken(credential);
  } catch (err) {
    return res.status(401).json({ error: "Invalid Google credential" });
  }

  const existing = await prisma.user.findUnique({ where: { email: profile.email } });
  if (existing) {
    return res.status(409).json({ error: "Email already registered" });
  }

  // Google accounts don't set a password — generate an unusable one so the
  // column stays satisfied; they can set a real one later via forgot
  // password if they ever want email+password login too.
  const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10);
  const user = await prisma.user.create({
    data: {
      name: profile.name,
      email: profile.email,
      phone,
      passwordHash,
      role,
      phoneVerified: true,
    },
  });

  if (role === "AGENT") {
    await prisma.agentProfile.create({
      data: {
        userId: user.id,
        lat: 0,
        lng: 0,
        radiusKm: 5,
        cashOnHand: 0,
        airtelFloat: 0,
        mtnFloat: 0,
        isOnline: false,
      },
    });
  }

  const token = signToken(user);
  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
});

module.exports = router;
