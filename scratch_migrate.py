from database import engine
from sqlalchemy import text
with engine.connect() as conn:
    conn.execute(text('ALTER TABLE services ADD COLUMN IF NOT EXISTS is_paused BOOLEAN DEFAULT FALSE;'))
    conn.commit()
print("Migration complete!")
