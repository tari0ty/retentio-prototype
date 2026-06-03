# Supabase + Google Auth setup

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a project.
2. Open **SQL Editor** → paste and run `supabase/schema.sql`.

## 2. Enable Google sign-in

1. Supabase → **Authentication** → **Providers** → **Google** → Enable.
2. Create a [Google Cloud OAuth client](https://console.cloud.google.com/apis/credentials) (type **Web application**).
3. Add **Authorized redirect URI** from Supabase (shown on the Google provider page), e.g.  
   `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`
4. Copy Google **Client ID** and **Client secret** into Supabase.

## 3. Redirect URLs for your app

Supabase → **Authentication** → **URL configuration**:

- **Site URL**: where you host the game, e.g. `http://localhost:5500` or `https://yoursite.com`
- **Redirect URLs**: add the same origins you use to open `index.html`, e.g.  
  `http://localhost:5500/**`  
  `http://127.0.0.1:5500/**`

Google OAuth will return users to `index.html` after sign-in.

## 4. App config

```bash
cp config.example.js config.js
```

Edit `config.js` with values from Supabase → **Settings** → **API**:

| Field in `config.js` | Copy from Supabase |
|----------------------|-------------------|
| `supabaseUrl` | **Project URL** — e.g. `https://abcdefgh.supabase.co` |
| `supabaseAnonKey` | **anon** / **publishable** public key |

**Do not** use the `.../rest/v1/` URL from the REST docs — that causes `"No API key found in request"` after Google sign-in.

## 5. Database tables (required)

Run in SQL Editor, in order:

1. `supabase/schema.sql` — profiles + Google sign-up trigger  
2. `supabase/schema-multiplayer.sql` — live Ranked rooms, chat, Realtime  
3. `supabase/schema-fix-rls.sql` — **required** if Ranked shows “infinite recursion” on `room_members`  
4. `supabase/schema-friends.sql` — friend codes + friends list (for multi-account testing)  

If Realtime fails to attach, enable **rooms**, **room_members**, and **chat_messages** under **Database → Replication**.

## 6. Run locally

OAuth does not work on `file://`. Use a local server, for example:

```bash
npx serve .
```

Open the URL it prints (e.g. `http://localhost:3000`).

## 7. Test flow

1. Load the site → **Continue with Google**.
2. Complete Google sign-in → you return to the hub.
3. If you have no nickname yet, pick avatar + nickname once.
4. Play Matchbox — progress saves to `profiles` when signed in.
5. **Sign out** from the hub (top right) to test guest mode again.

## 8. Friends (4 Gmail test accounts)

1. Sign in on each browser/profile with a different Google account.  
2. Hub → **👥 Friends** → copy **Your friend code** on each account.  
3. On account A, paste account B’s code → **Add**. Repeat until all accounts are linked.  
4. Open **Ranked** on two accounts at once → same lobby → vote → chat → play.

## 9. Live Ranked + chat

1. Sign in with Google (two browser windows = two players).  
2. Matchbox → **Ranked** → vote → **Confirm Vote** → lobby.  
3. When **2+ players** are in the lobby, an **8s countdown** starts, then the match begins.  
4. Use **chat** in the lobby and during the match.  
5. Finish the board — results show **real** scores from everyone in the room.

## 10. Guest vs signed-in

| | Guest | Google (Supabase) |
|---|--------|-------------------|
| Storage | `localStorage` only | `localStorage` + `profiles` table |
| Ranked | Locked | Unlocked |
| Sign out | — | Clears session; can play as guest |
