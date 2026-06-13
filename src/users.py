from pydantic import BaseModel, EmailStr
from typing import List

# Simulating a database of users and their assigned roles
USER_DB = {
    "pete@letkeman.ca": {"email": "pete@letkeman.ca", "role": "admin"},
    "letkemanpetgmail.com": {"email": "letkemanpetgmail.com", "role": "user"}
}

class User(BaseModel):
    email: EmailStr
    role: str
