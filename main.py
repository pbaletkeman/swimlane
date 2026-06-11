import os
from fastapi import FastAPI
from starlette.middleware.sessions import SessionMiddleware

# Load your config (your function)
from src.util.load_config import load_config
from src.auth_routes import AuthRoutes

load_config()

app = FastAPI()

# --- SESSION MIDDLEWARE ---
app.add_middleware(SessionMiddleware, secret_key=os.urandom(24).hex())

# Include the router in the app
auth_routes = AuthRoutes()
app.include_router(auth_routes.router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
