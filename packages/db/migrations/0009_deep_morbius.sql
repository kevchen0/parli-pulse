ALTER TABLE "ratings" DROP CONSTRAINT "ratings_tournament_id_tournaments_id_fk";
--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;