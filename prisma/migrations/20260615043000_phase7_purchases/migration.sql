CREATE TYPE "PurchaseType" AS ENUM ('grocery', 'online_delivery', 'eating_out', 'household');

CREATE TABLE "purchases" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "store_id" UUID,
    "purchase_date" DATE NOT NULL DEFAULT CURRENT_DATE,
    "total_amount" DECIMAL(10,2),
    "purchase_type" "PurchaseType" NOT NULL DEFAULT 'grocery',
    "receipt_image_url" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchases_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "purchase_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "purchase_id" UUID NOT NULL,
    "grocery_item_id" UUID,
    "item_name" TEXT,
    "quantity" DECIMAL(10,2),
    "unit" TEXT,
    "unit_price" DECIMAL(10,2),
    "total_price" DECIMAL(10,2),
    "category_id" UUID,
    "added_to_inventory" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_items_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "inventory_items" ADD COLUMN "purchase_item_id" UUID;

CREATE INDEX "purchases_purchase_date_idx" ON "purchases"("purchase_date");

CREATE INDEX "purchases_purchase_type_purchase_date_idx" ON "purchases"("purchase_type", "purchase_date");

CREATE INDEX "purchases_store_id_idx" ON "purchases"("store_id");

CREATE INDEX "purchase_items_category_id_idx" ON "purchase_items"("category_id");

CREATE INDEX "purchase_items_grocery_item_id_idx" ON "purchase_items"("grocery_item_id");

CREATE INDEX "purchase_items_purchase_id_idx" ON "purchase_items"("purchase_id");

CREATE INDEX "inventory_items_purchase_item_id_idx" ON "inventory_items"("purchase_item_id");

ALTER TABLE "purchases" ADD CONSTRAINT "purchases_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_grocery_item_id_fkey" FOREIGN KEY ("grocery_item_id") REFERENCES "grocery_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "grocery_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_purchase_item_id_fkey" FOREIGN KEY ("purchase_item_id") REFERENCES "purchase_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "purchases" ADD CONSTRAINT "purchases_total_amount_check" CHECK ("total_amount" IS NULL OR "total_amount" >= 0);

ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_quantity_check" CHECK ("quantity" IS NULL OR "quantity" > 0);

ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_unit_price_check" CHECK ("unit_price" IS NULL OR "unit_price" >= 0);

ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_total_price_check" CHECK ("total_price" IS NULL OR "total_price" >= 0);

ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_name_check" CHECK ("grocery_item_id" IS NOT NULL OR NULLIF(TRIM("item_name"), '') IS NOT NULL);
