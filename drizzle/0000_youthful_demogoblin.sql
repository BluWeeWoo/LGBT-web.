CREATE TABLE `stories` (
	`id` text PRIMARY KEY NOT NULL,
	`author` text NOT NULL,
	`name` text NOT NULL,
	`place` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`flag` text NOT NULL,
	`topic` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `stories_by_date` ON `stories` (`created_at`);