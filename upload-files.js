import fs from "fs";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const bucket = "Entropy";

// List your local files and the names they should have in Supabase
const filesToUpload = [
  {
    localPath: "./local-files/MILEY CYRUS - WE CAN'T STOP (GEN B BOOTLEG) [DUB].wav",
    originalName: "MILEY CYRUS - WE CAN'T STOP (GEN B BOOTLEG) [DUB].wav"
  },
  {
    localPath: "./local-files/LADY GAGA - POKERFACE (VERTIGO x GEN B BOOTLEG) [DUB].wav",
    originalName: "LADY GAGA - POKERFACE (VERTIGO x GEN B BOOTLEG) [DUB].wav"
  },
  {
    localPath: "./local-files/KODAK BLACK - ZEZE (GEN-B BOOTLEG) [DUB].wav",
    originalName: "KODAK BLACK - ZEZE (GEN-B BOOTLEG) [DUB].wav"
  },
  {
    localPath: "./local-files/DIZZEE RASCAL - BONKERS (GEN B BOOTLEG) [DUB].wav",
    originalName: "DIZZEE RASCAL - BONKERS (GEN B BOOTLEG) [DUB].wav"
  },
  {
    localPath: "./local-files/DAVE FT. JHUS - SAMANTHA (VERTIGO BOOTLEG) [DUB].wav",
    originalName: "DAVE FT. JHUS - SAMANTHA (VERTIGO BOOTLEG) [DUB].wav"
  }
];

async function uploadAllFiles() {
  for (const file of filesToUpload) {
    const fileBuffer = fs.readFileSync(file.localPath);

    const sanitizedName = file.originalName.replace(/[^a-z0-9.\-_]/gi, "_");

    const { data, error } = await supabase
      .storage
      .from(bucket)
      .upload(sanitizedName, fileBuffer, {
        contentType: "audio/wav",
        upsert: false
      });

    if (error) {
      console.error(`❌ Failed to upload ${file.originalName}:`, error.message);
    } else {
      console.log(`✅ Uploaded ${file.originalName} as ${sanitizedName}`);
    }
  }
}

uploadAllFiles();
