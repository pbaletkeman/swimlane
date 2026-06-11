pip install "psycopg[binary]" pydantic

import os
import sqlite3
from typing import List, Optional
from fastapi import FastAPI, Request, HTTPException, Depends, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, EmailStr
from starlette.middleware.sessions import SessionMiddleware
from authlib.integrations.starlette_client import OAuth
import psycopg

# ==========================================
# 1. DYNAMIC ENVIRONMENT CONFIGURATION
# ==========================================
DB_MODE = os.getenv("DB_MODE", "sqlite")  # Options: "sqlite" or "postgres"
POSTGRES_DSN = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/myapp")
SQLITE_FILE = "users.db"

# Non-negotiable Master Admin Email configuration
MASTER_ADMIN_EMAIL = os.getenv("MASTER_ADMIN_EMAIL", "master.admin@gmail.com")

# ==========================================
# 2. RAW DATABASE ENGINE ROUTER
# ==========================================
class DatabaseConnection:
    """Manages raw execution syntax for both SQLite and PostgreSQL natively."""
    def __enter__(self):
        if DB_MODE == "postgres":
            self.conn = psycopg.connect(POSTGRES_DSN)
            self.cursor = self.conn.cursor()
        else:
            self.conn = sqlite3.connect(SQLITE_FILE)
            self.conn.row_factory = sqlite3.Row
            self.cursor = self.conn.cursor()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is None:
            self.conn.commit()
        else:
            self.conn.rollback()
        self.cursor.close()
        self.conn.close()

    def fetchone(self, query: str, params: tuple = ()) -> Optional[dict]:
        # Handle parameter syntax variation between drivers (?, vs %s)
        sql = query.replace("?", "%s") if DB_MODE == "postgres" else query
        self.cursor.execute(sql, params)
        row = self.cursor.fetchone()
        if not row:
            return None
        return dict(row) if DB_MODE == "sqlite" else dict(zip([col.name for col in self.cursor.description], row))

    def fetchall(self, query: str, params: tuple = ()) -> List[dict]:
        sql = query.replace("?", "%s") if DB_MODE == "postgres" else query
        self.cursor.execute(sql, params)
        rows = self.cursor.fetchall()
        if DB_MODE == "sqlite":
            return [dict(row) for row in rows]
        columns = [col.name for col in self.cursor.description]
        return [dict(zip(columns, row)) for row in rows]

    def execute(self, query: str, params: tuple = ()):
        sql = query.replace("?", "%s") if DB_MODE == "postgres" else query
        self.cursor.execute(sql, params)

# Initialize Schema Natively
def init_db():
    with DatabaseConnection() as db:
        if DB_MODE == "postgres":
            db.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    email TEXT UNIQUE NOT NULL,
                    name TEXT,
                    role TEXT DEFAULT 'member'
                );
            """)
        else:
            db.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email TEXT UNIQUE NOT NULL,
                    name TEXT,
                    role TEXT DEFAULT 'member'
                );
            """)

init_db()

# ==========================================
# 3. PYDANTIC REQUEST SCHEMAS
# ==========================================
class UserCreateRequest(BaseModel):
    email: EmailStr
    name: str
    role: str = "member"

class RoleUpdateRequest(BaseModel):
    role: str

# ==========================================
# 4. FASTAPI & AUTH SYSTEM INITIALIZATION
# ==========================================
app = FastAPI(title="Raw SQL Multi-DB Account & RBAC Engine")
app.add_middleware(SessionMiddleware, secret_key=os.getenv("SESSION_SECRET", "CHANGEME_SECRET_KEY"))

oauth = OAuth()
oauth.register(
    name='google',
    client_id=os.getenv("GOOGLE_CLIENT_ID", "YOUR_CLIENT_ID"),
    client_secret=os.getenv("GOOGLE_CLIENT_SECRET", "YOUR_CLIENT_SECRET"),
    server_metadata_url='https://google.com',
    client_kwargs={'scope': 'openid email profile'}
)

# ==========================================
# 5. ACCESS CONTROL DEPENDENCIES
# ==========================================
def get_current_user(request: Request) -> dict:
    session_user = request.session.get('user')
    if not session_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    with DatabaseConnection() as db:
        user = db.fetchone("SELECT id, email, name, role FROM users WHERE email = ?", (session_user['email'],))

    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="System profile missing")
    return user

class RoleRequirement:
    def __init__(self, allowed_roles: List[str]):
        self.allowed_roles = allowed_roles

    def __call__(self, current_user: dict = Depends(get_current_user)):
        if current_user["role"] not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Restricted access. Requires target clearance: {self.allowed_roles}"
            )
        return current_user

# ==========================================
# 6. OAUTH GOOGLE INGESTION ENDPOINTS
# ==========================================
@app.get("/login")
async def login(request: Request):
    return await oauth.google.authorize_redirect(request, str(request.url_for('auth_callback')))

@app.get("/auth/callback")
async def auth_callback(request: Request):
    token = await oauth.google.authorize_access_token(request)
    user_info = token.get('userinfo')
    if not user_info:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Identity verification failed")

    email = user_info['email']
    name = user_info.get('name')

    with DatabaseConnection() as db:
        user = db.fetchone("SELECT id, email, name, role FROM users WHERE email = ?", (email,))
        if not user:
            # Enforce hardcoded Master Account assignment automatically
            assigned_role = "admin" if email.lower() == MASTER_ADMIN_EMAIL.lower() else "member"
            db.execute("INSERT INTO users (email, name, role) VALUES (?, ?, ?)", (email, name, assigned_role))
            user = db.fetchone("SELECT id, email, name, role FROM users WHERE email = ?", (email,))

    request.session['user'] = {"email": user["email"], "name": user["name"]}
    return {"message": "Authenticated successfully", "active_session_profile": user}

# ==========================================
# 7. ACCOUNT MANAGEMENT API (ADMIN PRIVILEGED)
# ==========================================

# READ ALL ACCOUNTS
@app.get("/admin/users", tags=["Account Management"])
async def get_all_users(_: dict = Depends(RoleRequirement(["admin"]))):
    with DatabaseConnection() as db:
        users = db.fetchall("SELECT id, email, name, role FROM users ORDER BY id ASC")
    return {"total_accounts": len(users), "users": users}

# PROACTIVELY CREATE AN ACCOUNT MANUALLY (Pre-registration)
@app.post("/admin/users", status_code=status.HTTP_201_CREATED, tags=["Account Management"])
async def create_user_manually(payload: UserCreateRequest, _: dict = Depends(RoleRequirement(["admin"]))):
    with DatabaseConnection() as db:
        existing = db.fetchone("SELECT id FROM users WHERE email = ?", (payload.email,))
        if existing:
            raise HTTPException(status_code=400, detail="Account matching that email variant exists")
        db.execute("INSERT INTO users (email, name, role) VALUES (?, ?, ?)", (payload.email, payload.name, payload.role))
    return {"message": "User provisioned successfully"}

# MODIFY TARGET ACCOUNT ROLE DYNAMICALLY
@app.patch("/admin/users/{user_id}/role", tags=["Account Management"])
async def update_user_role(user_id: int, payload: RoleUpdateRequest, current_user: dict = Depends(RoleRequirement(["admin"]))):
    if payload.role not in ["admin", "member"]:
        raise HTTPException(status_code=400, detail="Target designation must be 'admin' or 'member'")

    with DatabaseConnection() as db:
        target_user = db.fetchone("SELECT id, email FROM users WHERE id = ?", (user_id,))
        if not target_user:
            raise HTTPException(status_code=404, detail="Target user profile record absent")

        # Self-sabotage security block
        if target_user["email"].lower() == MASTER_ADMIN_EMAIL.lower() and current_user["id"] == user_id:
             raise HTTPException(status_code=403, detail="Cannot downgrade the Master Admin designation via self-action")

        db.execute("UPDATE users SET role = ? WHERE id = ?", (payload.role, user_id))
    return {"message": f"Successfully updated User ID {user_id} role to '{payload.role}'"}

# DELETE AN ACCOUNT COMPLETELY
@app.delete("/admin/users/{user_id}", tags=["Account Management"])
async def delete_user(user_id: int, _: dict = Depends(RoleRequirement(["admin"]))):
    with DatabaseConnection() as db:
        target_user = db.fetchone("SELECT id, email FROM users WHERE id = ?", (user_id,))
        if not target_user:
            raise HTTPException(status_code=404, detail="Target user profile record absent")

        if target_user["email"].lower() == MASTER_ADMIN_EMAIL.lower():
            raise HTTPException(status_code=403, detail="The immutable Master Admin account cannot be deleted")

        db.execute("DELETE FROM users WHERE id = ?", (user_id,))
    return {"message": f"Account with User ID {user_id} completely expunged from the engine database"}
