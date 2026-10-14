# Sri Devi One Saloon — Automated Appointment System & Website

> Premium hair salon and barber shop website and automated appointment booking system for **Sri Devi One Saloon**, Bommuru, Kotta Bommuru, Andhra Pradesh 533124.

---

## Overview

This project provides a modern, responsive website combined with a robust Python + Flask backend. It supports automated appointment scheduling, instant customer email confirmations, salon owner notifications, and background reminder jobs using APScheduler and SQLite.

---

## Project Structure

```text
sridevionesaloon-main/
├── app.py                     # Flask application & background scheduler
├── requirements.txt           # Python dependencies
├── .env.example               # Template for environment variables
├── .gitignore                 # Git ignore rules for virtualenv, db, and secrets
├── index.html                 # Main website template
├── css/
│   └── style.css              # Custom styling & responsive layouts
├── js/
│   └── script.js              # Client-side validation, UI interactions, and API calls
├── assets/                    # Salon photos, branding, and images
│   ├── logo.png               # Official salon logo
│   ├── logo.jpeg              # Alternate format logo
│   ├── pavan_dad.png          # Founder/Stylist hero image
│   ├── fullfacial.jpeg        # Full facial service showcase
│   ├── lightfacial.jpeg       # Light facial service showcase
│   ├── tanpack.jpeg           # Tan pack service showcase
│   └── img.jpeg               # Salon showcase image
├── data/
│   └── appointments.db        # SQLite database for bookings & notifications
└── README.md                  # Project documentation
```

---

## Features & What Was Added

- **Modern Luxury Barbershop Aesthetic**: Deep charcoal background, warm antique gold accents, Playfair Display and Inter typography.
- **Flask Backend API**: Serves the website and handles `/api/bookings`, `/api/contact`, and `/api/smtp/test`.
- **Automated Email Notifications**:
  - Immediate booking confirmation sent to the customer.
  - New booking email alert sent to the salon owner (`SALON_EMAIL`).
  - Scheduled appointment reminders before the visit.
  - Follow-up and thank-you emails via APScheduler.
- **Persistent Database**: SQLite storage (`data/appointments.db`) ensures all booking records and reminder schedules survive application restarts.
- **Interactive Modals & UI**:
  - Welcome popup modal with service highlights.
  - Interactive price list filters (Hair & Grooming, Skin Care).
  - Client-side form validation with accessible error messaging.
- **Privacy & Security**:
  - Personal phone numbers kept private from public source code.
  - Secure credential storage using `python-dotenv`.

---

## Getting Started Locally

### 1. Prerequisites
- Python 3.10 or higher
- Git

### 2. Set Up Virtual Environment

```bash
# Navigate to the project directory
cd sridevionesaloon-main

# Create virtual environment
python -m venv .venv

# Activate virtual environment
# On Windows (PowerShell):
.\.venv\Scripts\Activate.ps1
# On Windows (Command Prompt):
.\.venv\Scripts\activate.bat
# On Linux/macOS:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Configure Environment Variables

Create a `.env` file in the root directory (or copy from `.env.example`):

```bash
cp .env.example .env
```

Fill in your configuration:

```ini
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_EMAIL=your-gmail@gmail.com
SMTP_APP_PASSWORD=your-google-app-password
SALON_TIMEZONE=Asia/Kolkata
SALON_NAME=Sri Devi One Saloon
SALON_EMAIL=salon-owner@gmail.com
SALON_ADDRESS=Bommuru Centre, Near NTR Statue, Rajuvolu Road, Kotta Bommuru, AP 533124, India
SALON_PHONE=+91 73961 44248
SALON_MAPS_URL=https://maps.app.goo.gl/suHNM6yaQBY29TX8A
SERVICE_DURATION_MINUTES=60
FOLLOWUP_INTERVAL_MONTHS=1
ENABLE_MONTHLY_FOLLOWUPS=false
MAX_EMAIL_RETRIES=3
SMTP_CHECK_ON_STARTUP=true
```

### 4. Run the Application

```bash
python app.py
```

Open your browser and navigate to:
```
http://localhost:5000
```

---

## Gmail SMTP Setup Guide

1. Log into your Google Account and go to **Security** settings.
2. Enable **2-Step Verification**.
3. Under 2-Step Verification, select **App passwords**.
4. Generate a new App Password for "Mail" / "Custom" (e.g. `Sri Devi Saloon`).
5. Copy the 16-character password into `SMTP_APP_PASSWORD` in your `.env` (without spaces).
6. When `SMTP_CHECK_ON_STARTUP=true`, the app will verify the SMTP connection when starting.

---

## Deploying to Render (Important: Read If Using Render)

### Why standard SMTP fails on Render Free Tier
Render **blocks outbound traffic on ports 25, 465, and 587 on all Free-tier services** to prevent spam. Attempting to connect to `smtp.gmail.com:587` from Render's free tier will result in a connection timeout (`ETIMEDOUT`).

### Solution 1: Use an HTTP Email API (100% Free on Render)
Because Render allows standard HTTPS traffic (**Port 443**), the application supports sending emails via REST API:

1. **Option A — Resend** (Recommended, 3,000 free emails/mo):
   - Sign up at [resend.com](https://resend.com) and generate a free API key.
   - In Render Dashboard under **Environment**, add:
     `RESEND_API_KEY=re_your_api_key_here`
     `EMAIL_SENDER=Sri Devi One Saloon <onboarding@resend.dev>`

2. **Option B — Brevo** (300 free emails/day):
   - Sign up at [brevo.com](https://brevo.com) and generate an API key.
   - In Render Dashboard under **Environment**, add:
     `BREVO_API_KEY=xkeysib-your_api_key_here`

### Solution 2: If using a Paid Render Plan ($7/mo Starter)
Paid Render plans unblock outbound ports 587 and 465. To use Gmail SMTP on a paid plan:
1. In Render Dashboard -> Web Service -> **Environment**, add these variables:
   - `SMTP_HOST`: `smtp.gmail.com`
   - `SMTP_PORT`: `587`
   - `SMTP_EMAIL`: `pavankoneti85@gmail.com`
   - `SMTP_APP_PASSWORD`: `your-16-char-app-password`
   - `SALON_EMAIL`: `pavankoneti85@gmail.com`
   - `SALON_NAME`: `Sri Devi One Saloon`
   - `SALON_TIMEZONE`: `Asia/Kolkata`
   - `SMTP_CHECK_ON_STARTUP`: `false`

### Render Build & Start Commands
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `gunicorn app:app` (or `python app.py`)

---

## Business Details

| Detail | Information |
|--------|-------------|
| **Saloon Name** | Sri Devi One Saloon |
| **Address** | Bommuru Centre, Near NTR Statue, Rajuvolu Road, Kotta Bommuru, Andhra Pradesh 533124 |
| **Google Maps** | [View on Google Maps](https://maps.app.goo.gl/aBQx16ErauUBKbtz6) |
| **Rating** | 5.0 ★ Google Rating |

---

## Technology Stack

- **Backend**: Python 3, Flask, APScheduler, SQLite3, python-dotenv, pytz
- **Frontend**: HTML5, CSS3 (CSS Custom Properties, Flexbox, Grid), Vanilla JavaScript (ES6+)
- **Icons & Fonts**: Lucide Icons, Google Fonts (Playfair Display, Inter, Noto Sans Telugu)

---

## License & Notes

*© 2026 Sri Devi One Saloon. All rights reserved.*
