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
