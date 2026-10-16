import calendar
import functools
import json
import os
import re
import secrets
import smtplib
import socket
import sqlite3
import urllib.error
import urllib.request
from datetime import date, datetime, timedelta
from email.message import EmailMessage
from email.utils import formatdate
from pathlib import Path
from zoneinfo import ZoneInfo

from apscheduler.schedulers.background import BackgroundScheduler
from dotenv import load_dotenv
from flask import Flask, abort, jsonify, redirect, request, send_file, session
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "data" / "appointments.db"
load_dotenv(BASE_DIR / ".env")


def sanitize_env_value(key, default=""):
    value = os.getenv(key, default)
    if value is None:
        return default
    value = str(value).strip().strip('"').strip("'")
    if key == "SMTP_APP_PASSWORD":
        value = value.replace(" ", "")
    return value


SALON_NAME = sanitize_env_value("SALON_NAME", "Sri Devi One Saloon")
SALON_EMAIL = sanitize_env_value("SALON_EMAIL", "chakravarthy.atipamula@gmail.com")
SALON_PHONE = sanitize_env_value("SALON_PHONE", "+91 73961 44248")
SALON_MAPS_URL = sanitize_env_value("SALON_MAPS_URL", "https://maps.app.goo.gl/suHNM6yaQBY29TX8A")
SALON_TIMEZONE = sanitize_env_value("SALON_TIMEZONE", "Asia/Kolkata")
SALON_ADDRESS = sanitize_env_value(
    "SALON_ADDRESS",
    "Bommuru Centre, Near NTR Statue, Rajuvolu Road, Kotta Bommuru, AP 533124, India",
)
APP_URL = sanitize_env_value("APP_URL", "https://sridevionesaloon.onrender.com").rstrip("/")
CRON_SECRET = sanitize_env_value("CRON_SECRET", "")

# SMTP Configuration
SMTP_HOST = sanitize_env_value("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(sanitize_env_value("SMTP_PORT", "587"))
SMTP_EMAIL = sanitize_env_value("SMTP_EMAIL", "pavankoneti85@gmail.com")
SMTP_APP_PASSWORD = sanitize_env_value("SMTP_APP_PASSWORD", "")

# HTTP Email API configuration (Works on Render Free Tier via Port 443)
RESEND_API_KEY = sanitize_env_value("RESEND_API_KEY", "")
BREVO_API_KEY = sanitize_env_value("BREVO_API_KEY", "")
EMAIL_SENDER = sanitize_env_value("EMAIL_SENDER", "Sri Devi One Saloon <onboarding@resend.dev>")

SERVICE_DURATION_MINUTES = int(sanitize_env_value("SERVICE_DURATION_MINUTES", "60"))
FOLLOWUP_INTERVAL_MONTHS = int(sanitize_env_value("FOLLOWUP_INTERVAL_MONTHS", "1"))
ENABLE_MONTHLY_FOLLOWUPS = sanitize_env_value("ENABLE_MONTHLY_FOLLOWUPS", "true").lower() in {"1", "true", "yes", "on"}
MAX_EMAIL_RETRIES = int(sanitize_env_value("MAX_EMAIL_RETRIES", "3"))
SMTP_CHECK_ON_STARTUP = sanitize_env_value("SMTP_CHECK_ON_STARTUP", "false").lower() in {"1", "true", "yes", "on"}

# Admin & Upload Configuration
ADMIN_USERNAME = sanitize_env_value("ADMIN_USERNAME", "admin")
ADMIN_EMAIL = sanitize_env_value("ADMIN_EMAIL", SALON_EMAIL)
ADMIN_PASSWORD = sanitize_env_value("ADMIN_PASSWORD", "SriDevi@Admin2026")
FLASK_SECRET_KEY = sanitize_env_value("FLASK_SECRET_KEY", "sridevi-one-saloon-session-secret-key-2026")

UPLOAD_DIR = BASE_DIR / "assets" / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_IMAGE_EXTENSIONS = {"png", "jpg", "jpeg", "webp", "gif"}

# =============================================================================
# AUTHORITATIVE SERVICES CATALOG & PRICES (Backend is Single Source of Truth)
# =============================================================================
AUTHORITATIVE_SERVICES = {
    "cutting": {
        "id": "cutting",
        "name": "Cutting",
        "price": 120,
        "duration": 30,
        "description": "Precision haircut and styling tailored for your face profile",
        "aliases": ["cutting", "haircut", "hair cut", "hair cutting"],
    },
    "shaving": {
        "id": "shaving",
        "name": "Shaving",
        "price": 70,
        "duration": 20,
        "description": "Clean, smooth razor shave and beard grooming",
        "aliases": ["shaving", "shave", "beard trim", "clean shave"],
    },
    "combo": {
        "id": "combo",
        "name": "Cutting + Shaving Combo",
        "price": 170,
        "duration": 45,
        "description": "Signature haircut paired with a fresh shave at best value",
        "aliases": [
            "cutting + shaving combo",
            "haircut + shaving combo",
            "combo",
            "cutting & shaving",
            "haircut & shaving",
        ],
    },
    "scrub": {
        "id": "scrub",
        "name": "Scrub",
        "price": 100,
        "duration": 20,
        "description": "Exfoliating facial scrub to unclog pores and remove dead skin",
        "aliases": ["scrub", "face scrub"],
    },
    "tan_pack": {
        "id": "tan_pack",
        "name": "Tan Pack",
        "price": 150,
        "duration": 30,
        "description": "Herbal de-tan pack for instant sun damage recovery",
        "aliases": ["tan pack", "tan removal pack", "de-tan", "detan", "tan"],
    },
    "lite_facial": {
        "id": "lite_facial",
        "name": "Lite Facial",
        "price": 250,
        "duration": 45,
        "description": "Refreshing cleansing and hydrating facial therapy",
        "aliases": ["lite facial", "light facial"],
    },
    "full_facial": {
        "id": "full_facial",
        "name": "Full Facial",
        "price": 600,
        "duration": 60,
        "description": "Complete deep-cleansing facial ritual for ultimate skin renewal",
        "aliases": [
            "full facial",
            "facial",
            "full facial (₹600–₹800)",
            "full facial (600-800)",
            "full facial (?600-?800)",
        ],
    },
}

app = Flask(__name__, static_folder=".", static_url_path="")
app.secret_key = FLASK_SECRET_KEY
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(days=7)


# =============================================================================
# TIMEZONE & DATE UTILITIES (Asia/Kolkata)
# =============================================================================
def now_local_dt() -> datetime:
    return datetime.now(ZoneInfo(SALON_TIMEZONE))


def now_local_iso() -> str:
    return now_local_dt().isoformat()


# =============================================================================
# DATABASE INITIALISATION, SEEDERS & MIGRATION
# =============================================================================
def seed_default_admin(conn):
    cursor = conn.execute("SELECT count(*) FROM admin_users")
    if cursor.fetchone()[0] == 0:
        now_iso = now_local_iso()
        pwd_hash = generate_password_hash(ADMIN_PASSWORD)
        conn.execute(
            """
            INSERT INTO admin_users (username, email, password_hash, must_change_password, created_at, updated_at)
            VALUES (?, ?, ?, 1, ?, ?)
            """,
            (ADMIN_USERNAME, ADMIN_EMAIL, pwd_hash, now_iso, now_iso),
        )


def seed_default_services(conn):
    cursor = conn.execute("SELECT count(*) FROM services")
    if cursor.fetchone()[0] == 0:
        now_iso = now_local_iso()
        defaults = [
            ("cutting", "Cutting", 120, None, 30, "Hair & Grooming", "Precision haircut styled to suit your face shape and personal preference.", "https://www.twentytwocut.com/lifestyle/images/the-rise-of-a-new-grooming-icon-in-bangkoks-barbershop-scene.jpg", 1, 1),
            ("shaving", "Shaving", 70, None, 20, "Hair & Grooming", "Clean, smooth razor shave and beard grooming with soothing balm.", "https://images.unsplash.com/photo-1675746435874-e72d846bdca5?fm=jpg&q=60&w=3000&auto=format&fit=crop", 1, 2),
            ("combo", "Cutting + Shaving Combo", 170, 190, 45, "Combos", "Signature haircut paired with a fresh shave at our best value package.", "assets/combo.jpeg", 1, 3),
            ("scrub", "Scrub", 100, None, 20, "Skin Care", "Exfoliating facial scrub to unclog pores and remove dead skin cells.", "https://images.squarespace-cdn.com/content/v1/5f8ef7a13d707c2132d75a89/1628172900778-F02E5C9LHQ2B4G23L3Q7/Beard+Trim", 1, 4),
            ("tan_pack", "Tan Pack", 150, None, 30, "Skin Care", "Herbal de-tan pack for instant sun damage recovery and brightening.", "https://d2zdprotbvdm7r.cloudfront.net/fit-in/2048xorig/filters:format(webp)/article/shutterstock_1684347718.jpg", 1, 5),
            ("lite_facial", "Lite Facial", 250, None, 45, "Skin Care", "Refreshing cleansing and hydrating facial therapy for daily vitality.", "assets/lite_facial.jpeg", 1, 6),
            ("full_facial", "Full Facial", 600, 800, 60, "Skin Care", "Complete deep-cleansing facial ritual for ultimate skin renewal and relaxation.", "https://www.urbancompany.com/blog/wp-content/uploads/2019/07/Mens-Facials.jpg", 1, 7),
        ]
        for item in defaults:
            conn.execute(
                """
                INSERT OR IGNORE INTO services
                (id, name, price, discount_price, duration_minutes, category, description, image_url, is_active, display_order, is_archived, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
                """,
                (*item, now_iso, now_iso),
            )


def seed_default_content(conn):
    cursor = conn.execute("SELECT count(*) FROM site_content")
    if cursor.fetchone()[0] == 0:
        now_iso = now_local_iso()
        defaults = {
            "salon_name": SALON_NAME,
            "tagline": "Luxury Barbershop & Styling",
            "phone": SALON_PHONE,
            "email": SALON_EMAIL,
            "address": SALON_ADDRESS,
            "maps_url": SALON_MAPS_URL,
            "opening_hours": "Mon – Sun: 7:00 AM – 9:30 PM",
            "welcome_heading": SALON_NAME,
            "welcome_quote": "Look sharp. Feel confident. Master craftsmanship & precision grooming in Bommuru.",
            "about_text": "Welcome to Sri Devi One Saloon, Bommuru's trusted grooming destination. We blend traditional barbering excellence with contemporary styling techniques to deliver precision haircuts, clean shaves, rejuvenating facials, and relaxing grooming packages.",
            "logo_url": "assets/logo.png",
            "owner_photo_url": "assets/pavan_dad.png",
        }
        for k, v in defaults.items():
            conn.execute("INSERT OR REPLACE INTO site_content (key, value, updated_at) VALUES (?, ?, ?)", (k, v, now_iso))


def seed_default_templates(conn):
    cursor = conn.execute("SELECT count(*) FROM email_templates")
    if cursor.fetchone()[0] == 0:
        now_iso = now_local_iso()
        templates = [
            (
                "confirmation",
                "Appointment Confirmation",
                f"Your Appointment Is Confirmed — {{{{salon_name}}}}",
                "Hello {{customer_name}},\n\nThank you for booking your appointment with {{salon_name}}!\n\nYour appointment is scheduled for {{appointment_date}} at {{appointment_time}}.\n\nSelected Services:\n{{services_list}}\n\nTotal Confirmed Price: {{total_price}}\n\nSalon Location: {{salon_address}}\nGoogle Maps: {{maps_url}}\nPhone: {{phone}}\n\nWe look forward to welcoming you.\n\nBest regards,\n{{salon_name}}",
                "{{customer_name}}, {{salon_name}}, {{appointment_date}}, {{appointment_time}}, {{services_list}}, {{total_price}}, {{salon_address}}, {{maps_url}}, {{phone}}",
            ),
            (
                "followup_3hr",
                "3-Hour Thank-You Follow-Up",
                f"Thank You for Visiting {{{{salon_name}}}}!",
                "Hello {{customer_name}},\n\nThank you for visiting {{salon_name}}! We hope you enjoyed your grooming experience today.\n\nYour satisfaction means everything to us. We look forward to seeing you again.\n\nThank you for choosing {{salon_name}}!\n\nBest regards,\n{{salon_name}}\n{{phone}}",
                "{{customer_name}}, {{salon_name}}, {{appointment_date}}, {{services_list}}, {{phone}}, {{unsubscribe_url}}",
            ),
            (
                "monthly_reminder",
                "Monthly Grooming Reminder",
                f"Time for Your Next Fresh Look at {{{{salon_name}}}}",
                "Hello {{customer_name}},\n\nIt has been about a month since your last visit to {{salon_name}}.\n\nKeep your look sharp and fresh. We invite you to book your next appointment at your convenience.\n\nLocation: {{salon_address}}\nPhone: {{phone}}\n\nBest regards,\n{{salon_name}}",
                "{{customer_name}}, {{salon_name}}, {{phone}}, {{maps_url}}, {{unsubscribe_url}}",
            ),
            (
                "cancellation",
                "Appointment Cancellation",
                f"Your Appointment Has Been Cancelled — {{{{salon_name}}}}",
                "Hello {{customer_name}},\n\nYour appointment scheduled for {{appointment_date}} at {{appointment_time}} has been cancelled.\n\nIf you would like to book a new appointment, please visit our website or contact us at {{phone}}.\n\nBest regards,\n{{salon_name}}",
                "{{customer_name}}, {{salon_name}}, {{appointment_date}}, {{appointment_time}}, {{phone}}",
            ),
            (
                "password_reset",
                "Admin Password Reset",
                f"Reset Your Administrator Password — {{{{salon_name}}}}",
                "Hello {{admin_username}},\n\nWe received a request to reset your administrator password for {{salon_name}}.\n\nPlease click the link below to set a new password:\n{{reset_url}}\n\nThis single-use link is valid for 1 hour. If you did not request this, you can safely ignore this email.\n\nBest regards,\n{{salon_name}} Security",
                "{{admin_username}}, {{salon_name}}, {{reset_url}}",
            ),
        ]
        for t in templates:
            conn.execute(
                """
                INSERT OR IGNORE INTO email_templates (id, name, subject, body_html, available_placeholders, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (*t, now_iso),
            )


def init_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS appointments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL,
                phone TEXT,
                service TEXT NOT NULL,
                appointment_date TEXT NOT NULL,
                appointment_time TEXT NOT NULL,
                notes TEXT,
                status TEXT NOT NULL DEFAULT 'booked',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )

        # Ensure all modern columns exist for existing database instances
        cursor = conn.execute("PRAGMA table_info(appointments);")
        columns = {col[1] for col in cursor.fetchall()}

        column_defs = {
            "phone": "TEXT",
            "services_json": "TEXT",
            "total_price": "INTEGER NOT NULL DEFAULT 0",
            "duration_minutes": "INTEGER NOT NULL DEFAULT 60",
            "appointment_end_time": "TEXT",
            "followup_due_at": "TEXT",
            "followup_status": "TEXT NOT NULL DEFAULT 'scheduled'",
            "next_reminder_date": "TEXT",
            "reminder_status": "TEXT NOT NULL DEFAULT 'active'",
            "unsubscribe_token": "TEXT",
        }
        for col_name, col_type in column_defs.items():
            if col_name not in columns:
                conn.execute(f"ALTER TABLE appointments ADD COLUMN {col_name} {col_type};")

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS notification_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                appointment_id INTEGER NOT NULL,
                notification_type TEXT NOT NULL,
                scheduled_for TEXT NOT NULL,
                sent_at TEXT,
                status TEXT NOT NULL DEFAULT 'scheduled',
                attempts INTEGER NOT NULL DEFAULT 0,
                last_error TEXT,
                UNIQUE(appointment_id, notification_type)
            )
            """
        )

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS customer_reminders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                customer_email TEXT UNIQUE NOT NULL,
                customer_name TEXT NOT NULL,
                last_appointment_id INTEGER NOT NULL,
                last_appointment_date TEXT NOT NULL,
                next_reminder_date TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'active',
                unsubscribe_token TEXT NOT NULL UNIQUE,
                reminders_sent_count INTEGER NOT NULL DEFAULT 0,
                last_sent_at TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS admin_users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                must_change_password INTEGER NOT NULL DEFAULT 1,
                reset_token TEXT,
                reset_token_expires_at TEXT,
                last_login_at TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS services (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                price INTEGER NOT NULL,
                discount_price INTEGER,
                duration_minutes INTEGER NOT NULL DEFAULT 30,
                category TEXT NOT NULL DEFAULT 'Hair & Grooming',
                description TEXT,
                image_url TEXT,
                is_active INTEGER NOT NULL DEFAULT 1,
                display_order INTEGER NOT NULL DEFAULT 0,
                is_archived INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS site_content (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS gallery_images (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                image_url TEXT NOT NULL,
                caption TEXT,
                display_order INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            )
            """
        )

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS email_templates (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                subject TEXT NOT NULL,
                body_html TEXT NOT NULL,
                available_placeholders TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS activity_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                admin_user TEXT,
                action TEXT NOT NULL,
                details TEXT,
                ip_address TEXT,
                created_at TEXT NOT NULL
            )
            """
        )

        conn.execute("CREATE INDEX IF NOT EXISTS idx_notifications_appointment ON notification_logs(appointment_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_notifications_scheduled ON notification_logs(status, scheduled_for)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_customer_reminders_email ON customer_reminders(customer_email)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_customer_reminders_due ON customer_reminders(status, next_reminder_date)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_services_active ON services(is_active, is_archived, display_order)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at DESC)")

        seed_default_admin(conn)
        seed_default_services(conn)
        seed_default_content(conn)
        seed_default_templates(conn)

        conn.commit()


def parse_local_datetime(date_text: str, time_text: str) -> datetime:
    tz = ZoneInfo(SALON_TIMEZONE)
    cleaned_time = time_text.strip()
    # Handle both HH:MM and HH:MM:SS
    if len(cleaned_time.split(":")) == 3:
        fmt = "%Y-%m-%d %H:%M:%S"
    else:
        fmt = "%Y-%m-%d %H:%M"
    return datetime.strptime(f"{date_text.strip()} {cleaned_time}", fmt).replace(tzinfo=tz)


def add_months_safe(base, months: int = 1):
    """
    Safely adds calendar months to a date or datetime object, clamping to the
    last day of the target month for shorter months (e.g. Jan 31 -> Feb 28 or Feb 29).
    """
    m = base.month - 1 + months
    y = base.year + m // 12
    m = m % 12 + 1
    max_day = calendar.monthrange(y, m)[1]
    target_day = min(base.day, max_day)

    if isinstance(base, datetime):
        return base.replace(year=y, month=m, day=target_day)
    return date(y, m, target_day)


def format_display_time(time_str: str) -> str:
    if not time_str:
        return ""
    try:
        t = datetime.strptime(time_str.strip()[:5], "%H:%M")
        return t.strftime("%I:%M %p").lstrip("0")
    except Exception:
        return time_str


def format_display_date(date_str: str) -> str:
    if not date_str:
        return ""
    try:
        d = datetime.strptime(date_str.strip()[:10], "%Y-%m-%d")
        return f"{d.strftime('%B')} {d.day}, {d.year}"
    except Exception:
        return date_str


# =============================================================================
# SERVICE VALIDATION & TOTAL CALCULATION (Never trust browser-provided totals)
# =============================================================================
def get_authoritative_services_catalog():
    """
    Retrieves services from the database `services` table.
    Falls back to AUTHORITATIVE_SERVICES if DB is unseeded or error occurs.
    """
    try:
        with sqlite3.connect(DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute(
                "SELECT * FROM services WHERE is_archived = 0 ORDER BY display_order ASC, name ASC"
            ).fetchall()
        if rows:
            catalog = {}
            for r in rows:
                item = dict(r)
                item["aliases"] = [item["id"], item["name"].lower()]
                item["duration"] = item.get("duration_minutes", 30)
                if item["id"] in AUTHORITATIVE_SERVICES:
                    for a in AUTHORITATIVE_SERVICES[item["id"]].get("aliases", []):
                        if a not in item["aliases"]:
                            item["aliases"].append(a)
                catalog[item["id"]] = item
            return catalog
    except Exception:
        pass
    return AUTHORITATIVE_SERVICES


def resolve_and_validate_services(service_input):
    """
    Accepts list of service keys/names or a comma-separated string.
    Matches against authoritative database catalog (with fallback).
    Returns:
        (validated_services_list, total_price, total_duration, display_string)
    Raises:
        ValueError if no valid services could be resolved.
    """
    catalog = get_authoritative_services_catalog()
    items = []
    if isinstance(service_input, list):
        items = [str(s).strip() for s in service_input if str(s).strip()]
    elif isinstance(service_input, str):
        # Split on comma or plus if multi-service string
        # Clean price annotations e.g. "Haircut (₹120)" -> "haircut"
        raw_items = [p.strip() for p in re.split(r"[,+]", service_input) if p.strip()]
        items = raw_items

    resolved_map = {}

    for item in items:
        # Strip currency symbols and price brackets: "Haircut (₹120)" -> "haircut"
        cleaned = re.sub(r"[\(₹\?\d\–\-\)]", "", item).lower().strip()
        matched_svc = None

        # 1. Exact ID match
        if item.lower() in catalog:
            matched_svc = catalog[item.lower()]
        else:
            # 2. Match against aliases
            for svc in catalog.values():
                if cleaned in svc["aliases"] or item.lower() in svc["aliases"]:
                    matched_svc = svc
                    break
                # Partial match check
                for alias in svc["aliases"]:
                    if alias in cleaned or cleaned in alias:
                        matched_svc = svc
                        break
                if matched_svc:
                    break

        if matched_svc:
            resolved_map[matched_svc["id"]] = matched_svc

    if not resolved_map:
        raise ValueError(
            "Please select at least one valid salon service. "
            f"Available services: {', '.join([s['name'] for s in catalog.values()])}."
        )

    validated_list = list(resolved_map.values())
    total_price = sum(s["price"] for s in validated_list)
    total_duration = sum(s["duration"] for s in validated_list)
    # Ensure minimum appointment duration
    if total_duration < SERVICE_DURATION_MINUTES:
        total_duration = SERVICE_DURATION_MINUTES

    display_parts = [f"{s['name']} (₹{s['price']})" for s in validated_list]
    display_string = ", ".join(display_parts)

    return validated_list, total_price, total_duration, display_string


def get_appointment(appointment_id):
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute("SELECT * FROM appointments WHERE id = ?", (appointment_id,)).fetchone()
    return dict(row) if row else None


def upsert_notification(appointment_id, notification_type, scheduled_for_dt, status="scheduled", attempts=0, last_error=None):
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            INSERT INTO notification_logs (appointment_id, notification_type, scheduled_for, status, attempts, last_error)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(appointment_id, notification_type)
            DO UPDATE SET
                scheduled_for = excluded.scheduled_for,
                status = excluded.status,
                attempts = excluded.attempts,
                last_error = excluded.last_error
            """,
            (appointment_id, notification_type, scheduled_for_dt.isoformat(), status, attempts, last_error),
        )
        conn.commit()


def notification_status(appointment_id, notification_type):
    with sqlite3.connect(DB_PATH) as conn:
        row = conn.execute(
            "SELECT status, attempts, scheduled_for FROM notification_logs WHERE appointment_id = ? AND notification_type = ?",
            (appointment_id, notification_type),
        ).fetchone()
    return row


# =============================================================================
# EMAIL DISPATCH TRANSPORT (SMTP with automatic HTTP API Fallback)
# =============================================================================
def build_email_message(to_email, subject, plain_body, html_body=None):
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = f"{SALON_NAME} <{SMTP_EMAIL}>"
    message["To"] = to_email
    message["Reply-To"] = f"{SALON_NAME} <{SALON_EMAIL}>"
    message["Date"] = formatdate(localtime=True)
    message.set_content(plain_body)
    if html_body:
        message.add_alternative(html_body, subtype="html")
    return message


def send_via_resend(destination_email: str, subject: str, plain_body: str, html_body: str = None):
    sender = EMAIL_SENDER or f"{SALON_NAME} <onboarding@resend.dev>"
    payload = {
        "from": sender,
        "to": [destination_email],
        "subject": subject,
        "text": plain_body,
    }
    if html_body:
        payload["html"] = html_body

    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {RESEND_API_KEY}",
            "Content-Type": "application/json",
            "User-Agent": "SriDeviSaloon/1.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=12) as response:
            return response.read()
    except urllib.error.HTTPError as err:
        err_msg = err.read().decode("utf-8", errors="ignore")
        # Handle Resend testing restriction gracefully: forward copy to owner so alerts are not lost
        if "validation_error" in err_msg and "only send testing emails to your own email address" in err_msg:
            fallback_to = SALON_EMAIL or "chakravarthy.atipamula@gmail.com"
            if destination_email.lower() != fallback_to.lower():
                payload["to"] = [fallback_to]
                payload["subject"] = f"[Customer Copy: {destination_email}] {subject}"
                fallback_req = urllib.request.Request(
                    "https://api.resend.com/emails",
                    data=json.dumps(payload).encode("utf-8"),
                    headers={
                        "Authorization": f"Bearer {RESEND_API_KEY}",
                        "Content-Type": "application/json",
                        "User-Agent": "SriDeviSaloon/1.0",
                    },
                    method="POST",
                )
                try:
                    with urllib.request.urlopen(fallback_req, timeout=12) as fb_resp:
                        return fb_resp.read()
                except Exception:
                    pass
        raise RuntimeError(f"Resend API error ({err.code}): {err_msg}") from err


def send_via_brevo(destination_email: str, subject: str, plain_body: str, html_body: str = None):
    sender_email = EMAIL_SENDER or SMTP_EMAIL or SALON_EMAIL
    payload = {
        "sender": {"name": SALON_NAME, "email": sender_email},
        "to": [{"email": destination_email}],
        "subject": subject,
        "textContent": plain_body,
    }
    if html_body:
        payload["htmlContent"] = html_body

    req = urllib.request.Request(
        "https://api.brevo.com/v3/smtp/email",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "api-key": BREVO_API_KEY,
            "Content-Type": "application/json",
            "User-Agent": "SriDeviSaloon/1.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=12) as response:
            return response.read()
    except urllib.error.HTTPError as err:
        err_msg = err.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"Brevo API error ({err.code}): {err_msg}") from err


def send_email(destination_email: str, subject: str, plain_body: str, html_body: str = None):
    """
    Sends email using the salon owner's configured SMTP email account as primary.
    If SMTP fails due to a network connection/port block (e.g. Render Free Tier
    blocking outbound port 587/465), seamlessly falls back to HTTP API (Resend/Brevo)
    to guarantee delivery.
    """
    smtp_configured = bool(SMTP_HOST and SMTP_EMAIL and SMTP_APP_PASSWORD)
    smtp_error = None

    if smtp_configured:
        message = build_email_message(destination_email, subject, plain_body, html_body)
        try:
            if SMTP_PORT == 465:
                with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=12) as server:
                    server.login(SMTP_EMAIL, SMTP_APP_PASSWORD)
                    server.send_message(message)
            else:
                with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=12) as server:
                    server.starttls()
                    server.login(SMTP_EMAIL, SMTP_APP_PASSWORD)
                    server.send_message(message)
            return
        except (socket.timeout, TimeoutError, smtplib.SMTPConnectError, OSError, smtplib.SMTPException) as err:
            smtp_error = err
            app.logger.warning(
                "SMTP dispatch failed (%s). Attempting fallback HTTP API (Resend/Brevo)...",
                err,
            )

    # Fallback to HTTP APIs (Port 443)
    if RESEND_API_KEY:
        try:
            send_via_resend(destination_email, subject, plain_body, html_body)
            return
        except Exception as resend_err:
            app.logger.warning("Resend fallback failed: %s", resend_err)

    if BREVO_API_KEY:
        try:
            send_via_brevo(destination_email, subject, plain_body, html_body)
            return
        except Exception as brevo_err:
            app.logger.warning("Brevo fallback failed: %s", brevo_err)

    if smtp_error:
        raise RuntimeError(
            f"SMTP connection to {SMTP_HOST}:{SMTP_PORT} failed ({smtp_error}). "
            "Note: Render Free Tier blocks outbound SMTP ports 25, 465, and 587. "
            "On Render Free Tier, please configure RESEND_API_KEY or BREVO_API_KEY (HTTP Port 443)."
        ) from smtp_error

    raise RuntimeError(
        "No email service configured. Please provide SMTP_APP_PASSWORD or RESEND_API_KEY in environment variables."
    )


# =============================================================================
# LUXURY HTML & TEXT EMAIL BUILDERS (Matching Dark Luxury Theme)
# =============================================================================
def make_html_template(
    title,
    badge_text,
    badge_bg,
    headline,
    intro_text,
    details_dict,
    items_table=None,
    total_highlight=None,
    action_button=None,
    footer_note="",
    unsubscribe_url="",
):
    year = datetime.now().year

    table_rows = ""
    for label, val in details_dict.items():
        if val:
            table_rows += f"""
            <tr>
              <td style="padding:10px 14px; border-bottom:1px solid #282e3d; color:#8e99ac; font-size:13px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; width:34%;">{label}</td>
              <td style="padding:10px 14px; border-bottom:1px solid #282e3d; color:#ffffff; font-size:14px; font-weight:500;">{val}</td>
            </tr>
            """

    items_html = ""
    if items_table:
        rows_str = ""
        for name, price in items_table:
            rows_str += f"""
            <tr>
              <td style="padding:10px 14px; border-bottom:1px solid #282e3d; color:#e0e4eb; font-size:14px;">{name}</td>
              <td style="padding:10px 14px; border-bottom:1px solid #282e3d; color:#f5d77f; font-size:14px; font-weight:600; text-align:right;">₹{price}</td>
            </tr>
            """
        if total_highlight:
            rows_str += f"""
            <tr style="background:rgba(197,160,89,0.12);">
              <td style="padding:12px 14px; color:#f5d77f; font-size:15px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">Total Confirmed Price</td>
              <td style="padding:12px 14px; color:#f5d77f; font-size:16px; font-weight:800; text-align:right;">₹{total_highlight}</td>
            </tr>
            """
        items_html = f"""
        <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color:#1c202c; border-radius:8px; border:1px solid #2d3445; margin-bottom:20px; border-collapse:collapse;">
          <thead>
            <tr style="background:#13161f;">
              <th style="padding:10px 14px; border-bottom:1px solid #2d3445; color:#8e99ac; font-size:12px; font-weight:700; text-transform:uppercase; text-align:left; letter-spacing:0.5px;">Selected Service</th>
              <th style="padding:10px 14px; border-bottom:1px solid #2d3445; color:#8e99ac; font-size:12px; font-weight:700; text-transform:uppercase; text-align:right; letter-spacing:0.5px;">Price</th>
            </tr>
          </thead>
          <tbody>
            {rows_str}
          </tbody>
        </table>
        """

    action_btn_html = ""
    if action_button:
        btn_text, btn_url = action_button
        action_btn_html = f"""
        <div style="text-align:center; margin:22px 0;">
          <a href="{btn_url}" target="_blank" style="display:inline-block; padding:12px 28px; font-size:14px; font-weight:bold; color:#0e1118; background-color:#c5a059; text-decoration:none; border-radius:6px; letter-spacing:0.5px; text-transform:uppercase;">
            {btn_text}
          </a>
        </div>
        """

    footer_note_html = f'<p style="margin:0 0 16px; font-size:13px; line-height:1.5; color:#95a1b5;">{footer_note}</p>' if footer_note else ""

    unsub_html = ""
    if unsubscribe_url:
        unsub_html = f"""
        <p style="margin:12px 0 0; font-size:11px; color:#5c667a;">
          To stop receiving automated grooming reminders, you may <a href="{unsubscribe_url}" style="color:#c5a059; text-decoration:underline;">unsubscribe here</a>.
        </p>
        """

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title}</title>
</head>
<body style="margin:0; padding:24px 12px; background-color:#0d0f12; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#e0e4eb; -webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width:580px; margin:0 auto; background-color:#161922; border-radius:12px; border:1px solid #282e3d; overflow:hidden;">
    <tr>
      <td height="4" style="background:#c5a059; font-size:0; line-height:0;">&nbsp;</td>
    </tr>
    <tr>
      <td style="padding:28px 24px 20px; text-align:center; border-bottom:1px solid #222733;">
        <h1 style="margin:0 0 6px; font-size:23px; font-weight:700; color:#f5d77f; letter-spacing:0.5px;">{SALON_NAME}</h1>
        <p style="margin:0; font-size:12px; color:#8e99ac; letter-spacing:1px; text-transform:uppercase;">Luxury Barbershop &amp; Styling · Bommuru</p>
      </td>
    </tr>
    <tr>
      <td style="padding:28px 24px 20px;">
        <div style="margin-bottom:16px;">
          <span style="display:inline-block; padding:5px 12px; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:1px; border-radius:16px; background-color:{badge_bg}; color:#0e1118;">{badge_text}</span>
        </div>
        <h2 style="margin:0 0 12px; font-size:20px; font-weight:700; color:#ffffff;">{headline}</h2>
        <p style="margin:0 0 20px; font-size:14px; line-height:1.6; color:#aab4c5;">{intro_text}</p>
        
        <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color:#1c202c; border-radius:8px; border:1px solid #2d3445; margin-bottom:20px; border-collapse:collapse;">
          <tbody>
            {table_rows}
          </tbody>
        </table>

        {items_html}
        {action_btn_html}
        {footer_note_html}
      </td>
    </tr>
    <tr>
      <td style="padding:0 24px 28px;">
        <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color:#1c202c; border-radius:8px; border:1px solid #2d3445; padding:20px;">
          <tr>
            <td>
              <h3 style="margin:0 0 10px; font-size:13px; text-transform:uppercase; letter-spacing:1px; color:#f5d77f;">Salon Location</h3>
              <p style="margin:0 0 14px; font-size:13px; color:#c8d1e0; line-height:1.5;">
                <strong style="color:#ffffff;">📍 Address:</strong><br>
                {SALON_ADDRESS}
              </p>
              <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="border-radius:6px; background-color:#c5a059;">
                    <a href="{SALON_MAPS_URL}" target="_blank" style="display:inline-block; padding:11px 20px; font-size:13px; font-weight:bold; color:#0e1118; text-decoration:none; border-radius:6px; letter-spacing:0.3px;">
                      📍 Open in Google Maps
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:18px 24px; text-align:center; background-color:#11131a; border-top:1px solid #202430;">
        <p style="margin:0 0 4px; font-size:11px; color:#717c91;">
          © {year} {SALON_NAME}. All rights reserved.
        </p>
        <p style="margin:0; font-size:11px; color:#4e5768;">
          Sri Devi One Saloon · Bommuru Centre, Rajahmundry Rural, AP 533124
        </p>
        {unsub_html}
      </td>
    </tr>
  </table>
</body>
</html>"""


# -----------------------------------------------------------------------------
# 1. Confirmation Email (Section 3 Requirement)
# -----------------------------------------------------------------------------
def make_confirmation_body(appointment):
    formatted_date = format_display_date(appointment["appointment_date"])
    formatted_time = format_display_time(appointment["appointment_time"])
    services_list = []
    if appointment.get("services_json"):
        try:
            services_list = json.loads(appointment["services_json"])
        except Exception:
            pass

    services_lines = ""
    if services_list:
        for s in services_list:
            services_lines += f"  • {s['name']}: ₹{s['price']}\n"
    else:
        services_lines = f"  • {appointment['service']}\n"

    total_val = appointment.get("total_price") or 0

    return (
        f"Hello {appointment['name']},\n\n"
        f"Thank you for booking your appointment with {SALON_NAME}!\n\n"
        f"Your selected services, appointment date, time, and total estimated price are listed below.\n\n"
        f"--- APPOINTMENT SUMMARY ---\n"
        f"Customer Name: {appointment['name']}\n"
        f"Phone: {appointment.get('phone') or 'Not provided'}\n"
        f"Date: {formatted_date}\n"
        f"Time: {formatted_time}\n"
        f"Duration: {appointment.get('duration_minutes', 60)} minutes\n\n"
        f"--- SELECTED SERVICES & PRICES ---\n"
        f"{services_lines}"
        f"Total Estimated Price: ₹{total_val}\n\n"
        f"--- SALON LOCATION ---\n"
        f"Address: {SALON_ADDRESS}\n"
        f"Google Maps Link: {SALON_MAPS_URL}\n\n"
        f"We look forward to welcoming you. Thank you for choosing {SALON_NAME}!\n\n"
        f"Best regards,\n"
        f"{SALON_NAME}\n"
    )


def make_confirmation_html(appointment):
    formatted_date = format_display_date(appointment["appointment_date"])
    formatted_time = format_display_time(appointment["appointment_time"])
    details = {
        "Customer Name": appointment["name"],
        "Appointment Date": formatted_date,
        "Appointment Time": formatted_time,
        "Estimated Duration": f"{appointment.get('duration_minutes', 60)} mins",
    }
    if appointment.get("phone"):
        details["Phone Number"] = appointment["phone"]

    items_table = []
    if appointment.get("services_json"):
        try:
            svcs = json.loads(appointment["services_json"])
            items_table = [(s["name"], s["price"]) for s in svcs]
        except Exception:
            pass
    if not items_table:
        items_table = [(appointment["service"], appointment.get("total_price", 0))]

    total_val = appointment.get("total_price") or 0

    return make_html_template(
        title="Appointment Confirmed — Sri Devi One Saloon",
        badge_text="Booking Confirmed",
        badge_bg="#c5a059",
        headline=f"Your Appointment Is Confirmed, {appointment['name']}!",
        intro_text=(
            f"Thank you for booking your appointment with {SALON_NAME}! "
            "Your selected services, appointment date, time, and total estimated price are listed below."
        ),
        details_dict=details,
        items_table=items_table,
        total_highlight=total_val,
        footer_note="We look forward to welcoming you. Thank you for choosing Sri Devi One Saloon!",
    )


# -----------------------------------------------------------------------------
# 2. Follow-Up Email (Section 4: Scheduled 3 Hours After Appointment End Time)
# -----------------------------------------------------------------------------
def make_followup_3hr_body(appointment, unsubscribe_url=""):
    formatted_date = format_display_date(appointment["appointment_date"])
    start_time = format_display_time(appointment["appointment_time"])
    end_time = format_display_time(appointment.get("appointment_end_time", ""))

    time_range = f"{start_time} – {end_time}" if end_time else start_time
    total_val = appointment.get("total_price") or 0

    unsub_text = f"\nUnsubscribe from future reminders: {unsubscribe_url}\n" if unsubscribe_url else ""

    return (
        f"Hello {appointment['name']},\n\n"
        f"Thank you for visiting {SALON_NAME}! We hope you enjoyed your experience and are happy with our service.\n\n"
        f"Your satisfaction means a lot to us. We look forward to seeing you again.\n\n"
        f"--- VISIT SUMMARY ---\n"
        f"Date: {formatted_date}\n"
        f"Time: {time_range}\n"
        f"Service(s): {appointment['service']}\n"
        f"Total Amount: ₹{total_val}\n\n"
        f"--- SALON LOCATION ---\n"
        f"Address: {SALON_ADDRESS}\n"
        f"Google Maps Link: {SALON_MAPS_URL}\n\n"
        f"Thank you for choosing {SALON_NAME}!\n\n"
        f"Best regards,\n"
        f"{SALON_NAME}\n"
        f"{unsub_text}"
    )


def make_followup_3hr_html(appointment, unsubscribe_url=""):
    formatted_date = format_display_date(appointment["appointment_date"])
    start_time = format_display_time(appointment["appointment_time"])
    end_time = format_display_time(appointment.get("appointment_end_time", ""))
    time_range = f"{start_time} – {end_time}" if end_time else start_time

    details = {
        "Services Completed": appointment["service"],
        "Visit Date": formatted_date,
        "Appointment Time": time_range,
    }
    if appointment.get("total_price"):
        details["Total Amount"] = f"₹{appointment['total_price']}"

    return make_html_template(
        title="Thank You for Visiting Sri Devi One Saloon!",
        badge_text="Thank You",
        badge_bg="#70c070",
        headline=f"Thank You for Visiting Us, {appointment['name']}!",
        intro_text=(
            f"Thank you for visiting {SALON_NAME}! We hope you enjoyed your experience and are happy with our service. "
            "Your satisfaction means a lot to us. We look forward to seeing you again."
        ),
        details_dict=details,
        footer_note="Thank you for choosing Sri Devi One Saloon! We look forward to welcoming you back.",
        unsubscribe_url=unsubscribe_url,
    )


# -----------------------------------------------------------------------------
# 3. Monthly Grooming Reminder (Section 5: Recurring Monthly Reminder)
# -----------------------------------------------------------------------------
def make_monthly_reminder_body(customer_name, booking_url, unsubscribe_url=""):
    unsub_text = f"\nUnsubscribe: {unsubscribe_url}\n" if unsubscribe_url else ""
    return (
        f"Hello {customer_name},\n\n"
        f"It's been about a month since your last visit to {SALON_NAME}!\n\n"
        f"Ready for your next haircut, shave, or grooming session? We'd be happy to welcome you again.\n\n"
        f"Book your next appointment at your convenience.\n\n"
        f"Book Online: {booking_url}\n\n"
        f"--- SALON LOCATION ---\n"
        f"Address: {SALON_ADDRESS}\n"
        f"Google Maps Link: {SALON_MAPS_URL}\n\n"
        f"Thank you for being our valued customer!\n\n"
        f"Best regards,\n"
        f"{SALON_NAME}\n"
        f"{unsub_text}"
    )


def make_monthly_reminder_html(customer_name, booking_url, unsubscribe_url=""):
    return make_html_template(
        title=f"It's Time for Your Next Haircut — {SALON_NAME}!",
        badge_text="Monthly Grooming Reminder",
        badge_bg="#c5a059",
        headline=f"Time for Your Next Haircut, {customer_name}?",
        intro_text=(
            f"It's been about a month since your last visit to {SALON_NAME}! "
            "Ready for your next haircut, shave, or grooming session? We'd be happy to welcome you again. "
            "Book your next appointment at your convenience."
        ),
        details_dict={
            "Salon Location": SALON_ADDRESS,
            "Online Booking": "Available 24/7",
        },
        action_button=("✂️ Book Your Next Appointment", booking_url),
        footer_note="Thank you for being our valued customer! Best regards, Sri Devi One Saloon.",
        unsubscribe_url=unsubscribe_url,
    )


# -----------------------------------------------------------------------------
# 4. Owner Booking Notification Email
# -----------------------------------------------------------------------------
def make_owner_booking_body(appointment):
    phone = appointment.get("phone") or "Not provided"
    formatted_date = format_display_date(appointment["appointment_date"])
    formatted_time = format_display_time(appointment["appointment_time"])
    total_val = appointment.get("total_price") or 0

    return (
        f"A new appointment booking was received for {SALON_NAME}.\n\n"
        f"--- CUSTOMER INFORMATION ---\n"
        f"Customer Name: {appointment['name']}\n"
        f"Customer Phone: {phone}\n"
        f"Customer Email: {appointment['email']}\n\n"
        f"--- APPOINTMENT DETAILS ---\n"
        f"Selected Service(s): {appointment['service']}\n"
        f"Total Confirmed Price: ₹{total_val}\n"
        f"Date: {formatted_date} ({appointment['appointment_date']})\n"
        f"Time: {formatted_time} ({appointment['appointment_time']})\n"
        f"Duration: {appointment.get('duration_minutes', 60)} mins\n"
        f"Notes: {appointment.get('notes') or 'None'}\n\n"
        f"Salon Location: {SALON_ADDRESS}\n"
        f"Google Maps: {SALON_MAPS_URL}\n"
    )


def make_owner_booking_html(appointment):
    phone = appointment.get("phone") or "Not provided"
    formatted_date = format_display_date(appointment["appointment_date"])
    formatted_time = format_display_time(appointment["appointment_time"])
    total_val = appointment.get("total_price") or 0

    details = {
        "Customer Name": appointment["name"],
        "Customer Phone": phone,
        "Customer Email": appointment["email"],
        "Service(s)": appointment["service"],
        "Total Price": f"₹{total_val}",
        "Date": f"{formatted_date}",
        "Time": f"{formatted_time}",
        "Notes": appointment.get("notes") or "None",
    }
    return make_html_template(
        title="New Appointment Booking",
        badge_text="New Booking",
        badge_bg="#e5a93b",
        headline="New Appointment Received!",
        intro_text="A customer has booked an appointment online through the website. Here are the booking details:",
        details_dict=details,
        footer_note="Ensure the slot is reserved and contact the customer if any schedule adjustment is needed.",
    )


# =============================================================================
# SCHEDULER & NOTIFICATION DISPATCH ENGINE
# =============================================================================
def get_base_url():
    """Returns detected or configured application URL."""
    if APP_URL:
        return APP_URL
    try:
        return request.host_url.rstrip("/")
    except Exception:
        return "https://sridevionesaloon.onrender.com"


def get_email_template(template_id: str):
    try:
        with sqlite3.connect(DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            row = conn.execute("SELECT * FROM email_templates WHERE id = ?", (template_id,)).fetchone()
            if row:
                return dict(row)
    except Exception:
        pass
    return None


def render_template_placeholders(template_str: str, placeholders: dict) -> str:
    if not template_str:
        return ""
    rendered = template_str
    for key, value in placeholders.items():
        rendered = rendered.replace(f"{{{{{key}}}}}", str(value if value is not None else ""))
    return rendered


def send_notification_email(appointment, notification_type):
    base_url = get_base_url()
    unsub_token = appointment.get("unsubscribe_token") or ""
    unsub_url = f"{base_url}/unsubscribe?token={unsub_token}" if unsub_token else ""

    if notification_type == "owner_booking":
        send_email(
            SALON_EMAIL,
            f"New Appointment Booking – {SALON_NAME}",
            make_owner_booking_body(appointment),
            make_owner_booking_html(appointment),
        )
        return

    tpl_key = "confirmation" if notification_type == "confirmation" else "followup_3hr" if notification_type in {"followup_3hr", "followup", "thank_you"} else notification_type
    custom_tpl = get_email_template(tpl_key)

    services_lines = ""
    if appointment.get("services_json"):
        try:
            s_list = json.loads(appointment["services_json"])
            services_lines = "\n".join([f"• {s['name']}: ₹{s['price']}" for s in s_list])
        except Exception:
            pass
    if not services_lines:
        services_lines = appointment.get("service") or ""

    placeholders = {
        "customer_name": appointment.get("name", "Valued Customer"),
        "salon_name": SALON_NAME,
        "salon_phone": SALON_PHONE,
        "salon_email": SALON_EMAIL,
        "salon_address": SALON_ADDRESS,
        "maps_url": SALON_MAPS_URL,
        "phone": SALON_PHONE,
        "appointment_date": format_display_date(appointment.get("appointment_date", "")),
        "appointment_time": format_display_time(appointment.get("appointment_time", "")),
        "services_list": services_lines,
        "total_price": f"₹{appointment.get('total_price', 0)}",
        "notes": appointment.get("notes", ""),
        "unsubscribe_url": unsub_url,
    }

    if notification_type == "confirmation":
        if custom_tpl and custom_tpl.get("subject") and custom_tpl.get("body_html"):
            subject = render_template_placeholders(custom_tpl["subject"], placeholders)
            custom_body = render_template_placeholders(custom_tpl["body_html"], placeholders)
            if "<table" in custom_body or "<div" in custom_body or "<p>" in custom_body:
                html = custom_body
                body = re.sub(r"<[^>]+>", "", custom_body)
            else:
                body = custom_body
                html = make_confirmation_html(appointment)
        else:
            subject = f"Your Appointment Is Confirmed — {SALON_NAME}"
            body = make_confirmation_body(appointment)
            html = make_confirmation_html(appointment)

        send_email(appointment["email"], subject, body, html)
        return

    if notification_type in {"followup_3hr", "followup", "thank_you"}:
        if custom_tpl and custom_tpl.get("subject") and custom_tpl.get("body_html"):
            subject = render_template_placeholders(custom_tpl["subject"], placeholders)
            custom_body = render_template_placeholders(custom_tpl["body_html"], placeholders)
            if "<table" in custom_body or "<div" in custom_body or "<p>" in custom_body:
                html = custom_body
                body = re.sub(r"<[^>]+>", "", custom_body)
            else:
                body = custom_body
                html = make_followup_3hr_html(appointment, unsub_url)
        else:
            subject = f"Thank You for Visiting {SALON_NAME}!"
            body = make_followup_3hr_body(appointment, unsub_url)
            html = make_followup_3hr_html(appointment, unsub_url)

        send_email(appointment["email"], subject, body, html)
        return

    if notification_type == "cancellation":
        if custom_tpl and custom_tpl.get("subject") and custom_tpl.get("body_html"):
            subject = render_template_placeholders(custom_tpl["subject"], placeholders)
            custom_body = render_template_placeholders(custom_tpl["body_html"], placeholders)
        else:
            subject = f"Your Appointment Has Been Cancelled — {SALON_NAME}"
            custom_body = f"Hello {appointment['name']},\n\nYour appointment scheduled for {format_display_date(appointment['appointment_date'])} has been cancelled.\n\nBest regards,\n{SALON_NAME}"
        send_email(appointment["email"], subject, custom_body, None)
        return


def process_notification_job(appointment_id, notification_type):
    appointment = get_appointment(appointment_id)
    if not appointment:
        return

    # Check appointment status: do not send follow-up or reminders if cancelled
    if appointment["status"] == "cancelled":
        with sqlite3.connect(DB_PATH) as conn:
            conn.execute(
                "UPDATE notification_logs SET status = 'cancelled' WHERE appointment_id = ? AND notification_type = ?",
                (appointment_id, notification_type),
            )
            conn.commit()
        return

    row = notification_status(appointment_id, notification_type)
    if row and row[0] == "sent":
        return

    # Atomic lock: transition to 'processing' to prevent concurrent worker duplicates
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.execute(
            """
            UPDATE notification_logs
            SET status = 'processing'
            WHERE appointment_id = ? AND notification_type = ? AND status IN ('scheduled', 'failed')
            """,
            (appointment_id, notification_type),
        )
        if cursor.rowcount == 0 and row:
            # Another thread/worker is processing this job
            return
        if not row:
            conn.execute(
                """
                INSERT INTO notification_logs (appointment_id, notification_type, scheduled_for, status, attempts, last_error)
                VALUES (?, ?, ?, 'processing', 0, NULL)
                ON CONFLICT(appointment_id, notification_type) DO NOTHING
                """,
                (appointment_id, notification_type, now_local_iso()),
            )
        conn.commit()

    try:
        send_notification_email(appointment, notification_type)
    except Exception as exc:
        app.logger.warning("Notification %s for appointment %s failed: %s", notification_type, appointment_id, exc)
        with sqlite3.connect(DB_PATH) as conn:
            current = conn.execute(
                "SELECT attempts FROM notification_logs WHERE appointment_id = ? AND notification_type = ?",
                (appointment_id, notification_type),
            ).fetchone()
            attempts = (current[0] if current else 0) + 1
            conn.execute(
                "UPDATE notification_logs SET attempts = ?, last_error = ?, status = 'failed' WHERE appointment_id = ? AND notification_type = ?",
                (attempts, str(exc), appointment_id, notification_type),
            )
            conn.commit()

        if attempts < MAX_EMAIL_RETRIES:
            retry_dt = now_local_dt() + timedelta(minutes=5)
            scheduler.add_job(
                process_notification_job,
                "date",
                run_date=retry_dt,
                args=[appointment_id, notification_type],
                id=f"retry-{appointment_id}-{notification_type}",
                replace_existing=True,
            )
        return

    # Mark as successfully sent
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            "UPDATE notification_logs SET sent_at = ?, status = 'sent', last_error = NULL WHERE appointment_id = ? AND notification_type = ?",
            (now_local_iso(), appointment_id, notification_type),
        )
        if notification_type == "confirmation":
            conn.execute(
                "UPDATE appointments SET status = 'confirmed', updated_at = ? WHERE id = ?",
                (now_local_iso(), appointment_id),
            )
        elif notification_type in {"followup_3hr", "followup"}:
            conn.execute(
                "UPDATE appointments SET followup_status = 'sent', updated_at = ? WHERE id = ?",
                (now_local_iso(), appointment_id),
            )
        conn.commit()


# =============================================================================
# MONTHLY RECURRING REMINDER WORKER
# =============================================================================
def process_customer_monthly_reminder(customer: dict, now_local: datetime):
    """
    Sends one scheduled monthly reminder to an active customer, handles opt-out,
    and advances the customer's next reminder date by 1 month using safe end-of-month logic.
    """
    if customer.get("status") != "active":
        return

    email = customer["customer_email"]
    name = customer["customer_name"]
    base_url = get_base_url()
    booking_url = f"{base_url}/#booking"
    unsub_token = customer["unsubscribe_token"]
    unsub_url = f"{base_url}/unsubscribe?token={unsub_token}"

    # Prevent sending multiple reminders on the exact same date
    last_sent = customer.get("last_sent_at")
    today_str = now_local.strftime("%Y-%m-%d")
    if last_sent and str(last_sent).startswith(today_str):
        return

    # Atomic lock on customer_reminders
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.execute(
            "UPDATE customer_reminders SET status = 'processing' WHERE id = ? AND status = 'active'",
            (customer["id"],),
        )
        if cursor.rowcount == 0:
            return
        conn.commit()

    subject = f"It's Time for Your Next Haircut — {SALON_NAME}!"
    plain_body = make_monthly_reminder_body(name, booking_url, unsub_url)
    html_body = make_monthly_reminder_html(name, booking_url, unsub_url)

    try:
        send_email(email, subject, plain_body, html_body)
    except Exception as exc:
        app.logger.warning("Monthly reminder for %s failed: %s", email, exc)
        with sqlite3.connect(DB_PATH) as conn:
            conn.execute(
                "UPDATE customer_reminders SET status = 'active', updated_at = ? WHERE id = ?",
                (now_local_iso(), customer["id"]),
            )
            conn.commit()
        return

    # Calculate next occurrence safely (1 month later, e.g. Jan 31 -> Feb 28)
    curr_reminder_date = datetime.strptime(customer["next_reminder_date"], "%Y-%m-%d").date()
    next_date = add_months_safe(curr_reminder_date, 1)

    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            UPDATE customer_reminders
            SET status = 'active',
                next_reminder_date = ?,
                reminders_sent_count = reminders_sent_count + 1,
                last_sent_at = ?,
                updated_at = ?
            WHERE id = ?
            """,
            (next_date.strftime("%Y-%m-%d"), now_local_iso(), now_local_iso(), customer["id"]),
        )
        # Log in notification_logs for complete traceability
        notif_type = f"monthly_reminder_{customer['next_reminder_date']}"
        conn.execute(
            """
            INSERT INTO notification_logs (appointment_id, notification_type, scheduled_for, sent_at, status, attempts)
            VALUES (?, ?, ?, ?, 'sent', 1)
            ON CONFLICT(appointment_id, notification_type) DO UPDATE SET sent_at = excluded.sent_at, status = 'sent'
            """,
            (customer["last_appointment_id"], notif_type, customer["next_reminder_date"], now_local_iso()),
        )
        conn.commit()


def check_and_process_due_jobs():
    """
    Watchdog tick function that runs every 60 seconds (or triggered by cloud cron).
    Checks SQLite for any due notifications and monthly reminders and dispatches them.
    Guarantees scheduler reliability even if server restarts or sleeps on Render Free Tier.
    """
    now_local = now_local_dt()
    now_iso = now_local.isoformat()
    today_str = now_local.strftime("%Y-%m-%d")

    # 1. Process due appointment notification logs (follow-ups, retries)
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        due_logs = conn.execute(
            """
            SELECT appointment_id, notification_type
            FROM notification_logs
            WHERE status IN ('scheduled', 'failed')
              AND scheduled_for <= ?
              AND attempts < ?
            """,
            (now_iso, MAX_EMAIL_RETRIES),
        ).fetchall()

    for item in due_logs:
        process_notification_job(item["appointment_id"], item["notification_type"])

    # 2. Process due monthly reminders if enabled
    if ENABLE_MONTHLY_FOLLOWUPS:
        with sqlite3.connect(DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            due_customers = conn.execute(
                """
                SELECT * FROM customer_reminders
                WHERE status = 'active'
                  AND next_reminder_date <= ?
                """,
                (today_str,),
            ).fetchall()

        for cust in due_customers:
            process_customer_monthly_reminder(dict(cust), now_local)


def schedule_notification_jobs():
    """Populates scheduler jobs from DB on application boot for future executions."""
    now_iso = now_local_iso()
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            """
            SELECT appointment_id, notification_type, scheduled_for
            FROM notification_logs
            WHERE status IN ('scheduled', 'failed')
              AND scheduled_for > ?
              AND attempts < ?
            """,
            (now_iso, MAX_EMAIL_RETRIES),
        ).fetchall()

    for row in rows:
        try:
            run_dt = datetime.fromisoformat(row["scheduled_for"])
            scheduler.add_job(
                process_notification_job,
                "date",
                run_date=run_dt,
                args=[row["appointment_id"], row["notification_type"]],
                id=f"{row['appointment_id']}-{row['notification_type']}",
                replace_existing=True,
            )
        except Exception:
            pass


# =============================================================================
# BOOKING CREATION & PERSISTENCE
# =============================================================================
def create_booking_record(data):
    phone = (data.get("phone") or "").strip()
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip()
    date_text = (data.get("appointment_date") or "").strip()
    time_text = (data.get("appointment_time") or "").strip()

    if not all([name, email, phone, date_text, time_text]):
        raise ValueError("Missing required booking fields. Please provide full name, phone number, email, date, and time.")

    # Service input resolution
    services_input = data.get("services") or data.get("service")
    if not services_input:
        raise ValueError("Please select at least one salon service.")

    # Validate against authoritative catalog & compute trusted total
    validated_services, total_price, total_duration, services_display = resolve_and_validate_services(services_input)

    # Parse and validate local datetime
    start_dt = parse_local_datetime(date_text, time_text)
    end_dt = start_dt + timedelta(minutes=total_duration)
    end_time_str = end_dt.strftime("%H:%M")

    # Follow-up due exactly 3 HOURS AFTER the appointment end time (Section 4 Requirement)
    followup_due_dt = end_dt + timedelta(hours=3)

    # First monthly reminder 1 month after appointment date (Section 5 Requirement)
    apt_date_obj = datetime.strptime(date_text, "%Y-%m-%d").date()
    first_reminder_date = add_months_safe(apt_date_obj, 1).strftime("%Y-%m-%d")

    unsub_token = secrets.token_urlsafe(24)
    services_json = json.dumps([{"id": s["id"], "name": s["name"], "price": s["price"]} for s in validated_services])

    with sqlite3.connect(DB_PATH) as conn:
        now_iso = now_local_iso()
        cursor = conn.execute(
            """
            INSERT INTO appointments (
                name, email, phone, service, services_json, total_price,
                duration_minutes, appointment_date, appointment_time,
                appointment_end_time, followup_due_at, followup_status,
                next_reminder_date, reminder_status, unsubscribe_token,
                notes, status, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?, 'active', ?, ?, 'booked', ?, ?)
            """,
            (
                name,
                email,
                phone,
                services_display,
                services_json,
                total_price,
                total_duration,
                date_text,
                time_text,
                end_time_str,
                followup_due_dt.isoformat(),
                first_reminder_date,
                unsub_token,
                (data.get("notes") or "").strip(),
                now_iso,
                now_iso,
            ),
        )
        appointment_id = cursor.lastrowid

        # Queue confirmation email (immediate)
        conn.execute(
            """
            INSERT INTO notification_logs (appointment_id, notification_type, scheduled_for, status, attempts, last_error)
            VALUES (?, 'confirmation', ?, 'scheduled', 0, NULL)
            ON CONFLICT(appointment_id, notification_type) DO UPDATE SET scheduled_for = excluded.scheduled_for, status = 'scheduled'
            """,
            (appointment_id, now_iso),
        )
        # Queue owner notification email (immediate)
        conn.execute(
            """
            INSERT INTO notification_logs (appointment_id, notification_type, scheduled_for, status, attempts, last_error)
            VALUES (?, 'owner_booking', ?, 'scheduled', 0, NULL)
            ON CONFLICT(appointment_id, notification_type) DO UPDATE SET scheduled_for = excluded.scheduled_for, status = 'scheduled'
            """,
            (appointment_id, now_iso),
        )
        # Queue 3-hour follow-up email (scheduled for 3 hours after appointment end)
        conn.execute(
            """
            INSERT INTO notification_logs (appointment_id, notification_type, scheduled_for, status, attempts, last_error)
            VALUES (?, 'followup_3hr', ?, 'scheduled', 0, NULL)
            ON CONFLICT(appointment_id, notification_type) DO UPDATE SET scheduled_for = excluded.scheduled_for, status = 'scheduled'
            """,
            (appointment_id, followup_due_dt.isoformat()),
        )

        # Update or create customer recurring reminder profile (Section 5 Requirement:
        # "If a new appointment is booked, update the reminder schedule according to the salon's chosen reminder policy")
        conn.execute(
            """
            INSERT INTO customer_reminders (
                customer_email, customer_name, last_appointment_id,
                last_appointment_date, next_reminder_date, status,
                unsubscribe_token, reminders_sent_count, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, 'active', ?, 0, ?, ?)
            ON CONFLICT(customer_email) DO UPDATE SET
                customer_name = excluded.customer_name,
                last_appointment_id = excluded.last_appointment_id,
                last_appointment_date = excluded.last_appointment_date,
                next_reminder_date = excluded.next_reminder_date,
                updated_at = excluded.updated_at
            """,
            (email.lower(), name, appointment_id, date_text, first_reminder_date, unsub_token, now_iso, now_iso),
        )
        conn.commit()

    appointment = get_appointment(appointment_id)

    # Immediately dispatch confirmation & owner notification in background threads
    import threading

    threading.Thread(
        target=process_notification_job,
        args=[appointment_id, "confirmation"],
        daemon=True,
    ).start()
    threading.Thread(
        target=process_notification_job,
        args=[appointment_id, "owner_booking"],
        daemon=True,
    ).start()

    # Schedule the 3-hour follow-up in APScheduler
    scheduler.add_job(
        process_notification_job,
        "date",
        run_date=followup_due_dt,
        args=[appointment_id, "followup_3hr"],
        id=f"{appointment_id}-followup_3hr",
        replace_existing=True,
    )

    return appointment, validated_services, total_price


# =============================================================================
# CONTACT FORM DISPATCH
# =============================================================================
def send_contact_message(data):
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip()
    subject = (data.get("subject") or "").strip()
    message = (data.get("message") or "").strip()

    if not all([name, email, subject, message]):
        raise ValueError("Name, email, subject, and message are required.")

    body = (
        f"Name: {name}\n"
        f"Email: {email}\n"
        f"Subject: {subject}\n\n"
        f"Message:\n{message}\n"
    )
    html = make_html_template(
        title=f"Enquiry: {subject}",
        badge_text="Contact Enquiry",
        badge_bg="#c5a059",
        headline=f"New Website Enquiry from {name}",
        intro_text="A visitor submitted a message via the website contact form:",
        details_dict={
            "Sender Name": name,
            "Sender Email": email,
            "Subject": subject,
            "Message": message,
        },
        footer_note="Reply directly to the customer's email address.",
    )
    send_email(SALON_EMAIL, f"Website enquiry: {subject}", body, html)


def send_smtp_test_email():
    test_subject = f"SMTP Health Check – {SALON_NAME}"
    now_formatted = now_local_dt().strftime("%B %d, %Y at %I:%M %p %Z").replace(" 0", " ")
    test_body = (
        f"This is an automated SMTP health-check message from the {SALON_NAME} booking system.\n\n"
        "If you received this email, the configured SMTP connection is operating normally.\n\n"
        f"Google Maps: {SALON_MAPS_URL}\n"
        f"Address: {SALON_ADDRESS}\n"
        f"Sent at: {now_formatted}\n"
    )
    test_html = make_html_template(
        title="SMTP Health Check",
        badge_text="System Active",
        badge_bg="#c5a059",
        headline="SMTP Connection Verified",
        intro_text=(
            f"This is an automated health-check from the {SALON_NAME} booking system. "
            "The SMTP service is active and delivering appointment notifications."
        ),
        details_dict={
            "System Status": "Online & Operational",
            "SMTP Host": SMTP_HOST,
            "Sent At": now_formatted,
        },
        footer_note="All confirmations, 3-hour follow-ups, and monthly reminders are routed via this transport.",
    )
    send_email(SALON_EMAIL, test_subject, test_body, test_html)


# =============================================================================
# FLASK HTTP ROUTES & API
# =============================================================================
@app.after_request
def add_no_cache_headers(response):
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response


@app.route("/")
def index():
    return send_file(BASE_DIR / "index.html")


# =============================================================================
# ADMIN AUTHENTICATION, SECURITY & AUDIT UTILITIES
# =============================================================================
_LOGIN_ATTEMPTS = {}


def is_rate_limited(ip, max_attempts=5, window_seconds=600):
    now = datetime.now().timestamp()
    attempts = _LOGIN_ATTEMPTS.get(ip, [])
    attempts = [t for t in attempts if now - t < window_seconds]
    _LOGIN_ATTEMPTS[ip] = attempts
    return len(attempts) >= max_attempts


def record_failed_attempt(ip):
    now = datetime.now().timestamp()
    attempts = _LOGIN_ATTEMPTS.get(ip, [])
    attempts.append(now)
    _LOGIN_ATTEMPTS[ip] = attempts


def clear_attempts(ip):
    _LOGIN_ATTEMPTS.pop(ip, None)


def log_activity(action, details="", admin_user=None, ip_address=None):
    try:
        now_iso = now_local_iso()
        user = admin_user or session.get("admin_username") or "system"
        ip = ip_address or (request.remote_addr if request else "127.0.0.1")
        with sqlite3.connect(DB_PATH) as conn:
            conn.execute(
                "INSERT INTO activity_logs (admin_user, action, details, ip_address, created_at) VALUES (?, ?, ?, ?, ?)",
                (user, action, str(details), ip, now_iso),
            )
            conn.commit()
    except Exception as exc:
        app.logger.warning("Failed to log activity: %s", exc)


def admin_required(f):
    @functools.wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get("admin_logged_in"):
            if request.path.startswith("/api/"):
                return jsonify({"success": False, "error": "Authentication required. Please sign in."}), 401
            return redirect("/admin/login")
        return f(*args, **kwargs)
    return decorated_function


# =============================================================================
# ADMIN PAGES & STATIC MEDIA ROUTES
# =============================================================================
@app.route("/admin/login")
def admin_login_page():
    if session.get("admin_logged_in"):
        return redirect("/admin")
    return send_file(BASE_DIR / "admin" / "login.html")


@app.route("/admin/forgot-password")
def admin_forgot_password_page():
    return send_file(BASE_DIR / "admin" / "forgot-password.html")


@app.route("/admin/reset-password")
def admin_reset_password_page():
    return send_file(BASE_DIR / "admin" / "reset-password.html")


@app.route("/admin")
@app.route("/admin/dashboard")
def admin_dashboard_page():
    if not session.get("admin_logged_in"):
        return redirect("/admin/login")
    return send_file(BASE_DIR / "admin" / "dashboard.html")


@app.route("/admin/<path:filename>")
def admin_static_files(filename):
    file_path = BASE_DIR / "admin" / filename
    if file_path.is_file():
        return send_file(file_path)
    abort(404)


@app.route("/uploads/<path:filename>")
def uploaded_files(filename):
    file_path = UPLOAD_DIR / filename
    if file_path.is_file():
        return send_file(file_path)
    abort(404)


# =============================================================================
# SERVICES CATALOG API (Dynamic from DB with static fallback)
# =============================================================================
@app.route("/api/services", methods=["GET"])
def api_services():
    """Returns active salon services and prices from database with fallback."""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute(
                "SELECT * FROM services WHERE is_active = 1 AND is_archived = 0 ORDER BY display_order ASC, name ASC"
            ).fetchall()
            if rows:
                return jsonify({
                    "success": True,
                    "services": [dict(r) for r in rows],
                }), 200
    except Exception as exc:
        app.logger.warning("Error loading services from database: %s", exc)

    services_list = [
        {
            "id": s["id"],
            "name": s["name"],
            "price": s["price"],
            "duration": s["duration"],
            "description": s["description"],
            "category": s.get("category", "Hair & Grooming"),
            "image_url": s.get("image_url", ""),
            "is_active": 1,
            "display_order": 0,
        }
        for s in AUTHORITATIVE_SERVICES.values()
    ]
    return jsonify({"success": True, "services": services_list}), 200


# =============================================================================
# ADMIN AUTHENTICATION & PROFILE APIS
# =============================================================================
@app.route("/api/admin/login", methods=["POST"])
def api_admin_login():
    ip = request.remote_addr or "127.0.0.1"
    if is_rate_limited(ip):
        return jsonify({"success": False, "error": "Too many failed login attempts. Please wait 10 minutes."}), 429

    payload = request.get_json(silent=True) or {}
    ident = (payload.get("username") or "").strip()
    password = payload.get("password") or ""
    remember = bool(payload.get("remember"))

    if not ident or not password:
        return jsonify({"success": False, "error": "Username/email and password are required."}), 400

    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        user = conn.execute(
            "SELECT * FROM admin_users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)",
            (ident, ident),
        ).fetchone()

    if user and check_password_hash(user["password_hash"], password):
        clear_attempts(ip)
        session["admin_logged_in"] = True
        session["admin_id"] = user["id"]
        session["admin_username"] = user["username"]
        session.permanent = remember

        with sqlite3.connect(DB_PATH) as conn:
            conn.execute("UPDATE admin_users SET last_login_at = ? WHERE id = ?", (now_local_iso(), user["id"]))
            conn.commit()

        log_activity("admin_login", f"Admin '{user['username']}' logged in successfully", user["username"], ip)
        return jsonify({
            "success": True,
            "must_change_password": bool(user["must_change_password"]),
            "username": user["username"],
        }), 200

    record_failed_attempt(ip)
    log_activity("login_failure", f"Failed login attempt for '{ident}'", ident, ip)
    return jsonify({"success": False, "error": "Invalid username/email or password."}), 401


@app.route("/api/admin/logout", methods=["POST"])
def api_admin_logout():
    user = session.get("admin_username", "admin")
    log_activity("admin_logout", f"Admin '{user}' logged out")
    session.clear()
    return jsonify({"success": True, "message": "Signed out successfully."}), 200


@app.route("/api/admin/me", methods=["GET"])
def api_admin_me():
    if not session.get("admin_logged_in"):
        return jsonify({"success": False, "error": "Unauthorized"}), 401

    admin_id = session.get("admin_id")
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        user = conn.execute("SELECT id, username, email, must_change_password, last_login_at FROM admin_users WHERE id = ?", (admin_id,)).fetchone()

    if not user:
        session.clear()
        return jsonify({"success": False, "error": "User not found"}), 401

    return jsonify({"success": True, "admin": dict(user)}), 200


@app.route("/api/admin/forgot-password", methods=["POST"])
def api_admin_forgot_password():
    ip = request.remote_addr or "127.0.0.1"
    if is_rate_limited(ip, max_attempts=5, window_seconds=600):
        return jsonify({"success": False, "error": "Too many requests. Please wait 10 minutes."}), 429

    payload = request.get_json(silent=True) or {}
    email = (payload.get("email") or "").strip().lower()
    if not email:
        return jsonify({"success": False, "error": "Email address is required."}), 400

    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        user = conn.execute("SELECT * FROM admin_users WHERE LOWER(email) = ?", (email,)).fetchone()

    if user:
        token = secrets.token_urlsafe(32)
        expires_at = (now_local_dt() + timedelta(hours=1)).isoformat()
        with sqlite3.connect(DB_PATH) as conn:
            conn.execute(
                "UPDATE admin_users SET reset_token = ?, reset_token_expires_at = ?, updated_at = ? WHERE id = ?",
                (token, expires_at, now_local_iso(), user["id"]),
            )
            conn.commit()

        reset_url = f"{get_base_url()}/admin/reset-password?token={token}"
        subject = f"Reset Your Administrator Password — {SALON_NAME}"
        plain_body = (
            f"Hello {user['username']},\n\n"
            f"We received a request to reset your password for the {SALON_NAME} Admin Portal.\n\n"
            f"Click the link below to set a new password:\n{reset_url}\n\n"
            "This link will expire in 1 hour. If you did not request this, you can safely ignore this email.\n\n"
            f"Best regards,\n{SALON_NAME}"
        )
        html_body = make_html_template(
            title="Password Reset Request",
            badge_text="SECURITY NOTICE",
            badge_bg="#b45309",
            headline="Reset Your Admin Password",
            intro_text=f"A password reset was requested for your administrator account (<strong>{user['username']}</strong>). Click below to create a new password.",
            details_dict={"Requested For": user["email"], "Link Validity": "1 Hour"},
            action_button=(reset_url, "Reset Password Now"),
            footer_note="If you did not make this request, please contact the salon owner immediately.",
        )
        try:
            send_email(user["email"], subject, plain_body, html_body)
        except Exception as exc:
            app.logger.warning("Failed to send password reset email: %s", exc)

        log_activity("forgot_password_request", f"Reset link generated for {user['email']}", user["username"], ip)

    return jsonify({
        "success": True,
        "message": "If that email address is registered, password recovery instructions have been sent to your inbox.",
    }), 200


@app.route("/api/admin/reset-password", methods=["POST"])
def api_admin_reset_password():
    payload = request.get_json(silent=True) or {}
    token = (payload.get("token") or "").strip()
    password = payload.get("password") or ""
    confirm_pwd = payload.get("confirm_password") or ""

    if not token:
        return jsonify({"success": False, "error": "Reset token is missing."}), 400
    if not password or len(password) < 8:
        return jsonify({"success": False, "error": "Password must be at least 8 characters long."}), 400
    if password != confirm_pwd:
        return jsonify({"success": False, "error": "Passwords do not match."}), 400

    now_iso = now_local_iso()
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        user = conn.execute("SELECT * FROM admin_users WHERE reset_token = ?", (token,)).fetchone()

        if not user:
            return jsonify({"success": False, "error": "Invalid or expired password reset link."}), 400

        expires_at = user["reset_token_expires_at"]
        if expires_at and expires_at < now_iso:
            conn.execute("UPDATE admin_users SET reset_token = NULL, reset_token_expires_at = NULL WHERE id = ?", (user["id"],))
            conn.commit()
            return jsonify({"success": False, "error": "This password reset link has expired. Please request a new one."}), 400

        new_hash = generate_password_hash(password)
        conn.execute(
            """
            UPDATE admin_users
            SET password_hash = ?, reset_token = NULL, reset_token_expires_at = NULL, must_change_password = 0, updated_at = ?
            WHERE id = ?
            """,
            (new_hash, now_iso, user["id"]),
        )
        conn.commit()

    log_activity("password_reset_success", "Password was reset successfully", user["username"], request.remote_addr)
    return jsonify({"success": True, "message": "Password reset successfully. You may now log in with your new password."}), 200


@app.route("/api/admin/change-password", methods=["POST"])
@admin_required
def api_admin_change_password():
    payload = request.get_json(silent=True) or {}
    curr_pwd = payload.get("current_password") or ""
    new_pwd = payload.get("new_password") or ""
    confirm_pwd = payload.get("confirm_password") or ""

    if not new_pwd or len(new_pwd) < 8:
        return jsonify({"success": False, "error": "New password must be at least 8 characters long."}), 400
    if new_pwd != confirm_pwd:
        return jsonify({"success": False, "error": "New passwords do not match."}), 400

    admin_id = session.get("admin_id")
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        user = conn.execute("SELECT * FROM admin_users WHERE id = ?", (admin_id,)).fetchone()
        if not user:
            return jsonify({"success": False, "error": "User not found"}), 404

        if not check_password_hash(user["password_hash"], curr_pwd):
            return jsonify({"success": False, "error": "Current password is incorrect."}), 400

        new_hash = generate_password_hash(new_pwd)
        conn.execute(
            "UPDATE admin_users SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?",
            (new_hash, now_local_iso(), admin_id),
        )
        conn.commit()

    log_activity("change_password", "Admin password changed successfully", user["username"])
    return jsonify({"success": True, "message": "Password updated successfully."}), 200


@app.route("/api/admin/profile", methods=["POST"])
@admin_required
def api_admin_update_profile():
    payload = request.get_json(silent=True) or {}
    username = (payload.get("username") or "").strip()
    email = (payload.get("email") or "").strip()

    if not username or not email:
        return jsonify({"success": False, "error": "Username and email cannot be empty."}), 400

    admin_id = session.get("admin_id")
    now_iso = now_local_iso()
    try:
        with sqlite3.connect(DB_PATH) as conn:
            conn.execute(
                "UPDATE admin_users SET username = ?, email = ?, updated_at = ? WHERE id = ?",
                (username, email, now_iso, admin_id),
            )
            conn.commit()
        session["admin_username"] = username
        log_activity("update_profile", f"Admin profile updated: username='{username}', email='{email}'", username)
        return jsonify({"success": True, "message": "Profile updated successfully."}), 200
    except sqlite3.IntegrityError:
        return jsonify({"success": False, "error": "A user with that username or email already exists."}), 400


# =============================================================================
# ADMIN DASHBOARD STATS & APPOINTMENT MANAGEMENT APIS
# =============================================================================
@app.route("/api/admin/stats", methods=["GET"])
@admin_required
def api_admin_stats():
    today_str = now_local_dt().strftime("%Y-%m-%d")
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        total_apt = conn.execute("SELECT count(*) FROM appointments").fetchone()[0]
        today_apt = conn.execute("SELECT count(*) FROM appointments WHERE appointment_date = ?", (today_str,)).fetchone()[0]
        upcoming_apt = conn.execute("SELECT count(*) FROM appointments WHERE appointment_date >= ? AND status IN ('booked', 'confirmed')", (today_str,)).fetchone()[0]
        completed_apt = conn.execute("SELECT count(*) FROM appointments WHERE status = 'completed'").fetchone()[0]
        cancelled_apt = conn.execute("SELECT count(*) FROM appointments WHERE status = 'cancelled'").fetchone()[0]
        active_svc = conn.execute("SELECT count(*) FROM services WHERE is_active = 1 AND is_archived = 0").fetchone()[0]
        pending_emails = conn.execute("SELECT count(*) FROM notification_logs WHERE status IN ('scheduled', 'processing')").fetchone()[0]

        recent = conn.execute(
            "SELECT * FROM appointments ORDER BY id DESC LIMIT 10"
        ).fetchall()

    return jsonify({
        "success": True,
        "stats": {
            "total_appointments": total_apt,
            "today_appointments": today_apt,
            "upcoming_appointments": upcoming_apt,
            "completed_appointments": completed_apt,
            "cancelled_appointments": cancelled_apt,
            "active_services": active_svc,
            "pending_emails": pending_emails,
        },
        "recent_appointments": [dict(r) for r in recent],
    }), 200


@app.route("/api/admin/appointments", methods=["GET"])
@admin_required
def api_admin_appointments_list():
    q = (request.args.get("q") or "").strip().lower()
    status = (request.args.get("status") or "").strip().lower()
    date_filter = (request.args.get("date") or "").strip()

    sql = "SELECT a.* FROM appointments a WHERE 1=1"
    params = []
    if status:
        sql += " AND a.status = ?"
        params.append(status)
    if date_filter:
        sql += " AND a.appointment_date = ?"
        params.append(date_filter)
    if q:
        sql += " AND (LOWER(a.name) LIKE ? OR LOWER(a.email) LIKE ? OR a.phone LIKE ?)"
        term = f"%{q}%"
        params.extend([term, term, term])

    sql += " ORDER BY a.appointment_date DESC, a.appointment_time DESC, a.id DESC LIMIT 300"

    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(sql, params).fetchall()

        apts = []
        for r in rows:
            apt = dict(r)
            nl = conn.execute(
                "SELECT notification_type, status FROM notification_logs WHERE appointment_id = ?",
                (apt["id"],),
            ).fetchall()
            nl_map = {n["notification_type"]: n["status"] for n in nl}
            apt["conf_delivery"] = nl_map.get("confirmation", "sent")
            apt["followup_delivery"] = nl_map.get("followup_3hr", "scheduled")
            apts.append(apt)

    return jsonify({"success": True, "appointments": apts}), 200


@app.route("/api/admin/appointments/<int:appointment_id>", methods=["GET"])
@admin_required
def api_admin_appointment_detail(appointment_id):
    appointment = get_appointment(appointment_id)
    if not appointment:
        return jsonify({"success": False, "error": "Appointment not found."}), 404

    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        logs = conn.execute(
            "SELECT * FROM notification_logs WHERE appointment_id = ? ORDER BY id ASC",
            (appointment_id,),
        ).fetchall()

    return jsonify({
        "success": True,
        "appointment": appointment,
        "notification_logs": [dict(l) for l in logs],
    }), 200


@app.route("/api/admin/appointments/<int:appointment_id>/status", methods=["POST"])
@admin_required
def api_admin_update_appointment_status(appointment_id):
    payload = request.get_json(silent=True) or {}
    new_status = (payload.get("status") or "").strip().lower()
    valid_statuses = {"booked", "confirmed", "completed", "cancelled", "no_show"}
    if new_status not in valid_statuses:
        return jsonify({"success": False, "error": f"Invalid status. Choose from: {', '.join(valid_statuses)}"}), 400

    now_iso = now_local_iso()
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("UPDATE appointments SET status = ?, updated_at = ? WHERE id = ?", (new_status, now_iso, appointment_id))
        if new_status == "cancelled":
            conn.execute("UPDATE notification_logs SET status = 'cancelled' WHERE appointment_id = ? AND status IN ('scheduled', 'processing')", (appointment_id,))
            conn.execute("UPDATE customer_reminders SET status = 'cancelled', updated_at = ? WHERE last_appointment_id = ?", (now_iso, appointment_id))
        elif new_status == "completed":
            conn.execute("UPDATE customer_reminders SET status = 'active', updated_at = ? WHERE last_appointment_id = ?", (now_iso, appointment_id))
        conn.commit()

    if new_status == "cancelled":
        try:
            scheduler.remove_job(f"{appointment_id}-followup_3hr")
        except Exception:
            pass

    log_activity("appointment_status_update", f"Appointment #{appointment_id} marked as '{new_status}'")
    return jsonify({"success": True, "message": f"Appointment #{appointment_id} updated to {new_status}."}), 200


def reschedule_appointment_record(appointment_id, new_date, new_time):
    appointment = get_appointment(appointment_id)
    if not appointment:
        raise ValueError("Appointment not found.")

    duration = appointment.get("duration_minutes", 60)
    start_dt = parse_local_datetime(new_date, new_time)
    end_dt = start_dt + timedelta(minutes=duration)
    end_time_str = end_dt.strftime("%H:%M")
    followup_due_dt = end_dt + timedelta(hours=3)

    apt_date_obj = datetime.strptime(new_date, "%Y-%m-%d").date()
    first_reminder_date = add_months_safe(apt_date_obj, 1).strftime("%Y-%m-%d")

    now_iso = now_local_iso()
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            UPDATE appointments
            SET appointment_date = ?, appointment_time = ?, appointment_end_time = ?,
                followup_due_at = ?, followup_status = 'scheduled', next_reminder_date = ?,
                status = 'booked', updated_at = ?
            WHERE id = ?
            """,
            (new_date, new_time, end_time_str, followup_due_dt.isoformat(), first_reminder_date, now_iso, appointment_id),
        )
        conn.execute(
            """
            UPDATE notification_logs
            SET scheduled_for = ?, status = 'scheduled', attempts = 0, last_error = NULL
            WHERE appointment_id = ? AND notification_type = 'followup_3hr'
            """,
            (followup_due_dt.isoformat(), appointment_id),
        )
        conn.execute(
            """
            UPDATE customer_reminders
            SET last_appointment_date = ?, next_reminder_date = ?, updated_at = ?
            WHERE customer_email = ?
            """,
            (new_date, first_reminder_date, now_iso, appointment["email"].lower()),
        )
        conn.commit()

    try:
        scheduler.add_job(
            process_notification_job,
            "date",
            run_date=followup_due_dt,
            args=[appointment_id, "followup_3hr"],
            id=f"{appointment_id}-followup_3hr",
            replace_existing=True,
        )
    except Exception:
        pass

    return get_appointment(appointment_id)


@app.route("/api/admin/appointments/<int:appointment_id>/reschedule", methods=["POST"])
@admin_required
def api_admin_reschedule_appointment(appointment_id):
    payload = request.get_json(silent=True) or {}
    new_date = (payload.get("appointment_date") or "").strip()
    new_time = (payload.get("appointment_time") or "").strip()

    if not new_date or not new_time:
        return jsonify({"success": False, "error": "New appointment date and time are required."}), 400

    try:
        updated_apt = reschedule_appointment_record(appointment_id, new_date, new_time)
        log_activity("appointment_rescheduled", f"Appointment #{appointment_id} rescheduled to {new_date} at {new_time}")
        return jsonify({
            "success": True,
            "message": "Appointment rescheduled successfully.",
            "appointment": updated_apt,
        }), 200
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


@app.route("/api/admin/appointments/<int:appointment_id>/resend-email", methods=["POST"])
@admin_required
def api_admin_resend_email(appointment_id):
    appointment = get_appointment(appointment_id)
    if not appointment:
        return jsonify({"success": False, "error": "Appointment not found."}), 404

    payload = request.get_json(silent=True) or {}
    notif_type = payload.get("notification_type", "confirmation")

    try:
        send_notification_email(appointment, notif_type)
        log_activity("resend_email", f"Resent {notif_type} email for appointment #{appointment_id} to {appointment['email']}")
        return jsonify({"success": True, "message": f"{notif_type.capitalize()} email resent successfully."}), 200
    except Exception as exc:
        return jsonify({"success": False, "error": f"Failed to send email: {exc}"}), 500


# =============================================================================
# ADMIN SERVICES CRUD & BULK PRICING APIS
# =============================================================================
@app.route("/api/admin/services", methods=["GET"])
@admin_required
def api_admin_services_list():
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "SELECT * FROM services WHERE is_archived = 0 ORDER BY display_order ASC, name ASC"
        ).fetchall()
    return jsonify({"success": True, "services": [dict(r) for r in rows]}), 200


@app.route("/api/admin/services", methods=["POST"])
@admin_required
def api_admin_create_service():
    payload = request.get_json(silent=True) or {}
    slug = (payload.get("id") or "").strip().lower()
    name = (payload.get("name") or "").strip()
    price = payload.get("price")
    discount_price = payload.get("discount_price")
    duration = payload.get("duration_minutes") or 30
    category = (payload.get("category") or "Hair & Grooming").strip()
    description = (payload.get("description") or "").strip()
    image_url = (payload.get("image_url") or "").strip()
    display_order = payload.get("display_order") or 0
    is_active = 1 if payload.get("is_active", 1) else 0

    if not slug or not name or price is None:
        return jsonify({"success": False, "error": "Service ID (slug), Name, and Price are required."}), 400

    now_iso = now_local_iso()
    try:
        with sqlite3.connect(DB_PATH) as conn:
            conn.execute(
                """
                INSERT INTO services (id, name, price, discount_price, duration_minutes, category, description, image_url, is_active, display_order, is_archived, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
                """,
                (slug, name, int(price), int(discount_price) if discount_price else None, int(duration), category, description, image_url, is_active, int(display_order), now_iso, now_iso),
            )
            conn.commit()
        log_activity("create_service", f"Created new service '{name}' (₹{price})")
        return jsonify({"success": True, "message": f"Service '{name}' created successfully."}), 201
    except sqlite3.IntegrityError:
        return jsonify({"success": False, "error": f"A service with slug '{slug}' already exists."}), 400


@app.route("/api/admin/services/<service_id>", methods=["PUT"])
@admin_required
def api_admin_update_service(service_id):
    payload = request.get_json(silent=True) or {}
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        existing = conn.execute("SELECT * FROM services WHERE id = ?", (service_id,)).fetchone()
        if not existing:
            return jsonify({"success": False, "error": "Service not found."}), 404

        name = payload.get("name", existing["name"]).strip()
        price = payload.get("price", existing["price"])
        discount_price = payload.get("discount_price") if "discount_price" in payload else existing["discount_price"]
        duration = payload.get("duration_minutes", existing["duration_minutes"])
        category = payload.get("category", existing["category"])
        description = payload.get("description", existing["description"])
        image_url = payload.get("image_url", existing["image_url"])
        display_order = payload.get("display_order", existing["display_order"])
        is_active = payload.get("is_active", existing["is_active"])

        now_iso = now_local_iso()
        conn.execute(
            """
            UPDATE services
            SET name = ?, price = ?, discount_price = ?, duration_minutes = ?, category = ?, description = ?, image_url = ?, is_active = ?, display_order = ?, updated_at = ?
            WHERE id = ?
            """,
            (name, int(price), int(discount_price) if discount_price else None, int(duration), category, description, image_url, int(is_active), int(display_order), now_iso, service_id),
        )
        conn.commit()

    log_activity("update_service", f"Updated service '{name}' (#{service_id})")
    return jsonify({"success": True, "message": "Service updated successfully."}), 200


@app.route("/api/admin/services/<service_id>", methods=["DELETE"])
@admin_required
def api_admin_delete_service(service_id):
    now_iso = now_local_iso()
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("UPDATE services SET is_archived = 1, is_active = 0, updated_at = ? WHERE id = ?", (now_iso, service_id))
        conn.commit()

    log_activity("archive_service", f"Archived service '{service_id}'")
    return jsonify({"success": True, "message": "Service archived from public booking."}), 200


@app.route("/api/admin/services/bulk-prices", methods=["POST"])
@admin_required
def api_admin_bulk_update_prices():
    payload = request.get_json(silent=True) or {}
    updates = payload.get("updates") or []
    if not isinstance(updates, list):
        return jsonify({"success": False, "error": "Updates must be a list of service objects."}), 400

    now_iso = now_local_iso()
    with sqlite3.connect(DB_PATH) as conn:
        for u in updates:
            s_id = u.get("id")
            if not s_id:
                continue
            price = u.get("price")
            discount = u.get("discount_price")
            order = u.get("display_order") or 0
            is_active = 1 if u.get("is_active") else 0
            conn.execute(
                """
                UPDATE services
                SET price = ?, discount_price = ?, display_order = ?, is_active = ?, updated_at = ?
                WHERE id = ?
                """,
                (int(price) if price is not None else 0, int(discount) if discount else None, int(order), is_active, now_iso, s_id),
            )
        conn.commit()

    log_activity("bulk_price_update", f"Bulk updated pricing for {len(updates)} services")
    return jsonify({"success": True, "message": f"Successfully updated pricing for {len(updates)} services."}), 200


# =============================================================================
# ADMIN WEBSITE CONTENT CMS & PUBLIC APIS
# =============================================================================
@app.route("/api/admin/content", methods=["GET"])
@admin_required
def api_admin_get_content():
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute("SELECT key, value FROM site_content").fetchall()
    content_dict = {r["key"]: r["value"] for r in rows}
    return jsonify({"success": True, "content": content_dict}), 200


@app.route("/api/content", methods=["GET"])
def api_public_get_content():
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute("SELECT key, value FROM site_content").fetchall()
    content_dict = {r["key"]: r["value"] for r in rows}
    return jsonify({"success": True, "content": content_dict}), 200


@app.route("/api/admin/content", methods=["POST"])
@admin_required
def api_admin_save_content():
    payload = request.get_json(silent=True) or {}
    content_dict = payload.get("content") or {}
    now_iso = now_local_iso()

    with sqlite3.connect(DB_PATH) as conn:
        for k, v in content_dict.items():
            conn.execute(
                "INSERT OR REPLACE INTO site_content (key, value, updated_at) VALUES (?, ?, ?)",
                (k, str(v).strip(), now_iso),
            )
        conn.commit()

    log_activity("update_website_content", "Website CMS details updated")
    return jsonify({"success": True, "message": "Website content updated successfully."}), 200


# =============================================================================
# ADMIN GALLERY & MEDIA APIS
# =============================================================================
@app.route("/api/admin/gallery", methods=["GET"])
@admin_required
def api_admin_get_gallery():
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute("SELECT * FROM gallery_images ORDER BY display_order ASC, id DESC").fetchall()
    return jsonify({"success": True, "images": [dict(r) for r in rows]}), 200


@app.route("/api/gallery", methods=["GET"])
def api_public_get_gallery():
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute("SELECT * FROM gallery_images ORDER BY display_order ASC, id DESC").fetchall()
    return jsonify({"success": True, "images": [dict(r) for r in rows]}), 200


@app.route("/api/admin/gallery", methods=["POST"])
@admin_required
def api_admin_add_gallery():
    payload = request.get_json(silent=True) or {}
    image_url = (payload.get("image_url") or "").strip()
    caption = (payload.get("caption") or "").strip()
    order = payload.get("display_order") or 0

    if not image_url:
        return jsonify({"success": False, "error": "Image URL is required."}), 400

    now_iso = now_local_iso()
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.execute(
            "INSERT INTO gallery_images (image_url, caption, display_order, created_at) VALUES (?, ?, ?, ?)",
            (image_url, caption, int(order), now_iso),
        )
        conn.commit()
        new_id = cursor.lastrowid

    log_activity("add_gallery_image", f"Added new gallery image: {caption or image_url}")
    return jsonify({"success": True, "id": new_id, "message": "Image added to gallery."}), 201


@app.route("/api/admin/gallery/<int:image_id>", methods=["DELETE"])
@admin_required
def api_admin_delete_gallery(image_id):
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("DELETE FROM gallery_images WHERE id = ?", (image_id,))
        conn.commit()

    log_activity("delete_gallery_image", f"Deleted gallery image #{image_id}")
    return jsonify({"success": True, "message": "Image deleted from gallery."}), 200


@app.route("/api/admin/upload-image", methods=["POST"])
@admin_required
def api_admin_upload_image():
    if "image" not in request.files:
        return jsonify({"success": False, "error": "No image file provided in request."}), 400

    file = request.files["image"]
    if file.filename == "":
        return jsonify({"success": False, "error": "No selected file."}), 400

    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        return jsonify({"success": False, "error": f"Invalid file format. Allowed: {', '.join(ALLOWED_IMAGE_EXTENSIONS)}"}), 400

    file.seek(0, os.SEEK_END)
    size = file.tell()
    file.seek(0)
    if size > 10 * 1024 * 1024:
        return jsonify({"success": False, "error": "File size exceeds 10MB limit."}), 400

    clean_name = secure_filename(file.filename)
    unique_filename = f"{secrets.token_hex(6)}_{clean_name}"
    target_path = UPLOAD_DIR / unique_filename
    file.save(target_path)

    image_url = f"/uploads/{unique_filename}"
    log_activity("upload_image", f"Uploaded image: {unique_filename}")
    return jsonify({"success": True, "url": image_url, "filename": unique_filename}), 200


# =============================================================================
# ADMIN EMAIL TEMPLATES & AUTOMATION POLICIES APIS
# =============================================================================
@app.route("/api/admin/templates", methods=["GET"])
@admin_required
def api_admin_get_templates():
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute("SELECT * FROM email_templates").fetchall()

    templates_map = {r["id"]: dict(r) for r in rows}
    policies = {
        "followup_enabled": True,
        "reminders_enabled": ENABLE_MONTHLY_FOLLOWUPS,
    }
    return jsonify({"success": True, "templates": templates_map, "policies": policies}), 200


@app.route("/api/admin/templates/<template_id>", methods=["PUT"])
@admin_required
def api_admin_save_template(template_id):
    payload = request.get_json(silent=True) or {}
    subject = (payload.get("subject") or "").strip()
    body_html = payload.get("body_html") or ""

    if not subject or not body_html:
        return jsonify({"success": False, "error": "Subject and template body cannot be empty."}), 400

    now_iso = now_local_iso()
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            "UPDATE email_templates SET subject = ?, body_html = ?, updated_at = ? WHERE id = ?",
            (subject, body_html, now_iso, template_id),
        )
        conn.commit()

    log_activity("update_template", f"Updated email template '{template_id}'")
    return jsonify({"success": True, "message": f"Template '{template_id}' updated."}), 200


@app.route("/api/admin/templates/<template_id>/test", methods=["POST"])
@admin_required
def api_admin_test_template(template_id):
    payload = request.get_json(silent=True) or {}
    recipient = (payload.get("recipient") or "").strip()
    if not recipient:
        recipient = SALON_EMAIL

    simulated_apt = {
        "id": 9999,
        "name": "Pavan Kalyan (Test)",
        "email": recipient,
        "phone": "+91 98765 43210",
        "service": "Cutting + Shaving Combo (₹170)",
        "services_json": json.dumps([{"id": "combo", "name": "Cutting + Shaving Combo", "price": 170}]),
        "total_price": 170,
        "appointment_date": now_local_dt().strftime("%Y-%m-%d"),
        "appointment_time": "11:00",
        "notes": "Testing luxury template formatting from Admin Portal",
        "unsubscribe_token": "test-unsubscribe-token",
    }

    try:
        send_notification_email(simulated_apt, template_id)
        log_activity("test_email_dispatch", f"Dispatched test '{template_id}' email to {recipient}")
        return jsonify({"success": True, "message": f"Test email for '{template_id}' delivered to {recipient}."}), 200
    except Exception as exc:
        return jsonify({"success": False, "error": f"Test delivery failed: {exc}"}), 500


@app.route("/api/admin/policies", methods=["POST"])
@admin_required
def api_admin_save_policies():
    payload = request.get_json(silent=True) or {}
    global ENABLE_MONTHLY_FOLLOWUPS
    if "reminders_enabled" in payload:
        ENABLE_MONTHLY_FOLLOWUPS = bool(payload["reminders_enabled"])
    log_activity("update_policies", f"Policies updated: reminders_enabled={ENABLE_MONTHLY_FOLLOWUPS}")
    return jsonify({"success": True, "message": "Automation policies updated."}), 200


@app.route("/api/admin/activity-logs", methods=["GET"])
@admin_required
def api_admin_activity_logs():
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute("SELECT * FROM activity_logs ORDER BY id DESC LIMIT 100").fetchall()
    return jsonify({"success": True, "logs": [dict(r) for r in rows]}), 200


@app.route("/api/bookings", methods=["POST"])
def api_bookings():
    payload = request.get_json(silent=True) or {}
    try:
        appointment, validated_services, total_price = create_booking_record(payload)
        formatted_date = format_display_date(appointment["appointment_date"])
        formatted_time = format_display_time(appointment["appointment_time"])
        return jsonify({
            "success": True,
            "message": (
                f"Your appointment for {formatted_date} at {formatted_time} has been confirmed. "
                f"Total: ₹{total_price}. A confirmation email is on its way."
            ),
            "appointment_id": appointment["id"],
            "formatted_date": formatted_date,
            "formatted_time": formatted_time,
            "total_price": total_price,
            "selected_services": [
                {"id": s["id"], "name": s["name"], "price": s["price"]}
                for s in validated_services
            ],
        }), 201
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    except Exception as exc:
        app.logger.exception("Booking processing error: %s", exc)
        return jsonify({
            "success": False,
            "error": "The booking could not be saved right now. Please try again later.",
        }), 500


@app.route("/api/bookings/<int:appointment_id>/cancel", methods=["POST"])
def api_cancel_booking(appointment_id):
    """Allows cancelling an existing appointment and disarming scheduled follow-ups."""
    appointment = get_appointment(appointment_id)
    if not appointment:
        return jsonify({"success": False, "error": "Appointment not found."}), 404

    now_iso = now_local_iso()
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("UPDATE appointments SET status = 'cancelled', updated_at = ? WHERE id = ?", (now_iso, appointment_id))
        conn.execute("UPDATE notification_logs SET status = 'cancelled' WHERE appointment_id = ? AND status = 'scheduled'", (appointment_id,))
        conn.commit()

    try:
        scheduler.remove_job(f"{appointment_id}-followup_3hr")
    except Exception:
        pass

    return jsonify({"success": True, "message": "Appointment has been successfully cancelled."}), 200


@app.route("/api/bookings/<int:appointment_id>/reschedule", methods=["POST"])
def api_reschedule_booking(appointment_id):
    """Allows rescheduling an appointment and updating the follow-up and reminder timeline."""
    appointment = get_appointment(appointment_id)
    if not appointment:
        return jsonify({"success": False, "error": "Appointment not found."}), 404

    payload = request.get_json(silent=True) or {}
    new_date = (payload.get("appointment_date") or "").strip()
    new_time = (payload.get("appointment_time") or "").strip()

    if not new_date or not new_time:
        return jsonify({"success": False, "error": "Both new appointment_date and appointment_time are required."}), 400

    try:
        duration = appointment.get("duration_minutes", 60)
        start_dt = parse_local_datetime(new_date, new_time)
        end_dt = start_dt + timedelta(minutes=duration)
        end_time_str = end_dt.strftime("%H:%M")
        followup_due_dt = end_dt + timedelta(hours=3)

        apt_date_obj = datetime.strptime(new_date, "%Y-%m-%d").date()
        first_reminder_date = add_months_safe(apt_date_obj, 1).strftime("%Y-%m-%d")

        now_iso = now_local_iso()
        with sqlite3.connect(DB_PATH) as conn:
            conn.execute(
                """
                UPDATE appointments
                SET appointment_date = ?, appointment_time = ?, appointment_end_time = ?,
                    followup_due_at = ?, followup_status = 'scheduled', next_reminder_date = ?,
                    status = 'booked', updated_at = ?
                WHERE id = ?
                """,
                (new_date, new_time, end_time_str, followup_due_dt.isoformat(), first_reminder_date, now_iso, appointment_id),
            )
            # Reschedule the 3-hour follow-up in notification_logs
            conn.execute(
                """
                UPDATE notification_logs
                SET scheduled_for = ?, status = 'scheduled', attempts = 0, last_error = NULL
                WHERE appointment_id = ? AND notification_type = 'followup_3hr'
                """,
                (followup_due_dt.isoformat(), appointment_id),
            )
            # Update customer reminder
            conn.execute(
                """
                UPDATE customer_reminders
                SET last_appointment_date = ?, next_reminder_date = ?, updated_at = ?
                WHERE customer_email = ?
                """,
                (new_date, first_reminder_date, now_iso, appointment["email"].lower()),
            )
            conn.commit()

        # Update APScheduler job
        scheduler.add_job(
            process_notification_job,
            "date",
            run_date=followup_due_dt,
            args=[appointment_id, "followup_3hr"],
            id=f"{appointment_id}-followup_3hr",
            replace_existing=True,
        )

        return jsonify({
            "success": True,
            "message": f"Appointment rescheduled to {format_display_date(new_date)} at {format_display_time(new_time)}.",
        }), 200
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 400


@app.route("/unsubscribe")
@app.route("/api/reminders/unsubscribe", methods=["GET"])
def api_unsubscribe():
    """One-click opt-out endpoint for customer reminders."""
    token = (request.args.get("token") or "").strip()
    if not token:
        return "<h3>Invalid or missing unsubscribe token.</h3>", 400

    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.execute(
            "UPDATE customer_reminders SET status = 'unsubscribed', updated_at = ? WHERE unsubscribe_token = ?",
            (now_local_iso(), token),
        )
        reminders_updated = cursor.rowcount
        conn.execute(
            "UPDATE appointments SET reminder_status = 'unsubscribed', updated_at = ? WHERE unsubscribe_token = ?",
            (now_local_iso(), token),
        )
        conn.commit()

    if reminders_updated == 0:
        return "<h3>Unsubscribe link expired or not found.</h3>", 404

    base_url = get_base_url()
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Unsubscribed — {SALON_NAME}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {{ background: #0d0f12; color: #e0e4eb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }}
    .card {{ max-width: 460px; background: #161922; border: 1px solid #282e3d; border-radius: 12px; padding: 32px 24px; text-align: center; }}
    h1 {{ color: #f5d77f; font-size: 22px; margin: 0 0 12px; }}
    p {{ color: #aab4c5; font-size: 14px; line-height: 1.6; margin: 0 0 24px; }}
    a.btn {{ display: inline-block; padding: 11px 24px; background: #c5a059; color: #0e1118; font-weight: bold; text-decoration: none; border-radius: 6px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; }}
  </style>
</head>
<body>
  <div class="card">
    <h1>Opt-Out Confirmed</h1>
    <p>You have successfully unsubscribed from <strong>{SALON_NAME}</strong> monthly haircut &amp; grooming reminders. You will not receive any further recurring emails.</p>
    <a href="{base_url}" class="btn">Return to Website</a>
  </div>
</body>
</html>"""


@app.route("/api/contact", methods=["POST"])
def api_contact():
    payload = request.get_json(silent=True) or {}
    try:
        send_contact_message(payload)
        return jsonify({"success": True, "message": "Your message has been sent successfully."}), 200
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    except Exception:
        return jsonify({"success": False, "error": "Your message could not be sent right now. Please try again later."}), 500


@app.route("/api/smtp/test", methods=["POST"])
def api_smtp_test():
    try:
        send_smtp_test_email()
        return jsonify({"success": True, "message": "SMTP test email sent successfully."}), 200
    except Exception as exc:
        return jsonify({"success": False, "error": f"SMTP test failed: {exc}"}), 500


@app.route("/api/cron/process-scheduled-jobs", methods=["GET", "POST"])
def api_cron_tick():
    """
    Reliable scheduler execution webhook.
    Can be called by cloud cron (e.g. Cron-job.org, GitHub Actions, UptimeRobot, Render Cron)
    every 5 to 15 minutes to guarantee that scheduled emails are delivered even if the
    free hosting container has just woken from sleep.
    """
    secret_param = request.args.get("secret") or (request.get_json(silent=True) or {}).get("secret")
    if CRON_SECRET and secret_param != CRON_SECRET:
        return jsonify({"success": False, "error": "Unauthorized"}), 401

    try:
        check_and_process_due_jobs()
        return jsonify({
            "success": True,
            "message": "Scheduled jobs watchdog tick executed successfully.",
            "timestamp": now_local_iso(),
        }), 200
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


@app.route("/api/scheduler/status", methods=["GET"])
def api_scheduler_status():
    """Returns diagnostic status of background workers and database notifications."""
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        logs = conn.execute(
            "SELECT notification_type, status, count(*) as count FROM notification_logs GROUP BY notification_type, status"
        ).fetchall()
        reminders = conn.execute(
            "SELECT status, count(*) as count FROM customer_reminders GROUP BY status"
        ).fetchall()

    return jsonify({
        "scheduler_running": scheduler.running,
        "timezone": SALON_TIMEZONE,
        "current_local_time": now_local_iso(),
        "notification_logs_summary": [dict(r) for r in logs],
        "customer_reminders_summary": [dict(r) for r in reminders],
    }), 200


def run_startup_smtp_check():
    if not SMTP_CHECK_ON_STARTUP:
        return

    import threading

    def _check():
        try:
            send_smtp_test_email()
            app.logger.info("SMTP startup health-check email sent successfully.")
        except Exception as exc:
            app.logger.warning("SMTP startup health check failed: %s", exc)

    threading.Thread(target=_check, daemon=True).start()


# =============================================================================
# APPLICATION INITIALISATION
# =============================================================================
scheduler = BackgroundScheduler(
    timezone=SALON_TIMEZONE,
    job_defaults={"coalesce": True, "max_instances": 5, "misfire_grace_time": 3600},
)

# Recurring watchdog tick: sweeps due notifications and monthly reminders every 60 seconds
scheduler.add_job(
    check_and_process_due_jobs,
    "interval",
    minutes=1,
    id="watchdog-process-due-jobs",
    replace_existing=True,
)

scheduler.start()
init_db()
run_startup_smtp_check()
schedule_notification_jobs()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False, use_reloader=False)
