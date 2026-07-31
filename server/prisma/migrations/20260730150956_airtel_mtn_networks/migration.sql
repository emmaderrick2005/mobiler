/*
  Warnings:

  - You are about to drop the column `floatBalance` on the `AgentProfile` table. All the data in the column will be lost.
  - Added the required column `network` to the `CashRequest` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Network" AS ENUM ('AIRTEL', 'MTN');

-- AlterTable
ALTER TABLE "AgentProfile" DROP COLUMN "floatBalance",
ADD COLUMN     "airtelFloat" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "cashOnHand" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "mtnFloat" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "CashRequest" ADD COLUMN     "network" "Network" NOT NULL;
