// Sends one follow-up email to people who started the contact form on
// alessandrosperotti.com but never sent it. Called hourly by pg_cron (see
// supabase/migrations/*_contact_leads.sql); setup steps are in supabase/README.md.
//
// Every step logs a "[followup] <event>" line with JSON details, visible under
// Edge Functions → contact-lead-followup → Logs. Secrets are never logged and
// email addresses are masked.

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
  const started = Date.now();
  log("invoked", {
    method: req.method,
    hasToken: req.headers.has("x-followup-token"),
    config: {
      delayHours: DELAY_HOURS,
      dailyCap: DAILY_CAP,
      batchSize: BATCH_SIZE,
      dryRun: DRY_RUN,
      model: OPENROUTER_MODEL,
      from: FROM || null,
      replyTo: REPLY_TO,
      notify: NOTIFY_EMAIL ? mask(NOTIFY_EMAIL) : null,
      hasOpenRouterKey: !!OPENROUTER_API_KEY,
      hasResendKey: !!RESEND_API_KEY,
      hasServiceKey: !!SERVICE_KEY,
      serviceKeyStyle: SERVICE_KEY.startsWith("sb_") ? "sb_secret" : SERVICE_KEY ? "legacy_jwt" : null,
    },
  });

  try {
    const token = req.headers.get("x-followup-token") ?? "";
    if (!token) {
      log("rejected: no x-followup-token header");
      return new Response("Forbidden", { status: 403 });
    }
    if (!(await rpc<boolean>("check_contact_lead_followup_token", { p_token: token }))) {
      log("rejected: token doesn't match the vault");
      return new Response("Forbidden", { status: 403 });
    }
    log("token ok");

    const missing = [
      !RESEND_API_KEY && "RESEND_API_KEY",
      !FROM && "FOLLOWUP_FROM",
      DRY_RUN && !NOTIFY_EMAIL && "FOLLOWUP_NOTIFY_EMAIL (needed in dry run)",
    ].filter(Boolean);
    if (missing.length) {
      logError("stopping: missing secrets, no lead was touched", { missing });
      return new Response(`Missing secrets: ${missing.join(", ")}`, { status: 500 });
    }
    if (!OPENROUTER_API_KEY) log("OPENROUTER_API_KEY not set: every lead gets the generic email");

    const leads = await rpc<Lead[]>("claim_due_contact_leads", {
      p_delay_hours: DELAY_HOURS,
      p_daily_cap: DAILY_CAP,
      p_batch_size: BATCH_SIZE,
    });
    log("claimed", {
      count: leads.length,
      leads: leads.map((l) => ({ id: l.id, email: mask(l.email), lang: l.lang, hasName: !!l.name, messageChars: l.message?.length ?? 0 })),
    });
    if (!leads.length) {
      log("nothing due", {
        hint: `leads become due ${DELAY_HOURS}h after the visitor's last edit, if they never sent the form, weren't followed up before, and the daily cap (${DAILY_CAP}) isn't reached`,
      });
    }

    const results: { id: string; status: string; note: string | null }[] = [];
    for (const lead of leads) {
      let status: string;
      let note: string | null;
      try {
        ({ status, note } = await followUp(lead));
      } catch (err) {
        status = "retry";
        note = errorMessage(err);
        logError("lead failed, will retry next run", { id: lead.id, error: note, stack: err instanceof Error ? err.stack : undefined });
      }
      try {
        await rpc("finish_contact_lead", { p_id: lead.id, p_status: status, p_note: note });
        log("lead finished", { id: lead.id, status, note });
      } catch (err) {
        logError("could not record the outcome", { id: lead.id, status, error: errorMessage(err) });
      }
      results.push({ id: lead.id, status, note });
    }

    const outcome: Record<string, number> = {};
    for (const r of results) outcome[r.status] = (outcome[r.status] ?? 0) + 1;
    log("done", { claimed: leads.length, outcome, ms: Date.now() - started });
    return Response.json({ claimed: leads.length, outcome, leads: results });
  } catch (err) {
    logError("run crashed", { error: errorMessage(err), stack: err instanceof Error ? err.stack : undefined });
    return new Response(`Run crashed: ${errorMessage(err)}`, { status: 500 });
  }
});

async function followUp(lead: Lead): Promise<{ status: string; note: string | null }> {
  log("lead start", { id: lead.id, email: mask(lead.email), lang: lead.lang });

  // A failed analysis only costs the personalisation, not the email.
  let analysis: Analysis | null = null;
  let note: string | null = null;
  if (!lead.message) {
    log("ai skipped: the draft has no message", { id: lead.id });
  } else if (!OPENROUTER_API_KEY) {
    log("ai skipped: OPENROUTER_API_KEY not set", { id: lead.id });
  } else {
    try {
      analysis = await analyzeDraft(lead);
      if (!analysis) note = "AI answer could not be parsed; sent the generic email";
    } catch (err) {
      note = `AI unavailable (${errorMessage(err)}); sent the generic email`;
      logError("ai failed, using the generic email", { id: lead.id, error: errorMessage(err) });
    }
  }
  if (analysis && !analysis.genuine) {
    log("skipped: the AI says the draft isn't a genuine enquiry", { id: lead.id });
    return { status: "skipped", note: "draft doesn't look like a genuine enquiry" };
  }

  const name = cleanName(lead.name);
  const email = composeFollowUp(lead.lang, name, analysis);
  log("email composed", {
    id: lead.id,
    subject: email.subject,
    personalised: !!analysis?.project,
    relatedWork: analysis?.work ?? null,
    nameUsed: !!name,
    nameDropped: !!lead.name && !name,
  });

  const to = DRY_RUN ? NOTIFY_EMAIL : lead.email;
  log("sending follow-up", { id: lead.id, to: mask(to), dryRun: DRY_RUN });
  const emailId = await sendEmail({
    to,
    subject: DRY_RUN ? `[DRY RUN → ${lead.email}] ${email.subject}` : email.subject,
    text: email.text,
    html: email.html,
    replyTo: REPLY_TO,
    idempotencyKey: `contact-lead-followup-${lead.id}`,
  });
  log("follow-up sent", { id: lead.id, resendId: emailId });

  if (NOTIFY_EMAIL && !DRY_RUN) {
    try {
      const summary = composeNotification(lead, analysis, email, note);
      const notifyId = await sendEmail({ to: NOTIFY_EMAIL, ...summary, replyTo: lead.email, idempotencyKey: `contact-lead-notify-${lead.id}` });
      log("notification sent", { id: lead.id, resendId: notifyId });
    } catch (err) {
      note = [note, `notification failed: ${errorMessage(err)}`].filter(Boolean).join("; ");
      logError("notification failed (the follow-up itself was sent)", { id: lead.id, error: errorMessage(err) });
    }
  }

  return { status: DRY_RUN ? "dry_run" : "sent", note };
}

async function analyzeDraft(lead: Lead): Promise<Analysis | null> {
  log("ai request", { id: lead.id, model: OPENROUTER_MODEL, draftChars: lead.message?.length ?? 0 });
  const started = Date.now();
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
  const body = await res.text();
  log("ai response", { id: lead.id, status: res.status, ms: Date.now() - started });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${body.slice(0, 300)}`);

  const data = JSON.parse(body);
  const choice = data?.choices?.[0];
  log("ai details", {
    id: lead.id,
    servedBy: data?.model ?? null,
    provider: data?.provider ?? null,
    finishReason: choice?.finish_reason ?? null,
    usage: data?.usage ?? null,
    error: data?.error ?? null,
    content: typeof choice?.message?.content === "string" ? choice.message.content.slice(0, 500) : choice?.message?.content ?? null,
  });

  const content = choice?.message?.content;
  const analysis = typeof content === "string" ? parseAnalysis(content) : null;
  if (analysis) {
    log("ai parsed", { id: lead.id, genuine: analysis.genuine, project: analysis.project, work: analysis.work });
  } else {
    logError("ai answer unusable (empty, not JSON, or missing is_genuine)", { id: lead.id });
  }
  return analysis;
}

async function sendEmail(msg: {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo: string;
  idempotencyKey: string;
}): Promise<string | null> {
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
  const body = await res.text();
  log("resend response", { to: mask(msg.to), status: res.status, body: body.slice(0, 300) });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${body.slice(0, 300)}`);
  try {
    return JSON.parse(body).id ?? null;
  } catch {
    return null;
  }
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
  const body = await res.text();
  if (!res.ok) {
    logError("database call failed", { fn, status: res.status, body: body.slice(0, 300) });
    throw new Error(`rpc ${fn}: ${res.status} ${body.slice(0, 300)}`);
  }
  return (body ? JSON.parse(body) : null) as T;
}

function log(event: string, data?: Record<string, unknown>) {
  console.log(`[followup] ${event}`, data ? JSON.stringify(data) : "");
}

function logError(event: string, data?: Record<string, unknown>) {
  console.error(`[followup] ${event}`, data ? JSON.stringify(data) : "");
}

// "mario.rossi@example.com" -> "ma***@example.com"
function mask(email: string): string {
  const [user, domain] = email.split("@");
  return domain ? `${user.slice(0, 2)}***@${domain}` : "***";
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
