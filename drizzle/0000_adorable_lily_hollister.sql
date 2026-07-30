CREATE TABLE `admin_login_attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ip_hash` text NOT NULL,
	`succeeded` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `admin_login_attempts_ip_created_idx` ON `admin_login_attempts` (`ip_hash`,`created_at`);--> statement-breakpoint
CREATE TABLE `admin_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_sessions_token_hash_unique` ON `admin_sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `admin_sessions_expires_at_idx` ON `admin_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `blocked_sources` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ip_hash` text NOT NULL,
	`reason` text DEFAULT '管理员封禁' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `blocked_sources_ip_hash_unique` ON `blocked_sources` (`ip_hash`);--> statement-breakpoint
CREATE TABLE `questions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`content` text NOT NULL,
	`status` text DEFAULT 'unread' NOT NULL,
	`ip_hash` text NOT NULL,
	`user_agent_hash` text NOT NULL,
	`spam_score` integer DEFAULT 0 NOT NULL,
	`is_blocked` integer DEFAULT false NOT NULL,
	`telegram_notified` integer DEFAULT false NOT NULL,
	`telegram_message_id` integer,
	`telegram_error` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`replied_at` integer
);
--> statement-breakpoint
CREATE INDEX `questions_created_at_idx` ON `questions` (`created_at`);--> statement-breakpoint
CREATE INDEX `questions_status_idx` ON `questions` (`status`);--> statement-breakpoint
CREATE INDEX `questions_ip_hash_idx` ON `questions` (`ip_hash`);--> statement-breakpoint
CREATE INDEX `questions_telegram_notified_idx` ON `questions` (`telegram_notified`);