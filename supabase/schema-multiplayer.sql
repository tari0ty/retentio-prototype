-- Run AFTER schema.sql in Supabase SQL Editor
-- Live Ranked rooms, players, chat + Realtime

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'lobby'
    check (status in ('lobby', 'playing', 'finished')),
  topic text,
  tile_count integer not null default 16,
  time_limit integer not null default 120,
  max_flips integer not null default 40,
  board_seed bigint,
  votes jsonb not null default '{}'::jsonb,
  max_players integer not null default 2,
  match_starts_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.room_members (
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null,
  avatar text not null default 'unicorn',
  profile_pic_url text,
  pairs_matched integer not null default 0,
  flips integer not null default 0,
  time_seconds integer,
  score integer,
  finished boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  display_name text not null,
  body text not null check (char_length(body) between 1 and 280),
  created_at timestamptz not null default now()
);

create index if not exists room_members_room_id_idx on public.room_members (room_id);
create index if not exists chat_messages_room_id_created_idx on public.chat_messages (room_id, created_at);

alter table public.rooms
  add column if not exists tile_count integer not null default 16,
  add column if not exists time_limit integer not null default 120,
  add column if not exists max_flips integer not null default 40;

alter table public.rooms
  alter column max_players set default 2;

alter table public.room_members
  add column if not exists profile_pic_url text;

-- ---------------------------------------------------------------------------
-- RLS helpers (avoids infinite recursion on room_members)
-- ---------------------------------------------------------------------------
create or replace function public.is_room_member(p_room_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.room_members
    where room_id = p_room_id and user_id = auth.uid()
  );
$$;

grant execute on function public.is_room_member(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists "rooms_select_auth" on public.rooms;
create policy "rooms_select_auth"
  on public.rooms for select to authenticated
  using (true);

drop policy if exists "rooms_insert_auth" on public.rooms;
create policy "rooms_insert_auth"
  on public.rooms for insert to authenticated
  with check (true);

drop policy if exists "rooms_update_members" on public.rooms;
create policy "rooms_update_members"
  on public.rooms for update to authenticated
  using (public.is_room_member(id));

drop policy if exists "room_members_select_same_room" on public.room_members;
create policy "room_members_select_same_room"
  on public.room_members for select to authenticated
  using (public.is_room_member(room_id));

drop policy if exists "room_members_insert_self" on public.room_members;
create policy "room_members_insert_self"
  on public.room_members for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "room_members_update_self" on public.room_members;
create policy "room_members_update_self"
  on public.room_members for update to authenticated
  using (user_id = auth.uid());

drop policy if exists "room_members_delete_self" on public.room_members;
create policy "room_members_delete_self"
  on public.room_members for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists "chat_select_room_member" on public.chat_messages;
create policy "chat_select_room_member"
  on public.chat_messages for select to authenticated
  using (public.is_room_member(room_id));

drop policy if exists "chat_insert_room_member" on public.chat_messages;
create policy "chat_insert_room_member"
  on public.chat_messages for insert to authenticated
  with check (user_id = auth.uid() and public.is_room_member(room_id));

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.pick_topic_from_votes(votes jsonb)
returns text
language sql
stable
as $$
  select coalesce(
    (
      select key
      from jsonb_each_text(coalesce(votes->'topics', votes, '{}'::jsonb)) as t(key, value)
      order by (value::integer) desc, key asc
      limit 1
    ),
    'Animals'
  );
$$;

create or replace function public.try_begin_match(p_room_id uuid)
returns public.rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.rooms;
  member_count integer;
  settings jsonb;
  settings_count integer;
  avg_tiles integer := 16;
  avg_time integer := 120;
  avg_flips integer := 40;
begin
  select count(*)::integer into member_count
  from public.room_members where room_id = p_room_id;

  if member_count < 2 then
    raise exception 'Need two players in room';
  end if;

  select * into r
  from public.rooms
  where id = p_room_id and status = 'lobby';

  if r.id is null then
    return null;
  end if;

  settings := coalesce(r.votes->'settings', '[]'::jsonb);
  select count(*)::integer into settings_count from jsonb_array_elements(settings);
  if settings_count > 0 then
    select
      greatest(6, least(16, round(avg((value->>'tiles')::numeric))::integer)),
      greatest(60, least(180, round(avg((value->>'timeLimit')::numeric))::integer)),
      greatest(12, least(60, round(avg((value->>'maxFlips')::numeric))::integer))
    into avg_tiles, avg_time, avg_flips
    from jsonb_array_elements(settings);
    avg_tiles := (avg_tiles / 2) * 2;
  end if;

  update public.rooms
  set
    status = 'playing',
    topic = pick_topic_from_votes(votes),
    tile_count = avg_tiles,
    time_limit = avg_time,
    max_flips = avg_flips,
    board_seed = (extract(epoch from now()) * 1000)::bigint,
    match_starts_at = now()
  where id = p_room_id and status = 'lobby'
  returning * into r;

  return r;
end;
$$;

grant execute on function public.try_begin_match(uuid) to authenticated;

-- Realtime (enable in Dashboard → Database → Replication if this fails)
do $$
begin
  alter publication supabase_realtime add table public.rooms;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.room_members;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.chat_messages;
exception when duplicate_object then null;
end $$;
