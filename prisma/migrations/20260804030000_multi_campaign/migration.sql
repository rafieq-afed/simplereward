-- CreateTable Campaign
CREATE TABLE `Campaign` (
    `id` VARCHAR(191) NOT NULL,
    `merchantId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` ENUM('STAMP', 'B1F1', 'BUNDLE') NOT NULL DEFAULT 'STAMP',
    `goal` INTEGER NOT NULL DEFAULT 10,
    `rewardLabel` VARCHAR(191) NOT NULL DEFAULT 'Free item',
    `welcomeNote` VARCHAR(255) NULL,
    `brandColor` VARCHAR(7) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `doubleOn` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Campaign_merchantId_idx`(`merchantId`),
    INDEX `Campaign_merchantId_active_idx`(`merchantId`, `active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable CustomerCampaign
CREATE TABLE `CustomerCampaign` (
    `id` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `campaignId` VARCHAR(191) NOT NULL,
    `progress` INTEGER NOT NULL DEFAULT 0,
    `totalEarned` INTEGER NOT NULL DEFAULT 0,
    `totalRedeemed` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CustomerCampaign_campaignId_idx`(`campaignId`),
    INDEX `CustomerCampaign_customerId_idx`(`customerId`),
    UNIQUE INDEX `CustomerCampaign_customerId_campaignId_key`(`customerId`, `campaignId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Migrate each merchant's legacy single campaign into Campaign
INSERT INTO `Campaign` (
  `id`, `merchantId`, `name`, `type`, `goal`, `rewardLabel`, `welcomeNote`,
  `brandColor`, `active`, `sortOrder`, `doubleOn`, `createdAt`, `updatedAt`
)
SELECT
  CONCAT('mig_', `id`),
  `id`,
  CASE
    WHEN `campaignType` = 'B1F1' THEN 'Buy 1 Free 1'
    WHEN `campaignType` = 'BUNDLE' THEN 'Bundle deal'
    ELSE 'Stamp card'
  END,
  `campaignType`,
  `stampGoal`,
  `rewardLabel`,
  `welcomeNote`,
  `brandColor`,
  true,
  0,
  `doubleStampOn`,
  `createdAt`,
  `updatedAt`
FROM `Merchant`;

-- Migrate customer progress onto that campaign
INSERT INTO `CustomerCampaign` (
  `id`, `customerId`, `campaignId`, `progress`, `totalEarned`, `totalRedeemed`, `createdAt`, `updatedAt`
)
SELECT
  CONCAT('enr_', c.`id`),
  c.`id`,
  CONCAT('mig_', c.`merchantId`),
  c.`stamps`,
  c.`totalEarned`,
  c.`totalRedeemed`,
  c.`createdAt`,
  c.`updatedAt`
FROM `Customer` c;

-- StampEvent.campaignId
ALTER TABLE `StampEvent` ADD COLUMN `campaignId` VARCHAR(191) NULL;
UPDATE `StampEvent` e
  INNER JOIN `Customer` c ON c.`id` = e.`customerId`
  SET e.`campaignId` = CONCAT('mig_', c.`merchantId`);
CREATE INDEX `StampEvent_campaignId_idx` ON `StampEvent`(`campaignId`);

-- FKs
ALTER TABLE `Campaign` ADD CONSTRAINT `Campaign_merchantId_fkey`
  FOREIGN KEY (`merchantId`) REFERENCES `Merchant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `CustomerCampaign` ADD CONSTRAINT `CustomerCampaign_customerId_fkey`
  FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `CustomerCampaign` ADD CONSTRAINT `CustomerCampaign_campaignId_fkey`
  FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `StampEvent` ADD CONSTRAINT `StampEvent_campaignId_fkey`
  FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Drop legacy merchant campaign columns
ALTER TABLE `Merchant`
  DROP COLUMN `campaignType`,
  DROP COLUMN `stampGoal`,
  DROP COLUMN `rewardLabel`,
  DROP COLUMN `doubleStampOn`;

-- Drop legacy customer progress columns
ALTER TABLE `Customer`
  DROP COLUMN `stamps`,
  DROP COLUMN `totalEarned`,
  DROP COLUMN `totalRedeemed`;
