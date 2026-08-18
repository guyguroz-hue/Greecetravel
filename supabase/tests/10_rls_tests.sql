-- Access-control tests. Every assertion runs as `authenticated` with a real
-- JWT claim, so the policies are exercised exactly as they will be in
-- production. Any failure aborts the script.

\set ON_ERROR_STOP on

create or replace function tst.as_user(p uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p)::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function tst.ok(cond boolean, label text) returns void
language plpgsql as $$
begin
  if cond then
    raise notice 'PASS  %', label;
  else
    raise exception 'FAIL  %', label;
  end if;
end $$;

/* ---------------- fixtures ---------------- */

do $$
declare
  v_owner uuid; v_editor uuid; v_viewer uuid; v_stranger uuid;
begin
  insert into auth.users (email) values ('owner@example.com')    returning id into v_owner;
  insert into auth.users (email) values ('editor@example.com')   returning id into v_editor;
  insert into auth.users (email) values ('viewer@example.com')   returning id into v_viewer;
  insert into auth.users (email) values ('stranger@example.com') returning id into v_stranger;

  insert into tst.ids values
    ('owner', v_owner), ('editor', v_editor),
    ('viewer', v_viewer), ('stranger', v_stranger);
end $$;

/* ---------------- 1. creating a trip makes you its owner ---------------- */

begin;
  select tst.as_user((select id from tst.ids where k = 'owner'));

  insert into public.trips (id, name, start_date, end_date, created_by)
  values ('trip_a', 'North Greece', '2026-08-22', '2026-09-04',
          (select id from tst.ids where k = 'owner'));

  select tst.ok(
    exists (select 1 from public.trip_members
            where trip_id = 'trip_a'
              and user_id = (select id from tst.ids where k = 'owner')
              and role = 'owner'),
    'creator is added as owner by trigger');

  select tst.ok((select count(*) from public.trips where id = 'trip_a') = 1,
    'owner can read their own trip');
commit;

/* ---------------- 2. a stranger sees nothing ---------------- */

begin;
  select tst.as_user((select id from tst.ids where k = 'stranger'));
  select tst.ok((select count(*) from public.trips) = 0,
    'non-member cannot see the trip');
commit;

-- ... and cannot write into it either.
begin;
  select tst.as_user((select id from tst.ids where k = 'stranger'));
  savepoint s;
  do $$
  begin
    insert into public.activities (id, trip_id, day_id, title)
    values ('act_x', 'trip_a', 'day_x', 'sneaky');
    raise exception 'FAIL  non-member insert should have been blocked';
  exception
    when insufficient_privilege then raise notice 'PASS  non-member cannot insert content';
    when foreign_key_violation  then raise notice 'PASS  non-member cannot insert content';
  end $$;
  rollback to savepoint s;
commit;

/* ---------------- 3. owner adds members ---------------- */

begin;
  select tst.as_user((select id from tst.ids where k = 'owner'));

  insert into public.trip_members (trip_id, user_id, role)
  values ('trip_a', (select id from tst.ids where k = 'editor'), 'editor'),
         ('trip_a', (select id from tst.ids where k = 'viewer'), 'viewer');

  select tst.ok((select count(*) from public.trip_members where trip_id = 'trip_a') = 3,
    'owner can add members');

  insert into public.days (id, trip_id, date, index, title)
  values ('day_1', 'trip_a', '2026-08-22', 1, 'Thessaloniki');
commit;

/* ---------------- 4. an editor can write, a viewer cannot ---------------- */

begin;
  select tst.as_user((select id from tst.ids where k = 'editor'));

  select tst.ok((select count(*) from public.trips where id = 'trip_a') = 1,
    'editor can read the trip');

  insert into public.activities (id, trip_id, day_id, title, category)
  values ('act_1', 'trip_a', 'day_1', 'White Tower', 'attraction');

  select tst.ok((select count(*) from public.activities where trip_id = 'trip_a') = 1,
    'editor can insert an activity');

  update public.activities set title = 'White Tower of Thessaloniki' where id = 'act_1';
  select tst.ok((select title from public.activities where id = 'act_1')
                 = 'White Tower of Thessaloniki',
    'editor can update an activity');
commit;

begin;
  select tst.as_user((select id from tst.ids where k = 'viewer'));

  select tst.ok((select count(*) from public.activities where trip_id = 'trip_a') = 1,
    'viewer can read content');

  savepoint s;
  do $$
  begin
    insert into public.activities (id, trip_id, day_id, title)
    values ('act_2', 'trip_a', 'day_1', 'nope');
    raise exception 'FAIL  viewer insert should have been blocked';
  exception
    when insufficient_privilege then raise notice 'PASS  viewer cannot insert';
  end $$;
  rollback to savepoint s;

  savepoint s2;
  do $$
  declare n integer;
  begin
    update public.activities set title = 'hijacked' where id = 'act_1';
    get diagnostics n = row_count;
    if n > 0 then raise exception 'FAIL  viewer update should have affected no rows'; end if;
    raise notice 'PASS  viewer update affects no rows';
  end $$;
  rollback to savepoint s2;

  savepoint s3;
  do $$
  declare n integer;
  begin
    delete from public.activities where id = 'act_1';
    get diagnostics n = row_count;
    if n > 0 then raise exception 'FAIL  viewer delete should have affected no rows'; end if;
    raise notice 'PASS  viewer delete affects no rows';
  end $$;
  rollback to savepoint s3;
commit;

/* ---------------- 5. an editor cannot change membership ---------------- */

begin;
  select tst.as_user((select id from tst.ids where k = 'editor'));
  savepoint s;
  do $$
  begin
    insert into public.trip_members (trip_id, user_id, role)
    values ('trip_a', (select id from tst.ids where k = 'stranger'), 'editor');
    raise exception 'FAIL  editor should not be able to add members';
  exception
    when insufficient_privilege then raise notice 'PASS  editor cannot add members';
  end $$;
  rollback to savepoint s;

  savepoint s2;
  do $$
  declare n integer;
  begin
    update public.trip_members set role = 'owner'
    where trip_id = 'trip_a' and user_id = (select id from tst.ids where k = 'editor');
    get diagnostics n = row_count;
    if n > 0 then raise exception 'FAIL  editor should not be able to promote themselves'; end if;
    raise notice 'PASS  editor cannot promote themselves';
  end $$;
  rollback to savepoint s2;
commit;

/* ---------------- 6. anyone can leave a trip ---------------- */

begin;
  select tst.as_user((select id from tst.ids where k = 'viewer'));
  delete from public.trip_members
  where trip_id = 'trip_a' and user_id = (select id from tst.ids where k = 'viewer');
  select tst.ok((select count(*) from public.trips where id = 'trip_a') = 0,
    'a member who leaves loses access');
commit;

-- put the viewer back for later assertions
begin;
  select tst.as_user((select id from tst.ids where k = 'owner'));
  insert into public.trip_members (trip_id, user_id, role)
  values ('trip_a', (select id from tst.ids where k = 'viewer'), 'viewer');
commit;

/* ---------------- 7. joining by invite token ---------------- */

begin;
  select tst.as_user((select id from tst.ids where k = 'owner'));
  insert into public.trip_invites (trip_id, email, role, token, invited_by)
  values ('trip_a', null, 'editor', 'tok_link', (select id from tst.ids where k = 'owner'));
commit;

begin;
  select tst.as_user((select id from tst.ids where k = 'stranger'));

  select tst.ok(
    (select trip_name from public.peek_trip_invite('tok_link')) = 'North Greece',
    'a non-member can preview an invite before joining');

  select tst.ok(public.accept_trip_invite('tok_link') = 'trip_a',
    'accepting a link invite returns the trip');

  select tst.ok((select count(*) from public.trips where id = 'trip_a') = 1,
    'the invitee can now read the trip');

  insert into public.activities (id, trip_id, day_id, title)
  values ('act_3', 'trip_a', 'day_1', 'added by invitee');
  select tst.ok((select count(*) from public.activities where id = 'act_3') = 1,
    'a link invite granting editor really can edit');
commit;

-- A link invite stays reusable for the rest of the family.
begin;
  select tst.as_user((select id from tst.ids where k = 'owner'));
  select tst.ok(
    (select accepted_at is null from public.trip_invites where token = 'tok_link'),
    'a link invite is not consumed by one use');
commit;

/* ---------------- 8. inviting an email that has not signed up yet ---------------- */

begin;
  select tst.as_user((select id from tst.ids where k = 'owner'));
  insert into public.trip_invites (trip_id, email, role, token, invited_by)
  values ('trip_a', 'Grandma@Example.com', 'viewer', 'tok_mail',
          (select id from tst.ids where k = 'owner'));
commit;

-- The signup trigger should claim it, case-insensitively.
insert into auth.users (email) values ('grandma@example.com');

do $$
declare v_id uuid;
begin
  select id into v_id from auth.users where email = 'grandma@example.com';
  perform tst.ok(
    exists (select 1 from public.trip_members
            where trip_id = 'trip_a' and user_id = v_id and role = 'viewer'),
    'an email invite is claimed on signup, ignoring case');
  perform tst.ok(
    exists (select 1 from public.profiles where id = v_id),
    'a profile row is created on signup');
  perform tst.ok(
    (select accepted_at is not null from public.trip_invites where token = 'tok_mail'),
    'an email invite is marked accepted');
end $$;

/* ---------------- 9. profiles are visible only to trip-mates ---------------- */

do $$
declare v_outsider uuid;
begin
  insert into auth.users (email) values ('outsider@example.com') returning id into v_outsider;
  insert into tst.ids values ('outsider', v_outsider);
end $$;

begin;
  select tst.as_user((select id from tst.ids where k = 'editor'));
  select tst.ok(
    exists (select 1 from public.profiles p
            join tst.ids i on i.id = p.id where i.k = 'owner'),
    'trip-mates can see each other''s profiles');
  select tst.ok(
    not exists (select 1 from public.profiles p
                join tst.ids i on i.id = p.id where i.k = 'outsider'),
    'an unrelated profile stays hidden');
commit;

/* ---------------- 10. a second trip stays separate ---------------- */

begin;
  select tst.as_user((select id from tst.ids where k = 'outsider'));
  insert into public.trips (id, name, start_date, end_date, created_by)
  values ('trip_b', 'Thailand', '2027-01-01', '2027-01-10',
          (select id from tst.ids where k = 'outsider'));
  select tst.ok((select count(*) from public.trips) = 1,
    'a new trip owner sees only their own trip');
commit;

begin;
  select tst.as_user((select id from tst.ids where k = 'owner'));
  select tst.ok((select count(*) from public.trips) = 1,
    'the first owner still sees only their trip');
commit;

/* ---------------- 11. cascade delete ---------------- */

begin;
  select tst.as_user((select id from tst.ids where k = 'editor'));
  savepoint s;
  do $$
  declare n integer;
  begin
    delete from public.trips where id = 'trip_a';
    get diagnostics n = row_count;
    if n > 0 then raise exception 'FAIL  editor should not be able to delete the trip'; end if;
    raise notice 'PASS  editor cannot delete the trip';
  end $$;
  rollback to savepoint s;
commit;

begin;
  select tst.as_user((select id from tst.ids where k = 'owner'));
  delete from public.trips where id = 'trip_a';
commit;

do $$
begin
  perform tst.ok((select count(*) from public.activities where trip_id = 'trip_a') = 0,
    'deleting a trip cascades to its content');
  perform tst.ok((select count(*) from public.trip_members where trip_id = 'trip_a') = 0,
    'deleting a trip cascades to its members');
  perform tst.ok((select count(*) from public.trip_invites where trip_id = 'trip_a') = 0,
    'deleting a trip cascades to its invites');
end $$;

\echo 'ALL RLS TESTS PASSED'

/* ---------------- 12. created_by is stamped, not trusted ---------------- */

begin;
  select tst.as_user((select id from tst.ids where k = 'editor'));
  -- Claiming someone else created the trip must not stick.
  insert into public.trips (id, name, start_date, end_date, created_by)
  values ('trip_c', 'Spoofed', '2027-05-01', '2027-05-05',
          (select id from tst.ids where k = 'owner'));
  select tst.ok(
    (select created_by from public.trips where id = 'trip_c')
      = (select id from tst.ids where k = 'editor'),
    'created_by is forced to the caller, not taken from the payload');
commit;

-- An upsert that only sends the app's columns must leave created_by alone.
begin;
  select tst.as_user((select id from tst.ids where k = 'editor'));
  insert into public.trips as t (id, name, start_date, end_date)
  values ('trip_c', 'Renamed', '2027-05-01', '2027-05-05')
  on conflict (id) do update set name = excluded.name;
  select tst.ok(
    (select created_by from public.trips where id = 'trip_c')
      = (select id from tst.ids where k = 'editor')
    and (select name from public.trips where id = 'trip_c') = 'Renamed',
    'an upsert updates the trip without clearing created_by');
commit;

/* ---------------- 13. the sync path: upserting a brand new trip ----------
 *
 * The app never sends a plain INSERT — every row it syncs goes out as
 * `insert ... on conflict (id) do update`. Postgres applies SELECT policies
 * to that statement, and a trip being created has no trip_members row yet,
 * so a membership-only SELECT policy refused it and no one could put their
 * first trip in the cloud. A plain INSERT passed, which is exactly why this
 * went unnoticed — so the test has to use the upsert form.
 * ------------------------------------------------------------------------ */

begin;
  select tst.as_user((select id from tst.ids where k = 'stranger'));
  insert into public.trips (id, name, start_date, end_date)
  values ('trip_new', 'First cloud trip', '2027-09-01', '2027-09-07')
  on conflict (id) do update set name = excluded.name;
  select tst.ok(
    (select count(*) from public.trips where id = 'trip_new') = 1,
    'a new trip can be created through the upsert the app actually sends');
  select tst.ok(
    (select role from public.trip_members
      where trip_id = 'trip_new'
        and user_id = (select id from tst.ids where k = 'stranger'))::text = 'owner',
    'and its creator is recorded as the owner');
commit;

-- The widened SELECT policy must not let anyone else write to that trip.
begin;
  select tst.as_user((select id from tst.ids where k = 'editor'));
  savepoint s;
  do $$
  begin
    insert into public.trips (id, name, start_date, end_date)
    values ('trip_new', 'Hijacked', '2027-09-01', '2027-09-07')
    on conflict (id) do update set name = excluded.name;
    raise exception 'FAIL  a non-member upsert should have been blocked';
  exception
    when insufficient_privilege then
      raise notice 'PASS  a non-member still cannot upsert another persons trip';
  end $$;
  rollback to savepoint s;
commit;

-- Nor read it.
begin;
  select tst.as_user((select id from tst.ids where k = 'editor'));
  select tst.ok(
    (select count(*) from public.trips where id = 'trip_new') = 0,
    'and still cannot see it');
commit;
