-- Bilingual recipe content (English + Spanish).
-- Existing text columns held English content, so they are renamed to *_en
-- and a Spanish counterpart is added. Every recipe name and step must exist
-- in at least one language.

-- Recipes
ALTER TABLE "recipes" RENAME COLUMN "name" TO "name_en";
ALTER TABLE "recipes" RENAME COLUMN "description" TO "description_en";
ALTER TABLE "recipes" RENAME COLUMN "instructions_summary" TO "instructions_summary_en";
ALTER TABLE "recipes" ALTER COLUMN "name_en" DROP NOT NULL;
ALTER TABLE "recipes"
  ADD COLUMN "name_es" TEXT,
  ADD COLUMN "description_es" TEXT,
  ADD COLUMN "instructions_summary_es" TEXT;
ALTER TABLE "recipes"
  ADD CONSTRAINT "recipes_name_any_locale_check"
  CHECK ("name_en" IS NOT NULL OR "name_es" IS NOT NULL);

-- Recipe steps
ALTER TABLE "recipe_steps" RENAME COLUMN "instruction" TO "instruction_en";
ALTER TABLE "recipe_steps" ALTER COLUMN "instruction_en" DROP NOT NULL;
ALTER TABLE "recipe_steps" ADD COLUMN "instruction_es" TEXT;
ALTER TABLE "recipe_steps"
  ADD CONSTRAINT "recipe_steps_instruction_any_locale_check"
  CHECK ("instruction_en" IS NOT NULL OR "instruction_es" IS NOT NULL);

-- Recipe ingredient preparation notes
ALTER TABLE "recipe_ingredients" RENAME COLUMN "notes" TO "notes_en";
ALTER TABLE "recipe_ingredients" ADD COLUMN "notes_es" TEXT;

-- Substitution notes
ALTER TABLE "recipe_substitutions" RENAME COLUMN "substitution_note" TO "substitution_note_en";
ALTER TABLE "recipe_substitutions" ADD COLUMN "substitution_note_es" TEXT;

-- Grocery items keep "name" as the canonical identity used for matching
-- (normalized_name). Per-language display names are optional overrides.
ALTER TABLE "grocery_items"
  ADD COLUMN "name_en" TEXT,
  ADD COLUMN "name_es" TEXT;
