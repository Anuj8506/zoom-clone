"""Run explicitly with: python seed.py. Startup also seeds when enabled."""

from sqlalchemy.orm import Session

from app.config import Settings
from app.database import Base, build_engine
from app.seed_data import seed_database


def main():
    settings = Settings()
    engine = build_engine(settings)
    try:
        Base.metadata.create_all(engine)
        with Session(engine) as db:
            seed_database(db, settings)
        print("Seed complete. Existing records were preserved.")
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
