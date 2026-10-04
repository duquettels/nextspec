import os
from dotenv import load_dotenv
import psycopg

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
def get_connection():
    return psycopg.connect(DATABASE_URL)

if __name__ == "__main__":
    conn = get_connection()
    print("Connection established successfully!")
    conn.close()