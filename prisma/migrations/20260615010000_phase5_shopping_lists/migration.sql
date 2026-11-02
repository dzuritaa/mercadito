-- CreateEnum
CREATE TYPE "MealPlanStatus" AS ENUM ('draft', 'approved', 'archived');

-- CreateEnum
CREATE TYPE "MealPlanItemStatus" AS ENUM ('suggested', 'approved', 'planned', 'cooked', 'skipped', 'rejected');

-- CreateEnum
CREATE TYPE "MealType" AS ENUM ('lunch', 'dinner');

-- CreateEnum
CREATE TYPE "ShoppingListStatus" AS ENUM ('draft', 'active', 'completed', 'archived');

-- CreateTable
CREATE TABLE "meal_plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "week_start_date" DATE NOT NULL,
    "status" "MealPlanStatus" NOT NULL DEFAULT 'draft',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "meal_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_plan_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "meal_plan_id" UUID NOT NULL,
    "recipe_id" UUID NOT NULL,
    "planned_date" DATE NOT NULL,
    "meal_type" "MealType" NOT NULL DEFAULT 'dinner',
    "servings_planned" INTEGER NOT NULL DEFAULT 4,
    "status" "MealPlanItemStatus" NOT NULL DEFAULT 'planned',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meal_plan_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shopping_lists" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "meal_plan_id" UUID,
    "name" TEXT NOT NULL,
    "status" "ShoppingListStatus" NOT NULL DEFAULT 'draft',
    "target_start_date" DATE,
    "target_end_date" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "shopping_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shopping_list_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "shopping_list_id" UUID NOT NULL,
    "grocery_item_id" UUID,
    "custom_item_name" TEXT,
    "needed_quantity" DECIMAL(10,2),
    "have_quantity" DECIMAL(10,2),
    "buy_quantity" DECIMAL(10,2),
    "unit" TEXT,
    "category_id" UUID,
    "preferred_store_id" UUID,
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "converted_to_inventory_at" TIMESTAMPTZ(6),
    "is_extra_item" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "shopping_list_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "meal_plans_status_week_start_date_idx" ON "meal_plans"("status", "week_start_date");

-- CreateIndex
CREATE INDEX "meal_plan_items_meal_plan_id_idx" ON "meal_plan_items"("meal_plan_id");

-- CreateIndex
CREATE INDEX "meal_plan_items_recipe_id_idx" ON "meal_plan_items"("recipe_id");

-- CreateIndex
CREATE UNIQUE INDEX "meal_plan_items_meal_plan_id_planned_date_meal_type_key" ON "meal_plan_items"("meal_plan_id", "planned_date", "meal_type");

-- CreateIndex
CREATE INDEX "shopping_lists_status_created_at_idx" ON "shopping_lists"("status", "created_at");

-- CreateIndex
CREATE INDEX "shopping_lists_meal_plan_id_idx" ON "shopping_lists"("meal_plan_id");

-- CreateIndex
CREATE INDEX "shopping_list_items_shopping_list_id_idx" ON "shopping_list_items"("shopping_list_id");

-- CreateIndex
CREATE INDEX "shopping_list_items_checked_idx" ON "shopping_list_items"("checked");

-- AddForeignKey
ALTER TABLE "meal_plan_items" ADD CONSTRAINT "meal_plan_items_meal_plan_id_fkey" FOREIGN KEY ("meal_plan_id") REFERENCES "meal_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_plan_items" ADD CONSTRAINT "meal_plan_items_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopping_lists" ADD CONSTRAINT "shopping_lists_meal_plan_id_fkey" FOREIGN KEY ("meal_plan_id") REFERENCES "meal_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopping_list_items" ADD CONSTRAINT "shopping_list_items_shopping_list_id_fkey" FOREIGN KEY ("shopping_list_id") REFERENCES "shopping_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopping_list_items" ADD CONSTRAINT "shopping_list_items_grocery_item_id_fkey" FOREIGN KEY ("grocery_item_id") REFERENCES "grocery_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopping_list_items" ADD CONSTRAINT "shopping_list_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "grocery_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopping_list_items" ADD CONSTRAINT "shopping_list_items_preferred_store_id_fkey" FOREIGN KEY ("preferred_store_id") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddConstraint
ALTER TABLE "shopping_list_items" ADD CONSTRAINT "shopping_list_items_name_check" CHECK ("grocery_item_id" IS NOT NULL OR NULLIF(TRIM("custom_item_name"), '') IS NOT NULL);
