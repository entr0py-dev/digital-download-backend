import express from "express";
import dotenv from "dotenv";
import crypto from "crypto";
import { saveDownloadKey } from "./db.js";
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
