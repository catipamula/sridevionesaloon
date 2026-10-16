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
    if (tabName === 'prices') loadBulkPrices();
    if (tabName === 'content') loadSiteContent();
    if (tabName === 'gallery') loadGallery();
    if (tabName === 'templates') loadTemplates();
    if (tabName === 'activity') loadActivityLogs();

    if (window.lucide) lucide.createIcons();
  };

  document.querySelectorAll('#sidebar-nav .nav-item').forEach((item) => {
    item.addEventListener('click', () => switchTab(item.dataset.tab));
  });

  // Mobile menu toggle
  const mobileToggleBtn = document.getElementById('mobile-toggle-btn');
  const sidebarEl = document.getElementById('app-sidebar');
  const mobileOverlay = document.getElementById('mobile-overlay');

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
  // 6. APPOINTMENTS MANAGEMENT
  // ══════════════════════════════════════════════════════════════════
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
      renderAppointments(allAppointments);
    } catch (err) {
      console.error('Error fetching appointments:', err);
      showToast('Failed to load appointments.', 'danger');
    }
  };

  const renderAppointments = (items) => {
    const tbody = document.getElementById('appointments-tbody');
    if (!tbody) return;

    if (!items.length) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:var(--clr-text-muted); padding:30px;">No appointments matching the selected filters.</td></tr>`;
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

        const confDelivery = item.conf_delivery || 'sent';
        const followDelivery = item.followup_delivery || 'scheduled';

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
            <td style="max-width:220px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${escapeHtml(servicesLabel)}">
              ${escapeHtml(servicesLabel)}
            </td>
            <td style="color:var(--clr-gold); font-weight:700;">${formatINR(item.total_price)}</td>
            <td>
              <div style="font-weight:500;">${item.appointment_date}</div>
              <div style="font-size:11px; color:var(--clr-text-muted);">${item.appointment_time}</div>
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
                <button type="button" class="btn btn-secondary btn-sm" onclick="window.openRescheduleModal(${item.id})" title="Reschedule">
                  <span data-lucide="calendar" style="width:13px; height:13px; color:#60a5fa;"></span>
                </button>
                <button type="button" class="btn btn-secondary btn-sm" onclick="window.updateAppointmentStatusPrompt(${item.id}, '${item.status}')" title="Change Status">
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

      const bodyEl = document.getElementById('dtl-apt-body');
      bodyEl.innerHTML = `
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:18px;">
          <div>
            <span style="font-size:11px; text-transform:uppercase; color:var(--clr-text-muted); font-weight:700;">Customer Name</span>
            <div style="font-size:15px; font-weight:700; color:#fff;">${escapeHtml(apt.name)}</div>
          </div>
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
            <span style="font-size:11px; text-transform:uppercase; color:var(--clr-text-muted); font-weight:700;">Appointment Date & Time</span>
            <div style="color:#fff; font-weight:600;">${apt.appointment_date} at ${apt.appointment_time}</div>
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
      `Update status for Appointment #${id}\nChoose: booked, confirmed, completed, cancelled`,
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

    const headers = ['ID', 'Customer Name', 'Email', 'Phone', 'Services', 'Total Price', 'Date', 'Time', 'Status'];
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
        a.appointment_time,
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
  // 7. SERVICES MANAGEMENT (CRUD)
  // ══════════════════════════════════════════════════════════════════
  const loadServices = async () => {
    try {
      const res = await fetch('/api/admin/services');
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      allServices = data.services || [];

      // Update badge
      const badge = document.getElementById('services-count-badge');
      if (badge) badge.textContent = `${allServices.length} Services`;

      renderServices(allServices);
    } catch (err) {
      console.error('Error fetching services:', err);
      showToast('Failed to load services catalogue.', 'danger');
    }
  };

  const renderServices = (services) => {
    const tbody = document.getElementById('services-tbody');
    if (!tbody) return;

    const catFilter = document.getElementById('services-category-filter')?.value;
    const filtered = catFilter ? services.filter((s) => s.category === catFilter) : services;

    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:var(--clr-text-muted); padding:30px;">No services found for this filter.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered
      .map((svc) => {
        const imgSrc = svc.image_url || '/assets/logo.png';
        const isAct = Boolean(svc.is_active);

        return `
          <tr>
            <td>
              <img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(svc.name)}" class="service-table-img" onerror="this.src='/assets/logo.png';" />
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
                <button type="button" class="btn btn-secondary btn-sm" onclick="window.editService('${svc.id}')" title="Edit Service">
                  <span data-lucide="edit" style="width:13px; height:13px;"></span>
                </button>
                <button type="button" class="btn btn-secondary btn-sm" onclick="window.toggleServiceActive('${svc.id}', ${!isAct})" title="${isAct ? 'Deactivate' : 'Activate'}">
                  <span data-lucide="${isAct ? 'eye-off' : 'eye'}" style="width:13px; height:13px; color:${isAct ? '#f59e0b' : '#10b981'};"></span>
                </button>
                <button type="button" class="btn btn-secondary btn-sm" onclick="window.deleteService('${svc.id}')" title="Delete or Archive">
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
    renderServices(allServices);
  });

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

  // Edit service
  window.editService = (id) => {
    const svc = allServices.find((s) => s.id === id);
    if (!svc) return;

    document.getElementById('service-modal-title').textContent = `Edit Service: ${svc.name}`;
    document.getElementById('svc-id').value = svc.id;
    document.getElementById('svc-slug').value = svc.id;
    document.getElementById('svc-slug').disabled = true;
    document.getElementById('svc-name').value = svc.name;
    document.getElementById('svc-price').value = svc.price;
    document.getElementById('svc-discount').value = svc.discount_price || '';
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

  // Save Service (Create or Update)
  document.getElementById('service-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const existingId = document.getElementById('svc-id').value.trim();
    const slug = document.getElementById('svc-slug').value.trim();
    const name = document.getElementById('svc-name').value.trim();
    const price = Number(document.getElementById('svc-price').value);
    const discountVal = document.getElementById('svc-discount').value;
    const discount_price = discountVal ? Number(discountVal) : null;
    const duration_minutes = Number(document.getElementById('svc-duration').value) || 30;
    const category = document.getElementById('svc-category').value;
    const display_order = Number(document.getElementById('svc-order').value) || 0;
    const description = document.getElementById('svc-desc').value.trim();
    const image_url = document.getElementById('svc-image').value.trim();
    const is_active = document.getElementById('svc-active').checked ? 1 : 0;

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
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      showToast(`Service "${name}" saved successfully!`);
      closeModal('modal-service');
      loadServices();
      loadDashboardStats();
    } catch (err) {
      showToast(err.message || 'Failed to save service', 'danger');
    }
  });

  // Toggle Service Active
  window.toggleServiceActive = async (id, newActive) => {
    try {
      const res = await fetch(`/api/admin/services/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: newActive ? 1 : 0 }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      showToast(`Service status updated.`);
      loadServices();
      loadDashboardStats();
    } catch (err) {
      showToast(err.message || 'Status update failed', 'danger');
    }
  };

  // Delete / Archive Service
  window.deleteService = async (id) => {
    if (!confirm(`Are you sure you want to delete/archive service "${id}"? It will no longer appear on the website booking form.`)) return;

    try {
      const res = await fetch(`/api/admin/services/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      showToast('Service removed from active catalogue.');
      loadServices();
      loadDashboardStats();
    } catch (err) {
      showToast(err.message || 'Delete failed', 'danger');
    }
  };

  // ══════════════════════════════════════════════════════════════════
  // 8. PRICE LIST & BULK UPDATE
  // ══════════════════════════════════════════════════════════════════
  const loadBulkPrices = async () => {
    try {
      const res = await fetch('/api/admin/services');
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      const services = data.services || [];
      const tbody = document.getElementById('bulk-prices-tbody');
      if (!tbody) return;

      tbody.innerHTML = services
        .map((s) => {
          return `
          <tr data-service-id="${s.id}">
            <td>
              <div style="font-weight:700; color:#fff;">${escapeHtml(s.name)}</div>
              <div style="font-size:11px; color:var(--clr-text-muted); font-family:monospace;">${escapeHtml(s.id)}</div>
            </td>
            <td><span class="badge badge-category">${escapeHtml(s.category || 'Hair & Grooming')}</span></td>
            <td>
              <div style="display:flex; align-items:center; gap:4px;">
                <span style="color:var(--clr-gold); font-weight:700;">₹</span>
                <input type="number" class="form-control bulk-price-input" style="width:100px; padding:6px;" value="${s.price}" min="0" />
              </div>
            </td>
            <td>
              <div style="display:flex; align-items:center; gap:4px;">
                <span style="color:var(--clr-gold); font-weight:700;">₹</span>
                <input type="number" class="form-control bulk-discount-input" style="width:100px; padding:6px;" value="${s.discount_price || ''}" min="0" placeholder="None" />
              </div>
            </td>
            <td>
              <input type="number" class="form-control bulk-order-input" style="width:70px; padding:6px;" value="${s.display_order || 0}" />
            </td>
            <td>
              <label class="checkbox-label" style="font-size:12px;">
                <input type="checkbox" class="bulk-active-input" ${s.is_active ? 'checked' : ''} />
                <span>Active</span>
              </label>
            </td>
          </tr>
        `;
        })
        .join('');
    } catch (err) {
      console.error('Error loading bulk prices:', err);
      showToast('Failed to load prices.', 'danger');
    }
  };

  document.getElementById('save-bulk-prices-btn')?.addEventListener('click', async () => {
    const rows = document.querySelectorAll('#bulk-prices-tbody tr[data-service-id]');
    const updates = [];

    rows.forEach((tr) => {
      const id = tr.dataset.serviceId;
      const price = Number(tr.querySelector('.bulk-price-input')?.value);
      const discountVal = tr.querySelector('.bulk-discount-input')?.value;
      const discount_price = discountVal ? Number(discountVal) : null;
      const display_order = Number(tr.querySelector('.bulk-order-input')?.value) || 0;
      const is_active = tr.querySelector('.bulk-active-input')?.checked ? 1 : 0;

      updates.push({ id, price, discount_price, display_order, is_active });
    });

    try {
      showToast('Saving price updates...', 'info');
      const res = await fetch('/api/admin/services/bulk-prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      showToast('All service prices updated successfully!');
      loadBulkPrices();
    } catch (err) {
      showToast(err.message || 'Failed to save prices', 'danger');
    }
  });

  // ══════════════════════════════════════════════════════════════════
  // 9. WEBSITE CONTENT CMS
  // ══════════════════════════════════════════════════════════════════
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
    } catch (err) {
      console.error('Error fetching site content:', err);
      showToast('Failed to load website content.', 'danger');
    }
  };

  document.getElementById('save-content-btn')?.addEventListener('click', async () => {
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
      showToast('Saving website changes...', 'info');
      const res = await fetch('/api/admin/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      showToast('Website content saved and published!');
    } catch (err) {
      showToast(err.message || 'Failed to save content', 'danger');
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
      showToast('Owner photo uploaded successfully!');
    } catch (err) {
      showToast(err.message || 'Upload failed', 'danger');
    }
  });

  // ══════════════════════════════════════════════════════════════════
  // 10. GALLERY & MEDIA MANAGEMENT
  // ══════════════════════════════════════════════════════════════════
  const loadGallery = async () => {
    try {
      const res = await fetch('/api/admin/gallery');
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      const items = data.images || [];
      const grid = document.getElementById('gallery-grid');
      if (!grid) return;

      if (!items.length) {
        grid.innerHTML = '<div style="color:var(--clr-text-muted); font-size:13px; grid-column:1/-1;">No photos in salon gallery yet. Upload one above!</div>';
        return;
      }

      grid.innerHTML = items
        .map((img) => {
          return `
          <div class="gallery-card">
            <img src="${escapeHtml(img.image_url)}" alt="${escapeHtml(img.caption || 'Salon photo')}" class="gallery-card-img" />
            <div class="gallery-card-body">
              <div style="font-weight:600; color:#fff; font-size:13px; margin-bottom:4px;">${escapeHtml(img.caption || 'Salon Photo')}</div>
              <div style="font-size:11px; color:var(--clr-text-muted); margin-bottom:8px;">Order: ${img.display_order || 0}</div>
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <button type="button" class="btn btn-secondary btn-sm" onclick="window.copyImageLink('${escapeHtml(img.image_url)}')">
                  <span data-lucide="copy" style="width:12px; height:12px;"></span> Copy Link
                </button>
                <button type="button" class="btn btn-secondary btn-sm" onclick="window.deleteGalleryPhoto(${img.id})">
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
