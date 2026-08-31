import { getSupabaseAdminClient, getSupabaseUserByUid, mapSupabaseUser } from './supabaseOnly.ts';
import { db, isDbConfigured } from './index.ts';
import { users } from './schema.ts';
import { eq } from 'drizzle-orm';

export async function getOrCreateUser(uid: string, email: string, name: string, role: string, schoolId?: number) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    throw new Error('Supabase service role is required to create or read application users.');
  }

  const existing = await getSupabaseUserByUid(uid);
  if (existing) return existing;

  const payload = {
    uid,
    email,
    name,
    role,
    school_id: schoolId,
    status: 'active'
  };
  const { data, error } = await supabase
    .from('users')
    .insert([payload])
    .select('*')
    .single();
  if (error) throw error;

  const mapped = mapSupabaseUser(data);
  if (!mapped) {
    throw new Error('Supabase user could not be mapped after creation.');
  }

  return mapped;
}

export async function getUserByUid(uid: string) {
  const supabaseUser = await getSupabaseUserByUid(uid);
  if (supabaseUser) return supabaseUser;
  if (isDbConfigured()) {
    const [databaseUser] = await db.select().from(users).where(eq(users.uid, uid)).limit(1).catch(() => []);
    if (databaseUser) return databaseUser;
  }
  return null;
}
