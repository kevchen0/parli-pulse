CREATE TABLE "feedback_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text,
	"email" text,
	"message" text NOT NULL,
	"sender_hash" text NOT NULL,
	"delivered_at" timestamp with time zone,
	"delivery_error" text
);
--> statement-breakpoint
CREATE INDEX "feedback_sender_idx" ON "feedback_messages" USING btree ("sender_hash","created_at");