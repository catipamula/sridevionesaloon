import json
import sqlite3
import unittest
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import app


class TestSriDeviOneSaloonAutomation(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app.app.testing = True
        cls.client = app.app.test_client()
        app.init_db()

    def setUp(self):
        self.client = app.app.test_client()
        with sqlite3.connect(app.DB_PATH) as conn:
            conn.execute("DELETE FROM services WHERE id LIKE 'test_%' OR id LIKE 'beard_spa_%'")
            conn.commit()

    def test_authoritative_services_and_prices(self):
        """1 & 2. Verify all service names and authoritative prices match requirements."""
        expected_prices = {
            "cutting": 120,
            "shaving": 70,
            "combo": 170,
            "scrub": 100,
            "tan_pack": 150,
            "lite_facial": 250,
            "full_facial": 600,
        }
        for svc_id, expected_price in expected_prices.items():
            self.assertIn(svc_id, app.AUTHORITATIVE_SERVICES)
            self.assertEqual(
                app.AUTHORITATIVE_SERVICES[svc_id]["price"],
                expected_price,
                f"Price mismatch for {svc_id}",
            )

    def test_service_validation_and_dynamic_total_calculation(self):
        """2. Verify server calculates total automatically and rejects price tampering."""
        # Multi-service example: Cutting (120) + Shaving (70) + Scrub (100) = 290
        selected = ["cutting", "shaving", "scrub"]
        validated, total, duration, display = app.resolve_and_validate_services(selected)
        self.assertEqual(total, 290)
        self.assertEqual(len(validated), 3)
        self.assertIn("Cutting (₹120)", display)
        self.assertIn("Shaving (₹70)", display)
        self.assertIn("Scrub (₹100)", display)

        # Single service
        single_val, single_total, _, _ = app.resolve_and_validate_services(["cutting"])
        self.assertEqual(single_total, 120)

        # Empty selection rejection
        with self.assertRaises(ValueError):
            app.resolve_and_validate_services([])

        with self.assertRaises(ValueError):
            app.resolve_and_validate_services(["invalid_unknown_service"])

    def test_booking_api_price_validation_and_tampering_prevention(self):
        """2. Verify API rejects browser-tampered price and stores trusted total in DB."""
        payload = {
            "name": "Ravi Kumar",
            "phone": "9876543210",
            "email": "ravikumar.test@example.com",
            "services": ["cutting", "shaving", "scrub"],
            "total_price": 50,  # Tampered price sent by client!
            "appointment_date": "2026-11-10",
            "appointment_time": "14:00",
            "notes": "Testing price validation",
        }

        response = self.client.post("/api/bookings", json=payload)
        self.assertEqual(response.status_code, 201)
        data = response.get_json()
        self.assertTrue(data["success"])
        # Backend MUST enforce authoritative total: 120 + 70 + 100 = 290
        self.assertEqual(data["total_price"], 290)
        apt_id = data["appointment_id"]

        apt = app.get_appointment(apt_id)
        self.assertIsNotNone(apt)
        self.assertEqual(apt["total_price"], 290)
        self.assertEqual(apt["appointment_date"], "2026-11-10")
        self.assertEqual(apt["appointment_time"], "14:00")
        self.assertEqual(apt["appointment_end_time"], "15:10")

    def test_three_hour_followup_scheduling(self):
        """4. Verify follow-up is scheduled 3 HOURS AFTER appointment END time."""
        payload = {
            "name": "Karthik Reddy",
            "phone": "9876543211",
            "email": "karthik.test@example.com",
            "services": ["cutting"],  # 30 min duration (or min 60 mins duration)
            "appointment_date": "2026-12-05",
            "appointment_time": "10:00",
        }
        res = self.client.post("/api/bookings", json=payload)
        self.assertEqual(res.status_code, 201)
        apt_id = res.get_json()["appointment_id"]
        apt = app.get_appointment(apt_id)

        # Start = 10:00, duration = 60 mins -> End = 11:00
        # 3 hours after end time = 14:00 (2:00 PM) on same day
        tz = ZoneInfo("Asia/Kolkata")
        expected_followup_dt = datetime(2026, 12, 5, 14, 0, tzinfo=tz)

        followup_due = datetime.fromisoformat(apt["followup_due_at"])
        self.assertEqual(followup_due, expected_followup_dt)

        # Check notification_logs
        with sqlite3.connect(app.DB_PATH) as conn:
            row = conn.execute(
                "SELECT scheduled_for, status FROM notification_logs WHERE appointment_id = ? AND notification_type = 'followup_3hr'",
                (apt_id,),
            ).fetchone()
        self.assertIsNotNone(row)
        self.assertEqual(datetime.fromisoformat(row[0]), expected_followup_dt)
        self.assertEqual(row[1], "scheduled")

    def test_monthly_reminder_safe_end_of_month(self):
        """5. Verify safe Gregorian end-of-month arithmetic for all shorter months."""
        test_cases = [
            ("2026-01-31", "2026-02-28"),  # Normal year Feb
            ("2028-01-31", "2028-02-29"),  # Leap year Feb
            ("2026-03-31", "2026-04-30"),  # March -> April (30 days)
            ("2026-05-31", "2026-06-30"),  # May -> June (30 days)
            ("2026-08-31", "2026-09-30"),  # August -> September (30 days)
            ("2026-10-31", "2026-11-30"),  # October -> November (30 days)
            ("2026-12-31", "2027-01-31"),  # Dec -> Jan (year rollover)
        ]
        for src_str, expected_next in test_cases:
            d = date.fromisoformat(src_str)
            res_d = app.add_months_safe(d, 1)
            self.assertEqual(
                res_d.strftime("%Y-%m-%d"),
                expected_next,
                f"Failed for {src_str} + 1 month",
            )

    def test_new_booking_updates_customer_reminder_schedule(self):
        """5. When existing customer books a new appointment, reminder schedule resets to 1 month after new visit."""
        cust_email = "loyal.customer@example.com"

        # First appointment on 2026-11-01 -> next reminder = 2026-12-01
        p1 = {
            "name": "Loyal Customer",
            "phone": "9876543222",
            "email": cust_email,
            "services": ["cutting"],
            "appointment_date": "2026-11-01",
            "appointment_time": "11:00",
        }
        res1 = self.client.post("/api/bookings", json=p1)
        self.assertEqual(res1.status_code, 201)

        with sqlite3.connect(app.DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            r1 = conn.execute(
                "SELECT next_reminder_date, last_appointment_date, status FROM customer_reminders WHERE customer_email = ?",
                (cust_email.lower(),),
            ).fetchone()
        self.assertEqual(r1["next_reminder_date"], "2026-12-01")
        self.assertEqual(r1["last_appointment_date"], "2026-11-01")

        # Second appointment booked on 2026-11-25 -> next reminder must update to 2026-12-25
        p2 = {
            "name": "Loyal Customer",
            "phone": "9876543222",
            "email": cust_email,
            "services": ["combo"],
            "appointment_date": "2026-11-25",
            "appointment_time": "15:00",
        }
        res2 = self.client.post("/api/bookings", json=p2)
        self.assertEqual(res2.status_code, 201)

        with sqlite3.connect(app.DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            r2 = conn.execute(
                "SELECT next_reminder_date, last_appointment_date, status FROM customer_reminders WHERE customer_email = ?",
                (cust_email.lower(),),
            ).fetchone()
        self.assertEqual(r2["next_reminder_date"], "2026-12-25")
        self.assertEqual(r2["last_appointment_date"], "2026-11-25")

    def test_customer_reminder_opt_out_unsubscribe(self):
        """5. Verify customer opt-out via unsubscribe link disarms reminders."""
        cust_email = "optout.customer@example.com"
        p = {
            "name": "OptOut Customer",
            "phone": "9876543233",
            "email": cust_email,
            "services": ["cutting"],
            "appointment_date": "2026-11-15",
            "appointment_time": "12:00",
        }
        res = self.client.post("/api/bookings", json=p)
        self.assertEqual(res.status_code, 201)

        with sqlite3.connect(app.DB_PATH) as conn:
            token = conn.execute(
                "SELECT unsubscribe_token FROM customer_reminders WHERE customer_email = ?",
                (cust_email.lower(),),
            ).fetchone()[0]

        # Call unsubscribe endpoint
        unsub_res = self.client.get(f"/unsubscribe?token={token}")
        self.assertEqual(unsub_res.status_code, 200)
        self.assertIn(b"Opt-Out Confirmed", unsub_res.data)

        # Verify DB status is unsubscribed
        with sqlite3.connect(app.DB_PATH) as conn:
            status = conn.execute(
                "SELECT status FROM customer_reminders WHERE customer_email = ?",
                (cust_email.lower(),),
            ).fetchone()[0]
        self.assertEqual(status, "unsubscribed")

    def test_appointment_cancellation(self):
        """6 & 7. Verify cancelling an appointment disarms scheduled follow-up notifications."""
        p = {
            "name": "Cancel Customer",
            "phone": "9876543244",
            "email": "cancel.customer@example.com",
            "services": ["cutting", "shaving"],
            "appointment_date": "2026-12-10",
            "appointment_time": "16:00",
        }
        res = self.client.post("/api/bookings", json=p)
        apt_id = res.get_json()["appointment_id"]

        cancel_res = self.client.post(f"/api/bookings/{apt_id}/cancel")
        self.assertEqual(cancel_res.status_code, 200)

        apt = app.get_appointment(apt_id)
        self.assertEqual(apt["status"], "cancelled")

        with sqlite3.connect(app.DB_PATH) as conn:
            notifs = conn.execute(
                "SELECT status FROM notification_logs WHERE appointment_id = ? AND notification_type = 'followup_3hr'",
                (apt_id,),
            ).fetchall()
        self.assertEqual(notifs[0][0], "cancelled")

    def test_email_templates_content_and_branding(self):
        """3, 4, 5. Verify email subjects, sample text, itemized prices, branding, and maps link."""
        apt = {
            "name": "Chakravarthi Atipamula",
            "email": "chakravarthy.atipamula@gmail.com",
            "phone": "+91 73961 44248",
            "service": "Cutting (₹120), Shaving (₹70)",
            "services_json": json.dumps([
                {"id": "cutting", "name": "Cutting", "price": 120},
                {"id": "shaving", "name": "Shaving", "price": 70},
            ]),
            "total_price": 190,
            "duration_minutes": 50,
            "appointment_date": "2026-10-25",
            "appointment_time": "14:30",
            "appointment_end_time": "15:20",
        }

        # 1. Confirmation Email
        conf_body = app.make_confirmation_body(apt)
        self.assertIn("Hello Chakravarthi Atipamula,", conf_body)
        self.assertIn("Thank you for booking your appointment with Sri Devi One Saloon!", conf_body)
        self.assertIn("Your selected services, appointment date, time, and total estimated price are listed below.", conf_body)
        self.assertIn("Cutting: ₹120", conf_body)
        self.assertIn("Shaving: ₹70", conf_body)
        self.assertIn("Total Estimated Price: ₹190", conf_body)
        self.assertIn(app.SALON_MAPS_URL, conf_body)
        self.assertIn("Best regards,\nSri Devi One Saloon", conf_body)

        conf_html = app.make_confirmation_html(apt)
        self.assertIn("Sri Devi One Saloon", conf_html)
        self.assertIn("₹190", conf_html)
        self.assertIn(app.SALON_MAPS_URL, conf_html)

        # 2. 3-Hour Follow-Up Email
        followup_body = app.make_followup_3hr_body(apt, "https://example.com/unsub")
        self.assertIn("Thank you for visiting Sri Devi One Saloon! We hope you enjoyed your experience and are happy with our service.", followup_body)
        self.assertIn("Your satisfaction means a lot to us. We look forward to seeing you again.", followup_body)
        self.assertIn("Thank you for choosing Sri Devi One Saloon!", followup_body)
        self.assertIn("Best regards,\nSri Devi One Saloon", followup_body)

        # 3. Monthly Reminder Email
        reminder_body = app.make_monthly_reminder_body("Chakravarthi", "https://example.com/#booking", "https://example.com/unsub")
        self.assertIn("It's been about a month since your last visit to Sri Devi One Saloon!", reminder_body)
        self.assertIn("Ready for your next haircut, shave, or grooming session? We'd be happy to welcome you again.", reminder_body)
        self.assertIn("Book your next appointment at your convenience.", reminder_body)
        self.assertIn("Thank you for being our valued customer!", reminder_body)
        self.assertIn("Best regards,\nSri Devi One Saloon", reminder_body)

    def test_cron_tick_endpoint(self):
        """6. Verify cron execution webhook executes watchdog safely."""
        res = self.client.get("/api/cron/process-scheduled-jobs")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["success"])
        self.assertIn("timestamp", data)

    def test_admin_auth_and_session_security(self):
        """Verify admin login, protected route redirection, session cookies, and logout."""
        # Unauthenticated access to /admin must redirect to /admin/login
        res_page = self.client.get("/admin")
        self.assertEqual(res_page.status_code, 302)
        self.assertIn("/admin/login", res_page.headers.get("Location", ""))

        # Unauthenticated API calls must return 401
        res_api = self.client.get("/api/admin/stats")
        self.assertEqual(res_api.status_code, 401)

        # Invalid login
        res_fail = self.client.post("/api/admin/login", json={"username": "admin", "password": "WrongPassword"})
        self.assertEqual(res_fail.status_code, 401)
        self.assertFalse(res_fail.get_json()["success"])

        # Successful login with default admin credentials
        res_login = self.client.post(
            "/api/admin/login",
            json={"username": app.ADMIN_USERNAME, "password": app.ADMIN_PASSWORD, "remember": True},
        )
        self.assertEqual(res_login.status_code, 200)
        data = res_login.get_json()
        self.assertTrue(data["success"])
        self.assertTrue(data["must_change_password"])

        # Verify /admin and /admin/dashboard now accessible
        res_dash = self.client.get("/admin/dashboard")
        self.assertEqual(res_dash.status_code, 200)

        # Verify /api/admin/me returns admin profile
        res_me = self.client.get("/api/admin/me")
        self.assertEqual(res_me.status_code, 200)
        self.assertEqual(res_me.get_json()["admin"]["username"], app.ADMIN_USERNAME)

        # Logout
        res_logout = self.client.post("/api/admin/logout")
        self.assertEqual(res_logout.status_code, 200)

        # Confirm session cleared
        res_after = self.client.get("/api/admin/me")
        self.assertEqual(res_after.status_code, 401)

    def test_admin_forgot_password_and_reset_token(self):
        """Verify forgot password token generation, 1-hour expiration, and single-use reset."""
        # Request forgot password
        res_forgot = self.client.post("/api/admin/forgot-password", json={"email": app.ADMIN_EMAIL})
        self.assertEqual(res_forgot.status_code, 200)

        # Inspect DB for generated token
        with sqlite3.connect(app.DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            user = conn.execute("SELECT reset_token, reset_token_expires_at FROM admin_users WHERE email = ?", (app.ADMIN_EMAIL,)).fetchone()

        self.assertIsNotNone(user["reset_token"])
        token = user["reset_token"]

        # Reset password using token
        new_pwd = "SriDevi@NewSecure2026!"
        res_reset = self.client.post(
            "/api/admin/reset-password",
            json={"token": token, "password": new_pwd, "confirm_password": new_pwd},
        )
        self.assertEqual(res_reset.status_code, 200)
        self.assertTrue(res_reset.get_json()["success"])

        # Token must be cleared (single-use)
        res_reuse = self.client.post(
            "/api/admin/reset-password",
            json={"token": token, "password": "AnotherPassword123", "confirm_password": "AnotherPassword123"},
        )
        self.assertEqual(res_reuse.status_code, 400)

        # Admin can now login with new password
        res_new_login = self.client.post(
            "/api/admin/login",
            json={"username": app.ADMIN_USERNAME, "password": new_pwd},
        )
        self.assertEqual(res_new_login.status_code, 200)
        self.assertFalse(res_new_login.get_json()["must_change_password"])

        # Reset password back to default for other tests
        with sqlite3.connect(app.DB_PATH) as conn:
            conn.execute(
                "UPDATE admin_users SET password_hash = ?, must_change_password = 1 WHERE username = ?",
                (app.generate_password_hash(app.ADMIN_PASSWORD), app.ADMIN_USERNAME),
            )
            conn.commit()

    def test_services_crud_and_bulk_pricing_management(self):
        """Verify service creation, dynamic price update, bulk updates, and archive deletion."""
        self.client.post("/api/admin/login", json={"username": app.ADMIN_USERNAME, "password": app.ADMIN_PASSWORD})

        # 1. Create new service
        new_svc = {
            "id": "beard_spa_royal",
            "name": "Beard Spa Royal",
            "price": 220,
            "discount_price": 250,
            "duration_minutes": 35,
            "category": "Hair & Grooming",
            "description": "Hot towel steam, essential oils, and beard shaping.",
            "is_active": 1,
            "display_order": 10,
        }
        res_create = self.client.post("/api/admin/services", json=new_svc)
        self.assertEqual(res_create.status_code, 201)

        # 2. Check public /api/services reflects new service
        res_pub = self.client.get("/api/services")
        self.assertEqual(res_pub.status_code, 200)
        slugs = [s["id"] for s in res_pub.get_json()["services"]]
        self.assertIn("beard_spa_royal", slugs)

        # 3. Dynamic total validation recognizes new service immediately
        val_list, total, _, _ = app.resolve_and_validate_services(["beard_spa_royal", "cutting"])
        self.assertEqual(total, 220 + 120)

        # 4. Update service price
        res_update = self.client.put("/api/admin/services/beard_spa_royal", json={"price": 240, "name": "Beard Spa Royal Deluxe"})
        self.assertEqual(res_update.status_code, 200)

        # Total recalculates with new price
        _, updated_total, _, _ = app.resolve_and_validate_services(["beard_spa_royal"])
        self.assertEqual(updated_total, 240)

        # 5. Bulk pricing update
        bulk_payload = {
            "updates": [
                {"id": "cutting", "price": 120, "discount_price": None, "display_order": 1, "is_active": 1},
                {"id": "shaving", "price": 75, "discount_price": None, "display_order": 2, "is_active": 1},
            ]
        }
        res_bulk = self.client.post("/api/admin/services/bulk-prices", json=bulk_payload)
        self.assertEqual(res_bulk.status_code, 200)

        # 6. Delete/Archive service
        res_del = self.client.delete("/api/admin/services/beard_spa_royal")
        self.assertEqual(res_del.status_code, 200)

        # Re-check public /api/services does not include archived service
        res_pub_after = self.client.get("/api/services")
        active_slugs = [s["id"] for s in res_pub_after.get_json()["services"]]
        self.assertNotIn("beard_spa_royal", active_slugs)

        # Restore shaving price to 70 for baseline consistency
        self.client.post("/api/admin/services/bulk-prices", json={"updates": [{"id": "shaving", "price": 70, "display_order": 2, "is_active": 1}]})

    def test_website_content_cms_updates(self):
        """Verify CMS text, opening hours, contact details, and public synchronization."""
        self.client.post("/api/admin/login", json={"username": app.ADMIN_USERNAME, "password": app.ADMIN_PASSWORD})

        # Save CMS changes
        new_content = {
            "salon_name": "Sri Devi One Saloon",
            "tagline": "Master Barbershop & Luxury Grooming",
            "phone": "+91 73961 44248",
            "opening_hours": "Mon – Sun: 6:30 AM – 10:00 PM",
            "welcome_heading": "Welcome to Sri Devi One Saloon",
            "welcome_quote": "Excellence in every cut and shave.",
        }
        res_save = self.client.post("/api/admin/content", json={"content": new_content})
        self.assertEqual(res_save.status_code, 200)

        # Public /api/content reflects changes
        res_pub = self.client.get("/api/content")
        self.assertEqual(res_pub.status_code, 200)
        data = res_pub.get_json()["content"]
        self.assertEqual(data["opening_hours"], "Mon – Sun: 6:30 AM – 10:00 PM")
        self.assertEqual(data["welcome_quote"], "Excellence in every cut and shave.")

    def test_appointment_management_status_and_reschedule(self):
        """Verify admin can inspect, reschedule, change status, and cancel bookings."""
        self.client.post("/api/admin/login", json={"username": app.ADMIN_USERNAME, "password": app.ADMIN_PASSWORD})

        # Create booking
        res_book = self.client.post("/api/bookings", json={
            "name": "Suresh Varma",
            "email": "suresh.test@example.com",
            "phone": "9876543299",
            "services": ["cutting", "shaving"],
            "appointment_date": "2026-11-20",
            "appointment_time": "15:00",
        })
        self.assertEqual(res_book.status_code, 201)
        apt_id = res_book.get_json()["appointment_id"]

        # View appointment detail
        res_detail = self.client.get(f"/api/admin/appointments/{apt_id}")
        self.assertEqual(res_detail.status_code, 200)
        apt_data = res_detail.get_json()["appointment"]
        self.assertEqual(apt_data["name"], "Suresh Varma")

        # Reschedule appointment
        res_resched = self.client.post(
            f"/api/admin/appointments/{apt_id}/reschedule",
            json={"appointment_date": "2026-11-22", "appointment_time": "16:30"},
        )
        self.assertEqual(res_resched.status_code, 200)

        # Verify new date and recalculated follow-up time
        updated = app.get_appointment(apt_id)
        self.assertEqual(updated["appointment_date"], "2026-11-22")
        self.assertEqual(updated["appointment_time"], "16:30")
        self.assertIn("20:30", updated["followup_due_at"] or "")

        # Mark completed
        res_comp = self.client.post(f"/api/admin/appointments/{apt_id}/status", json={"status": "completed"})
        self.assertEqual(res_comp.status_code, 200)
        self.assertEqual(app.get_appointment(apt_id)["status"], "completed")

        # Mark cancelled
        res_canc = self.client.post(f"/api/admin/appointments/{apt_id}/status", json={"status": "cancelled"})
        self.assertEqual(res_canc.status_code, 200)
        self.assertEqual(app.get_appointment(apt_id)["status"], "cancelled")

    def test_email_templates_customization_and_preview(self):
        """Verify editing email templates and placeholder substitution."""
        self.client.post("/api/admin/login", json={"username": app.ADMIN_USERNAME, "password": app.ADMIN_PASSWORD})

        # Get templates
        res_tpl = self.client.get("/api/admin/templates")
        self.assertEqual(res_tpl.status_code, 200)
        tpls = res_tpl.get_json()["templates"]
        self.assertIn("confirmation", tpls)

        # Update confirmation template
        new_tpl = {
            "subject": "Customized: Your Appointment at {{salon_name}}",
            "body_html": "Dear {{customer_name}},\n\nYour appointment is confirmed for {{appointment_date}} at {{appointment_time}}.\n\nTotal: {{total_price}}\n\nSee you soon!",
        }
        res_save = self.client.put("/api/admin/templates/confirmation", json=new_tpl)
        self.assertEqual(res_save.status_code, 200)

        # Verify template retrieved matches
        updated_tpl = app.get_email_template("confirmation")
        self.assertEqual(updated_tpl["subject"], new_tpl["subject"])

    def test_activity_audit_logs(self):
        """Verify admin actions are audited with timestamp, user, action, and IP."""
        self.client.post("/api/admin/login", json={"username": app.ADMIN_USERNAME, "password": app.ADMIN_PASSWORD})

        res_logs = self.client.get("/api/admin/activity-logs")
        self.assertEqual(res_logs.status_code, 200)
        logs = res_logs.get_json()["logs"]
        self.assertTrue(len(logs) > 0)
        actions = [l["action"] for l in logs]
        self.assertIn("admin_login", actions)


if __name__ == "__main__":
    unittest.main()
