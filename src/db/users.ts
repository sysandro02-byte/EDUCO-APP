import { getSupabaseAdminClient, getSupabaseUserByUid, mapSupabaseUser } from './supabaseOnly.ts';

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
  return null;
}
