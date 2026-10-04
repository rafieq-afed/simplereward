-- AlterTable Merchant
ALTER TABLE `Merchant`
  ADD COLUMN `cardTheme` VARCHAR(20) NOT NULL DEFAULT 'classic',
  ADD COLUMN `fontFamily` VARCHAR(32) NOT NULL DEFAULT 'syne';

-- AlterTable Campaign
ALTER TABLE `Campaign`
  ADD COLUMN `rewardImageUrl` VARCHAR(500) NULL;
