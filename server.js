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

// ✅ Debug Webhook route
app.post("/webhook", express.raw({ type: "application/json" }), (req, res) => {
    const hmacHeader = req.get("X-Shopify-Hmac-Sha256")
    const topic = req.get("X-Shopify-Topic")
    const domain = req.get("X-Shopify-Shop-Domain")

    const rawBody = req.body.toString("utf8")
    const verified = verifyShopifyWebhook(rawBody, hmacHeader)

    console.log(`📩 Incoming Shopify Webhook: ${topic} from ${domain}`)
    console.log(`🔐 Verified: ${verified}`)
    console.log("📦 Raw Payload:", rawBody)

    if (!verified) {
        return res.status(401).send("Unauthorized webhook")
    }

    // Handle webhook topic (e.g. orders/paid)
    try {
        const data = JSON.parse(rawBody)

        if (topic === "orders/paid") {
            console.log("✅ Handling orders/paid:", data)
            // Your custom logic here
        } else {
            console.log(`⚠️ Unhandled topic: ${topic}`)
        }

        res.status(200).send("Webhook received")
    } catch (err) {
        console.error("❌ Error parsing webhook:", err)
        res.status(500).send("Error")
    }
})


  const hash = crypto
    .createHmac("sha256", process.env.SHOPIFY_WEBHOOK_SECRET)
    .update(rawBody, "utf8")
    .digest("base64");

  console.log("🔐 Computed hash:", hash);
  console.log("🔑 HMAC header:", hmacHeader);

  if (hash !== hmacHeader) {
    console.warn("❌ Invalid webhook signature");
    return res.status(401).send("Unauthorized");
  }

  console.log("✅ Signature valid");

  // Log payload fields
  console.log("Line items:", req.body?.line_items);
  console.log("Customer email:", req.body?.email);

  res.status(200).send("OK");
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
