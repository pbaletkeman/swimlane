from pydantic import BaseModel


# Simulating a database of users and their assigned roles
# use "sub" (subject) claim as the unique identifier for users, as per JWT standards
USER_DB = {
    "111122296393493391055": {"sub": "111122296393493391055", "role": "admin"},  # pete@letkeman.ca
    "117866130266135772771": {"sub": "117866130266135772771", "role": "user"}  # letkemanpete@gmail.com
}

class User(BaseModel):
    sub: str
    role: str
