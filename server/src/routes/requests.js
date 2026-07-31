const express = require("express");
const prisma = require("../prisma");
const { requireAuth, requireRole } = require("../middleware/auth");
const matching = require("../services/matching");

const router = express.Router();

function handleServiceError(res, err) {
  if (err instanceof matching.HttpError) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(err);
  return res.status(500).json({ error: "Internal server error" });
}

// Customer creates a new cash request; matching engine takes over async.
router.post("/", requireAuth, requireRole("CUSTOMER"), async (req, res) => {
  const { type, network, amount, lat, lng, note } = req.body;

  if (!["WITHDRAW", "DEPOSIT"].includes(type)) {
    return res.status(400).json({ error: "type must be WITHDRAW or DEPOSIT" });
  }
  if (!["AIRTEL", "MTN"].includes(network)) {
    return res.status(400).json({ error: "network must be AIRTEL or MTN" });
  }
  if (!amount || Number(amount) <= 0) {
    return res.status(400).json({ error: "amount must be greater than 0" });
  }
  if (lat === undefined || lng === undefined) {
    return res.status(400).json({ error: "lat and lng are required" });
  }

  const request = await prisma.cashRequest.create({
    data: {
      customerId: req.user.id,
      type,
      network,
      amount: Number(amount),
      lat: Number(lat),
      lng: Number(lng),
      note: note || null,
      status: "PENDING",
    },
  });

  await matching.tryAssign(request.id);

  const fresh = await prisma.cashRequest.findUnique({ where: { id: request.id } });
  res.status(201).json(matching.serializeRequest(fresh));
});

// Customer: list my requests
router.get("/mine", requireAuth, requireRole("CUSTOMER"), async (req, res) => {
  const requests = await prisma.cashRequest.findMany({
    where: { customerId: req.user.id },
    orderBy: { createdAt: "desc" },
    include: { assignedAgent: { include: { user: true } } },
  });

  const shaped = requests.map((r) => ({
    ...matching.serializeRequest(r),
    agentContact:
      ["ASSIGNED", "ACCEPTED", "COMPLETED"].includes(r.status) && r.assignedAgent
        ? { name: r.assignedAgent.user.name, phone: r.assignedAgent.user.phone }
        : undefined,
  }));
  res.json(shaped);
});

// Agent: current open offer awaiting my accept/decline
router.get("/offers/mine", requireAuth, requireRole("AGENT"), async (req, res) => {
  const profile = await prisma.agentProfile.findUnique({ where: { userId: req.user.id } });
  if (!profile) return res.json([]);

  const offers = await prisma.cashRequest.findMany({
    where: { assignedAgentId: profile.id, status: "ASSIGNED" },
    include: { customer: true },
    orderBy: { createdAt: "asc" },
  });
  res.json(
    offers.map((r) => ({
      ...matching.serializeRequest(r),
      customerContact: { name: r.customer.name, phone: r.customer.phone },
    }))
  );
});

// Agent: jobs I've accepted and are in progress
router.get("/active/mine", requireAuth, requireRole("AGENT"), async (req, res) => {
  const profile = await prisma.agentProfile.findUnique({ where: { userId: req.user.id } });
  if (!profile) return res.json([]);

  const active = await prisma.cashRequest.findMany({
    where: { assignedAgentId: profile.id, status: "ACCEPTED" },
    include: { customer: true },
    orderBy: { createdAt: "asc" },
  });
  res.json(
    active.map((r) => ({
      ...matching.serializeRequest(r),
      customerContact: { name: r.customer.name, phone: r.customer.phone },
    }))
  );
});

router.get("/:id", requireAuth, async (req, res) => {
  const request = await prisma.cashRequest.findUnique({
    where: { id: req.params.id },
    include: { assignedAgent: { include: { user: true } }, customer: true },
  });
  if (!request) return res.status(404).json({ error: "Not found" });

  const isOwner = request.customerId === req.user.id;
  const isAssignedAgent = request.assignedAgent?.userId === req.user.id;
  if (!isOwner && !isAssignedAgent) {
    return res.status(403).json({ error: "Not authorized to view this request" });
  }

  res.json({
    ...matching.serializeRequest(request),
    agentContact:
      request.assignedAgent && ["ASSIGNED", "ACCEPTED", "COMPLETED"].includes(request.status)
        ? { name: request.assignedAgent.user.name, phone: request.assignedAgent.user.phone }
        : undefined,
    customerContact: isAssignedAgent
      ? { name: request.customer.name, phone: request.customer.phone }
      : undefined,
  });
});

router.post("/:id/accept", requireAuth, requireRole("AGENT"), async (req, res) => {
  try {
    const updated = await matching.acceptRequest(req.params.id, req.user.id);
    res.json(matching.serializeRequest(updated));
  } catch (err) {
    handleServiceError(res, err);
  }
});

router.post("/:id/call", requireAuth, requireRole("AGENT"), async (req, res) => {
  try {
    const updated = await matching.markCalled(req.params.id, req.user.id);
    res.json(matching.serializeRequest(updated));
  } catch (err) {
    handleServiceError(res, err);
  }
});

router.post("/:id/decline", requireAuth, requireRole("AGENT"), async (req, res) => {
  try {
    await matching.declineRequest(req.params.id, req.user.id);
    res.json({ ok: true });
  } catch (err) {
    handleServiceError(res, err);
  }
});

router.post("/:id/complete", requireAuth, requireRole("AGENT"), async (req, res) => {
  try {
    const updated = await matching.completeRequest(req.params.id, req.user.id);
    res.json(matching.serializeRequest(updated));
  } catch (err) {
    handleServiceError(res, err);
  }
});

router.post("/:id/cancel", requireAuth, requireRole("CUSTOMER"), async (req, res) => {
  try {
    const updated = await matching.cancelRequest(req.params.id, req.user.id);
    res.json(matching.serializeRequest(updated));
  } catch (err) {
    handleServiceError(res, err);
  }
});

module.exports = router;
