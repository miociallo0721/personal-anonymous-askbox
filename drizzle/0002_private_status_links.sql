ALTER TABLE `questions` ADD `status_token_hash` text;--> statement-breakpoint
CREATE UNIQUE INDEX `questions_status_token_hash_unique` ON `questions` (`status_token_hash`);