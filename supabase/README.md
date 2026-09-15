# Contact-form follow-up

People who type their email into the contact form but never send it get **one**
follow-up email, personalised by AI from whatever they had written.

```
browser ──capture_contact_lead()──▶ contact_leads (Supabase, RLS: no public access)
                                          │
pg_cron, hourly ──▶ Edge Function contact-lead-followup
                      ├─ OpenRouter: what project is this? genuine or spam?
                      ├─ Resend: follow-up to the lead + summary to you
                      └─ marks the lead done (one email per address, ever)
```

- The website only ever holds the project URL and the **publishable** key; with them it can
  call two functions (save a draft, mark it sent) and nothing else. It can't read any lead.
- OpenRouter and Resend keys live only in Supabase secrets.
- The email copy is fixed. The AI only supplies a short project phrase and picks a related
  past project from a fixed list, and both are validated. Whatever a visitor types can't put
  links or arbitrary text into an email sent from your address.
- Safety rails: at most 10 follow-ups per 24 h, 10 new leads per IP per day, drafts older
  than 7 days are never contacted, and every row is deleted after 30 days.

## Setup

Use a dedicated Supabase project (or at least not one holding production data): its
publishable key becomes public on the website.

1. **Database.** From the repo root:

   ```bash
   supabase link --project-ref <project-ref>
   supabase db push
   ```

2. **Tell the scheduler where the function lives.** In the dashboard's SQL editor:

   ```sql
   select vault.create_secret(
     'https://<project-ref>.supabase.co/functions/v1/contact-lead-followup',
     'contact_lead_followup_url');
   ```

3. **Secrets and deploy.** Start in dry-run mode: every follow-up goes to you instead of
   the lead, so you can review a few before going live.

   ```bash
   supabase secrets set OPENROUTER_API_KEY=... RESEND_API_KEY=... \
     FOLLOWUP_FROM="Alessandro Sperotti <alessandro@sperodevs.com>" \
     FOLLOWUP_NOTIFY_EMAIL=alessandro@sperodevs.com \
     FOLLOWUP_DRY_RUN=true
   supabase functions deploy contact-lead-followup
   ```

   `FOLLOWUP_FROM` must be on a domain verified in Resend.

4. **Website.** In `www.alessandrosperotti.com/template.html`, fill in
   `window.LEAD_CAPTURE` with the project URL and publishable key
   (Project Settings → API Keys), then push: Vercel runs `build.py` and deploys. The
   privacy note under the email field only appears once this is set.

5. **Go live** once the dry-run emails look right:

   ```bash
   supabase secrets set FOLLOWUP_DRY_RUN=false
   ```

## Settings (Supabase secrets)

| Secret | Default | |
|---|---|---|
| `OPENROUTER_API_KEY` | none | Without it every lead gets the generic email |
| `OPENROUTER_MODEL` | `anthropic/claude-opus-5` | Any OpenRouter model with structured outputs |
| `RESEND_API_KEY` | required | |
| `FOLLOWUP_FROM` | required | Sender, on a Resend-verified domain |
| `FOLLOWUP_REPLY_TO` | `alessandro@sperodevs.com` | Where the lead's reply goes |
| `FOLLOWUP_NOTIFY_EMAIL` | none | Gets a summary of each follow-up (draft + email sent) |
| `FOLLOWUP_DELAY_HOURS` | `24` | Hours of inactivity before following up |
| `FOLLOWUP_DAILY_CAP` | `10` | Max follow-ups per 24 h |
| `FOLLOWUP_DRY_RUN` | off | `true`: send follow-ups to `FOLLOWUP_NOTIFY_EMAIL` instead |

## Checking on it

```sql
-- recent leads and what happened to them
select email, lang, followup_status, followup_note, updated_at
  from contact_leads order by updated_at desc limit 20;

-- scheduler runs
select status, return_message, start_time
  from cron.job_run_details order by start_time desc limit 10;
```

To test without waiting a day, set `FOLLOWUP_DELAY_HOURS=0`, fill the form without sending
it, then run the job once:

```sql
select net.http_post(
  url     := (select decrypted_secret from vault.decrypted_secrets where name = 'contact_lead_followup_url'),
  headers := jsonb_build_object('x-followup-token',
             (select decrypted_secret from vault.decrypted_secrets where name = 'contact_lead_followup_token')),
  body    := '{}'::jsonb);
```
