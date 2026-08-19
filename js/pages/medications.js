/**
 * ============================================
 * HEALTHMIND AI — MEDICATIONS PAGE
 * ============================================
 */

import App from '/js/app.js';
import AuthService from '/js/services/auth.js';
import Navigation from '/js/navigation.js';
import Theme from '/js/theme.js';
import API from '/js/services/api.js';
import Toast from '/js/toast.js';

const Medications = (() => {
  // ===== STATE =====

  let medications = [];
  let editingId = null;

  // ===== DOM REFS =====

  const elements = {
    list: document.getElementById('medications-list'),
    addBtn: document.getElementById('add-medication-btn'),
    modal: document.getElementById('medication-modal'),
    form: document.getElementById('medication-form'),
    modalTitle: document.getElementById('medication-modal-title'),
    confirmBtn: document.getElementById('med-confirm'),
    cancelBtn: document.getElementById('med-cancel'),
    nameInput: document.getElementById('med-name'),
    dosageInput: document.getElementById('med-dosage'),
    frequencyInput: document.getElementById('med-frequency'),
    timeInput: document.getElementById('med-time'),
    instructionsInput: document.getElementById('med-instructions'),
    startDateInput: document.getElementById('med-start-date'),
    endDateInput: document.getElementById('med-end-date'),
    adherenceRate: document.getElementById('adherence-rate'),
    adherenceCircle: document.getElementById('adherence-circle'),
    adherenceText: document.getElementById('adherence-text'),
  };

  // ===== INITIALIZE =====

  const init = async () => {
    try {
      const userRole = AuthService.getRole() || 'patient';
      Navigation.init(userRole, true);

      await loadMedications();
      await loadAdherence();

      setupEventListeners();

      App.hideLoading();

    } catch (error) {
      App.handleError(error);
      App.hideLoading();
    }
  };

  // ===== LOAD MEDICATIONS =====

  const loadMedications = async () => {
    try {
      const response = await API.get('/medications');
      medications = response.medications || [];
      renderMedications();
    } catch (error) {
      console.error('Error loading medications:', error);
      medications = [];
      renderMedications();
      Toast.error('Error', 'Failed to load medications.');
    }
  };

  // ===== LOAD ADHERENCE =====

  const loadAdherence = async () => {
    try {
      const response = await API.get('/medications/adherence');
      const adherence = response.adherence || { rate: 0, total: 0, taken: 0 };
      
      const rate = Math.round(adherence.rate);
      elements.adherenceRate.textContent = `${rate}%`;
      elements.adherenceText.textContent = `${rate}%`;
      
      const circumference = 100;
      const offset = circumference - (rate / 100) * circumference;
      elements.adherenceCircle.style.strokeDasharray = `${circumference} ${circumference}`;
      elements.adherenceCircle.style.strokeDashoffset = offset;
      
      // Color based on rate
      let color = 'var(--color-danger)';
      if (rate >= 80) color = 'var(--color-success)';
      else if (rate >= 60) color = 'var(--color-warning)';
      elements.adherenceCircle.style.stroke = color;
      
    } catch (error) {
      console.error('Error loading adherence:', error);
      elements.adherenceRate.textContent = '--%';
      elements.adherenceText.textContent = '--%';
    }
  };

  // ===== RENDER MEDICATIONS =====

  const renderMedications = () => {
    const container = elements.list;
    if (!container) return;

    if (medications.length === 0) {
      container.innerHTML = `
        <div class="empty-state text-center p-8">
          <div style="font-size: 48px; margin-bottom: var(--spacing-4);">💊</div>
          <div class="empty-title">No medications</div>
          <div class="empty-description">Add your medications to track them.</div>
          <button class="btn btn-primary mt-4" id="empty-add-btn">Add Medication</button>
        </div>
      `;
      
      container.querySelector('#empty-add-btn')?.addEventListener('click', openAddModal);
      return;
    }

    container.innerHTML = medications.map(med => {
      const schedule = getSchedule(med);
      
      return `
        <div class="medication-card" data-id="${med.id}">
          <div class="med-icon">💊</div>
          <div class="med-info">
            <div class="med-name">${med.name}</div>
            <div class="med-details">
              <span>${med.dosage}</span>
              <span>•</span>
              <span>${med.frequency}</span>
              <span>•</span>
              <span>${med.instructions || 'No instructions'}</span>
            </div>
            ${schedule ? `
              <div class="med-schedule">
                ${schedule.map(s => `
                  <div class="dose-dot ${s.status}" title="${s.time} - ${s.status}">
                    ${s.time}
                  </div>
                `).join('')}
              </div>
            ` : ''}
          </div>
          <div class="med-status">
            <span class="badge ${med.is_active ? 'badge-success' : 'badge-warning'}">
              ${med.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
          <div class="med-actions">
            <button class="btn btn-sm btn-outline edit-med-btn" data-id="${med.id}">✏️ Edit</button>
            <button class="btn btn-sm btn-danger delete-med-btn" data-id="${med.id}">🗑️</button>
          </div>
        </div>
      `;
    }).join('');

    // Event handlers
    container.querySelectorAll('.edit-med-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const med = medications.find(m => m.id === id);
        if (med) openEditModal(med);
      });
    });

    container.querySelectorAll('.delete-med-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        if (confirm('Delete this medication?')) {
          await deleteMedication(id);
        }
      });
    });
  };

  // ===== GET SCHEDULE =====

  const getSchedule = (med) => {
    if (!med.schedule) return null;
    
    const times = med.schedule.split(',').map(t => t.trim());
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    return times.map(time => {
      const [hour, minute] = time.split(':').map(Number);
      const isPast = hour < currentHour || (hour === currentHour && minute < currentMinute);
      const isSoon = !isPast && (hour === currentHour || hour === currentHour + 1);
      
      let status = 'upcoming';
      if (isPast) status = 'missed';
      else if (isSoon) status = 'taken';
      
      return { time, status };
    });
  };

  // ===== ADD MEDICATION =====

  const addMedication = async () => {
    const data = getFormData();
    if (!data) return;

    elements.confirmBtn.disabled = true;
    elements.confirmBtn.innerHTML = '<div class="spinner spinner-sm spinner-white"></div> Adding...';

    try {
      await API.post('/medications', data);
      
      Toast.success('Added!', 'Medication added successfully.');
      closeModal();
      await loadMedications();
      await loadAdherence();
      
    } catch (error) {
      App.handleError(error);
    } finally {
      elements.confirmBtn.disabled = false;
      elements.confirmBtn.textContent = 'Add Medication';
    }
  };

  // ===== UPDATE MEDICATION =====

  const updateMedication = async () => {
    const data = getFormData();
    if (!data || !editingId) return;

    elements.confirmBtn.disabled = true;
    elements.confirmBtn.innerHTML = '<div class="spinner spinner-sm spinner-white"></div> Updating...';

    try {
      await API.put(`/medications/${editingId}`, data);
      
      Toast.success('Updated!', 'Medication updated successfully.');
      closeModal();
      await loadMedications();
      await loadAdherence();
      
    } catch (error) {
      App.handleError(error);
    } finally {
      elements.confirmBtn.disabled = false;
      elements.confirmBtn.textContent = 'Update Medication';
    }
  };

  // ===== DELETE MEDICATION =====

  const deleteMedication = async (id) => {
    try {
      await API.delete(`/medications/${id}`);
      
      Toast.success('Deleted', 'Medication deleted successfully.');
      await loadMedications();
      await loadAdherence();
      
    } catch (error) {
      App.handleError(error);
    }
  };

  // ===== GET FORM DATA =====

  const getFormData = () => {
    const name = elements.nameInput.value.trim();
    const dosage = elements.dosageInput.value.trim();
    const frequency = elements.frequencyInput.value;
    const time = elements.timeInput.value;
    const instructions = elements.instructionsInput.value.trim();
    const startDate = elements.startDateInput.value;
    const endDate = elements.endDateInput.value;

    if (!name || !dosage || !frequency) {
      Toast.warning('Incomplete', 'Please fill in all required fields.');
      return null;
    }

    return {
      name,
      dosage,
      frequency,
      schedule: time || '09:00',
      instructions: instructions || null,
      start_date: startDate || null,
      end_date: endDate || null,
    };
  };

  // ===== OPEN MODAL =====

  const openAddModal = () => {
    editingId = null;
    elements.modalTitle.textContent = 'Add Medication';
    elements.confirmBtn.textContent = 'Add Medication';
    elements.form.reset();
    elements.timeInput.value = '09:00';
    elements.startDateInput.value = new Date().toISOString().split('T')[0];
    elements.modal.classList.add('active');
  };

  const openEditModal = (med) => {
    editingId = med.id;
    elements.modalTitle.textContent = 'Edit Medication';
    elements.confirmBtn.textContent = 'Update Medication';
    
    elements.nameInput.value = med.name || '';
    elements.dosageInput.value = med.dosage || '';
    elements.frequencyInput.value = med.frequency || 'daily';
    elements.timeInput.value = med.schedule?.split(',')[0] || '09:00';
    elements.instructionsInput.value = med.instructions || '';
    elements.startDateInput.value = med.start_date || '';
    elements.endDateInput.value = med.end_date || '';
    
    elements.modal.classList.add('active');
  };

  const closeModal = () => {
    elements.modal.classList.remove('active');
    editingId = null;
  };

  // ===== EVENT LISTENERS =====

  const setupEventListeners = () => {
    if (elements.addBtn) {
      elements.addBtn.addEventListener('click', openAddModal);
    }

    if (elements.cancelBtn) {
      elements.cancelBtn.addEventListener('click', closeModal);
    }

    if (elements.confirmBtn) {
      elements.confirmBtn.addEventListener('click', () => {
        if (editingId) {
          updateMedication();
        } else {
          addMedication();
        }
      });
    }

    if (elements.modal) {
      elements.modal.addEventListener('click', (e) => {
        if (e.target === elements.modal) closeModal();
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && elements.modal?.classList.contains('active')) {
        closeModal();
      }
    });

    document.querySelector('.theme-toggle')?.addEventListener('click', Theme.toggle);
  };

  // ===== PUBLIC API =====

  return {
    init,
    loadMedications,
    addMedication,
    updateMedication,
    deleteMedication,
    openAddModal,
    closeModal,
  };
})();

export default Medications;