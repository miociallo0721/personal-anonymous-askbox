CREATE TABLE `answers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`question_id` integer NOT NULL,
	`content` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `answers_question_id_unique` ON `answers` (`question_id`);--> statement-breakpoint
CREATE INDEX `answers_updated_at_idx` ON `answers` (`updated_at`);--> statement-breakpoint
CREATE TABLE `cards` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`answer_id` integer NOT NULL,
	`aspect` text NOT NULL,
	`theme` text NOT NULL,
	`image_format` text DEFAULT 'png' NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`page_count` integer DEFAULT 1 NOT NULL,
	`renderer_version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`answer_id`) REFERENCES `answers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `cards_answer_id_idx` ON `cards` (`answer_id`);--> statement-breakpoint
CREATE INDEX `cards_created_at_idx` ON `cards` (`created_at`);