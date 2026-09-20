import { getSupabaseClient } from '../lib/supabase';

export async function generateOfficialAdministrativeDocument(applicationId: string) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase indisponible');

  const { data, error } = await supabase.functions.invoke('generate-official-document', {
    body: { application_id: applicationId },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}
