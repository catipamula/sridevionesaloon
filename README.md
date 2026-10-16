# Sri Devi One Saloon — Automated Appointment Booking & Scheduled Notifications

> Premium hair salon and barber shop appointment booking platform for **Sri Devi One Saloon**, Bommuru Centre, Rajahmundry Rural, Andhra Pradesh 533124.

---

## 🌟 Key Features

### 1. Multi-Service Card Selection (No Dropdown)
- Replaced the single-select dropdown with individual, responsive selectable cards for every service.
- Customers can select **one service or multiple services** in the same appointment booking.
- Selected services feature dark-luxury gold borders, highlighted background tint, and animated checkmarks.
- Customers can deselect any service at any time with a single tap/click.
- Keyboard accessible (`Tab` to navigate, `Space` to toggle, `aria-checked` attributes).

### 2. Live Dynamic Total Price Calculation
- The total estimated price updates immediately whenever a service is selected or deselected without refreshing the page.
- Shows real-time service count, individual service prices, and formatted total amount.
- **Backend Price Integrity**: All totals are recalculated and verified strictly on the backend using authoritative salon prices (`AUTHORITATIVE_SERVICES`). Client-tampered totals are automatically rejected.
- Form submission is prevented if no services are selected.

| Service | Canonical Price | Duration |
|---|---:|---:|
| **Cutting** | ₹120 | 30 mins |
| **Shaving** | ₹70 | 20 mins |
| **Cutting + Shaving Combo** | ₹170 | 45 mins |
| **Scrub** | ₹100 | 20 mins |
| **Tan Pack** | ₹150 | 30 mins |
| **Lite Facial** | ₹250 | 45 mins |
| **Full Facial** | ₹600 | 60 mins |

### 3. Immediate Confirmation Email
- Dispatched automatically upon appointment creation.
- Formatted with Sri Devi One Saloon branding, customer name, date, time, estimated duration, itemized services table with individual prices, total amount, and salon Google Maps directions.
- Subject: `Your Appointment Is Confirmed — Sri Devi One Saloon`
- Sent via salon owner's configured Gmail SMTP account with automatic HTTP API fallback (Resend/Brevo) if ports are blocked.
- Simultaneously alerts the salon owner at `SALON_EMAIL` with full customer contact information.

### 4. 3-Hour Post-Visit Follow-Up Email
- Scheduled for **exactly 3 hours after the appointment end time** (`start_time + service_duration + 3 hours`), rather than 3 hours after booking submission.
- Subject: `Thank You for Visiting Sri Devi One Saloon!`
- Includes visit recap, customer appreciation, salon Google Maps link, and direct reminder opt-out link.
- Automatically disarmed if an appointment is cancelled or rescheduled.

### 5. Recurring Monthly Grooming Reminder
- Automatically schedules the first recurring reminder for **one month after the completed appointment date**.
- **Safe End-of-Month Calculation**: Correctly clamps to the last day of shorter months (e.g., Jan 31 -> Feb 28 in normal years or Feb 29 in leap years; Aug 31 -> Sep 30).
- Advances monthly after each successful delivery.
- Subject: `It's Time for Your Next Haircut — Sri Devi One Saloon!`
- Includes one-click booking link and salon location.
- **Smart Rescheduling**: If an existing customer books a new appointment, their reminder schedule automatically resets to 1 month after the new appointment date.
- **Opt-Out / Unsubscribe**: Every email contains a secure tokenized link to `/unsubscribe?token=...` allowing instant opt-out.

### 6. Background Scheduling & Reliability
- Powered by APScheduler with persistent SQLite storage (`data/appointments.db`).
- Watchdog job runs every 60 seconds to process due follow-ups and monthly reminders.
- **Idempotency & Duplicate Prevention**: Atomic state locking in SQLite prevents duplicate email deliveries even under concurrent worker triggers.
- Webhook trigger endpoint at `/api/cron/process-scheduled-jobs` allows cloud schedulers (cron-job.org, GitHub Actions, UptimeRobot) to wake sleeping free-tier servers.

---

## 📁 Project Structure

```text
sridevionesaloon-main/
├── app.py                         # Flask backend, pricing logic, email transport, & scheduler
├── requirements.txt               # Dependencies: Flask, APScheduler, python-dotenv, gunicorn
├── .env.example                   # Environment configuration template
├── render.yaml                    # Render Blueprint deployment configuration
├── index.html                     # Frontend website with multi-service card grid
├── css/
│   └── style.css                  # Dark luxury styling, card grid, & live price bar
├── js/
│   └── script.js                  # Dynamic pricing, multi-selection, & API communication
├── data/
│   └── appointments.db            # SQLite database (appointments, notification logs, reminders)
├── test_booking_automation.py     # Comprehensive automated test suite
├── push_to_github.ps1             # Automated GitHub synchronization script
└── README.md                      # Documentation
```

---

## ⚙️ Environment Variables

Copy `.env.example` to `.env` and configure:

```ini
# Application URL for booking & unsubscribe links
APP_URL=https://sridevionesaloon.onrender.com

# Primary: Gmail SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_EMAIL=pavankoneti85@gmail.com
SMTP_APP_PASSWORD=your-16-char-google-app-password
SMTP_CHECK_ON_STARTUP=false

# Fallback HTTP APIs (Essential for Render Free Tier port 587 block)
RESEND_API_KEY=
BREVO_API_KEY=
EMAIL_SENDER=Sri Devi One Saloon <onboarding@resend.dev>

# Salon Business Details
SALON_NAME=Sri Devi One Saloon
SALON_EMAIL=chakravarthy.atipamula@gmail.com
SALON_PHONE=+91 73961 44248
SALON_ADDRESS=Bommuru Centre, Near NTR Statue, Rajuvolu Road, Kotta Bommuru, AP 533124, India
SALON_MAPS_URL=https://maps.app.goo.gl/suHNM6yaQBY29TX8A
SALON_TIMEZONE=Asia/Kolkata

# Automation Policies
SERVICE_DURATION_MINUTES=60
ENABLE_MONTHLY_FOLLOWUPS=true
MAX_EMAIL_RETRIES=3
CRON_SECRET=
```

---

## 🚀 Local Testing & Development

### 1. Run Automated Test Suite
The comprehensive test suite verifies service prices, dynamic total calculation, backend tampering prevention, 3-hour follow-up scheduling, safe end-of-month monthly reminders, appointment cancellation, and unsubscribe workflows:

```bash
python -m unittest test_booking_automation.py
```

### 2. Run Application Locally
```bash
python app.py
```
Open [http://localhost:5000](http://localhost:5000) in your browser.

---

## 🌐 Deploying to Render & Handling Free-Tier Limitations

### Limitation 1: Outbound SMTP Port Blocking (Ports 25, 465, 587)
Render Free Tier blocks outbound SMTP traffic. 
- **On Local/VPS or Render Paid Plan**: The system uses direct Gmail SMTP (`SMTP_HOST:SMTP_PORT`).
- **On Render Free Tier**: Configure `RESEND_API_KEY` (from [resend.com](https://resend.com) - 3,000 free emails/mo). The application will automatically route emails over HTTPS (Port 443), completely bypassing the port restriction with 100% reliability.

### Limitation 2: Inactivity Sleep (Spins down after 15 mins)
Free-tier web services on Render go to sleep after 15 minutes without incoming HTTP traffic.
To ensure background scheduled jobs (3-hour follow-up and monthly reminders) trigger on time:
1. Create a free account at [cron-job.org](https://cron-job.org) or [uptimerobot.com](https://uptimerobot.com).
2. Set up a recurring HTTP GET/POST ping every **10 minutes** to:
   ```
   https://sridevionesaloon.onrender.com/api/cron/process-scheduled-jobs
   ```
3. Whenever the ping hits this endpoint:
   - It wakes the Render instance if it was asleep.
   - It executes `check_and_process_due_jobs()` to immediately deliver any due follow-up emails and monthly reminders.

---

## 📝 API Endpoints Summary

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Serves main salon website |
| `GET` | `/api/services` | Returns authoritative service list, prices, and durations |
| `POST` | `/api/bookings` | Validates services, saves appointment, dispatches confirmation |
| `POST` | `/api/bookings/<id>/cancel` | Cancels appointment and disarms scheduled follow-ups |
| `POST` | `/api/bookings/<id>/reschedule` | Updates date/time and recalculates follow-up and reminder schedule |
| `GET` | `/unsubscribe?token=<token>` | One-click opt-out from monthly reminders |
| `GET`/`POST` | `/api/cron/process-scheduled-jobs` | External cron watchdog webhook to process due jobs |
| `GET` | `/api/scheduler/status` | Diagnostic health endpoint for jobs and reminders |
| `POST` | `/api/smtp/test` | Sends an SMTP health-check email to salon owner |
| `POST` | `/api/contact` | Submits website inquiry form |
| `GET` | `/admin/login` | Dedicated admin login portal |
| `POST` | `/api/admin/login` | Authenticates administrator and sets secure session |
| `POST` | `/api/admin/logout` | Clears admin session |
| `GET` | `/api/admin/me` | Current authenticated admin session profile |
| `POST` | `/api/admin/forgot-password` | Initiates single-use password reset token via email |
| `POST` | `/api/admin/reset-password` | Resets password using verified token |
| `POST` | `/api/admin/change-password` | Updates password and dismisses first-login requirement |
| `GET` | `/api/admin/stats` | Real-time KPI summary counts and recent bookings |
| `GET` | `/api/admin/appointments` | Lists appointments with search and status filters |
| `GET` | `/api/admin/appointments/<id>` | Full appointment details, services snapshot, and timeline |
| `POST` | `/api/admin/appointments/<id>/status` | Updates appointment status (completed / cancelled) |
| `POST` | `/api/admin/appointments/<id>/reschedule` | Reschedules appointment and updates notification timers |
| `POST` | `/api/admin/appointments/<id>/resend-email`| Manually resends confirmation email |
| `GET`/`POST` | `/api/admin/services` | Fetches all services or creates new service |
| `PUT`/`DELETE` | `/api/admin/services/<id>` | Updates or archives existing service |
| `POST` | `/api/admin/services/bulk-prices` | Batch updates prices, discounts, order, and active toggles |
| `GET`/`POST` | `/api/admin/content` | Reads or updates website text, hours, quote, and contact info |
| `GET`/`POST` | `/api/admin/gallery` | Fetches or adds photo gallery showcase entries |
| `DELETE` | `/api/admin/gallery/<id>` | Removes photo gallery entry |
| `POST` | `/api/admin/upload-image` | Uploads service, gallery, or content media files |
| `GET` | `/api/admin/templates` | Retrieves customizable email templates |
| `PUT` | `/api/admin/templates/<id>` | Saves customized email template with dynamic placeholders |
| `POST` | `/api/admin/templates/<id>/test` | Dispatches test email preview to salon owner |
| `GET` | `/api/admin/activity-logs` | Chronological administrative audit logs |

---

## 🛡️ Admin Dashboard & Content Management System (CMS)

Sri Devi One Saloon features a dedicated, secure **Admin Portal & CMS** allowing the salon owner to manage every aspect of the website independently without modifying code.

### 1. Accessing the Admin Portal
- **URL**: [https://sridevionesaloon.onrender.com/admin/login](https://sridevionesaloon.onrender.com/admin/login) (or `http://localhost:5000/admin/login` locally)
- A **"Staff Portal"** link with a lock icon is also discreetly integrated into the footer of the public website.

### 2. Default Administrator Credentials & First Login
On initial database setup, a default administrator account is automatically provisioned:
- **Username**: `admin`
- **Default Password**: `SriDevi@Admin2026`
- **Registered Email**: Configured via `ADMIN_EMAIL` in `.env` (defaults to `chakravarthy.atipamula@gmail.com`)

> [!IMPORTANT]
> **Mandatory Password Change**: Upon first logging in with default credentials, a persistent security banner prompts the owner to change their password immediately in **Settings**. Once changed, the `must_change_password` flag is permanently cleared.

### 3. Forgot Password & Secure Token Recovery
- The login page includes a visible **"Forgot Password?"** link (`/admin/forgot-password`).
- Submitting the registered admin email dispatches a single-use, time-limited (1-hour expiry) password reset link via the configured email provider.
- Reset tokens are cryptographically generated, hashed in the database, and invalidated immediately upon successful reset.
- Constant-time validation and non-enumerating responses protect against user discovery attacks.

### 4. Admin Dashboard Modules

| Section | Description |
|---|---|
| **Overview & KPIs** | Live Indian Standard Time (IST) clock, real-time KPI count cards (Total, Today's, Upcoming, Completed, and Cancelled Bookings, plus Active Services), quick-action buttons, recent bookings table, and recent activity logs. |
| **Appointments** | Search bookings by customer name, phone, or email; filter by date and status; view detailed modal breakdown with individual service prices and total; mark bookings as `completed` or `cancelled`; and reschedule appointments with automatic recalculation of follow-ups. |
| **Manage Services** | Full CRUD for salon services. Add new services with slug, name, price, discounted price, category, duration, description, and custom image. Toggle active status or archive discontinued services. |
| **Price List & Catalogue** | High-efficiency bulk editor table. Modify regular prices, discounted promotional prices, display orders, and active toggles for all services in a single click without opening individual modals. |
| **Website Content CMS** | Change salon contact number, email, address, Google Maps link, opening hours (e.g., `Mon – Sun: 6:30 AM – 10:00 PM`), welcome hero quote, and About Us text in real time without editing HTML. |
| **Photo Gallery** | Upload high-resolution images of haircuts, fades, and grooming styles to showcase in the public website gallery with custom captions and display ordering. |
| **Email Templates** | Customize subject lines and body copy for **Appointment Confirmation**, **3-Hour Follow-Up**, and **Monthly Reminder** emails. Insert dynamic placeholder tokens (e.g., `{{customer_name}}`, `{{services_list}}`, `{{total_price}}`, `{{appointment_date}}`) with one click and send instant test previews to the owner. |
| **Audit Logs** | Chronological record of all administrative actions (logins, password resets, price adjustments, status transitions, and content edits) with timestamps and IP tracking. |
| **Settings & Security** | Update admin username, registered email, and change administrator password with real-time strength validation. |

### 5. Historical Price Integrity & Public Sync
- When service prices or names are edited in the Admin CMS, the public booking grid updates automatically on the next page load.
- **Historical Immutability**: All previously booked appointments retain their original itemized snapshot and total amount in the database (`appointments.services_json` and `appointments.total_price`). Past appointment receipts are never altered when service prices change.

---

*© 2026 Sri Devi One Saloon. All rights reserved.*

