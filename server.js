import express from "express";
import dotenv from "dotenv";
import crypto from "crypto";
import fetch from "node-fetch";
import archiver from "archiver";
import { saveDownloadKey, useDownloadKey } from "./db.js";
import { sendDownloadEmail } from "./email.js";

dotenv.config();

const app = express();

// Capture raw body for signature verification
app.use(
    "/webhook",
    express.raw({ type: "application/json" })
);

// 🧪 Verify Shopify webhook signature
function verifyShopifyWebhook(rawBody, hmacHeader) {
    const generated = crypto
        .createHmac("sha256", process.env.SHOPIFY_WEBHOOK_SECRET)
        .update(rawBody, "utf8")
        .digest("base64");

    return generated === hmacHeader;
}

// ✅ WEBHOOK
app.post("/webhook", async (req, res) => {
    try {
        const rawBody = req.body.toString("utf8");
        const hmacHeader = req.get("X-Shopify-Hmac-Sha256");
        const topic = req.get("X-Shopify-Topic");

        console.log("📩 Incoming Shopify Webhook:", topic);

        // Verify Shopify signature
        if (!verifyShopifyWebhook(rawBody, hmacHeader)) {
            console.log("❌ Invalid HMAC");
            return res.status(401).send("Unauthorized");
        }

        console.log("✅ Signature valid");

        const data = JSON.parse(rawBody);
        const email = data.email;
        const lineItems = data.line_items || [];

        console.log("📧 Customer email:", email);
        console.log("📦 Line items:", lineItems);

        // Extract SKU(s)
        const skus = lineItems.map(item => item.sku).filter(Boolean);

        if (skus.length === 0) {
            console.log("⚠️ No SKUs found for this order.");
            return res.status(200).send("OK");
        }

        const sku = skus[0]; // First SKU
        console.log("🎯 SKU:", sku);

        // Create a download key
        const downloadKey = crypto.randomUUID();

        // Save download key + filenames
        await saveDownloadKey(downloadKey, sku);

        const downloadUrl = `${process.env.DOWNLOAD_BASE_URL}/download/${downloadKey}`;
        console.log("📩 Sending download link:", downloadUrl);

        // Send email
        await sendDownloadEmail(email, downloadUrl);

        res.status(200).send("Webhook processed");
    } catch (err) {
        console.error("❌ Error handling webhook:", err);
        return res.status(500).send("Error");
    }
});

// Health check
app.get("/", (req, res) => {
    res.send("🎉 Digital Download Backend is Running!");
});

// ZIP download route
app.get("/download/:key", async (req, res) => {
    const key = req.params.key;

    console.log("🔑 Download key:", key);

    const filenames = await useDownloadKey(key);

    if (!filenames || filenames.length === 0) {
        return res.status(404).send("❌ Invalid or expired link");
    }

    console.log("📁 Files to download:", filenames);

    res.setHeader("Content-Disposition", `attachment; filename="download.zip"`);
    res.setHeader("Content-Type", "application/zip");

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.pipe(res);

    // Fetch each file from Supabase and add it to ZIP
    for (const filename of filenames) {
        const fileUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/${process.env.SUPABASE_BUCKET_NAME}/${filename}`;
        console.log("⬇️ Fetching:", fileUrl);

        const response = await fetch(fileUrl);

        if (!response.ok) {
            console.warn(`⚠️ Failed to fetch ${filename}`);
            continue;
        }

        archive.append(response.body, { name: filename });
    }

    archive.finalize();
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on ${PORT}`);
});
