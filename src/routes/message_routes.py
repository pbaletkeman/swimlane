"""
Message API routes for the member inbox.

Staff (coach and above) send messages to members; members read, mark-read, and
soft-delete their own. Permanent deletion is admin-only. Follows the class-based
router pattern used across the application.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from src.data.message.message import Message
from src.data.message.sqlite import SQLite as MessageSQLite
from src.data.users.sqlite import SQLite as UsersSQLite
from src.data.users.user import User
from src.encryption import decrypt_field
from src.roles.roles import admin_role, all_users, coach_role, member_role

logger = logging.getLogger(__name__)


class MessageInput(BaseModel):
    """Request body for sending a staff message to a member."""

    member_id: str
    subject: str
    body: str = ""


class MessageItem(BaseModel):
    """A message in a member's inbox with the sender's display name."""

    message_id: int
    member_id: str
    sender_id: str
    sender_name: str
    subject: str
    body: str
    is_read: bool
    sent_at: str | None = None
    is_active: bool


class MessageRoutes:
    """Defines all message-related routes."""

    def __init__(self):
        """Register the message routes on a new APIRouter."""
        self.router = APIRouter(prefix="/messages", tags=["messages"])

        self.router.add_api_route(
            "/me",
            self.list_my_messages,
            methods=["GET"],
            dependencies=[Depends(member_role)],
        )
        self.router.add_api_route(
            "",
            self.send_message,
            methods=["POST"],
            dependencies=[Depends(coach_role)],
        )
        self.router.add_api_route(
            "/{message_id}/read",
            self.mark_message_read,
            methods=["PUT"],
            dependencies=[Depends(member_role)],
        )
        self.router.add_api_route(
            "/{message_id}",
            self.delete_message,
            methods=["DELETE"],
            dependencies=[Depends(all_users)],
        )
        self.router.add_api_route(
            "/{message_id}/hard",
            self.hard_delete_message,
            methods=["DELETE"],
            dependencies=[Depends(admin_role)],
        )

    # ------------------------------------------------------------------
    def _get_db(self) -> MessageSQLite:
        """Return a fresh SQLite message store."""
        return MessageSQLite()

    # ------------------------------------------------------------------
    def _get_users_db(self) -> UsersSQLite:
        """Return a fresh SQLite user store."""
        return UsersSQLite()

    # ------------------------------------------------------------------
    def _sender_name(self, sender_id: str) -> str:
        """Return the sender's decrypted display name, falling back to their sub."""
        try:
            user = self._get_users_db().get_user_by_sub(sender_id)
            if not user or not user.first_name_nonce or not user.first_name_ciphertext:
                return sender_id
            first = decrypt_field(user.first_name_nonce, user.first_name_ciphertext)
            last = ""
            if user.last_name_nonce and user.last_name_ciphertext:
                last = decrypt_field(user.last_name_nonce, user.last_name_ciphertext)
            return f"{first} {last}".strip() or sender_id
        except Exception:
            return sender_id

    # ------------------------------------------------------------------
    def _to_item(self, message: Message) -> MessageItem:
        """Convert a message into a MessageItem with the sender's display name."""
        return MessageItem(
            message_id=message.message_id or 0,
            member_id=message.member_id,
            sender_id=message.sender_id,
            sender_name=self._sender_name(message.sender_id),
            subject=message.subject,
            body=message.body,
            is_read=message.is_read,
            sent_at=message.sent_at.isoformat() if message.sent_at else None,
            is_active=message.is_active,
        )

    # ------------------------------------------------------------------
    async def list_my_messages(self, current_user: User = Depends(member_role)) -> list[MessageItem]:
        """List the caller's inbox messages with sender display names."""
        try:
            messages = self._get_db().list_by_member(current_user.sub) or []
            return [self._to_item(message) for message in messages]
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to list messages")
            raise HTTPException(status_code=500, detail="Internal server error") from exc

    # ------------------------------------------------------------------
    async def send_message(self, body: MessageInput, current_user: User = Depends(coach_role)) -> MessageItem:
        """Send a staff message to a member (staff -> member inbox only)."""
        try:
            if not body.subject.strip():
                raise HTTPException(status_code=400, detail="Subject is required")
            recipient = self._get_users_db().get_user_by_sub(body.member_id)
            if not recipient:
                raise HTTPException(status_code=404, detail="Recipient not found")
            message = Message(
                member_id=body.member_id,
                sender_id=current_user.sub,
                subject=body.subject.strip(),
                body=body.body,
            )
            created = self._get_db().create_message(message)
            if not created:
                raise HTTPException(status_code=500, detail="Failed to send message")
            return self._to_item(created)
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to send message")
            raise HTTPException(status_code=500, detail="Internal server error") from exc

    # ------------------------------------------------------------------
    async def mark_message_read(self, message_id: int, current_user: User = Depends(member_role)) -> MessageItem:
        """Mark a message as read (own inbox only)."""
        try:
            db = self._get_db()
            message = db.get_message_by_id(message_id)
            if not message:
                raise HTTPException(status_code=404, detail="Message not found")
            if message.member_id != current_user.sub:
                raise HTTPException(status_code=403, detail="Cannot access another member's message")
            updated = db.mark_read(message_id)
            if not updated:
                raise HTTPException(status_code=500, detail="Failed to mark message as read")
            return self._to_item(updated)
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to mark message as read")
            raise HTTPException(status_code=500, detail="Internal server error") from exc

    # ------------------------------------------------------------------
    async def delete_message(self, message_id: int, current_user: User = Depends(all_users)) -> dict[str, str]:
        """Soft-delete a message from the caller's own inbox."""
        try:
            db = self._get_db()
            message = db.get_message_by_id(message_id)
            if not message:
                raise HTTPException(status_code=404, detail="Message not found")
            if message.member_id != current_user.sub:
                raise HTTPException(status_code=403, detail="Cannot delete another member's message")
            db.delete_message_by_id(message_id)
            return {"message": "Message deleted"}
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to delete message")
            raise HTTPException(status_code=500, detail="Internal server error") from exc

    # ------------------------------------------------------------------
    async def hard_delete_message(self, message_id: int) -> dict[str, str]:
        """Permanently delete a message (admin only)."""
        try:
            db = self._get_db()
            existing = db.get_message_by_id(message_id)
            if not existing:
                raise HTTPException(status_code=404, detail="Message not found")
            db.hard_delete_message_by_id(message_id)
            return {"message": "Message permanently deleted"}
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to hard delete message")
            raise HTTPException(status_code=500, detail="Internal server error") from exc
