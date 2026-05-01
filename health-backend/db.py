import os
import mysql.connector
from mysql.connector import errors as mysql_errors
from dotenv import load_dotenv

load_dotenv()

def get_connection():
    """Attempt to connect to MySQL using .env values.
    If the server cannot be reached, return None so callers can use fallback data.
    """
    try:
        return mysql.connector.connect(
            host=os.getenv("DB_HOST", "localhost"),
            user=os.getenv("DB_USER", "root"),
            password=os.getenv("DB_PASSWORD", "mysql"),
            database=os.getenv("DB_NAME", "health_ai"),
        )
    except mysql_errors.Error as e:
        print(f"[DB] Connection error: {e}")
        return None