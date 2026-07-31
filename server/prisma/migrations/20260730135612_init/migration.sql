-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CUSTOMER', 'AGENT');

-- CreateEnum
CREATE TYPE "RequestType" AS ENUM ('WITHDRAW', 'DEPOSIT');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'ASSIGNED', 'ACCEPTED', 'COMPLETED', 'UNMATCHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AttemptOutcome" AS ENUM ('OFFERED', 'ACCEPTED', 'DECLINED', 'EXPIRED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "radiusKm" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "floatBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashRequest" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "type" "RequestType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "assignedAgentId" TEXT,
    "acceptDeadline" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "CashRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestAttempt" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "outcome" "AttemptOutcome" NOT NULL DEFAULT 'OFFERED',
    "offeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "RequestAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AgentProfile_userId_key" ON "AgentProfile"("userId");

-- CreateIndex
CREATE INDEX "RequestAttempt_requestId_idx" ON "RequestAttempt"("requestId");

-- AddForeignKey
ALTER TABLE "AgentProfile" ADD CONSTRAINT "AgentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashRequest" ADD CONSTRAINT "CashRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashRequest" ADD CONSTRAINT "CashRequest_assignedAgentId_fkey" FOREIGN KEY ("assignedAgentId") REFERENCES "AgentProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestAttempt" ADD CONSTRAINT "RequestAttempt_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "CashRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestAttempt" ADD CONSTRAINT "RequestAttempt_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AgentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
