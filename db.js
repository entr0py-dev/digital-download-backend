import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_API_KEY
);

export async function saveDownloadKey(key, filename) {
  const { error } = await supabase
    .from("downloads")
    .insert({ key, filename, used: false });

  if (error) {
    console.error("❌ Error saving download key:", error);
    throw error;
  }
}

export async function useDownloadKey(key) {
  const { data, error } = await supabase
    .from("downloads")
    .select("filename")
    .eq("key", key)
    .eq("used", false)
    .single();

  if (error || !data) {
    console.warn("⚠️ Invalid or already used key:", error || "No data");
    return null;
  }

  // Mark as used
  const { error: updateError } = await supabase
    .from("downloads")
    .update({ used: true })
    .eq("key", key);

  if (updateError) {
    console.error("❌ Error marking key as used:", updateError);
  }

  return data.filename;
}
