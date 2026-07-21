"""
ZKTeco Attendance Monitor — Desktop Tray Application
-----------------------------------------------------
Double-click app.py (or ZKAttendance.exe after building) to start.

- Starts the Flask ADMS server in a background thread
- Shows a system tray icon (right-click for menu)
- Auto-opens the dashboard in your browser
- Supports "Start with Windows" toggle

Build .exe:  run build.bat
"""
import sys
import os
import threading
import time
import webbrowser
import socket

from PIL import Image, ImageDraw
import pystray

from config_util import load as load_cfg, save as save_cfg

cfg  = load_cfg()
PORT = cfg.get("port", 80)


# ── Flask server ───────────────────────────────────────────────────────────────

_server_ready = threading.Event()

def _run_server():
    import server as srv
    srv.RAILWAY_URL = cfg.get("railway_url", "https://cssgrouprms.com")
    _server_ready.set()
    try:
        srv.socketio.run(
            srv.app,
            host="0.0.0.0",
            port=PORT,
            debug=False,
            allow_unsafe_werkzeug=True,
            use_reloader=False,
        )
    except OSError as e:
        if "address already in use" in str(e).lower() or e.errno in (98, 10048):
            print(f"[ERROR] Port {PORT} already in use. Change it in Settings.")
        else:
            raise


# ── System tray icon ───────────────────────────────────────────────────────────

def _make_icon(online=True):
    """Draw a 64×64 green circle with a fingerprint motif."""
    size = 64
    img  = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d    = ImageDraw.Draw(img)
    bg   = "#1a7a3e" if online else "#444444"
    d.ellipse([2, 2, 62, 62], fill=bg)
    cx, cy = 32, 32
    for r in [9, 14, 19, 23]:
        d.arc([cx - r, cy - r, cx + r, cy + r], start=210, end=330, fill="white", width=2)
    d.ellipse([cx - 4, cy - 4, cx + 4, cy + 4], fill="white")
    return img


# ── Startup (registry) ────────────────────────────────────────────────────────

def _is_startup_enabled():
    try:
        import winreg
        k = winreg.OpenKey(winreg.HKEY_CURRENT_USER,
                           r"Software\Microsoft\Windows\CurrentVersion\Run")
        winreg.QueryValueEx(k, "ZKTecoAttendance")
        winreg.CloseKey(k)
        return True
    except Exception:
        return False

def _toggle_startup(icon, item):
    try:
        import winreg
        key = r"Software\Microsoft\Windows\CurrentVersion\Run"
        k   = winreg.OpenKey(winreg.HKEY_CURRENT_USER, key, 0, winreg.KEY_ALL_ACCESS)
        exe = sys.executable if not getattr(sys, "frozen", False) else os.path.abspath(sys.argv[0])
        if _is_startup_enabled():
            winreg.DeleteValue(k, "ZKTecoAttendance")
        else:
            winreg.SetValueEx(k, "ZKTecoAttendance", 0, winreg.REG_SZ, f'"{exe}"')
        winreg.CloseKey(k)
    except Exception as e:
        print(f"[startup toggle] {e}")


# ── Settings dialog (tkinter — runs in its own thread) ────────────────────────

def _open_settings(icon=None, item=None):
    def _dialog():
        import tkinter as tk
        from tkinter import simpledialog, messagebox

        root = tk.Tk()
        root.withdraw()
        root.attributes("-topmost", True)

        cur_cfg = load_cfg()

        new_url = simpledialog.askstring(
            "Railway Cloud URL",
            "Enter your Railway domain (e.g. https://cssgrouprms.com):",
            initialvalue=cur_cfg.get("railway_url", ""),
            parent=root,
        )
        if new_url is not None:
            cur_cfg["railway_url"] = new_url.strip()

        new_port = simpledialog.askstring(
            "Server Port",
            "Local server port (default 80 — needs restart to change):",
            initialvalue=str(cur_cfg.get("port", 80)),
            parent=root,
        )
        if new_port is not None and new_port.isdigit():
            cur_cfg["port"] = int(new_port)

        save_cfg(cur_cfg)
        messagebox.showinfo(
            "Settings Saved",
            "Settings saved.\nRestart the app for port changes to take effect.",
            parent=root,
        )
        root.destroy()

    t = threading.Thread(target=_dialog, daemon=True)
    t.start()


# ── Menu actions ──────────────────────────────────────────────────────────────

def _open_dashboard(icon=None, item=None):
    webbrowser.open(f"http://localhost:{PORT}")

def _open_diagnostics(icon=None, item=None):
    webbrowser.open(f"http://localhost:{PORT}/?tab=diag")

def _quit(icon, item):
    icon.stop()
    os._exit(0)


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    # Start Flask in background
    t = threading.Thread(target=_run_server, daemon=True)
    t.start()

    # Give server 2 s to bind
    _server_ready.wait(timeout=5)
    time.sleep(1.5)

    # Auto-open dashboard
    if cfg.get("auto_open", True):
        _open_dashboard()

    # Get LAN IP for title
    try:
        lan_ip = socket.gethostbyname(socket.gethostname())
    except Exception:
        lan_ip = "localhost"

    menu = pystray.Menu(
        pystray.MenuItem("ZKTeco Attendance Monitor", None, enabled=False),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem("Open Dashboard",   _open_dashboard,   default=True),
        pystray.MenuItem("Run Diagnostics",  _open_diagnostics),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem(f"Server: {lan_ip}:{PORT}", None, enabled=False),
        pystray.MenuItem(f"Cloud:  {cfg.get('railway_url','').replace('https://','')}", None, enabled=False),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem("⚙  Settings",       _open_settings),
        pystray.MenuItem("Start with Windows", _toggle_startup,
                         checked=lambda item: _is_startup_enabled()),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem("Quit", _quit),
    )

    icon = pystray.Icon(
        name="ZKTecoAttendance",
        icon=_make_icon(online=True),
        title=f"ZKTeco Attendance  ·  Port {PORT}",
        menu=menu,
    )
    icon.run()


if __name__ == "__main__":
    main()
