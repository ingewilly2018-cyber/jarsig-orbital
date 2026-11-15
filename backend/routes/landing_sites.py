from fastapi import APIRouter, HTTPException
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

router = APIRouter(prefix="/api", tags=["Landing Sites"])

dotenv_path = os.path.join(os.path.dirname(__file__), '../../.env')
load_dotenv(dotenv_path=dotenv_path, override=True)

def get_db_connection():
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise HTTPException(status_code=500, detail="Database configuration error.")
    return psycopg2.connect(db_url, cursor_factory=RealDictCursor)

@router.get("/landing-sites")
def get_landing_sites():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM landing_sites ORDER BY id ASC;")
        sites = cursor.fetchall()
        cursor.close()
        conn.close()
        return {"status": "success", "count": len(sites), "data": sites}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))