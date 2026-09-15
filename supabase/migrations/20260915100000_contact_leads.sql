-- Contact-form leads: people who typed their email into the contact form on
-- alessandrosperotti.com. Anyone who never sends the form gets a single
-- follow-up email from the contact-lead-followup Edge Function.
--
-- Access model: RLS is on and no policies exist, so the table can't be read or
-- written with the public (anon/publishable) key. The website can only call
-- the two capture RPCs below; the Edge Function works via service_role-only RPCs.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create table if not exists public.contact_leads (
    id                  uuid primary key,          -- generated in the browser, kept in localStorage
    email               text not null,
    name                text,
    message             text,
    lang                text not null default 'en' check (lang in ('en', 'it', 'zh')),
    ip_hash             text,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now(),
    submitted_at        timestamptz,               -- set when the form was actually sent
    followup_status     text check (followup_status in ('processing', 'sent', 'dry_run', 'skipped', 'failed')),
    followup_attempts   int not null default 0,
    followup_claimed_at timestamptz,
    followup_sent_at    timestamptz,
    followup_note       text
);

create index if not exists contact_leads_email_idx on public.contact_leads (email);
create index if not exists contact_leads_ip_created_idx on public.contact_leads (ip_hash, created_at);

alter table public.contact_leads enable row level security;
revoke all on table public.contact_leads from anon, authenticated;


-- Called by the website while the visitor types. Invalid input is ignored
-- silently, and a lead stops accepting updates once it was sent or followed up.
create or replace function public.capture_contact_lead(
    p_id      uuid,
    p_email   text,
    p_name    text default null,
    p_message text default null,
    p_lang    text default 'en'
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_email   text := lower(btrim(coalesce(p_email, '')));
    v_ip      text;
    v_ip_hash text;
begin
    if p_id is null or length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
        return;
    end if;

    v_ip := btrim(split_part(coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ''), ',', 1));
    if v_ip <> '' then
        v_ip_hash := encode(extensions.digest(v_ip, 'sha256'), 'hex');
        -- At most 10 new leads per IP per day.
        if not exists (select 1 from public.contact_leads where id = p_id)
           and (select count(*) from public.contact_leads
                 where ip_hash = v_ip_hash and created_at > now() - interval '1 day') >= 10 then
            return;
        end if;
    end if;

    insert into public.contact_leads as l (id, email, name, message, lang, ip_hash)
    values (
        p_id,
        v_email,
        nullif(left(btrim(p_name), 100), ''),
        nullif(left(btrim(p_message), 5000), ''),
        case when p_lang in ('en', 'it', 'zh') then p_lang else 'en' end,
        v_ip_hash
    )
    on conflict (id) do update
        set email      = excluded.email,
            name       = excluded.name,
            message    = excluded.message,
            lang       = excluded.lang,
            updated_at = now()
        where l.submitted_at is null and l.followup_status is null;
end;
$$;

-- Called by the website after the form was sent successfully. The message
-- itself already went out by email, so there's no reason to keep a copy.
create or replace function public.mark_contact_lead_submitted(p_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
    update public.contact_leads
       set submitted_at = coalesce(submitted_at, now()),
           message      = null
     where id = p_id;
$$;


-- Picks the leads that are due for a follow-up and marks them 'processing'.
-- One lead per email address, never an address that already sent the form or
-- was already followed up, and at most p_daily_cap leads per 24 hours.
-- A lead stuck in 'processing' for over an hour (crashed run) is picked again;
-- the Edge Function's Resend idempotency key prevents a double send.
create or replace function public.claim_due_contact_leads(
    p_delay_hours int,
    p_daily_cap   int,
    p_batch_size  int
) returns setof public.contact_leads
language sql
security definer
set search_path = ''
as $$
    with room as (
        select greatest(p_daily_cap - count(*)::int, 0) as n
          from public.contact_leads
         where followup_claimed_at > now() - interval '1 day'
    ),
    candidates as (
        select distinct on (d.email) d.id, d.updated_at
          from public.contact_leads d
         where d.submitted_at is null
           and (d.followup_status is null
                or (d.followup_status = 'processing' and d.followup_claimed_at < now() - interval '1 hour'))
           and d.updated_at < now() - make_interval(hours => p_delay_hours)
           and d.updated_at > now() - interval '7 days'
           and not exists (
               select 1
                 from public.contact_leads o
                where o.email = d.email
                  and o.id <> d.id
                  and (o.submitted_at is not null or o.followup_status is not null))
         order by d.email, d.updated_at desc
    ),
    picked as (
        select id
          from candidates
         order by updated_at
         limit least((select n from room), p_batch_size)
    )
    update public.contact_leads l
       set followup_status     = 'processing',
           followup_claimed_at = now(),
           followup_attempts   = l.followup_attempts + 1
      from picked
     where l.id = picked.id
       and l.submitted_at is null
       and (l.followup_status is null
            or (l.followup_status = 'processing' and l.followup_claimed_at < now() - interval '1 hour'))
    returning l.*;
$$;

-- Records the outcome of a follow-up. 'retry' puts the lead back in the queue
-- until it has been attempted 3 times. Once a lead is settled its draft is dropped.
create or replace function public.finish_contact_lead(p_id uuid, p_status text, p_note text default null)
returns void
language sql
security definer
set search_path = ''
as $$
    update public.contact_leads
       set followup_status  = case
                                  when p_status <> 'retry' then p_status
                                  when followup_attempts >= 3 then 'failed'
                                  else null
                              end,
           followup_sent_at = case when p_status in ('sent', 'dry_run') then now() else followup_sent_at end,
           followup_note    = left(p_note, 1000),
           message          = case when p_status in ('sent', 'dry_run', 'skipped') then null else message end
     where id = p_id;
$$;

-- The Edge Function checks the x-followup-token header of each call against a
-- random token that only pg_cron and this function can read.
do $$
begin
    if not exists (select 1 from vault.secrets where name = 'contact_lead_followup_token') then
        perform vault.create_secret(
            encode(extensions.gen_random_bytes(32), 'hex'),
            'contact_lead_followup_token',
            'Authenticates pg_cron calls to the contact-lead-followup Edge Function');
    end if;
end;
$$;

create or replace function public.check_contact_lead_followup_token(p_token text)
returns boolean
language sql
security definer
set search_path = ''
as $$
    select exists (
        select 1
          from vault.decrypted_secrets
         where name = 'contact_lead_followup_token'
           and decrypted_secret = p_token);
$$;


revoke execute on function public.capture_contact_lead(uuid, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.mark_contact_lead_submitted(uuid) from public, anon, authenticated;
revoke execute on function public.claim_due_contact_leads(int, int, int) from public, anon, authenticated;
revoke execute on function public.finish_contact_lead(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.check_contact_lead_followup_token(text) from public, anon, authenticated;

grant execute on function public.capture_contact_lead(uuid, text, text, text, text) to anon, authenticated;
grant execute on function public.mark_contact_lead_submitted(uuid) to anon, authenticated;
grant execute on function public.claim_due_contact_leads(int, int, int) to service_role;
grant execute on function public.finish_contact_lead(uuid, text, text) to service_role;
grant execute on function public.check_contact_lead_followup_token(text) to service_role;


-- Hourly: run the follow-up function. The function URL lives in the vault as
-- 'contact_lead_followup_url' (see supabase/README.md); until it's set, the
-- job fails harmlessly.
select cron.schedule(
    'contact-lead-followup',
    '17 * * * *',
    $cron$
    select net.http_post(
        url     := (select decrypted_secret from vault.decrypted_secrets where name = 'contact_lead_followup_url'),
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-followup-token', (select decrypted_secret from vault.decrypted_secrets where name = 'contact_lead_followup_token')),
        body    := '{}'::jsonb,
        timeout_milliseconds := 120000);
    $cron$
);

-- Daily: forget leads after 30 days.
select cron.schedule(
    'contact-leads-cleanup',
    '42 3 * * *',
    $cron$ delete from public.contact_leads where updated_at < now() - interval '30 days'; $cron$
);
