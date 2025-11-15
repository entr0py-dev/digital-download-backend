import express from "express";
import dotenv from "dotenv";
import crypto from "crypto";
import fetch from "node-fetch";
import { Readable } from "node:stream";
import { saveDownloadKey, useDownloadKey } from "./db.js";
import { sendDownloadEmail } from "./email.js";
import archiver from "archiver";

dotenv.config();

// Map SKU → list of filenames in Supabase bucket
const SKU_TO_FILES = {
  "DUBPACK-1": [
    "GENB_VERTIGO_1.wav",
    "GENB_VERTIGO_2.wav",
    "GENB_VERTIGO_3.wav",
    "GENB_VERTIGO_4.wav",
    "GENB_VERTIGO_5.wav"
  ]
  // You can add more SKUs later
};


const app = express();

// Capture raw body for signature verification
app.use(
  "/webhook",
  express.raw({ type: "application/json" })
);

// 🔐 Verify Shopify webhook signature
function verifyShopifyWebhook(rawBody, hmacHeader) {
  const generated = crypto
    .createHmac("sha256", process.env.SHOPIFY_WEBHOOK_SECRET)
    .update(rawBody, "utf8")
    .digest("base64");

  return generated === hmacHeader;
}

// ✅ Shopify webhook handler
app.post("/webhook", async (req, res) => {
  try {
    const rawBody = req.body.toString("utf8");
    const hmacHeader = req.get("X-Shopify-Hmac-Sha256");
    const topic = req.get("X-Shopify-Topic");
    const shopDomain = req.get("X-Shopify-Shop-Domain");

    console.log("📩 Incoming Shopify Webhook:", topic, "from", shopDomain);
    console.log("🔑 HMAC Header:", hmacHeader);

    const isValid = verifyShopifyWebhook(rawBody, hmacHeader);
    console.log("🔐 Signature valid:", isValid);

    if (!isValid) {
      console.warn("❌ Invalid webhook signature");
      return res.status(401).send("Unauthorized");
    }

    const data = JSON.parse(rawBody);
    const email = data.email;
    const lineItems = data.line_items || [];

    console.log("📧 Customer email:", email);
    console.log("📦 Line items:", lineItems);

    // Extract SKUs
    const skus = lineItems
      .map((item) => item.sku)
      .filter(Boolean);

    console.log("🎯 SKUs:", skus);

    if (!email) {
      console.warn("⚠️ No email found on order, skipping download email.");
      return res.status(200).send("OK");
    }

    if (skus.length === 0) {
      console.warn("⚠️ No SKUs found for this order, skipping download email.");
      return res.status(200).send("OK");
    }

    const sku = skus[0]; // Use the first SKU for this order
    console.log("🎯 Using SKU:", sku);

    // Generate a unique download key
    const downloadKey = crypto.randomUUID();
    console.log("🔑 Generated download key:", downloadKey);

    // Save download key + filenames for this SKU
  const filenames = SKU_TO_FILES[sku];

if (!filenames) {
  console.error(`❌ No filenames found for SKU ${sku}`);
  return res.status(500).send("No files mapped for this product");
}

await saveDownloadKey(downloadKey, filenames);

    // 👉 IMPORTANT: pass ONLY the key to the email function.
    // email.js should construct the full URL like:
    // `${BASE_URL}/download/${downloadKey}`
    console.log("📩 Sending download email with key:", downloadKey);
    await sendDownloadEmail(email, downloadKey);

    res.status(200).send("Webhook processed");
  } catch (err) {
    console.error("❌ Error handling webhook:", err);
    return res.status(500).send("Error");
  }
});

// ✅ Health check route
app.get("/", (req, res) => {
  res.send("🎉 Digital Download Backend is Running!");
});

// ✅ Download route (force ZIP download of all files for this key)
app.get("/download/:key", async (req, res) => {
  const { key } = req.params;
  console.log("🔑 Download key requested:", key);

  const filenames = await useDownloadKey(key);
  console.log("📁 Filenames for key:", filenames);

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
    console.log("⬇️ Fetching from Supabase:", fileUrl);

    const response = await fetch(fileUrl);

    if (response.ok) {
      archive.append(response.body, { name: filename });
    } else {
      console.warn(`⚠️ Failed to fetch: ${filename} (status ${response.status})`);
    }
  }

  archive.finalize();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
