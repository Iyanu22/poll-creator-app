CREATE TYPE "public"."option_source" AS ENUM('creator', 'suggestion');--> statement-breakpoint
CREATE TYPE "public"."poll_status" AS ENUM('open', 'settled');--> statement-breakpoint
CREATE TYPE "public"."poll_type" AS ENUM('single', 'multi');--> statement-breakpoint
CREATE TYPE "public"."suggestion_status" AS ENUM('pending', 'approved', 'declined');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"is_anonymous" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ballots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"poll_id" text NOT NULL,
	"voter_token" text NOT NULL,
	"voter_name" text NOT NULL,
	"avatar_seed" text NOT NULL,
	"avatar_tint" text NOT NULL,
	"cast_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ballots_one_per_voter" UNIQUE("poll_id","voter_token"),
	CONSTRAINT "ballots_voter_name_length" CHECK (char_length("ballots"."voter_name") between 1 and 40),
	CONSTRAINT "ballots_avatar_tint" CHECK ("ballots"."avatar_tint" in ('f8c9b9', 'cbe2d8', 'f6e0a4', 'e3d2f2'))
);
--> statement-breakpoint
CREATE TABLE "options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"poll_id" text NOT NULL,
	"label" text NOT NULL,
	"position" smallint NOT NULL,
	"source" "option_source" NOT NULL,
	"suggestion_status" "suggestion_status",
	"suggested_by_name" text,
	"suggested_by_avatar_seed" text,
	"suggested_by_avatar_tint" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "options_label_length" CHECK (char_length("options"."label") between 1 and 80),
	CONSTRAINT "options_source_shape" CHECK (("options"."source" = 'creator'
            and "options"."suggestion_status" is null
            and "options"."suggested_by_name" is null
            and "options"."suggested_by_avatar_seed" is null
            and "options"."suggested_by_avatar_tint" is null
            and "options"."decided_at" is null)
        or ("options"."source" = 'suggestion'
            and "options"."suggestion_status" is not null
            and "options"."suggested_by_name" is not null
            and "options"."suggested_by_avatar_seed" is not null
            and "options"."suggested_by_avatar_tint" in ('f8c9b9', 'cbe2d8', 'f6e0a4', 'e3d2f2')
            and ("options"."suggestion_status" = 'pending') = ("options"."decided_at" is null)))
);
--> statement-breakpoint
CREATE TABLE "polls" (
	"id" text PRIMARY KEY NOT NULL,
	"creator_id" text NOT NULL,
	"title" text NOT NULL,
	"type" "poll_type" DEFAULT 'single' NOT NULL,
	"max_choices" smallint DEFAULT 1 NOT NULL,
	"suggestions_enabled" boolean DEFAULT true NOT NULL,
	"status" "poll_status" DEFAULT 'open' NOT NULL,
	"closes_at" timestamp with time zone NOT NULL,
	"settled_at" timestamp with time zone,
	"settled_early" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "polls_title_length" CHECK (char_length("polls"."title") between 1 and 120),
	CONSTRAINT "polls_max_choices" CHECK (("polls"."type" = 'single' and "polls"."max_choices" = 1) or ("polls"."type" = 'multi' and "polls"."max_choices" >= 2)),
	CONSTRAINT "polls_settled_consistency" CHECK (("polls"."status" = 'open' and "polls"."settled_at" is null and not "polls"."settled_early") or ("polls"."status" = 'settled' and "polls"."settled_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "votes" (
	"ballot_id" uuid NOT NULL,
	"option_id" uuid NOT NULL,
	CONSTRAINT "votes_ballot_id_option_id_pk" PRIMARY KEY("ballot_id","option_id")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ballots" ADD CONSTRAINT "ballots_poll_id_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "options" ADD CONSTRAINT "options_poll_id_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "polls" ADD CONSTRAINT "polls_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_ballot_id_ballots_id_fk" FOREIGN KEY ("ballot_id") REFERENCES "public"."ballots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_option_id_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."options"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_user_id_index" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_index" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verifications_identifier_index" ON "verifications" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "options_poll_id_position_index" ON "options" USING btree ("poll_id","position");--> statement-breakpoint
CREATE INDEX "polls_creator_id_status_closes_at_index" ON "polls" USING btree ("creator_id","status","closes_at");--> statement-breakpoint
CREATE INDEX "votes_option_id_index" ON "votes" USING btree ("option_id");