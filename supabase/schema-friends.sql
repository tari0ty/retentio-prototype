-- Friends system — run after schema.sql
-- Use friend codes to link Gmail test accounts

alter table public.profiles
  add column if not exists friend_code text unique;

create or replace function public.gen_friend_code()
returns text
language plpgsql
as $$
declare
  c text;
begin
  loop
    c := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists (select 1 from public.profiles where friend_code = c);
  end loop;
  return c;
end;
$$;

update public.profiles
set friend_code = public.gen_friend_code()
where friend_code is null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar, friend_code)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    'unicorn',
    public.gen_friend_code()
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Allow signed-in users to find others by friend code (testing / add friend)
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
  on public.profiles for select to authenticated
  using (true);

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  friend_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, friend_id),
  check (user_id <> friend_id)
);

alter table public.friendships enable row level security;

drop policy if exists "friendships_select_own" on public.friendships;
create policy "friendships_select_own"
  on public.friendships for select to authenticated
  using (user_id = auth.uid() or friend_id = auth.uid());

drop policy if exists "friendships_insert_own" on public.friendships;
create policy "friendships_insert_own"
  on public.friendships for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "friendships_delete_own" on public.friendships;
create policy "friendships_delete_own"
  on public.friendships for delete to authenticated
  using (user_id = auth.uid() or friend_id = auth.uid());

create table if not exists public.friend_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null default 'Player',
  body text not null,
  created_at timestamptz not null default now(),
  check (sender_id <> recipient_id),
  check (char_length(body) between 1 and 280)
);

create index if not exists friend_messages_thread_created_idx
  on public.friend_messages (sender_id, recipient_id, created_at);

alter table public.friend_messages enable row level security;

drop policy if exists "friend_messages_select_friends" on public.friend_messages;
create policy "friend_messages_select_friends"
  on public.friend_messages for select to authenticated
  using (
    (sender_id = auth.uid() or recipient_id = auth.uid())
    and exists (
      select 1
      from public.friendships f
      where
        (f.user_id = sender_id and f.friend_id = recipient_id)
        or (f.user_id = recipient_id and f.friend_id = sender_id)
    )
  );

drop policy if exists "friend_messages_insert_friends" on public.friend_messages;
create policy "friend_messages_insert_friends"
  on public.friend_messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1
      from public.friendships f
      where
        (f.user_id = sender_id and f.friend_id = recipient_id)
        or (f.user_id = recipient_id and f.friend_id = sender_id)
    )
  );

do $$
begin
  alter publication supabase_realtime add table public.friend_messages;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
