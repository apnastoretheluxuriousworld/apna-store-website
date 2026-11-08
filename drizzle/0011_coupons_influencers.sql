CREATE TABLE "influencers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"handle" text,
	"phone" text,
	"commission_percent" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "influencers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "coupons" ADD COLUMN "max_discount" integer;--> statement-breakpoint
ALTER TABLE "coupons" ADD COLUMN "per_customer_limit" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "coupons" ADD COLUMN "first_order_only" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "coupons" ADD COLUMN "influencer_id" uuid;--> statement-breakpoint
ALTER TABLE "coupons" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "coupons" ADD COLUMN "starts_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "coupon_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "influencer_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "commission" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_influencer_id_influencers_id_fk" FOREIGN KEY ("influencer_id") REFERENCES "public"."influencers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_influencer_id_influencers_id_fk" FOREIGN KEY ("influencer_id") REFERENCES "public"."influencers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "coupons_influencer_id_index" ON "coupons" USING btree ("influencer_id");--> statement-breakpoint
CREATE INDEX "orders_coupon_id_index" ON "orders" USING btree ("coupon_id");--> statement-breakpoint
CREATE INDEX "orders_influencer_id_index" ON "orders" USING btree ("influencer_id");--> statement-breakpoint
CREATE INDEX "orders_customer_phone_index" ON "orders" USING btree ("customer_phone");