import express from "express";
import dotenv from "dotenv";
import crypto from "crypto";
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
    const filename = item.title + ".mp3";
    const key = crypto.randomBytes(16).toString("hex");
    await saveDownloadKey(key, filename);
    await sendDownloadEmail(customerEmail, key);
  }

  res.sendStatus(200);
});

// ✅ Health check route
app.get("/", (req, res) => {
  res.send("🎉 Digital Download Backend is Running!");
});

// ✅ Download link route
app.get("/download/:key", async (req, res) => {
  const { key } = req.params;
  const filename = await useDownloadKey(key);

  if (!filename) {
    return res.status(404).send("⛔ Invalid or expired download link");
  }

  const fileUrl = `${process.env.DOWNLOAD_BASE_URL}${filename}`;
  return res.redirect(fileUrl);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
