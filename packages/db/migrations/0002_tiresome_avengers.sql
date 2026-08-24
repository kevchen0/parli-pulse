CREATE TABLE "standing_diagnostics" (
	"id" text PRIMARY KEY NOT NULL,
	"season_id" text NOT NULL,
	"school_name" text NOT NULL,
	"region" text,
	"debater1" text NOT NULL,
	"debater2" text NOT NULL,
	"official_rank" integer,
	"official_points" real NOT NULL,
	"our_points" real,
	"delta" real,
	"mismatched_results" integer DEFAULT 0 NOT NULL,
	"results" jsonb
);
--> statement-breakpoint
ALTER TABLE "standing_diagnostics" ADD CONSTRAINT "standing_diagnostics_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "standing_diagnostics_season_idx" ON "standing_diagnostics" USING btree ("season_id");--> statement-breakpoint
CREATE INDEX "standing_diagnostics_delta_idx" ON "standing_diagnostics" USING btree ("delta");