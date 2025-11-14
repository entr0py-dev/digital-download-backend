import express from "express";
import dotenv from "dotenv";
import crypto from "crypto";
import fetch from "node-fetch";
import { Readable } from "node:stream";
import { saveDownloadKey, useDownloadKey } from "./db.js";
import { sendDownloadEmail } from "./email.js";

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

  try {
    const filename = await useDownloadKey(key);
    console.log("🔑 Received key:", key);
    console.log("📁 Found filename:", filename);

    if (!filename) {
      return res.status(404).send("⛔ Invalid or expired download link");
    }

    const bucket = process.env.SUPABASE_BUCKET_NAME;
    const supabaseUrl = process.env.SUPABASE_URL;
    const fileUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${filename}`;
    console.log("➡️ Fetching file from:", fileUrl);

    const fetchResponse = await fetch(fileUrl);
    if (!fetchResponse.ok) {
      console.error("❌ Fetch failed:", fetchResponse.status, await fetchResponse.text());
      return res.status(500).send("❌ Failed to fetch file from Supabase");
    }

   const stream = fetchResponse.body;

    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", fetchResponse.headers.get("Content-Type") || "application/octet-stream");

    stream.pipe(res);
  } catch (err) {
    console.error("⚠️ Download error:", err);
    return res.status(500).send("⚠️ Server error during download");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
