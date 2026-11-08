ALTER TABLE "orders" ADD COLUMN "cod_fee" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "return_fee" integer;