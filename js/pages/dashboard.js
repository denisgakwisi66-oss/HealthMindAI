import App from '/js/app.js';
import AuthService from '/js/services/auth.js';
import Navigation from '/js/navigation.js';
import Theme from '/js/theme.js';
import API from '/js/services/api.js';
import { escapeText as esc } from '/js/security.js';

const DashboardPage = (() => {
  let user = null;

  const updateGreeting = () => {
    const name = user?.full_name || 'User';
    const hour = new Date().getHours();
    let greeting = 'Good evening';
    let emoji = '🌙';

    if (hour < 12) {
      greeting = 'Good morning';
      emoji = '🌅';
    } else if (hour < 17) {
      greeting = 'Good afternoon';
      emoji = '☀️';
    }

    const greetingText = document.getElementById('greeting-text');
    const greetingEmoji = document.getElementById('greeting-emoji');

    if (greetingText) {
      greetingText.innerHTML = `${greeting}, <span id="user-name">${esc(name)}</span>`;
    }
    if (greetingEmoji) {
      greetingEmoji.textContent = emoji;
    }
  };

  const renderHealthMetrics = (metrics) => {
    const container = document.getElementById('health-metrics');
    if (!container) return;

    if (!metrics || Object.keys(metrics).length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: var(--spacing-4); color: var(--color-text-secondary);">
          <p>No health data available yet.</p>
          <p style="font-size: var(--font-size-sm);">Connect your health devices or add your health information in settings.</p>
        </div>
      `;
      return;
    }

    const metricItems = [
      { label: 'Heart Rate', value: metrics.heart_rate, unit: 'bpm', icon: '❤️' },
      { label: 'Blood Pressure', value: metrics.blood_pressure, unit: '', icon: '🩸' },
      { label: 'Steps', value: metrics.steps, unit: 'steps', icon: '👣' },
      { label: 'Sleep', value: metrics.sleep, unit: 'hrs', icon: '😴' },
    ];

    container.innerHTML = metricItems.map(item => `
      <div class="card" style="padding: var(--spacing-4); text-align: center; border-color: transparent; background: var(--color-surface-hover);">
        <div style="font-size: 24px; margin-bottom: var(--spacing-2);">${item.icon}</div>
        <div style="font-size: var(--font-size-xl); font-weight: var(--font-weight-bold); color: var(--color-text);">
          ${item.value || '--'}
        </div>
        <div style="font-size: var(--font-size-xs); color: var(--color-text-tertiary);">
          ${item.label} ${item.unit}
        </div>
      </div>
    `).join('');
  };

  const renderUpcomingAppointment = (appointments) => {
    const container = document.getElementById('upcoming-appointment');
    if (!container) return;

    if (!appointments || appointments.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: var(--spacing-4);">
          <p style="color: var(--color-text-secondary); margin-bottom: var(--spacing-3);">No upcoming appointments</p>
          <a href="/appointments.html" class="btn btn-primary btn-sm">Book an Appointment</a>
        </div>
      `;
      return;
    }

    const appt = appointments[0];
    const date = new Date(appt.date);
    const formattedDate = date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });

    container.innerHTML = `
      <div style="display: flex; align-items: center; gap: var(--spacing-4); padding: var(--spacing-3); background: var(--color-primary-surface); border-radius: var(--radius-lg);">
        <div style="text-align: center; min-width: 60px;">
          <div style="font-size: var(--font-size-2xl);">📅</div>
          <div style="font-size: var(--font-size-xs); color: var(--color-text-secondary);">${formattedDate}</div>
        </div>
        <div style="flex: 1;">
          <div style="font-weight: var(--font-weight-semibold);">${esc(appt.doctor_name) || 'Doctor'}</div>
          <div style="font-size: var(--font-size-sm); color: var(--color-text-secondary);">
            ${esc(appt.specialty) || 'General'} • ${esc(appt.time) || 'Time TBD'}
          </div>
        </div>
        <a href="/appointments.html" class="btn btn-sm btn-outline">View</a>
      </div>
    `;
  };

  const renderMedications = (medications) => {
    const container = document.getElementById('medication-reminder');
    if (!container) return;

    if (!medications || medications.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: var(--spacing-4);">
          <p style="color: var(--color-text-secondary); font-size: var(--font-size-sm);">No medications added</p>
          <a href="/medications.html" class="btn btn-sm btn-primary" style="margin-top: var(--spacing-2);">Add Medication</a>
        </div>
      `;
      return;
    }

    container.innerHTML = medications.slice(0, 2).map(med => `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: var(--spacing-3); border-bottom: 1px solid var(--color-border);">
        <div>
          <div style="font-weight: var(--font-weight-semibold);">${esc(med.name)}</div>
          <div style="font-size: var(--font-size-sm); color: var(--color-text-secondary);">
            ${esc(med.dosage)} • ${esc(med.schedule)}
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: var(--spacing-2);">
          <span class="badge ${med.taken ? 'badge-success' : 'badge-warning'}">
            ${med.taken ? '✓ Taken' : '⏰ Due'}
          </span>
        </div>
      </div>
    `).join('');
  };

  const renderNotifications = (notifications) => {
    const container = document.getElementById('notifications-list');
    if (!container) return;

    if (!notifications || notifications.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: var(--spacing-4);">
          <p style="color: var(--color-text-secondary); font-size: var(--font-size-sm);">No notifications</p>
        </div>
      `;
      return;
    }

    container.innerHTML = notifications.slice(0, 3).map(notif => `
      <div style="display: flex; align-items: center; gap: var(--spacing-3); padding: var(--spacing-2) 0; border-bottom: 1px solid var(--color-border-light);">
        <div style="font-size: 20px;">${esc(notif.icon) || '🔔'}</div>
        <div style="flex: 1; min-width: 0;">
          <div style="font-size: var(--font-size-sm); font-weight: var(--font-weight-medium);">${esc(notif.title)}</div>
          <div style="font-size: var(--font-size-xs); color: var(--color-text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${esc(notif.message)}
          </div>
        </div>
        <div style="font-size: var(--font-size-xs); color: var(--color-text-tertiary); flex-shrink: 0;">
          ${esc(notif.time_ago) || 'Just now'}
        </div>
      </div>
    `).join('');
  };

  const renderRecentRecords = (records) => {
    const container = document.getElementById('recent-records');
    if (!container) return;

    if (!records || records.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: var(--spacing-4); color: var(--color-text-secondary);">
          <p>No medical records yet</p>
          <p style="font-size: var(--font-size-sm);">Your records will appear here once available.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = records.slice(0, 3).map(record => `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: var(--spacing-3); border-bottom: 1px solid var(--color-border-light);">
        <div>
          <div style="font-weight: var(--font-weight-semibold);">${esc(record.title) || 'Medical Record'}</div>
          <div style="font-size: var(--font-size-sm); color: var(--color-text-secondary);">
            ${esc(record.type) || 'Document'} • ${esc(record.date) || 'Date unavailable'}
          </div>
        </div>
        <a href="/medical-records.html" class="btn btn-sm btn-ghost">View</a>
      </div>
    `).join('');
  };

  const renderHealthTrends = (trends) => {
    const container = document.getElementById('health-trends');
    if (!container) return;

    if (!trends || trends.length === 0) {
      container.innerHTML = `
        <div style="width: 100%; text-align: center; padding: var(--spacing-4); color: var(--color-text-secondary);">
          <p style="font-size: var(--font-size-sm);">No health trends available</p>
        </div>
      `;
      return;
    }

    const maxValue = Math.max(...trends);
    container.innerHTML = trends.map(value => {
      const height = maxValue > 0 ? (value / maxValue) * 100 : 0;
      return `
        <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: var(--spacing-1);">
          <div style="width: 100%; height: ${height}%; min-height: 10px; background: var(--color-primary-gradient); border-radius: var(--radius-sm); transition: height var(--transition-slow);"></div>
          <div style="font-size: var(--font-size-xs); color: var(--color-text-tertiary);">${value}</div>
        </div>
      `;
    }).join('');
  };

  const renderEmptyStates = () => {
    renderHealthMetrics(null);
    renderUpcomingAppointment(null);
    renderMedications(null);
    renderNotifications(null);
    renderRecentRecords(null);
    renderHealthTrends(null);
  };

  const loadDashboardData = async () => {
    try {
      const [overview, metrics] = await Promise.all([
        API.get('/dashboard/overview'),
        API.get('/dashboard/metrics'),
      ]);

      renderHealthMetrics(metrics);
      renderUpcomingAppointment(overview.upcoming_appointments);
      renderMedications(overview.medications_due);
      renderNotifications(overview.notifications);
      renderRecentRecords(overview.recent_records);
      renderHealthTrends(overview.health_trends);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      renderEmptyStates();
    }
  };

  const init = async () => {
    try {
      // App.init() already resolved the session, fetched the profile, and
      // rendered navigation before this page script ever ran — reuse that
      // instead of re-fetching (a second concurrent session check here can
      // stall behind Supabase's client-side session lock).
      user = AuthService.getUser();
      updateGreeting();
      await loadDashboardData();

      document.querySelector('.theme-toggle')?.addEventListener('click', Theme.toggle);
      App.hideLoading();
    } catch (error) {
      console.error('Error initializing dashboard page:', error);
      App.handleError(error);

      if (error.status === 401) {
        window.location.href = '/login.html';
      }

      App.hideLoading();
    }
  };

  return {
    init,
    loadDashboardData,
  };
})();

export default DashboardPage;
