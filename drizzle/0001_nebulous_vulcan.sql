CREATE TABLE `favorite_games` (
	`steam_id` text NOT NULL,
	`appid` integer NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`steam_id`, `appid`),
	FOREIGN KEY (`steam_id`) REFERENCES `users`(`steam_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`appid`) REFERENCES `games`(`appid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `favorites_owner_idx` ON `favorite_games` (`steam_id`,`position`);--> statement-breakpoint
ALTER TABLE `users` ADD `avatar_appid` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `avatar_achievement_id` integer;