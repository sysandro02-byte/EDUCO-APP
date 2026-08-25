/**
 * Supabase-only database mode.
 *
 * PostgreSQL/Drizzle direct connections are intentionally disabled. The app must
 * use Supabase REST/Auth through `src/db/supabaseOnly.ts` and route-level
 * fallbacks instead of opening a pg Pool. This prevents Render from hanging on
 * direct Supabase Postgres connectivity and makes Supabase the single runtime DB.
 */

const disabledDbOperation = (operation: string) => {
  throw new Error(`PostgreSQL direct access disabled: use Supabase for ${operation}.`);
};

const chain = (operation: string): any => ({
  from: () => chain(operation),
  where: () => chain(operation),
  orderBy: () => chain(operation),
  limit: () => Promise.reject(new Error(`PostgreSQL direct access disabled: use Supabase for ${operation}.`)),
  values: () => chain(operation),
  set: () => chain(operation),
  returning: () => Promise.reject(new Error(`PostgreSQL direct access disabled: use Supabase for ${operation}.`)),
  then: (_resolve: any, reject: any) => reject?.(new Error(`PostgreSQL direct access disabled: use Supabase for ${operation}.`)),
  catch: (handler: any) => Promise.reject(new Error(`PostgreSQL direct access disabled: use Supabase for ${operation}.`)).catch(handler),
});

export const isDbConfigured = (): boolean => false;

export const resetPool = () => null;

export const createPool = () => null;

export const ensureSchemaColumns = async () => {
  // Supabase schema is managed in Supabase; no PostgreSQL migration is run here.
};

export const db: any = {
  select: () => chain('select'),
  insert: () => chain('insert'),
  update: () => chain('update'),
  delete: () => chain('delete'),
  execute: () => disabledDbOperation('execute'),
};
