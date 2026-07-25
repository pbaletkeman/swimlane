import os
import sqlite3
from typing import List, Optional
from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.responses import RedirectResponse
from starlette.middleware.sessions import SessionMiddleware
from authlib.integrations.starlette_client import OAuth

DB_FILE = "users.db"

# ==========================================
# 1. RAW SQL DATABASE SETUP
# ==========================================
def init_db():
    with sqlite3.connect(DB_FILE) as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                name TEXT,
                role TEXT DEFAULT 'member'
            )
        """)
        conn.commit()

init_db()

# Database helper to fetch a user dict safely
def db_get_user_by_email(email: str) -> Optional[dict]:
    with sqlite3.connect(DB_FILE) as conn:
        conn.row_factory = sqlite3.Row  # Enables fetching columns by name
        cursor = conn.cursor()
        cursor.execute("SELECT id, email, name, role FROM users WHERE email = ?", (email,))
        row = cursor.fetchone()
        return dict(row) if row else None

# Database helper to insert a new user safely
def db_create_user(email: str, name: str) -> dict:
    with sqlite3.connect(DB_FILE) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        try:
            cursor.execute(
                "INSERT INTO users (email, name, role) VALUES (?, ?, 'member')",
                (email, name)
            )
            conn.commit()
        except sqlite3.IntegrityError:
            pass # User created by another concurrent request

        cursor.execute("SELECT id, email, name, role FROM users WHERE email = ?", (email,))
        return dict(cursor.fetchone())

# ==========================================
# 2. FASTAPI & OAUTH SETUP
# ==========================================
app = FastAPI()
app.add_middleware(SessionMiddleware, secret_key="YOUR_SUPER_SECRET_SESSION_KEY")

oauth = OAuth()
oauth.register(
    name='google',
    client_id=os.getenv("GOOGLE_CLIENT_ID", "YOUR_GOOGLE_CLIENT_ID"),
    client_secret=os.getenv("GOOGLE_CLIENT_SECRET", "YOUR_GOOGLE_CLIENT_SECRET"),
    server_metadata_url='https://google.com',
    client_kwargs={'scope': 'openid email profile'}
)

# ==========================================
# 3. ROLE-BASED ACCESS CONTROL (RAW SQL)
# ==========================================
def get_current_user(request: Request) -> dict:
    session_user = request.session.get('user')
    if not session_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Query database directly using the session email
    user = db_get_user_by_email(session_user['email'])
    if not user:
        raise HTTPException(status_code=401, detail="User profile not found")
    return user

class RoleChecker:
    def __init__(self, allowed_roles: List[str]):
        self.allowed_roles = allowed_roles

    def __call__(self, current_user: dict = Depends(get_current_user)):
        if current_user["role"] not in self.allowed_roles:
            raise HTTPException(
                status_code=403,
                detail=f"Access denied. Requires role: {self.allowed_roles}"
            )
        return current_user

# ==========================================
# 4. AUTHENTICATION ROUTES
# ==========================================
@app.get("/login")
async def login(request: Request):
    redirect_uri = request.url_for('auth_callback')
    return await oauth.google.authorize_redirect(request, str(redirect_uri))

@app.get("/auth/callback")
async def auth_callback(request: Request):
    try:
        token = await oauth.google.authorize_access_token(request)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Authentication failed: {str(e)}")

    user_info = token.get('userinfo')
    if not user_info:
        raise HTTPException(status_code=400, detail="Failed to fetch user info")

    email = user_info['email']
    name = user_info.get('name')

    # Raw SQL Lookup
    user = db_get_user_by_email(email)
    if not user:
        # Raw SQL Insert
        user = db_create_user(email, name)

    # Store identity data in cookie session
    request.session['user'] = {"email": user["email"], "name": user["name"]}
    return RedirectResponse(url="/dashboard")

@app.get("/logout")
async def logout(request: Request):
    request.session.pop('user', None)
    return RedirectResponse(url="/")

# ==========================================
# 5. PROTECTED ROUTES
# ==========================================
@app.get("/dashboard")
async def dashboard(current_user: dict = Depends(get_current_user)):
    return {
        "message": f"Welcome back, {current_user['name']}!",
        "your_role": current_user['role']
    }

@app.get("/admin-only")
async def admin_panel(current_user: dict = Depends(RoleChecker(["admin"]))):
    return {"message": "Welcome to the secret Admin panel!", "user": current_user}


# Open the SQLite database file
sqlite3 users.db

# Update a specific user to admin
UPDATE users SET role = 'admin' WHERE email = 'your-google-email@gmail.com';

# Exit sqlite3 terminal
.exit
