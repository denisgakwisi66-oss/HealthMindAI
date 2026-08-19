/**
 * ============================================
 * HEALTHMIND AI — EMERGENCY PAGE
 * ============================================
 * Wires up the SOS button, geolocation, emergency
 * contacts and nearby-facility lookup.
 */

import App from '/js/app.js';
import AuthService from '/js/services/auth.js';
import Navigation from '/js/navigation.js';
import Theme from '/js/theme.js';
import API from '/js/services/api.js';
import Toast from '/js/components/toast.js';

const CONTACTS_KEY = 'healthmind_emergency_contacts';

const Emergency = (() => {
  // ===== STATE =====

  let lastKnownLocation = null; // { latitude, longitude, accuracy }
  let isSending = false;

  // ===== DOM REFS =====

  const elements = {
    sosBtn: document.getElementById('sos-btn'),
    status: document.getElementById('emergency-status'),
    confirmModal: document.getElementById('emergency-confirm'),
    confirmBtn: document.getElementById('emergency-confirm-btn'),
    cancelBtn: document.getElementById('emergency-cancel'),
    successModal: document.getElementById('emergency-success'),
    okBtn: document.getElementById('emergency-ok'),
    savedContacts: document.getElementById('saved-contacts'),
    addContactBtn: document.getElementById('add-contact-btn'),
    locationInfo: document.getElementById('location-info'),
    shareLocationBtn: document.getElementById('share-location-btn'),
    nearbyFacilities: document.getElementById('nearby-facilities'),
    findFacilitiesBtn: document.getElementById('find-facilities-btn'),
  };

  // ===== EMERGENCY CONTACTS (stored locally on-device) =====

  const getContacts = () => {
    try {
      const raw = localStorage.getItem(CONTACTS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  };

  const saveContacts = (contacts) => {
    try {
      localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
    } catch (e) {
      // ignore storage errors
    }
  };

  const renderContacts = () => {
    if (!elements.savedContacts) return;
    const contacts = getContacts();

    if (contacts.length === 0) {
      elements.savedContacts.innerHTML = '';
      return;
    }

    elements.savedContacts.innerHTML = contacts.map((contact, index) => `
      <div class="emergency-contact" data-index="${index}">
        <span class="contact-name">${escapeHtml(contact.name)}</span>
        <span style="display:flex; align-items:center; gap: var(--spacing-2);">
          <a href="tel:${escapeHtml(contact.phone)}" class="contact-phone">${escapeHtml(contact.phone)}</a>
          <button class="btn btn-ghost btn-sm remove-contact-btn" data-index="${index}" aria-label="Remove ${escapeHtml(contact.name)}">✕</button>
        </span>
      </div>
    `).join('');

    elements.savedContacts.querySelectorAll('.remove-contact-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index, 10);
        const updated = getContacts().filter((_, i) => i !== idx);
        saveContacts(updated);
        renderContacts();
        Toast.success('Contact removed', 'Emergency contact removed.');
      });
    });
  };

  const escapeHtml = (str = '') => String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const addContact = () => {
    const name = prompt('Contact name:');
    if (!name) return;
    const phone = prompt('Contact phone number:');
    if (!phone) return;

    const contacts = getContacts();
    contacts.push({ name: name.trim(), phone: phone.trim() });
    saveContacts(contacts);
    renderContacts();
    Toast.success('Contact added', `${name} was added to your emergency contacts.`);
  };

  // ===== LOCATION =====

  const requestLocation = () => {
    if (!('geolocation' in navigator)) {
      if (elements.locationInfo) {
        elements.locationInfo.innerHTML = `<p style="color: var(--color-danger);">Location services are not supported on this device.</p>`;
      }
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        lastKnownLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
        renderLocation();
      },
      (error) => {
        lastKnownLocation = null;
        if (elements.locationInfo) {
          const message = error.code === error.PERMISSION_DENIED
            ? 'Location access was denied. Enable it in your browser settings to share your location during an emergency.'
            : 'Unable to determine your location right now.';
          elements.locationInfo.innerHTML = `<p style="color: var(--color-warning, var(--color-danger));">${message}</p>`;
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const renderLocation = () => {
    if (!elements.locationInfo) return;
    if (!lastKnownLocation) {
      elements.locationInfo.innerHTML = `<p style="color: var(--color-text-secondary);">Location not available yet.</p>`;
      return;
    }
    const { latitude, longitude, accuracy } = lastKnownLocation;
    const mapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
    elements.locationInfo.innerHTML = `
      <p style="margin: 0 0 var(--spacing-2) 0;">📍 ${latitude.toFixed(5)}, ${longitude.toFixed(5)}</p>
      <p style="font-size: var(--font-size-sm); color: var(--color-text-secondary); margin: 0 0 var(--spacing-2) 0;">Accuracy: ~${Math.round(accuracy)}m</p>
      <a href="${mapsUrl}" target="_blank" rel="noopener" class="btn btn-outline btn-sm">View on map</a>
    `;
  };

  const shareLocation = async () => {
    if (!lastKnownLocation) {
      requestLocation();
      Toast.info('Locating…', 'Finding your current location.');
      return;
    }
    const { latitude, longitude } = lastKnownLocation;
    const mapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: 'My location', text: 'Here is my current location.', url: mapsUrl });
        return;
      } catch (e) {
        // user cancelled or share failed — fall through to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(mapsUrl);
      Toast.success('Location copied', 'Your location link was copied to the clipboard.');
    } catch (e) {
      window.open(mapsUrl, '_blank', 'noopener');
    }
  };

  // ===== NEARBY FACILITIES =====

  const findFacilities = () => {
    if (!elements.nearbyFacilities) return;

    const openSearch = (lat, lon) => {
      const query = lat != null ? `hospital near ${lat},${lon}` : 'hospital near me';
      const url = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
      elements.nearbyFacilities.innerHTML = `
        <p style="color: var(--color-text-secondary); margin: 0 0 var(--spacing-2) 0;">Opening nearby hospitals and clinics in Google Maps…</p>
        <a href="${url}" target="_blank" rel="noopener" class="btn btn-outline btn-sm">🔍 Open in Maps</a>
      `;
      window.open(url, '_blank', 'noopener');
    };

    if (lastKnownLocation) {
      openSearch(lastKnownLocation.latitude, lastKnownLocation.longitude);
      return;
    }

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          lastKnownLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          };
          renderLocation();
          openSearch(lastKnownLocation.latitude, lastKnownLocation.longitude);
        },
        () => openSearch(null, null),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      openSearch(null, null);
    }
  };

  // ===== SOS FLOW =====

  const openConfirmModal = () => {
    elements.confirmModal?.classList.add('active');
  };

  const closeConfirmModal = () => {
    elements.confirmModal?.classList.remove('active');
  };

  const openSuccessModal = () => {
    elements.successModal?.classList.add('active');
  };

  const closeSuccessModal = () => {
    elements.successModal?.classList.remove('active');
  };

  const setStatus = (label, triggered = false) => {
    if (!elements.status) return;
    elements.status.textContent = label;
    elements.status.classList.toggle('triggered', triggered);
  };

  const sendEmergencyAlert = async () => {
    if (isSending) return;
    isSending = true;

    elements.confirmBtn?.setAttribute('disabled', 'true');
    setStatus('Sending…', true);
    elements.sosBtn?.classList.add('pulsing');

    try {
      const payload = {
        location: lastKnownLocation
          ? {
              latitude: lastKnownLocation.latitude,
              longitude: lastKnownLocation.longitude,
              accuracy: lastKnownLocation.accuracy,
            }
          : null,
        message: 'Emergency SOS triggered from the HealthMind AI app.',
      };

      await API.post('/emergency/alert', payload);

      closeConfirmModal();
      openSuccessModal();
      setStatus('Alert Sent', true);
      Toast.success('Emergency alert sent', 'Your emergency alert has been sent.');
    } catch (error) {
      console.error('Failed to send emergency alert:', error);
      closeConfirmModal();
      setStatus('Ready', false);
      elements.sosBtn?.classList.remove('pulsing');

      const message = error?.data?.error?.message || error?.message || 'Please call emergency services directly.';
      Toast.error('Could not send alert', message);
    } finally {
      isSending = false;
      elements.confirmBtn?.removeAttribute('disabled');
    }
  };

  // ===== EVENT LISTENERS =====

  const setupEventListeners = () => {
    elements.sosBtn?.addEventListener('click', openConfirmModal);
    elements.cancelBtn?.addEventListener('click', closeConfirmModal);
    elements.confirmBtn?.addEventListener('click', sendEmergencyAlert);
    elements.okBtn?.addEventListener('click', () => {
      closeSuccessModal();
      setStatus('Ready', false);
      elements.sosBtn?.classList.remove('pulsing');
    });

    // Close modals by clicking the overlay backdrop
    [elements.confirmModal, elements.successModal].forEach((modal) => {
      modal?.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.remove('active');
        }
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeConfirmModal();
      }
    });

    elements.addContactBtn?.addEventListener('click', addContact);
    elements.shareLocationBtn?.addEventListener('click', shareLocation);
    elements.findFacilitiesBtn?.addEventListener('click', findFacilities);
  };

  // ===== INITIALIZE =====

  const init = async () => {
    try {
      const role = AuthService.getRole() || 'patient';
      Navigation.init(role, true);
      document.querySelector('.theme-toggle')?.addEventListener('click', Theme.toggle);

      setStatus('Ready', false);
      renderContacts();
      setupEventListeners();
      requestLocation();

      App.hideLoading();
    } catch (error) {
      console.error('Error initializing emergency page:', error);
      App.hideLoading();
    }
  };

  return { init };
})();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => Emergency.init());
} else {
  Emergency.init();
}

export default Emergency;
