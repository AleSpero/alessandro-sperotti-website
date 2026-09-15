// POST /api/contact: checks the Cloudflare Turnstile token, then emails the
// contact form to Alessandro through Resend. Replaces mail/contact_me.php, since
// Vercel doesn't run PHP.
//
// Vercel environment variables:
//   RESEND_API_KEY, TURNSTILE_SECRET_KEY,
//   CONTACT_FROM (sender on a Resend-verified domain),
//   CONTACT_TO (optional, defaults to alessandro@sperodevs.com)

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request) {
  const { RESEND_API_KEY, TURNSTILE_SECRET_KEY, CONTACT_FROM } = process.env;
  if (!RESEND_API_KEY || !TURNSTILE_SECRET_KEY || !CONTACT_FROM) {
    console.error("Missing RESEND_API_KEY, TURNSTILE_SECRET_KEY or CONTACT_FROM");
    return fail(500, "not_configured");
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return fail(400, "validation");
  }
  const field = (key, max) => String(form.get(key) ?? "").trim().slice(0, max);
  const name = field("name", 100).replace(/\s+/g, " ");
  const email = field("email", 254);
  const message = field("message", 5000);
  const token = field("cf-turnstile-response", 2048);

  if (!token) return fail(400, "captcha_missing");
  if (!(await turnstilePassed(TURNSTILE_SECRET_KEY, token, clientIp(request)))) return fail(400, "captcha_failed");
  if (!name || !message || !EMAIL_RE.test(email)) return fail(400, "validation");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: CONTACT_FROM,
      to: [process.env.CONTACT_TO || "alessandro@sperodevs.com"],
      reply_to: email,
      subject: `Website Contact Form: ${name}`,
      text: `You have received a new message from your website contact form.\n\nName: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
    }),
  });
  if (!res.ok) {
    console.error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return fail(502, "send_failed");
  }
  return Response.json({ success: true });
}

async function turnstilePassed(secret, token, ip) {
  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set("remoteip", ip);
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
    return (await res.json()).success === true;
  } catch (err) {
    console.error("Turnstile verification failed:", err);
    return false;
  }
}

function clientIp(request) {
  return request.headers.get("x-real-ip") || (request.headers.get("x-forwarded-for") || "").split(",")[0].trim();
}

function fail(status, reason) {
  return Response.json({ success: false, reason }, { status });
}
