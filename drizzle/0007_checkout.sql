ALTER TYPE "public"."payment_method" ADD VALUE 'upi';--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "access_token" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_proof_url" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_reference" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_note" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "cod_consent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_accessToken_unique" UNIQUE("access_token");