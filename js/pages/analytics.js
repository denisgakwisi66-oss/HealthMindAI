import App from '/js/app.js';
import Theme from '/js/theme.js';
import API from '/js/services/api.js';
import Toast from '/js/toast.js';

const Analytics = (() => {
  const fromInput = document.getElementById('analytics-from');
  const toInput = document.getElementById('analytics-to');
  const chartIds = ['user-growth-chart', 'appointment-trends-chart', 'user-role-chart', 'adherence-chart'];
  let report = null;

  const toInputDate = (date) => {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  };

  const svgElement = (name, attributes = {}) => {
    const node = document.createElementNS('http://www.w3.org/2000/svg', name);
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, String(value)));
    return node;
  };

  const renderTimeChart = (container, entries, label) => {
    container.replaceChildren();
    if (!entries.length) {
      container.textContent = `No ${label.toLowerCase()} in this date range.`;
      return;
    }
    const width = Math.max(320, container.clientWidth || 480);
    const height = 190;
    const padding = { top: 14, right: 12, bottom: 32, left: 36 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;
    const max = Math.max(1, ...entries.map((item) => item.count));
    const step = plotWidth / entries.length;
    const barWidth = Math.max(2, Math.min(24, step * 0.7));
    const svg = svgElement('svg', {
      viewBox: `0 0 ${width} ${height}`,
      role: 'img',
      'aria-label': label,
      preserveAspectRatio: 'none',
    });
    svg.appendChild(svgElement('line', {
      x1: padding.left, y1: padding.top + plotHeight,
      x2: width - padding.right, y2: padding.top + plotHeight,
      stroke: 'currentColor', opacity: 0.25,
    }));
    entries.forEach((item, index) => {
      const barHeight = (item.count / max) * (plotHeight - 8);
      const x = padding.left + step * index + (step - barWidth) / 2;
      const y = padding.top + plotHeight - barHeight;
      const bar = svgElement('rect', {
        x, y, width: barWidth, height: barHeight,
        rx: 3, fill: 'var(--color-primary)',
      });
      const title = svgElement('title');
      title.textContent = `${item.date}: ${item.count}`;
      bar.appendChild(title);
      svg.appendChild(bar);
      if (entries.length <= 7 || index === 0 || index === entries.length - 1 || index % 5 === 0) {
        const text = svgElement('text', {
          x: x + barWidth / 2,
          y: height - 8,
          'text-anchor': 'middle',
          fill: 'currentColor',
          'font-size': '10',
        });
        text.textContent = item.date.slice(5);
        svg.appendChild(text);
      }
    });
    container.appendChild(svg);
  };

  const renderRoles = (container, roles) => {
    container.replaceChildren();
    if (!roles.length) {
      container.textContent = 'No users found.';
      return;
    }
    const total = roles.reduce((sum, item) => sum + item.count, 0);
    roles.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'analytics-role-row';
      const label = document.createElement('span');
      label.textContent = `${item.role} (${item.count})`;
      const track = document.createElement('div');
      track.className = 'analytics-role-track';
      const fill = document.createElement('div');
      fill.className = 'analytics-role-fill';
      fill.style.width = `${total ? (item.count / total) * 100 : 0}%`;
      track.appendChild(fill);
      row.append(label, track);
      container.appendChild(row);
    });
  };

  const renderReport = () => {
    renderTimeChart(document.getElementById(chartIds[0]), report.users, 'New user registrations');
    renderTimeChart(document.getElementById(chartIds[1]), report.appointments, 'Appointments');
    renderRoles(document.getElementById(chartIds[2]), report.roles);
    const adherence = document.getElementById(chartIds[3]);
    adherence.textContent = report.medication_adherence == null
      ? 'Medication adherence analytics are not available because dose-taking events are not tracked.'
      : `${report.medication_adherence}%`;
  };

  const setLoading = (loading) => {
    document.getElementById('apply-analytics').disabled = loading;
    document.getElementById('export-data').disabled = loading || !report;
  };

  const loadReport = async () => {
    const from = fromInput.value;
    const to = toInput.value;
    if (!from || !to) {
      Toast.error('Date range required', 'Choose both a start and end date.');
      return;
    }
    if (from > to) {
      Toast.error('Invalid date range', 'The start date must be on or before the end date.');
      return;
    }

    setLoading(true);
    chartIds.forEach((id) => {
      document.getElementById(id).textContent = 'Loading…';
    });
    try {
      report = await API.get('/admin/analytics', { params: { date_from: from, date_to: to } });
      renderReport();
    } catch (error) {
      report = null;
      chartIds.forEach((id) => {
        const container = document.getElementById(id);
        container.textContent = 'Could not load this report.';
      });
      Toast.error('Analytics unavailable', error.message || 'Could not load analytics.');
    } finally {
      setLoading(false);
    }
  };

  const csvCell = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;

  const exportReport = () => {
    if (!report) {
      Toast.error('Nothing to export', 'Load analytics before exporting.');
      return;
    }
    const rows = [
      ['Report', 'Date', 'Value'],
      ...report.users.map((item) => ['New users', item.date, item.count]),
      ...report.appointments.map((item) => ['Appointments', item.date, item.count]),
      ...report.roles.map((item) => ['Users by role', item.role, item.count]),
    ];
    const csv = rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `healthmind-analytics-${report.date_from}-to-${report.date_to}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const init = async () => {
    try {
      document.querySelectorAll('.theme-toggle').forEach((button) => {
        button.addEventListener('click', Theme.toggle);
      });
      const today = new Date();
      toInput.value = toInputDate(today);
      const start = new Date(today);
      start.setDate(start.getDate() - 29);
      fromInput.value = toInputDate(start);
      document.getElementById('apply-analytics').addEventListener('click', loadReport);
      document.getElementById('export-data').addEventListener('click', exportReport);
      await loadReport();
      App.hideLoading();
    } catch (error) {
      console.error('Error initializing analytics page:', error);
      App.handleError(error);
      App.hideLoading();
    }
  };

  return { init, loadReport, exportReport };
})();

export default Analytics;
