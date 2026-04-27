import sqlite3

def run():
    print("Running migration...")
    conn = sqlite3.connect("data/db/riddim.db")
    c = conn.cursor()
    try:
        c.execute("ALTER TABLE taste_profiles ADD COLUMN dj_summary TEXT")
        conn.commit()
        print("Success: Added dj_summary column.")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e):
            print("dj_summary column already exists.")
        else:
            raise e
    finally:
        conn.close()

if __name__ == "__main__":
    run()
