import { createClient } from '@supabase/supabase-js';

const decodeJwtPayload = (key?: string | null): any | null => {
  if (!key || !key.includes('.')) return null;
  try {
    let payload = key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    while (payload.length % 4) payload += '=';
    return JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
  } catch {
    return null;
  }
};

export const getSupabaseServerKey = (req?: any) => (
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_KEY ||
  (req?.headers?.['x-supabase-key'] as string)
);

export const getSupabaseServerUrl = (req?: any) => {
  let supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || (req?.headers?.['x-supabase-url'] as string);
  if (!supabaseUrl) {
    const ref = decodeJwtPayload(getSupabaseServerKey(req))?.ref;
    if (ref) supabaseUrl = `https://${ref}.supabase.co`;
  }
  return supabaseUrl;
};

export const getSupabaseServerKeyRole = (req?: any) => decodeJwtPayload(getSupabaseServerKey(req))?.role;

export const getSupabaseAdminClient = (req?: any) => {
  const supabaseUrl = getSupabaseServerUrl(req);
  const key = getSupabaseServerKey(req);
  if (!supabaseUrl || !key || supabaseUrl.includes('demo-educo.supabase.co') || supabaseUrl.includes('your-project.supabase.co')) {
    return null;
  }
  return createClient(supabaseUrl, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
};

export const mapSupabaseSchool = (school: any) => school ? ({
  id: school.id,
  name: school.name,
  identifier: school.identifier,
  address: school.address,
  phone: school.phone,
  email: school.email,
  logo: school.logo,
  creationDate: school.creation_date || school.creationDate,
  promoterName: school.promoter_name || school.promoterName,
  promoterContact: school.promoter_contact || school.promoterContact,
  promoterEmail: school.promoter_email || school.promoterEmail,
  levels: school.levels || {},
  openingAuthorizationDoc: school.opening_authorization_doc || school.openingAuthorizationDoc,
  promoterIdDoc: school.promoter_id_doc || school.promoterIdDoc,
  statutesDoc: school.statutes_doc || school.statutesDoc,
  status: school.status,
  settings: school.settings || {},
  createdAt: school.created_at || school.createdAt,
}) : null;

export const mapSupabaseUser = (user: any) => user ? ({
  id: user.id,
  uid: user.uid,
  schoolId: user.school_id || user.schoolId,
  name: user.name || user.email?.split('@')[0] || 'Utilisateur',
  email: user.email,
  role: user.role || 'Personnel',
  avatar: user.avatar,
  status: user.status || 'active',
  studentId: user.student_id || user.studentId || user.matricule,
  parentName: user.parent_name || user.parentName,
  parentEmail: user.parent_email || user.parentEmail,
  createdAt: user.created_at || user.createdAt,
}) : null;

export const getSupabaseUserByUid = async (uid?: string | null, req?: any) => {
  if (!uid) return null;
  const supabase = getSupabaseAdminClient(req);
  if (!supabase) return null;
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('uid', uid)
    .limit(1)
    .maybeSingle();
  return mapSupabaseUser(data);
};

export const getSupabaseUserByEmail = async (email?: string | null, req?: any) => {
  if (!email) return null;
  const supabase = getSupabaseAdminClient(req);
  if (!supabase) return null;
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('email', email.toLowerCase().trim())
    .limit(1)
    .maybeSingle();
  return mapSupabaseUser(data);
};
