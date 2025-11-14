import express from "express";
import dotenv from "dotenv";
import crypto from "crypto";
import fetch from "node-fetch";
import { Readable } from "node:stream";
import { saveDownloadKey, useDownloadKey } from "./db.js";
import { sendDownloadEmail } from "./email.js";
import archiver from "archiver";

dotenv.config();

const app = express();

// 👇 Capture raw body for webhook signature verification
app.use(
  "/webhook",
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf.toString();
    },
  })
);

// ✅ Webhook route
app.post("/webhook", async (req, res) => {
  const hmacHeader = req.headers["x-shopify-hmac-sha256"];
  const rawBody = req.rawBody;

  const hash = crypto
    .createHmac("sha256", process.env.SHOPIFY_WEBHOOK_SECRET)
    .update(rawBody, "utf8")
    .digest("base64");

  if (hash !== hmacHeader) {
    console.warn("❌ Invalid webhook signature");
    return res.status(401).send("Unauthorized");
  }

  const lineItems = req.body?.line_items || [];
  const customerEmail = req.body?.email;

  for (const item of lineItems) {
   const filenames = [
  item.title + "-1.wav",
  item.title + "-2.wav",
  item.title + "-3.wav",
  item.title + "-4.wav",
  item.title + "-5.wav",
];
const key = crypto.randomBytes(16).toString("hex");
await saveDownloadKey(key, filenames);
await sendDownloadEmail(customerEmail, key);

  }

  res.sendStatus(200);
});

// ✅ Health check route
app.get("/", (req, res) => {
  res.send("🎉 Digital Download Backend is Running!");
});

// ✅ Download route (force file download)
app.get("/download/:key", async (req, res) => {
  const { key } = req.params;
  const filenames = await useDownloadKey(key);

  console.log("🔑 Key:", key);
  console.log("📁 Filenames:", filenames);

  if (!filenames || !filenames.length) {
    return res.status(404).send("⛔ Invalid or expired download link");
  }

  const bucket = process.env.SUPABASE_BUCKET_NAME;
  const supabaseUrl = process.env.SUPABASE_URL;

  res.setHeader("Content-Disposition", `attachment; filename="download.zip"`);
  res.setHeader("Content-Type", "application/zip");

  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.pipe(res);

  for (const filename of filenames) {
    const fileUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${filename}`;
    const response = await fetch(fileUrl);

    if (response.ok) {
      archive.append(response.body, { name: filename });
    } else {
      console.warn(`⚠️ Failed to fetch: ${filename}`);
    }
  }

  archive.finalize();
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
