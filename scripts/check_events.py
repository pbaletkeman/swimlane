#!/usr/bin/env python3
import sqlite3

conn = sqlite3.connect('swimlane.db')
conn.row_factory = sqlite3.Row
c = conn.cursor()

c.execute('SELECT COUNT(*) as cnt FROM event')
print(f'Total events: {c.fetchone()["cnt"]}')

c.execute('SELECT COUNT(*) as cnt FROM event WHERE is_active = 1')
print(f'Active events: {c.fetchone()["cnt"]}')

c.execute('SELECT event_id, start_date_time, end_date_time, is_active, venue_id, frequency_id, coach_id FROM event LIMIT 10')
print('\nEvents:')
for r in c:
    print(f'  event_id={r["event_id"]}, start={r["start_date_time"]}, active={r["is_active"]}, venue={r["venue_id"]}, freq={r["frequency_id"]}, coach={r["coach_id"]}')

# Check current time
from datetime import datetime, timezone
now = datetime.now(timezone.utc).isoformat(timespec="seconds")
print(f'\nCurrent time (UTC): {now}')

# Check upcoming events
c.execute('SELECT COUNT(*) as cnt FROM event WHERE is_active = 1 AND start_date_time >= ?', (now,))
print(f'Upcoming active events: {c.fetchone()["cnt"]}')

conn.close()