import fetch from "node-fetch";

export async function sendDownloadEmail(to, key) {
  // FIXED 🔥 — use backend URL, not the Supabase file URL
  const downloadUrl = `${process.env.BACKEND_URL}/download/${key}`;

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

  const responseBody = await res.text();

  console.log("📤 MailerSend response status:", res.status);
  console.log("📨 MailerSend response body:", responseBody);

  if (!res.ok) {
    throw new Error("❌ Failed to send email");
  }
}
