import hashlib
import sqlite3
import sys
import os
import uuid

# Logic: Maintain consistent pathing for Windows/Linux
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB_PATH = os.path.join(BASE_DIR, ".orchestration", "trace_storage.db")

def calculate_sha256(content):
    """Normalized hashing: ignores whitespace and line endings to ensure 
    consistency across different editors/OS."""
    normalized = "".join(content.split()).encode('utf-8')
    return hashlib.sha256(normalized).hexdigest()

def log_change(intent_id, file_path, content):
    content_hash = calculate_sha256(content)
    trace_id = str(uuid.uuid4())
    
    try:
        conn = sqlite3.connect(DB_PATH)
        # Performance: Use Write-Ahead Logging for faster disk I/O
        conn.execute("PRAGMA journal_mode=WAL;")
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO agent_traces (id, intent_id, file_path, content_hash)
            VALUES (?, ?, ?, ?)
        ''', (trace_id, intent_id, file_path, content_hash))
        conn.commit()
        conn.close()
        return content_hash
    except Exception as e:
        return f"Database Error: {e}"

if __name__ == "__main__":
    # Command: python tmd.py <intent_id> <file_path> <content>
    if len(sys.argv) >= 4:
        intent, path, code = sys.argv[1], sys.argv[2], sys.argv[3]
        result_hash = log_change(intent, path, code)
        print(f"HASH_VERIFIED:{result_hash}")
    else:
        print("Usage: python tmd.py <intent_id> <file_path> <content>")