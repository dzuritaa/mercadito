# Contributing

Thanks for helping. Issues and pull requests are welcome in **English or Spanish** — *se aceptan issues y pull requests en español o inglés.*

## Ways to help

- **Report a bug**: what you did, what you expected, what happened, and your OS and browser. Screenshots help.
- **Suggest an idea**: describe the problem in your household first, then the idea.
- **Translate**: the interface lives in two dictionaries (see below). New languages are welcome.
- **Code**: pick an open issue or open one to discuss larger changes before starting.

## Development setup

You need Docker and Git. Node.js on your machine is optional (handy for editor tooling).

```sh
git clone https://github.com/dzuritaa/mercadito.git
cd mercadito
cp .env.example .env          # set POSTGRES_PASSWORD
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

With Node installed you can run the same thing as `npm run docker:dev`.

The dev setup mounts your source code into the container, so changes reload in the browser at http://localhost:3000. It also publishes PostgreSQL on `127.0.0.1:5432` (change it with `POSTGRES_PORT`).

Useful commands (run them inside the container with `docker compose exec app ...`):

| Command | What it does |
|---|---|
| `npm test` | Unit and database tests (see below) |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generate the Prisma client and run TypeScript |
| `npm run build` | Production build |
| `npx prisma migrate dev --name <change>` | Create a migration after editing `prisma/schema.prisma` |
| `npm run db:seed-demo` | Load the bilingual demo recipes |
| `npx prisma studio` | Browse the database |

Please run `test`, `lint`, `typecheck`, and `build` before opening a pull request. CI runs them too.

## Tests

Tests use [Vitest](https://vitest.dev/) and live in `tests/`:

- `tests/unit/` — pure functions (formatting, languages, passwords, planning slots). No database.
- `tests/integration/` — the real behavior against PostgreSQL: recipe matching, weekly menus, shopping lists, cooking deductions, budgets, bilingual grocery items, and sign-in.

Database tests run only when `TEST_DATABASE_URL` is set. The dev setup sets it for you, pointing to a separate database (`<your database>_test`) that is **wiped and recreated from the migrations on every run**. As a safeguard, tests refuse to run unless that database name contains `test`.

```sh
docker compose -f docker-compose.yml -f docker-compose.dev.yml run --rm app npm test
```

Without `TEST_DATABASE_URL`, `npm test` runs only the unit tests. When you change behavior, add or update a test next to the ones that cover that area (`tests/integration/fixtures.ts` has helpers to create households, recipes, and pantry items).

## How the code is organized

```
src/
  app/
    (app)/            Pages that need a signed-in, configured household
    setup/ login/     First run and sign-in
    *-actions.ts      Server actions (forms post here)
  lib/
    i18n/             Languages: config, dictionaries (en.ts, es.ts), helpers
    auth/             Password hashing and sessions
    household.ts      Household settings used across the app
    recipe-matching.ts, meal-planner.ts, shopping-lists.ts, cooking.ts, reports.ts
  middleware.ts       Session check for every request
tests/
  unit/               Fast tests without a database
  integration/        Tests against a throwaway PostgreSQL database
prisma/
  schema.prisma       Data model
  migrations/         SQL migrations (applied automatically on start)
  seed.ts             Reference data (categories, tags)
  seed-demo.ts        Optional demo recipes
```

## Conventions

- **Every visible text goes through the dictionaries** in `src/lib/i18n/dictionaries/`. Add the English text to `en.ts` and the Spanish one to `es.ts`; TypeScript fails if a key is missing in either.
- **User content can be bilingual.** Recipes store `*En` and `*Es` fields; read them with `pickLocalized` or the helpers in `src/lib/i18n/text.ts`.
- **Server actions must call `requireUser()` first.** The middleware also checks sessions, but actions check again.
- **Database changes need a migration** created with `prisma migrate dev`. Never edit a migration that is already on `main`.
- **Calendar dates** (`@db.Date`) are stored as UTC midnight; format them with `formatCalendarDate`, not `toLocaleDateString` without a time zone.
- Keep pull requests focused, and describe what you tested.

## License of contributions

By contributing, you agree that your contributions are licensed under the [GNU AGPL v3.0](LICENSE), the same license as the project.
