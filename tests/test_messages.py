"""Message route tests — send, inbox, mark read, soft/hard delete."""

from __future__ import annotations

from fastapi.testclient import TestClient


def _send(client: TestClient, seed: dict, member_id: str) -> int:
    r = client.post(
        "/messages",
        headers=seed["coach1"],
        json={"member_id": member_id, "subject": "Test", "body": "Hello"},
    )
    assert r.status_code == 200
    return r.json()["message_id"]


def test_send_message(client: TestClient, seed: dict) -> None:
    mid = _send(client, seed, "t-m1")
    assert mid > 0


def test_send_requires_nonempty_subject(client: TestClient, seed: dict) -> None:
    r = client.post(
        "/messages", headers=seed["coach1"],
        json={"member_id": "t-m1", "subject": "", "body": "Hi"},
    )
    assert r.status_code in (400, 422)


def test_send_requires_auth(client: TestClient, seed: dict) -> None:
    r = client.post("/messages", json={"member_id": "t-m1", "subject": "X", "body": "Y"})
    assert r.status_code == 401


def test_member_cannot_send(client: TestClient, seed: dict) -> None:
    r = client.post(
        "/messages", headers=seed["m1"],
        json={"member_id": "t-m2", "subject": "X", "body": "Y"},
    )
    assert r.status_code == 403


def test_inbox_shows_messages(client: TestClient, seed: dict) -> None:
    _send(client, seed, "t-m1")
    r = client.get("/messages/me", headers=seed["m1"])
    assert r.status_code == 200
    msgs = r.json()
    assert len(msgs) >= 1
    assert "sender_name" in msgs[0]


def test_inbox_empty_for_no_messages(client: TestClient, seed: dict) -> None:
    r = client.get("/messages/me", headers=seed["m3"])
    assert r.status_code == 200
    assert r.json() == []


def test_mark_read(client: TestClient, seed: dict) -> None:
    mid = _send(client, seed, "t-m1")
    r = client.put(f"/messages/{mid}/read", headers=seed["m1"])
    assert r.status_code == 200


def test_mark_read_other_member_forbidden(client: TestClient, seed: dict) -> None:
    mid = _send(client, seed, "t-m1")
    r = client.put(f"/messages/{mid}/read", headers=seed["m2"])
    assert r.status_code == 403


def test_soft_delete(client: TestClient, seed: dict) -> None:
    mid = _send(client, seed, "t-m1")
    r = client.delete(f"/messages/{mid}", headers=seed["m1"])
    assert r.status_code == 200
    # Gone from inbox
    msgs = client.get("/messages/me", headers=seed["m1"]).json()
    assert not any(m["message_id"] == mid for m in msgs)


def test_soft_delete_other_member_forbidden(client: TestClient, seed: dict) -> None:
    mid = _send(client, seed, "t-m1")
    r = client.delete(f"/messages/{mid}", headers=seed["m2"])
    assert r.status_code == 403


def test_hard_delete_admin(client: TestClient, seed: dict) -> None:
    mid = _send(client, seed, "t-m1")
    r = client.delete(f"/messages/{mid}/hard", headers=seed["admin"])
    assert r.status_code == 200


def test_hard_delete_non_admin_forbidden(client: TestClient, seed: dict) -> None:
    mid = _send(client, seed, "t-m1")
    r = client.delete(f"/messages/{mid}/hard", headers=seed["m1"])
    assert r.status_code == 403
