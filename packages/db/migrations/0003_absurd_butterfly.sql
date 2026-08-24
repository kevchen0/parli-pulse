CREATE TABLE "debater_speaker_totals" (
	"id" text PRIMARY KEY NOT NULL,
	"season_id" text NOT NULL,
	"debater_id" text NOT NULL,
	"ballots" integer NOT NULL,
	"mean_z" real NOT NULL,
	"mean_display" real NOT NULL,
	"rank" integer
);
--> statement-breakpoint
ALTER TABLE "debater_speaker_totals" ADD CONSTRAINT "debater_speaker_totals_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debater_speaker_totals" ADD CONSTRAINT "debater_speaker_totals_debater_id_debaters_id_fk" FOREIGN KEY ("debater_id") REFERENCES "public"."debaters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "debater_speaker_season_idx" ON "debater_speaker_totals" USING btree ("season_id","debater_id");