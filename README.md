# Sri Devi One Saloon — Automated Appointment System

This project keeps the original salon design and adds a Python + Flask backend for secure appointment booking, email confirmations, and reminder scheduling.

## Project Structure

```text
sridevionesaloon-main/
├── app.py
├── requirements.txt
├── .env.example
├── .gitignore
├── index.html
├── css/
├── js/
├── assets/
├── data/
│   └── appointments.db
└── README.md
```

## What was added

- Flask backend to serve the salon site and booking APIs
- SQLite database for appointment and notification records
- Gmail SMTP email delivery
- APScheduler reminders for confirmation, appointment reminder, thank-you email, and monthly follow-ups
- A new-booking email alert to the salon owner at `SALON_EMAIL`
- Secure env-based configuration with `python-dotenv`
- Contact form and booking form updated to use email, not public phone numbers

## Run locally

1. Create a virtual environment and install dependencies:

```bash
python -m venv .venv
. .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

2. Copy `.env.example` to `.env` and fill in your SMTP details.

3. Start the app:

```bash
python app.py
```

4. Open `http://localhost:5000` in the browser.

## Environment variables

The app reads settings from a `.env` file. Example values are provided in `.env.example`.

Required values:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_EMAIL`
- `SMTP_APP_PASSWORD`
- `SALON_TIMEZONE`
- `SALON_EMAIL`
- `FOLLOWUP_INTERVAL_MONTHS`
- `ENABLE_MONTHLY_FOLLOWUPS`

`SALON_EMAIL` receives contact-form messages and an email alert for each new booking. Customers continue to receive booking confirmations and appointment reminders at the email address they submit.

## Gmail setup

- Enable 2-Step Verification on your Google account.
- Generate an app password in Google account security settings.
- Use the app password in `SMTP_APP_PASSWORD` without spaces.
- The app automatically sends a startup SMTP health-check email if `SMTP_CHECK_ON_STARTUP=true`.
- You can also trigger a manual health check with a POST request to `/api/smtp/test`.
- Never commit `.env` files or credentials to source control.

## Hosting guidance

A free always-on hosting option that can run scheduled jobs reliably is difficult to guarantee. The safest free practical approach is:

- Use Render, Railway, or a small always-on VPS that keeps the Flask app running continuously
- Keep SQLite on a persistent volume or writable directory
- Expect scheduled jobs to pause during cold starts or restarts and rebuild from SQLite on startup
- Set a realistic resource limit and storage plan for your provider

If no free always-on host is available, use a small local computer or a low-cost VPS that runs the Flask app 24/7. This preserves a single scheduler instance and keeps SQLite data available between restarts.

## Notes

- Public phone numbers were removed from the customer-facing website.
- The salon address, Google Maps link, and opening information remain in place.
- The website does not expose SMTP credentials to the browser.
- Notification schedules are reconstructed from SQLite after backend restarts.
- Owner booking alerts are queued in SQLite-backed notification records and retried using the configured email retry limit.
