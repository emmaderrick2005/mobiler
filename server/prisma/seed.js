const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

// Kampala-area sample coordinates so the map has something realistic to show.
const AGENTS = [
  { name: "Agent Nakato", email: "agent1@example.com", phone: "0700000001", lat: 0.3476, lng: 32.5825, radiusKm: 5, cashOnHand: 2000000, airtelFloat: 1500000, mtnFloat: 1500000 },
  { name: "Agent Okello", email: "agent2@example.com", phone: "0700000002", lat: 0.3136, lng: 32.5811, radiusKm: 6, cashOnHand: 1000000, airtelFloat: 800000, mtnFloat: 700000 },
  { name: "Agent Namutebi", email: "agent3@example.com", phone: "0700000003", lat: 0.3563, lng: 32.6204, radiusKm: 4, cashOnHand: 500000, airtelFloat: 400000, mtnFloat: 400000 },
];

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  for (const a of AGENTS) {
    const user = await prisma.user.upsert({
      where: { email: a.email },
      update: {},
      create: {
        name: a.name,
        email: a.email,
        phone: a.phone,
        passwordHash,
        role: "AGENT",
      },
    });

    await prisma.agentProfile.upsert({
      where: { userId: user.id },
      update: { verificationStatus: "VERIFIED", reviewedAt: new Date() },
      create: {
        userId: user.id,
        lat: a.lat,
        lng: a.lng,
        radiusKm: a.radiusKm,
        cashOnHand: a.cashOnHand,
        airtelFloat: a.airtelFloat,
        mtnFloat: a.mtnFloat,
        isOnline: true,
        // Demo agents skip the upload/review flow so existing demos still work.
        verificationStatus: "VERIFIED",
        reviewedAt: new Date(),
      },
    });
  }

  await prisma.user.upsert({
    where: { email: "customer1@example.com" },
    update: {},
    create: {
      name: "Test Customer",
      email: "customer1@example.com",
      phone: "0800000001",
      passwordHash,
      role: "CUSTOMER",
    },
  });

  await prisma.user.upsert({
    where: { email: "admin1@example.com" },
    update: {},
    create: {
      name: "Admin",
      email: "admin1@example.com",
      phone: "0900000001",
      passwordHash,
      role: "ADMIN",
    },
  });

  console.log("Seed complete. All demo accounts use password: password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
