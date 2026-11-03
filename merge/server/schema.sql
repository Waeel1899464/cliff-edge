-- Merge Anything: tables for the shared world recipe book.
-- Every recipe is decided once (by the AI) and then is the same for every player in the world.

create table if not exists public.merge_items (
  tier  int  not null check (tier between 1 and 10),
  key   text not null,                 -- lower-case name
  name  text not null,
  emoji text not null,
  made_at timestamptz not null default now(),
  primary key (tier, key)
);

create table if not exists public.merge_combos (
  key    text primary key,             -- "tier|a+b" with a, b lower-case and sorted
  tier   int  not null,                -- level of the result
  name   text not null,
  emoji  text not null,
  seeded boolean not null default false,
  uses   int  not null default 1,
  made_at timestamptz not null default now()
);

-- AI calls per day, so a bug or an abuser can never run up a big bill.
create table if not exists public.merge_ai_calls (
  day date primary key,
  n   int not null default 0
);

create or replace function public.merge_count_ai_call() returns int
language sql security definer set search_path = public as $$
  insert into public.merge_ai_calls (day, n) values (current_date, 1)
  on conflict (day) do update set n = merge_ai_calls.n + 1
  returning n;
$$;

create or replace function public.merge_add_use(k text) returns void
language sql security definer set search_path = public as $$
  update public.merge_combos set uses = uses + 1 where key = k;
$$;

-- Only the server function (service role) may read or write. No public access.
alter table public.merge_items    enable row level security;
alter table public.merge_combos   enable row level security;
alter table public.merge_ai_calls enable row level security;
revoke all on function public.merge_count_ai_call() from public, anon, authenticated;
revoke all on function public.merge_add_use(text)   from public, anon, authenticated;
