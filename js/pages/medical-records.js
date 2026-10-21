/**
 * ============================================
 * HEALTHMIND AI — MEDICAL RECORDS PAGE
 * ============================================
 */

import App from '/js/app.js';
import Theme from '/js/theme.js';
import API from '/js/services/api.js';
import { apiUrl } from '/js/services/api-url.js';
import Toast from '/js/toast.js';
import { escapeText as esc } from '/js/security.js';

const MedicalRecords = (() => {
  let records = [];
  let activeTab = 'all';
  let searchQuery = '';
  let typeFilter = 'all';
  let selectedFile = null;

  const TYPE_LABELS = {
    consultation: 'Medical History',
    lab_report: 'Lab Results',
    prescription: 'Prescription',
    imaging: 'Imaging',
    vaccination: 'Vaccination',
    other: 'Document',
  };

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const init = async () => {
    try {
      $('.theme-toggle')?.addEventListener('click', Theme.toggle);
      bindEvents();
      await loadRecords();
      App.hideLoading();
    } catch (error) {
      console.error('Error initializing medical records page:', error);
      Toast.error('Error', 'Failed to load medical records.');
      App.hideLoading();
    }
  };

  const loadRecords = async () => {
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      const qs = params.toString();
      const response = await API.get(`/medical-records${qs ? `?${qs}` : ''}`);
      records = response.records || [];
      render();
    } catch (error) {
      console.error('Error loading records:', error);
      records = [];
      render();
      Toast.error('Error', error.message || 'Failed to load records.');
    }
  };

  const matchesTab = (record) => {
    const t = record.record_type;
    if (activeTab === 'all') return true;
    if (activeTab === 'history') return t === 'consultation';
    if (activeTab === 'lab-results') return t === 'lab_report';
    if (activeTab === 'documents') {
      return ['other', 'imaging', 'prescription', 'vaccination'].includes(t);
    }
    return true;
  };

  const matchesFilters = (record) => {
    if (!matchesTab(record)) return false;
    if (typeFilter === 'history' && record.record_type !== 'consultation') return false;
    if (typeFilter === 'lab' && record.record_type !== 'lab_report') return false;
    if (
      typeFilter === 'document' &&
      !['other', 'imaging', 'prescription', 'vaccination'].includes(record.record_type)
    ) {
      return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const hay = `${record.title || ''} ${record.notes || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  };

  const formatSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (iso) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return iso;
    }
  };

  const render = () => {
    const list = $('#records-list');
    if (!list) return;
    const filtered = records.filter(matchesFilters);

    if (filtered.length === 0) {
      list.innerHTML = `
        <div class="empty-state" style="text-align:center;padding:var(--spacing-8);">
          <div style="font-size:48px;margin-bottom:var(--spacing-3);">📋</div>
          <h3>No records found</h3>
          <p class="text-secondary">Upload a medical record to get started.</p>
        </div>`;
      return;
    }

    list.innerHTML = filtered
      .map((r) => `
      <article class="record-card card" data-id="${r.id}">
        <div class="record-card-body">
          <div style="display:flex;justify-content:space-between;gap:var(--spacing-3);align-items:start;">
            <h3>${esc(r.title || 'Untitled')}</h3>
            <span class="badge">${esc(TYPE_LABELS[r.record_type] || r.record_type || 'Record')}</span>
          </div>
          <p class="text-secondary" style="font-size:var(--font-size-sm);margin:var(--spacing-2) 0;">
            ${esc(r.notes || 'No notes')}
          </p>
          <div style="display:flex;gap:var(--spacing-4);font-size:var(--font-size-sm);color:var(--color-text-tertiary);">
            <span>${formatDate(r.created_at)}</span>
            ${
              r.file_name
                ? `<span>📎 ${esc(r.file_name)} ${formatSize(r.file_size)}</span>`
                : '<span>No file attached</span>'
            }
          </div>
        </div>
        <div style="display:flex;gap:var(--spacing-2);margin-top:var(--spacing-3);">
          ${
            r.file_name
              ? `<button type="button" class="btn btn-outline btn-sm" data-action="download" data-id="${r.id}">Download</button>`
              : ''
          }
          <button type="button" class="btn btn-ghost btn-sm" data-action="delete" data-id="${r.id}">Delete</button>
        </div>
      </article>`)
      .join('');
  };

  const openModal = () => {
    selectedFile = null;
    $('#upload-form')?.reset();
    const info = $('#file-info');
    if (info) info.style.display = 'none';
    $('#upload-modal')?.classList.add('active');
  };

  const closeModal = () => {
    $('#upload-modal')?.classList.remove('active');
    selectedFile = null;
  };

  const showSelectedFile = (file) => {
    selectedFile = file;
    const info = $('#file-info');
    if (!file || !info) return;
    info.style.display = 'block';
    const name = $('#file-name');
    const size = $('#file-size');
    if (name) name.textContent = file.name;
    if (size) size.textContent = ` (${formatSize(file.size)})`;
  };

  const uploadRecord = async () => {
    const type = $('#upload-type')?.value;
    const title = $('#upload-title')?.value?.trim();
    if (!type || !title) {
      Toast.error('Validation', 'Type and title are required.');
      return;
    }
    if (!selectedFile) {
      Toast.error('Validation', 'Please choose a file to upload.');
      return;
    }

    const formData = new FormData();
    formData.append('title', title);
    formData.append('record_type', type);
    const dateVal = $('#upload-date')?.value;
    formData.append('notes', dateVal ? `Record date: ${dateVal}` : '');
    formData.append('file', selectedFile);

    const confirmBtn = $('#upload-confirm');
    try {
      if (confirmBtn) confirmBtn.disabled = true;
      await API.upload('/medical-records', formData);
      Toast.success('Uploaded', 'Medical record saved.');
      closeModal();
      await loadRecords();
    } catch (error) {
      Toast.error('Upload failed', error.message || 'Could not upload record.');
    } finally {
      if (confirmBtn) confirmBtn.disabled = false;
    }
  };

  const downloadRecord = async (id) => {
    try {
      const token = await API.getAccessToken();
      const response = await fetch(apiUrl(`/api/medical-records/${id}/download`), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const disposition = response.headers.get('content-disposition') || '';
      const match = /filename="?([^"]+)"?/i.exec(disposition);
      const filename = match?.[1] || `record-${id}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      Toast.error('Download failed', error.message || 'Could not download file.');
    }
  };

  const deleteRecord = async (id) => {
    if (!confirm('Delete this medical record? This cannot be undone.')) return;
    try {
      await API.delete(`/medical-records/${id}`);
      Toast.success('Deleted', 'Record removed.');
      await loadRecords();
    } catch (error) {
      Toast.error('Delete failed', error.message || 'Could not delete record.');
    }
  };

  const bindEvents = () => {
    $$('.record-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        $$('.record-tab').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        activeTab = tab.dataset.tab || 'all';
        render();
      });
    });

    let searchTimer = null;
    $('#record-search')?.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim();
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => loadRecords(), 300);
    });

    $('#record-type-filter')?.addEventListener('change', (e) => {
      typeFilter = e.target.value;
      render();
    });

    $('#upload-record-btn')?.addEventListener('click', openModal);
    $('#upload-cancel')?.addEventListener('click', closeModal);
    $('#upload-modal .modal-close')?.addEventListener('click', closeModal);
    $('#upload-confirm')?.addEventListener('click', uploadRecord);

    const dropZone = $('#file-drop-zone');
    dropZone?.addEventListener('click', () => $('#upload-file')?.click());
    $('#upload-file')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) showSelectedFile(file);
    });

    ['dragenter', 'dragover'].forEach((evt) => {
      dropZone?.addEventListener(evt, (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
      });
    });
    ['dragleave', 'drop'].forEach((evt) => {
      dropZone?.addEventListener(evt, (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
      });
    });
    dropZone?.addEventListener('drop', (e) => {
      const file = e.dataTransfer?.files?.[0];
      if (file) showSelectedFile(file);
    });

    $('#records-list')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const id = Number(btn.dataset.id);
      if (btn.dataset.action === 'download') downloadRecord(id);
      if (btn.dataset.action === 'delete') deleteRecord(id);
    });
  };

  return { init };
})();

export default MedicalRecords;
