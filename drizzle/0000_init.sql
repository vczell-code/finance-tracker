CREATE TABLE `categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`groupName` text NOT NULL,
	`isFixed` integer DEFAULT false NOT NULL,
	`monthlyBudgetCents` integer,
	`color` text NOT NULL,
	`icon` text NOT NULL,
	`isArchived` integer DEFAULT false NOT NULL,
	CONSTRAINT "categories_budget_positive" CHECK("categories"."monthlyBudgetCents" IS NULL OR "categories"."monthlyBudgetCents" > 0)
);
--> statement-breakpoint
CREATE TABLE `fx_rates` (
	`pair` text PRIMARY KEY NOT NULL,
	`rate` real NOT NULL,
	`fetchedAt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `holdings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ticker` text NOT NULL,
	`name` text NOT NULL,
	`exchange` text,
	`shares` real NOT NULL,
	`avgCostPerShare` real,
	`currency` text NOT NULL,
	`notes` text,
	`updatedAt` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	CONSTRAINT "holdings_shares_positive" CHECK("holdings"."shares" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `holdings_ticker_unique` ON `holdings` (`ticker`);--> statement-breakpoint
CREATE TABLE `recurring_rules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`amountCents` integer NOT NULL,
	`currency` text NOT NULL,
	`type` text NOT NULL,
	`categoryId` integer NOT NULL,
	`paymentMethod` text DEFAULT 'BANK_TRANSFER' NOT NULL,
	`frequency` text NOT NULL,
	`anchorDay` integer NOT NULL,
	`nextDueDate` text NOT NULL,
	`lastGeneratedDate` text,
	`isActive` integer DEFAULT true NOT NULL,
	`notes` text,
	`createdAt` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`categoryId`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "recurring_amount_positive" CHECK("recurring_rules"."amountCents" > 0),
	CONSTRAINT "recurring_anchor_day" CHECK("recurring_rules"."anchorDay" BETWEEN 1 AND 31)
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`baseCurrency` text DEFAULT 'EUR' NOT NULL,
	`monthStartDay` integer DEFAULT 1 NOT NULL,
	`updatedAt` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	CONSTRAINT "settings_singleton" CHECK("settings"."id" = 1),
	CONSTRAINT "settings_month_start" CHECK("settings"."monthStartDay" BETWEEN 1 AND 28)
);
--> statement-breakpoint
CREATE TABLE `stock_prices` (
	`ticker` text PRIMARY KEY NOT NULL,
	`closePrice` real NOT NULL,
	`previousClose` real NOT NULL,
	`currency` text NOT NULL,
	`priceDate` text NOT NULL,
	`fetchedAt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`amountCents` integer NOT NULL,
	`currency` text NOT NULL,
	`type` text NOT NULL,
	`categoryId` integer,
	`merchant` text NOT NULL,
	`paymentMethod` text DEFAULT 'DEBIT' NOT NULL,
	`notes` text,
	`recurringRuleId` integer,
	`createdAt` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`categoryId`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recurringRuleId`) REFERENCES `recurring_rules`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "transactions_amount_positive" CHECK("transactions"."amountCents" > 0)
);
--> statement-breakpoint
CREATE INDEX `idx_transactions_date` ON `transactions` (`date`);--> statement-breakpoint
CREATE INDEX `idx_transactions_category` ON `transactions` (`categoryId`);--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_transactions_recurring_date` ON `transactions` (`recurringRuleId`,`date`) WHERE "transactions"."recurringRuleId" IS NOT NULL;