import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './packages/db/src/schema.ts',
  out: './packages/db/migrations',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
  // Migrations are generated from the schema and reviewed before they run;
  // nothing here pushes to a database implicitly.
  strict: true,
  verbose: true,
});
