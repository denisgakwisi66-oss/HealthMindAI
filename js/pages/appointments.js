/**
 * ============================================
 * HEALTHMIND AI — APPOINTMENTS PAGE
 * ============================================
 */

import App from '/js/app.js';
import AuthService from '/js/services/auth.js';
import Navigation from '/js/navigation.js';
import Theme from '/js/theme.js';
import API from '/js/services/api.js';
import Toast from '/js/components/toast.js';

const Appointments = (() => {
  // ===== STATE =====

  let appointments = [];
  let specialties = [];
  let doctors = [];
  let currentView = 'list';
  let filters = {
    status: 'all',
    date: '',
    search: '',
  };

  // ===== DOM REFS =====

  const elements = {
    list: document.getElementById('appointments-list'),
    statusFilter: document.getElementById('status-filter'),
    dateFilter: document.getElementById('date-filter'),
    searchFilter: document.getElementById('search-filter'),
    bookBtn: document.getElementById('book-appointment-btn'),
    bookingModal: document.getElementById('booking-modal'),
    bookingForm: document.getElementById('booking-form'),
    bookingSpecialty: document.getElementById('booking-specialty'),
    bookingDoctor: document.getElementById('booking-doctor'),
    bookingDate: document.getElementById('booking-date'),
    bookingTime: document.getElementById('booking-time'),
    bookingNotes: document.getElementById('booking-notes'),
    bookingConfirm: document.getElementById('booking-confirm'),
    bookingCancel: document.getElementById('booking-cancel'),
    viewToggle: document.querySelector('.view-toggle'),
  };

  // ===== INITIALIZE =====

  const init = async () => {
    try {
      // Setup navigation
      const userRole = AuthService.getRole() || 'patient';
      Navigation.init(userRole, true);

      // Load data
      await Promise.all([
        loadAppointments(),
        loadSpecialties(),
      ]);

      // Setup event listeners
      setupEventListeners();

      // Hide loading
      App.hideLoading();

    } catch (error) {
      App.handleError(error);
      App.hideLoading();
    }
  };

  // ===== LOAD APPOINTMENTS =====

  const loadAppointments = async () => {
    try {
      const params = {};
      if (filters.status !== 'all') params.status = filters.status;
      if (filters.date) params.date_from = filters.date;
      if (filters.search) params.search = filters.search;

      const response = await API.get('/appointments', { params });
      appointments = response.appointments || [];
      renderAppointments();
    } catch (error) {
      console.error('Error loading appointments:', error);
      appointments = [];
      renderAppointments();
      Toast.error('Error', 'Failed to load appointments.');
    }
  };

  // ===== LOAD SPECIALTIES =====

  const loadSpecialties = async () => {
    try {
      const response = await API.get('/appointments/specialties');
      specialties = response.specialties || [];
      
      // Populate specialty dropdown
      const select = elements.bookingSpecialty;
      select.innerHTML = '<option value="">Select specialty...</option>';
      specialties.forEach(spec => {
        const option = document.createElement('option');
        option.value = spec.id || spec;
        option.textContent = spec.name || spec;
        select.appendChild(option);
      });
    } catch (error) {
      console.error('Error loading specialties:', error);
      specialties = [];
    }
  };

  // ===== LOAD DOCTORS =====

  const loadDoctors = async (specialty) => {
    try {
      const params = specialty ? { specialty } : {};
      const response = await API.get('/appointments/doctors', { params });
      doctors = response.doctors || [];
      
      // Populate doctor dropdown
      const select = elements.bookingDoctor;
      select.innerHTML = '<option value="">Select doctor...</option>';
      doctors.forEach(doc => {
        const option = document.createElement('option');
        option.value = doc.id;
        option.textContent = `${doc.name} - ${doc.specialty || 'General'}`;
        select.appendChild(option);
      });
    } catch (error) {
      console.error('Error loading doctors:', error);
      doctors = [];
    }
  };

  // ===== LOAD AVAILABLE SLOTS =====

  const loadAvailableSlots = async (doctorId, date) => {
    try {
      const response = await API.get('/appointments/available-slots', {
        params: { doctor_id: doctorId, date }
      });
      
      const slots = response.slots || [];
      const select = elements.bookingTime;
      select.innerHTML = '<option value="">Select time...</option>';
      slots.forEach(slot => {
        const option = document.createElement('option');
        option.value = slot;
        option.textContent = slot;
        select.appendChild(option);
      });
    } catch (error) {
      console.error('Error loading available slots:', error);
      const select = elements.bookingTime;
      select.innerHTML = '<option value="">No slots available</option>';
    }
  };

  // ===== RENDER APPOINTMENTS =====

  const renderAppointments = () => {
    const container = elements.list;
    if (!container) return;

    if (currentView === 'calendar') {
      renderCalendar();
      return;
    }

    if (appointments.length === 0) {
      container.innerHTML = `
        <div class="empty-appointments">
          <div class="empty-icon">📅</div>
          <div class="empty-title">No appointments found</div>
          <div class="empty-description">
            ${filters.status !== 'all' || filters.search 
              ? 'Try adjusting your filters.' 
              : 'Book your first appointment today.'}
          </div>
          ${!filters.status !== 'all' && !filters.search ? `
            <button class="btn btn-primary" id="empty-book-btn">Book an Appointment</button>
          ` : ''}
        </div>
      `;
      
      const emptyBtn = container.querySelector('#empty-book-btn');
      if (emptyBtn) {
        emptyBtn.addEventListener('click', openBookingModal);
      }
      return;
    }

    container.innerHTML = appointments.map(appt => `
      <div class="appointment-card" data-id="${appt.id}">
        <div class="appointment-date">
          <span class="day">${formatDay(appt.date)}</span>
          <span class="month">${formatMonth(appt.date)}</span>
        </div>
        <div class="appointment-info">
          <div class="doctor-name">${appt.doctor_name || 'Doctor'}</div>
          <div class="appointment-details">
            <span>${appt.specialty || 'General'}</span>
            <span>•</span>
            <span>${appt.time || 'Time TBD'}</span>
            <span>•</span>
            <span>${appt.location || 'Location TBD'}</span>
          </div>
        </div>
        <div class="appointment-status">
          <span class="badge status-${appt.status || 'upcoming'}">
            ${appt.status || 'Upcoming'}
          </span>
        </div>
        <div class="appointment-actions">
          ${appt.status !== 'cancelled' && appt.status !== 'completed' ? `
            <button class="btn btn-sm btn-outline reschedule-btn" data-id="${appt.id}">🔄 Reschedule</button>
            <button class="btn btn-sm btn-danger cancel-btn" data-id="${appt.id}">✕ Cancel</button>
          ` : ''}
        </div>
      </div>
    `).join('');

    // Event handlers
    container.querySelectorAll('.cancel-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        if (confirm('Are you sure you want to cancel this appointment?')) {
          await cancelAppointment(id);
        }
      });
    });

    container.querySelectorAll('.reschedule-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const appt = appointments.find(a => a.id === id);
        if (appt) {
          openRescheduleModal(appt);
        }
      });
    });

    container.querySelectorAll('.appointment-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        const appt = appointments.find(a => a.id === id);
        if (appt) {
          showAppointmentDetails(appt);
        }
      });
    });
  };

  // ===== RENDER CALENDAR =====

  const renderCalendar = () => {
    const container = elements.list;
    if (!container) return;

    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    // Get appointments for this month
    const monthAppointments = appointments.filter(appt => {
      const apptDate = new Date(appt.date);
      return apptDate.getMonth() === currentMonth && apptDate.getFullYear() === currentYear;
    });

    const appointmentDates = new Set(monthAppointments.map(a => new Date(a.date).getDate()));

    let html = `
      <div class="calendar-view active">
        <div class="calendar-header">
          <button class="btn btn-ghost btn-sm" id="calendar-prev">←</button>
          <h4>${new Date(currentYear, currentMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}</h4>
          <button class="btn btn-ghost btn-sm" id="calendar-next">→</button>
        </div>
        <div class="calendar-grid">
    `;

    // Day headers
    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(day => {
      html += `<div class="calendar-day-header">${day}</div>`;
    });

    // Empty days
    for (let i = 0; i < firstDay; i++) {
      html += `<div class="calendar-day"></div>`;
    }

    // Days
    for (let day = 1; day <= daysInMonth; day++) {
      const isToday = day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();
      const hasAppointment = appointmentDates.has(day);
      const isPast = new Date(currentYear, currentMonth, day) < new Date(today.setHours(0, 0, 0, 0));
      
      html += `
        <div class="calendar-day ${isToday ? 'today' : ''} ${hasAppointment ? 'has-appointment' : ''} ${isPast ? 'past' : ''}" data-day="${day}">
          <span class="day-number">${day}</span>
          ${hasAppointment ? '<span class="day-dot"></span>' : ''}
        </div>
      `;
    }

    html += `
        </div>
      </div>
    `;

    container.innerHTML = html;

    // Calendar navigation
    container.querySelector('#calendar-prev')?.addEventListener('click', () => {
      // Implement month navigation
    });
    container.querySelector('#calendar-next')?.addEventListener('click', () => {
      // Implement month navigation
    });
  };

  // ===== BOOK APPOINTMENT =====

  const bookAppointment = async () => {
    const form = elements.bookingForm;
    const data = {
      specialty: elements.bookingSpecialty.value,
      doctor_id: elements.bookingDoctor.value,
      date: elements.bookingDate.value,
      time: elements.bookingTime.value,
      notes: elements.bookingNotes.value,
    };

    // Validate
    if (!data.specialty || !data.doctor_id || !data.date || !data.time) {
      Toast.warning('Incomplete', 'Please fill in all required fields.');
      return;
    }

    elements.bookingConfirm.disabled = true;
    elements.bookingConfirm.innerHTML = '<div class="spinner spinner-sm spinner-white"></div> Booking...';

    try {
      await API.post('/appointments', data);
      
      Toast.success('Booked!', 'Appointment booked successfully.');
      closeBookingModal();
      await loadAppointments();
      
    } catch (error) {
      App.handleError(error);
    } finally {
      elements.bookingConfirm.disabled = false;
      elements.bookingConfirm.textContent = 'Confirm Booking';
    }
  };

  // ===== CANCEL APPOINTMENT =====

  const cancelAppointment = async (id) => {
    try {
      await API.post(`/appointments/${id}/cancel`, { reason: 'Cancelled by patient' });
      
      Toast.success('Cancelled', 'Appointment cancelled successfully.');
      await loadAppointments();
      
    } catch (error) {
      App.handleError(error);
    }
  };

  // ===== OPEN BOOKING MODAL =====

  const openBookingModal = () => {
    const modal = elements.bookingModal;
    if (!modal) return;

    // Reset form
    elements.bookingForm.reset();
    elements.bookingSpecialty.value = '';
    elements.bookingDoctor.innerHTML = '<option value="">Select doctor...</option>';
    elements.bookingTime.innerHTML = '<option value="">Select time...</option>';
    
    // Set min date to today
    const today = new Date().toISOString().split('T')[0];
    elements.bookingDate.min = today;
    elements.bookingDate.value = today;

    modal.classList.add('active');
  };

  const closeBookingModal = () => {
    elements.bookingModal.classList.remove('active');
  };

  // ===== OPEN RESCHEDULE MODAL =====

  const openRescheduleModal = (appointment) => {
    // Pre-fill booking modal with appointment data
    elements.bookingSpecialty.value = appointment.specialty_id || '';
    elements.bookingDoctor.value = appointment.doctor_id || '';
    elements.bookingDate.value = appointment.date || '';
    elements.bookingNotes.value = `Rescheduling: ${appointment.doctor_name} on ${appointment.date} at ${appointment.time}`;
    
    // Load available slots
    if (appointment.doctor_id && appointment.date) {
      loadAvailableSlots(appointment.doctor_id, appointment.date);
    }
    
    // Change confirm button text
    elements.bookingConfirm.textContent = 'Reschedule';
    elements.bookingConfirm.dataset.action = 'reschedule';
    elements.bookingConfirm.dataset.id = appointment.id;
    
    openBookingModal();
  };

  // ===== SHOW APPOINTMENT DETAILS =====

  const showAppointmentDetails = (appointment) => {
    // Could open a detail modal or navigate to detail page
    Toast.info('Appointment Details', `
      ${appointment.doctor_name}
      ${appointment.specialty}
      ${appointment.date} at ${appointment.time}
      ${appointment.location || 'Location TBD'}
    `);
  };

  // ===== HELPER FUNCTIONS =====

  const formatDay = (dateStr) => {
    if (!dateStr) return '--';
    const date = new Date(dateStr);
    return date.getDate().toString().padStart(2, '0');
  };

  const formatMonth = (dateStr) => {
    if (!dateStr) return '---';
    const date = new Date(dateStr);
    return date.toLocaleString('default', { month: 'short' });
  };

  // ===== EVENT LISTENERS =====

  const setupEventListeners = () => {
    // Book button
    if (elements.bookBtn) {
      elements.bookBtn.addEventListener('click', openBookingModal);
    }

    // Booking modal
    if (elements.bookingCancel) {
      elements.bookingCancel.addEventListener('click', closeBookingModal);
    }

    if (elements.bookingConfirm) {
      elements.bookingConfirm.addEventListener('click', bookAppointment);
    }

    // Close modal on overlay click
    if (elements.bookingModal) {
      elements.bookingModal.addEventListener('click', (e) => {
        if (e.target === elements.bookingModal) {
          closeBookingModal();
        }
      });
    }

    // Specialty change -> load doctors
    if (elements.bookingSpecialty) {
      elements.bookingSpecialty.addEventListener('change', (e) => {
        const specialty = e.target.value;
        loadDoctors(specialty);
      });
    }

    // Doctor change -> load available slots
    if (elements.bookingDoctor) {
      elements.bookingDoctor.addEventListener('change', (e) => {
        const doctorId = e.target.value;
        const date = elements.bookingDate.value;
        if (doctorId && date) {
          loadAvailableSlots(doctorId, date);
        }
      });
    }

    // Date change -> load available slots
    if (elements.bookingDate) {
      elements.bookingDate.addEventListener('change', (e) => {
        const date = e.target.value;
        const doctorId = elements.bookingDoctor.value;
        if (doctorId && date) {
          loadAvailableSlots(doctorId, date);
        }
      });
    }

    // Filters
    if (elements.statusFilter) {
      elements.statusFilter.addEventListener('change', (e) => {
        filters.status = e.target.value;
        loadAppointments();
      });
    }

    if (elements.dateFilter) {
      elements.dateFilter.addEventListener('change', (e) => {
        filters.date = e.target.value;
        loadAppointments();
      });
    }

    if (elements.searchFilter) {
      let timeout;
      elements.searchFilter.addEventListener('input', (e) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          filters.search = e.target.value;
          loadAppointments();
        }, 300);
      });
    }

    // View toggle
    if (elements.viewToggle) {
      elements.viewToggle.querySelectorAll('.btn').forEach(btn => {
        btn.addEventListener('click', () => {
          elements.viewToggle.querySelectorAll('.btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          currentView = btn.dataset.view || 'list';
          renderAppointments();
        });
      });
    }

    // Theme toggle
    document.querySelector('.theme-toggle')?.addEventListener('click', () => {
      Theme.toggle();
    });

    // Close modal on escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && elements.bookingModal?.classList.contains('active')) {
        closeBookingModal();
      }
    });
  };

  // ===== PUBLIC API =====

  return {
    init,
    loadAppointments,
    bookAppointment,
    cancelAppointment,
    openBookingModal,
    closeBookingModal,
  };
})();

// ===== START =====

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => Appointments.init());
} else {
  Appointments.init();
}

export default Appointments;