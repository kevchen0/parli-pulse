import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.ts';

export type Database = ReturnType<typeof createDb>['db'];

/**
 * Opens a pool against DATABASE_URL. Callers own the lifetime and should call
 * `close()`; scripts that forget will hang rather than exit.
 */
export function createDb(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Add it to .env (see plan/04-architecture.md).');
  }
  const pool = new pg.Pool({ connectionString, max: 8 });
  return { db: drizzle(pool, { schema }), close: () => pool.end() };
}
