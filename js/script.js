/**
 * Sri Devi One Saloon — script.js
 * Complete vanilla JavaScript for the salon website.
 * ES6+ · No frameworks · No dependencies
 */

'use strict';

/* ═══════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════ */
const WHATSAPP_SALON = '917396144248';   // salon bookings
const WHATSAPP_ENQUIRY = '916301052228'; // general enquiries / contact form
const MAPS_URL = 'https://maps.app.goo.gl/aBQx16ErauUBKbtz6';

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
 * Validate a 10-digit Indian mobile number.
 * Accepts optional +91 / 91 prefix and spaces.
 */
function isValidIndianPhone(value) {
  const cleaned = value.replace(/[\s\-().]/g, '');
  return /^(?:\+91|91)?[6-9]\d{9}$/.test(cleaned);
}

/**
 * Validate a basic email address.
 */
function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/**
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
  const serviceEl = qs('#booking-service', form);
  const dateEl    = qs('#booking-date', form);
  const timeEl    = qs('#booking-time', form);
  const msgEl     = qs('#booking-message', form);

  const nameErr    = qs('#booking-name-error');
  const phoneErr   = qs('#booking-phone-error');
  const serviceErr = qs('#booking-service-error');
  const dateErr    = qs('#booking-date-error');
  const timeErr    = qs('#booking-time-error');

  const summaryEl        = qs('#booking-summary');
  const summaryDetails   = qs('#summary-details', summaryEl);
  const previewBtn       = qs('#preview-booking-btn');

  // Set minimum date to today
  if (dateEl) dateEl.min = todayString();

  // ── Preview
  if (previewBtn) {
    previewBtn.addEventListener('click', () => {
      if (!validateBookingForm()) return;
      buildSummary(summaryDetails, {
        'Name':    nameEl.value.trim(),
        'Phone':   phoneEl.value.trim(),
        'Service': serviceEl.value,
        'Date':    dateEl.value,
        'Time':    timeEl.value,
        'Note':    msgEl ? msgEl.value.trim() : ''
      });
      if (summaryEl) summaryEl.removeAttribute('hidden');
    });
  }

  // ── Validate
  function validateBookingForm() {
    let valid = true;

    // Name
    if (!nameEl || !nameEl.value.trim()) {
      setInvalid(nameEl, nameErr, 'Please enter your name.');
      valid = false;
    } else {
      setValid(nameEl, nameErr);
    }

    // Phone
    if (!phoneEl || !phoneEl.value.trim()) {
      setInvalid(phoneEl, phoneErr, 'Please enter your phone number.');
      valid = false;
    } else if (!isValidIndianPhone(phoneEl.value)) {
      setInvalid(phoneEl, phoneErr, 'Enter a valid 10-digit Indian mobile number.');
      valid = false;
    } else {
      setValid(phoneEl, phoneErr);
    }

    // Service
    if (!serviceEl || !serviceEl.value) {
      setInvalid(serviceEl, serviceErr, 'Please select a service.');
      valid = false;
    } else {
      setValid(serviceEl, serviceErr);
    }

    // Date
    if (!dateEl || !dateEl.value) {
      setInvalid(dateEl, dateErr, 'Please select a preferred date.');
      valid = false;
    } else if (dateEl.value < todayString()) {
      setInvalid(dateEl, dateErr, 'Please select today or a future date.');
      valid = false;
    } else {
      setValid(dateEl, dateErr);
    }

    // Time
    if (!timeEl || !timeEl.value) {
      setInvalid(timeEl, timeErr, 'Please select a preferred time.');
      valid = false;
    } else {
      setValid(timeEl, timeErr);
    }

    return valid;
  }

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

  // ── Submit → WhatsApp
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
    window.open(`https://wa.me/${WHATSAPP_SALON}?text=${message}`, '_blank', 'noopener,noreferrer');
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
  const phoneEl   = qs('#contact-phone', form);
  const emailEl   = qs('#contact-email', form);
  const subjectEl = qs('#contact-subject', form);
  const msgEl     = qs('#contact-message', form);

  const nameErr    = qs('#contact-name-error');
  const phoneErr   = qs('#contact-phone-error');
  const emailErr   = qs('#contact-email-error');
  const subjectErr = qs('#contact-subject-error');
  const msgErr     = qs('#contact-message-error');

  const summaryEl      = qs('#contact-summary');
  const summaryDetails = qs('#contact-summary-details', summaryEl);
  const previewBtn     = qs('#preview-contact-btn');

  // ── Preview
  if (previewBtn) {
    previewBtn.addEventListener('click', () => {
      if (!validateContactForm()) return;
      buildSummary(summaryDetails, {
        'Name':    nameEl.value.trim(),
        'Phone':   phoneEl.value.trim(),
        'Email':   emailEl && emailEl.value.trim() ? emailEl.value.trim() : '—',
        'Subject': subjectEl.value.trim(),
        'Message': msgEl.value.trim()
      });
      if (summaryEl) summaryEl.removeAttribute('hidden');
    });
  }

  // ── Validate
  function validateContactForm() {
    let valid = true;

    if (!nameEl || !nameEl.value.trim()) {
      setInvalid(nameEl, nameErr, 'Please enter your name.');
      valid = false;
    } else {
      setValid(nameEl, nameErr);
    }

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
