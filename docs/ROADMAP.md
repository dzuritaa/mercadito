# Roadmap

Ideas, roughly in order. Nothing here is promised; issues and pull requests can change the order.

## Known gaps

- **Allergens on recipes.** Members can record allergies and diets, but recipes don't know their allergens yet, so menus only respect vegetarian and vegan.
- **Unit conversion.** Quantities are compared only when units match exactly (cups vs. grams can't be compared).
- **More than one account per household.** The data model allows it; the interface doesn't yet.
- **Single-language fields.** Pantry notes, receipt notes, and rating comments are stored in the language they were written in.

## Next

- Allergen and ingredient tags on recipes, used by the menu planner.
- Recipe import and export (file and URL).
- Installable on phones (PWA) and a faster shopping-list view for the store.
- More interface languages (Portuguese is a natural next one).

## Later

- Receipt photo upload with optional text recognition.
- Voice entry for groceries.
- Smarter substitutions and recipe suggestions.
- A read-only assistant integration (MCP) to ask questions about the pantry, menu, and spending; any change would still need confirmation in the app.
