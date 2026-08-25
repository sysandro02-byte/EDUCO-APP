import { db, isDbConfigured } from './index.ts';
import { users } from './schema.ts';
import { eq } from 'drizzle-orm';
import { getSupabaseAdminClient, getSupabaseUserByUid, mapSupabaseUser } from './supabaseOnly.ts';

export async function getOrCreateUser(uid: string, email: string, name: string, role: string, schoolId?: number) {
  const fallbackUser = {
    id: 1,
    uid: uid || 'user_fallback',
    email: email || 'user@educo-ecole.com',
    name: name || 'Utilisateur',
    role: role || 'Admin',
    schoolId: schoolId || 1,
    avatar: null,
    status: 'active',
    createdAt: new Date(),
  };

  const supabase = getSupabaseAdminClient();
  if (supabase) {
    try {
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
      return mapSupabaseUser(data) || fallbackUser;
    } catch (error: any) {
      console.warn("Supabase notice in getOrCreateUser (using fallback):", error?.message || error);
      return fallbackUser;
    }
  }

  if (!isDbConfigured()) {
    return fallbackUser;
  }

  try {
    const result = await db.insert(users)
      .values({
        uid,
        email,
        name,
        role,
        schoolId,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          name,
          role,
          schoolId,
        },
      })
      .returning();

    return result[0] || fallbackUser;
  } catch (error: any) {
    console.warn("Database notice in getOrCreateUser (using fallback):", error?.cause?.message || error?.message || error);
    return fallbackUser;
  }
}

export async function getUserByUid(uid: string) {
  const supabaseUser = await getSupabaseUserByUid(uid);
  if (supabaseUser) return supabaseUser;

  if (!isDbConfigured() || !uid) {
    return null;
  }

  try {
    const result = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    return result[0] || null;
  } catch (error: any) {
    console.warn("Database notice in getUserByUid:", error?.cause?.message || error?.message || error);
    return null;
  }
}
