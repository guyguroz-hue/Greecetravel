-- Minimal stand-in for the pieces of Supabase the migration leans on, so the
-- real migration can be executed unmodified against a plain Postgres.

create extension if not exists pgcrypto;

create schema if not exists auth;

create table if not exists auth.users (
  id                  uuid primary key default gen_random_uuid(),
  email               text unique,
  raw_user_meta_data  jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now()
);

-- Supabase resolves the current user from the request's JWT claims.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::json ->> 'sub', '')::uuid;
$$;

do $$ begin
  create role authenticated;
exception when duplicate_object then null;
end $$;

do $$ begin
  create role anon;
exception when duplicate_object then null;
end $$;

grant usage on schema public, auth to authenticated, anon;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
