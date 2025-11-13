import fetch from "node-fetch";

export async function sendDownloadEmail(to, key) {
  const downloadUrl = `${process.env.DOWNLOAD_BASE_URL}${key}`;

  const subject = "Your Digital Download";
  const body = `Thanks for your purchase!\n\nYour one-time download link:\n${downloadUrl}\n\nThis link works once. If you need help, reply to this email.`;

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
      subject,
      text: body,
    }),
  });

  if (!res.ok) {
    console.error(await res.text());
    throw new Error("❌ Failed to send email");
  }
}
