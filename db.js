import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Save a new download key (linked to a file)
export async function saveDownloadKey(key, filename) {
  const { error } = await supabase
    .from("downloads")
    .insert([{ key, filename, used: false }]);

  if (error) {
    console.error("❌ Error saving download key:", error);
    throw error;
  }
}

// Validate and mark key as used (one-time access)
export async function useDownloadKey(key) {
  const { data, error } = await supabase
    .from("downloads")
    .select("*")
    .eq("key", key)
    .single();

  if (error || !data || data.used) {
    return null; // Already used or doesn't exist
  }

  await supabase
    .from("downloads")
    .update({ used: true })
    .eq("key", key);

  return data.filename;
}
