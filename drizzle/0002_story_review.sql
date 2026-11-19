ALTER TABLE `stories` ADD `status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `stories` ADD `reviewed_at` text;--> statement-breakpoint
ALTER TABLE `stories` ADD `reviewed_by` text;--> statement-breakpoint
-- All rows present before moderation were already published in the atlas.
UPDATE `stories` SET `status` = 'approved';--> statement-breakpoint
CREATE INDEX `stories_by_status` ON `stories` (`status`,`removing`,`created_at`,`id`);
