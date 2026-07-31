-- AlterTable
ALTER TABLE "AgentProfile" ADD COLUMN "nationalIdNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "AgentProfile_nationalIdNumber_key" ON "AgentProfile"("nationalIdNumber");
