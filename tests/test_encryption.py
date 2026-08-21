"""Tests for src/encryption.py — encrypt/decrypt round-trip, hash, edge cases."""

from src.encryption import decrypt_field, encrypt_field, hash_field


def test_encrypt_decrypt_round_trip():
    plaintext = "Hello, World!"
    encrypted = encrypt_field(plaintext)
    decrypted = decrypt_field(encrypted["nonce"], encrypted["ciphertext"])
    assert decrypted == plaintext


def test_encrypt_produces_unique_nonces():
    a = encrypt_field("same")
    b = encrypt_field("same")
    assert a["nonce"] != b["nonce"]
    assert a["ciphertext"] != b["ciphertext"]


def test_encrypt_returns_base64_strings():
    result = encrypt_field("test")
    import base64
    base64.b64decode(result["nonce"])
    base64.b64decode(result["ciphertext"])


def test_decrypt_wrong_nonce_raises():
    encrypted = encrypt_field("secret")
    import base64
    wrong_nonce = base64.b64encode(b"000000000000").decode("ascii")
    try:
        decrypt_field(wrong_nonce, encrypted["ciphertext"])
        assert False, "Should have raised"
    except Exception:
        pass


def test_decrypt_wrong_ciphertext_raises():
    encrypted = encrypt_field("secret")
    import base64
    wrong_ct = base64.b64encode(b"garbage").decode("ascii")
    try:
        decrypt_field(encrypted["nonce"], wrong_ct)
        assert False, "Should have raised"
    except Exception:
        pass


def test_encrypt_empty_string():
    result = encrypt_field("")
    decrypted = decrypt_field(result["nonce"], result["ciphertext"])
    assert decrypted == ""


def test_encrypt_unicode():
    plaintext = "Café résumé 你好"
    encrypted = encrypt_field(plaintext)
    decrypted = decrypt_field(encrypted["nonce"], encrypted["ciphertext"])
    assert decrypted == plaintext


def test_hash_field_deterministic():
    h1 = hash_field("Test@Example.com")
    h2 = hash_field("Test@Example.com")
    assert h1 == h2


def test_hash_field_case_insensitive():
    h1 = hash_field("Test@Example.com")
    h2 = hash_field("test@example.com")
    assert h1 == h2


def test_hash_field_returns_hex():
    h = hash_field("test")
    assert len(h) == 64  # SHA-256 hex digest
    int(h, 16)  # should not raise


def test_hash_field_different_inputs_differ():
    h1 = hash_field("alice@example.com")
    h2 = hash_field("bob@example.com")
    assert h1 != h2
