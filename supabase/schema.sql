-- LeetGraph schema — paste into Supabase Dashboard > SQL Editor > Run.
-- Everything is per-user and locked down with Row Level Security.

-- Attempt log: one row per attempt, full payload as jsonb so the client
-- data model can evolve without migrations.
create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  slug text not null,
  at bigint not null, -- epoch ms, mirrors the client field
  payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, slug, at)
);
create index if not exists attempts_user_idx on public.attempts (user_id, at);

alter table public.attempts enable row level security;
drop policy if exists "own attempts" on public.attempts;
create policy "own attempts" on public.attempts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Mock-interview sessions (transcript, verdict, code).
create table if not exists public.interviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  at bigint not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, at)
);
create index if not exists interviews_user_idx on public.interviews (user_id, at);

alter table public.interviews enable row level security;
drop policy if exists "own interviews" on public.interviews;
create policy "own interviews" on public.interviews
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Player profile: equipped title + coach skin + roguelike inventory
-- (relics, potions, active curse, pending bonuses).
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  title text,
  coach_skin text,
  inventory jsonb,
  updated_at timestamptz not null default now()
);
alter table public.profiles add column if not exists inventory jsonb;

alter table public.profiles enable row level security;
drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
