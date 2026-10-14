/**
 * Sri Devi One Saloon — script.js
 * Complete vanilla JavaScript for the salon website.
 * ES6+ · No frameworks · No dependencies
 */

'use strict';

/* ═══════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════ */
<<<<<<< HEAD
const SALON_EMAIL = 'pavankoneti85@gmail.com';
const MAPS_URL = 'https://maps.app.goo.gl/aBQx16ErauUBKbtz6';

const WELCOME_MESSAGES = [
  "Welcome to Sri Devi One Saloon ✂️ Your Style. Your Confidence. Our Passion.",
  "Refining Your Everyday Look with Precision & Care — Welcome to Sri Devi One Saloon.",
  "Experience Master Craftsmanship & Premium Grooming at Sri Devi One Saloon.",
  "Step into Comfort, Step out with Confidence — Sri Devi One Saloon.",
  "Bommuru's Signature Grooming Destination — Welcome to Sri Devi One Saloon.",
  "Tailored Cuts, Sharp Beards & Rejuvenating Facials at Sri Devi One Saloon."
];

=======
const WHATSAPP_SALON = '917396144248';   // salon bookings
const WHATSAPP_ENQUIRY = '916301052228'; // general enquiries / contact form
const MAPS_URL = 'https://maps.app.goo.gl/aBQx16ErauUBKbtz6';

>>>>>>> 8cadb3377467d427079034c5e6fa00411f78e766
/* ═══════════════════════════════════════════════
   UTILITY HELPERS
═══════════════════════════════════════════════ */

/**
 * Safe querySelector – returns element or null without throwing.
 */
function qs(selector, context = document) {
  return context.querySelector(selector);
}

/**
 * Safe querySelectorAll – returns NodeList (may be empty).
 */
function qsa(selector, context = document) {
  return context.querySelectorAll(selector);
}

/**
 * Returns today's date string in YYYY-MM-DD format (local time).
 */
function todayString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
<<<<<<< HEAD
 * Format 24-hour time string (e.g. '14:30', '09:00', '00:00', '12:00') into 12-hour AM/PM format.
 */
function formatTime12Hour(timeStr) {
  if (!timeStr) return '';
  const parts = timeStr.trim().split(':');
  if (parts.length < 2) return timeStr;
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1].padStart(2, '0');
  if (isNaN(hours)) return timeStr;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${hours}:${minutes} ${ampm}`;
}

/**
 * Format YYYY-MM-DD date into readable format (e.g. 'October 15, 2026').
 */
function formatDateReadable(dateStr) {
  if (!dateStr) return '';
  try {
    const parts = dateStr.trim().split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      }
    }
    return dateStr;
  } catch (e) {
    return dateStr;
  }
=======
 * Validate a 10-digit Indian mobile number.
 * Accepts optional +91 / 91 prefix and spaces.
 */
function isValidIndianPhone(value) {
  const cleaned = value.replace(/[\s\-().]/g, '');
  return /^(?:\+91|91)?[6-9]\d{9}$/.test(cleaned);
>>>>>>> 8cadb3377467d427079034c5e6fa00411f78e766
}

/**
 * Validate a basic email address.
 */
function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/**
<<<<<<< HEAD
 * Validate a phone number (at least 10 digits).
 */
function isValidIndianPhone(value) {
  const digits = (value || '').replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 13;
}

/**
=======
>>>>>>> 8cadb3377467d427079034c5e6fa00411f78e766
 * Show a field error message.
 */
function showError(errorEl, message) {
  if (!errorEl) return;
  errorEl.textContent = message;
}

/**
 * Clear a field error message.
 */
function clearError(errorEl) {
  if (!errorEl) return;
  errorEl.textContent = '';
}

/**
 * Mark a form control as invalid (ARIA).
 */
function setInvalid(inputEl, errorEl, message) {
  if (inputEl) inputEl.setAttribute('aria-invalid', 'true');
  showError(errorEl, message);
}

/**
 * Clear invalid state.
 */
function setValid(inputEl, errorEl) {
  if (inputEl) inputEl.removeAttribute('aria-invalid');
  clearError(errorEl);
}

/* ═══════════════════════════════════════════════
   1. LUCIDE ICON INITIALISATION
═══════════════════════════════════════════════ */
function initIcons() {
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

/* ═══════════════════════════════════════════════
   2. DYNAMIC COPYRIGHT YEAR
═══════════════════════════════════════════════ */
function initCopyrightYear() {
  const el = qs('#copyright-year');
  if (el) el.textContent = new Date().getFullYear();
}

/* ═══════════════════════════════════════════════
   3. ANNOUNCEMENT BAR → reduce motion awareness handled in CSS
═══════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════
<<<<<<< HEAD
   3b. WELCOME POPUP MODAL (Random on load/refresh, 4-side spacing)
═══════════════════════════════════════════════ */
function initWelcomeBanner() {
  const overlay = qs('#welcome-modal-overlay');
  const bannerText = qs('#welcome-banner-text');
  const closeBtn = qs('#welcome-banner-close');
  const dismissBtn = qs('#welcome-modal-dismiss-btn');
  const bookBtn = qs('#welcome-modal-book-btn');
  if (!overlay || !bannerText) return;

  // Retrieve last shown index from sessionStorage
  const lastIndexStr = sessionStorage.getItem('sridevi_last_welcome_index');
  let lastIndex = lastIndexStr !== null ? parseInt(lastIndexStr, 10) : -1;

  let newIndex;
  if (WELCOME_MESSAGES.length === 1) {
    newIndex = 0;
  } else if (lastIndex === -1 || isNaN(lastIndex)) {
    newIndex = Math.floor(Math.random() * WELCOME_MESSAGES.length);
  } else {
    // Non-zero offset guarantees different message from the consecutive previous one
    const offset = 1 + Math.floor(Math.random() * (WELCOME_MESSAGES.length - 1));
    newIndex = (lastIndex + offset) % WELCOME_MESSAGES.length;
  }

  sessionStorage.setItem('sridevi_last_welcome_index', String(newIndex));
  bannerText.textContent = WELCOME_MESSAGES[newIndex];

  // Show modal with smooth entrance
  requestAnimationFrame(() => {
    overlay.classList.add('is-active');
  });

  function closeModal() {
    overlay.classList.remove('is-active');
  }

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (dismissBtn) dismissBtn.addEventListener('click', closeModal);

  if (bookBtn) {
    bookBtn.addEventListener('click', () => {
      closeModal();
      const bookingSection = qs('#booking');
      if (bookingSection) {
        bookingSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  // Dismiss on backdrop click
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeModal();
  });

  // Dismiss on Escape key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && overlay.classList.contains('is-active')) {
      closeModal();
    }
  });
}

/* ═══════════════════════════════════════════════
=======
>>>>>>> 8cadb3377467d427079034c5e6fa00411f78e766
   4. STICKY NAVIGATION (transparent → solid on scroll)
═══════════════════════════════════════════════ */
function initStickyNav() {
  const header = qs('#site-header');
  if (!header) return;

  const onScroll = () => {
    if (window.scrollY > 20) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll(); // run once on load
}

/* ═══════════════════════════════════════════════
   5. MOBILE MENU TOGGLE
═══════════════════════════════════════════════ */
function initMobileMenu() {
  const hamburger = qs('#hamburger');
  const mobileMenu = qs('#mobile-menu');
  const mobileLinks = qsa('.mobile-nav-link, .mobile-book-btn');

  if (!hamburger || !mobileMenu) return;

  let isOpen = false;

  function openMenu() {
    isOpen = true;
    hamburger.setAttribute('aria-expanded', 'true');
    mobileMenu.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    // Focus first link for keyboard accessibility
    const firstLink = qs('.mobile-nav-link', mobileMenu);
    if (firstLink) firstLink.focus();
  }

  function closeMenu() {
    isOpen = false;
    hamburger.setAttribute('aria-expanded', 'false');
    mobileMenu.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    hamburger.focus();
  }

  hamburger.addEventListener('click', () => {
    isOpen ? closeMenu() : openMenu();
  });

  const closeBtn = qs('#mobile-close-btn', mobileMenu);
  if (closeBtn) closeBtn.addEventListener('click', closeMenu);

  // Close on link click
  mobileLinks.forEach(link => {
    link.addEventListener('click', closeMenu);
  });

  // Close on Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && isOpen) closeMenu();
  });

  // Close on backdrop click
  mobileMenu.addEventListener('click', e => {
    if (e.target === mobileMenu) closeMenu();
  });
}

/* ═══════════════════════════════════════════════
   6. SMOOTH SCROLLING
═══════════════════════════════════════════════ */
function initSmoothScroll() {
  document.addEventListener('click', e => {
    const link = e.target.closest('a[href^="#"]');
    if (!link) return;

    const targetId = link.getAttribute('href').split('?')[0];
    if (!targetId || targetId === '#') return;

    const target = qs(targetId);
    if (!target) return;

    e.preventDefault();

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    target.scrollIntoView({
      behavior: prefersReduced ? 'auto' : 'smooth',
      block: 'start'
    });

    // Update URL without triggering jump
    if (history.pushState) {
      history.pushState(null, '', targetId);
    }
  });
}

/* ═══════════════════════════════════════════════
   7. ACTIVE NAV LINK (Intersection Observer)
═══════════════════════════════════════════════ */
function initActiveNav() {
  const sections = qsa('section[id], div[id="home"]');
  const navLinks = qsa('.nav-link');

  if (!navLinks.length || !sections.length) return;

  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const id = entry.target.id;
        navLinks.forEach(link => {
          const href = link.getAttribute('href');
          if (href === `#${id}`) {
            link.classList.add('active');
            link.setAttribute('aria-current', 'page');
          } else {
            link.classList.remove('active');
            link.removeAttribute('aria-current');
          }
        });
      });
    },
    { rootMargin: '-30% 0px -60% 0px', threshold: 0 }
  );

  sections.forEach(section => observer.observe(section));
}

/* ═══════════════════════════════════════════════
   8. SCROLL REVEAL ANIMATIONS
═══════════════════════════════════════════════ */
function initRevealAnimations() {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const revealEls = qsa('.reveal-fade-up, .reveal-fade-left, .reveal-fade-right');

  if (prefersReduced) {
    revealEls.forEach(el => el.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -60px 0px' }
  );

  revealEls.forEach(el => observer.observe(el));
}

/* ═══════════════════════════════════════════════
   9. BACK TO TOP BUTTON
═══════════════════════════════════════════════ */
function initBackToTop() {
  const btn = qs('#back-to-top');
  if (!btn) return;

  const toggle = () => {
    if (window.scrollY > 500) {
      btn.removeAttribute('hidden');
    } else {
      btn.setAttribute('hidden', '');
    }
  };

  window.addEventListener('scroll', toggle, { passive: true });
  toggle();

  btn.addEventListener('click', () => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: prefersReduced ? 'auto' : 'smooth' });
  });
}

/* ═══════════════════════════════════════════════
   10. PRICE CATALOGUE FILTER
═══════════════════════════════════════════════ */
function initPriceFilter() {
  const filterBtns = qsa('.filter-btn');
  const categoryCards = qsa('.price-category-card');

  if (!filterBtns.length || !categoryCards.length) return;

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const filter = btn.dataset.filter;

      // Update button state
      filterBtns.forEach(b => {
        b.classList.remove('filter-btn--active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('filter-btn--active');
      btn.setAttribute('aria-pressed', 'true');

      // Show/hide cards
      categoryCards.forEach(card => {
        const category = card.dataset.category;
        const show = filter === 'all' || category === filter;

        if (show) {
          card.classList.remove('hidden');
          // Trigger reveal animation
          card.classList.remove('is-visible');
          requestAnimationFrame(() => {
            requestAnimationFrame(() => card.classList.add('is-visible'));
          });
        } else {
          card.classList.add('hidden');
        }
      });
    });
  });
}

/* ═══════════════════════════════════════════════
   11. SERVICE CARDS → Book This Service
       Pre-selects service in booking form
═══════════════════════════════════════════════ */
function initServiceBookButtons() {
  const bookBtns = qsa('.book-service-btn');
  const bookingServiceEl = qs('#booking-service');

  if (!bookBtns.length || !bookingServiceEl) return;

  bookBtns.forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      const service = btn.dataset.service;
      if (!service) return;

      // Map service name to option value
      const matchingOption = Array.from(bookingServiceEl.options).find(opt =>
        opt.value.toLowerCase().startsWith(service.toLowerCase())
      );

      if (matchingOption) {
        bookingServiceEl.value = matchingOption.value;
      }

      // Scroll to booking
      const booking = qs('#booking');
      if (booking) {
        const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        booking.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'start' });
      }
    });
  });
}

/* ═══════════════════════════════════════════════
   12. BOOKING FORM
═══════════════════════════════════════════════ */
function initBookingForm() {
  const form = qs('#booking-form');
  if (!form) return;

  const nameEl    = qs('#booking-name', form);
  const phoneEl   = qs('#booking-phone', form);
<<<<<<< HEAD
  const emailEl   = qs('#booking-email', form);
=======
>>>>>>> 8cadb3377467d427079034c5e6fa00411f78e766
  const serviceEl = qs('#booking-service', form);
  const dateEl    = qs('#booking-date', form);
  const timeEl    = qs('#booking-time', form);
  const msgEl     = qs('#booking-message', form);

  const nameErr    = qs('#booking-name-error');
  const phoneErr   = qs('#booking-phone-error');
<<<<<<< HEAD
  const emailErr   = qs('#booking-email-error');
  const serviceErr = qs('#booking-service-error');
  const dateErr    = qs('#booking-date-error');
  const timeErr    = qs('#booking-time-error');
  const statusEl   = qs('#booking-status');
=======
  const serviceErr = qs('#booking-service-error');
  const dateErr    = qs('#booking-date-error');
  const timeErr    = qs('#booking-time-error');
>>>>>>> 8cadb3377467d427079034c5e6fa00411f78e766

  const summaryEl        = qs('#booking-summary');
  const summaryDetails   = qs('#summary-details', summaryEl);
  const previewBtn       = qs('#preview-booking-btn');

<<<<<<< HEAD
  if (dateEl) dateEl.min = todayString();

=======
  // Set minimum date to today
  if (dateEl) dateEl.min = todayString();

  // ── Preview
>>>>>>> 8cadb3377467d427079034c5e6fa00411f78e766
  if (previewBtn) {
    previewBtn.addEventListener('click', () => {
      if (!validateBookingForm()) return;
      buildSummary(summaryDetails, {
        'Name':    nameEl.value.trim(),
<<<<<<< HEAD
        'Phone':   phoneEl ? phoneEl.value.trim() : '',
        'Email':   emailEl.value.trim(),
        'Service': serviceEl.value,
        'Date':    formatDateReadable(dateEl.value),
        'Time':    formatTime12Hour(timeEl.value),
=======
        'Phone':   phoneEl.value.trim(),
        'Service': serviceEl.value,
        'Date':    dateEl.value,
        'Time':    timeEl.value,
>>>>>>> 8cadb3377467d427079034c5e6fa00411f78e766
        'Note':    msgEl ? msgEl.value.trim() : ''
      });
      if (summaryEl) summaryEl.removeAttribute('hidden');
    });
  }

<<<<<<< HEAD
  function validateBookingForm() {
    let valid = true;

=======
  // ── Validate
  function validateBookingForm() {
    let valid = true;

    // Name
>>>>>>> 8cadb3377467d427079034c5e6fa00411f78e766
    if (!nameEl || !nameEl.value.trim()) {
      setInvalid(nameEl, nameErr, 'Please enter your name.');
      valid = false;
    } else {
      setValid(nameEl, nameErr);
    }

<<<<<<< HEAD
=======
    // Phone
>>>>>>> 8cadb3377467d427079034c5e6fa00411f78e766
    if (!phoneEl || !phoneEl.value.trim()) {
      setInvalid(phoneEl, phoneErr, 'Please enter your phone number.');
      valid = false;
    } else if (!isValidIndianPhone(phoneEl.value)) {
<<<<<<< HEAD
      setInvalid(phoneEl, phoneErr, 'Please enter a valid 10-digit mobile number.');
=======
      setInvalid(phoneEl, phoneErr, 'Enter a valid 10-digit Indian mobile number.');
>>>>>>> 8cadb3377467d427079034c5e6fa00411f78e766
      valid = false;
    } else {
      setValid(phoneEl, phoneErr);
    }

<<<<<<< HEAD
    if (!emailEl || !emailEl.value.trim()) {
      setInvalid(emailEl, emailErr, 'Please enter your email address.');
      valid = false;
    } else if (!isValidEmail(emailEl.value)) {
      setInvalid(emailEl, emailErr, 'Please enter a valid email address.');
      valid = false;
    } else {
      setValid(emailEl, emailErr);
    }

=======
    // Service
>>>>>>> 8cadb3377467d427079034c5e6fa00411f78e766
    if (!serviceEl || !serviceEl.value) {
      setInvalid(serviceEl, serviceErr, 'Please select a service.');
      valid = false;
    } else {
      setValid(serviceEl, serviceErr);
    }

<<<<<<< HEAD
=======
    // Date
>>>>>>> 8cadb3377467d427079034c5e6fa00411f78e766
    if (!dateEl || !dateEl.value) {
      setInvalid(dateEl, dateErr, 'Please select a preferred date.');
      valid = false;
    } else if (dateEl.value < todayString()) {
      setInvalid(dateEl, dateErr, 'Please select today or a future date.');
      valid = false;
    } else {
      setValid(dateEl, dateErr);
    }

<<<<<<< HEAD
=======
    // Time
>>>>>>> 8cadb3377467d427079034c5e6fa00411f78e766
    if (!timeEl || !timeEl.value) {
      setInvalid(timeEl, timeErr, 'Please select a preferred time.');
      valid = false;
    } else {
      setValid(timeEl, timeErr);
    }

    return valid;
  }

<<<<<<< HEAD
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!validateBookingForm()) return;

    const payload = {
      name: nameEl.value.trim(),
      phone: phoneEl ? phoneEl.value.trim() : '',
      email: emailEl.value.trim(),
      service: serviceEl.value,
      appointment_date: dateEl.value,
      appointment_time: timeEl.value,
      notes: msgEl ? msgEl.value.trim() : ''
    };

    const submitBtn = qs('#send-booking-btn', form);
    const originalText = submitBtn ? submitBtn.innerHTML : '';

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="icon-sm" data-lucide="loader"></span> Booking...';
      initIcons();
    }

    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Unable to book appointment right now.');
      }
      if (statusEl) {
        statusEl.textContent = data.message || `Your appointment for ${formatDateReadable(payload.appointment_date)} at ${formatTime12Hour(payload.appointment_time)} has been received. A confirmation email is on its way.`;
        statusEl.classList.add('success');
        statusEl.classList.remove('error');
      }
      form.reset();
      if (summaryEl) summaryEl.setAttribute('hidden', 'hidden');
    } catch (error) {
      if (statusEl) {
        statusEl.textContent = error.message || 'Something went wrong. Please try again.';
        statusEl.classList.add('error');
        statusEl.classList.remove('success');
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
        initIcons();
      }
    }
  });

  [nameEl, phoneEl, emailEl, serviceEl, dateEl, timeEl].forEach(el => {
    if (!el) return;
    const clearFeedback = () => {
      const errorId = el.getAttribute('aria-describedby');
      if (errorId) clearError(qs(`#${errorId}`));
      el.removeAttribute('aria-invalid');
    };
    el.addEventListener('input', clearFeedback);
    el.addEventListener('change', clearFeedback);
=======
  // ── Submit → WhatsApp
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (!validateBookingForm()) return;

    const name    = nameEl.value.trim();
    const phone   = phoneEl.value.trim();
    const service = serviceEl.value;
    const date    = dateEl.value;
    const time    = timeEl.value;
    const note    = msgEl ? msgEl.value.trim() : '';

    const lines = [
      '🗓 *Appointment Request – Sri Devi One Saloon*',
      '',
      `*Name:* ${name}`,
      `*Phone:* ${phone}`,
      `*Service:* ${service}`,
      `*Date:* ${date}`,
      `*Time:* ${time}`,
      note ? `*Note:* ${note}` : '',
      '',
      '_This request was sent from the salon website. Please confirm the appointment._'
    ].filter(line => line !== null);

    const message = encodeURIComponent(lines.join('\n'));
    window.open(`https://wa.me/${WHATSAPP_SALON}?text=${message}`, '_blank', 'noopener,noreferrer');
  });

  // Clear errors on input
  [nameEl, phoneEl, serviceEl, dateEl, timeEl].forEach(el => {
    if (!el) return;
    el.addEventListener('input', () => {
      const errorId = el.getAttribute('aria-describedby');
      if (errorId) clearError(qs(`#${errorId}`));
      el.removeAttribute('aria-invalid');
    });
>>>>>>> 8cadb3377467d427079034c5e6fa00411f78e766
  });
}

/* ═══════════════════════════════════════════════
   13. REVIEW FORM (star rating + photo upload)
═══════════════════════════════════════════════ */
function initReviewForm() {
  const form = qs('#review-form');
  if (!form) return;

  const nameEl     = qs('#review-name', form);
  const ratingEl   = qs('#review-rating', form);
  const textEl     = qs('#review-text', form);
  const consentEl  = qs('#review-consent', form);
  const photoInput = qs('#review-photo', form);

  const nameErr    = qs('#review-name-error');
  const ratingErr  = qs('#review-rating-error');
  const textErr    = qs('#review-text-error');
  const photoErr   = qs('#review-photo-error');
  const consentErr = qs('#consent-error');

  // ── Star Rating Widget
  const starBtns = qsa('.star-btn', form);

  starBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const val = parseInt(btn.dataset.value, 10);
      ratingEl.value = val;
      updateStarDisplay(val);
      clearError(ratingErr);
      if (ratingEl) ratingEl.removeAttribute('aria-invalid');
    });

    // Hover effect
    btn.addEventListener('mouseenter', () => highlightStars(parseInt(btn.dataset.value, 10)));
    btn.addEventListener('mouseleave', () => updateStarDisplay(parseInt(ratingEl.value || 0)));
  });

  function highlightStars(upTo) {
    starBtns.forEach(b => {
      const v = parseInt(b.dataset.value, 10);
      b.classList.toggle('hovered', v <= upTo);
    });
  }

  function updateStarDisplay(rating) {
    starBtns.forEach(b => {
      const v = parseInt(b.dataset.value, 10);
      b.classList.toggle('selected', v <= rating);
      b.classList.remove('hovered');
    });
  }

  // ── Photo Upload / Dropzone
  const dropzone      = qs('#review-dropzone');
  const previewWrap   = qs('#photo-preview-wrap');
  const previewImg    = qs('#photo-preview-img');
  const previewName   = qs('#photo-preview-name');
  const removeBtn     = qs('#remove-photo-btn');

  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
  const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

  function handleFile(file) {
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      showError(photoErr, 'Unsupported file type. Please upload JPEG, PNG, or WebP.');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      showError(photoErr, `File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 5 MB.`);
      return;
    }

    clearError(photoErr);

    const reader = new FileReader();
    reader.onload = ev => {
      if (previewImg)  previewImg.src = ev.target.result;
      if (previewName) previewName.textContent = file.name;
      if (previewWrap) previewWrap.removeAttribute('hidden');
    };
    reader.readAsDataURL(file);
  }

  if (dropzone) {
    // Click opens file input
    dropzone.addEventListener('click', e => {
      if (e.target !== photoInput) photoInput && photoInput.click();
    });

    // Keyboard open
    dropzone.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        photoInput && photoInput.click();
      }
    });

    // Drag events
    dropzone.addEventListener('dragover', e => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));

    dropzone.addEventListener('drop', e => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file && photoInput) {
        // Assign to the input for consistency (not always possible due to security)
        handleFile(file);
      }
    });
  }

  if (photoInput) {
    photoInput.addEventListener('change', () => {
      const file = photoInput.files[0];
      handleFile(file);
    });
  }

  if (removeBtn) {
    removeBtn.addEventListener('click', () => {
      if (photoInput)  photoInput.value = '';
      if (previewImg)  previewImg.src = '';
      if (previewName) previewName.textContent = '';
      if (previewWrap) previewWrap.setAttribute('hidden', '');
      clearError(photoErr);
    });
  }

  // ── Validate Review Form
  function validateReviewForm() {
    let valid = true;

    if (!nameEl || !nameEl.value.trim()) {
      setInvalid(nameEl, nameErr, 'Please enter your name.');
      valid = false;
    } else {
      setValid(nameEl, nameErr);
    }

    if (!ratingEl || !ratingEl.value) {
      showError(ratingErr, 'Please select a star rating.');
      valid = false;
    } else {
      clearError(ratingErr);
    }

    if (!textEl || !textEl.value.trim()) {
      setInvalid(textEl, textErr, 'Please write your review.');
      valid = false;
    } else {
      setValid(textEl, textErr);
    }

    if (!consentEl || !consentEl.checked) {
      showError(consentErr, 'Please confirm that you agree to the terms before submitting.');
      valid = false;
    } else {
      clearError(consentErr);
    }

    return valid;
  }

<<<<<<< HEAD
  // ── Submit via email
=======
  // ── Submit → WhatsApp
>>>>>>> 8cadb3377467d427079034c5e6fa00411f78e766
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (!validateReviewForm()) return;

    const name   = nameEl.value.trim();
    const rating = ratingEl.value;
    const text   = textEl.value.trim();
    const stars  = '⭐'.repeat(parseInt(rating, 10));

    const lines = [
      '✍️ *Website Review Submission – Sri Devi One Saloon*',
      '',
      `*Name:* ${name}`,
      `*Rating:* ${stars} (${rating}/5)`,
      `*Review:* "${text}"`,
      '',
      '_Submitted via the salon website. Please moderate before publishing._'
    ];

    const message = encodeURIComponent(lines.join('\n'));
<<<<<<< HEAD
    const reviewMail = `mailto:${SALON_EMAIL}?subject=${encodeURIComponent('Website review submission')}&body=${message}`;
    window.open(reviewMail, '_blank', 'noopener,noreferrer');
=======
    window.open(`https://wa.me/${WHATSAPP_SALON}?text=${message}`, '_blank', 'noopener,noreferrer');
>>>>>>> 8cadb3377467d427079034c5e6fa00411f78e766
  });

  // Clear errors on interaction
  [nameEl, textEl].forEach(el => {
    if (!el) return;
    el.addEventListener('input', () => {
      const errId = el.getAttribute('aria-describedby');
      if (errId) clearError(qs(`#${errId}`));
      el.removeAttribute('aria-invalid');
    });
  });
}

/* ═══════════════════════════════════════════════
   14. CONTACT FORM
═══════════════════════════════════════════════ */
function initContactForm() {
  const form = qs('#contact-form');
  if (!form) return;

  const nameEl    = qs('#contact-name', form);
<<<<<<< HEAD
=======
  const phoneEl   = qs('#contact-phone', form);
>>>>>>> 8cadb3377467d427079034c5e6fa00411f78e766
  const emailEl   = qs('#contact-email', form);
  const subjectEl = qs('#contact-subject', form);
  const msgEl     = qs('#contact-message', form);

  const nameErr    = qs('#contact-name-error');
<<<<<<< HEAD
  const emailErr   = qs('#contact-email-error');
  const subjectErr = qs('#contact-subject-error');
  const msgErr     = qs('#contact-message-error');
  const statusEl   = qs('#contact-status');
=======
  const phoneErr   = qs('#contact-phone-error');
  const emailErr   = qs('#contact-email-error');
  const subjectErr = qs('#contact-subject-error');
  const msgErr     = qs('#contact-message-error');
>>>>>>> 8cadb3377467d427079034c5e6fa00411f78e766

  const summaryEl      = qs('#contact-summary');
  const summaryDetails = qs('#contact-summary-details', summaryEl);
  const previewBtn     = qs('#preview-contact-btn');

<<<<<<< HEAD
=======
  // ── Preview
>>>>>>> 8cadb3377467d427079034c5e6fa00411f78e766
  if (previewBtn) {
    previewBtn.addEventListener('click', () => {
      if (!validateContactForm()) return;
      buildSummary(summaryDetails, {
        'Name':    nameEl.value.trim(),
<<<<<<< HEAD
        'Email':   emailEl.value.trim(),
=======
        'Phone':   phoneEl.value.trim(),
        'Email':   emailEl && emailEl.value.trim() ? emailEl.value.trim() : '—',
>>>>>>> 8cadb3377467d427079034c5e6fa00411f78e766
        'Subject': subjectEl.value.trim(),
        'Message': msgEl.value.trim()
      });
      if (summaryEl) summaryEl.removeAttribute('hidden');
    });
  }

<<<<<<< HEAD
=======
  // ── Validate
>>>>>>> 8cadb3377467d427079034c5e6fa00411f78e766
  function validateContactForm() {
    let valid = true;

    if (!nameEl || !nameEl.value.trim()) {
      setInvalid(nameEl, nameErr, 'Please enter your name.');
      valid = false;
    } else {
      setValid(nameEl, nameErr);
    }

<<<<<<< HEAD
    if (!emailEl || !emailEl.value.trim()) {
      setInvalid(emailEl, emailErr, 'Please enter your email address.');
      valid = false;
    } else if (!isValidEmail(emailEl.value)) {
      setInvalid(emailEl, emailErr, 'Please enter a valid email address.');
      valid = false;
    } else {
=======
    if (!phoneEl || !phoneEl.value.trim()) {
      setInvalid(phoneEl, phoneErr, 'Please enter your phone number.');
      valid = false;
    } else if (!isValidIndianPhone(phoneEl.value)) {
      setInvalid(phoneEl, phoneErr, 'Enter a valid 10-digit Indian mobile number.');
      valid = false;
    } else {
      setValid(phoneEl, phoneErr);
    }

    if (emailEl && emailEl.value.trim()) {
      if (!isValidEmail(emailEl.value)) {
        setInvalid(emailEl, emailErr, 'Please enter a valid email address.');
        valid = false;
      } else {
        setValid(emailEl, emailErr);
      }
    } else if (emailEl) {
>>>>>>> 8cadb3377467d427079034c5e6fa00411f78e766
      setValid(emailEl, emailErr);
    }

    if (!subjectEl || !subjectEl.value.trim()) {
      setInvalid(subjectEl, subjectErr, 'Please enter a subject.');
      valid = false;
    } else {
      setValid(subjectEl, subjectErr);
    }

    if (!msgEl || !msgEl.value.trim()) {
      setInvalid(msgEl, msgErr, 'Please write your message.');
      valid = false;
    } else {
      setValid(msgEl, msgErr);
    }

    return valid;
  }

<<<<<<< HEAD
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!validateContactForm()) return;

    const payload = {
      name: nameEl.value.trim(),
      email: emailEl.value.trim(),
      subject: subjectEl.value.trim(),
      message: msgEl.value.trim()
    };

    const submitBtn = qs('button[type="submit"]', form);
    const originalText = submitBtn ? submitBtn.innerHTML : '';

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="icon-sm" data-lucide="loader"></span> Sending...';
      initIcons();
    }

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Unable to send the message right now.');
      }
      if (statusEl) {
        statusEl.textContent = data.message || 'Your message has been sent successfully.';
        statusEl.classList.add('success');
        statusEl.classList.remove('error');
      }
      form.reset();
      if (summaryEl) summaryEl.setAttribute('hidden', 'hidden');
    } catch (error) {
      if (statusEl) {
        statusEl.textContent = error.message || 'Something went wrong. Please try again.';
        statusEl.classList.add('error');
        statusEl.classList.remove('success');
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
        initIcons();
      }
    }
  });

  [nameEl, emailEl, subjectEl, msgEl].forEach(el => {
=======
  // ── Submit → WhatsApp
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (!validateContactForm()) return;

    const name    = nameEl.value.trim();
    const phone   = phoneEl.value.trim();
    const email   = emailEl && emailEl.value.trim() ? emailEl.value.trim() : '';
    const subject = subjectEl.value.trim();
    const message = msgEl.value.trim();

    const lines = [
      '📨 *Contact Message – Sri Devi One Saloon*',
      '',
      `*Name:* ${name}`,
      `*Phone:* ${phone}`,
      email ? `*Email:* ${email}` : '',
      `*Subject:* ${subject}`,
      `*Message:* ${message}`,
      '',
      '_Sent from the Sri Devi One Saloon website contact form._'
    ].filter(l => l !== '');

    const encoded = encodeURIComponent(lines.join('\n'));
    window.open(`https://wa.me/${WHATSAPP_ENQUIRY}?text=${encoded}`, '_blank', 'noopener,noreferrer');
  });

  // Clear errors on input
  [nameEl, phoneEl, emailEl, subjectEl, msgEl].forEach(el => {
>>>>>>> 8cadb3377467d427079034c5e6fa00411f78e766
    if (!el) return;
    el.addEventListener('input', () => {
      const errId = el.getAttribute('aria-describedby');
      if (errId) clearError(qs(`#${errId}`));
      el.removeAttribute('aria-invalid');
    });
  });
}

/* ═══════════════════════════════════════════════
   15. BUILD SUMMARY HELPER (shared by forms)
═══════════════════════════════════════════════ */
function buildSummary(containerEl, data) {
  if (!containerEl) return;
  containerEl.innerHTML = '';
  Object.entries(data).forEach(([label, value]) => {
    if (!value) return;
    const row = document.createElement('div');
    row.className = 'summary-row';
    row.innerHTML = `
      <span class="summary-label">${escapeHtml(label)}:</span>
      <span class="summary-value">${escapeHtml(String(value))}</span>
    `;
    containerEl.appendChild(row);
  });
}

/**
 * Escape HTML to prevent XSS in summary display.
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ═══════════════════════════════════════════════
   16. MIN DATE FOR BOOKING FORM
       (also done inside initBookingForm but set
        up here for any date inputs we might add)
═══════════════════════════════════════════════ */
function initDateMinimums() {
  const today = todayString();
  qsa('input[type="date"]').forEach(el => {
    if (!el.min) el.min = today;
  });
}

/* ═══════════════════════════════════════════════
   17. IMAGE FALLBACKS
═══════════════════════════════════════════════ */
function initImageFallbacks() {
  qsa('img[onerror]').forEach(img => {
    // onerror is inline; we also observe for late failures
    img.addEventListener('error', () => {
      const parent = img.parentElement;
      if (parent && !parent.classList.contains('img-fallback') && !parent.classList.contains('hero-img-fallback')) {
        parent.classList.add('img-fallback');
      }
    });
  });
}

/* ═══════════════════════════════════════════════
   18. HERO IMAGE REVEAL (progressive enhancement)
═══════════════════════════════════════════════ */
function initHeroImageReveal() {
  const heroImg = qs('.hero-img');
  if (!heroImg) return;

  if (heroImg.complete) {
    heroImg.style.opacity = '1';
    return;
  }

  heroImg.style.opacity = '0';
  heroImg.style.transition = 'opacity 0.5s ease';
  heroImg.addEventListener('load', () => {
    heroImg.style.opacity = '1';
  });
}

/* ═══════════════════════════════════════════════
   INITIALISE ALL MODULES
═══════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  initIcons();
  initCopyrightYear();
<<<<<<< HEAD
  initWelcomeBanner();
=======
>>>>>>> 8cadb3377467d427079034c5e6fa00411f78e766
  initStickyNav();
  initMobileMenu();
  initSmoothScroll();
  initActiveNav();
  initRevealAnimations();
  initBackToTop();
  initPriceFilter();
  initServiceBookButtons();
  initBookingForm();
  initReviewForm();
  initContactForm();
  initDateMinimums();
  initImageFallbacks();
  initHeroImageReveal();
});
