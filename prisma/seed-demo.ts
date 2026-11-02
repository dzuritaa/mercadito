/**
 * Optional demo content: four bilingual recipes with ingredients, steps,
 * tags, substitutions, and ratings, plus an approved plan for this week so
 * the shopping list can be tried right away.
 *
 *   npm run db:seed-demo
 *   (Docker: docker compose exec app npm run db:seed-demo)
 *
 * Running it again refreshes the demo recipes; it does not touch your own.
 */
import { PrismaClient } from "@prisma/client";
import { seedReferenceData } from "./reference-data";

const prisma = new PrismaClient();

type DemoRecipeIngredient = {
  categoryName: string;
  name: string;
  notes?: string;
  optional?: boolean;
  quantity: string;
  quantityDescription?: string;
  unit: string;
};

type DemoRecipeSubstitution = {
  healthImprovement: boolean;
  note: string;
  original: string;
  substitute: string;
};

type DemoRecipeSeed = {
  caloriesPerServing: string;
  carbsGPerServing: string;
  cookTimeMinutes: number;
  description: string;
  estimatedCost: string;
  fatGPerServing: string;
  ingredients: DemoRecipeIngredient[];
  instructionsSummary: string;
  name: string;
  prepTimeMinutes: number;
  proteinGPerServing: string;
  rating: {
    notes: string;
    rating: number;
    wouldCookAgain: boolean;
  };
  servings: number;
  source: string;
  steps: string[];
  substitutions: DemoRecipeSubstitution[];
  tagNames: string[];
};

const demoRecipes: DemoRecipeSeed[] = [
  {
    name: "Chicken Rice Bowls",
    description: "Simple chicken, rice, and vegetable bowls for a weekday dinner.",
    servings: 4,
    prepTimeMinutes: 15,
    cookTimeMinutes: 25,
    source: "Family default",
    instructionsSummary: "Cook rice, saute chicken and vegetables, then assemble bowls.",
    caloriesPerServing: "520",
    proteinGPerServing: "38",
    carbsGPerServing: "52",
    fatGPerServing: "18",
    estimatedCost: "10.50",
    tagNames: ["Healthy", "Kid-Friendly", "High Protein", "Budget Meal"],
    rating: { rating: 4, wouldCookAgain: true, notes: "Reliable weekday meal." },
    ingredients: [
      {
        name: "Chicken breast",
        categoryName: "Meat and Seafood",
        quantity: "1.5",
        unit: "lb",
        notes: "Cut into bite-size pieces"
      },
      {
        name: "Rice",
        categoryName: "Pantry",
        quantity: "2",
        unit: "cups"
      },
      {
        name: "Broccoli",
        categoryName: "Fruits and Vegetables",
        quantity: "2",
        unit: "cups"
      },
      {
        name: "Carrots",
        categoryName: "Fruits and Vegetables",
        quantity: "2",
        unit: "each"
      }
    ],
    steps: [
      "Cook rice according to package directions.",
      "Season and saute chicken until cooked through.",
      "Steam or saute broccoli and carrots.",
      "Serve chicken and vegetables over rice."
    ],
    substitutions: [
      {
        original: "Rice",
        substitute: "Brown rice",
        note: "Higher fiber option",
        healthImprovement: true
      }
    ]
  },
  {
    name: "Lentil Vegetable Soup",
    description: "Vegetarian soup that uses pantry lentils and flexible vegetables.",
    servings: 6,
    prepTimeMinutes: 15,
    cookTimeMinutes: 35,
    source: "Family default",
    instructionsSummary: "Simmer lentils with vegetables and broth until tender.",
    caloriesPerServing: "310",
    proteinGPerServing: "18",
    carbsGPerServing: "48",
    fatGPerServing: "6",
    estimatedCost: "7.75",
    tagNames: ["Healthy", "Vegetarian", "Budget Meal", "Freezer Friendly"],
    rating: { rating: 5, wouldCookAgain: true, notes: "Good for leftovers." },
    ingredients: [
      {
        name: "Lentils",
        categoryName: "Pantry",
        quantity: "2",
        unit: "cups"
      },
      {
        name: "Tomatoes",
        categoryName: "Fruits and Vegetables",
        quantity: "2",
        unit: "cups",
        quantityDescription: "Canned or fresh"
      },
      {
        name: "Carrots",
        categoryName: "Fruits and Vegetables",
        quantity: "3",
        unit: "each"
      },
      {
        name: "Vegetable broth",
        categoryName: "Pantry",
        quantity: "6",
        unit: "cups"
      },
      {
        name: "Spinach",
        categoryName: "Fruits and Vegetables",
        quantity: "2",
        unit: "cups",
        optional: true
      }
    ],
    steps: [
      "Saute chopped carrots until slightly softened.",
      "Add lentils, tomatoes, and vegetable broth.",
      "Simmer until lentils are tender.",
      "Stir in spinach before serving if available."
    ],
    substitutions: [
      {
        original: "Spinach",
        substitute: "Kale",
        note: "Use any sturdy green",
        healthImprovement: true
      }
    ]
  },
  {
    name: "Turkey Tacos",
    description: "Fast taco night with ground turkey, tortillas, and toppings.",
    servings: 4,
    prepTimeMinutes: 10,
    cookTimeMinutes: 15,
    source: "Family default",
    instructionsSummary: "Cook seasoned turkey and serve with tortillas and toppings.",
    caloriesPerServing: "430",
    proteinGPerServing: "32",
    carbsGPerServing: "38",
    fatGPerServing: "16",
    estimatedCost: "9.25",
    tagNames: ["Kid-Friendly", "Fast Meal", "High Protein", "Moderate"],
    rating: { rating: 4, wouldCookAgain: true, notes: "Easy Friday dinner." },
    ingredients: [
      {
        name: "Ground turkey",
        categoryName: "Meat and Seafood",
        quantity: "1",
        unit: "lb"
      },
      {
        name: "Tortillas",
        categoryName: "Pantry",
        quantity: "8",
        unit: "each"
      },
      {
        name: "Lettuce",
        categoryName: "Fruits and Vegetables",
        quantity: "2",
        unit: "cups"
      },
      {
        name: "Cheese",
        categoryName: "Dairy and Eggs",
        quantity: "1",
        unit: "cups"
      }
    ],
    steps: [
      "Brown ground turkey in a skillet.",
      "Season turkey and warm tortillas.",
      "Prepare toppings.",
      "Assemble tacos at the table."
    ],
    substitutions: [
      {
        original: "Ground turkey",
        substitute: "Black beans",
        note: "Vegetarian taco filling",
        healthImprovement: true
      }
    ]
  },
  {
    name: "Salmon with Potatoes",
    description: "Baked salmon with roasted potatoes and a simple vegetable side.",
    servings: 4,
    prepTimeMinutes: 10,
    cookTimeMinutes: 30,
    source: "Family default",
    instructionsSummary: "Roast potatoes, bake salmon, and serve with vegetables.",
    caloriesPerServing: "560",
    proteinGPerServing: "40",
    carbsGPerServing: "42",
    fatGPerServing: "24",
    estimatedCost: "15.00",
    tagNames: ["Healthy", "High Protein"],
    rating: { rating: 4, wouldCookAgain: true, notes: "Good when salmon is on sale." },
    ingredients: [
      {
        name: "Salmon",
        categoryName: "Meat and Seafood",
        quantity: "1.5",
        unit: "lb"
      },
      {
        name: "Potatoes",
        categoryName: "Fruits and Vegetables",
        quantity: "1.5",
        unit: "lb"
      },
      {
        name: "Green beans",
        categoryName: "Fruits and Vegetables",
        quantity: "1",
        unit: "lb"
      },
      {
        name: "Lemon",
        categoryName: "Fruits and Vegetables",
        quantity: "1",
        unit: "each",
        optional: true
      }
    ],
    steps: [
      "Roast potatoes until browned and tender.",
      "Season salmon and bake until flaky.",
      "Steam or saute green beans.",
      "Serve salmon with potatoes, green beans, and lemon."
    ],
    substitutions: [
      {
        original: "Salmon",
        substitute: "Chicken breast",
        note: "Lower-cost protein swap",
        healthImprovement: false
      }
    ]
  }
];

/** Spanish versions of the demo content, keyed by the English text. */
const groceryNamesEs: Record<string, string> = {
  "Chicken breast": "Pechuga de pollo",
  Rice: "Arroz",
  Broccoli: "Brócoli",
  Carrots: "Zanahorias",
  "Brown rice": "Arroz integral",
  Lentils: "Lentejas",
  Tomatoes: "Tomates",
  "Vegetable broth": "Caldo de verduras",
  Spinach: "Espinaca",
  Kale: "Col rizada",
  "Ground turkey": "Pavo molido",
  Tortillas: "Tortillas",
  Lettuce: "Lechuga",
  Cheese: "Queso",
  "Black beans": "Fréjol negro",
  Salmon: "Salmón",
  Potatoes: "Papas",
  "Green beans": "Vainitas",
  Lemon: "Limón"
};

type DemoRecipeSpanish = {
  name: string;
  description: string;
  instructionsSummary: string;
  steps: string[];
  ingredientNotes?: Record<string, string>;
  substitutionNotes: string[];
};

const demoRecipesEs: Record<string, DemoRecipeSpanish> = {
  "Chicken Rice Bowls": {
    name: "Bowls de pollo con arroz",
    description: "Bowls sencillos de pollo, arroz y verduras para una comida entre semana.",
    instructionsSummary: "Cocina el arroz, saltea el pollo y las verduras, y arma los bowls.",
    steps: [
      "Cocina el arroz según las instrucciones del paquete.",
      "Sazona el pollo y saltéalo hasta que esté bien cocido.",
      "Cocina el brócoli y las zanahorias al vapor o salteados.",
      "Sirve el pollo y las verduras sobre el arroz."
    ],
    ingredientNotes: { "Chicken breast": "Cortada en trozos pequeños" },
    substitutionNotes: ["Opción con más fibra"]
  },
  "Lentil Vegetable Soup": {
    name: "Sopa de lentejas con verduras",
    description: "Sopa vegetariana con lentejas de la despensa y las verduras que haya.",
    instructionsSummary: "Cocina las lentejas a fuego lento con verduras y caldo hasta que estén suaves.",
    steps: [
      "Saltea las zanahorias picadas hasta que se ablanden un poco.",
      "Agrega las lentejas, los tomates y el caldo de verduras.",
      "Cocina a fuego lento hasta que las lentejas estén suaves.",
      "Si hay espinaca, agrégala antes de servir."
    ],
    substitutionNotes: ["Sirve cualquier hoja verde firme"]
  },
  "Turkey Tacos": {
    name: "Tacos de pavo",
    description: "Noche de tacos rápida con pavo molido, tortillas y acompañantes.",
    instructionsSummary: "Cocina el pavo sazonado y sírvelo con tortillas y acompañantes.",
    steps: [
      "Dora el pavo molido en un sartén.",
      "Sazona el pavo y calienta las tortillas.",
      "Prepara los acompañantes.",
      "Arma los tacos en la mesa."
    ],
    substitutionNotes: ["Relleno vegetariano para tacos"]
  },
  "Salmon with Potatoes": {
    name: "Salmón con papas",
    description: "Salmón al horno con papas asadas y una guarnición sencilla de verduras.",
    instructionsSummary: "Asa las papas, hornea el salmón y sirve con verduras.",
    steps: [
      "Asa las papas hasta que estén doradas y suaves.",
      "Sazona el salmón y hornéalo hasta que se deshaga fácilmente.",
      "Cocina las vainitas al vapor o salteadas.",
      "Sirve el salmón con las papas, las vainitas y limón."
    ],
    substitutionNotes: ["Proteína más económica"]
  }
};

function normalizeName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function startOfCurrentWeek() {
  const today = new Date();
  // Local calendar day (TZ), stored as a UTC date like the rest of the app.
  const utcDate = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  const day = utcDate.getUTCDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  utcDate.setUTCDate(utcDate.getUTCDate() - daysSinceMonday);
  return utcDate;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

async function main() {
  await seedReferenceData(prisma);

  const categoryByName = new Map(
    (
      await prisma.groceryCategory.findMany({
        select: {
          id: true,
          name: true
        }
      })
    ).map((category) => [category.name, category.id])
  );

  const tagByName = new Map(
    (
      await prisma.recipeTag.findMany({
        select: {
          id: true,
          name: true
        }
      })
    ).map((tag) => [tag.name, tag.id])
  );

  async function findOrCreateGroceryItem(
    name: string,
    unit?: string,
    categoryName?: string
  ) {
    return prisma.groceryItem.upsert({
      where: {
        normalizedName: normalizeName(name)
      },
      update: {
        name,
        nameEn: name,
        nameEs: groceryNamesEs[name] ?? null,
        ...(unit ? { defaultUnit: unit } : {}),
        ...(categoryName && categoryByName.has(categoryName)
          ? { categoryId: categoryByName.get(categoryName) }
          : {})
      },
      create: {
        name,
        nameEn: name,
        nameEs: groceryNamesEs[name] ?? null,
        normalizedName: normalizeName(name),
        defaultUnit: unit,
        categoryId: categoryName ? categoryByName.get(categoryName) : undefined
      }
    });
  }

  for (const recipeSeed of demoRecipes) {
    const spanish = demoRecipesEs[recipeSeed.name];
    const recipeData = {
      nameEn: recipeSeed.name,
      nameEs: spanish?.name ?? null,
      descriptionEn: recipeSeed.description,
      descriptionEs: spanish?.description ?? null,
      servings: recipeSeed.servings,
      prepTimeMinutes: recipeSeed.prepTimeMinutes,
      cookTimeMinutes: recipeSeed.cookTimeMinutes,
      source: recipeSeed.source,
      instructionsSummaryEn: recipeSeed.instructionsSummary,
      instructionsSummaryEs: spanish?.instructionsSummary ?? null,
      caloriesPerServing: recipeSeed.caloriesPerServing,
      proteinGPerServing: recipeSeed.proteinGPerServing,
      carbsGPerServing: recipeSeed.carbsGPerServing,
      fatGPerServing: recipeSeed.fatGPerServing,
      estimatedCost: recipeSeed.estimatedCost,
      isActive: true
    };
    const existingRecipe = await prisma.recipe.findFirst({
      where: {
        nameEn: recipeSeed.name
      }
    });
    const recipe = existingRecipe
      ? await prisma.recipe.update({
          where: {
            id: existingRecipe.id
          },
          data: recipeData
        })
      : await prisma.recipe.create({
          data: recipeData
        });

    await prisma.$transaction([
      prisma.recipeIngredient.deleteMany({ where: { recipeId: recipe.id } }),
      prisma.recipeStep.deleteMany({ where: { recipeId: recipe.id } }),
      prisma.recipeTagMap.deleteMany({ where: { recipeId: recipe.id } }),
      prisma.recipeSubstitution.deleteMany({ where: { recipeId: recipe.id } })
    ]);

    for (const [index, ingredient] of recipeSeed.ingredients.entries()) {
      const groceryItem = await findOrCreateGroceryItem(
        ingredient.name,
        ingredient.unit,
        ingredient.categoryName
      );

      await prisma.recipeIngredient.create({
        data: {
          recipeId: recipe.id,
          groceryItemId: groceryItem.id,
          quantity: ingredient.quantity,
          unit: ingredient.unit,
          quantityDescription: ingredient.quantityDescription,
          optional: ingredient.optional ?? false,
          notesEn: ingredient.notes,
          notesEs: spanish?.ingredientNotes?.[ingredient.name],
          sortOrder: index + 1
        }
      });
    }

    for (const [index, instruction] of recipeSeed.steps.entries()) {
      await prisma.recipeStep.create({
        data: {
          recipeId: recipe.id,
          stepNumber: index + 1,
          instructionEn: instruction,
          instructionEs: spanish?.steps[index] ?? null
        }
      });
    }

    for (const tagName of recipeSeed.tagNames) {
      const tagId = tagByName.get(tagName);

      if (tagId) {
        await prisma.recipeTagMap.create({
          data: {
            recipeId: recipe.id,
            tagId
          }
        });
      }
    }

    for (const [substitutionIndex, substitution] of recipeSeed.substitutions.entries()) {
      const originalGroceryItem = await findOrCreateGroceryItem(substitution.original);
      const substituteGroceryItem = await findOrCreateGroceryItem(
        substitution.substitute
      );

      await prisma.recipeSubstitution.create({
        data: {
          recipeId: recipe.id,
          originalGroceryItemId: originalGroceryItem.id,
          substituteGroceryItemId: substituteGroceryItem.id,
          substitutionNoteEn: substitution.note,
          substitutionNoteEs: spanish?.substitutionNotes[substitutionIndex] ?? null,
          healthImprovement: substitution.healthImprovement
        }
      });
    }

    await prisma.recipeRating.upsert({
      where: {
        recipeId: recipe.id
      },
      update: recipeSeed.rating,
      create: {
        recipeId: recipe.id,
        ...recipeSeed.rating
      }
    });
  }

  const mealPlanRecipes = await prisma.recipe.findMany({
    where: {
      nameEn: {
        in: demoRecipes.map((recipe) => recipe.name)
      },
      isActive: true
    },
    orderBy: {
      nameEn: "asc"
    }
  });
  const weekStartDate = startOfCurrentWeek();
  const existingMealPlan = await prisma.mealPlan.findFirst({
    where: {
      weekStartDate
    }
  });

  // Never replace a menu someone already made for this week.
  if (existingMealPlan) {
    console.log("This week already has a menu; the demo menu was not created.");
    return;
  }

  const mealPlan = await prisma.mealPlan.create({
    data: {
      weekStartDate,
      status: "approved",
      notes: "Demo plan created by db:seed-demo."
    }
  });

  for (const [index, recipe] of mealPlanRecipes.slice(0, 5).entries()) {
    await prisma.mealPlanItem.create({
      data: {
        mealPlanId: mealPlan.id,
        recipeId: recipe.id,
        plannedDate: addDays(weekStartDate, index),
        mealType: "lunch_and_dinner",
        servingsPlanned: recipe.servings,
        status: "planned"
      }
    });
  }

  console.log("Demo recipes and this week's demo menu are ready.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
