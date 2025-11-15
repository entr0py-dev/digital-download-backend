import express from "express"
import dotenv from "dotenv"
import crypto from "crypto"
import fetch from "node-fetch"
import { Readable } from "node:stream"
import { saveDownloadKey, useDownloadKey } from "./db.js"
import { sendDownloadEmail } from "./email.js"
import archiver from "archiver"

dotenv.config()

const app = express()

// 👇 Capture raw body for webhook signature verification
app.use(
    "/webhook",
    express.raw({ type: "application/json" })
)

// ✅ Shopify webhook handler
app.post("/webhook", (req, res) => {
    const hmacHeader = req.get("X-Shopify-Hmac-Sha256")
    const topic = req.get("X-Shopify-Topic")
    const domain = req.get("X-Shopify-Shop-Domain")
    const rawBody = req.body.toString("utf8")

    const hash = crypto
        .createHmac("sha256", process.env.SHOPIFY_WEBHOOK_SECRET)
        .update(rawBody, "utf8")
        .digest("base64")

    console.log("📩 Incoming Shopify Webhook:", topic)
    console.log("🔑 HMAC Header:", hmacHeader)
    console.log("🔐 Computed hash:", hash)
    const verified = hash === hmacHeader

    if (!verified) {
        console.warn("❌ Invalid webhook signature")
        return res.status(401).send("Unauthorized")
    }

    console.log("✅ Signature valid")

    try {
        const data = JSON.parse(rawBody)

        console.log("📦 Webhook payload:", data)
        console.log("📧 Customer email:", data.email)
        console.log("📦 Line items:", data.line_items)

        if (topic === "orders/paid") {
            console.log("✅ Handling orders/paid...")

            // ✅ Your fulfillment logic goes here
            // await sendDownloadEmail(data.email, downloadLink)
        }

        res.status(200).send("Webhook received")
    } catch (err) {
        console.error("❌ Error parsing webhook payload:", err)
        res.status(500).send("Error")
    }
})

// ✅ Health check route
app.get("/", (req, res) => {
    res.send("🎉 Digital Download Backend is Running!")
})

// ✅ Download route (force file download)
app.get("/download/:key", async (req, res) => {
    const { key } = req.params
    const filenames = await useDownloadKey(key)

    console.log("🔑 Key:", key)
    console.log("📁 Filenames:", filenames)

    if (!filenames || !filenames.length) {
        return res.status(404).send("⛔ Invalid or expired download link")
    }

    const bucket = process.env.SUPABASE_BUCKET_NAME
    const supabaseUrl = process.env.SUPABASE_URL

    res.setHeader("Content-Disposition", `attachment; filename="download.zip"`)
    res.setHeader("Content-Type", "application/zip")

    const archive = archiver("zip", { zlib: { level: 9 } })
    archive.pipe(res)

    for (const filename of filenames) {
        const fileUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${filename}`
        const response = await fetch(fileUrl)

        if (response.ok) {
            archive.append(response.body, { name: filename })
        } else {
            console.warn(`⚠️ Failed to fetch: ${filename}`)
        }
    }

    archive.finalize()
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`)
})
