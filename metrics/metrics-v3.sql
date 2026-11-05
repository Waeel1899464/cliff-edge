-- Cliff Edge V3 website metrics (Supabase project "cliff-edge", table public.events).
-- V3 players have ids starting with 'v3-'; V1 rows are left out. Dates are UTC.
-- Owner's test devices are left out (v3-ndp3hh98sdok = owner's phone). Add more ids to the 'not in' lists.
-- Needs metrics/v3-allow-events.sql applied first (done at the publish step).

-- 1) Players and rounds per day
select date(created_at) as day, count(distinct device) as players,
       count(*) filter (where event in ('round', 'daily', 'endless_round')) as rounds
from public.events where device like 'v3-%' and device not in ('v3-ndp3hh98sdok')
group by 1 order by 1;

-- 2) Day-1 return (D1). Project rule: above 30% = keep going, below 15% = change the design.
with v3 as (select * from public.events where device like 'v3-%' and device not in ('v3-ndp3hh98sdok')),
first_day as (select device, min(date(created_at)) as d0 from v3 group by device),
active as (select distinct device, date(created_at) as d from v3)
select f.d0 as first_day, count(*) as new_players,
       count(*) filter (where exists (select 1 from active a where a.device = f.device and a.d = f.d0 + 1)) as came_back_next_day,
       round(100.0 * count(*) filter (where exists (select 1 from active a where a.device = f.device and a.d = f.d0 + 1)) / count(*), 1) as d1_percent
from first_day f where f.d0 < current_date group by 1 order by 1;

-- 3) Rounds per session
select round(avg(n), 1) as avg_rounds_per_session, percentile_cont(0.5) within group (order by n) as median
from (select session, count(*) filter (where event in ('round', 'daily', 'endless_round')) as n
      from public.events where device like 'v3-%' and device not in ('v3-ndp3hh98sdok') group by session) s;

-- 4) Where players stop: for each story cliff, how many players tried it, passed it,
--    and how many tries it took on average. A big drop between two cliffs = a cliff to look at.
with v3 as (select * from public.events where device like 'v3-%' and device not in ('v3-ndp3hh98sdok'))
select value as cliff,
       count(distinct device) filter (where event = 'round') as players_tried,
       count(distinct device) filter (where event = 'cliff_pass') as players_passed,
       round(count(*) filter (where event = 'round')::numeric / nullif(count(distinct device) filter (where event = 'round'), 0), 1) as tries_per_player
from v3 where event in ('round', 'cliff_pass') and value between 1 and 50
group by value order by value;

-- 5) Bonuses used (SAVE ME rescues, helpers, double coins, extra heart, mystery box)
select event, count(*) as times, count(distinct device) as players
from public.events where device like 'v3-%' and event like 'reward_%' and device not in ('v3-ndp3hh98sdok')
group by 1 order by 2 desc;

-- 6) Sharing and the end of the game
select count(distinct device) as players,
       count(distinct device) filter (where event in ('share_clip', 'challenge', 'share_card')) as players_who_shared,
       count(distinct device) filter (where event = 'all_worlds') as finished_all_5_worlds,
       max(value) filter (where event = 'endless_run') as best_endless_run
from public.events where device like 'v3-%' and device not in ('v3-ndp3hh98sdok');
