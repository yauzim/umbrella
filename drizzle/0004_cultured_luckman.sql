CREATE TABLE `game_reviews` (
	`steam_id` text NOT NULL,
	`appid` integer NOT NULL,
	`rating` integer,
	`body` text,
	`contains_spoilers` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`steam_id`, `appid`),
	FOREIGN KEY (`steam_id`) REFERENCES `users`(`steam_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`appid`) REFERENCES `games`(`appid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `reviews_game_idx` ON `game_reviews` (`appid`,`created_at`);--> statement-breakpoint
CREATE INDEX `reviews_author_idx` ON `game_reviews` (`steam_id`);