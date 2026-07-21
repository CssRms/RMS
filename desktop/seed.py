"""
Run once to pre-load employees into the local database.
Edit the list below to match your staff before running.
Usage: python seed.py
"""
from database import engine, employees
from sqlalchemy import select

STAFF = [
    {"staff_id": "11112222", "name": "Ephraim Hosea",  "department": "ICT",  "position": "ICT Officer"},
    # Add more employees here:
    # {"staff_id": "1002", "name": "John Peter", "department": "HR", "position": "Manager"},
]

def run():
    with engine.connect() as conn:
        existing = {r.staff_id for r in conn.execute(select(employees)).fetchall()}
        added = 0
        for emp in STAFF:
            if emp["staff_id"] in existing:
                print(f"  SKIP (exists): {emp['staff_id']} — {emp['name']}")
                continue
            conn.execute(employees.insert().values(**emp))
            added += 1
            print(f"  ADDED: {emp['staff_id']} — {emp['name']}")
        conn.commit()
    print(f"\nDone. {added} employee(s) added.")

if __name__ == "__main__":
    run()
