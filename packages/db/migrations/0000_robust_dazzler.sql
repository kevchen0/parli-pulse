CREATE TYPE "public"."disagreement_status" AS ENUM('open', 'our_bug', 'sheet_manual_override', 'missing_tabroom_data', 'accepted_divergence');--> statement-breakpoint
CREATE TYPE "public"."division" AS ENUM('open', 'jv', 'novice', 'middle', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."elim_level" AS ENUM('tripleOcto', 'doubleOcto', 'octo', 'quarter', 'semi', 'second', 'first');--> statement-breakpoint
CREATE TYPE "public"."round_kind" AS ENUM('prelim', 'elim', 'other');--> statement-breakpoint
CREATE TABLE "ballots" (
	"id" text PRIMARY KEY NOT NULL,
	"round_id" text NOT NULL,
	"section_id" text,
	"entry_id" text,
	"judge_id" text,
	"side" integer,
	"won" boolean,
	"is_bye" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "debater_season_totals" (
	"id" text PRIMARY KEY NOT NULL,
	"season_id" text NOT NULL,
	"debater_id" text NOT NULL,
	"points" real NOT NULL,
	"rank" integer,
	"toc_qual_points" real,
	"toc_qual_rank" integer,
	"auto_qualified" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "debaters" (
	"id" text PRIMARY KEY NOT NULL,
	"first_name" text,
	"last_name" text,
	"school_id" text,
	"suppressed" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "disagreements" (
	"id" text PRIMARY KEY NOT NULL,
	"season_id" text,
	"tournament_id" text,
	"entry_id" text,
	"scope" text NOT NULL,
	"our_value" real,
	"official_value" real,
	"detail" jsonb,
	"status" "disagreement_status" DEFAULT 'open' NOT NULL,
	"note" text,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "entries" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"code" text,
	"school_id" text,
	"hybrid_school_id" text,
	"team_size" integer DEFAULT 0 NOT NULL,
	"dropped" boolean DEFAULT false NOT NULL,
	"prelim_wins" integer DEFAULT 0 NOT NULL,
	"prelim_losses" integer DEFAULT 0 NOT NULL,
	"prelim_ballots_won" integer DEFAULT 0 NOT NULL,
	"prelim_ballots_total" integer DEFAULT 0 NOT NULL,
	"elim_level" "elim_level",
	"won_final" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entry_debaters" (
	"entry_id" text NOT NULL,
	"debater_id" text NOT NULL,
	"school_id" text,
	CONSTRAINT "entry_debaters_entry_id_debater_id_pk" PRIMARY KEY("entry_id","debater_id")
);
--> statement-breakpoint
CREATE TABLE "entry_results" (
	"entry_id" text PRIMARY KEY NOT NULL,
	"points" real NOT NULL,
	"base_points" real,
	"prelim_count_adjustment" integer DEFAULT 0 NOT NULL,
	"break_penalty" integer DEFAULT 0 NOT NULL,
	"walkover_adjustment" integer DEFAULT 0 NOT NULL,
	"floor_applied" text,
	"excluded_reason" text,
	"counts_toward_toc" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_field_stats" (
	"event_id" text PRIMARY KEY NOT NULL,
	"raw_entries" integer NOT NULL,
	"forfeited_out" integer NOT NULL,
	"field_size" integer NOT NULL,
	"elim_field" integer NOT NULL,
	"adjusted_field_size" integer,
	"break_pct" real,
	"unscored" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" text PRIMARY KEY NOT NULL,
	"tournament_id" text NOT NULL,
	"name" text NOT NULL,
	"abbr" text,
	"division" "division" NOT NULL,
	"is_parli" boolean NOT NULL,
	"prelim_count" integer DEFAULT 0 NOT NULL,
	"speaker_scale_min" real,
	"speaker_scale_max" real
);
--> statement-breakpoint
CREATE TABLE "judge_stats" (
	"id" text PRIMARY KEY NOT NULL,
	"season_id" text,
	"judge_id" text NOT NULL,
	"tournaments_judged" integer DEFAULT 0 NOT NULL,
	"rounds_judged" integer DEFAULT 0 NOT NULL,
	"panel_rounds" integer DEFAULT 0 NOT NULL,
	"dissents" integer DEFAULT 0 NOT NULL,
	"squirrel_rate" real,
	"mean_speaker_points" real,
	"speaker_points_z" real,
	"prop_win_rate" real
);
--> statement-breakpoint
CREATE TABLE "judges" (
	"id" text PRIMARY KEY NOT NULL,
	"first_name" text,
	"last_name" text
);
--> statement-breakpoint
CREATE TABLE "manual_overrides" (
	"id" text PRIMARY KEY NOT NULL,
	"entry_id" text,
	"tournament_id" text,
	"field" text NOT NULL,
	"value" text NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "official_entry_results" (
	"id" text PRIMARY KEY NOT NULL,
	"tournament_id" text,
	"entry_id" text,
	"school_name" text NOT NULL,
	"hybrid_school_name" text,
	"partner1" text NOT NULL,
	"partner2" text NOT NULL,
	"result" text,
	"points" real,
	"base_points" real,
	"walkover_adjustment" integer,
	"break_prelim_adjustment" integer,
	"manual_adjustment" integer,
	"incorrect_team_size" boolean DEFAULT false NOT NULL,
	"toc_qual" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "official_tournament_stats" (
	"tournament_id" text PRIMARY KEY NOT NULL,
	"open_field" integer,
	"njv_field" integer,
	"adjusted_field_size" integer,
	"open_elim_field" integer,
	"prelim_count" integer,
	"breaking_record" text,
	"prelim_adjustment" integer,
	"break_pct" real,
	"break_penalty" integer
);
--> statement-breakpoint
CREATE TABLE "ratings" (
	"id" text PRIMARY KEY NOT NULL,
	"season_id" text,
	"subject_kind" text NOT NULL,
	"subject_id" text NOT NULL,
	"tournament_id" text,
	"rating" double precision NOT NULL,
	"deviation" double precision NOT NULL,
	"volatility" double precision NOT NULL,
	"rounds_counted" integer DEFAULT 0 NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rounds" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"name" text NOT NULL,
	"tabroom_type" text,
	"kind" "round_kind" NOT NULL,
	"elim_level" "elim_level",
	"is_consolation" boolean DEFAULT false NOT NULL,
	"section_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "school_aliases" (
	"alias" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "school_season_totals" (
	"id" text PRIMARY KEY NOT NULL,
	"season_id" text NOT NULL,
	"school_id" text NOT NULL,
	"points" real NOT NULL,
	"rank" integer
);
--> statement-breakpoint
CREATE TABLE "schools" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"short_name" text,
	"region" text,
	"tabroom_chapter_id" text,
	"is_member" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seasons" (
	"id" text PRIMARY KEY NOT NULL,
	"starts_on" text NOT NULL,
	"ends_on" text NOT NULL,
	"archival" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "speaker_scores" (
	"id" text PRIMARY KEY NOT NULL,
	"ballot_id" text NOT NULL,
	"debater_id" text,
	"judge_id" text,
	"raw" real NOT NULL,
	"z" real,
	"display" real,
	"excluded" boolean DEFAULT false NOT NULL,
	"exclusion_reason" text
);
--> statement-breakpoint
CREATE TABLE "team_season_totals" (
	"id" text PRIMARY KEY NOT NULL,
	"season_id" text NOT NULL,
	"school_id" text,
	"debater1_id" text,
	"debater2_id" text,
	"points" real NOT NULL,
	"rank" integer,
	"tournaments_counted" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tournaments" (
	"id" text PRIMARY KEY NOT NULL,
	"season_id" text NOT NULL,
	"tabroom_id" text,
	"name" text NOT NULL,
	"official_name" text,
	"starts_on" text,
	"ends_on" text,
	"location" text,
	"category" text,
	"approval" text,
	"payload_hash" text,
	"fetched_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "ballots" ADD CONSTRAINT "ballots_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ballots" ADD CONSTRAINT "ballots_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ballots" ADD CONSTRAINT "ballots_judge_id_judges_id_fk" FOREIGN KEY ("judge_id") REFERENCES "public"."judges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debater_season_totals" ADD CONSTRAINT "debater_season_totals_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debater_season_totals" ADD CONSTRAINT "debater_season_totals_debater_id_debaters_id_fk" FOREIGN KEY ("debater_id") REFERENCES "public"."debaters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debaters" ADD CONSTRAINT "debaters_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disagreements" ADD CONSTRAINT "disagreements_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disagreements" ADD CONSTRAINT "disagreements_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disagreements" ADD CONSTRAINT "disagreements_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_hybrid_school_id_schools_id_fk" FOREIGN KEY ("hybrid_school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_debaters" ADD CONSTRAINT "entry_debaters_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_debaters" ADD CONSTRAINT "entry_debaters_debater_id_debaters_id_fk" FOREIGN KEY ("debater_id") REFERENCES "public"."debaters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_debaters" ADD CONSTRAINT "entry_debaters_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_results" ADD CONSTRAINT "entry_results_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_field_stats" ADD CONSTRAINT "event_field_stats_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judge_stats" ADD CONSTRAINT "judge_stats_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judge_stats" ADD CONSTRAINT "judge_stats_judge_id_judges_id_fk" FOREIGN KEY ("judge_id") REFERENCES "public"."judges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_overrides" ADD CONSTRAINT "manual_overrides_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_overrides" ADD CONSTRAINT "manual_overrides_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "official_entry_results" ADD CONSTRAINT "official_entry_results_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "official_entry_results" ADD CONSTRAINT "official_entry_results_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "official_tournament_stats" ADD CONSTRAINT "official_tournament_stats_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_aliases" ADD CONSTRAINT "school_aliases_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_season_totals" ADD CONSTRAINT "school_season_totals_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_season_totals" ADD CONSTRAINT "school_season_totals_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "speaker_scores" ADD CONSTRAINT "speaker_scores_ballot_id_ballots_id_fk" FOREIGN KEY ("ballot_id") REFERENCES "public"."ballots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "speaker_scores" ADD CONSTRAINT "speaker_scores_debater_id_debaters_id_fk" FOREIGN KEY ("debater_id") REFERENCES "public"."debaters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "speaker_scores" ADD CONSTRAINT "speaker_scores_judge_id_judges_id_fk" FOREIGN KEY ("judge_id") REFERENCES "public"."judges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_season_totals" ADD CONSTRAINT "team_season_totals_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_season_totals" ADD CONSTRAINT "team_season_totals_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_season_totals" ADD CONSTRAINT "team_season_totals_debater1_id_debaters_id_fk" FOREIGN KEY ("debater1_id") REFERENCES "public"."debaters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_season_totals" ADD CONSTRAINT "team_season_totals_debater2_id_debaters_id_fk" FOREIGN KEY ("debater2_id") REFERENCES "public"."debaters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ballots_round_idx" ON "ballots" USING btree ("round_id");--> statement-breakpoint
CREATE INDEX "ballots_entry_idx" ON "ballots" USING btree ("entry_id");--> statement-breakpoint
CREATE INDEX "ballots_judge_idx" ON "ballots" USING btree ("judge_id");--> statement-breakpoint
CREATE UNIQUE INDEX "debater_season_idx" ON "debater_season_totals" USING btree ("season_id","debater_id");--> statement-breakpoint
CREATE INDEX "debaters_school_idx" ON "debaters" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "disagreements_status_idx" ON "disagreements" USING btree ("status");--> statement-breakpoint
CREATE INDEX "entries_event_idx" ON "entries" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "entries_school_idx" ON "entries" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "entry_debaters_debater_idx" ON "entry_debaters" USING btree ("debater_id");--> statement-breakpoint
CREATE INDEX "events_tournament_idx" ON "events" USING btree ("tournament_id");--> statement-breakpoint
CREATE UNIQUE INDEX "judge_season_idx" ON "judge_stats" USING btree ("season_id","judge_id");--> statement-breakpoint
CREATE INDEX "official_entry_results_tournament_idx" ON "official_entry_results" USING btree ("tournament_id");--> statement-breakpoint
CREATE INDEX "ratings_subject_idx" ON "ratings" USING btree ("subject_kind","subject_id");--> statement-breakpoint
CREATE INDEX "rounds_event_idx" ON "rounds" USING btree ("event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "school_season_idx" ON "school_season_totals" USING btree ("season_id","school_id");--> statement-breakpoint
CREATE UNIQUE INDEX "schools_name_idx" ON "schools" USING btree ("name");--> statement-breakpoint
CREATE INDEX "speaker_scores_debater_idx" ON "speaker_scores" USING btree ("debater_id");--> statement-breakpoint
CREATE INDEX "speaker_scores_judge_idx" ON "speaker_scores" USING btree ("judge_id");--> statement-breakpoint
CREATE INDEX "team_season_totals_season_idx" ON "team_season_totals" USING btree ("season_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tournaments_tabroom_idx" ON "tournaments" USING btree ("tabroom_id");--> statement-breakpoint
CREATE INDEX "tournaments_season_idx" ON "tournaments" USING btree ("season_id");