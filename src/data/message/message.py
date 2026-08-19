"""Message data model for the Swimlane application."""

import datetime

from pydantic import BaseModel


class Message(BaseModel):
    """Data model representing a staff-to-member message in the member's inbox."""

    message_id: int | None = None
    member_id: str  # Recipient (FK -> users.sub)
    sender_id: str  # Sender (FK -> users.sub); staff -> member, see Key decision #5
    subject: str
    body: str
    is_read: bool = False
    sent_at: datetime.datetime | None = None
    is_active: bool = True
