ALTER TABLE "runs" ADD COLUMN "context_window" integer;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "price_per_million_input_tokens" real;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "price_per_million_output_tokens" real;