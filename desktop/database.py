from sqlalchemy import create_engine, MetaData, Table, Column, text
from sqlalchemy import Integer, String, DateTime
from config_util import DATA_DIR

engine = create_engine(f"sqlite:///{DATA_DIR / 'attendance.db'}", echo=False)
metadata = MetaData()

employees = Table(
    "employees",
    metadata,
    Column("staff_id",   String,  primary_key=True),
    Column("name",       String),
    Column("department", String),
    Column("position",   String),
)

attendance = Table(
    "attendance",
    metadata,
    Column("id",       Integer, primary_key=True),
    Column("staff_id", String),
    Column("name",     String),
    Column("time",     DateTime),
    Column("status",   String),
    Column("synced",   Integer, default=0),  # 0 = local only, 1 = uploaded to Railway
)

metadata.create_all(engine)

# Migrate existing DBs that predate the synced column
with engine.connect() as _c:
    try:
        _c.execute(text("ALTER TABLE attendance ADD COLUMN synced INTEGER DEFAULT 0"))
        _c.commit()
    except Exception:
        pass
