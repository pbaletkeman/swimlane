#!/usr/bin/env python3
"""
Seed script to populate the Swimlane database with realistic test data.

Run with: uv run python scripts/seed_data.py
"""

import os
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.data.event.event import Event
from src.data.event.sqlite import SQLite as EventSQLite
from src.data.facility.facility import Facility
from src.data.facility.sqlite import SQLite as FacilitySQLite
from src.data.facility_rule.facility_rule import FacilityRule
from src.data.facility_rule.sqlite import SQLite as FacilityRuleSQLite
from src.data.form_question.form_question import FormQuestion, QuestionType
from src.data.form_question.sqlite import SQLite as FormQuestionSQLite
from src.data.form_submission.form_response import FormResponse
from src.data.form_submission.form_submission import FormSubmission
from src.data.form_submission.sqlite import SQLite as FormSubmissionSQLite
from src.data.frequency.frequency import Frequency
from src.data.frequency.sqlite import SQLite as FrequencySQLite
from src.data.message.message import Message
from src.data.message.sqlite import SQLite as MessageSQLite
from src.data.schedule.schedule import Schedule
from src.data.schedule.sqlite import SQLite as ScheduleSQLite
from src.data.user_invite.sqlite import SQLite as UserInviteSQLite
from src.data.user_invite.user_invite import UserInvite
from src.data.users.sqlite import SQLite as UserSQLite
from src.data.users.user import User
from src.data.venue.sqlite import SQLite as VenueSQLite
from src.data.venue.venue import Venue
from src.encryption import encrypt_field, hash_field


def init_all_dbs() -> None:
    """Initialize all database tables."""
    print("Initializing database tables...")
    # Initialize each table directly to avoid Config.google_config() requirement
    UserSQLite().init()
    FacilitySQLite().init()
    FrequencySQLite().init()
    VenueSQLite().init()
    EventSQLite().init()
    ScheduleSQLite().init()
    FormQuestionSQLite().init()
    FacilityRuleSQLite().init()
    FormSubmissionSQLite().init()
    MessageSQLite().init()
    UserInviteSQLite().init()
    print("All tables initialized.")


def create_users() -> list[User]:
    """Create 20 users with various roles."""
    print("\nCreating users...")
    users_db = UserSQLite()

    roles = [
        ("web_admin", 2),
        ("facility_manager", 3),
        ("coach", 5),
        ("member", 10),
    ]

    first_names = [
        "Sarah", "Michael", "Emily", "James", "Jessica", "David", "Ashley", "Christopher",
        "Amanda", "Matthew", "Jennifer", "Joshua", "Elizabeth", "Daniel", "Lauren", "Andrew",
        "Megan", "Ryan", "Stephanie", "Tyler"
    ]

    last_names = [
        "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez",
        "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor",
        "Moore", "Jackson", "Martin", "Lee"
    ]

    users: list[User] = []
    sub_counter = 111122296393493391055

    for role_name, count in roles:
        for i in range(count):
            idx = len(users)
            first_name = first_names[idx]
            last_name = last_names[idx]
            email = f"user{idx+1}@swimclub.example.com"
            sub = str(sub_counter + idx)

            fn_enc = encrypt_field(first_name)
            ln_enc = encrypt_field(last_name)
            email_enc = encrypt_field(email)
            email_hash = hash_field(email)

            user = User(
                sub=sub,
                role=role_name,
                first_name_nonce=fn_enc["nonce"],
                first_name_ciphertext=fn_enc["ciphertext"],
                last_name_nonce=ln_enc["nonce"],
                last_name_ciphertext=ln_enc["ciphertext"],
                email_nonce=email_enc["nonce"],
                email_ciphertext=email_enc["ciphertext"],
                email_hash=email_hash,
                is_active=True,
                is_deleted=False,
            )
            users.append(user)

    users_db.create_users_bulk(users)
    all_users = users_db.list_users()
    print(f"Created {len(all_users) if all_users else 0} users")
    return all_users or []


def create_frequencies() -> list[Frequency]:
    """Create 20 frequency types."""
    print("\nCreating frequencies...")
    freq_db = FrequencySQLite()

    frequencies_data = [
        ("Daily", "1d"),
        ("Weekly", "7d"),
        ("Bi-Weekly", "14d"),
        ("Monthly", "30d"),
        ("Mon/Wed/Fri", "MWF"),
        ("Tue/Thu", "TTH"),
        ("Sat/Sun", "SS"),
        ("Mon-Fri", "M-F"),
        ("Weekends Only", "SSU"),
        ("3x/Week", "3w"),
        ("Every 3 Days", "3d"),
        ("Every 4 Days", "4d"),
        ("Twice Weekly", "2w"),
        ("First of Month", "1m"),
        ("Last Friday", "LF"),
        ("Mon/Thu", "MTH"),
        ("Tue/Fri", "TF"),
        ("Wed/Sat", "WS"),
        ("Custom 5-Day", "5d"),
        ("Alternate Days", "2d"),
    ]

    frequencies = [
        Frequency(name=name, day_interval=interval, is_active=True)
        for name, interval in frequencies_data
    ]

    freq_db.create_frequencies_bulk(frequencies)
    all_frequencies = freq_db.list_frequencies()
    print(f"Created {len(all_frequencies) if all_frequencies else 0} frequencies")
    return all_frequencies or []


def create_facilities() -> list[Facility]:
    """Create 20 facilities."""
    print("\nCreating facilities...")
    fac_db = FacilitySQLite()

    facilities_data = [
        ("Downtown Aquatic Center", "Olympic-size pool with diving well", 200, 20),
        ("Northside Pool", "Community pool with lap lanes", 150, 15),
        ("West End Natatorium", "Indoor facility with therapy pool", 180, 18),
        ("Eastside Swim Club", "Outdoor seasonal pool", 120, 12),
        ("Central Recreation Center", "Multi-purpose aquatic facility", 220, 25),
        ("Southgate Aquatics", "Competition pool with timing system", 160, 16),
        ("Riverside Pool", "Family-friendly with zero-entry", 140, 14),
        ("Lakeview Natatorium", "University-affiliated training center", 190, 20),
        ("Harbor Swim Center", "Saltwater pool with hydrotherapy", 130, 13),
        ("Summit Aquatic Complex", "Two pools: competition and leisure", 250, 30),
        ("Valley Pool", "Neighborhood pool with lessons", 100, 10),
        ("Highland Aquatics", "Year-round indoor facility", 170, 17),
        ("Meadowbrook Swim Club", "Private club with masters program", 110, 11),
        ("Cedar Park Pool", "Renovated 2023 with new filtration", 155, 15),
        ("Pinecrest Natatorium", "Competitive team training site", 175, 18),
        ("Oakwood Aquatic Center", "Accessible facility with lift", 145, 14),
        ("Maple Grove Pool", "Seasonal outdoor with shade structures", 115, 11),
        ("Springfield Swim Center", "Therapy and wellness focused", 125, 12),
        ("Fairfax Community Pool", "Budget-friendly public pool", 90, 8),
        ("Georgetown Aquatics", "Elite coaching and development", 165, 16),
    ]

    facilities = [
        Facility(
            name=name,
            description=desc,
            max_capacity=max_cap,
            min_capacity=min_cap,
            is_active=True,
        )
        for name, desc, max_cap, min_cap in facilities_data
    ]

    fac_db.create_facilities_bulk(facilities)
    all_facilities = fac_db.list_facilities()
    print(f"Created {len(all_facilities) if all_facilities else 0} facilities")
    return all_facilities or []


def create_venues(facilities: list[Facility]) -> list[Venue]:
    """Create 20 venues across facilities."""
    print("\nCreating venues...")
    from src.data.venue.sqlite import SQLite as VenueSQLite
    from src.data.venue.venue import Venue

    venue_db = VenueSQLite()

    addresses = [
        ("100 Main St", "Springfield", "IL", "62701"),
        ("200 Oak Ave", "Riverside", "CA", "92501"),
        ("300 Pine Rd", "Franklin", "TN", "37064"),
        ("400 Elm Blvd", "Georgetown", "TX", "78626"),
        ("500 Maple Dr", "Lakewood", "CO", "80226"),
        ("600 Cedar Ln", "Arlington", "VA", "22201"),
        ("700 Birch Ct", "Clayton", "MO", "63105"),
        ("800 Walnut Way", "Evanston", "IL", "60201"),
        ("900 Spruce St", "Bethesda", "MD", "20814"),
        ("1000 Aspen Ave", "Naperville", "IL", "60540"),
        ("1100 Willow Rd", "Overland Park", "KS", "66212"),
        ("1200 Poplar Blvd", "Bellevue", "WA", "98004"),
        ("1300 Sycamore Dr", "Carlsbad", "CA", "92008"),
        ("1400 Chestnut Ct", "Plano", "TX", "75023"),
        ("1500 Magnolia Way", "Irvine", "CA", "92612"),
        ("1600 Redwood Ln", "Scottsdale", "AZ", "85251"),
        ("1700 Dogwood Ct", "Gilbert", "AZ", "85234"),
        ("1800 Juniper Rd", "Frisco", "TX", "75034"),
        ("1900 Cypress Blvd", "McKinney", "TX", "75070"),
        ("2000 Sequoia Dr", "Round Rock", "TX", "78664"),
    ]

    venues: list[Venue] = []
    for i, facility in enumerate(facilities):
        # 1-2 venues per facility
        num_venues = 2 if i < 10 else 1
        for j in range(num_venues):
            if len(venues) >= 20:
                break
            addr_idx = (i * 2 + j) % len(addresses)
            street, city, state, postal = addresses[addr_idx]
            cost = round(50 + (i * 5) + (j * 10), 2)

            assert facility.facility_id is not None
            venue = Venue(
                facility_id=facility.facility_id,
                street=street,
                city=city,
                state=state,
                postal_code=postal,
                cost=cost,
                is_active=True,
            )
            venues.append(venue)
        if len(venues) >= 20:
            break

    venue_db.create_venues_bulk(venues)
    # Query to get all venues with IDs since bulk create only returns last
    all_venues = venue_db.list_venues()
    print(f"Created {len(all_venues) if all_venues else 0} venues")
    return all_venues or []


def create_events(users: list[User], frequencies: list[Frequency], venues: list[Venue]) -> list[Event]:
    """Create 20 events."""
    print("\nCreating events...")
    event_db = EventSQLite()

    coaches = [u for u in users if u.role == "coach"]
    if not coaches:
        print("No coaches found, skipping events")
        return []

    events: list[Event] = []
    base_date = datetime.now(timezone.utc) + timedelta(days=1)

    for i in range(20):
        venue = venues[i % len(venues)]
        frequency = frequencies[i % len(frequencies)]
        coach = coaches[i % len(coaches)]

        start = base_date + timedelta(days=i * 2, hours=(i % 4) * 2)
        end = start + timedelta(minutes=60 + (i % 4) * 15)

        event = Event(
            start_date_time=start.isoformat(timespec="seconds"),
            end_date_time=end.isoformat(timespec="seconds"),
            frequency_id=frequency.frequency_id,
            description=f"Swim session {i+1} - {frequency.name} at {venue.city}",
            coach_id=coach.sub,
            venue_id=venue.venue_id,
            is_active=True,
        )
        events.append(event)

    event_db.create_events_bulk(events)
    all_events = event_db.list_events()
    print(f"Created {len(all_events) if all_events else 0} events")
    return all_events or []


def create_schedules(users: list[User], events: list[Event], venues: list[Venue]) -> list[Schedule]:
    """Create 20 schedule entries (member registrations)."""
    print("\nCreating schedules...")
    schedule_db = ScheduleSQLite()

    members = [u for u in users if u.role == "member"]
    if not members or not events:
        print("Missing members or events, skipping schedules")
        return []

    schedules: list[Schedule] = []
    for i in range(20):
        event = events[i % len(events)]
        member = members[i % len(members)]
        venue = next((v for v in venues if v.venue_id == event.venue_id), venues[0])
        assert venue.venue_id is not None
        assert event.event_id is not None

        schedule = Schedule(
            venue_id=venue.venue_id,
            member_id=member.sub,
            event_id=event.event_id,
            is_active=True,
        )
        schedules.append(schedule)

    schedule_db.create_schedules_bulk(schedules)
    all_schedules = schedule_db.list_schedules()
    print(f"Created {len(all_schedules) if all_schedules else 0} schedules")
    return all_schedules or []


def create_form_questions(facilities: list[Facility]) -> list[FormQuestion]:
    """Create 20 form questions across facilities."""
    print("\nCreating form questions...")
    fq_db = FormQuestionSQLite()

    questions_data = [
        ("Emergency Contact Name", QuestionType.TEXT, True, 1),
        ("Emergency Contact Phone", QuestionType.TEXT, True, 2),
        ("Known Allergies", QuestionType.TEXT, False, 3),
        ("Medical Conditions", QuestionType.TEXT, False, 4),
        ("Swimming Level", QuestionType.TEXT, True, 5),
        ("Preferred Stroke", QuestionType.TEXT, False, 6),
        ("Can Swim 25m Freestyle", QuestionType.CHECKBOX, True, 7),
        ("Can Swim 25m Backstroke", QuestionType.CHECKBOX, False, 8),
        ("Can Swim 25m Breaststroke", QuestionType.CHECKBOX, False, 9),
        ("Can Swim 25m Butterfly", QuestionType.CHECKBOX, False, 10),
        ("Previous Competitive Experience", QuestionType.CHECKBOX, False, 11),
        ("Current Medications", QuestionType.TEXT, False, 12),
        ("Physician Name", QuestionType.TEXT, False, 13),
        ("Physician Phone", QuestionType.TEXT, False, 14),
        ("Insurance Provider", QuestionType.TEXT, False, 15),
        ("Insurance Policy Number", QuestionType.TEXT, False, 16),
        ("Waiver Signed", QuestionType.CHECKBOX, True, 17),
        ("Photo Release", QuestionType.CHECKBOX, False, 18),
        ("Communication Preference (Email/SMS)", QuestionType.TEXT, False, 19),
        ("Special Accommodations Needed", QuestionType.TEXT, False, 20),
    ]

    questions: list[FormQuestion] = []
    for i, facility in enumerate(facilities):
        # 1-2 questions per facility
        for j in range(min(2, len(questions_data) - i * 2)):
            idx = i * 2 + j
            if idx >= len(questions_data):
                break
            prompt, qtype, required, sort = questions_data[idx]
            assert facility.facility_id is not None
            question = FormQuestion(
                facility_id=facility.facility_id,
                prompt=prompt,
                question_type=qtype,
                is_required=required,
                sort_order=sort,
                is_active=True,
            )
            questions.append(question)

    fq_db.create_form_questions_bulk(questions)
    all_questions = []
    for facility in facilities:
        if facility.facility_id:
            fqs = fq_db.list_form_questions_by_facility(facility.facility_id)
            if fqs:
                all_questions.extend(fqs)
    print(f"Created {len(all_questions)} form questions")
    return all_questions


def create_facility_rules(facilities: list[Facility]) -> list[FacilityRule]:
    """Create 20 facility rules."""
    print("\nCreating facility rules...")
    fr_db = FacilityRuleSQLite()

    rules_data = [
        ("Pool Rules", "No running on deck. No diving in shallow end. No glass containers.", 1),
        ("Lane Etiquette", "Circle swim counter-clockwise. Faster swimmers pass on left.", 2),
        ("Age Policy", "Children under 12 must be accompanied by an adult at all times.", 3),
        ("Swimwear", "Proper swim attire required. No cotton clothing in pools.", 4),
        ("Hygiene", "Shower before entering pool. No open wounds or infections.", 5),
        ("Equipment", "Kickboards and pull buoys for lap swim only. Return after use.", 6),
        ("Food & Drink", "No food or drink in pool area. Water in plastic bottles permitted.", 7),
        ("Electronics", "No phones or cameras in locker rooms. Use designated areas.", 8),
        ("Weather Policy", "Pool closes for 30 minutes after last thunder/lightning.", 9),
        ("Capacity", "Lifeguard may limit patrons for safety. First come, first served.", 10),
        ("Guest Policy", "Members may bring 2 guests per visit. Guest fees apply.", 11),
        ("Locker Rooms", "Lockers for day use only. Remove locks nightly.", 12),
        ("Lost & Found", "Items held 30 days. Unclaimed items donated.", 13),
        ("Membership", "Membership cards required for entry. No card = guest fee.", 14),
        ("Refunds", "No refunds for weather closures. Credits for medical only.", 15),
        ("Private Lessons", "Book through front desk. 24-hour cancellation policy.", 16),
        ("Team Practice", "Lanes 1-4 reserved for team Mon-Fri 4-6pm.", 17),
        ("Open Swim", "All lanes open Sat/Sun 12-5pm. No lap swim during open.", 18),
        ("Therapy Pool", "15-minute limit when others waiting. No jumping.", 19),
        ("Hot Tub", "Max 10 people. 15-minute limit. Ages 16+ only.", 20),
    ]

    rules: list[FacilityRule] = []
    for i, facility in enumerate(facilities):
        for j in range(min(2, len(rules_data) - i * 2)):
            idx = i * 2 + j
            if idx >= len(rules_data):
                break
            title, content, sort = rules_data[idx]
            assert facility.facility_id is not None
            rule = FacilityRule(
                facility_id=facility.facility_id,
                title=title,
                content=content,
                sort_order=sort,
                is_active=True,
            )
            rules.append(rule)

    fr_db.create_rules_bulk(rules)
    all_rules = []
    for facility in facilities:
        if facility.facility_id:
            frs = fr_db.list_rules_by_facility(facility.facility_id)
            if frs:
                all_rules.extend(frs)
    print(f"Created {len(all_rules)} facility rules")
    return all_rules


def create_form_submissions(
    users: list[User],
    facilities: list[Facility],
    form_questions: list[FormQuestion]
) -> list[FormSubmission]:
    """Create 20 form submissions with responses."""
    print("\nCreating form submissions...")
    fs_db = FormSubmissionSQLite()

    members = [u for u in users if u.role == "member"]
    if not members or not facilities:
        print("Missing members or facilities, skipping submissions")
        return []

    submissions: list[FormSubmission] = []
    responses_all: list[FormResponse] = []

    for i in range(20):
        member = members[i % len(members)]
        facility = facilities[i % len(facilities)]

        # Get questions for this facility
        facility_questions = [q for q in form_questions if q.facility_id == facility.facility_id]
        if not facility_questions:
            continue

        submitted_at = datetime.now(timezone.utc) - timedelta(days=30 - i)
        signed_at = submitted_at - timedelta(minutes=5)
        is_complete = i % 4 != 0  # 75% complete
        assert facility.facility_id is not None

        submission = FormSubmission(
            facility_id=facility.facility_id,
            sub=member.sub,
            signed_at=signed_at,
            submitted_at=submitted_at,
            is_complete=is_complete,
        )
        submissions.append(submission)

        # Create responses for each question
        for q_idx, question in enumerate(facility_questions):
            if question.question_type == QuestionType.CHECKBOX:
                answer_bool = i % 2 == 0
                answer_text = None
            else:
                answer_text = f"Answer from {member.sub} to {question.prompt}"
                answer_bool = None

            assert question.form_question_id is not None
            response = FormResponse(
                question_id=question.form_question_id,
                answer_text=answer_text,
                answer_bool=answer_bool,
            )
            responses_all.append(response)

    # Use create_submission which handles atomic submission+responses
    created_submissions = []
    for i, submission in enumerate(submissions):
        # Each submission gets 2 responses (2 questions per facility)
        submission_responses = responses_all[i*2:(i+1)*2] if i*2 < len(responses_all) else []
        created = fs_db.create_submission(submission, submission_responses)
        if created:
            created_submissions.append(created)

    print(f"Created {len(created_submissions)} form submissions")
    return created_submissions


def create_messages(users: list[User]) -> list[Message]:
    """Create 20 messages from staff to members."""
    print("\nCreating messages...")
    msg_db = MessageSQLite()

    staff = [u for u in users if u.role in ("coach", "facility_manager", "web_admin")]
    members = [u for u in users if u.role == "member"]

    if not staff or not members:
        print("Missing staff or members, skipping messages")
        return []

    subjects = [
        "Welcome to the Team!",
        "Schedule Change Notice",
        "Upcoming Meet Information",
        "Pool Maintenance Closure",
        "New Equipment Available",
        "Coach Feedback Session",
        "Registration Reminder",
        "Safety Protocol Update",
        "Holiday Schedule",
        "Team Social Event",
        "Skill Assessment Results",
        "Nutrition Workshop",
        "Volunteer Opportunities",
        "Facility Improvement Survey",
        "Championship Qualifiers",
        "Off-Season Training",
        "Parent Meeting Notice",
        "Equipment Order Form",
        "Travel Meet Details",
        "Season Wrap-Up",
    ]

    bodies = [
        "Welcome to the swim team! We're excited to have you join us.",
        "Please note the schedule change for next week's practices.",
        "Information about the upcoming regional meet is attached.",
        "The pool will be closed for maintenance on the dates listed.",
        "New kickboards and pull buoys are now available at all facilities.",
        "Schedule a 15-minute feedback session with your coach.",
        "Don't forget to register for next month's events by Friday.",
        "Updated safety protocols effective immediately. Please review.",
        "Special holiday schedule in effect Dec 24 - Jan 2.",
        "Join us for the team BBQ on Saturday at 2pm.",
        "Your recent skill assessment results are available in the portal.",
        "Free nutrition workshop for all members this Thursday.",
        "We need volunteers for the home meet on March 15.",
        "Please complete the facility improvement survey by month end.",
        "Championship qualifying times posted on the bulletin board.",
        "Off-season training program starts next Monday.",
        "Mandatory parent meeting for 12&under families.",
        "Team equipment order forms due by the 15th.",
        "Travel meet details and hotel blocks attached.",
        "Great season everyone! Awards banquet details coming soon.",
    ]

    messages: list[Message] = []
    for i in range(20):
        sender = staff[i % len(staff)]
        member = members[i % len(members)]
        sent_at = datetime.now(timezone.utc) - timedelta(days=20 - i)
        is_read = i % 3 != 0  # ~66% read

        message = Message(
            member_id=member.sub,
            sender_id=sender.sub,
            subject=subjects[i],
            body=bodies[i],
            is_read=is_read,
            sent_at=sent_at,
            is_active=True,
        )
        messages.append(message)

    msg_db.create_messages_bulk(messages)
    all_messages = msg_db.list_messages()
    print(f"Created {len(all_messages) if all_messages else 0} messages")
    return all_messages or []


def create_user_invites() -> list[UserInvite]:
    """Create user invites for prospective members."""
    print("\nCreating user invites...")
    ui_db = UserInviteSQLite()

    invite_emails = [
        "newcoach@swimclub.example.com",
        "newmanager@swimclub.example.com",
        "prospect1@swimclub.example.com",
        "prospect2@swimclub.example.com",
        "prospect3@swimclub.example.com",
        "prospect4@swimclub.example.com",
        "prospect5@swimclub.example.com",
        "prospect6@swimclub.example.com",
        "prospect7@swimclub.example.com",
        "prospect8@swimclub.example.com",
        "prospect9@swimclub.example.com",
        "prospect10@swimclub.example.com",
    ]

    invite_roles = [
        "coach",
        "facility_manager",
        "member", "member", "member", "member",
        "member", "member", "member", "member",
    ]

    invites: list[UserInvite] = []
    for email, role in zip(invite_emails, invite_roles):
        email_hash = hash_field(email)
        invite = UserInvite(
            email_hash=email_hash,
            role=role,
            is_active=True,
        )
        invites.append(invite)

    created = []
    for invite in invites:
        result = ui_db.create_invite(invite)
        if result:
            created.append(result)

    print(f"Created {len(created)} user invites")
    return created


def main() -> None:
    """Main seeding function."""
    print("=" * 50)
    print("Swimlane Database Seeding Script")
    print("=" * 50)

    # Initialize all tables
    init_all_dbs()

    # Create data in dependency order
    users = create_users()
    frequencies = create_frequencies()
    facilities = create_facilities()
    venues = create_venues(facilities)
    events = create_events(users, frequencies, venues)
    schedules = create_schedules(users, events, venues)
    form_questions = create_form_questions(facilities)
    facility_rules = create_facility_rules(facilities)
    form_submissions = create_form_submissions(users, facilities, form_questions)
    messages = create_messages(users)
    user_invites = create_user_invites()

    print("\n" + "=" * 50)
    print("Seeding Complete!")
    print("=" * 50)
    print(f"Users: {len(users)}")
    print(f"Frequencies: {len(frequencies)}")
    print(f"Facilities: {len(facilities)}")
    print(f"Venues: {len(venues)}")
    print(f"Events: {len(events)}")
    print(f"Schedules: {len(schedules)}")
    print(f"Form Questions: {len(form_questions)}")
    print(f"Facility Rules: {len(facility_rules)}")
    print(f"Form Submissions: {len(form_submissions)}")
    print(f"Messages: {len(messages)}")
    print(f"User Invites: {len(user_invites)}")


if __name__ == "__main__":
    main()
