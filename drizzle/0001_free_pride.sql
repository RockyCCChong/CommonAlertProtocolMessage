CREATE TABLE `cap_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('composed','parsed') NOT NULL,
	`identifier` varchar(255),
	`sender` varchar(255),
	`status` varchar(32),
	`severity` varchar(32),
	`msgType` varchar(32),
	`xml` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cap_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `feed_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`feedUrl` text NOT NULL,
	`feedName` varchar(255),
	`totalCount` int NOT NULL DEFAULT 0,
	`passCount` int NOT NULL DEFAULT 0,
	`failCount` int NOT NULL DEFAULT 0,
	`errors` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `feed_runs_id` PRIMARY KEY(`id`)
);
