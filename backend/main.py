
import os
import json
import logging
from contextlib import contextmanager
from pathlib import Path
from typing import List, Dict, Any, Optional

import psycopg2
from psycopg2.extras import RealDictCursor

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, ConfigDict

# ============================================================
# 1. CONFIGURATION
# ============================================================

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent

# Load the root .env file
load_dotenv(PROJECT_ROOT / ".env", override=True)

DATABASE_URL = os.getenv("DATABASE_URL")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("jarsig.backend")

# Configure frontend origins in .env:
# FRONTEND_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
FRONTEND_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "FRONTEND_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",")
    if origin.strip()
]

# ============================================================
# 2. FASTAPI APPLICATION
# ============================================================

app = FastAPI(
    title="JARSIG Mission Control API",
    description=(
        "Backend telemetry, landing-site evaluation, "
        "and NASA resource proxy engine for the "
        "JARSIG Artemis Lunar South Pole Mission."
    ),
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

# ============================================================
# 3. DATABASE CONNECTION
# ============================================================

def get_db_connection():
    """
    Establish a PostgreSQL database connection.

    DATABASE_URL must be configured in the root .env file.
    """
    if not DATABASE_URL:
        raise HTTPException(
            status_code=500,
            detail="Database configuration is missing."
        )

    try:
        return psycopg2.connect(
            DATABASE_URL,
            cursor_factory=RealDictCursor,
            connect_timeout=10,
        )
    except psycopg2.Error:
        logger.exception("PostgreSQL connection failed.")

        raise HTTPException(
            status_code=503,
            detail="Unable to connect to the mission database."
        )


# ============================================================
# 4. DATABASE DEPENDENCY
# ============================================================

def get_db():
    """
    Provide a database connection to an endpoint
    and automatically close it afterward.
    """
    conn = get_db_connection()

    try:
        yield conn
    finally:
        conn.close()


# ============================================================
# 5. PYDANTIC MODELS
# ============================================================

class TelemetryRunCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    operator_id: Optional[int] = Field(
        default=None,
        gt=0
    )

    target_site_id: int = Field(
        ...,
        gt=0,
        description="ID of the selected lunar landing site."
    )

    success: bool

    final_fuel_pct: float = Field(
        ...,
        ge=0,
        le=100
    )

    touchdown_descent_rate: float = Field(
        ...,
        ge=0,
        description="Touchdown vertical descent rate."
    )

    touchdown_drift_rate: float = Field(
        ...,
        ge=0,
        description="Touchdown horizontal drift rate."
    )

    flight_duration_sec: int = Field(
        ...,
        gt=0
    )

    trajectory_payload: List[Dict[str, Any]] = Field(
        ...,
        min_length=1,
        description="Time-series array of telemetry frames."
    )


# ============================================================
# 6. ROUTER REGISTRATION
# ============================================================

try:
    from backend.routers.nasa_ephemeris import router as nasa_router

    app.include_router(nasa_router)

except ImportError:
    logger.exception("Unable to load NASA ephemeris router.")
    raise

# Register the landing sites router if available.
# Its existing prefix is /api, so it exposes /api/landing-sites.

try:
    from backend.routers.landing_sites import router as landing_sites_router

    app.include_router(landing_sites_router)

except ImportError:
    logger.exception("Unable to load landing sites router.")
    raise


# ============================================================
# 7. ROOT HEALTH CHECK
# ============================================================

@app.get("/", tags=["System"])
def read_root():
    return {
        "status": "ONLINE",
        "system": "JARSIG Mission Control Backend",
        "version": "2.0.0",
    }


@app.get("/health", tags=["System"])
def health_check():
    """
    Check whether the API and PostgreSQL database are available.
    """
    conn = get_db_connection()

    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT 1 AS database_status;")
            result = cursor.fetchone()

        return {
            "api": "ONLINE",
            "database": "CONNECTED",
            "database_status": result["database_status"],
        }

    except psycopg2.Error:
        logger.exception("Database health check failed.")

        raise HTTPException(
            status_code=503,
            detail="Database health check failed."
        )

    finally:
        conn.close()


# ============================================================
# 8. GET CURATED LANDING SITES
# ============================================================

@app.get("/api/sites", tags=["Landing Sites"])
def get_landing_sites(conn=Depends(get_db)):
    """
    Retrieve curated lunar landing sites.
    Preserves the original /api/sites frontend endpoint.
    """
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT *
                FROM landing_sites
                ORDER BY site_id ASC;
            """)

            sites = cursor.fetchall()

        return {
            "count": len(sites),
            "sites": sites,
        }

    except psycopg2.Error:
        logger.exception("Failed to retrieve landing sites.")

        raise HTTPException(
            status_code=500,
            detail="Unable to retrieve landing sites."
        )


# ============================================================
# 9. SAVE USER FLIGHT TELEMETRY
# ============================================================

@app.post("/api/telemetry", tags=["Flight Telemetry"])
def create_telemetry_run(
    run: TelemetryRunCreate,
    conn=Depends(get_db)
):
    """
    Save a completed lunar landing simulation run.
    """
    try:
        with conn.cursor() as cursor:

            # Verify that the target landing site exists.
            cursor.execute(
                """
                SELECT site_id
                FROM landing_sites
                WHERE site_id = %s;
                """,
                (run.target_site_id,)
            )

            site = cursor.fetchone()

            if not site:
                raise HTTPException(
                    status_code=404,
                    detail="Target landing site was not found."
                )

            query = """
                INSERT INTO flight_telemetry_runs (
                    operator_id,
                    target_site_id,
                    success,
                    final_fuel_pct,
                    touchdown_descent_rate,
                    touchdown_drift_rate,
                    flight_duration_sec,
                    trajectory_payload
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING run_id, created_at;
            """

            cursor.execute(
                query,
                (
                    run.operator_id,
                    run.target_site_id,
                    run.success,
                    run.final_fuel_pct,
                    run.touchdown_descent_rate,
                    run.touchdown_drift_rate,
                    run.flight_duration_sec,
                    json.dumps(run.trajectory_payload),
                )
            )

            new_run = cursor.fetchone()

        conn.commit()

        return {
            "message": "Telemetry run successfully recorded.",
            "run_id": new_run["run_id"],
            "created_at": new_run["created_at"],
        }

    except HTTPException:
        conn.rollback()
        raise

    except psycopg2.Error:
        conn.rollback()

        logger.exception("Failed to save telemetry run.")

        raise HTTPException(
            status_code=500,
            detail="Unable to save flight telemetry."
        )


# ============================================================
# 10. RETRIEVE TELEMETRY RUNS
# ============================================================

@app.get("/api/telemetry", tags=["Flight Telemetry"])
def get_telemetry_runs(
    limit: int = 50,
    conn=Depends(get_db)
):
    """
    Retrieve recent flight telemetry runs.
    """
    if limit < 1 or limit > 200:
        raise HTTPException(
            status_code=400,
            detail="Limit must be between 1 and 200."
        )

    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT *
                FROM flight_telemetry_runs
                ORDER BY created_at DESC
                LIMIT %s;
                """,
                (limit,)
            )

            runs = cursor.fetchall()

        return {
            "count": len(runs),
            "runs": runs,
        }

    except psycopg2.Error:
        logger.exception("Failed to retrieve telemetry runs.")

        raise HTTPException(
            status_code=500,
            detail="Unable to retrieve telemetry records."
        )


# ============================================================
# 11. APPLICATION STARTUP
# ============================================================

@app.on_event("startup")
def startup_event():
    logger.info("JARSIG Mission Control API starting...")
    logger.info("API documentation: /docs")


@app.on_event("shutdown")
def shutdown_event():
    logger.info("JARSIG Mission Control API shutting down.")
