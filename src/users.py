from pydantic import BaseModel, EmailStr
from typing import List

# Simulating a database of users and their assigned roles
USER_DB = {
    "pete@letkeman.ca": {"email": "pete@letkeman.ca", "role": "admin"},
    "letkemanpete@gmail.com": {"email": "letkemanpete@gmail.com", "role": "user"}
}

class User(BaseModel):
    email: EmailStr
    role: str
