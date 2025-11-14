import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);
export async function saveDownloadKey(key, filenames) {
  const response = await supabase
    .from("downloads")
    .insert([{ key, filenames }]);

  if (response.error) {
    console.error("❌ Error saving download key:", response.error);
    throw response.error;
  }
}

export async function useDownloadKey(key) {
  const { data, error } = await supabase
    .from("downloads")
    .select("filenames")
    .eq("key", key)
    .single();

  if (error || !data) return null;

  await supabase.from("downloads").delete().eq("key", key);

  return data.filenames;
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
