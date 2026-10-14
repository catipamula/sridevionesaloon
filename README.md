<<<<<<< HEAD
# Sri Devi One Saloon — Automated Appointment System

This project keeps the original salon design and adds a Python + Flask backend for secure appointment booking, email confirmations, and reminder scheduling.
=======
# Sri Devi One Saloon — Website

> Premium hair salon and barber shop website for **Sri Devi One Saloon**, Bommuru, Kotta Bommuru, Andhra Pradesh 533124.

---

## Visual Concept

The website uses a **luxury barbershop aesthetic** on a deep charcoal background with antique gold accents and ivory text. The design communicates professionalism, cleanliness, and local trust without overcrowding or visual noise. Animations are restrained and respect `prefers-reduced-motion`. Typography combines Playfair Display (headings) with Inter (body) and Noto Sans Telugu for the Telugu business name.

---
>>>>>>> 8cadb3377467d427079034c5e6fa00411f78e766

## Project Structure

```text
<<<<<<< HEAD
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
=======
sri-devi-one-saloon/
├── index.html            ← Main website (single page)
├── README.md             ← This file
│
├── css/
│   └── style.css         ← Complete stylesheet
│
├── js/
│   └── script.js         ← Complete JavaScript
│
└── assets/
    ├── logo.JPEG         ← Official salon logo (already placed)
    └── services/         ← (Optional) Local service images
        ├── haircut.jpg
        ├── shaving.jpg
        ├── combo.jpg
        ├── scrub.jpg
        ├── tan-pack.jpg
        └── facial.jpg
```

---

## Logo File

The `assets/logo.JPEG` file has already been copied from the original `logo.jpeg` in the parent directory.

> **Important:** The logo filename is `logo.JPEG` (uppercase extension). Preserve this capitalisation exactly, especially when deploying on case-sensitive Linux/macOS servers or Netlify/Vercel.

If you need to replace the logo, place the new file at `assets/logo.JPEG` keeping the exact filename.

---

## Running Locally

### Option 1 — Open directly (simplest)

1. Double-click `index.html` to open in any browser.

> **Note:** Some browsers block `file://` requests for external resources (images, fonts). Use a local server for the best experience.

### Option 2 — VS Code Live Server (recommended)

1. Install the [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) extension in VS Code.
2. Open the `sri-devi-one-saloon` folder in VS Code.
3. Right-click `index.html` → **"Open with Live Server"**.
4. The site opens at `http://127.0.0.1:5500`.

### Option 3 — Python HTTP server

```bash
# Navigate to the project folder first
cd sri-devi-one-saloon

# Python 3
python -m http.server 8080

# Open http://localhost:8080
```

### Option 4 — Node.js http-server

```bash
npx http-server sri-devi-one-saloon -p 8080 -o
```

---

## Deployment

### GitHub Pages

1. Push the `sri-devi-one-saloon` folder contents to a GitHub repository (the root of the repo should contain `index.html`).
2. Go to **Repository → Settings → Pages**.
3. Set **Source** to `Deploy from a branch`.
4. Select `main` (or `master`) branch and `/ (root)`.
5. Click **Save**. Your site will be live at `https://<username>.github.io/<repository-name>/`.

### Netlify (drag-and-drop)

1. Go to [netlify.com](https://www.netlify.com/) and log in.
2. Drag the `sri-devi-one-saloon` folder onto the Netlify deploy area.
3. Your site is instantly live at a `*.netlify.app` URL.
4. Optionally connect a custom domain in **Site settings → Domain management**.

### Vercel

1. Install Vercel CLI: `npm i -g vercel`
2. Inside the `sri-devi-one-saloon` folder, run:
   ```bash
   vercel
   ```
3. Follow the prompts. The site deploys as a static site automatically.

---

## Service Images

The website uses royalty-free Unsplash images via URL for each service. These load automatically when the visitor has internet access.

To use **local images** instead:
1. Save your images in `assets/services/` with these exact filenames:
   - `haircut.jpg`
   - `shaving.jpg`
   - `combo.jpg`
   - `scrub.jpg`
   - `tan-pack.jpg`
   - `facial.jpg`
2. In `index.html`, replace each Unsplash `src` URL for the corresponding service card with the local path, e.g.:
   ```html
   src="assets/services/haircut.jpg"
   ```
3. Recommended image size: **600 × 400 px**, JPEG, compressed to under 150 KB.

---

## WhatsApp Integration

The booking form and contact form send messages via WhatsApp click-to-chat links. Google reviews open the salon's Google Maps location.

| Action | Number used |
|--------|-------------|
| Appointment booking | 73961 44248 |
| General contact enquiry | 6301052228 |

Numbers are set as constants at the top of `js/script.js`.

---

## Testing Checklist

### Responsiveness
- [ ] Test on a small Android phone (320 px–375 px viewport)
- [ ] Test on iPhone (375 px–414 px viewport)
- [ ] Test on a tablet (768 px viewport)
- [ ] Test on a laptop (1024 px viewport)
- [ ] Test on a desktop (1440 px viewport)
- [ ] Confirm no horizontal scroll at any width
- [ ] Confirm mobile hamburger menu opens and closes correctly

### Booking Form
- [ ] Submit empty form → all required field errors appear
- [ ] Enter an invalid phone number → phone error appears
- [ ] Enter a past date → date error appears
- [ ] Fill all fields correctly → Preview button shows summary
- [ ] Click "Send via WhatsApp" → WhatsApp opens with pre-filled message

### WhatsApp Links
- [ ] "Book Your Appointment" hero CTA → scrolls to booking section
- [ ] Booking form submit → WhatsApp opens at `wa.me/917396144248`
- [ ] "Open Maps" in the Google review section opens the salon location
- [ ] Contact form submit → WhatsApp opens at `wa.me/916301052228`
- [ ] WhatsApp contact item in booking section → `wa.me/917396144248`

### Map / Directions
- [ ] "Get Directions" buttons open `https://maps.app.goo.gl/aBQx16ErauUBKbtz6`
- [ ] Google Maps iframe loads in the Location section

### Navigation
- [ ] All nav links scroll to correct sections
- [ ] Navigation becomes solid-background after scrolling down
- [ ] Active nav link highlights as the user scrolls
- [ ] Escape key closes mobile menu

### Price List Filter
- [ ] "All Services" shows both categories
- [ ] "Hair & Grooming" shows only hair card
- [ ] "Skin Care" shows only skin care card

### Console Errors
- [ ] Open browser DevTools (F12) → Console tab
- [ ] Confirm zero JavaScript errors on page load
- [ ] Confirm zero errors when interacting with forms and filters

### Accessibility
- [ ] Tab through entire page using keyboard only
- [ ] All interactive elements have visible focus rings
- [ ] Screen-reader test: headings, button labels, ARIA attributes

---

## Business Information

| Field | Value |
|-------|-------|
| Name | Sri Devi One Saloon |
| Telugu Name | Sri Devi One Saloon |
| Phone | +91 73961 44248 |
| Enquiries | 6301052228 |
| Address | Bommuru Centre, Near NTR Statue, Rajuvolu Road, Kotta Bommuru, AP 533124 |
| Google Maps | https://maps.app.goo.gl/aBQx16ErauUBKbtz6 |
| Google Rating | 5.0 / 5 (3 reviews) |

---

## Technology Stack

- **HTML5** — semantic structure, ARIA roles, Open Graph meta
- **CSS3** — custom properties, grid, flexbox, `clamp()`, animations, Intersection Observer-ready
- **Vanilla JavaScript ES6+** — no dependencies, no build step
- **Google Fonts** — Playfair Display, Inter, Noto Sans Telugu
- **Lucide Icons** — via CDN (lightweight SVG icon set)
- **Unsplash** — royalty-free images via URL (replaceable with local assets)

---

*© 2024 Sri Devi One Saloon. Website built with HTML5, CSS3, and Vanilla JavaScript.*
>>>>>>> 8cadb3377467d427079034c5e6fa00411f78e766
