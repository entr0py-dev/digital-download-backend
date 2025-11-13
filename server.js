const express = require("express")
const crypto = require("crypto")
const bodyParser = require("body-parser")
const { initDB, hasDownloadIssued, markDownloadIssued } = require("./db")
const { sendDownloadEmail } = require("./email")
require("dotenv").config()

const app = express()
const PORT = process.env.PORT || 3000
const WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET

app.use(bodyParser.raw({ type: "application/json" }))

app.post("/webhooks/shopify/orders-paid", async (req, res) => {
    const hmacHeader = req.get("X-Shopify-Hmac-Sha256")
    const digest = crypto
        .createHmac("sha256", WEBHOOK_SECRET)
        .update(req.body, "utf8")
        .digest("base64")

    if (digest !== hmacHeader) return res.status(401).send("Invalid webhook")

    const payload = JSON.parse(req.body.toString("utf8"))
    const orderId = payload.id
    const customerEmail = payload.email
    const lineItem = payload.line_items[0]
    const key = `${orderId}-${lineItem.id}`

    const alreadyIssued = await hasDownloadIssued(key)
    if (alreadyIssued) return res.status(200).send("Already issued")

    await markDownloadIssued(key, customerEmail)

    const link = `${process.env.DOWNLOAD_BASE_URL}${key}`
    const body = `
Hi there,

Thanks for your purchase. Here's your download link:
${link}

⚠️ This link works only once. Please download and save your file immediately.  
Once clicked, the link will expire.

- Entropy Store`

    await sendDownloadEmail(customerEmail, "Your One-Time Download Link", body)

    res.status(200).send("Download link sent")
})

initDB().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`)
    })
})
