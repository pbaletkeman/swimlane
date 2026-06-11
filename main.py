import os
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import RedirectResponse
from starlette.middleware.sessions import SessionMiddleware
from authlib.integrations.starlette_client import OAuth

app = FastAPI()

# Session middleware is required by Authlib to keep track of state
# In production, use a strong, unpredictable random secret key
app.add_middleware(SessionMiddleware, secret_key="YOUR_SUPER_SECRET_SESSION_KEY")

oauth = OAuth()
oauth.register(
    name='google',
    client_id=os.getenv("GOOGLE_CLIENT_ID", "YOUR_GOOGLE_CLIENT_ID"),
    client_secret=os.getenv("GOOGLE_CLIENT_SECRET", "YOUR_GOOGLE_CLIENT_SECRET"),
    server_metadata_url='https://google.com',
    client_kwargs={
        'scope': 'openid email profile'
    }
)

@app.get("/")
async def root(request: Request):
    user = request.session.get('user')
    if user:
        return {"message": f"Hello, {user['name']}", "user_info": user}
    return {"message": "Welcome! Please log in at /login"}

@app.get("/login")
async def login(request: Request):
    # This creates the Google authorization URL and redirects the user
    redirect_uri = request.url_for('auth_callback')
    return await oauth.google.authorize_redirect(request, str(redirect_uri))

@app.get("/auth/callback")
async def auth_callback(request: Request):
    try:
        # Token exchange: Get token from Google using the callback code
        token = await oauth.google.authorize_access_token(request)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Authentication failed: {str(e)}")

    # Extract user profile information from OpenID Connect (OIDC) id_token
    user_info = token.get('userinfo')
    if user_info:
        # Store user profile data in the encrypted session cookie
        request.session['user'] = dict(user_info)

    return RedirectResponse(url="/")

@app.get("/logout")
async def logout(request: Request):
    # Clear session data to log out the user locally
    request.session.pop('user', None)
    return RedirectResponse(url="/")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
