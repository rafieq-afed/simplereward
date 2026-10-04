-- AlterTable Merchant
ALTER TABLE `Merchant`
  ADD COLUMN `features` JSON NOT NULL DEFAULT ('{}'),
  ADD COLUMN `quotedPrice` INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `UpgradeRequest` (
    `id` VARCHAR(191) NOT NULL,
    `merchantId` VARCHAR(191) NOT NULL,
    `message` VARCHAR(500) NULL,
    `desiredTier` VARCHAR(20) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `UpgradeRequest_merchantId_idx`(`merchantId`),
    INDEX `UpgradeRequest_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `UpgradeRequest` ADD CONSTRAINT `UpgradeRequest_merchantId_fkey` FOREIGN KEY (`merchantId`) REFERENCES `Merchant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
