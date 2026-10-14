import json
import os
import sqlite3
import smtplib
from datetime import datetime, timedelta
from email.message import EmailMessage
from email.utils import formatdate, make_msgid
from pathlib import Path
from zoneinfo import ZoneInfo

from apscheduler.schedulers.background import BackgroundScheduler
from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_file

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
SALON_EMAIL = sanitize_env_value("SALON_EMAIL", "pavankoneti85@gmail.com")
SALON_PHONE = sanitize_env_value("SALON_PHONE", "+91 73961 44248")
SALON_MAPS_URL = sanitize_env_value("SALON_MAPS_URL", "https://maps.app.goo.gl/suHNM6yaQBY29TX8A")
SALON_TIMEZONE = sanitize_env_value("SALON_TIMEZONE", "Asia/Kolkata")
SALON_ADDRESS = sanitize_env_value("SALON_ADDRESS", "Bommuru Centre, Near NTR Statue, Rajuvolu Road, Kotta Bommuru, AP 533124, India")
SMTP_HOST = sanitize_env_value("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(sanitize_env_value("SMTP_PORT", "587"))
SMTP_EMAIL = sanitize_env_value("SMTP_EMAIL", "pavankoneti85@gmail.com")
SMTP_APP_PASSWORD = sanitize_env_value("SMTP_APP_PASSWORD", "")
SERVICE_DURATION_MINUTES = int(sanitize_env_value("SERVICE_DURATION_MINUTES", "60"))
FOLLOWUP_INTERVAL_MONTHS = int(sanitize_env_value("FOLLOWUP_INTERVAL_MONTHS", "1"))
ENABLE_MONTHLY_FOLLOWUPS = sanitize_env_value("ENABLE_MONTHLY_FOLLOWUPS", "false").lower() in {"1", "true", "yes", "on"}
MAX_EMAIL_RETRIES = int(sanitize_env_value("MAX_EMAIL_RETRIES", "3"))
SMTP_CHECK_ON_STARTUP = sanitize_env_value("SMTP_CHECK_ON_STARTUP", "true").lower() in {"1", "true", "yes", "on"}

app = Flask(__name__, static_folder=".", static_url_path="")


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
        # Ensure phone column exists for existing database instances
        cursor = conn.execute("PRAGMA table_info(appointments);")
        columns = [col[1] for col in cursor.fetchall()]
        if "phone" not in columns:
            conn.execute("ALTER TABLE appointments ADD COLUMN phone TEXT;")

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
            "CREATE INDEX IF NOT EXISTS idx_notifications_appointment ON notification_logs(appointment_id)"
        )
        conn.commit()


def now_utc_iso():
    return datetime.now(ZoneInfo(SALON_TIMEZONE)).isoformat()


def parse_local_datetime(date_text: str, time_text: str):
    tz = ZoneInfo(SALON_TIMEZONE)
    return datetime.strptime(f"{date_text} {time_text}", "%Y-%m-%d %H:%M").replace(tzinfo=tz)


def add_months(dt: datetime, months: int):
    month_index = (dt.year * 12) + (dt.month - 1) + months
    year = month_index // 12
    month = month_index % 12 + 1
    day = min(dt.day, monthrange(year, month))
    return dt.replace(year=year, month=month, day=day)


def monthrange(year: int, month: int):
    if month == 12:
        next_month = datetime(year + 1, 1, 1)
    else:
        next_month = datetime(year, month + 1, 1)
    return (next_month - timedelta(days=1)).day


def get_appointment(appointment_id):
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            "SELECT * FROM appointments WHERE id = ?",
            (appointment_id,),
        ).fetchone()
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


def send_email(destination_email: str, subject: str, plain_body: str, html_body: str = None):
    if not SMTP_HOST or not SMTP_EMAIL or not SMTP_APP_PASSWORD:
        raise RuntimeError("SMTP configuration is missing. Check the environment variables.")

    message = build_email_message(destination_email, subject, plain_body, html_body)
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.starttls()
        server.login(SMTP_EMAIL, SMTP_APP_PASSWORD)
        server.send_message(message)


def format_display_time(time_str: str) -> str:
    """Format '14:30' -> '2:30 PM', '09:00' -> '9:00 AM', '12:00' -> '12:00 PM', '00:00' -> '12:00 AM'."""
    if not time_str:
        return ""
    try:
        t = datetime.strptime(time_str.strip(), "%H:%M")
        return t.strftime("%I:%M %p").lstrip("0")
    except Exception:
        return time_str


def format_display_date(date_str: str) -> str:
    """Format '2026-10-15' -> 'October 15, 2026'."""
    if not date_str:
        return ""
    try:
        d = datetime.strptime(date_str.strip(), "%Y-%m-%d")
        return f"{d.strftime('%B')} {d.day}, {d.year}"
    except Exception:
        return date_str


def make_html_template(title, badge_text, badge_bg, headline, intro_text, details_dict, footer_note=""):
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

    footer_note_html = f'<p style="margin:0 0 16px; font-size:13px; line-height:1.5; color:#95a1b5;">{footer_note}</p>' if footer_note else ""

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
        <p style="margin:0; font-size:12px; color:#8e99ac; letter-spacing:1px; text-transform:uppercase;">Luxury Barbershop & Styling · Bommuru</p>
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
      </td>
    </tr>
  </table>
</body>
</html>"""


def send_smtp_test_email():
    test_subject = f"SMTP Health Check – {SALON_NAME}"
    now_formatted = datetime.now(ZoneInfo(SALON_TIMEZONE)).strftime("%B %d, %Y at %I:%M %p %Z").replace(" 0", " ")
    test_body = (
        "This is an automated SMTP health-check message from the salon booking system.\n\n"
        "If you received this email, the configured Gmail SMTP connection is working correctly.\n\n"
        f"Google Maps: {SALON_MAPS_URL}\n"
        f"Address: {SALON_ADDRESS}\n"
        f"Sent at: {now_formatted}\n"
    )
    test_html = make_html_template(
        title="SMTP Health Check",
        badge_text="System Active",
        badge_bg="#c5a059",
        headline="SMTP Connection Verified",
        intro_text="This is an automated health-check from the Sri Devi One Saloon booking system. The Gmail SMTP service is active and ready to deliver appointment notifications.",
        details_dict={
            "System Status": "Online & Operational",
            "SMTP Host": SMTP_HOST,
            "Sent At": now_formatted,
        },
        footer_note="All automated confirmations, 1-hour reminders, thank-you messages, and follow-ups will be sent via this connection."
    )
    send_email(SALON_EMAIL, test_subject, test_body, test_html)


def make_confirmation_body(appointment):
    formatted_date = format_display_date(appointment["appointment_date"])
    formatted_time = format_display_time(appointment["appointment_time"])
    notes_line = f"Notes: {appointment['notes']}\n" if appointment.get("notes") else ""
    return (
        f"Hello {appointment['name']},\n\n"
        f"Your appointment has been successfully confirmed!\n\n"
        f"Service: {appointment['service']}\n"
        f"Date: {formatted_date}\n"
        f"Time: {formatted_time}\n"
        f"{notes_line}\n"
        f"--- SALON LOCATION ---\n"
        f"Address: {SALON_ADDRESS}\n"
        f"Google Maps Directions: {SALON_MAPS_URL}\n\n"
        f"We look forward to welcoming you to {SALON_NAME}.\n\n"
        f"Thank you for choosing us!\n\n"
        f"{SALON_NAME}\n"
        f"Directions: {SALON_MAPS_URL}"
    )


def make_confirmation_html(appointment):
    formatted_date = format_display_date(appointment["appointment_date"])
    formatted_time = format_display_time(appointment["appointment_time"])
    details = {
        "Service": appointment["service"],
        "Date": formatted_date,
        "Time": formatted_time,
    }
    if appointment.get("notes"):
        details["Notes"] = appointment["notes"]

    return make_html_template(
        title="Appointment Confirmed",
        badge_text="Booking Confirmed",
        badge_bg="#c5a059",
        headline=f"Your Appointment Is Confirmed, {appointment['name']}!",
        intro_text=f"Your appointment has been successfully confirmed. We look forward to welcoming you to {SALON_NAME}.",
        details_dict=details,
        footer_note="We look forward to welcoming you to Sri Devi One Saloon. Thank you for choosing us!"
    )


def make_reminder_body(appointment):
    formatted_date = format_display_date(appointment["appointment_date"])
    formatted_time = format_display_time(appointment["appointment_time"])
    return (
        f"Hello {appointment['name']},\n\n"
        f"This is a reminder that your {appointment['service']} appointment is scheduled for {formatted_date} at {formatted_time} (India time).\n\n"
        f"--- SALON LOCATION & DIRECTIONS ---\n"
        f"Address: {SALON_ADDRESS}\n"
        f"Google Maps Location: {SALON_MAPS_URL}\n\n"
        f"Please plan to arrive 10-15 minutes early.\n\n"
        f"We look forward to welcoming you to {SALON_NAME}!\n\n"
        f"Thank you,\n"
        f"{SALON_NAME}\n"
        f"Directions: {SALON_MAPS_URL}"
    )


def make_reminder_html(appointment):
    formatted_date = format_display_date(appointment["appointment_date"])
    formatted_time = format_display_time(appointment["appointment_time"])
    details = {
        "Service": appointment["service"],
        "Date": formatted_date,
        "Time": formatted_time,
    }
    return make_html_template(
        title="Appointment Reminder",
        badge_text="Starting in 1 Hour",
        badge_bg="#e5a93b",
        headline=f"Upcoming Appointment Reminder, {appointment['name']}!",
        intro_text=f"This is a quick reminder that your appointment at {SALON_NAME} begins in approximately 1 hour.",
        details_dict=details,
        footer_note="Please plan to arrive 10-15 minutes early. We look forward to welcoming you!"
    )


def make_thankyou_body(appointment):
    formatted_date = format_display_date(appointment["appointment_date"])
    formatted_time = format_display_time(appointment["appointment_time"])
    start_dt = parse_local_datetime(appointment["appointment_date"], appointment["appointment_time"])
    end_dt = start_dt + timedelta(minutes=SERVICE_DURATION_MINUTES)
    formatted_end_time = end_dt.strftime("%I:%M %p").lstrip("0")
    return (
        f"Hello {appointment['name']},\n\n"
        f"Thank you for visiting {SALON_NAME}! We hope you enjoyed your {appointment['service']} service.\n\n"
        f"Your appointment was on {formatted_date} from {formatted_time} to {formatted_end_time}.\n\n"
        f"--- SALON LOCATION ---\n"
        f"Address: {SALON_ADDRESS}\n"
        f"Google Maps Location: {SALON_MAPS_URL}\n\n"
        f"We would love to welcome you again soon. Thank you for choosing us!\n\n"
        f"Warm regards,\n"
        f"{SALON_NAME}\n"
        f"Directions: {SALON_MAPS_URL}"
    )


def make_thankyou_html(appointment):
    formatted_date = format_display_date(appointment["appointment_date"])
    formatted_time = format_display_time(appointment["appointment_time"])
    start_dt = parse_local_datetime(appointment["appointment_date"], appointment["appointment_time"])
    end_dt = start_dt + timedelta(minutes=SERVICE_DURATION_MINUTES)
    formatted_end_time = end_dt.strftime("%I:%M %p").lstrip("0")
    details = {
        "Service Completed": appointment["service"],
        "Date": formatted_date,
        "Time": f"{formatted_time} – {formatted_end_time}",
    }
    return make_html_template(
        title="Thank You for Visiting",
        badge_text="Thank You",
        badge_bg="#70c070",
        headline=f"Thank You for Visiting Us, {appointment['name']}!",
        intro_text=f"We hope you love your fresh look and enjoyed your grooming session at {SALON_NAME}.",
        details_dict=details,
        footer_note="We appreciate your trust and look forward to welcoming you back again soon!"
    )


def make_followup_body(appointment):
    formatted_date = format_display_date(appointment["appointment_date"])
    return (
        f"Hello {appointment['name']},\n\n"
        f"We hope you are enjoying your look from {SALON_NAME}!\n\n"
        f"It has been a month since your last {appointment['service']} appointment on {formatted_date}, and we would love to welcome you back for your next visit.\n\n"
        f"--- SALON LOCATION ---\n"
        f"Address: {SALON_ADDRESS}\n"
        f"Google Maps Location: {SALON_MAPS_URL}\n\n"
        f"Book your next appointment whenever you are ready on our website.\n\n"
        f"Warm regards,\n"
        f"{SALON_NAME}\n"
        f"Directions: {SALON_MAPS_URL}"
    )


def make_followup_html(appointment):
    formatted_date = format_display_date(appointment["appointment_date"])
    details = {
        "Last Service": appointment["service"],
        "Last Visit Date": formatted_date,
    }
    return make_html_template(
        title="Time for a Haircut Refresh?",
        badge_text="1 Month Refresh",
        badge_bg="#c5a059",
        headline=f"Time for a Refresh, {appointment['name']}?",
        intro_text=f"It has been a month since your last haircut at {SALON_NAME}. Regular grooming keeps your style sharp and well-maintained.",
        details_dict=details,
        footer_note="Book your next slot whenever you are ready on our website."
    )


def make_owner_booking_body(appointment):
    phone = appointment.get("phone") or "Not provided"
    formatted_date = format_display_date(appointment["appointment_date"])
    formatted_time = format_display_time(appointment["appointment_time"])
    return (
        f"A new appointment booking was received for {SALON_NAME}.\n\n"
        f"--- CUSTOMER INFORMATION ---\n"
        f"Customer Name: {appointment['name']}\n"
        f"Customer Phone: {phone}\n"
        f"Customer Email: {appointment['email']}\n\n"
        f"--- APPOINTMENT DETAILS ---\n"
        f"Service: {appointment['service']}\n"
        f"Date: {formatted_date} ({appointment['appointment_date']})\n"
        f"Time: {formatted_time} ({appointment['appointment_time']})\n"
        f"Notes: {appointment['notes'] or 'None'}\n\n"
        f"Salon Location: {SALON_ADDRESS}\n"
        f"Google Maps: {SALON_MAPS_URL}\n"
    )


def make_owner_booking_html(appointment):
    phone = appointment.get("phone") or "Not provided"
    formatted_date = format_display_date(appointment["appointment_date"])
    formatted_time = format_display_time(appointment["appointment_time"])
    details = {
        "Customer Name": appointment["name"],
        "Customer Phone": phone,
        "Customer Email": appointment["email"],
        "Service": appointment["service"],
        "Date": f"{formatted_date}",
        "Time": f"{formatted_time}",
        "Notes": appointment["notes"] or "None",
    }
    return make_html_template(
        title="New Appointment Booking",
        badge_text="New Booking",
        badge_bg="#e5a93b",
        headline="New Appointment Received!",
        intro_text="A customer has booked an appointment online through the website. Here are the booking details:",
        details_dict=details,
        footer_note="Ensure the slot is reserved and contact the customer if any schedule adjustment is needed."
    )


def email_body_for_type(appointment, notification_type):
    if notification_type == "confirmation":
        return make_confirmation_body(appointment)
    if notification_type == "reminder":
        return make_reminder_body(appointment)
    if notification_type == "thank_you":
        return make_thankyou_body(appointment)
    if notification_type == "followup":
        return make_followup_body(appointment)
    return f"Hello {appointment['name']}\n\nThank you for choosing {SALON_NAME}."


def email_html_for_type(appointment, notification_type):
    if notification_type == "confirmation":
        return make_confirmation_html(appointment)
    if notification_type == "reminder":
        return make_reminder_html(appointment)
    if notification_type == "thank_you":
        return make_thankyou_html(appointment)
    if notification_type == "followup":
        return make_followup_html(appointment)
    return None


def send_notification_email(appointment, notification_type):
    if notification_type == "owner_booking":
        send_email(
            SALON_EMAIL,
            f"New Appointment Booking – {SALON_NAME}",
            make_owner_booking_body(appointment),
            make_owner_booking_html(appointment),
        )
        return

    subject_map = {
        "confirmation": f"Your Appointment Is Confirmed – {SALON_NAME}",
        "reminder": f"Appointment Reminder – {SALON_NAME}",
        "thank_you": f"Thank You for Visiting {SALON_NAME}",
        "followup": f"We Would Love to See You Again – {SALON_NAME}",
    }
    body = email_body_for_type(appointment, notification_type)
    html_body = email_html_for_type(appointment, notification_type)
    send_email(appointment["email"], subject_map.get(notification_type, f"Update from {SALON_NAME}"), body, html_body)


def schedule_owner_notification_jobs():
    with sqlite3.connect(DB_PATH) as conn:
        rows = conn.execute(
            """
            SELECT appointment_id, scheduled_for
            FROM notification_logs
            WHERE notification_type = 'owner_booking'
              AND status IN ('scheduled', 'failed')
              AND attempts < ?
            """,
            (MAX_EMAIL_RETRIES,),
        ).fetchall()

    for appointment_id, scheduled_for in rows:
        scheduler.add_job(
            process_notification_job,
            "date",
            run_date=datetime.fromisoformat(scheduled_for),
            args=[appointment_id, "owner_booking"],
            id=f"{appointment_id}-owner_booking",
            replace_existing=True,
        )


def schedule_notification_jobs():
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        appointments = conn.execute(
            "SELECT * FROM appointments WHERE status IN ('booked', 'confirmed', 'completed') ORDER BY created_at"
        ).fetchall()

    for appointment in appointments:
        apt = dict(appointment)
        date_text = apt["appointment_date"]
        time_text = apt["appointment_time"]
        start_dt = parse_local_datetime(date_text, time_text)

        notifications = {
            "reminder": start_dt - timedelta(hours=1),
            "thank_you": start_dt + timedelta(minutes=SERVICE_DURATION_MINUTES),
        }

        if ENABLE_MONTHLY_FOLLOWUPS:
            followup_dt = add_months(start_dt, FOLLOWUP_INTERVAL_MONTHS)
            notifications["followup"] = followup_dt

        for notification_type, run_dt in notifications.items():
            row = notification_status(apt["id"], notification_type)
            if row and row[0] == "sent":
                continue
            if row and row[2]:
                existing_dt = datetime.fromisoformat(row[2])
                if existing_dt == run_dt:
                    continue

            upsert_notification(apt["id"], notification_type, run_dt, status="scheduled", attempts=0, last_error=None)
            scheduler.add_job(
                process_notification_job,
                "date",
                run_date=run_dt,
                args=[apt["id"], notification_type],
                id=f"{apt['id']}-{notification_type}",
                replace_existing=True,
            )


def process_notification_job(appointment_id, notification_type):
    appointment = get_appointment(appointment_id)
    if not appointment:
        return

    row = notification_status(appointment_id, notification_type)
    if row and row[0] == "sent":
        return

    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            INSERT INTO notification_logs (appointment_id, notification_type, scheduled_for, status, attempts, last_error)
            VALUES (?, ?, ?, 'scheduled', 0, NULL)
            ON CONFLICT(appointment_id, notification_type) DO NOTHING
            """,
            (appointment_id, notification_type, datetime.now(ZoneInfo(SALON_TIMEZONE)).isoformat()),
        )
        conn.commit()

    try:
        send_notification_email(appointment, notification_type)
    except Exception as exc:  # pragma: no cover - runtime safety branch
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
            retry_dt = datetime.now(ZoneInfo(SALON_TIMEZONE)) + timedelta(minutes=5)
            scheduler.add_job(
                process_notification_job,
                "date",
                run_date=retry_dt,
                args=[appointment_id, notification_type],
                id=f"retry-{appointment_id}-{notification_type}",
                replace_existing=True,
            )
        return

    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            "UPDATE notification_logs SET sent_at = ?, status = 'sent', last_error = NULL WHERE appointment_id = ? AND notification_type = ?",
            (now_utc_iso(), appointment_id, notification_type),
        )
        if notification_type == "confirmation":
            conn.execute(
                "UPDATE appointments SET status = 'confirmed', updated_at = ? WHERE id = ?",
                (now_utc_iso(), appointment_id),
            )
        conn.commit()


def create_booking_record(data):
    phone = (data.get("phone") or "").strip()
    if not data.get("name") or not data.get("email") or not phone or not data.get("service") or not data.get("appointment_date") or not data.get("appointment_time"):
        raise ValueError("Missing required booking data. Please provide name, phone number, email, service, date, and time.")

    with sqlite3.connect(DB_PATH) as conn:
        now = now_utc_iso()
        cursor = conn.execute(
            """
            INSERT INTO appointments (name, email, phone, service, appointment_date, appointment_time, notes, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'booked', ?, ?)
            """,
            (
                data["name"].strip(),
                data["email"].strip(),
                phone,
                data["service"].strip(),
                data["appointment_date"],
                data["appointment_time"],
                (data.get("notes") or "").strip(),
                now,
                now,
            ),
        )
        appointment_id = cursor.lastrowid
        schedule_at = datetime.now(ZoneInfo(SALON_TIMEZONE)) + timedelta(seconds=5)
        conn.execute(
            """
            INSERT INTO notification_logs (appointment_id, notification_type, scheduled_for, status, attempts, last_error)
            VALUES (?, 'confirmation', ?, 'scheduled', 0, NULL)
            ON CONFLICT(appointment_id, notification_type) DO NOTHING
            """,
            (appointment_id, schedule_at.isoformat()),
        )
        conn.execute(
            """
            INSERT INTO notification_logs (appointment_id, notification_type, scheduled_for, status, attempts, last_error)
            VALUES (?, 'owner_booking', ?, 'scheduled', 0, NULL)
            ON CONFLICT(appointment_id, notification_type) DO NOTHING
            """,
            (appointment_id, schedule_at.isoformat()),
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

    scheduler.add_job(
        process_notification_job,
        "date",
        run_date=schedule_at,
        args=[appointment_id, "confirmation"],
        id=f"{appointment_id}-confirmation",
        replace_existing=True,
    )
    schedule_owner_notification_jobs()
    schedule_notification_jobs()
    return appointment


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
        footer_note="Reply directly to the customer's email address."
    )
    send_email(SALON_EMAIL, f"Website enquiry: {subject}", body, html)


@app.after_request
def add_no_cache_headers(response):
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response


@app.route("/")
def index():
    return send_file(BASE_DIR / "index.html")


@app.route("/api/bookings", methods=["POST"])
def api_bookings():
    payload = request.get_json(silent=True) or {}
    try:
        appointment = create_booking_record(payload)
        formatted_date = format_display_date(appointment["appointment_date"])
        formatted_time = format_display_time(appointment["appointment_time"])
        return jsonify({
            "success": True,
            "message": f"Your appointment for {formatted_date} at {formatted_time} has been received. A confirmation email is on its way.",
            "appointment_id": appointment["id"],
            "formatted_date": formatted_date,
            "formatted_time": formatted_time,
        }), 201
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"success": False, "error": "The booking could not be saved right now. Please try again later."}), 500


@app.route("/api/contact", methods=["POST"])
def api_contact():
    payload = request.get_json(silent=True) or {}
    try:
        send_contact_message(payload)
        return jsonify({"success": True, "message": "Your message has been sent successfully."}), 200
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"success": False, "error": "Your message could not be sent right now. Please try again later."}), 500


@app.route("/api/smtp/test", methods=["POST"])
def api_smtp_test():
    try:
        send_smtp_test_email()
        return jsonify({"success": True, "message": "SMTP test email sent successfully."}), 200
    except Exception as exc:
        return jsonify({"success": False, "error": f"SMTP test failed: {exc}"}), 500


def run_startup_smtp_check():
    if not SMTP_CHECK_ON_STARTUP:
        return
    try:
        send_smtp_test_email()
        app.logger.info("SMTP startup health-check email sent successfully.")
    except Exception as exc:
        app.logger.warning("SMTP startup health check failed: %s", exc)


scheduler = BackgroundScheduler(
    timezone=SALON_TIMEZONE,
    job_defaults={"coalesce": True, "max_instances": 5, "misfire_grace_time": 3600}
)
scheduler.start()
init_db()
run_startup_smtp_check()
schedule_notification_jobs()
schedule_owner_notification_jobs()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False, use_reloader=False)
