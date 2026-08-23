#!/usr/bin/env python3
"""Verify seeded data."""

import sqlite3

conn = sqlite3.connect('swimlane.db')
conn.row_factory = sqlite3.Row
c = conn.cursor()

c.execute('SELECT role, COUNT(*) as count FROM users GROUP BY role')
print('Users by role:')
for r in c:
    print(f'  {r["role"]}: {r["count"]}')

c.execute('SELECT f.name, COUNT(v.venue_id) as cnt FROM facility f LEFT JOIN venue v ON v.facility_id = f.facility_id GROUP BY f.facility_id')
print('\nVenues per facility:')
for r in c:
    print(f'  {r["name"]}: {r["cnt"]}')

c.execute('SELECT e.event_id, u.role, e.venue_id, e.frequency_id FROM event e JOIN users u ON u.sub = e.coach_id LIMIT 5')
print('\nSample events:')
for r in c:
    print(f'  event_id={r["event_id"]}, coach_role={r["role"]}, venue={r["venue_id"]}, freq={r["frequency_id"]}')

c.execute('SELECT COUNT(*) as cnt FROM schedule WHERE is_active = 1')
print(f'\nActive schedules: {c.fetchone()["cnt"]}')

c.execute('SELECT COUNT(*) as cnt FROM form_submission')
print(f'Form submissions: {c.fetchone()["cnt"]}')

c.execute('SELECT is_read, COUNT(*) as cnt FROM message GROUP BY is_read')
print('Messages by read status:')
for r in c:
    print(f'  is_read={r["is_read"]}: {r["cnt"]}')

# Check foreign key integrity
c.execute('''
    SELECT 'event->venue' as fk, COUNT(*) as broken
    FROM event e LEFT JOIN venue v ON e.venue_id = v.venue_id
    WHERE e.venue_id IS NOT NULL AND v.venue_id IS NULL
''')
print('\nFK Integrity checks:')
for r in c:
    print(f'  {r["fk"]}: {r["broken"]} broken')

c.execute('''
    SELECT 'schedule->event' as fk, COUNT(*) as broken
    FROM schedule s LEFT JOIN event e ON s.event_id = e.event_id
    WHERE s.event_id IS NOT NULL AND e.event_id IS NULL
''')
for r in c:
    print(f'  {r["fk"]}: {r["broken"]} broken')

c.execute('''
    SELECT 'schedule->member' as fk, COUNT(*) as broken
    FROM schedule s LEFT JOIN users u ON s.member_id = u.sub
    WHERE s.member_id IS NOT NULL AND u.sub IS NULL
''')
for r in c:
    print(f'  {r["fk"]}: {r["broken"]} broken')

conn.close()