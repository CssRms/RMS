"""
Shared path and settings utility.
When running as a PyInstaller .exe, data lives in %APPDATA%\ZKTecoAttendance.
When running as a plain Python script, data lives alongside the scripts.
"""
import os
import sys
import json
from pathlib import Path

# ── Data directory ─────────────────────────────────────────────────────────────
if getattr(sys, 'frozen', False):
    # Packaged .exe — write to APPDATA so the app doesn't need admin rights on its folder
    DATA_DIR = Path(os.environ.get('APPDATA', Path.home())) / 'ZKTecoAttendance'
else:
    # Dev / script mode — use the folder that contains this file
    DATA_DIR = Path(__file__).resolve().parent

DATA_DIR.mkdir(parents=True, exist_ok=True)

# ── Settings ───────────────────────────────────────────────────────────────────
SETTINGS_FILE = DATA_DIR / 'settings.json'

DEFAULTS = {
    'port':        80,
    'railway_url': 'https://cssgrouprms.com',
    'auto_open':   True,
}

def load() -> dict:
    if SETTINGS_FILE.exists():
        try:
            return {**DEFAULTS, **json.loads(SETTINGS_FILE.read_text(encoding='utf-8'))}
        except Exception:
            pass
    return dict(DEFAULTS)

def save(cfg: dict):
    SETTINGS_FILE.write_text(json.dumps(cfg, indent=2), encoding='utf-8')
