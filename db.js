import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Save key and associated filenames (array)
export async function saveDownloadKey(key, filenames) {
  const { error } = await supabase
    .from("downloads")
    .insert([{ key, filenames }]);

  if (error) {
    console.error("❌ Error saving download key:", error);
    throw error;
  }
}

// Use key and get filenames, then delete row (one-time use)
export async function useDownloadKey(key) {
  const { data, error } = await supabase
    .from("downloads")
    .select("filenames")
    .eq("key", key)
    .single();

  if (error || !data) {
    console.warn("⚠️ No matching download key found.");
    return null;
  }

  // Delete the key to prevent reuse
  await supabase
    .from("downloads")
    .delete()
    .eq("key", key);

  return data.filenames;
}
