-- Fix: "infinite recursion detected in policy for relation room_members"
-- Run once in Supabase SQL Editor (safe to re-run)

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

drop policy if exists "room_members_select_same_room" on public.room_members;
create policy "room_members_select_same_room"
  on public.room_members for select to authenticated
  using (public.is_room_member(room_id));

drop policy if exists "rooms_update_members" on public.rooms;
create policy "rooms_update_members"
  on public.rooms for update to authenticated
  using (public.is_room_member(id));

drop policy if exists "chat_select_room_member" on public.chat_messages;
create policy "chat_select_room_member"
  on public.chat_messages for select to authenticated
  using (public.is_room_member(room_id));

drop policy if exists "chat_insert_room_member" on public.chat_messages;
create policy "chat_insert_room_member"
  on public.chat_messages for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_room_member(room_id)
  );
