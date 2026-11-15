import os
import json
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

# Explicitly load and override environment variables from the root .env file
dotenv_path = os.path.join(os.path.dirname(__file__), '../.env')
load_dotenv(dotenv_path=dotenv_path, override=True)

app = FastAPI(
    title="JARSIG Mission Control API",
    description="Backend telemetry and site evaluation engine for JARSIG Artemis Lunar South Pole Mission.",
    version="1.0.0"
)

# Enable CORS for frontend integration (Vite running on localhost:5173 or similar)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database connection helper
def get_db_connection():
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise HTTPException(status_code=500, detail="DATABASE_URL is not set in environment variables.")
    try:
        conn = psycopg2.connect(db_url, cursor_factory=RealDictCursor)
        return conn
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database connection failed: {str(e)}")

# Pydantic Models for Request/Response Validation
class TelemetryRunCreate(BaseModel):
    operator_id: Optional[int] = None
    target_site_id: int
    success: bool
    final_fuel_pct: float
    touchdown_descent_rate: float
    touchdown_drift_rate: float
    flight_duration_sec: int
    trajectory_payload: List[Dict[str, Any]] = Field(..., description="Time-series array of telemetry frames")

@app.get("/")
def read_root():
    return {"status": "ONLINE", "system": "JARSIG Mission Control Backend", "version": "1.0.0"}

# 1. Get Curated Landing Sites for Scenario Evaluation
@app.get("/api/sites")
def get_landing_sites():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT * FROM landing_sites ORDER BY site_id ASC;")
        sites = cursor.fetchall()
        return {"count": len(sites), "sites": sites}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()

# 2. Save User Flight Telemetry Run (AI Training Dataset Collection)
@app.post("/api/telemetry")
def create_telemetry_run(run: TelemetryRunCreate):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        query = """
            INSERT INTO flight_telemetry_runs 
            (operator_id, target_site_id, success, final_fuel_pct, touchdown_descent_rate, touchdown_drift_rate, flight_duration_sec, trajectory_payload)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING run_id, created_at;
        """
        cursor.execute(query, (
            run.operator_id,
            run.target_site_id,
            run.success,
            run.final_fuel_pct,
            run.touchdown_descent_rate,
            run.touchdown_drift_rate,
            run.flight_duration_sec,
            json.dumps(run.trajectory_payload)
        ))
        new_run = cursor.fetchone()
        conn.commit()
        return {
            "message": "Telemetry run successfully recorded for AI training dataset.",
            "run_id": new_run["run_id"],
            "created_at": new_run["created_at"]
        }
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()