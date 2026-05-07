
-- =========================================================
-- 1. Generic audit log
-- =========================================================
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  table_name text not null,
  row_id text,
  operation text not null,         -- INSERT | UPDATE | DELETE
  changed_keys text[],
  before jsonb,
  after  jsonb,
  context jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_table_time on public.audit_log (table_name, created_at desc);
create index if not exists idx_audit_row on public.audit_log (table_name, row_id);
create index if not exists idx_audit_actor on public.audit_log (actor_id, created_at desc);

alter table public.audit_log enable row level security;

create policy "Admins read audit"
  on public.audit_log for select
  using (public.is_admin(auth.uid()));

-- Inserts only happen via security-definer trigger so no insert policy needed.

-- Trigger function: capture row changes
create or replace function public.tg_audit_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_email text;
  v_row text;
  v_before jsonb;
  v_after  jsonb;
  v_changed text[] := array[]::text[];
  k text;
begin
  begin
    select email into v_email from public.profiles where id = v_actor;
  exception when others then v_email := null;
  end;

  if (tg_op = 'DELETE') then
    v_before := to_jsonb(old);
    v_after  := null;
    v_row := coalesce((v_before->>'id'), '');
  elsif (tg_op = 'INSERT') then
    v_before := null;
    v_after  := to_jsonb(new);
    v_row := coalesce((v_after->>'id'), '');
  else
    v_before := to_jsonb(old);
    v_after  := to_jsonb(new);
    v_row := coalesce((v_after->>'id'), (v_before->>'id'), '');
    -- compute changed keys
    for k in select jsonb_object_keys(v_after) loop
      if (v_after->k) is distinct from (v_before->k) then
        v_changed := array_append(v_changed, k);
      end if;
    end loop;
    -- skip pure timestamp-only changes
    if array_length(v_changed,1) is null
       or (array_length(v_changed,1) = 1 and v_changed[1] = 'updated_at') then
      return coalesce(new, old);
    end if;
  end if;

  insert into public.audit_log(actor_id, actor_email, table_name, row_id, operation, changed_keys, before, after)
  values (v_actor, v_email, tg_table_name, v_row, tg_op, v_changed, v_before, v_after);

  return coalesce(new, old);
end;
$$;

revoke all on function public.tg_audit_row() from public, anon, authenticated;

-- Attach to important tables
do $$
declare t text;
begin
  for t in select unnest(array[
    'profiles','user_roles','workflows','workflow_steps','workflow_fields',
    'workflow_documents','workflow_offer_templates','eligibility_rules',
    'applications','application_documents','application_responses',
    'offers','offer_documents','signatures','affidavit_submissions',
    'addresses','next_of_kin','financial_profile','banking_details','employment_details'
  ]) loop
    execute format('drop trigger if exists trg_audit_%I on public.%I', t, t);
    execute format('create trigger trg_audit_%I after insert or update or delete on public.%I for each row execute function public.tg_audit_row()', t, t);
  end loop;
end $$;

-- =========================================================
-- 2. Per-user settings (notification sound, etc.)
-- =========================================================
create table if not exists public.user_settings (
  user_id uuid primary key,
  notif_sound_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

create policy "Users view own settings"
  on public.user_settings for select using (auth.uid() = user_id);

create policy "Users upsert own settings"
  on public.user_settings for insert with check (auth.uid() = user_id);

create policy "Users update own settings"
  on public.user_settings for update using (auth.uid() = user_id);

create trigger trg_user_settings_updated
  before update on public.user_settings
  for each row execute function public.set_updated_at();

-- =========================================================
-- 3. Make sure offer_documents allows kind='template'
--    and store bucket name explicitly so multi-doc offers
--    can mix template + signed copies cleanly.
-- =========================================================
alter table public.offer_documents
  add column if not exists bucket text;

-- Backfill bucket for existing rows
update public.offer_documents
   set bucket = case when kind = 'signed' then 'offer-signed' else 'offer-templates' end
 where bucket is null;
