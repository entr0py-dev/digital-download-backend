const fetch = require("node-fetch")

async function sendDownloadEmail(to, subject, body) {
    const res = await fetch("https://api.mailersend.com/v1/email", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${process.env.MAILERSEND_API_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            from: {
                email: process.env.SENDER_EMAIL,
                name: process.env.SENDER_NAME,
            },
            to: [{ email: to }],
            subject: subject,
            text: body,
        }),
    })

    if (!res.ok) {
        console.error(await res.text())
        throw new Error("Failed to send email")
    }
}

module.exports = { sendDownloadEmail }
