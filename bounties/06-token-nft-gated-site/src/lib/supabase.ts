import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL ?? '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY ?? '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? '';

/** Server-side client with service role key (full access) */
export const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

/** Client-side / limited client */
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

const bucket = process.env.STORAGE_BUCKET ?? 'gated-files';

/** Generate a signed URL for a file in the gated storage bucket */
export async function getSignedUrl(filePath: string, expiresIn = 3600): Promise<string | null> {
  if (!supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUrl(filePath, expiresIn);
  if (error) {
    console.error('Signed URL error:', error.message);
    return null;
  }
  return data.signedUrl;
}
