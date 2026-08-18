-- ---------------------------------------------------------------------------
-- Fix: a trip could never be created in the cloud.
--
-- Every row the app syncs is sent as `insert ... on conflict (id) do update`.
-- Postgres applies SELECT policies to that statement — it has to be able to
-- read the conflicting row — and trips_select required membership. A trip
-- being created has no row in trip_members yet: that is written by an AFTER
-- INSERT trigger, which runs *after* the policy is evaluated. So the read
-- failed and the whole statement was refused with
--
--   new row violates row-level security policy for table "trips"
--
-- on the very first row, before anything could be written. A plain INSERT
-- passed, which is why this went unnoticed for so long.
--
-- The policy now also accepts the trip's creator. `created_by` is stamped by
-- a trigger and cannot be supplied by the client, so this grants nothing
-- beyond letting someone see the trip they just made.
--
-- Safe to run on a database that already has 0001_init.sql, and safe to run
-- more than once. It replaces one policy and touches no data.
-- ---------------------------------------------------------------------------

drop policy if exists trips_select on public.trips;

create policy trips_select on public.trips for select to authenticated
  using (public.is_trip_member(id) or created_by = auth.uid());
