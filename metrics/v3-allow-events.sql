-- Cliff Edge V3 website: let the events table accept the V3 event names.
-- APPLIED on 2026-11-05 (owner approved publishing V3 with this change).
-- It only widens the list of accepted names; no row is changed or deleted, and V1 keeps working.
-- tests/web-v3.test.js reads the list below and checks the game never sends a name outside it.
alter table public.events drop constraint if exists events_event_check;
alter table public.events add constraint events_event_check check (event = any (array[
  -- V1 names (unchanged)
  'open', 'round', 'share_clip', 'challenge', 'daily', 'challenge_open',
  -- V3 names
  'cliff_pass', 'endless_round', 'endless_run', 'all_worlds', 'share_card',
  'reward_rescue', 'reward_helper', 'reward_double', 'reward_heart', 'reward_box'
]::text[]));
