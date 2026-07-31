const prisma = require("../prisma");
const { distanceKm } = require("../utils/geo");
const { emitToUser } = require("../sockets");

const ACCEPT_WINDOW_SECONDS = Number(
  process.env.REQUEST_ACCEPT_WINDOW_SECONDS || 90
);

function serializeRequest(request) {
  return {
    id: request.id,
    type: request.type,
    network: request.network,
    amount: request.amount,
    lat: request.lat,
    lng: request.lng,
    note: request.note,
    status: request.status,
    acceptDeadline: request.acceptDeadline,
    createdAt: request.createdAt,
    calledAt: request.calledAt,
    completedAt: request.completedAt,
    assignedAgentId: request.assignedAgentId,
  };
}

function networkFloatField(network) {
  return network === "AIRTEL" ? "airtelFloat" : "mtnFloat";
}

// A withdrawal hands the customer physical cash (agent needs cash on hand);
// a deposit hands the customer e-float on their chosen network (agent needs
// float on that network).
function resourceFieldFor(request) {
  return request.type === "WITHDRAW" ? "cashOnHand" : networkFloatField(request.network);
}

// Find the nearest eligible online agent (enough float, within their radius)
// who hasn't already declined/expired on this request, and offer it to them.
async function tryAssign(requestId) {
  const request = await prisma.cashRequest.findUnique({
    where: { id: requestId },
    include: { customer: true },
  });
  if (!request) return;
  if (!["PENDING", "UNMATCHED"].includes(request.status)) return;

  const priorAttempts = await prisma.requestAttempt.findMany({
    where: { requestId, outcome: { in: ["DECLINED", "EXPIRED"] } },
    select: { agentId: true },
  });
  const excludedAgentIds = priorAttempts.map((a) => a.agentId);

  const candidates = await prisma.agentProfile.findMany({
    where: {
      isOnline: true,
      verificationStatus: "VERIFIED",
      [resourceFieldFor(request)]: { gte: request.amount },
      id: { notIn: excludedAgentIds },
    },
    include: { user: true },
  });

  const withinRange = candidates
    .map((agent) => ({
      agent,
      distance: distanceKm(request.lat, request.lng, agent.lat, agent.lng),
    }))
    .filter(({ agent, distance }) => distance <= agent.radiusKm)
    .sort((a, b) => a.distance - b.distance);

  if (withinRange.length === 0) {
    const updated = await prisma.cashRequest.update({
      where: { id: requestId },
      data: { status: "UNMATCHED", assignedAgentId: null, acceptDeadline: null },
    });
    emitToUser(request.customerId, "request:update", {
      ...serializeRequest(updated),
      agentContact: null,
    });
    return;
  }

  const { agent } = withinRange[0];
  const acceptDeadline = new Date(Date.now() + ACCEPT_WINDOW_SECONDS * 1000);

  await prisma.requestAttempt.create({
    data: { requestId, agentId: agent.id, outcome: "OFFERED" },
  });

  const updated = await prisma.cashRequest.update({
    where: { id: requestId },
    data: {
      status: "ASSIGNED",
      assignedAgentId: agent.id,
      acceptDeadline,
    },
  });

  emitToUser(agent.userId, "request:offer", {
    ...serializeRequest(updated),
    customerContact: { name: request.customer.name, phone: request.customer.phone },
  });
  emitToUser(request.customerId, "request:update", {
    ...serializeRequest(updated),
    agentContact: { name: agent.user.name, phone: agent.user.phone },
  });
}

async function acceptRequest(requestId, agentUserId) {
  const request = await prisma.cashRequest.findUnique({
    where: { id: requestId },
    include: { assignedAgent: true },
  });
  if (!request) throw new HttpError(404, "Request not found");
  if (request.status !== "ASSIGNED" || !request.assignedAgent) {
    throw new HttpError(409, "Request is not awaiting acceptance");
  }
  if (request.assignedAgent.userId !== agentUserId) {
    throw new HttpError(403, "This request was not offered to you");
  }
  if (request.acceptDeadline && request.acceptDeadline < new Date()) {
    throw new HttpError(409, "Offer has expired");
  }

  const attempt = await prisma.requestAttempt.findFirst({
    where: { requestId, agentId: request.assignedAgentId, outcome: "OFFERED" },
    orderBy: { offeredAt: "desc" },
  });
  if (attempt) {
    await prisma.requestAttempt.update({
      where: { id: attempt.id },
      data: { outcome: "ACCEPTED", respondedAt: new Date() },
    });
  }

  const updated = await prisma.cashRequest.update({
    where: { id: requestId },
    data: { status: "ACCEPTED" },
  });

  const agentUser = await prisma.user.findUnique({
    where: { id: agentUserId },
  });

  emitToUser(request.customerId, "request:update", {
    ...serializeRequest(updated),
    agentContact: {
      name: agentUser.name,
      phone: agentUser.phone,
    },
  });
  emitToUser(agentUserId, "request:update", serializeRequest(updated));

  return updated;
}

// Agents must log a call to the customer before they're allowed to complete
// a job — physical cash shouldn't change hands on an unconfirmed order.
async function markCalled(requestId, agentUserId) {
  const request = await prisma.cashRequest.findUnique({
    where: { id: requestId },
    include: { assignedAgent: { include: { user: true } } },
  });
  if (!request) throw new HttpError(404, "Request not found");
  if (request.status !== "ACCEPTED" || !request.assignedAgent) {
    throw new HttpError(409, "Request is not in progress");
  }
  if (request.assignedAgent.userId !== agentUserId) {
    throw new HttpError(403, "This request is not assigned to you");
  }

  const updated = await prisma.cashRequest.update({
    where: { id: requestId },
    data: { calledAt: new Date() },
  });

  emitToUser(request.customerId, "request:update", {
    ...serializeRequest(updated),
    agentContact: { name: request.assignedAgent.user.name, phone: request.assignedAgent.user.phone },
  });
  emitToUser(agentUserId, "request:update", serializeRequest(updated));

  return updated;
}

async function declineRequest(requestId, agentUserId) {
  const request = await prisma.cashRequest.findUnique({
    where: { id: requestId },
    include: { assignedAgent: true },
  });
  if (!request) throw new HttpError(404, "Request not found");
  if (request.status !== "ASSIGNED" || !request.assignedAgent) {
    throw new HttpError(409, "Request is not awaiting a response");
  }
  if (request.assignedAgent.userId !== agentUserId) {
    throw new HttpError(403, "This request was not offered to you");
  }

  const attempt = await prisma.requestAttempt.findFirst({
    where: { requestId, agentId: request.assignedAgentId, outcome: "OFFERED" },
    orderBy: { offeredAt: "desc" },
  });
  if (attempt) {
    await prisma.requestAttempt.update({
      where: { id: attempt.id },
      data: { outcome: "DECLINED", respondedAt: new Date() },
    });
  }

  await prisma.cashRequest.update({
    where: { id: requestId },
    data: { status: "PENDING", assignedAgentId: null, acceptDeadline: null },
  });

  await tryAssign(requestId);
}

async function completeRequest(requestId, agentUserId) {
  const request = await prisma.cashRequest.findUnique({
    where: { id: requestId },
    include: { assignedAgent: { include: { user: true } } },
  });
  if (!request) throw new HttpError(404, "Request not found");
  if (request.status !== "ACCEPTED" || !request.assignedAgent) {
    throw new HttpError(409, "Request is not in progress");
  }
  if (request.assignedAgent.userId !== agentUserId) {
    throw new HttpError(403, "This request is not assigned to you");
  }
  if (!request.calledAt) {
    throw new HttpError(409, "You must call the customer before completing this job");
  }

  // Withdrawal: agent hands out cash, receives e-float on the request's network.
  // Deposit: agent receives cash, hands out e-float on the request's network.
  const cashDelta = request.type === "WITHDRAW" ? -request.amount : request.amount;
  const networkDelta = request.type === "WITHDRAW" ? request.amount : -request.amount;
  const networkField = networkFloatField(request.network);

  const [updatedRequest] = await prisma.$transaction([
    prisma.cashRequest.update({
      where: { id: requestId },
      data: { status: "COMPLETED", completedAt: new Date() },
    }),
    prisma.agentProfile.update({
      where: { id: request.assignedAgentId },
      data: {
        cashOnHand: { increment: cashDelta },
        [networkField]: { increment: networkDelta },
      },
    }),
  ]);

  emitToUser(request.customerId, "request:update", {
    ...serializeRequest(updatedRequest),
    agentContact: { name: request.assignedAgent.user.name, phone: request.assignedAgent.user.phone },
  });
  emitToUser(agentUserId, "request:update", serializeRequest(updatedRequest));

  return updatedRequest;
}

async function cancelRequest(requestId, customerId) {
  const request = await prisma.cashRequest.findUnique({
    where: { id: requestId },
    include: { assignedAgent: true },
  });
  if (!request) throw new HttpError(404, "Request not found");
  if (request.customerId !== customerId) {
    throw new HttpError(403, "Not your request");
  }
  if (["COMPLETED", "CANCELLED"].includes(request.status)) {
    throw new HttpError(409, "Request already finished");
  }

  const updated = await prisma.cashRequest.update({
    where: { id: requestId },
    data: { status: "CANCELLED" },
  });

  if (request.assignedAgent) {
    emitToUser(request.assignedAgent.userId, "request:update", serializeRequest(updated));
  }

  return updated;
}

// Periodically sweep offers whose accept window has passed and reassign them.
async function sweepExpiredOffers() {
  const expired = await prisma.cashRequest.findMany({
    where: { status: "ASSIGNED", acceptDeadline: { lt: new Date() } },
  });

  for (const request of expired) {
    const attempt = await prisma.requestAttempt.findFirst({
      where: { requestId: request.id, agentId: request.assignedAgentId, outcome: "OFFERED" },
      orderBy: { offeredAt: "desc" },
    });
    if (attempt) {
      await prisma.requestAttempt.update({
        where: { id: attempt.id },
        data: { outcome: "EXPIRED", respondedAt: new Date() },
      });
    }
    await prisma.cashRequest.update({
      where: { id: request.id },
      data: { status: "PENDING", assignedAgentId: null, acceptDeadline: null },
    });
    await tryAssign(request.id);
  }
}

// Periodically retry requests that had no eligible agent last time — an
// agent may since have come online, refilled float, or moved closer.
async function sweepUnmatched() {
  const unmatched = await prisma.cashRequest.findMany({
    where: { status: "UNMATCHED" },
  });
  for (const request of unmatched) {
    await tryAssign(request.id);
  }
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

module.exports = {
  tryAssign,
  acceptRequest,
  markCalled,
  declineRequest,
  completeRequest,
  cancelRequest,
  sweepExpiredOffers,
  sweepUnmatched,
  serializeRequest,
  HttpError,
};
