from fastapi import APIRouter, HTTPException
import requests
from typing import Optional

router = APIRouter(prefix="/api/nasa", tags=["NASA Resources"])

# Official NASA JPL Horizons public API base URL
HORIZONS_API_URL = "https://ssd.jpl.nasa.gov/api/horizons.api"

@router.get("/ephemeris/moon")
def get_moon_ephemeris(
    start_time: str = "2026-11-15", 
    stop_time: str = "2026-11-16", 
    step: str = "1h",
    command: str = "301"  # Default to Moon (ID: 301) as per JPL Horizons spec
):
    """
    Fetch high-precision lunar ephemeris or state vectors from the NASA JPL Horizons system API.
    """
    params = {
        "format": "json",
        "COMMAND": f"'{command}'",
        "OBJ_DATA": "'YES'",
        "MAKE_EPHEM": "'YES'",
        "EPHEM_TYPE": "'VECTOR'",
        "CENTER": "'@0'",    # Solar System Barycenter
        "START_TIME": f"'{start_time}'",
        "STOP_TIME": f"'{stop_time}'",
        "STEP_SIZE": f"'{step}'",
    }
    
    try:
        response = requests.get(HORIZONS_API_URL, params=params, timeout=15)
        if response.status_code != 200:
            raise HTTPException(
                status_code=response.status_code, 
                detail=f"Horizons API returned status code {response.status_code}"
            )
        
        data = response.json()
        return {
            "status": "success",
            "source": "NASA JPL Horizons On-line Solar System Data Service",
            "target_id": command,
            "data": data
        }
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"NASA Horizons connection error: {str(e)}")

@router.get("/lighting/south-pole")
def get_south_pole_illumination(site_name: str = "Shackleton Ridge"):
    """
    Returns illumination constraints, sun angles, and operational safety metrics 
    for Artemis Lunar South Pole landing sites.
    """
    lighting_profiles = {
        "Shackleton Ridge": {"sun_elevation_deg": 1.5, "illumination_pct": 88.5, "status": "Favorable Continuous Light"},
        "Nobile Rim 1": {"sun_elevation_deg": 2.2, "illumination_pct": 75.0, "status": "Intermittent Light / Access to Ice"},
        "de Gerlache Rim 2": {"sun_elevation_deg": 0.8, "illumination_pct": 60.2, "status": "Shadowed Margin / High Ice Potential"},
        "Leibnitz Beta Plateau": {"sun_elevation_deg": 3.1, "illumination_pct": 82.0, "status": "Stable Solar Geometry"},
        "Malapert Massif": {"sun_elevation_deg": 4.5, "illumination_pct": 92.1, "status": "Direct Earth Line-of-Sight"}
    }
    
    if site_name not in lighting_profiles:
        raise HTTPException(status_code=404, detail=f"Site '{site_name}' lighting profile not found.")
        
    return {
        "site": site_name,
        "region": "Lunar South Pole",
        "illumination_metrics": lighting_profiles[site_name]
    }