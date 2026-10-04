-- AlterTable
ALTER TABLE `Customer` ADD COLUMN `lastRemindedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `StampEvent` ADD COLUMN `staffId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `Staff` (
    `id` VARCHAR(191) NOT NULL,
    `merchantId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `pinHash` VARCHAR(191) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Staff_merchantId_idx`(`merchantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `StampEvent_staffId_idx` ON `StampEvent`(`staffId`);

-- AddForeignKey
ALTER TABLE `Staff` ADD CONSTRAINT `Staff_merchantId_fkey` FOREIGN KEY (`merchantId`) REFERENCES `Merchant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StampEvent` ADD CONSTRAINT `StampEvent_staffId_fkey` FOREIGN KEY (`staffId`) REFERENCES `Staff`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
