const express = require("express");
const prisma = require("../prisma");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

function serializeProfile(profile) {
  const { nationalIdPath, traderLicensePath, faceScanPath, ...rest } = profile;
  return rest;
}

// Get my agent profile
router.get("/me", requireAuth, requireRole("AGENT"), async (req, res) => {
  const profile = await prisma.agentProfile.findUnique({
    where: { userId: req.user.id },
  });
  res.json(serializeProfile(profile));
});

// Update location, radius, cash/float balances, online status
router.patch("/me", requireAuth, requireRole("AGENT"), async (req, res) => {
  const { lat, lng, radiusKm, cashOnHand, airtelFloat, mtnFloat, isOnline } = req.body;

  const current = await prisma.agentProfile.findUnique({ where: { userId: req.user.id } });
  if (isOnline && current.verificationStatus !== "VERIFIED") {
    return res.status(403).json({ error: "You must be verified before going online" });
  }

  const data = {};
  if (lat !== undefined) data.lat = Number(lat);
  if (lng !== undefined) data.lng = Number(lng);
  if (radiusKm !== undefined) data.radiusKm = Number(radiusKm);
  if (cashOnHand !== undefined) data.cashOnHand = Number(cashOnHand);
  if (airtelFloat !== undefined) data.airtelFloat = Number(airtelFloat);
  if (mtnFloat !== undefined) data.mtnFloat = Number(mtnFloat);
  if (isOnline !== undefined) data.isOnline = Boolean(isOnline);

  const profile = await prisma.agentProfile.update({
    where: { userId: req.user.id },
    data,
  });
  res.json(serializeProfile(profile));
});

module.exports = router;
