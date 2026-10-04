-- AlterTable
ALTER TABLE `Merchant`
    ADD COLUMN `campaignType` ENUM('STAMP', 'B1F1', 'BUNDLE') NOT NULL DEFAULT 'STAMP',
    ADD COLUMN `brandColor` VARCHAR(7) NULL,
    ADD COLUMN `logoUrl` VARCHAR(500) NULL;
