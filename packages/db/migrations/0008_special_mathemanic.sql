CREATE TABLE "ingest_runs" (
	"season_id" text PRIMARY KEY NOT NULL,
	"finished_at" timestamp with time zone DEFAULT now() NOT NULL,
	"tournaments" integer DEFAULT 0 NOT NULL,
	"source" text DEFAULT 'local' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ingest_runs" ADD CONSTRAINT "ingest_runs_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;