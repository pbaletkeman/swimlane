# Relationships

- [Relationships](#relationships)
  - [frequency](#frequency)
  - [event](#event)
  - [members](#members)
  - [schedule](#schedule)
  - [roles](#roles)
  - [rolesTypes](#rolestypes)
  - [venue](#venue)
  - [facility](#facility)
  - [Other Notes](#other-notes)



## frequency

- frequencyid
- one time
- one or more times weekly,
- one or more times monthly,
- one or more times annually.

## event

- eventid
- start time
- end time
- start date
- end date
- venueid
- scheduleid

## members

- memberid
- firstname
- lastname
- email
- phone
- pass

## schedule

- scheduleid
- memberid
- reenquecyid

## roles

- roleid
- name
- description
- parentid

## rolesTypes

- admin
- facilitator
- user

---

Team member roles are configurable.
The person with the admin role creates the group and the events in the group, therefore a group admin is automatically an event admin.
Each event is facilitated by a team consisting of one or more team members.

---

## venue

- facilities
- location
- cost

---

A venue has multiple configurable attributes.
Each attribute has a capacity of an integer value.
Events can be grouped (e.g. by season, geography, etc.)

---

## facility

- name (e.g. tennis court, ping pong tables, pool)
- max capacity

---
---

## Other Notes

- Attendees sign up to the events
- invoicing and payment.....
- Configurable attendance rescheduling rules
- can reschedule makeup event that takes place within x days of cancelled event
- cancellations/rescheduling must be done within x hours of the event
- other rules about swim cancellations and other terms...
- Missed Swims
