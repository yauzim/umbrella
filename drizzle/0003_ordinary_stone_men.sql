CREATE TABLE `steam_friends` (
	`steam_id` text NOT NULL,
	`friend_steam_id` text NOT NULL,
	`friends_since` integer,
	PRIMARY KEY(`steam_id`, `friend_steam_id`),
	FOREIGN KEY (`steam_id`) REFERENCES `users`(`steam_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `steam_friends_owner_idx` ON `steam_friends` (`steam_id`);--> statement-breakpoint
ALTER TABLE `users` ADD `country_code` text;--> statement-breakpoint
ALTER TABLE `users` ADD `friends_synced_at` integer;