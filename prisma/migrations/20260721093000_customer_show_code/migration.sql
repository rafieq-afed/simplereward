-- AlterTable
ALTER TABLE `Customer` ADD COLUMN `cardCode` VARCHAR(8) NULL,
    ADD COLUMN `showCode` VARCHAR(4) NULL,
    ADD COLUMN `showCodeExpiresAt` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `Customer_merchantId_showCode_idx` ON `Customer`(`merchantId`, `showCode`);

-- CreateIndex
CREATE UNIQUE INDEX `Customer_merchantId_cardCode_key` ON `Customer`(`merchantId`, `cardCode`);
