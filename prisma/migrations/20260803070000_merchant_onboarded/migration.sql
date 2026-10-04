-- AlterTable
ALTER TABLE `Merchant` ADD COLUMN `onboardedAt` DATETIME(3) NULL;

-- Existing shops skip onboarding
UPDATE `Merchant` SET `onboardedAt` = COALESCE(`createdAt`, CURRENT_TIMESTAMP(3)) WHERE `onboardedAt` IS NULL;
