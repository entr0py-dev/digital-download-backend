import express from "express";
import dotenv from "dotenv";
import crypto from "crypto";
import { saveDownloadKey, useDownloadKey } from "./db.js";
import { sendDownloadEmail } from "./email.js";

dotenv.config();
const app = express();
app.use(express.json());

app.post("/webhook", async (req, res) => {
  const hmacHeader = req.headers["x-shopify-hmac-sha256"];
  const body = JSON.stringify(req.body);

  const hash = crypto
    .createHmac("sha256", process.env.SHOPIFY_WEBHOOK_SECRET)
    .update(body, "utf8")
    .digest("base64");

  if (hash !== hmacHeader) {
    console.warn("❌ Invalid webhook signature");
    return res.status(401).send("Unauthorized");
  }

  const lineItems = req.body?.line_items || [];
  const customerEmail = req.body?.email;

  for (const item of lineItems) {
    const filename = item.title + ".mp3"; // or whatever file naming you use
    const key = crypto.randomBytes(16).toString("hex");
    await saveDownloadKey(key, filename);
    await sendDownloadEmail(customerEmail, key);
  }

  res.sendStatus(200);
});
app.get("/", (req, res) => {
  res.send("🎉 Digital Download Backend is Running!");
});

const PORT = process.env.PORT || 3000;
app.get("/download/:key", async (req, res) => {
  const { key } = req.params;
  const filename = await useDownloadKey(key);

  if (!filename) {
    return res.status(404).send("⛔ Invalid or expired download link");
  }

  const fileUrl = `${process.env.DOWNLOAD_BASE_URL}${filename}`;
  return res.redirect(fileUrl);
});

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
