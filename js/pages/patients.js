import App from '/js/app.js';
import Theme from '/js/theme.js';
import API from '/js/services/api.js';
import Toast from '/js/toast.js';
import { escapeText as esc } from '/js/security.js';
import { requireRole } from '/js/utils/auth-guard.js';

const Patients = (() => {
  const list = document.getElementById('patients-list');
  const searchInput = document.getElementById('patient-search-input');
  let searchTimer;

  const renderPatients = (patients) => {
    if (!list) return;
    if (!patients.length) {
      list.innerHTML = '<div class="empty-state text-center p-8"><div class="empty-title">No patients found</div><div class="empty-description">Patients appear here after an appointment is booked.</div></div>';
      return;
    }

    list.innerHTML = patients.map((patient) => `
      <article class="patient-item" data-id="${esc(patient.id)}">
        <div class="patient-avatar">${esc(patient.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase())}</div>
        <div class="patient-info">
          <div class="patient-name">${esc(patient.name)}</div>
          <div class="patient-meta">${patient.age == null ? 'Age not provided' : `${esc(patient.age)} years old`} · ${patient.last_visit ? `Last visit ${esc(patient.last_visit)}` : 'No visits yet'}</div>
        </div>
        <div class="patient-actions">
          <a class="btn btn-sm btn-outline" href="/medical-records.html?patient=${encodeURIComponent(patient.id)}">Records</a>
        </div>
      </article>
    `).join('');
  };

  const loadPatients = async () => {
    if (!list) return;
    list.setAttribute('aria-busy', 'true');
    try {
      const params = new URLSearchParams();
      const search = searchInput?.value.trim();
      const patientId = new URLSearchParams(window.location.search).get('id');
      if (search) params.set('search', search);
      if (patientId) params.set('patient_id', patientId);
      const response = await API.get(`/doctor/patients${params.size ? `?${params}` : ''}`);
      renderPatients(response.patients || []);
    } catch (error) {
      console.error('Failed to load patients:', error);
      list.innerHTML = '<div class="empty-state text-center p-8"><div class="empty-title">Patients could not be loaded</div><button class="btn btn-outline mt-4" id="retry-patients">Try again</button></div>';
      list.querySelector('#retry-patients')?.addEventListener('click', loadPatients);
      Toast.error('Loading failed', error.message || 'Could not load patients.');
    } finally {
      list.removeAttribute('aria-busy');
    }
  };

  const init = async () => {
    try {
      if (!requireRole(['doctor', 'admin'])) return;
      document.querySelectorAll('.theme-toggle').forEach((button) => {
        button.addEventListener('click', Theme.toggle);
      });
      searchInput?.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(loadPatients, 250);
      });
      await loadPatients();
      App.hideLoading();
    } catch (error) {
      console.error('Error initializing patients page:', error);
      App.handleError(error);
      App.hideLoading();
    }
  };

  return { init, loadPatients };
})();

export default Patients;
