import sqlite3
import os

# Logic: Define the path for our Sidecar DB
db_path = os.path.join(".orchestration", "trace_storage.db")

def init_db():
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Logic: Create the table for your Agent Traces (Phase 1 Data Model)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS agent_traces (
                id TEXT PRIMARY KEY,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                intent_id TEXT,
                file_path TEXT,
                content_hash TEXT,
                metadata TEXT
            )
        ''')
        
        # Logic: Optimization for low RAM - use Disk as Virtual RAM
        cursor.execute("PRAGMA mmap_size = 268435456;") # 256MB mmap
        
        conn.commit()
        conn.close()
        print(f"✅ Orchestration Ledger Initialized at {db_path}")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    init_db()