-- Stitch Voice Chat v2 — Supabase schema
-- Run this whole file once in Supabase > SQL Editor > New query > Run.
-- Safe to re-run: it uses "if not exists" / "or replace" where it can.
--
-- Security model
--   * Every table has row-level security (RLS) ON.
--   * Shop staff (signed in with a magic link) can read and write only rows where shop_id is their shop.
--   * The public (clients, not signed in) never touch tables directly. They go through a few
--     SECURITY DEFINER functions below: read a shop's public page, book a job, and read or
--     message their own job using its unguessable token.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- tables

create table if not exists public.shops (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,40}$'),
  name             text not null check (char_length(name) between 1 and 120),
  city             text not null default 'Toronto',
  hours            text not null default '',
  etransfer_email  text not null default '',
  logo_url         text,
  deposit_percent  int  not null default 30 check (deposit_percent between 0 and 100),
  rates            jsonb not null default '{
     "fabricLowPerYd": 30, "fabricHighPerYd": 90,
     "labour": {"sofa": 650, "loveseat": 520, "sectional": 1100, "armchair": 380, "wingback": 450,
                "ottoman": 180, "dining_chair": 75, "headboard": 260, "bench": 200,
                "car_seat": 220, "boat_cushion": 120},
     "foamHr": 180, "foamStandard": 120, "supplies": 60 }'::jsonb,
  trial_started_at timestamptz not null default now(),
  plan             text not null default 'trial' check (plan in ('trial','active','past_due','cancelled')),
  created_at       timestamptz not null default now()
);

create table if not exists public.staff (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid not null references public.shops(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete cascade,
  email      text not null,
  role       text not null default 'staff' check (role in ('owner','staff')),
  created_at timestamptz not null default now(),
  unique (shop_id, email)
);
create index if not exists staff_user_idx on public.staff(user_id);

create table if not exists public.clients (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid not null references public.shops(id) on delete cascade,
  name       text not null,
  email      text,
  phone      text,
  notes      text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists clients_shop_idx on public.clients(shop_id);

create table if not exists public.jobs (
  id            uuid primary key default gen_random_uuid(),
  shop_id       uuid not null references public.shops(id) on delete cascade,
  client_id     uuid references public.clients(id) on delete set null,
  token         text not null unique default encode(gen_random_bytes(24), 'hex'),
  stage         text not null default 'lead'
                check (stage in ('lead','quoted','deposit','in_progress','ready','picked_up')),
  title         text not null default '',
  piece         text,
  width         numeric,
  depth         numeric,
  height        numeric,
  units         text check (units in ('in','cm')),
  fabric        text,
  notes         text not null default '',
  estimate_low  numeric,
  estimate_high numeric,
  dropoff_date  date,
  pickup_date   date,
  transcript    jsonb not null default '[]'::jsonb,
  renders       jsonb not null default '[]'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists jobs_shop_idx on public.jobs(shop_id);

create table if not exists public.job_photos (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid not null references public.shops(id) on delete cascade,
  job_id     uuid not null references public.jobs(id) on delete cascade,
  url        text not null,
  kind       text not null default 'before' check (kind in ('before','after','progress','render')),
  caption    text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists job_photos_job_idx on public.job_photos(job_id);

create table if not exists public.quotes (
  id            uuid primary key default gen_random_uuid(),
  shop_id       uuid not null references public.shops(id) on delete cascade,
  job_id        uuid not null references public.jobs(id) on delete cascade,
  yards         numeric not null default 0,
  fabric_name   text not null default '',
  fabric_per_yd numeric not null default 0,
  labour        numeric not null default 0,
  foam          numeric not null default 0,
  supplies      numeric not null default 0,
  discount      numeric not null default 0,
  subtotal      numeric not null default 0,
  hst           numeric not null default 0,
  total         numeric not null default 0,
  notes         text not null default '',
  sent_at       timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists quotes_job_idx on public.quotes(job_id);

create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid not null references public.shops(id) on delete cascade,
  job_id     uuid not null references public.jobs(id) on delete cascade,
  sender     text not null check (sender in ('client','shop')),
  body       text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists messages_job_idx on public.messages(job_id);

create table if not exists public.suppliers (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid not null references public.shops(id) on delete cascade,
  name       text not null,
  category   text not null default '',
  phone      text not null default '',
  email      text not null default '',
  website    text not null default '',
  address    text not null default '',
  notes      text not null default '',
  verified   boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.swatches (
  id            uuid primary key default gen_random_uuid(),
  shop_id       uuid not null references public.shops(id) on delete cascade,
  name          text not null,
  material      text not null default '',
  colour        text not null default '',
  hex           text not null default '#888888',
  price_per_yd  numeric,
  cleaning_code text not null default '',
  double_rubs   int,
  image_url     text,
  in_stock      boolean not null default true,
  created_at    timestamptz not null default now()
);

create table if not exists public.bookings (
  id              uuid primary key default gen_random_uuid(),
  shop_id         uuid not null references public.shops(id) on delete cascade,
  job_id          uuid not null references public.jobs(id) on delete cascade,
  client_id       uuid references public.clients(id) on delete set null,
  preferred_dates date[] not null default '{}',
  contact_method  text not null default 'email',
  message         text not null default '',
  status          text not null default 'requested' check (status in ('requested','confirmed','cancelled')),
  created_at      timestamptz not null default now()
);

-- "Teach Stitch": the shop's own answers, added to Stitch's knowledge for that shop only.
create table if not exists public.shop_faq (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid not null references public.shops(id) on delete cascade,
  question   text not null check (char_length(question) between 3 and 300),
  answer     text not null check (char_length(answer) between 1 and 1500),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- helpers

create or replace function public.is_staff(p_shop uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff s where s.shop_id = p_shop and s.user_id = auth.uid());
$$;

create or replace function public.is_owner(p_shop uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff s where s.shop_id = p_shop and s.user_id = auth.uid() and s.role = 'owner');
$$;

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists jobs_touch on public.jobs;
create trigger jobs_touch before update on public.jobs for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- row-level security

alter table public.shops      enable row level security;
alter table public.staff      enable row level security;
alter table public.clients    enable row level security;
alter table public.jobs       enable row level security;
alter table public.job_photos enable row level security;
alter table public.quotes     enable row level security;
alter table public.messages   enable row level security;
alter table public.suppliers  enable row level security;
alter table public.swatches   enable row level security;
alter table public.bookings   enable row level security;
alter table public.shop_faq   enable row level security;

drop policy if exists shops_staff_select on public.shops;
create policy shops_staff_select on public.shops for select to authenticated using (public.is_staff(id));
drop policy if exists shops_owner_update on public.shops;
create policy shops_owner_update on public.shops for update to authenticated using (public.is_owner(id)) with check (public.is_owner(id));

-- Owners may edit their shop's profile and rates, but not the plan or trial dates.
revoke update on public.shops from anon, authenticated;
grant update (name, slug, city, hours, etransfer_email, logo_url, deposit_percent, rates) on public.shops to authenticated;

drop policy if exists staff_select on public.staff;
create policy staff_select on public.staff for select to authenticated using (public.is_staff(shop_id));
drop policy if exists staff_owner_write on public.staff;
create policy staff_owner_write on public.staff for all to authenticated using (public.is_owner(shop_id)) with check (public.is_owner(shop_id));

-- Same rule for every shop-owned table: staff of that shop only.
do $$
declare t text;
begin
  foreach t in array array['clients','jobs','job_photos','quotes','messages','suppliers','swatches','bookings','shop_faq'] loop
    execute format('drop policy if exists %I on public.%I', t || '_staff_all', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_staff(shop_id)) with check (public.is_staff(shop_id))',
      t || '_staff_all', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- staff functions

-- First sign-in: create a shop and make the signed-in user its owner.
create or replace function public.create_shop(p_name text, p_slug text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_email text := coalesce(auth.jwt() ->> 'email', '');
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if exists (select 1 from staff where user_id = auth.uid()) then raise exception 'You already belong to a shop'; end if;
  insert into shops (name, slug) values (trim(p_name), lower(trim(p_slug))) returning id into v_id;
  insert into staff (shop_id, user_id, email, role) values (v_id, auth.uid(), v_email, 'owner');
  return v_id;
end $$;

-- Returns the signed-in user's shop id. Also links any staff invite made for their email.
create or replace function public.my_shop()
returns uuid language plpgsql security definer set search_path = public as $$
declare v_email text := lower(coalesce(auth.jwt() ->> 'email', '')); v_id uuid;
begin
  if auth.uid() is null then return null; end if;
  update staff set user_id = auth.uid() where user_id is null and lower(email) = v_email;
  select shop_id into v_id from staff where user_id = auth.uid() order by created_at limit 1;
  return v_id;
end $$;

-- ---------------------------------------------------------------- public (client) functions

create or replace function public.public_shop(p_slug text)
returns json language sql stable security definer set search_path = public as $$
  select case when s.id is null then null else json_build_object(
    'shop', json_build_object('id', s.id, 'slug', s.slug, 'name', s.name, 'city', s.city, 'hours', s.hours,
                              'etransfer_email', s.etransfer_email, 'logo_url', s.logo_url,
                              'deposit_percent', s.deposit_percent, 'rates', s.rates),
    'swatches', coalesce((select json_agg(w order by w.material, w.name) from (
        select id, name, material, colour, hex, price_per_yd, cleaning_code, double_rubs, image_url, in_stock
        from swatches where shop_id = s.id) w), '[]'::json),
    'faq', coalesce((select json_agg(json_build_object('id', f.id, 'question', f.question, 'answer', f.answer))
                     from shop_faq f where f.shop_id = s.id), '[]'::json)
  ) end
  from (select * from shops where slug = lower(p_slug)) s
  right join (select 1) one on true;
$$;

create or replace function public.public_create_booking(
  p_slug text, p_name text, p_email text, p_phone text, p_preferred_dates date[],
  p_contact_method text, p_message text, p_sheet jsonb,
  p_estimate_low numeric, p_estimate_high numeric, p_transcript jsonb, p_renders jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare v_shop shops; v_client uuid; v_job jobs;
begin
  select * into v_shop from shops where slug = lower(p_slug);
  if v_shop.id is null then raise exception 'Shop not found'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Name is required'; end if;
  if coalesce(trim(p_email), '') = '' and coalesce(trim(p_phone), '') = '' then raise exception 'Email or phone is required'; end if;
  if char_length(p_name) > 120 or char_length(coalesce(p_message, '')) > 2000 then raise exception 'Too long'; end if;

  insert into clients (shop_id, name, email, phone)
  values (v_shop.id, trim(p_name), nullif(trim(p_email), ''), nullif(trim(p_phone), ''))
  returning id into v_client;

  insert into jobs (shop_id, client_id, stage, title, piece, width, depth, height, units, fabric, notes,
                    estimate_low, estimate_high, transcript, renders)
  values (v_shop.id, v_client, 'lead',
          coalesce(nullif(p_sheet ->> 'piece', ''), 'piece') || ' for ' || trim(p_name),
          nullif(p_sheet ->> 'piece', ''), (p_sheet ->> 'width')::numeric, (p_sheet ->> 'depth')::numeric,
          (p_sheet ->> 'height')::numeric, nullif(p_sheet ->> 'units', ''), nullif(p_sheet ->> 'fabric', ''),
          coalesce(p_message, ''), p_estimate_low, p_estimate_high,
          coalesce(p_transcript, '[]'::jsonb), coalesce(p_renders, '[]'::jsonb))
  returning * into v_job;

  insert into bookings (shop_id, job_id, client_id, preferred_dates, contact_method, message)
  values (v_shop.id, v_job.id, v_client, coalesce(p_preferred_dates, '{}'), coalesce(p_contact_method, 'email'), coalesce(p_message, ''));

  return json_build_object('token', v_job.token, 'job_id', v_job.id, 'shop_id', v_shop.id);
end $$;

create or replace function public.public_get_job(p_token text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'job', json_build_object('id', j.id, 'stage', j.stage, 'title', j.title, 'piece', j.piece, 'width', j.width,
             'depth', j.depth, 'height', j.height, 'units', j.units, 'fabric', j.fabric,
             'estimate_low', j.estimate_low, 'estimate_high', j.estimate_high,
             'dropoff_date', j.dropoff_date, 'pickup_date', j.pickup_date, 'renders', j.renders,
             'created_at', j.created_at, 'updated_at', j.updated_at),
    'shop', json_build_object('name', s.name, 'slug', s.slug, 'hours', s.hours, 'city', s.city,
             'etransfer_email', s.etransfer_email, 'deposit_percent', s.deposit_percent),
    'client_name', c.name,
    'photos', coalesce((select json_agg(p order by p.created_at) from (
        select id, url, kind, caption, created_at from job_photos where job_id = j.id) p), '[]'::json),
    'quote', (select row_to_json(q) from (
        select yards, fabric_name, fabric_per_yd, labour, foam, supplies, discount, subtotal, hst, total, notes, sent_at
        from quotes where job_id = j.id and sent_at is not null order by sent_at desc limit 1) q),
    'messages', coalesce((select json_agg(m order by m.created_at) from (
        select id, sender, body, created_at from messages where job_id = j.id) m), '[]'::json)
  )
  from jobs j join shops s on s.id = j.shop_id left join clients c on c.id = j.client_id
  where j.token = p_token and char_length(p_token) >= 32;
$$;

create or replace function public.public_add_message(p_token text, p_body text)
returns void language plpgsql security definer set search_path = public as $$
declare v_job jobs;
begin
  select * into v_job from jobs where token = p_token and char_length(p_token) >= 32;
  if v_job.id is null then raise exception 'Job not found'; end if;
  if (select count(*) from messages where job_id = v_job.id and created_at > now() - interval '1 hour') > 30 then
    raise exception 'Too many messages, try later';
  end if;
  insert into messages (shop_id, job_id, sender, body) values (v_job.shop_id, v_job.id, 'client', left(trim(p_body), 4000));
end $$;

create or replace function public.public_add_photo(p_token text, p_url text, p_kind text, p_caption text)
returns void language plpgsql security definer set search_path = public as $$
declare v_job jobs;
begin
  select * into v_job from jobs where token = p_token and char_length(p_token) >= 32;
  if v_job.id is null then raise exception 'Job not found'; end if;
  if p_url !~ '^https://' then raise exception 'Bad url'; end if;
  if (select count(*) from job_photos where job_id = v_job.id) >= 20 then raise exception 'Photo limit reached'; end if;
  insert into job_photos (shop_id, job_id, url, kind, caption)
  values (v_job.shop_id, v_job.id, p_url, case when p_kind in ('before','render') then p_kind else 'before' end, left(coalesce(p_caption, ''), 200));
end $$;

grant execute on function public.public_shop(text) to anon, authenticated;
grant execute on function public.public_create_booking(text, text, text, text, date[], text, text, jsonb, numeric, numeric, jsonb, jsonb) to anon, authenticated;
grant execute on function public.public_get_job(text) to anon, authenticated;
grant execute on function public.public_add_message(text, text) to anon, authenticated;
grant execute on function public.public_add_photo(text, text, text, text) to anon, authenticated;
grant execute on function public.create_shop(text, text) to authenticated;
grant execute on function public.my_shop() to authenticated;
-- Postgres lets PUBLIC run new functions by default; staff-only ones must not be callable signed out.
revoke execute on function public.create_shop(text, text) from public, anon;
revoke execute on function public.my_shop() from public, anon;

-- ---------------------------------------------------------------- photo storage
-- Bucket "photos" is public-read so images load by URL. File names are random UUIDs under
-- <shop_id>/<job_id>/, so a link cannot be guessed. Anyone may upload into a real shop's folder
-- (clients upload before/after photos); only that shop's staff may delete.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- Security definer, because signed-out clients cannot read the shops table themselves.
create or replace function public.shop_exists(p_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from shops where id::text = p_id);
$$;
grant execute on function public.shop_exists(text) to anon, authenticated;

drop policy if exists photos_upload on storage.objects;
create policy photos_upload on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'photos' and public.shop_exists((storage.foldername(name))[1]));

drop policy if exists photos_staff_delete on storage.objects;
create policy photos_staff_delete on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and public.is_staff(((storage.foldername(name))[1])::uuid));
