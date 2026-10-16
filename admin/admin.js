/**
 * Sri Devi One Saloon — Admin Portal & CMS Engine
 * Handles tabs, KPI dashboards, appointments management, service CRUD,
 * bulk price updates, content CMS, gallery uploads, email templates, and security.
 */

document.addEventListener('DOMContentLoaded', () => {
  // ══════════════════════════════════════════════════════════════════
  // 1. STATE & GLOBAL UTILITIES
  // ══════════════════════════════════════════════════════════════════
  let currentAdmin = null;
  let allServices = [];
  let allAppointments = [];
  let emailTemplates = {};
  let currentTab = 'dashboard';

  // Format currency
  const formatINR = (val) => {
    return '₹' + Number(val || 0).toLocaleString('en-IN');
  };

  // Toast Notification
  const showToast = (message, type = 'success') => {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const iconName = type === 'success' ? 'check-circle' : type === 'danger' ? 'alert-triangle' : 'info';
    toast.innerHTML = `
      <span data-lucide="${iconName}" style="width: 18px; height: 18px; flex-shrink: 0;"></span>
      <span>${message}</span>
    `;
    container.appendChild(toast);
    if (window.lucide) lucide.createIcons();

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  };

  // Modal helpers
  const openModal = (id) => {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.add('active');
      if (window.lucide) lucide.createIcons();
    }
  };

  const closeModal = (id) => {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('active');
  };

  // Bind all close buttons
  document.querySelectorAll('[data-close-modal]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const modal = e.target.closest('.modal-backdrop');
      if (modal) modal.classList.remove('active');
    });
  });

  // Close modal when clicking on backdrop
  document.querySelectorAll('.modal-backdrop').forEach((modal) => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('active');
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // 2. LIVE CLOCK (IST)
  // ══════════════════════════════════════════════════════════════════
  const updateClock = () => {
    const clockEl = document.getElementById('live-clock');
    if (!clockEl) return;
    const options = {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    };
    clockEl.textContent = new Intl.DateTimeFormat('en-IN', options).format(new Date()) + ' IST';
  };
  updateClock();
  setInterval(updateClock, 1000);

  // ══════════════════════════════════════════════════════════════════
  // 3. NAVIGATION & TABS
  // ══════════════════════════════════════════════════════════════════
  const titles = {
    dashboard: 'Dashboard Overview',
    appointments: 'Appointments Management',
    services: 'Service Catalogue Management',
    prices: 'Price List & Bulk Pricing',
    content: 'Website Content & CMS',
    gallery: 'Photo Gallery & Media',
    templates: 'Email Templates & Automation',
    activity: 'Audit & Activity Logs',
    settings: 'Admin Account & Security',
  };

  const switchTab = (tabName) => {
    currentTab = tabName;
    document.querySelectorAll('.nav-item').forEach((item) => {
      item.classList.toggle('active', item.dataset.tab === tabName);
    });

    document.querySelectorAll('.tab-pane').forEach((pane) => {
      pane.classList.toggle('active', pane.id === `pane-${tabName}`);
    });

    const heading = document.getElementById('page-heading');
    if (heading && titles[tabName]) {
      heading.textContent = titles[tabName];
    }

    // Close mobile drawer if open
    const sidebar = document.getElementById('app-sidebar');
    const overlay = document.getElementById('mobile-overlay');
    if (sidebar && overlay) {
      sidebar.classList.remove('mobile-open');
      overlay.style.display = 'none';
    }

    // Tab-specific refreshes
    if (tabName === 'dashboard') loadDashboardStats();
    if (tabName === 'appointments') loadAppointments();
    if (tabName === 'services') loadServices();
    if (tabName === 'prices') loadPriceList();
    if (tabName === 'content') loadSiteContent();
    if (tabName === 'gallery') loadGallery();
    if (tabName === 'templates') loadTemplates();
    if (tabName === 'activity') loadActivityLogs();

    if (window.lucide) lucide.createIcons();
  };

  document.querySelectorAll('#sidebar-nav .nav-item').forEach((item) => {
    item.addEventListener('click', () => switchTab(item.dataset.tab));
  });

  // Sidebar Controls (Mobile Drawer & Desktop Collapsible)
  const mobileToggleBtn = document.getElementById('mobile-toggle-btn');
  const desktopSidebarToggleBtn = document.getElementById('desktop-sidebar-toggle-btn');
  const sidebarEl = document.getElementById('app-sidebar');
  const mobileOverlay = document.getElementById('mobile-overlay');
  const mainEl = document.querySelector('.app-main');

  // Mobile Drawer Toggle
  if (mobileToggleBtn && sidebarEl && mobileOverlay) {
    mobileToggleBtn.addEventListener('click', () => {
      const isOpen = sidebarEl.classList.toggle('mobile-open');
      mobileOverlay.style.display = isOpen ? 'block' : 'none';
    });
    mobileOverlay.addEventListener('click', () => {
      sidebarEl.classList.remove('mobile-open');
      mobileOverlay.style.display = 'none';
    });
  }

  // Desktop Sidebar Collapse Toggle
  const applySidebarCollapse = (collapsed) => {
    if (!sidebarEl || !mainEl) return;
    sidebarEl.classList.toggle('collapsed', collapsed);
    mainEl.classList.toggle('sidebar-collapsed', collapsed);
    localStorage.setItem('sridevi_admin_sidebar_collapsed', collapsed ? 'true' : 'false');
    const toggleIcon = document.getElementById('sidebar-toggle-icon');
    if (toggleIcon) {
      toggleIcon.setAttribute('data-lucide', collapsed ? 'panel-left-open' : 'panel-left-close');
      if (window.lucide) lucide.createIcons();
    }
  };

  const isCollapsedInitial = localStorage.getItem('sridevi_admin_sidebar_collapsed') === 'true';
  if (isCollapsedInitial && window.innerWidth >= 1024) {
    applySidebarCollapse(true);
  }

  if (desktopSidebarToggleBtn) {
    desktopSidebarToggleBtn.addEventListener('click', () => {
      const isCurrentlyCollapsed = sidebarEl.classList.contains('collapsed');
      applySidebarCollapse(!isCurrentlyCollapsed);
    });
  }

  // Keyboard shortcut: Escape closes mobile drawer or active modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (sidebarEl && sidebarEl.classList.contains('mobile-open')) {
        sidebarEl.classList.remove('mobile-open');
        if (mobileOverlay) mobileOverlay.style.display = 'none';
      }
      document.querySelectorAll('.modal-backdrop.active').forEach((modal) => {
        modal.classList.remove('active');
      });
    }
  });

  // Global Image Lightbox Previewer
  window.previewFullImage = (url, title = 'Salon Image Preview') => {
    if (!url) return;
    const lightboxImg = document.getElementById('lightbox-img');
    const lightboxTitle = document.getElementById('lightbox-title');
    const lightboxInfo = document.getElementById('lightbox-info');
    if (lightboxImg) lightboxImg.src = url;
    if (lightboxTitle) lightboxTitle.textContent = title;
    if (lightboxInfo) lightboxInfo.textContent = url.split('/').pop() || '';
    openModal('modal-view-image');
  };

  // Quick Action Buttons
  const qaMap = {
    'qa-add-service': () => {
      switchTab('services');
      openAddServiceModal();
    },
    'qa-view-appointments': () => switchTab('appointments'),
    'qa-update-prices': () => switchTab('prices'),
    'qa-edit-content': () => switchTab('content'),
    'qa-upload-images': () => switchTab('gallery'),
    'qa-manage-reminders': () => switchTab('templates'),
    'qa-change-password': () => switchTab('settings'),
    'banner-change-pwd-btn': () => switchTab('settings'),
    'view-all-bookings-btn': () => switchTab('appointments'),
  };

  Object.entries(qaMap).forEach(([id, handler]) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', handler);
  });

  // ══════════════════════════════════════════════════════════════════
  // 4. AUTHENTICATION & SESSION MANAGEMENT
  // ══════════════════════════════════════════════════════════════════
  const checkAuth = async () => {
    try {
      const res = await fetch('/api/admin/me');
      if (res.status === 401 || res.status === 403) {
        window.location.href = '/admin/login';
        return;
      }
      const data = await res.json();
      if (!data.success || !data.admin) {
        window.location.href = '/admin/login';
        return;
      }

      currentAdmin = data.admin;

      // Update sidebar details
      const usernameEl = document.getElementById('sidebar-username');
      const avatarEl = document.getElementById('sidebar-avatar');
      if (usernameEl) usernameEl.textContent = currentAdmin.username;
      if (avatarEl) avatarEl.textContent = (currentAdmin.username || 'A')[0].toUpperCase();

      // Update settings fields
      const profUser = document.getElementById('prof-username');
      const profEmail = document.getElementById('prof-email');
      if (profUser) profUser.value = currentAdmin.username || '';
      if (profEmail) profEmail.value = currentAdmin.email || '';

      // Force password warning banner if default password still active
      const banner = document.getElementById('password-warning-banner');
      if (banner) {
        banner.style.display = currentAdmin.must_change_password ? 'flex' : 'none';
      }

      // Initial stats load
      loadDashboardStats();
    } catch (err) {
      console.error('Auth verification error:', err);
      window.location.href = '/admin/login';
    }
  };

  // Sign out
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await fetch('/api/admin/logout', { method: 'POST' });
      } catch (err) {
        console.error('Logout error:', err);
      } finally {
        window.location.href = '/admin/login';
      }
    });
  }

  // ══════════════════════════════════════════════════════════════════
  // 5. DASHBOARD KPI & RECENT BOOKINGS
  // ══════════════════════════════════════════════════════════════════
  const loadDashboardStats = async () => {
    try {
      const res = await fetch('/api/admin/stats');
      const data = await res.json();
      if (!data.success) return;

      const { stats, recent_appointments } = data;

      document.getElementById('stat-total').textContent = stats.total_appointments || 0;
      document.getElementById('stat-today').textContent = stats.today_appointments || 0;
      document.getElementById('stat-upcoming').textContent = stats.upcoming_appointments || 0;
      document.getElementById('stat-completed').textContent = stats.completed_appointments || 0;
      document.getElementById('stat-services').textContent = stats.active_services || 0;
      document.getElementById('stat-pending-emails').textContent = stats.pending_emails || 0;

      renderRecentBookings(recent_appointments || []);
      if (window.lucide) lucide.createIcons();
    } catch (err) {
      console.error('Error loading dashboard stats:', err);
    }
  };

  const renderRecentBookings = (items) => {
    const tbody = document.getElementById('recent-bookings-tbody');
    if (!tbody) return;

    if (!items.length) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--clr-text-muted); padding:25px;">No appointments recorded yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = items
      .map((item) => {
        let servicesLabel = item.service || '';
        try {
          if (item.services_json) {
            const parsed = JSON.parse(item.services_json);
            if (Array.isArray(parsed) && parsed.length > 0) {
              servicesLabel = parsed.map((s) => s.name).join(', ');
            }
          }
        } catch (e) {}

        const statusClass =
          item.status === 'confirmed'
            ? 'badge-active'
            : item.status === 'completed'
            ? 'badge-category'
            : item.status === 'cancelled'
            ? 'badge-inactive'
            : 'badge-discount';

        return `
          <tr>
            <td><strong>#${item.id}</strong></td>
            <td>
              <div style="font-weight:600; color:#fff;">${escapeHtml(item.name)}</div>
              <div style="font-size:11px; color:var(--clr-text-muted);">${escapeHtml(item.email)}</div>
            </td>
            <td>${escapeHtml(item.phone || '—')}</td>
            <td style="max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${escapeHtml(servicesLabel)}">
              ${escapeHtml(servicesLabel)}
            </td>
            <td style="color:var(--clr-gold); font-weight:700;">${formatINR(item.total_price)}</td>
            <td>
              <div>${item.appointment_date}</div>
              <div style="font-size:11px; color:var(--clr-text-muted);">${item.appointment_time}</div>
            </td>
            <td><span class="badge ${statusClass}">${item.status}</span></td>
            <td>
              <button type="button" class="btn btn-secondary btn-sm" onclick="window.viewAppointmentDetails(${item.id})">
                <span data-lucide="eye" style="width:13px; height:13px;"></span>
              </button>
            </td>
          </tr>
        `;
      })
      .join('');

    if (window.lucide) lucide.createIcons();
  };

  // ══════════════════════════════════════════════════════════════════
  // 6. APPOINTMENTS MANAGEMENT (FULL CRUD & PAGINATION)
  // ══════════════════════════════════════════════════════════════════
  let appointmentsPage = 1;
  const appointmentsPerPage = 10;
  let appointmentsSort = 'date-desc';

  // Format 24-hour time to 12-hour AM/PM
  const format12Hour = (time24) => {
    if (!time24) return '--:--';
    const parts = time24.split(':');
    if (parts.length < 2) return time24;
    let h = parseInt(parts[0], 10);
    const m = parts[1];
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${m} ${ampm}`;
  };

  const sortAppointmentsList = (list, sortMode) => {
    const arr = [...list];
    if (sortMode === 'date-desc') {
      arr.sort((a, b) => (b.appointment_date + ' ' + (b.appointment_time || '')).localeCompare(a.appointment_date + ' ' + (a.appointment_time || '')));
    } else if (sortMode === 'date-asc') {
      arr.sort((a, b) => (a.appointment_date + ' ' + (a.appointment_time || '')).localeCompare(b.appointment_date + ' ' + (b.appointment_time || '')));
    } else if (sortMode === 'name-asc') {
      arr.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else if (sortMode === 'price-desc') {
      arr.sort((a, b) => (b.total_price || 0) - (a.total_price || 0));
    }
    return arr;
  };

  window.changeAppointmentsPage = (page) => {
    appointmentsPage = page;
    renderAppointments(allAppointments);
  };

  const loadAppointments = async () => {
    try {
      const search = document.getElementById('appointment-search')?.value.trim() || '';
      const status = document.getElementById('appointment-status-filter')?.value || '';
      const date = document.getElementById('appointment-date-filter')?.value || '';

      const queryParams = new URLSearchParams();
      if (search) queryParams.set('q', search);
      if (status) queryParams.set('status', status);
      if (date) queryParams.set('date', date);

      const res = await fetch(`/api/admin/appointments?${queryParams.toString()}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      allAppointments = data.appointments || [];
      appointmentsPage = 1;
      renderAppointments(allAppointments);
    } catch (err) {
      console.error('Error fetching appointments:', err);
      showToast('Failed to load appointments.', 'danger');
    }
  };

  const renderAppointments = (items) => {
    const tbody = document.getElementById('appointments-tbody');
    const paginationInfo = document.getElementById('appointments-pagination-info');
    const paginationControls = document.getElementById('appointments-pagination-controls');
    if (!tbody) return;

    if (!items.length) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:var(--clr-text-muted); padding:30px;">No appointments matching the selected filters.</td></tr>`;
      if (paginationInfo) paginationInfo.textContent = 'Showing 0 of 0 appointments';
      if (paginationControls) paginationControls.innerHTML = '';
      return;
    }

    const sorted = sortAppointmentsList(items, appointmentsSort);
    const totalItems = sorted.length;
    const totalPages = Math.ceil(totalItems / appointmentsPerPage) || 1;
    if (appointmentsPage > totalPages) appointmentsPage = totalPages;
    if (appointmentsPage < 1) appointmentsPage = 1;

    const startIndex = (appointmentsPage - 1) * appointmentsPerPage;
    const endIndex = Math.min(startIndex + appointmentsPerPage, totalItems);
    const pagedItems = sorted.slice(startIndex, endIndex);

    if (paginationInfo) {
      paginationInfo.textContent = `Showing ${startIndex + 1}–${endIndex} of ${totalItems} appointments (Page ${appointmentsPage} of ${totalPages})`;
    }

    if (paginationControls) {
      let btns = `
        <button type="button" class="page-btn" ${appointmentsPage === 1 ? 'disabled' : ''} onclick="window.changeAppointmentsPage(${appointmentsPage - 1})">Prev</button>
      `;
      for (let p = 1; p <= totalPages; p++) {
        if (p === 1 || p === totalPages || (p >= appointmentsPage - 1 && p <= appointmentsPage + 1)) {
          btns += `<button type="button" class="page-btn ${p === appointmentsPage ? 'active' : ''}" onclick="window.changeAppointmentsPage(${p})">${p}</button>`;
        } else if (p === appointmentsPage - 2 || p === appointmentsPage + 2) {
          btns += `<span style="padding:0 3px; color:var(--clr-text-muted);">…</span>`;
        }
      }
      btns += `
        <button type="button" class="page-btn" ${appointmentsPage === totalPages ? 'disabled' : ''} onclick="window.changeAppointmentsPage(${appointmentsPage + 1})">Next</button>
      `;
      paginationControls.innerHTML = btns;
    }

    tbody.innerHTML = pagedItems
      .map((item) => {
        let servicesLabel = item.service || '';
        try {
          if (item.services_json) {
            const parsed = JSON.parse(item.services_json);
            if (Array.isArray(parsed) && parsed.length > 0) {
              servicesLabel = parsed.map((s) => s.name).join(', ');
            }
          }
        } catch (e) {}

        const statusClass =
          item.status === 'confirmed'
            ? 'badge-active'
            : item.status === 'completed'
            ? 'badge-category'
            : item.status === 'cancelled'
            ? 'badge-inactive'
            : 'badge-discount';

        const confDelivery = item.conf_delivery || 'sent';
        const followDelivery = item.followup_delivery || 'scheduled';
        const displayTime = format12Hour(item.appointment_time);

        return `
          <tr>
            <td><strong>#${item.id}</strong></td>
            <td>
              <div style="font-weight:600; color:#fff;">${escapeHtml(item.name)}</div>
            </td>
            <td>
              <div>${escapeHtml(item.phone || '—')}</div>
              <div style="font-size:11px; color:var(--clr-text-muted);">${escapeHtml(item.email)}</div>
            </td>
            <td style="max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${escapeHtml(servicesLabel)}">
              ${escapeHtml(servicesLabel)}
            </td>
            <td style="color:var(--clr-gold); font-weight:700;">${formatINR(item.total_price)}</td>
            <td>
              <div style="font-weight:600;">${item.appointment_date}</div>
              <div style="font-size:11px; color:var(--clr-gold-light); font-weight:500;">${displayTime}</div>
            </td>
            <td><span class="badge ${statusClass}">${item.status}</span></td>
            <td>
              <div style="font-size:11px; display:flex; flex-direction:column; gap:2px;">
                <span>Conf: <strong style="color:${confDelivery === 'sent' ? '#10b981' : '#f59e0b'};">${confDelivery}</strong></span>
                <span>Follow: <strong style="color:${followDelivery === 'sent' ? '#10b981' : '#94a3b8'};">${followDelivery}</strong></span>
              </div>
            </td>
            <td>
              <div style="display:flex; gap:6px;">
                <button type="button" class="btn btn-secondary btn-sm" onclick="window.viewAppointmentDetails(${item.id})" title="View Details">
                  <span data-lucide="eye" style="width:13px; height:13px;"></span>
                </button>
                <button type="button" class="btn btn-secondary btn-sm" onclick="window.openEditCustomerModal(${item.id})" title="Edit Customer Details">
                  <span data-lucide="user-check" style="width:13px; height:13px; color:#10b981;"></span>
                </button>
                <button type="button" class="btn btn-secondary btn-sm" onclick="window.openRescheduleModal(${item.id})" title="Reschedule Date & Time">
                  <span data-lucide="calendar" style="width:13px; height:13px; color:#60a5fa;"></span>
                </button>
                <button type="button" class="btn btn-secondary btn-sm" onclick="window.updateAppointmentStatusPrompt(${item.id}, '${item.status}')" title="Change Booking Status">
                  <span data-lucide="edit-2" style="width:13px; height:13px; color:var(--clr-gold);"></span>
                </button>
              </div>
            </td>
          </tr>
        `;
      })
      .join('');

    if (window.lucide) lucide.createIcons();
  };

  // Search & Filter event bindings
  document.getElementById('appointment-search')?.addEventListener('input', debounce(loadAppointments, 350));
  document.getElementById('appointment-status-filter')?.addEventListener('change', loadAppointments);
  document.getElementById('appointment-date-filter')?.addEventListener('change', loadAppointments);
  document.getElementById('appointment-sort')?.addEventListener('change', (e) => {
    appointmentsSort = e.target.value;
    appointmentsPage = 1;
    renderAppointments(allAppointments);
  });

  // Edit Customer Details Modal
  window.openEditCustomerModal = (id) => {
    const apt = allAppointments.find((a) => a.id === id);
    if (!apt) return;

    document.getElementById('edit-apt-id').textContent = apt.id;
    document.getElementById('edit-apt-hidden-id').value = apt.id;
    document.getElementById('edit-apt-name').value = apt.name || '';
    document.getElementById('edit-apt-phone').value = apt.phone || '';
    document.getElementById('edit-apt-email').value = apt.email || '';
    document.getElementById('edit-apt-notes').value = apt.notes || '';

    openModal('modal-edit-appointment');
  };

  document.getElementById('edit-appointment-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById('edit-apt-save-btn');
    const id = document.getElementById('edit-apt-hidden-id').value;
    const name = document.getElementById('edit-apt-name').value.trim();
    const phone = document.getElementById('edit-apt-phone').value.trim();
    const email = document.getElementById('edit-apt-email').value.trim();
    const notes = document.getElementById('edit-apt-notes').value.trim();

    try {
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving Changes...';
      }
      const res = await fetch(`/api/admin/appointments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, email, notes }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      showToast('Customer contact details updated successfully!');
      closeModal('modal-edit-appointment');
      loadAppointments();
    } catch (err) {
      showToast(err.message || 'Update failed', 'danger');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Customer Details';
      }
    }
  });

  // View Details Modal
  window.viewAppointmentDetails = async (id) => {
    try {
      const res = await fetch(`/api/admin/appointments/${id}`);
      const data = await res.json();
      if (!data.success || !data.appointment) throw new Error(data.error);

      const apt = data.appointment;
      const logs = data.notification_logs || [];

      document.getElementById('dtl-apt-id').textContent = apt.id;

      let servicesRows = '';
      try {
        const parsed = JSON.parse(apt.services_json || '[]');
        if (Array.isArray(parsed) && parsed.length > 0) {
          servicesRows = parsed
            .map(
              (s) => `
              <div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
                <span>${escapeHtml(s.name)}</span>
                <strong style="color:var(--clr-gold);">${formatINR(s.price)}</strong>
              </div>
            `
            )
            .join('');
        }
      } catch (e) {}

      if (!servicesRows) {
        servicesRows = `<div style="padding:6px 0;">${escapeHtml(apt.service)} (${formatINR(apt.total_price)})</div>`;
      }

      let logsHtml = '';
      if (logs.length > 0) {
        logsHtml = logs
          .map(
            (log) => `
            <div style="font-size:12px; display:flex; justify-content:space-between; padding:4px 0;">
              <span>${escapeHtml(log.notification_type)}</span>
              <span style="color:${log.status === 'sent' ? '#10b981' : log.status === 'failed' ? '#ef4444' : '#f59e0b'};">
                ${log.status.toUpperCase()} (${log.sent_at || log.scheduled_for || 'pending'})
              </span>
            </div>
          `
          )
          .join('');
      } else {
        logsHtml = '<div style="font-size:12px; color:var(--clr-text-muted);">No notification logs recorded yet.</div>';
      }

      const formattedTime = format12Hour(apt.appointment_time);
      const bodyEl = document.getElementById('dtl-apt-body');
      bodyEl.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; background:rgba(197,160,89,0.08); padding:10px 14px; border-radius:var(--radius-sm); border:1px solid var(--clr-border-gold);">
          <div>
            <span style="font-size:11px; text-transform:uppercase; color:var(--clr-gold); font-weight:700;">Customer Details</span>
            <div style="font-size:15px; font-weight:700; color:#fff;">${escapeHtml(apt.name)}</div>
          </div>
          <button type="button" class="btn btn-secondary btn-sm" onclick="closeModal('modal-appointment-details'); window.openEditCustomerModal(${apt.id});">
            <span data-lucide="edit-3" style="width:13px; height:13px;"></span> Edit Customer Info
          </button>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:18px;">
          <div>
            <span style="font-size:11px; text-transform:uppercase; color:var(--clr-text-muted); font-weight:700;">Booking Status</span>
            <div><span class="badge badge-active">${apt.status.toUpperCase()}</span></div>
          </div>
          <div>
            <span style="font-size:11px; text-transform:uppercase; color:var(--clr-text-muted); font-weight:700;">Phone Number</span>
            <div style="color:#fff;">${escapeHtml(apt.phone || 'None provided')}</div>
          </div>
          <div>
            <span style="font-size:11px; text-transform:uppercase; color:var(--clr-text-muted); font-weight:700;">Email Address</span>
            <div style="color:#fff;">${escapeHtml(apt.email)}</div>
          </div>
          <div>
            <span style="font-size:11px; text-transform:uppercase; color:var(--clr-text-muted); font-weight:700;">Date & Time (12-Hour)</span>
            <div style="color:#fff; font-weight:600;">${apt.appointment_date} at <span style="color:var(--clr-gold-light);">${formattedTime}</span></div>
          </div>
          <div>
            <span style="font-size:11px; text-transform:uppercase; color:var(--clr-text-muted); font-weight:700;">Calculated Duration</span>
            <div style="color:#fff;">${apt.duration_minutes || 60} mins</div>
          </div>
        </div>

        <div style="background:var(--clr-bg-input); border:1px solid var(--clr-border); border-radius:var(--radius-md); padding:14px; margin-bottom:16px;">
          <h4 style="font-size:12px; text-transform:uppercase; color:var(--clr-gold); font-weight:700; margin-bottom:8px;">Selected Services</h4>
          ${servicesRows}
          <div style="display:flex; justify-content:space-between; margin-top:10px; padding-top:8px; border-top:1px solid var(--clr-border); font-size:15px; font-weight:700;">
            <span style="color:#fff;">Total Confirmed Price:</span>
            <span style="color:var(--clr-gold);">${formatINR(apt.total_price)}</span>
          </div>
        </div>

        ${
          apt.notes
            ? `<div style="margin-bottom:16px;">
                <span style="font-size:11px; text-transform:uppercase; color:var(--clr-text-muted); font-weight:700;">Special Instructions / Notes</span>
                <p style="font-size:13px; color:#e0e4eb; background:rgba(255,255,255,0.03); padding:10px; border-radius:6px; margin-top:4px;">${escapeHtml(apt.notes)}</p>
              </div>`
            : ''
        }

        <div style="background:var(--clr-bg-input); border:1px solid var(--clr-border); border-radius:var(--radius-md); padding:14px; margin-bottom:16px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <h4 style="font-size:12px; text-transform:uppercase; color:var(--clr-gold); font-weight:700;">Notification Dispatch History</h4>
            <button type="button" class="btn btn-outline-gold btn-sm" onclick="window.resendConfirmationEmail(${apt.id})">
              Resend Confirmation
            </button>
          </div>
          ${logsHtml}
        </div>
      `;

      openModal('modal-appointment-details');
    } catch (err) {
      console.error('Error fetching appointment details:', err);
      showToast('Could not load appointment details.', 'danger');
    }
  };

  // Reschedule Modal
  window.openRescheduleModal = (id) => {
    const apt = allAppointments.find((a) => a.id === id);
    if (!apt) return;

    document.getElementById('resched-apt-id').textContent = apt.id;
    document.getElementById('resched-cust-name').textContent = apt.name;
    document.getElementById('resched-date').value = apt.appointment_date;
    document.getElementById('resched-time').value = apt.appointment_time;

    const form = document.getElementById('reschedule-form');
    form.onsubmit = async (e) => {
      e.preventDefault();
      const newDate = document.getElementById('resched-date').value;
      const newTime = document.getElementById('resched-time').value;

      try {
        const res = await fetch(`/api/admin/appointments/${id}/reschedule`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appointment_date: newDate, appointment_time: newTime }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);

        showToast('Appointment rescheduled successfully! Automated reminders recalculated.');
        closeModal('modal-reschedule');
        loadAppointments();
        loadDashboardStats();
      } catch (err) {
        showToast(err.message || 'Reschedule failed', 'danger');
      }
    };

    openModal('modal-reschedule');
  };

  // Change status prompt
  window.updateAppointmentStatusPrompt = (id, currentStatus) => {
    const newStatus = prompt(
      `Update status for Appointment #${id}
Choose: booked, confirmed, completed, cancelled`,
      currentStatus
    );
    if (!newStatus || newStatus === currentStatus) return;

    const valid = ['booked', 'confirmed', 'completed', 'cancelled', 'no_show'];
    if (!valid.includes(newStatus.toLowerCase())) {
      alert(`Invalid status. Must be one of: ${valid.join(', ')}`);
      return;
    }

    updateAppointmentStatus(id, newStatus.toLowerCase());
  };

  const updateAppointmentStatus = async (id, status) => {
    try {
      const res = await fetch(`/api/admin/appointments/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      showToast(`Appointment #${id} updated to ${status}.`);
      loadAppointments();
      loadDashboardStats();
    } catch (err) {
      showToast(err.message || 'Status update failed', 'danger');
    }
  };

  // Resend confirmation email
  window.resendConfirmationEmail = async (id) => {
    try {
      const res = await fetch(`/api/admin/appointments/${id}/resend-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_type: 'confirmation' }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      showToast('Confirmation email resent successfully!');
      window.viewAppointmentDetails(id);
    } catch (err) {
      showToast(err.message || 'Resend failed', 'danger');
    }
  };

  // Export CSV
  document.getElementById('export-appointments-csv')?.addEventListener('click', () => {
    if (!allAppointments.length) {
      showToast('No appointments to export.', 'info');
      return;
    }

    const headers = ['ID', 'Customer Name', 'Email', 'Phone', 'Services', 'Total Price', 'Date', 'Time (12-Hour)', 'Status'];
    const rows = allAppointments.map((a) => {
      let svc = a.service;
      try {
        if (a.services_json) {
          const p = JSON.parse(a.services_json);
          svc = p.map((x) => x.name).join(' + ');
        }
      } catch (e) {}

      return [
        a.id,
        `"${(a.name || '').replace(/"/g, '""')}"`,
        `"${(a.email || '').replace(/"/g, '""')}"`,
        `"${(a.phone || '').replace(/"/g, '""')}"`,
        `"${(svc || '').replace(/"/g, '""')}"`,
        a.total_price || 0,
        a.appointment_date,
        format12Hour(a.appointment_time),
        a.status,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `SriDeviOneSaloon_Appointments_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  });

  // ══════════════════════════════════════════════════════════════════
  // 7. SERVICES & PRICE LIST MANAGEMENT (FULL CRUD ENGINE)
  // ══════════════════════════════════════════════════════════════════
  let servicesPage = 1;
  const servicesPerPage = 8;
  let priceListPage = 1;
  const priceListPerPage = 8;
  let priceListMode = 'standard'; // 'standard' or 'bulk'
  let pendingDeleteServiceId = null;

  window.changeServicesPage = (page) => {
    servicesPage = page;
    renderServices(allServices);
  };

  window.changePriceListPage = (page) => {
    priceListPage = page;
    renderPriceList(allServices);
  };

  const loadServices = async () => {
    try {
      const res = await fetch('/api/admin/services?include_archived=true');
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      allServices = data.services || [];
      const activeCount = allServices.filter((s) => s.is_active && !s.is_archived).length;

      const badge = document.getElementById('services-count-badge');
      if (badge) badge.textContent = `${activeCount} Active Services`;

      const priceBadge = document.getElementById('prices-count-badge');
      if (priceBadge) priceBadge.textContent = `${allServices.length} Services`;

      renderServices(allServices);
      renderPriceList(allServices);
    } catch (err) {
      console.error('Error fetching services:', err);
      showToast('Failed to load services catalogue.', 'danger');
    }
  };

  const loadPriceList = async () => {
    await loadServices();
  };

  // Render Services Catalogue Tab Table
  const renderServices = (services) => {
    const tbody = document.getElementById('services-tbody');
    const paginationInfo = document.getElementById('services-pagination-info');
    const paginationControls = document.getElementById('services-pagination-controls');
    if (!tbody) return;

    const catFilter = document.getElementById('services-category-filter')?.value || '';
    const searchFilter = (document.getElementById('services-search')?.value || '').trim().toLowerCase();

    let filtered = services.filter((s) => !s.is_archived);
    if (catFilter) {
      filtered = filtered.filter((s) => s.category === catFilter);
    }
    if (searchFilter) {
      filtered = filtered.filter((s) => (s.name || '').toLowerCase().includes(searchFilter) || (s.id || '').toLowerCase().includes(searchFilter));
    }

    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:var(--clr-text-muted); padding:30px;">No services found matching filters.</td></tr>`;
      if (paginationInfo) paginationInfo.textContent = 'Showing 0 of 0 services';
      if (paginationControls) paginationControls.innerHTML = '';
      return;
    }

    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / servicesPerPage) || 1;
    if (servicesPage > totalPages) servicesPage = totalPages;
    if (servicesPage < 1) servicesPage = 1;

    const startIndex = (servicesPage - 1) * servicesPerPage;
    const endIndex = Math.min(startIndex + servicesPerPage, totalItems);
    const pagedServices = filtered.slice(startIndex, endIndex);

    if (paginationInfo) {
      paginationInfo.textContent = `Showing ${startIndex + 1}–${endIndex} of ${totalItems} services (Page ${servicesPage} of ${totalPages})`;
    }

    if (paginationControls) {
      let btns = `
        <button type="button" class="page-btn" ${servicesPage === 1 ? 'disabled' : ''} onclick="window.changeServicesPage(${servicesPage - 1})">Prev</button>
      `;
      for (let p = 1; p <= totalPages; p++) {
        if (p === 1 || p === totalPages || (p >= servicesPage - 1 && p <= servicesPage + 1)) {
          btns += `<button type="button" class="page-btn ${p === servicesPage ? 'active' : ''}" onclick="window.changeServicesPage(${p})">${p}</button>`;
        } else if (p === servicesPage - 2 || p === servicesPage + 2) {
          btns += `<span style="padding:0 3px; color:var(--clr-text-muted);">…</span>`;
        }
      }
      btns += `
        <button type="button" class="page-btn" ${servicesPage === totalPages ? 'disabled' : ''} onclick="window.changeServicesPage(${servicesPage + 1})">Next</button>
      `;
      paginationControls.innerHTML = btns;
    }

    tbody.innerHTML = pagedServices
      .map((svc) => {
        const imgSrc = svc.image_url || '/assets/logo.png';
        const isAct = Boolean(svc.is_active);

        return `
          <tr>
            <td>
              <img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(svc.name)}" class="service-table-img" onclick="window.previewFullImage('${escapeHtml(imgSrc)}', '${escapeHtml(svc.name)}')" title="Click to view full image" onerror="this.src='/assets/logo.png';" />
            </td>
            <td>
              <div style="font-weight:700; color:#fff;">${escapeHtml(svc.name)}</div>
              <div style="font-size:11px; color:var(--clr-text-muted); font-family:monospace;">${escapeHtml(svc.id)}</div>
            </td>
            <td><span class="badge badge-category">${escapeHtml(svc.category || 'Hair & Grooming')}</span></td>
            <td>${svc.duration_minutes || 30} mins</td>
            <td style="color:var(--clr-gold); font-weight:700;">${formatINR(svc.price)}</td>
            <td>${svc.discount_price ? `<span class="badge badge-discount">${formatINR(svc.discount_price)}</span>` : '—'}</td>
            <td>
              <span class="badge ${isAct ? 'badge-active' : 'badge-inactive'}">
                ${isAct ? 'Active' : 'Inactive'}
              </span>
            </td>
            <td>${svc.display_order || 0}</td>
            <td>
              <div style="display:flex; gap:6px;">
                <button type="button" class="btn btn-secondary btn-sm" onclick="window.viewServiceDetails('${svc.id}')" title="View Details">
                  <span data-lucide="eye" style="width:13px; height:13px;"></span>
                </button>
                <button type="button" class="btn btn-secondary btn-sm" onclick="window.editService('${svc.id}')" title="Edit Service">
                  <span data-lucide="edit" style="width:13px; height:13px;"></span>
                </button>
                <button type="button" class="btn btn-secondary btn-sm" onclick="window.toggleServiceActive('${svc.id}', ${!isAct})" title="${isAct ? 'Deactivate' : 'Activate'}">
                  <span data-lucide="${isAct ? 'eye-off' : 'eye'}" style="width:13px; height:13px; color:${isAct ? '#f59e0b' : '#10b981'};"></span>
                </button>
                <button type="button" class="btn btn-secondary btn-sm" onclick="window.confirmDeleteService('${svc.id}')" title="Delete or Archive">
                  <span data-lucide="trash-2" style="width:13px; height:13px; color:#ef4444;"></span>
                </button>
              </div>
            </td>
          </tr>
        `;
      })
      .join('');

    if (window.lucide) lucide.createIcons();
  };

  document.getElementById('services-category-filter')?.addEventListener('change', () => {
    servicesPage = 1;
    renderServices(allServices);
  });

  document.getElementById('services-search')?.addEventListener('input', debounce(() => {
    servicesPage = 1;
    renderServices(allServices);
  }, 250));

  // ══════════════════════════════════════════════════════════════════
  // 8. PRICE LIST & CATALOGUE MANAGER (TABLE, BULK, CRUD)
  // ══════════════════════════════════════════════════════════════════
  const renderPriceList = (services) => {
    const tbody = document.getElementById('prices-tbody');
    const paginationInfo = document.getElementById('prices-pagination-info');
    const paginationControls = document.getElementById('prices-pagination-controls');
    if (!tbody) return;

    if (priceListMode === 'bulk') {
      renderBulkPriceTable(services);
      return;
    }

    const catFilter = document.getElementById('prices-category-filter')?.value || '';
    const statusFilter = document.getElementById('prices-status-filter')?.value || '';
    const searchFilter = (document.getElementById('prices-search')?.value || '').trim().toLowerCase();
    const sortMode = document.getElementById('prices-sort')?.value || 'price-asc';

    let filtered = [...services];

    if (catFilter) {
      filtered = filtered.filter((s) => s.category === catFilter);
    }
    if (statusFilter === 'active') {
      filtered = filtered.filter((s) => s.is_active && !s.is_archived);
    } else if (statusFilter === 'inactive') {
      filtered = filtered.filter((s) => !s.is_active && !s.is_archived);
    } else if (statusFilter === 'archived') {
      filtered = filtered.filter((s) => s.is_archived);
    }

    if (searchFilter) {
      filtered = filtered.filter(
        (s) => (s.name || '').toLowerCase().includes(searchFilter) || (s.id || '').toLowerCase().includes(searchFilter)
      );
    }

    // Sort items
    if (sortMode === 'price-asc') {
      filtered.sort((a, b) => (a.payable_price || a.price) - (b.payable_price || b.price));
    } else if (sortMode === 'price-desc') {
      filtered.sort((a, b) => (b.payable_price || b.price) - (a.payable_price || a.price));
    } else if (sortMode === 'name-asc') {
      filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else if (sortMode === 'name-desc') {
      filtered.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
    } else if (sortMode === 'order-asc') {
      filtered.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
    }

    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--clr-text-muted); padding:30px;">No price list items found matching the selected filters.</td></tr>`;
      if (paginationInfo) paginationInfo.textContent = 'Showing 0 of 0 services';
      if (paginationControls) paginationControls.innerHTML = '';
      return;
    }

    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / priceListPerPage) || 1;
    if (priceListPage > totalPages) priceListPage = totalPages;
    if (priceListPage < 1) priceListPage = 1;

    const startIndex = (priceListPage - 1) * priceListPerPage;
    const endIndex = Math.min(startIndex + priceListPerPage, totalItems);
    const pagedServices = filtered.slice(startIndex, endIndex);

    if (paginationInfo) {
      paginationInfo.textContent = `Showing ${startIndex + 1}–${endIndex} of ${totalItems} items (Page ${priceListPage} of ${totalPages})`;
    }

    if (paginationControls) {
      let btns = `
        <button type="button" class="page-btn" ${priceListPage === 1 ? 'disabled' : ''} onclick="window.changePriceListPage(${priceListPage - 1})">Prev</button>
      `;
      for (let p = 1; p <= totalPages; p++) {
        if (p === 1 || p === totalPages || (p >= priceListPage - 1 && p <= priceListPage + 1)) {
          btns += `<button type="button" class="page-btn ${p === priceListPage ? 'active' : ''}" onclick="window.changePriceListPage(${p})">${p}</button>`;
        } else if (p === priceListPage - 2 || p === priceListPage + 2) {
          btns += `<span style="padding:0 3px; color:var(--clr-text-muted);">…</span>`;
        }
      }
      btns += `
        <button type="button" class="page-btn" ${priceListPage === totalPages ? 'disabled' : ''} onclick="window.changePriceListPage(${priceListPage + 1})">Next</button>
      `;
      paginationControls.innerHTML = btns;
    }

    tbody.innerHTML = pagedServices
      .map((s) => {
        const imgSrc = s.image_url || '/assets/logo.png';
        const isArchived = Boolean(s.is_archived);
        const isActive = Boolean(s.is_active);
        const hasDiscount = Boolean(s.discount_price && s.discount_price > 0 && s.discount_price < s.price);
        const savings = hasDiscount ? s.price - s.discount_price : 0;

        let statusBadge = '';
        if (isArchived) {
          statusBadge = '<span class="badge badge-archived">Archived</span>';
        } else if (isActive) {
          statusBadge = '<span class="badge badge-active">Active</span>';
        } else {
          statusBadge = '<span class="badge badge-inactive">Inactive</span>';
        }

        const discountCell = hasDiscount
          ? `<div style="display:flex; flex-direction:column; align-items:flex-end; gap:2px;">
               <span class="price-discount-val">${formatINR(s.discount_price)}</span>
               <span class="badge-discount-savings">Save ${formatINR(savings)}</span>
             </div>`
          : `<span class="price-dash">—</span>`;

        const descSnippet = s.description
          ? `<div style="font-size:11px; color:var(--clr-text-muted); max-width:260px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${escapeHtml(s.description)}">${escapeHtml(s.description)}</div>`
          : '';

        let actionButtons = `
          <div style="display:flex; justify-content:center; gap:6px;">
            <button type="button" class="btn btn-secondary btn-sm" onclick="window.viewServiceDetails('${s.id}')" title="View Full Details">
              <span data-lucide="eye" style="width:13px; height:13px;"></span>
            </button>
            <button type="button" class="btn btn-secondary btn-sm" onclick="window.editService('${s.id}')" title="Edit Service & Prices">
              <span data-lucide="edit" style="width:13px; height:13px;"></span>
            </button>
        `;

        if (isArchived) {
          actionButtons += `
            <button type="button" class="btn btn-outline-gold btn-sm" onclick="window.restoreService('${s.id}')" title="Restore to Active Catalogue">
              <span data-lucide="rotate-ccw" style="width:13px; height:13px; color:var(--clr-gold);"></span>
            </button>
          `;
        } else {
          actionButtons += `
            <button type="button" class="btn btn-secondary btn-sm" onclick="window.toggleServiceActive('${s.id}', ${!isActive})" title="${isActive ? 'Deactivate' : 'Activate'}">
              <span data-lucide="${isActive ? 'eye-off' : 'eye'}" style="width:13px; height:13px; color:${isActive ? '#f59e0b' : '#10b981'};"></span>
            </button>
            <button type="button" class="btn btn-secondary btn-sm" onclick="window.confirmDeleteService('${s.id}')" title="Delete or Archive Service">
              <span data-lucide="trash-2" style="width:13px; height:13px; color:#ef4444;"></span>
            </button>
          `;
        }

        actionButtons += '</div>';

        return `
          <tr>
            <td>
              <div class="service-cell-wrap">
                <img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(s.name)}" class="service-cell-thumb" onclick="window.previewFullImage('${escapeHtml(imgSrc)}', '${escapeHtml(s.name)}')" onerror="this.src='/assets/logo.png';" title="Click to view full image" />
                <div>
                  <div class="service-cell-name">${escapeHtml(s.name)}</div>
                  <div class="service-cell-meta">
                    <span class="badge badge-category" style="font-size:10px; padding:1px 6px;">${escapeHtml(s.category || 'Hair & Grooming')}</span>
                    <span>${s.duration_minutes || 30} mins</span>
                    <span style="font-family:monospace; opacity:0.6;">${escapeHtml(s.id)}</span>
                  </div>
                  ${descSnippet}
                </div>
              </div>
            </td>
            <td style="text-align:right;">
              <span class="price-regular-val">${formatINR(s.price)}</span>
            </td>
            <td style="text-align:right;">
              ${discountCell}
            </td>
            <td style="text-align:center;">
              ${statusBadge}
            </td>
            <td>
              ${actionButtons}
            </td>
          </tr>
        `;
      })
      .join('');

    if (window.lucide) lucide.createIcons();
  };

  // Render Bulk Inline Editor Table
  const renderBulkPriceTable = (services) => {
    const tbody = document.getElementById('bulk-prices-tbody');
    if (!tbody) return;

    const catFilter = document.getElementById('prices-category-filter')?.value || '';
    const searchFilter = (document.getElementById('prices-search')?.value || '').trim().toLowerCase();

    let filtered = services.filter((s) => !s.is_archived);
    if (catFilter) {
      filtered = filtered.filter((s) => s.category === catFilter);
    }
    if (searchFilter) {
      filtered = filtered.filter(
        (s) => (s.name || '').toLowerCase().includes(searchFilter) || (s.id || '').toLowerCase().includes(searchFilter)
      );
    }

    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--clr-text-muted); padding:30px;">No editable services match filters.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered
      .map((s) => {
        return `
        <tr data-service-id="${s.id}" data-category="${escapeHtml(s.category || 'Hair & Grooming')}">
          <td>
            <div style="font-weight:700; color:#fff;">${escapeHtml(s.name)}</div>
            <div style="font-size:11px; color:var(--clr-text-muted); font-family:monospace;">${escapeHtml(s.id)}</div>
          </td>
          <td><span class="badge badge-category">${escapeHtml(s.category || 'Hair & Grooming')}</span></td>
          <td>
            <div style="display:flex; align-items:center; gap:4px;">
              <span style="color:var(--clr-gold); font-weight:700;">₹</span>
              <input type="number" class="form-control bulk-price-input" style="width:110px; padding:6px;" value="${s.price}" min="0" required />
            </div>
          </td>
          <td>
            <div style="display:flex; align-items:center; gap:4px;">
              <span style="color:var(--clr-gold); font-weight:700;">₹</span>
              <input type="number" class="form-control bulk-discount-input" style="width:110px; padding:6px;" value="${s.discount_price || ''}" min="0" placeholder="Optional" />
            </div>
          </td>
          <td>
            <input type="number" class="form-control bulk-order-input" style="width:75px; padding:6px;" value="${s.display_order || 0}" />
          </td>
          <td style="text-align:center;">
            <label class="checkbox-label" style="font-size:12px; justify-content:center;">
              <input type="checkbox" class="bulk-active-input" ${s.is_active ? 'checked' : ''} />
              <span>Active</span>
            </label>
          </td>
        </tr>
      `;
      })
      .join('');
  };

  // Toggle Bulk Mode
  document.getElementById('toggle-bulk-mode-btn')?.addEventListener('click', () => {
    priceListMode = priceListMode === 'standard' ? 'bulk' : 'standard';
    const isBulk = priceListMode === 'bulk';

    const standardWrap = document.getElementById('standard-prices-wrapper');
    const bulkWrap = document.getElementById('bulk-prices-wrapper');
    const saveBulkBtn = document.getElementById('save-bulk-prices-btn');
    const toggleLabel = document.getElementById('bulk-toggle-label');
    const paginationBar = document.getElementById('prices-pagination-bar');

    if (standardWrap) standardWrap.style.display = isBulk ? 'none' : 'block';
    if (bulkWrap) bulkWrap.style.display = isBulk ? 'block' : 'none';
    if (saveBulkBtn) saveBulkBtn.style.display = isBulk ? 'inline-flex' : 'none';
    if (paginationBar) paginationBar.style.display = isBulk ? 'none' : 'flex';
    if (toggleLabel) toggleLabel.textContent = isBulk ? 'Standard View' : 'Quick Bulk Editor';

    renderPriceList(allServices);
  });

  // Bulk Price Save
  document.getElementById('save-bulk-prices-btn')?.addEventListener('click', async () => {
    const saveBtn = document.getElementById('save-bulk-prices-btn');
    const rows = document.querySelectorAll('#bulk-prices-tbody tr[data-service-id]');
    const updates = [];

    for (const tr of rows) {
      const id = tr.dataset.serviceId;
      const priceVal = tr.querySelector('.bulk-price-input')?.value;
      const discountVal = tr.querySelector('.bulk-discount-input')?.value.trim();
      const display_order = Number(tr.querySelector('.bulk-order-input')?.value) || 0;
      const is_active = tr.querySelector('.bulk-active-input')?.checked ? 1 : 0;

      const price = Number(priceVal);
      if (isNaN(price) || price < 0) {
        showToast(`Invalid price for service "${id}". Regular prices cannot be negative.`, 'danger');
        return;
      }

      let discount_price = null;
      if (discountVal !== '') {
        discount_price = Number(discountVal);
        if (isNaN(discount_price) || discount_price < 0) {
          showToast(`Invalid discount price for service "${id}". Discount cannot be negative.`, 'danger');
          return;
        }
        if (discount_price >= price) {
          showToast(`Discount for "${id}" (₹${discount_price}) must be less than regular price (₹${price}).`, 'danger');
          return;
        }
      }

      updates.push({ id, price, discount_price, display_order, is_active });
    }

    if (!confirm(`Save and synchronize ${updates.length} price change(s) across the entire salon website and booking system?`)) return;

    try {
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving Changes...';
      }
      showToast('Synchronizing price updates...', 'info');
      const res = await fetch('/api/admin/services/bulk-prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      showToast(data.message || 'All service prices synchronized successfully across website!');
      loadServices();
      loadDashboardStats();
    } catch (err) {
      showToast(err.message || 'Failed to save prices', 'danger');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save All Price Changes';
      }
    }
  });

  // Price List Filters
  document.getElementById('prices-search')?.addEventListener('input', debounce(() => {
    priceListPage = 1;
    renderPriceList(allServices);
  }, 250));
  document.getElementById('prices-category-filter')?.addEventListener('change', () => {
    priceListPage = 1;
    renderPriceList(allServices);
  });
  document.getElementById('prices-status-filter')?.addEventListener('change', () => {
    priceListPage = 1;
    renderPriceList(allServices);
  });
  document.getElementById('prices-sort')?.addEventListener('change', () => {
    renderPriceList(allServices);
  });

  // Add Service Modal Open
  const openAddServiceModal = () => {
    document.getElementById('service-modal-title').textContent = 'Add New Salon Service';
    document.getElementById('service-form').reset();
    document.getElementById('svc-id').value = '';
    document.getElementById('svc-slug').disabled = false;
    document.getElementById('svc-preview-box').style.display = 'none';
    document.getElementById('svc-active').checked = true;
    openModal('modal-service');
  };

  document.getElementById('open-add-service-modal')?.addEventListener('click', openAddServiceModal);
  document.getElementById('price-list-add-btn')?.addEventListener('click', openAddServiceModal);

  // Auto slug generation on name input
  document.getElementById('svc-name')?.addEventListener('input', (e) => {
    const slugInput = document.getElementById('svc-slug');
    if (slugInput && !slugInput.disabled) {
      slugInput.value = e.target.value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
    }
  });

  // Edit Service & Price
  window.editService = (id) => {
    const svc = allServices.find((s) => s.id === id);
    if (!svc) return;

    document.getElementById('service-modal-title').textContent = `Edit Service: ${svc.name}`;
    document.getElementById('svc-id').value = svc.id;
    document.getElementById('svc-slug').value = svc.id;
    document.getElementById('svc-slug').disabled = true;
    document.getElementById('svc-name').value = svc.name;
    document.getElementById('svc-price').value = svc.price;
    document.getElementById('svc-discount').value = svc.discount_price !== null && svc.discount_price !== undefined ? svc.discount_price : '';
    document.getElementById('svc-duration').value = svc.duration_minutes || 30;
    document.getElementById('svc-category').value = svc.category || 'Hair & Grooming';
    document.getElementById('svc-order').value = svc.display_order || 0;
    document.getElementById('svc-desc').value = svc.description || '';
    document.getElementById('svc-image').value = svc.image_url || '';
    document.getElementById('svc-active').checked = Boolean(svc.is_active);

    const prevBox = document.getElementById('svc-preview-box');
    const prevImg = document.getElementById('svc-preview-img');
    if (svc.image_url) {
      prevBox.style.display = 'block';
      prevImg.src = svc.image_url;
    } else {
      prevBox.style.display = 'none';
    }

    openModal('modal-service');
  };

  // View Service & Price Details Modal
  window.viewServiceDetails = (id) => {
    const s = allServices.find((x) => x.id === id);
    if (!s) return;

    document.getElementById('view-svc-title').textContent = `Service Details: ${s.name}`;
    const body = document.getElementById('view-svc-body');
    const imgSrc = s.image_url || '/assets/logo.png';
    const hasDiscount = Boolean(s.discount_price && s.discount_price > 0 && s.discount_price < s.price);
    const savings = hasDiscount ? s.price - s.discount_price : 0;
    const pct = hasDiscount ? Math.round((savings / s.price) * 100) : 0;
    const isArchived = Boolean(s.is_archived);
    const isActive = Boolean(s.is_active);

    let statusHtml = '';
    if (isArchived) {
      statusHtml = '<span class="badge badge-archived">Archived (Hidden from Booking)</span>';
    } else if (isActive) {
      statusHtml = '<span class="badge badge-active">Active &amp; Bookable</span>';
    } else {
      statusHtml = '<span class="badge badge-inactive">Inactive</span>';
    }

    body.innerHTML = `
      <div style="display:flex; gap:16px; align-items:center; margin-bottom:18px; background:rgba(197,160,89,0.06); padding:14px; border-radius:var(--radius-md); border:1px solid var(--clr-border-gold);">
        <img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(s.name)}" style="width:84px; height:64px; border-radius:6px; object-fit:cover; border:1px solid var(--clr-border); cursor:pointer;" onclick="window.previewFullImage('${escapeHtml(imgSrc)}', '${escapeHtml(s.name)}')" title="Click to enlarge" onerror="this.src='/assets/logo.png';" />
        <div>
          <div style="font-size:17px; font-weight:700; color:#fff;">${escapeHtml(s.name)}</div>
          <div style="font-size:12px; color:var(--clr-text-muted); font-family:monospace; margin-top:2px;">ID / Slug: ${escapeHtml(s.id)}</div>
          <div style="margin-top:6px;">${statusHtml}</div>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:16px;">
        <div style="background:var(--clr-bg-input); padding:12px; border-radius:var(--radius-sm); border:1px solid var(--clr-border);">
          <span style="font-size:11px; text-transform:uppercase; color:var(--clr-text-muted); font-weight:700;">Regular Price</span>
          <div style="font-size:18px; font-weight:700; color:var(--clr-gold);">${formatINR(s.price)}</div>
        </div>
        <div style="background:var(--clr-bg-input); padding:12px; border-radius:var(--radius-sm); border:1px solid var(--clr-border);">
          <span style="font-size:11px; text-transform:uppercase; color:var(--clr-text-muted); font-weight:700;">Discount Price</span>
          <div style="font-size:18px; font-weight:700; color:${hasDiscount ? '#34d399' : 'var(--clr-text-muted)'};">
            ${hasDiscount ? `${formatINR(s.discount_price)} <span style="font-size:11px; background:rgba(16,185,129,0.15); padding:2px 6px; border-radius:4px;">-${pct}% OFF</span>` : 'None (Regular)'}
          </div>
        </div>
        <div style="background:var(--clr-bg-input); padding:12px; border-radius:var(--radius-sm); border:1px solid var(--clr-border);">
          <span style="font-size:11px; text-transform:uppercase; color:var(--clr-text-muted); font-weight:700;">Service Duration</span>
          <div style="font-size:15px; font-weight:600; color:#fff;">${s.duration_minutes || 30} minutes</div>
        </div>
        <div style="background:var(--clr-bg-input); padding:12px; border-radius:var(--radius-sm); border:1px solid var(--clr-border);">
          <span style="font-size:11px; text-transform:uppercase; color:var(--clr-text-muted); font-weight:700;">Category</span>
          <div style="font-size:15px; font-weight:600; color:#fff;">${escapeHtml(s.category || 'Hair & Grooming')}</div>
        </div>
      </div>

      <div style="background:rgba(255,255,255,0.02); padding:12px; border-radius:var(--radius-sm); border:1px solid var(--clr-border); margin-bottom:14px;">
        <span style="font-size:11px; text-transform:uppercase; color:var(--clr-text-muted); font-weight:700;">Customer Booking History</span>
        <div style="font-size:13px; color:#e0e4eb; margin-top:4px;">
          Linked to <strong style="color:var(--clr-gold);">${s.appointment_count || 0}</strong> confirmed or completed appointment(s).
          <div style="font-size:11px; color:var(--clr-text-muted); margin-top:2px;">Historical appointment prices are permanently preserved and remain unchanged.</div>
        </div>
      </div>

      ${
        s.description
          ? `<div style="margin-bottom:10px;">
               <span style="font-size:11px; text-transform:uppercase; color:var(--clr-text-muted); font-weight:700;">Description</span>
               <p style="font-size:13px; color:#e0e4eb; background:var(--clr-bg-input); padding:10px; border-radius:6px; border:1px solid var(--clr-border); margin-top:4px;">${escapeHtml(s.description)}</p>
             </div>`
          : ''
      }
    `;

    const editBtn = document.getElementById('view-svc-edit-btn');
    if (editBtn) {
      editBtn.onclick = () => {
        closeModal('modal-view-service');
        window.editService(id);
      };
    }

    openModal('modal-view-service');
    if (window.lucide) lucide.createIcons();
  };

  // Image file upload inside service modal
  document.getElementById('svc-file-upload')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);

    try {
      showToast('Uploading service image...', 'info');
      const res = await fetch('/api/admin/upload-image', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      document.getElementById('svc-image').value = data.url;
      const prevBox = document.getElementById('svc-preview-box');
      const prevImg = document.getElementById('svc-preview-img');
      prevBox.style.display = 'block';
      prevImg.src = data.url;
      showToast('Image uploaded successfully!');
    } catch (err) {
      showToast(err.message || 'Image upload failed', 'danger');
    }
  });

  // Save Service (Create or Update with Full Validation)
  document.getElementById('service-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById('svc-save-btn');
    const existingId = document.getElementById('svc-id').value.trim();
    const slug = document.getElementById('svc-slug').value.trim();
    const name = document.getElementById('svc-name').value.trim();
    const priceVal = document.getElementById('svc-price').value;
    const discountVal = document.getElementById('svc-discount').value.trim();
    const duration_minutes = Number(document.getElementById('svc-duration').value) || 30;
    const category = document.getElementById('svc-category').value;
    const display_order = Number(document.getElementById('svc-order').value) || 0;
    const description = document.getElementById('svc-desc').value.trim();
    const image_url = document.getElementById('svc-image').value.trim();
    const is_active = document.getElementById('svc-active').checked ? 1 : 0;

    if (!name) {
      showToast('Service name is required.', 'danger');
      return;
    }
    const price = Number(priceVal);
    if (isNaN(price) || price < 0) {
      showToast('Regular Price (₹) must be 0 or greater.', 'danger');
      return;
    }

    let discount_price = null;
    if (discountVal !== '') {
      discount_price = Number(discountVal);
      if (isNaN(discount_price) || discount_price < 0) {
        showToast('Discount price cannot be negative.', 'danger');
        return;
      }
      if (discount_price >= price) {
        showToast(`Discount price (₹${discount_price}) must be strictly less than Regular Price (₹${price}).`, 'danger');
        return;
      }
    }

    const payload = {
      id: existingId || slug,
      name,
      price,
      discount_price,
      duration_minutes,
      category,
      display_order,
      description,
      image_url,
      is_active,
    };

    const isEdit = Boolean(existingId);
    const url = isEdit ? `/api/admin/services/${existingId}` : '/api/admin/services';
    const method = isEdit ? 'PUT' : 'POST';

    try {
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving Service...';
      }
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      showToast(data.message || `Service "${name}" saved successfully!`);
      closeModal('modal-service');
      loadServices();
      loadDashboardStats();
    } catch (err) {
      showToast(err.message || 'Failed to save service', 'danger');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Service';
      }
    }
  });

  // Toggle Service Active/Inactive Status
  window.toggleServiceActive = async (id, newActive) => {
    try {
      const res = await fetch(`/api/admin/services/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: newActive ? 1 : 0 }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      showToast(`Service status updated to ${newActive ? 'Active' : 'Inactive'}.`);
      loadServices();
      loadDashboardStats();
    } catch (err) {
      showToast(err.message || 'Status update failed', 'danger');
    }
  };

  // Confirm Delete or Archive Service Modal
  window.confirmDeleteService = (id) => {
    const s = allServices.find((x) => x.id === id);
    if (!s) return;

    pendingDeleteServiceId = id;
    const titleEl = document.getElementById('confirm-del-title');
    const bodyEl = document.getElementById('confirm-del-body');
    const footerEl = document.getElementById('confirm-del-footer');

    const aptCount = s.appointment_count || 0;
    if (titleEl) titleEl.textContent = aptCount > 0 ? `Archive Service: ${s.name}` : `Delete Service: ${s.name}`;

    if (bodyEl) {
      if (aptCount > 0) {
        bodyEl.innerHTML = `
          <div style="background:rgba(245,158,11,0.1); border:1px solid rgba(245,158,11,0.3); padding:14px; border-radius:var(--radius-md); margin-bottom:14px;">
            <div style="display:flex; align-items:center; gap:8px; font-weight:700; color:#fcd34d; margin-bottom:4px;">
              <span data-lucide="shield-alert" style="width:16px; height:16px;"></span>
              Historical Bookings Protected
            </div>
            <div style="font-size:13px; color:#e5e7eb;">
              Service <strong>"${escapeHtml(s.name)}"</strong> is referenced in <strong>${aptCount} past booking(s)</strong>.
            </div>
          </div>
          <p style="font-size:13px; color:var(--clr-text-muted);">
            To protect accounting records and confirmed pricing snapshots, this service will be <strong>ARCHIVED</strong>. It will be hidden from new bookings, while past appointment receipts and customer history remain 100% intact.
          </p>
        `;
        if (footerEl) {
          footerEl.innerHTML = `
            <button type="button" class="btn btn-secondary" data-close-modal>Cancel</button>
            <button type="button" class="btn btn-danger" onclick="window.executeDeleteService('${s.id}', false)">Archive Service</button>
          `;
        }
      } else {
        bodyEl.innerHTML = `
          <p style="font-size:13px; color:#e0e4eb; margin-bottom:12px;">
            Are you sure you want to remove service <strong>"${escapeHtml(s.name)}"</strong> (₹${s.price})?
          </p>
          <p style="font-size:12px; color:var(--clr-text-muted);">
            This service has 0 customer bookings. You may permanently remove it from the catalogue or archive it.
          </p>
        `;
        if (footerEl) {
          footerEl.innerHTML = `
            <button type="button" class="btn btn-secondary" data-close-modal>Cancel</button>
            <button type="button" class="btn btn-secondary" onclick="window.executeDeleteService('${s.id}', false)">Archive</button>
            <button type="button" class="btn btn-danger" onclick="window.executeDeleteService('${s.id}', true)">Permanently Delete</button>
          `;
        }
      }
    }

    openModal('modal-confirm-delete-service');
    if (window.lucide) lucide.createIcons();
  };

  // Execute Delete or Archive
  window.executeDeleteService = async (id, permanent = false) => {
    try {
      showToast(permanent ? 'Deleting service...' : 'Archiving service...', 'info');
      const res = await fetch(`/api/admin/services/${id}?permanent=${permanent ? 'true' : 'false'}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      closeModal('modal-confirm-delete-service');
      showToast(data.message || 'Service updated successfully.');
      loadServices();
      loadDashboardStats();
    } catch (err) {
      showToast(err.message || 'Failed to delete/archive service', 'danger');
    }
  };

  // Restore Archived Service
  window.restoreService = async (id) => {
    try {
      showToast('Restoring service...', 'info');
      const res = await fetch(`/api/admin/services/${id}/restore`, { method: 'POST' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      showToast(data.message || 'Service restored to active price list!');
      loadServices();
      loadDashboardStats();
    } catch (err) {
      showToast(err.message || 'Failed to restore service', 'danger');
    }
  };

  // Backward compatibility alias
  window.deleteService = (id) => window.confirmDeleteService(id);

  // ══════════════════════════════════════════════════════════════════
  // 9. WEBSITE CONTENT CMS (PREVIEWS & EDITING)
  // ══════════════════════════════════════════════════════════════════
  const updateCMSPreviews = () => {
    const logoVal = document.getElementById('cnt-logo_url')?.value.trim();
    const ownerVal = document.getElementById('cnt-owner_photo_url')?.value.trim();

    const logoImg = document.getElementById('logo-preview-img');
    const ownerImg = document.getElementById('owner-preview-img');

    if (logoImg && logoVal) logoImg.src = logoVal;
    if (ownerImg && ownerVal) ownerImg.src = ownerVal;
  };

  document.getElementById('cnt-logo_url')?.addEventListener('input', updateCMSPreviews);
  document.getElementById('cnt-owner_photo_url')?.addEventListener('input', updateCMSPreviews);

  const loadSiteContent = async () => {
    try {
      const res = await fetch('/api/admin/content');
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      const content = data.content || {};

      const fields = [
        'salon_name',
        'tagline',
        'phone',
        'email',
        'address',
        'maps_url',
        'opening_hours',
        'welcome_heading',
        'welcome_quote',
        'about_text',
        'logo_url',
        'owner_photo_url',
      ];

      fields.forEach((k) => {
        const el = document.getElementById(`cnt-${k}`);
        if (el && content[k] !== undefined) {
          el.value = content[k];
        }
      });

      updateCMSPreviews();
    } catch (err) {
      console.error('Error fetching site content:', err);
      showToast('Failed to load website content.', 'danger');
    }
  };

  document.getElementById('save-content-btn')?.addEventListener('click', async () => {
    const saveBtn = document.getElementById('save-content-btn');
    const fields = [
      'salon_name',
      'tagline',
      'phone',
      'email',
      'address',
      'maps_url',
      'opening_hours',
      'welcome_heading',
      'welcome_quote',
      'about_text',
      'logo_url',
      'owner_photo_url',
    ];

    const content = {};
    fields.forEach((k) => {
      const el = document.getElementById(`cnt-${k}`);
      if (el) content[k] = el.value.trim();
    });

    try {
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving Changes...';
      }
      showToast('Saving website changes...', 'info');
      const res = await fetch('/api/admin/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      showToast('Website content saved and published!');
      updateCMSPreviews();
    } catch (err) {
      showToast(err.message || 'Failed to save content', 'danger');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Website Changes';
      }
    }
  });

  // Logo file upload helper
  document.getElementById('upload-logo-file')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('image', file);

    try {
      showToast('Uploading logo image...', 'info');
      const res = await fetch('/api/admin/upload-image', { method: 'POST', body: formData });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      document.getElementById('cnt-logo_url').value = data.url;
      updateCMSPreviews();
      showToast('Logo uploaded successfully!');
    } catch (err) {
      showToast(err.message || 'Upload failed', 'danger');
    }
  });

  // Owner photo upload helper
  document.getElementById('upload-owner-file')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('image', file);

    try {
      showToast('Uploading owner photo...', 'info');
      const res = await fetch('/api/admin/upload-image', { method: 'POST', body: formData });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      document.getElementById('cnt-owner_photo_url').value = data.url;
      updateCMSPreviews();
      showToast('Owner photo uploaded successfully!');
    } catch (err) {
      showToast(err.message || 'Upload failed', 'danger');
    }
  });

  // ══════════════════════════════════════════════════════════════════
  // 10. GALLERY & MEDIA MANAGEMENT (FULL CRUD & LIGHTBOX)
  // ══════════════════════════════════════════════════════════════════
  let allGalleryImages = [];

  const loadGallery = async () => {
    try {
      const res = await fetch('/api/admin/gallery');
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      allGalleryImages = data.images || [];
      const grid = document.getElementById('gallery-grid');
      if (!grid) return;

      if (!allGalleryImages.length) {
        grid.innerHTML = '<div style="color:var(--clr-text-muted); font-size:13px; grid-column:1/-1;">No photos in salon gallery yet. Upload one above!</div>';
        return;
      }

      grid.innerHTML = allGalleryImages
        .map((img) => {
          return `
          <div class="gallery-card">
            <img src="${escapeHtml(img.image_url)}" alt="${escapeHtml(img.caption || 'Salon photo')}" class="gallery-card-img" onclick="window.previewFullImage('${escapeHtml(img.image_url)}', '${escapeHtml(img.caption || 'Salon Photo')}')" title="Click to view full photo" onerror="this.src='/assets/logo.png';" />
            <div class="gallery-card-body">
              <div style="font-weight:600; color:#fff; font-size:13px; margin-bottom:4px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(img.caption || 'Salon Photo')}</div>
              <div style="font-size:11px; color:var(--clr-text-muted); margin-bottom:10px;">Display Order: ${img.display_order || 0}</div>
              <div style="display:flex; justify-content:space-between; align-items:center; gap:6px;">
                <button type="button" class="btn btn-secondary btn-sm" onclick="window.copyImageLink('${escapeHtml(img.image_url)}')" title="Copy Link">
                  <span data-lucide="copy" style="width:12px; height:12px;"></span>
                </button>
                <button type="button" class="btn btn-secondary btn-sm" onclick="window.editGalleryPhoto(${img.id})" title="Edit Photo Details">
                  <span data-lucide="edit" style="width:12px; height:12px; color:var(--clr-gold);"></span>
                </button>
                <button type="button" class="btn btn-secondary btn-sm" onclick="window.deleteGalleryPhoto(${img.id})" title="Delete Photo">
                  <span data-lucide="trash-2" style="width:12px; height:12px; color:#ef4444;"></span>
                </button>
              </div>
            </div>
          </div>
        `;
        })
        .join('');

      if (window.lucide) lucide.createIcons();
    } catch (err) {
      console.error('Error fetching gallery:', err);
      showToast('Failed to load gallery photos.', 'danger');
    }
  };

  window.copyImageLink = (url) => {
    navigator.clipboard.writeText(url);
    showToast('Image URL copied to clipboard!');
  };

  // Edit Gallery Photo Modal
  window.editGalleryPhoto = (id) => {
    const photo = allGalleryImages.find((img) => img.id === id);
    if (!photo) return;

    document.getElementById('edit-gal-id').textContent = photo.id;
    document.getElementById('edit-gal-hidden-id').value = photo.id;
    document.getElementById('edit-gal-caption').value = photo.caption || '';
    document.getElementById('edit-gal-order').value = photo.display_order || 0;
    document.getElementById('edit-gal-url').value = photo.image_url || '';

    const prev = document.getElementById('edit-gal-preview');
    if (prev) prev.src = photo.image_url || '/assets/logo.png';

    openModal('modal-edit-gallery');
  };

  // Replace photo file upload in Edit Gallery modal
  document.getElementById('edit-gal-file')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);

    try {
      showToast('Uploading replacement photo...', 'info');
      const res = await fetch('/api/admin/upload-image', { method: 'POST', body: formData });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      document.getElementById('edit-gal-url').value = data.url;
      const prev = document.getElementById('edit-gal-preview');
      if (prev) prev.src = data.url;
      showToast('Replacement image ready.');
    } catch (err) {
      showToast(err.message || 'Image upload failed', 'danger');
    }
  });

  // Save Edit Gallery Form
  document.getElementById('edit-gallery-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById('edit-gal-save-btn');
    const id = document.getElementById('edit-gal-hidden-id').value;
    const caption = document.getElementById('edit-gal-caption').value.trim();
    const order = Number(document.getElementById('edit-gal-order').value) || 0;
    const image_url = document.getElementById('edit-gal-url').value.trim();

    try {
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Updating...';
      }
      const res = await fetch(`/api/admin/gallery/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caption, display_order: order, image_url }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      showToast('Gallery photo updated successfully!');
      closeModal('modal-edit-gallery');
      loadGallery();
    } catch (err) {
      showToast(err.message || 'Update failed', 'danger');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Update Photo';
      }
    }
  });

  window.deleteGalleryPhoto = async (id) => {
    if (!confirm('Are you sure you want to delete this photo from the gallery?')) return;
    try {
      const res = await fetch(`/api/admin/gallery/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      showToast('Photo removed from gallery.');
      loadGallery();
    } catch (err) {
      showToast(err.message || 'Delete failed', 'danger');
    }
  };

  document.getElementById('upload-gallery-btn')?.addEventListener('click', async () => {
    const uploadBtn = document.getElementById('upload-gallery-btn');
    const fileInput = document.getElementById('gallery-file-input');
    const caption = document.getElementById('gallery-caption-input')?.value.trim();
    const order = Number(document.getElementById('gallery-order-input')?.value) || 0;

    const file = fileInput?.files[0];
    if (!file) {
      showToast('Please select an image file to upload.', 'danger');
      return;
    }

    const formData = new FormData();
    formData.append('image', file);

    try {
      if (uploadBtn) {
        uploadBtn.disabled = true;
        uploadBtn.textContent = 'Uploading...';
      }
      showToast('Uploading photo...', 'info');
      const uploadRes = await fetch('/api/admin/upload-image', { method: 'POST', body: formData });
      const uploadData = await uploadRes.json();
      if (!uploadData.success) throw new Error(uploadData.error);

      // Save gallery entry
      const res = await fetch('/api/admin/gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: uploadData.url,
          caption,
          display_order: order,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      showToast('Photo uploaded to salon gallery!');
      fileInput.value = '';
      if (document.getElementById('gallery-caption-input')) document.getElementById('gallery-caption-input').value = '';
      loadGallery();
    } catch (err) {
      showToast(err.message || 'Gallery upload failed', 'danger');
    } finally {
      if (uploadBtn) {
        uploadBtn.disabled = false;
        uploadBtn.textContent = 'Upload to Gallery';
      }
    }
  });

  // ══════════════════════════════════════════════════════════════════
  // 11. EMAIL TEMPLATES & AUTOMATION
  // ══════════════════════════════════════════════════════════════════
  const loadTemplates = async () => {
    try {
      const res = await fetch('/api/admin/templates');
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      emailTemplates = data.templates || {};

      // Load automation policies
      if (data.policies) {
        const fUp = document.getElementById('policy-followup-enabled');
        const rem = document.getElementById('policy-reminders-enabled');
        if (fUp) fUp.checked = Boolean(data.policies.followup_enabled);
        if (rem) rem.checked = Boolean(data.policies.reminders_enabled);
      }

      displaySelectedTemplate();
    } catch (err) {
      console.error('Error fetching templates:', err);
      showToast('Failed to load email templates.', 'danger');
    }
  };

  const displaySelectedTemplate = () => {
    const sel = document.getElementById('template-selector');
    if (!sel) return;
    const tplKey = sel.value;
    const tpl = emailTemplates[tplKey];

    const subjectInput = document.getElementById('tpl-subject');
    const bodyInput = document.getElementById('tpl-body-text');
    const pillsContainer = document.getElementById('placeholder-pills');

    if (!tpl) {
      if (subjectInput) subjectInput.value = '';
      if (bodyInput) bodyInput.value = '';
      if (pillsContainer) pillsContainer.innerHTML = '';
      return;
    }

    if (subjectInput) subjectInput.value = tpl.subject || '';
    if (bodyInput) bodyInput.value = tpl.body_html || '';

    // Render placeholder pills
    if (pillsContainer && tpl.available_placeholders) {
      const tags = tpl.available_placeholders.split(',').map((t) => t.trim());
      pillsContainer.innerHTML = tags
        .map((tag) => `<button type="button" class="tag-pill" data-insert="${tag}">${tag}</button>`)
        .join('');

      pillsContainer.querySelectorAll('.tag-pill').forEach((pill) => {
        pill.addEventListener('click', () => {
          const textToInsert = pill.dataset.insert;
          insertAtCursor(bodyInput, textToInsert);
        });
      });
    }
  };

  const insertAtCursor = (textarea, text) => {
    if (!textarea) return;
    const startPos = textarea.selectionStart;
    const endPos = textarea.selectionEnd;
    const value = textarea.value;
    textarea.value = value.substring(0, startPos) + text + value.substring(endPos, value.length);
    textarea.selectionStart = textarea.selectionEnd = startPos + text.length;
    textarea.focus();
  };

  document.getElementById('template-selector')?.addEventListener('change', displaySelectedTemplate);

  // Save template
  document.getElementById('save-template-btn')?.addEventListener('click', async () => {
    const sel = document.getElementById('template-selector');
    const tplKey = sel?.value;
    const subject = document.getElementById('tpl-subject')?.value.trim();
    const body_html = document.getElementById('tpl-body-text')?.value;

    if (!tplKey || !subject || !body_html) {
      showToast('Subject and email body cannot be empty.', 'danger');
      return;
    }

    try {
      showToast('Saving email template...', 'info');
      const res = await fetch(`/api/admin/templates/${tplKey}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, body_html }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      if (emailTemplates[tplKey]) {
        emailTemplates[tplKey].subject = subject;
        emailTemplates[tplKey].body_html = body_html;
      }
      showToast('Email template updated successfully!');
    } catch (err) {
      showToast(err.message || 'Failed to save template', 'danger');
    }
  });

  // Send Test Email
  document.getElementById('send-test-email-btn')?.addEventListener('click', async () => {
    const sel = document.getElementById('template-selector');
    const tplKey = sel?.value;
    const recipient = document.getElementById('test-recipient-email')?.value.trim();

    if (!recipient) {
      showToast('Please specify a test email address.', 'danger');
      return;
    }

    try {
      showToast('Dispatching test notification...', 'info');
      const res = await fetch(`/api/admin/templates/${tplKey}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      showToast(`Test email delivered to ${recipient}!`);
    } catch (err) {
      showToast(err.message || 'Test dispatch failed', 'danger');
    }
  });

  // Policy toggles
  const savePolicies = async () => {
    const followup = document.getElementById('policy-followup-enabled')?.checked;
    const reminders = document.getElementById('policy-reminders-enabled')?.checked;

    try {
      await fetch('/api/admin/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followup_enabled: followup, reminders_enabled: reminders }),
      });
      showToast('Automation policy updated.');
    } catch (err) {
      console.error('Error saving policy:', err);
    }
  };
  document.getElementById('policy-followup-enabled')?.addEventListener('change', savePolicies);
  document.getElementById('policy-reminders-enabled')?.addEventListener('change', savePolicies);

  // ══════════════════════════════════════════════════════════════════
  // 12. AUDIT & ACTIVITY LOGS
  // ══════════════════════════════════════════════════════════════════
  const loadActivityLogs = async () => {
    try {
      const res = await fetch('/api/admin/activity-logs');
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      const logs = data.logs || [];
      const tbody = document.getElementById('activity-tbody');
      if (!tbody) return;

      if (!logs.length) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--clr-text-muted); padding:30px;">No activity logged yet.</td></tr>';
        return;
      }

      tbody.innerHTML = logs
        .map((l) => {
          return `
          <tr>
            <td style="font-family:monospace; font-size:12px; color:var(--clr-text-muted);">${l.created_at}</td>
            <td><strong>${escapeHtml(l.admin_user || 'system')}</strong></td>
            <td><span class="badge badge-active">${escapeHtml(l.action)}</span></td>
            <td>${escapeHtml(l.details || '—')}</td>
            <td style="font-family:monospace; font-size:11px; color:var(--clr-text-muted);">${escapeHtml(l.ip_address || '—')}</td>
          </tr>
        `;
        })
        .join('');
    } catch (err) {
      console.error('Error fetching logs:', err);
      showToast('Failed to load activity logs.', 'danger');
    }
  };

  document.getElementById('refresh-activity-btn')?.addEventListener('click', loadActivityLogs);

  // ══════════════════════════════════════════════════════════════════
  // 13. SETTINGS & SECURITY
  // ══════════════════════════════════════════════════════════════════
  // Change Password
  document.getElementById('change-password-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const current_password = document.getElementById('current-password')?.value;
    const new_password = document.getElementById('new-password')?.value;
    const confirm_new = document.getElementById('confirm-new-password')?.value;

    if (!new_password || new_password.length < 8) {
      showToast('New password must be at least 8 characters long.', 'danger');
      return;
    }

    if (new_password !== confirm_new) {
      showToast('New passwords do not match. Please re-enter.', 'danger');
      return;
    }

    try {
      showToast('Updating password...', 'info');
      const res = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password, new_password, confirm_password: confirm_new }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      showToast('Admin password updated successfully!');
      document.getElementById('change-password-form').reset();

      // Dismiss warning banner
      const banner = document.getElementById('password-warning-banner');
      if (banner) banner.style.display = 'none';
      if (currentAdmin) currentAdmin.must_change_password = 0;
    } catch (err) {
      showToast(err.message || 'Password update failed', 'danger');
    }
  });

  // Update Profile
  document.getElementById('update-profile-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('prof-username')?.value.trim();
    const email = document.getElementById('prof-email')?.value.trim();

    if (!username || !email) {
      showToast('Username and email cannot be empty.', 'danger');
      return;
    }

    try {
      showToast('Saving profile updates...', 'info');
      const res = await fetch('/api/admin/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      showToast('Admin profile information saved!');
      checkAuth();
    } catch (err) {
      showToast(err.message || 'Profile update failed', 'danger');
    }
  });

  // ══════════════════════════════════════════════════════════════════
  // HELPER FUNCTIONS
  // ══════════════════════════════════════════════════════════════════
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function debounce(func, wait) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  // ══════════════════════════════════════════════════════════════════
  // INITIALIZATION TRIGGER
  // ══════════════════════════════════════════════════════════════════
  checkAuth();
  if (window.lucide) lucide.createIcons();
});
