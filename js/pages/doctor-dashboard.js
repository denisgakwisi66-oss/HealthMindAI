/**
 * ============================================
 * HEALTHMIND AI — DOCTOR DASHBOARD
 * ============================================
 */

import App from '/js/app.js';
import Theme from '/js/theme.js';
import API from '/js/services/api.js';
import Toast from '/js/toast.js';
import { escapeText as esc } from '/js/security.js';
import { requireRole } from '/js/utils/auth-guard.js';

const DoctorDashboard = (() => {
  // ===== STATE =====

  let stats = {};
  let schedule = [];
  let patients = [];

  // ===== DOM REFS =====

  const elements = {
    totalPatients: document.getElementById('total-patients'),
    todayAppointments: document.getElementById('today-appointments'),
    pendingAppointments: document.getElementById('pending-appointments'),
    completedAppointments: document.getElementById('completed-appointments'),
    schedule: document.getElementById('today-schedule'),
    recentPatients: document.getElementById('recent-patients'),
    scheduleDate: document.getElementById('schedule-date'),
  };

  // ===== INITIALIZE =====

  const init = async () => {
    try {
      if (!requireRole(['doctor', 'admin'])) return;

      // App.init() already rendered navigation (with the fetched user)
      // before this page script ran — re-calling it here without that
      // user object would blank out the sidebar's name/avatar.
      await loadDashboard();

      App.hideLoading();

    } catch (error) {
      App.handleError(error);
      App.hideLoading();
    }
  };

  // ===== LOAD DASHBOARD =====

  const loadDashboard = async () => {
    try {
      // Get dashboard data
      const response = await API.get('/doctor/dashboard');
      
      stats = response.stats || {};
      schedule = response.today_appointments || [];
      patients = response.recent_patients || [];

      renderStats();
      renderSchedule();
      renderPatients();

      // Update date
      const today = new Date();
      elements.scheduleDate.textContent = today.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
      });

    } catch (error) {
      console.error('Error loading doctor dashboard:', error);
      Toast.error('Error', 'Failed to load dashboard data.');
    }
  };

  // ===== RENDER STATS =====

  const renderStats = () => {
    elements.totalPatients.textContent = stats.total_patients || 0;
    elements.todayAppointments.textContent = stats.today_appointments || 0;
    elements.pendingAppointments.textContent = stats.pending_appointments || 0;
    elements.completedAppointments.textContent = stats.completed_today || 0;
  };

  // ===== RENDER SCHEDULE =====

  const renderSchedule = () => {
    const container = elements.schedule;

    if (!schedule || schedule.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: var(--spacing-6);">
          <p style="color: var(--color-text-secondary);">No appointments scheduled for today.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = schedule.map(appt => {
      const statusColors = {
        scheduled: 'badge-primary',
        completed: 'badge-success',
        cancelled: 'badge-danger',
        no_show: 'badge-warning',
      };
      
      return `
        <div class="schedule-item" data-id="${appt.id}">
          <div class="schedule-time">${esc(appt.time) || 'TBD'}</div>
          <div class="schedule-patient">
            <div class="patient-name">${esc(appt.patient_name) || 'Patient'}</div>
            <div class="patient-details">
              ${esc(appt.reason) || 'General checkup'} • ${esc(appt.duration) || '30 min'}
            </div>
          </div>
          <div class="schedule-status">
            <span class="badge ${statusColors[appt.status] || 'badge-primary'}">
              ${esc(appt.status) || 'Scheduled'}
            </span>
          </div>
          <div class="schedule-actions">
            <button class="btn btn-sm btn-outline view-patient-btn" data-id="${appt.patient_id}">View</button>
            <button class="btn btn-sm btn-success complete-btn" data-id="${appt.id}">✓</button>
          </div>
        </div>
      `;
    }).join('');

    // Event handlers
    container.querySelectorAll('.view-patient-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        window.location.href = `/patients.html?id=${id}`;
      });
    });

    container.querySelectorAll('.complete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        if (confirm('Mark this appointment as completed?')) {
          await updateAppointmentStatus(id, 'completed');
        }
      });
    });
  };

  // ===== RENDER PATIENTS =====

  const renderPatients = () => {
    const container = elements.recentPatients;

    if (!patients || patients.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: var(--spacing-4);">
          <p style="color: var(--color-text-secondary);">No recent patients.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = patients.slice(0, 5).map(patient => {
      const initials = esc(patient.name.split(' ').map(n => n[0]).join(''));

      return `
        <div class="patient-item" data-id="${patient.id}">
          <div class="patient-avatar">${initials}</div>
          <div class="patient-info">
            <div class="patient-name">${esc(patient.name)}</div>
            <div class="patient-meta">
              ${esc(patient.age) || '--'} years • ${esc(patient.last_visit) || 'New patient'}
            </div>
          </div>
          <div class="patient-actions">
            <button class="btn btn-sm btn-outline view-patient-btn" data-id="${patient.id}">View</button>
            <button class="btn btn-sm btn-primary record-btn" data-id="${patient.id}">📋</button>
          </div>
        </div>
      `;
    }).join('');

    // Event handlers
    container.querySelectorAll('.view-patient-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        window.location.href = `/patients.html?id=${id}`;
      });
    });

    container.querySelectorAll('.record-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        window.location.href = `/medical-records.html?patient=${id}`;
      });
    });
  };

  // ===== UPDATE APPOINTMENT STATUS =====

  const updateAppointmentStatus = async (id, status) => {
    try {
      await API.put(`/doctor/appointments/${id}/status`, { status });
      
      Toast.success('Updated', 'Appointment status updated.');
      await loadDashboard();
      
    } catch (error) {
      App.handleError(error);
    }
  };

  // ===== EVENT LISTENERS =====

  const setupEventListeners = () => {
    document.querySelector('.theme-toggle')?.addEventListener('click', Theme.toggle);
  };

  // ===== PUBLIC API =====

  return {
    init,
    loadDashboard,
    updateAppointmentStatus,
  };
})();

export default DoctorDashboard;