-- =====================================================================
-- My Trip Planner — schema, access control and sharing
--
-- Run this once in the Supabase SQL editor (or `supabase db push`).
-- It is idempotent enough to re-run safely on a fresh project.
--
-- Two ideas carry the whole design:
--
--  1. `trip_members` decides who can see and edit a trip. Every other
--     table's policy defers to it through SECURITY DEFINER helpers, so
--     there is exactly one place where access is defined.
--
--  2. `travelers` is deliberately NOT the same thing. A traveller is
--     someone the trip's money is split between — a child, a parent
--     without an account. A member is someone who can open the app.
--     A traveller may optionally be linked to a member.
-- =====================================================================

-- Entity ids are the same short text ids the client already generates, so a
-- trip built offline can be pushed to the cloud without remapping anything.

/* ------------------------------------------------------------------ *
 * Profiles
 * ------------------------------------------------------------------ */

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text,
  avatar_color text not null default '#1d67f0',
  created_at  timestamptz not null default now()
);

/* ------------------------------------------------------------------ *
 * Trips and membership
 * ------------------------------------------------------------------ */

create table if not exists public.trips (
  id               text primary key,
  name             text not null,
  destination      text not null default '',
  country_code     text not null default '',
  cover_image      text,
  start_date       date not null,
  end_date         date not null,
  base_currency    text not null default 'ILS',
  total_budget     numeric not null default 0,
  currencies       text[] not null default '{}',
  rates            jsonb  not null default '{}'::jsonb,
  rates_updated_at timestamptz,
  rates_source     text,
  route            text[],
  notes            text,
  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- `create type` has no IF NOT EXISTS, and this file is meant to survive being
-- run a second time after a partial first attempt.
do $$ begin
  create type public.trip_role as enum ('owner', 'editor', 'viewer');
exception when duplicate_object then null;
end $$;

create table if not exists public.trip_members (
  trip_id    text not null references public.trips (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       public.trip_role not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

create index if not exists trip_members_user_idx on public.trip_members (user_id);

-- An invite can be claimed two ways: by its token (a share link) or by
-- signing in with the email it was addressed to.
create table if not exists public.trip_invites (
  id          uuid primary key default gen_random_uuid(),
  trip_id     text not null references public.trips (id) on delete cascade,
  email       text,
  role        public.trip_role not null default 'editor',
  -- Built from gen_random_uuid(), which is core Postgres. gen_random_bytes()
  -- would have been the obvious choice but it comes from pgcrypto, which
  -- Supabase installs into a separate schema — leaving this DDL to fail or
  -- not depending on the search_path in effect.
  token       text not null unique default replace(gen_random_uuid()::text, '-', ''),
  invited_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '30 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null
);

create index if not exists trip_invites_trip_idx  on public.trip_invites (trip_id);
create index if not exists trip_invites_email_idx on public.trip_invites (lower(email));

/* ------------------------------------------------------------------ *
 * Trip content
 * ------------------------------------------------------------------ */

create table if not exists public.travelers (
  id         text primary key,
  trip_id    text not null references public.trips (id) on delete cascade,
  name       text not null,
  color      text not null default '#1d67f0',
  email      text,
  is_owner   boolean not null default false,
  -- Optional link to the account this traveller belongs to.
  user_id    uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.days (
  id             text primary key,
  trip_id        text not null references public.trips (id) on delete cascade,
  date           date not null,
  index          integer not null,
  title          text not null default '',
  base_location  text,
  hotel_id       text,
  notes          text,
  planned_budget numeric,
  updated_at     timestamptz not null default now()
);

create table if not exists public.activities (
  id                  text primary key,
  trip_id             text not null references public.trips (id) on delete cascade,
  day_id              text not null references public.days (id) on delete cascade,
  title               text not null,
  category            text not null default 'other',
  start_time          text,
  duration_min        integer,
  address             text,
  lat                 double precision,
  lng                 double precision,
  price               numeric,
  currency            text,
  notes               text,
  url                 text,
  image               text,
  booking_ref         text,
  booked              boolean not null default false,
  done                boolean not null default false,
  "order"             integer not null default 0,
  place_id            text,
  updated_at          timestamptz not null default now()
);

create index if not exists activities_trip_idx on public.activities (trip_id);
create index if not exists activities_day_idx  on public.activities (day_id);

create table if not exists public.hotels (
  id                  text primary key,
  trip_id             text not null references public.trips (id) on delete cascade,
  name                text not null default '',
  city                text not null default '',
  address             text,
  lat                 double precision,
  lng                 double precision,
  check_in            date not null,
  check_out           date not null,
  check_in_time       text,
  check_out_time      text,
  price_per_night     numeric,
  total_price         numeric,
  currency            text not null default 'ILS',
  rooms               integer,
  guests              integer,
  booking_url         text,
  booking_ref         text,
  cancellation_policy text,
  notes               text,
  images              text[],
  booked              boolean not null default false,
  paid                boolean not null default false,
  updated_at          timestamptz not null default now()
);

create index if not exists hotels_trip_idx on public.hotels (trip_id, check_in);

create table if not exists public.flights (
  id                   text primary key,
  trip_id              text not null references public.trips (id) on delete cascade,
  direction            text not null default 'outbound',
  airline              text not null default '',
  flight_number        text not null default '',
  date                 date not null,
  departure_time       text,
  arrival_time         text,
  arrives_next_day     boolean not null default false,
  from_endpoint        jsonb not null default '{}'::jsonb,
  to_endpoint          jsonb not null default '{}'::jsonb,
  baggage              text,
  seats                text,
  price                numeric,
  currency             text not null default 'ILS',
  price_is_per_person  boolean not null default false,
  booking_ref          text,
  booking_url          text,
  notes                text,
  booked               boolean not null default false,
  paid                 boolean not null default false,
  updated_at           timestamptz not null default now()
);

create index if not exists flights_trip_idx on public.flights (trip_id, date);

create table if not exists public.car_rentals (
  id                   text primary key,
  trip_id              text not null references public.trips (id) on delete cascade,
  company              text not null default '',
  car_type             text,
  pickup_date          date not null,
  pickup_time          text,
  pickup_location      text not null default '',
  pickup_lat           double precision,
  pickup_lng           double precision,
  dropoff_date         date not null,
  dropoff_time         text,
  dropoff_location     text not null default '',
  dropoff_lat          double precision,
  dropoff_lng          double precision,
  price                numeric,
  currency             text not null default 'ILS',
  insurance            text,
  deductible           numeric,
  booking_ref          text,
  booking_url          text,
  notes                text,
  booked               boolean not null default false,
  paid                 boolean not null default false,
  fuel_consumption     numeric,
  fuel_price_per_liter numeric,
  updated_at           timestamptz not null default now()
);

create table if not exists public.places (
  id         text primary key,
  trip_id    text not null references public.trips (id) on delete cascade,
  name       text not null,
  list       text not null default 'must',
  category   text not null default 'attraction',
  address    text,
  lat        double precision,
  lng        double precision,
  image      text,
  rating     numeric,
  notes      text,
  price      numeric,
  currency   text,
  url        text,
  day_id     text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists places_trip_idx on public.places (trip_id, list);

create table if not exists public.expenses (
  id            text primary key,
  trip_id       text not null references public.trips (id) on delete cascade,
  date          date not null,
  category      text not null default 'other',
  description   text not null default '',
  amount        numeric not null default 0,
  currency      text not null default 'ILS',
  paid          boolean not null default false,
  paid_by_id    text,
  split_between text[] not null default '{}',
  notes         text,
  linked_type   text,
  linked_id     text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists expenses_trip_idx on public.expenses (trip_id, date);

create table if not exists public.documents (
  id           text primary key,
  trip_id      text not null references public.trips (id) on delete cascade,
  name         text not null,
  category     text not null default 'other',
  date         date,
  url          text,
  -- Path inside the `trip-documents` storage bucket, when a file was uploaded.
  storage_path text,
  mime_type    text,
  size         bigint,
  notes        text,
  linked_type  text,
  linked_id    text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists documents_trip_idx on public.documents (trip_id);

create table if not exists public.checklists (
  id         text primary key,
  trip_id    text not null references public.trips (id) on delete cascade,
  title      text not null default '',
  "group"    text not null default 'custom',
  -- Items are edited as a unit and never queried individually, so they stay
  -- inline rather than becoming a second table with its own policies.
  items      jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists checklists_trip_idx on public.checklists (trip_id);

/* ------------------------------------------------------------------ *
 * Access helpers
 *
 * SECURITY DEFINER so they read `trip_members` without triggering that
 * table's own policies — which is what would otherwise recurse when a
 * policy on `trip_members` needs to ask "is this user a member?".
 * ------------------------------------------------------------------ */

create or replace function public.is_trip_member(p_trip text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.trip_members
    where trip_id = p_trip and user_id = auth.uid()
  );
$$;

create or replace function public.can_edit_trip(p_trip text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.trip_members
    where trip_id = p_trip and user_id = auth.uid() and role in ('owner', 'editor')
  );
$$;

create or replace function public.is_trip_owner(p_trip text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.trip_members
    where trip_id = p_trip and user_id = auth.uid() and role = 'owner'
  );
$$;

/** True when the two users share at least one trip — used for profile reads. */
create or replace function public.shares_trip_with(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.trip_members mine
    join public.trip_members theirs on theirs.trip_id = mine.trip_id
    where mine.user_id = auth.uid() and theirs.user_id = p_user
  );
$$;

/* ------------------------------------------------------------------ *
 * Triggers
 * ------------------------------------------------------------------ */

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

/** Whoever creates a trip becomes its owner, in the same transaction. */
create or replace function public.add_creator_as_owner()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid := coalesce(new.created_by, auth.uid());
begin
  -- Without this the failure surfaces as a NOT NULL violation on
  -- trip_members.user_id, which says nothing about the actual cause:
  -- a trip was inserted outside an authenticated session.
  if v_owner is null then
    raise exception
      'a trip must be created by a signed-in user (auth.uid() was null)'
      using errcode = '28000';
  end if;

  insert into public.trip_members (trip_id, user_id, role)
  values (new.id, v_owner, 'owner')
  on conflict (trip_id, user_id) do nothing;
  return new;
end;
$$;

/** Mirrors a new auth user into `profiles`, and claims any invites for them. */
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do nothing;

  insert into public.trip_members (trip_id, user_id, role)
  select i.trip_id, new.id, i.role
  from public.trip_invites i
  where i.accepted_at is null
    and i.expires_at > now()
    and i.email is not null
    and lower(i.email) = lower(new.email)
  on conflict (trip_id, user_id) do nothing;

  update public.trip_invites
  set accepted_at = now(), accepted_by = new.id
  where accepted_at is null
    and expires_at > now()
    and email is not null
    and lower(email) = lower(new.email);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.stamp_trip_creator()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.created_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists trips_stamp_creator on public.trips;
create trigger trips_stamp_creator
  before insert on public.trips
  for each row execute function public.stamp_trip_creator();

drop trigger if exists trips_add_owner on public.trips;
create trigger trips_add_owner
  after insert on public.trips
  for each row execute function public.add_creator_as_owner();

do $$
declare t text;
begin
  foreach t in array array[
    'trips','travelers','days','activities','hotels','flights','car_rentals',
    'places','expenses','documents','checklists'
  ] loop
    execute format('drop trigger if exists touch_%1$s on public.%1$I', t);
    execute format(
      'create trigger touch_%1$s before update on public.%1$I
       for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

/* ------------------------------------------------------------------ *
 * Joining a trip by invite token
 *
 * SECURITY DEFINER because the person calling it is, by definition, not
 * yet a member and so cannot read the invite through RLS.
 * ------------------------------------------------------------------ */

create or replace function public.accept_trip_invite(p_token text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_invite public.trip_invites;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select * into v_invite from public.trip_invites where token = p_token;

  if v_invite.id is null then
    raise exception 'invite not found' using errcode = 'P0002';
  end if;
  if v_invite.expires_at <= now() then
    raise exception 'invite expired' using errcode = 'P0003';
  end if;

  insert into public.trip_members (trip_id, user_id, role)
  values (v_invite.trip_id, auth.uid(), v_invite.role)
  on conflict (trip_id, user_id) do nothing;

  -- A link invite stays usable for the rest of the family; an invite aimed
  -- at one email is spent once it is used.
  if v_invite.email is not null then
    update public.trip_invites
    set accepted_at = now(), accepted_by = auth.uid()
    where id = v_invite.id;
  end if;

  return v_invite.trip_id;
end;
$$;

/** Lets the join screen name the trip before the user commits to joining. */
create or replace function public.peek_trip_invite(p_token text)
returns table (trip_id text, trip_name text, destination text, role public.trip_role, expired boolean)
language sql stable security definer set search_path = public as $$
  select t.id, t.name, t.destination, i.role, (i.expires_at <= now())
  from public.trip_invites i
  join public.trips t on t.id = i.trip_id
  where i.token = p_token;
$$;

/* ------------------------------------------------------------------ *
 * Row level security
 * ------------------------------------------------------------------ */

alter table public.profiles     enable row level security;
alter table public.trips        enable row level security;
alter table public.trip_members enable row level security;
alter table public.trip_invites enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'travelers','days','activities','hotels','flights','car_rentals',
    'places','expenses','documents','checklists'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- profiles ------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_trip_with(id));

drop policy if exists profiles_upsert on public.profiles;
create policy profiles_upsert on public.profiles for insert to authenticated
  with check (id = auth.uid());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- trips ---------------------------------------------------------------
drop policy if exists trips_select on public.trips;
create policy trips_select on public.trips for select to authenticated
  using (public.is_trip_member(id));

-- `created_by` is stamped by a trigger rather than trusted from the client,
-- and is deliberately absent from the columns the app sends, so an upsert
-- that updates an existing trip can never rewrite who created it.
drop policy if exists trips_insert on public.trips;
create policy trips_insert on public.trips for insert to authenticated
  with check (auth.uid() is not null);

drop policy if exists trips_update on public.trips;
create policy trips_update on public.trips for update to authenticated
  using (public.can_edit_trip(id)) with check (public.can_edit_trip(id));

drop policy if exists trips_delete on public.trips;
create policy trips_delete on public.trips for delete to authenticated
  using (public.is_trip_owner(id));

-- trip_members --------------------------------------------------------
drop policy if exists members_select on public.trip_members;
create policy members_select on public.trip_members for select to authenticated
  using (public.is_trip_member(trip_id));

drop policy if exists members_insert on public.trip_members;
create policy members_insert on public.trip_members for insert to authenticated
  with check (public.is_trip_owner(trip_id));

drop policy if exists members_update on public.trip_members;
create policy members_update on public.trip_members for update to authenticated
  using (public.is_trip_owner(trip_id)) with check (public.is_trip_owner(trip_id));

-- An owner can remove anyone; anyone can remove themselves (leave the trip).
drop policy if exists members_delete on public.trip_members;
create policy members_delete on public.trip_members for delete to authenticated
  using (public.is_trip_owner(trip_id) or user_id = auth.uid());

-- trip_invites --------------------------------------------------------
drop policy if exists invites_select on public.trip_invites;
create policy invites_select on public.trip_invites for select to authenticated
  using (public.is_trip_member(trip_id));

drop policy if exists invites_insert on public.trip_invites;
create policy invites_insert on public.trip_invites for insert to authenticated
  with check (public.is_trip_owner(trip_id) and invited_by = auth.uid());

drop policy if exists invites_delete on public.trip_invites;
create policy invites_delete on public.trip_invites for delete to authenticated
  using (public.is_trip_owner(trip_id));

-- trip content --------------------------------------------------------
-- Read for any member, write for owners and editors. Identical everywhere,
-- so it is generated rather than repeated eleven times by hand.
do $$
declare t text;
begin
  foreach t in array array[
    'travelers','days','activities','hotels','flights','car_rentals',
    'places','expenses','documents','checklists'
  ] loop
    execute format('drop policy if exists %1$s_select on public.%1$I', t);
    execute format(
      'create policy %1$s_select on public.%1$I for select to authenticated
       using (public.is_trip_member(trip_id))', t);

    execute format('drop policy if exists %1$s_insert on public.%1$I', t);
    execute format(
      'create policy %1$s_insert on public.%1$I for insert to authenticated
       with check (public.can_edit_trip(trip_id))', t);

    execute format('drop policy if exists %1$s_update on public.%1$I', t);
    execute format(
      'create policy %1$s_update on public.%1$I for update to authenticated
       using (public.can_edit_trip(trip_id)) with check (public.can_edit_trip(trip_id))', t);

    execute format('drop policy if exists %1$s_delete on public.%1$I', t);
    execute format(
      'create policy %1$s_delete on public.%1$I for delete to authenticated
       using (public.can_edit_trip(trip_id))', t);
  end loop;
end $$;

/* ------------------------------------------------------------------ *
 * Realtime
 * ------------------------------------------------------------------ */

do $$
declare t text;
begin
  foreach t in array array[
    'trips','travelers','days','activities','hotels','flights','car_rentals',
    'places','expenses','documents','checklists','trip_members'
  ] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception
      when duplicate_object then null;
      when undefined_object then null; -- publication absent outside Supabase
    end;
  end loop;
end $$;

/* ------------------------------------------------------------------ *
 * Document storage
 *
 * Objects are stored as `<trip_id>/<file>`, so the first path segment is
 * the trip and the same membership helpers decide access. The bucket is
 * private; the app hands out short-lived signed URLs.
 *
 * Wrapped so the migration still runs against a bare Postgres (the test
 * harness), where the `storage` schema does not exist.
 * ------------------------------------------------------------------ */

do $$
begin
  insert into storage.buckets (id, name, public)
  values ('trip-documents', 'trip-documents', false)
  on conflict (id) do nothing;

  execute $p$drop policy if exists trip_documents_read on storage.objects$p$;
  execute $p$create policy trip_documents_read on storage.objects for select to authenticated
    using (bucket_id = 'trip-documents'
           and public.is_trip_member((storage.foldername(name))[1]))$p$;

  execute $p$drop policy if exists trip_documents_insert on storage.objects$p$;
  execute $p$create policy trip_documents_insert on storage.objects for insert to authenticated
    with check (bucket_id = 'trip-documents'
                and public.can_edit_trip((storage.foldername(name))[1]))$p$;

  execute $p$drop policy if exists trip_documents_update on storage.objects$p$;
  execute $p$create policy trip_documents_update on storage.objects for update to authenticated
    using (bucket_id = 'trip-documents'
           and public.can_edit_trip((storage.foldername(name))[1]))$p$;

  execute $p$drop policy if exists trip_documents_delete on storage.objects$p$;
  execute $p$create policy trip_documents_delete on storage.objects for delete to authenticated
    using (bucket_id = 'trip-documents'
           and public.can_edit_trip((storage.foldername(name))[1]))$p$;
exception
  when undefined_table or invalid_schema_name or insufficient_privilege then
    raise notice 'storage schema unavailable — skipping bucket policies';
end $$;
