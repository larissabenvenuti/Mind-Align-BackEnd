/*
  Warnings:

  - You are about to drop the column `keys` on the `PushSubscription` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId,endpoint]` on the table `PushSubscription` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `subscription` to the `PushSubscription` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `PushSubscription` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "PushSubscription" DROP COLUMN "keys",
ADD COLUMN     "subscription" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "NotificationPreferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventReminders" BOOLEAN NOT NULL DEFAULT true,
    "dailyTaskSummary" BOOLEAN NOT NULL DEFAULT true,
    "habitReminders" BOOLEAN NOT NULL DEFAULT true,
    "reminderMinutesBefore" INTEGER NOT NULL DEFAULT 15,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledNotification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "sent" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3),
    "payload" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduledNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreferences_userId_key" ON "NotificationPreferences"("userId");

-- CreateIndex
CREATE INDEX "ScheduledNotification_userId_idx" ON "ScheduledNotification"("userId");

-- CreateIndex
CREATE INDEX "ScheduledNotification_scheduledFor_sent_idx" ON "ScheduledNotification"("scheduledFor", "sent");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_userId_endpoint_key" ON "PushSubscription"("userId", "endpoint");

-- AddForeignKey
ALTER TABLE "NotificationPreferences" ADD CONSTRAINT "NotificationPreferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledNotification" ADD CONSTRAINT "ScheduledNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
