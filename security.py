import jwt
import datetime

# In production, this would be an environment variable. Never hardcode it!
SECRET_KEY = "my_super_secret_key_never_put_this_in_code_in_production"
ALGORITHM = "HS256"

def create_access_token(user_id: int):
    """Generates a secure JWT containing the user's ID."""
    # The payload is the data we want to encode securely.
    payload = {
        "user_id": user_id,
        # The token will naturally expire after 24 hours
        "exp": datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=24)
    }
    
    # We cryptographically sign the payload with our SECRET_KEY.
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    return token

def verify_token(token: str):
    """Reads a JWT, verifies the signature, and returns the user_id."""
    try:
        # If the token was tampered with by a hacker, or if it is expired, 
        # jwt.decode will instantly throw a PyJWTError.
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("user_id")
    except jwt.PyJWTError:
        return None
