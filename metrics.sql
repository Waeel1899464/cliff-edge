-- Cliff Edge playtest metrics (Supabase project "cliff-edge", table public.events).
-- Owner's test phone is excluded: device 'hdj66gxmgafc'. Add more ids to the list to exclude them.
-- Dates are UTC. Events: open, challenge_open, round, daily, share_clip, challenge.

-- 1) Players and rounds per day
select date(created_at) as day,
       count(distinct device) as players,
       count(*) filter (where event in ('round', 'daily')) as rounds
from public.events where device not in ('hdj66gxmgafc')
group by 1 order by 1;

-- 2) Day-1 return (D1): of the players first seen on a day, how many came back the next day.
--    Goal from the project guide: above 30% = keep going, below 15% = change the design.
with first_day as (
  select device, min(date(created_at)) as d0 from public.events where device not in ('hdj66gxmgafc') group by device
), active as (
  select distinct device, date(created_at) as d from public.events where device not in ('hdj66gxmgafc')
)
select f.d0 as first_day,
       count(*) as new_players,
       count(*) filter (where exists (select 1 from active a where a.device = f.device and a.d = f.d0 + 1)) as came_back_next_day,
       round(100.0 * count(*) filter (where exists (select 1 from active a where a.device = f.device and a.d = f.d0 + 1)) / count(*), 1) as d1_percent
from first_day f
where f.d0 < current_date   -- today's new players cannot have returned yet
group by 1 order by 1;

-- 3) Rounds per session (one session = one time the game was opened)
select round(avg(n), 1) as avg_rounds_per_session,
       percentile_cont(0.5) within group (order by n) as median_rounds_per_session
from (
  select session, count(*) filter (where event in ('round', 'daily')) as n
  from public.events where device not in ('hdj66gxmgafc') group by session
) s;

-- 4) Share rate: share of players who tapped SHARE CLIP or CHALLENGE A FRIEND at least once
select count(distinct device) as players,
       count(distinct device) filter (where event in ('share_clip', 'challenge')) as players_who_shared,
       round(100.0 * count(distinct device) filter (where event in ('share_clip', 'challenge')) / nullif(count(distinct device), 0), 1) as share_percent,
       count(*) filter (where event = 'challenge_open') as opened_from_a_challenge_link
from public.events where device not in ('hdj66gxmgafc');
