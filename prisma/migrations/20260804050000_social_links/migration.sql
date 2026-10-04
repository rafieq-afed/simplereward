-- AlterTable Merchant
ALTER TABLE `Merchant`
  ADD COLUMN `instagramUrl` VARCHAR(500) NULL,
  ADD COLUMN `facebookUrl` VARCHAR(500) NULL,
  ADD COLUMN `tiktokUrl` VARCHAR(500) NULL,
  ADD COLUMN `whatsappUrl` VARCHAR(500) NULL;
