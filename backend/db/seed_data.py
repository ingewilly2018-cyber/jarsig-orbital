import os
import json
import psycopg2
from dotenv import load_dotenv

# Explicitly load and override environment variables from the project root (2 levels up)
dotenv_path = os.path.join(os.path.dirname(__file__), '../../.env')
load_dotenv(dotenv_path=dotenv_path, override=True)

def seed_database():
    db_url = os.getenv("DATABASE_URL")
    print(f"Loaded DATABASE_URL: {db_url}")  # Debug print to verify
    
    if not db_url:
        raise ValueError("DATABASE_URL is not set or .env file could not be read.")
        
    print("Connecting to database to load NASA lunar South Pole data...")
    
    # Load data from external JSON file
    json_path = os.path.join(os.path.dirname(__file__), "landing_sites.json")
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    conn = psycopg2.connect(db_url)
    cursor = conn.cursor()
    
    try:
        for site in data["landing_sites"]:
            cursor.execute("""
                INSERT INTO landing_sites 
                (name, region, latitude, longitude, elevation_m, slope_deg, horizon_obstruction_deg, water_ice_probability_pct, description)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (name) DO UPDATE SET
                    elevation_m = EXCLUDED.elevation_m,
                    slope_deg = EXCLUDED.slope_deg,
                    water_ice_probability_pct = EXCLUDED.water_ice_probability_pct;
            """, (
                site["name"],
                site["region"],
                site["latitude"],
                site["longitude"],
                site["elevation_m"],
                site["slope_deg"],
                site["horizon_obstruction_deg"],
                site["water_ice_probability_pct"],
                site["description"]
            ))
            
        conn.commit()
        print("Successfully loaded and seeded NASA landing sites from JSON into PostgreSQL!")
        
    except Exception as e:
        conn.rollback()
        print(f"Error seeding database: {e}")
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    seed_database()