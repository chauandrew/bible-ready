create table qotd_responses (
  id           bigint generated always as identity primary key,
  play_date    date not null,               -- Pacific-time puzzle day, e.g. '2026-08-20'
  device_id    uuid not null,
  question_id  text not null,               -- matches QuizItem.id
  correct      boolean not null,
  time_ms      integer not null check (time_ms >= 0),
  created_at   timestamptz not null default now(),
  constraint qotd_one_per_device_per_day unique (play_date, device_id)
);

create index qotd_responses_play_date_idx on qotd_responses (play_date);

alter table qotd_responses enable row level security;

-- Anon key may insert its own response row. No time/shape validation beyond
-- the column constraints above — anti-cheat is intentionally light (a light
-- DB-level "one per device per day" constraint is the whole guard, by design).
create policy "qotd insert own response"
  on qotd_responses for insert
  to anon
  with check (true);

-- Deliberately NO select policy on the base table. A device_id is a stable
-- pseudonymous identifier — letting anon SELECT * would let anyone scrape
-- every device's id + time + correctness for the day. The client never
-- needs raw rows, only aggregates, which the two functions below provide.

create or replace function qotd_submit_and_score(
  p_play_date date, p_device_id uuid, p_question_id text,
  p_correct boolean, p_time_ms integer
) returns table (
  correct boolean, time_ms integer, total_players integer,
  correct_players integer, accuracy_percent numeric, speed_percentile numeric
) language plpgsql security definer set search_path = public as $$
begin
  insert into qotd_responses (play_date, device_id, question_id, correct, time_ms)
  values (p_play_date, p_device_id, p_question_id, p_correct, p_time_ms);
  return query
  select
    p_correct, p_time_ms,
    (select count(*)::int from qotd_responses r where r.play_date = p_play_date),
    (select count(*)::int from qotd_responses r where r.play_date = p_play_date and r.correct),
    round(100.0 * (select count(*) from qotd_responses r where r.play_date = p_play_date and r.correct)
          / nullif((select count(*) from qotd_responses r where r.play_date = p_play_date), 0), 1),
    case when not p_correct then null else
      round(100.0 * (select count(*) from qotd_responses r where r.play_date = p_play_date and r.correct and r.time_ms > p_time_ms)
            / nullif((select count(*) from qotd_responses r where r.play_date = p_play_date and r.correct), 0), 1)
    end;
end; $$;

revoke all on function qotd_submit_and_score from public;
grant execute on function qotd_submit_and_score to anon;

create or replace function qotd_my_result(p_play_date date, p_device_id uuid)
returns table (
  correct boolean, time_ms integer, total_players integer,
  correct_players integer, accuracy_percent numeric, speed_percentile numeric
) language plpgsql security definer set search_path = public as $$
declare my_row qotd_responses;
begin
  select * into my_row from qotd_responses where play_date = p_play_date and device_id = p_device_id;
  if not found then return; end if;
  return query
  select
    my_row.correct, my_row.time_ms,
    (select count(*)::int from qotd_responses r where r.play_date = p_play_date),
    (select count(*)::int from qotd_responses r where r.play_date = p_play_date and r.correct),
    round(100.0 * (select count(*) from qotd_responses r where r.play_date = p_play_date and r.correct)
          / nullif((select count(*) from qotd_responses r where r.play_date = p_play_date), 0), 1),
    case when not my_row.correct then null else
      round(100.0 * (select count(*) from qotd_responses r where r.play_date = p_play_date and r.correct and r.time_ms > my_row.time_ms)
            / nullif((select count(*) from qotd_responses r where r.play_date = p_play_date and r.correct), 0), 1)
    end;
end; $$;

revoke all on function qotd_my_result from public;
grant execute on function qotd_my_result to anon;
