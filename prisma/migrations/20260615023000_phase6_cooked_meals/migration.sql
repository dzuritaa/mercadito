CREATE TYPE "CookedIngredientDeductionStatus" AS ENUM ('deducted', 'partial', 'manual_review');

CREATE TABLE "cooked_meals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "recipe_id" UUID NOT NULL,
    "meal_plan_item_id" UUID,
    "cooked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "servings_cooked" INTEGER NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cooked_meals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cooked_meal_ingredients" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cooked_meal_id" UUID NOT NULL,
    "recipe_ingredient_id" UUID,
    "grocery_item_id" UUID NOT NULL,
    "ingredient_name" TEXT NOT NULL,
    "requested_quantity" DECIMAL(10,2),
    "requested_unit" TEXT,
    "deducted_quantity" DECIMAL(10,2),
    "deduction_status" "CookedIngredientDeductionStatus" NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cooked_meal_ingredients_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cooked_meals_cooked_at_idx" ON "cooked_meals"("cooked_at");

CREATE INDEX "cooked_meals_recipe_id_idx" ON "cooked_meals"("recipe_id");

CREATE INDEX "cooked_meals_meal_plan_item_id_idx" ON "cooked_meals"("meal_plan_item_id");

CREATE INDEX "cooked_meal_ingredients_cooked_meal_id_idx" ON "cooked_meal_ingredients"("cooked_meal_id");

CREATE INDEX "cooked_meal_ingredients_deduction_status_idx" ON "cooked_meal_ingredients"("deduction_status");

ALTER TABLE "cooked_meals" ADD CONSTRAINT "cooked_meals_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "cooked_meals" ADD CONSTRAINT "cooked_meals_meal_plan_item_id_fkey" FOREIGN KEY ("meal_plan_item_id") REFERENCES "meal_plan_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cooked_meal_ingredients" ADD CONSTRAINT "cooked_meal_ingredients_cooked_meal_id_fkey" FOREIGN KEY ("cooked_meal_id") REFERENCES "cooked_meals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cooked_meal_ingredients" ADD CONSTRAINT "cooked_meal_ingredients_recipe_ingredient_id_fkey" FOREIGN KEY ("recipe_ingredient_id") REFERENCES "recipe_ingredients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cooked_meal_ingredients" ADD CONSTRAINT "cooked_meal_ingredients_grocery_item_id_fkey" FOREIGN KEY ("grocery_item_id") REFERENCES "grocery_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "cooked_meals" ADD CONSTRAINT "cooked_meals_servings_cooked_check" CHECK ("servings_cooked" > 0);
