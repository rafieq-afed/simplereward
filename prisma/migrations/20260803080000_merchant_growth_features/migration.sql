-- AlterTable
ALTER TABLE `Merchant` ADD COLUMN `doubleStampOn` DATETIME(3) NULL,
    ADD COLUMN `requireJoinOtp` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `Customer` ADD COLUMN `birthdayMd` VARCHAR(5) NULL,
    ADD COLUMN `birthdayBonusYear` INTEGER NULL,
    ADD COLUMN `lastBlastAt` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `OtpChallenge` (
    `id` VARCHAR(191) NOT NULL,
    `merchantId` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(6) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `OtpChallenge_merchantId_idx`(`merchantId`),
    UNIQUE INDEX `OtpChallenge_merchantId_phone_key`(`merchantId`, `phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `OtpChallenge` ADD CONSTRAINT `OtpChallenge_merchantId_fkey` FOREIGN KEY (`merchantId`) REFERENCES `Merchant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
