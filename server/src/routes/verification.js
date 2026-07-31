const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const prisma = require("../prisma");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

const UPLOADS_ROOT = path.join(__dirname, "..", "..", "uploads", "verification");

const DOCUMENT_FIELDS = {
  nationalId: "nationalIdPath",
  traderLicense: "traderLicensePath",
  mobileMoneyLicense: "mobileMoneyLicensePath",
  faceScan: "faceScanPath",
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(UPLOADS_ROOT, req.agentProfileId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `${file.fieldname}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image uploads are allowed"));
    }
    cb(null, true);
  },
});

// Resolve the agent's own profile id before multer needs it for the destination path.
async function attachOwnAgentProfileId(req, res, next) {
  const profile = await prisma.agentProfile.findUnique({ where: { userId: req.user.id } });
  if (!profile) return res.status(404).json({ error: "Agent profile not found" });
  req.agentProfileId = profile.id;
  req.agentProfile = profile;
  next();
}

function serializeVerification(profile) {
  return {
    verificationStatus: profile.verificationStatus,
    nationalIdNumber: profile.nationalIdNumber,
    submittedAt: profile.submittedAt,
    reviewedAt: profile.reviewedAt,
    rejectionReason: profile.rejectionReason,
    hasNationalId: !!profile.nationalIdPath,
    hasTraderLicense: !!profile.traderLicensePath,
    hasMobileMoneyLicense: !!profile.mobileMoneyLicensePath,
    hasFaceScan: !!profile.faceScanPath,
  };
}

router.get("/me", requireAuth, requireRole("AGENT"), attachOwnAgentProfileId, async (req, res) => {
  res.json(serializeVerification(req.agentProfile));
});

router.post(
  "/",
  requireAuth,
  requireRole("AGENT"),
  attachOwnAgentProfileId,
  (req, res, next) => {
    if (["PENDING", "VERIFIED"].includes(req.agentProfile.verificationStatus)) {
      return res.status(409).json({
        error:
          req.agentProfile.verificationStatus === "PENDING"
            ? "Your documents are already awaiting review"
            : "You are already verified",
      });
    }
    next();
  },
  upload.fields([
    { name: "nationalId", maxCount: 1 },
    { name: "traderLicense", maxCount: 1 },
    { name: "mobileMoneyLicense", maxCount: 1 },
    { name: "faceScan", maxCount: 1 },
  ]),
  async (req, res) => {
    const files = req.files || {};
    const nationalIdNumber = req.body.nationalIdNumber?.trim();

    if (!files.nationalId || !files.traderLicense || !files.mobileMoneyLicense || !files.faceScan) {
      return res.status(400).json({
        error: "National ID, trader license, mobile money license, and a face scan are all required",
      });
    }
    if (!nationalIdNumber) {
      return res.status(400).json({ error: "National ID number is required" });
    }

    try {
      const updated = await prisma.agentProfile.update({
        where: { id: req.agentProfileId },
        data: {
          nationalIdNumber,
          nationalIdPath: files.nationalId[0].path,
          traderLicensePath: files.traderLicense[0].path,
          mobileMoneyLicensePath: files.mobileMoneyLicense[0].path,
          faceScanPath: files.faceScan[0].path,
          verificationStatus: "PENDING",
          submittedAt: new Date(),
          reviewedAt: null,
          rejectionReason: null,
        },
      });
      res.status(201).json(serializeVerification(updated));
    } catch (err) {
      if (err.code === "P2002") {
        return res.status(409).json({
          error: "This national ID number is already registered to another agent",
        });
      }
      throw err;
    }
  }
);

// --- Admin review ---

router.get("/admin/pending", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const profiles = await prisma.agentProfile.findMany({
    where: { verificationStatus: "PENDING" },
    include: { user: true },
    orderBy: { submittedAt: "asc" },
  });
  res.json(
    profiles.map((p) => ({
      agentProfileId: p.id,
      name: p.user.name,
      email: p.user.email,
      phone: p.user.phone,
      nationalIdNumber: p.nationalIdNumber,
      submittedAt: p.submittedAt,
    }))
  );
});

const DOCUMENT_TYPES = Object.keys(DOCUMENT_FIELDS);

router.get(
  "/admin/:agentProfileId/document/:type",
  requireAuth,
  requireRole("ADMIN"),
  async (req, res) => {
    const { agentProfileId, type } = req.params;
    if (!DOCUMENT_TYPES.includes(type)) {
      return res.status(400).json({ error: "Unknown document type" });
    }
    const profile = await prisma.agentProfile.findUnique({ where: { id: agentProfileId } });
    const filePath = profile?.[DOCUMENT_FIELDS[type]];
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Document not found" });
    }
    res.sendFile(path.resolve(filePath));
  }
);

router.post(
  "/admin/:agentProfileId/approve",
  requireAuth,
  requireRole("ADMIN"),
  async (req, res) => {
    const updated = await prisma.agentProfile.update({
      where: { id: req.params.agentProfileId },
      data: { verificationStatus: "VERIFIED", reviewedAt: new Date(), rejectionReason: null },
    });
    res.json(serializeVerification(updated));
  }
);

router.post(
  "/admin/:agentProfileId/reject",
  requireAuth,
  requireRole("ADMIN"),
  async (req, res) => {
    const { reason } = req.body;
    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: "A rejection reason is required" });
    }
    const updated = await prisma.agentProfile.update({
      where: { id: req.params.agentProfileId },
      data: {
        verificationStatus: "REJECTED",
        reviewedAt: new Date(),
        rejectionReason: reason.trim(),
        isOnline: false,
      },
    });
    res.json(serializeVerification(updated));
  }
);

module.exports = router;
