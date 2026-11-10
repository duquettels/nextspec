import os
from dotenv import load_dotenv
import psycopg

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

DATABASE_URL = os.getenv("DATABASE_URL")
def get_connection():
    return psycopg.connect(DATABASE_URL)

if __name__ == "__main__":
    conn = get_connection()
    print("Connection established successfully!")
    conn.close()