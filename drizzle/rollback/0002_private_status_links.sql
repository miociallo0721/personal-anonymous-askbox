DROP INDEX IF EXISTS `questions_status_token_hash_unique`;
ALTER TABLE `questions` DROP COLUMN `status_token_hash`;
