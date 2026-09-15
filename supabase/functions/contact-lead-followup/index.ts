// Sends one follow-up email to people who started the contact form on
// alessandrosperotti.com but never sent it. Called hourly by pg_cron (see
// supabase/migrations/*_contact_leads.sql); setup steps are in supabase/README.md.

import {
  ANALYSIS_PROMPT,
  ANALYSIS_SCHEMA,
  analysisRequest,
  cleanName,
  composeFollowUp,
  composeNotification,
  parseAnalysis,
  type Analysis,
  type Lead,
} from "./email.ts";

const env = (name: string, fallback = "") => Deno.env.get(name) || fallback;

const SUPABASE_URL = env("SUPABASE_URL");
const SERVICE_KEY = env("SUPABASE_SERVICE_ROLE_KEY");
const OPENROUTER_API_KEY = env("OPENROUTER_API_KEY");
const OPENROUTER_MODEL = env("OPENROUTER_MODEL", "anthropic/claude-opus-5");
const RESEND_API_KEY = env("RESEND_API_KEY");
const FROM = env("FOLLOWUP_FROM"); // must be on a domain verified in Resend
const REPLY_TO = env("FOLLOWUP_REPLY_TO", "alessandro@sperodevs.com");
const NOTIFY_EMAIL = env("FOLLOWUP_NOTIFY_EMAIL");
const DELAY_HOURS = Number(env("FOLLOWUP_DELAY_HOURS", "24"));
const DAILY_CAP = Number(env("FOLLOWUP_DAILY_CAP", "10"));
const BATCH_SIZE = 3; // keeps a run well inside the Edge Function time limit
const DRY_RUN = env("FOLLOWUP_DRY_RUN") === "true"; // follow-ups go to NOTIFY_EMAIL instead of the lead

Deno.serve(async (req) => {
  const token = req.headers.get("x-followup-token") ?? "";
  if (!token || !(await rpc<boolean>("check_contact_lead_followup_token", { p_token: token }))) {
    return new Response("Forbidden", { status: 403 });
  }
  if (!RESEND_API_KEY || !FROM || (DRY_RUN && !NOTIFY_EMAIL)) {
    return new Response("Missing RESEND_API_KEY, FOLLOWUP_FROM or (in dry run) FOLLOWUP_NOTIFY_EMAIL", { status: 500 });
  }

  const leads = await rpc<Lead[]>("claim_due_contact_leads", {
    p_delay_hours: DELAY_HOURS,
    p_daily_cap: DAILY_CAP,
    p_batch_size: BATCH_SIZE,
  });

  const outcome: Record<string, number> = {};
  for (const lead of leads) {
    let status: string;
    let note: string | null;
    try {
      ({ status, note } = await followUp(lead));
    } catch (err) {
      status = "retry";
      note = errorMessage(err);
      console.error(`lead ${lead.id}: ${note}`);
    }
    await rpc("finish_contact_lead", { p_id: lead.id, p_status: status, p_note: note });
    outcome[status] = (outcome[status] ?? 0) + 1;
  }

  return Response.json({ claimed: leads.length, outcome });
});

async function followUp(lead: Lead): Promise<{ status: string; note: string | null }> {
  // A failed analysis only costs the personalisation, not the email.
  let analysis: Analysis | null = null;
  let note: string | null = null;
  if (lead.message && OPENROUTER_API_KEY) {
    try {
      analysis = await analyzeDraft(lead);
      if (!analysis) note = "AI answer could not be parsed; sent the generic email";
    } catch (err) {
      note = `AI unavailable (${errorMessage(err)}); sent the generic email`;
    }
  }
  if (analysis && !analysis.genuine) {
    return { status: "skipped", note: "draft doesn't look like a genuine enquiry" };
  }

  const email = composeFollowUp(lead.lang, cleanName(lead.name), analysis);
  await sendEmail({
    to: DRY_RUN ? NOTIFY_EMAIL : lead.email,
    subject: DRY_RUN ? `[DRY RUN → ${lead.email}] ${email.subject}` : email.subject,
    text: email.text,
    html: email.html,
    replyTo: REPLY_TO,
    idempotencyKey: `contact-lead-followup-${lead.id}`,
  });

  if (NOTIFY_EMAIL && !DRY_RUN) {
    try {
      const summary = composeNotification(lead, analysis, email, note);
      await sendEmail({ to: NOTIFY_EMAIL, ...summary, replyTo: lead.email, idempotencyKey: `contact-lead-notify-${lead.id}` });
    } catch (err) {
      note = [note, `notification failed: ${errorMessage(err)}`].filter(Boolean).join("; ");
    }
  }

  return { status: DRY_RUN ? "dry_run" : "sent", note };
}

async function analyzeDraft(lead: Lead): Promise<Analysis | null> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://www.alessandrosperotti.com",
      "X-Title": "alessandrosperotti.com contact follow-up",
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      max_tokens: 4000,
      reasoning: { effort: "low" },
      messages: [
        { role: "system", content: ANALYSIS_PROMPT },
        { role: "user", content: analysisRequest(lead) },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "draft_analysis", strict: true, schema: ANALYSIS_SCHEMA },
      },
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  return typeof content === "string" ? parseAnalysis(content) : null;
}

async function sendEmail(msg: {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo: string;
  idempotencyKey: string;
}): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": msg.idempotencyKey,
    },
    body: JSON.stringify({
      from: FROM,
      to: [msg.to],
      subject: msg.subject,
      text: msg.text,
      html: msg.html,
      reply_to: msg.replyTo,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

async function rpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<T> {
  // New-style secret keys (sb_secret_…) go in the apikey header only; legacy JWT keys also as Bearer.
  const auth: Record<string, string> = SERVICE_KEY.startsWith("sb_")
    ? { apikey: SERVICE_KEY }
    : { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`rpc ${fn}: ${res.status} ${(await res.text()).slice(0, 300)}`);
  const body = await res.text();
  return (body ? JSON.parse(body) : null) as T;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
