import App from '/js/app.js';
import Theme from '/js/theme.js';
import API from '/js/services/api.js';
import AuthService from '/js/services/auth.js';
import Toast from '/js/toast.js';
import I18n from '/js/services/i18n.js';

const Users = (() => {
  const pageSize = 20;
  const tableContainer = document.getElementById('users-table-container');
  const searchInput = document.getElementById('user-search');
  const roleFilter = document.getElementById('user-role-filter');
  const pageStatus = document.getElementById('users-page-status');
  const previousButton = document.getElementById('users-previous');
  const nextButton = document.getElementById('users-next');
  const modal = document.getElementById('add-user-modal');
  const userForm = document.getElementById('add-user-form');
  let page = 1;
  let total = 0;
  let currentUsers = [];
  let searchTimer;
  let loading = false;
  let activeRequest = 0;

  const addCell = (row, text) => {
    const cell = document.createElement('td');
    cell.textContent = text;
    row.appendChild(cell);
    return cell;
  };

  const createActionButton = (label, className, handler) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = label;
    button.addEventListener('click', handler);
    return button;
  };

  const render = (users) => {
    currentUsers = users;
    tableContainer.replaceChildren();
    if (!users.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      const message = document.createElement('p');
      message.textContent = 'No users match your search.';
      empty.appendChild(message);
      tableContainer.appendChild(empty);
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'table-container';
    const table = document.createElement('table');
    table.className = 'user-table';
    const head = document.createElement('thead');
    const headerRow = document.createElement('tr');
    ['Name', 'Email', 'Role', 'Specialty', 'Status', 'Created', 'Actions'].forEach((label) => {
      const heading = document.createElement('th');
      heading.scope = 'col';
      heading.textContent = label;
      headerRow.appendChild(heading);
    });
    head.appendChild(headerRow);
    const body = document.createElement('tbody');

    users.forEach((user) => {
      const row = document.createElement('tr');
      addCell(row, user.full_name || '—');
      addCell(row, user.email || '—');

      const roleCell = document.createElement('td');
      const roleSelect = document.createElement('select');
      roleSelect.className = 'input-field';
      roleSelect.setAttribute('aria-label', `Role for ${user.full_name || user.email}`);
      ['patient', 'doctor', 'admin'].forEach((role) => {
        const option = document.createElement('option');
        option.value = role;
        option.textContent = role.charAt(0).toUpperCase() + role.slice(1);
        option.selected = role === user.role;
        roleSelect.appendChild(option);
      });
      roleSelect.disabled = user.id === AuthService.getUser()?.id;
      roleSelect.addEventListener('change', async () => {
        if (!window.confirm(`Change ${user.full_name || user.email}'s role to ${roleSelect.value}?`)) {
          roleSelect.value = user.role;
          return;
        }
        roleSelect.disabled = true;
        try {
          await API.patch(`/admin/users/${encodeURIComponent(user.id)}/role`, { role: roleSelect.value });
          user.role = roleSelect.value;
          await loadUsers();
          Toast.success('Role updated', 'The user role has been changed.');
        } catch (error) {
          Toast.error('Could not update role', error.message || 'Please try again.');
          roleSelect.value = user.role;
        } finally {
          roleSelect.disabled = false;
        }
      });
      roleCell.appendChild(roleSelect);
      row.appendChild(roleCell);

      const specialtyCell = document.createElement('td');
      if (user.role === 'doctor') {
        const specialtyInput = document.createElement('input');
        specialtyInput.className = 'input-field';
        specialtyInput.value = user.specialty || 'General Medicine';
        specialtyInput.maxLength = 120;
        specialtyInput.setAttribute('aria-label', `Specialty for ${user.full_name || user.email}`);
        const saveSpecialty = createActionButton('Save', 'btn btn-sm btn-outline', async () => {
          saveSpecialty.disabled = true;
          try {
            const result = await API.patch(
              `/admin/users/${encodeURIComponent(user.id)}/doctor-profile`,
              { specialty: specialtyInput.value.trim() },
            );
            user.specialty = result.specialty;
            specialtyInput.value = result.specialty;
            Toast.success('Specialty updated', 'The doctor specialty has been saved.');
          } catch (error) {
            Toast.error('Could not update specialty', error.message || 'Please try again.');
          } finally {
            saveSpecialty.disabled = false;
          }
        });
        specialtyCell.append(specialtyInput, saveSpecialty);
      } else {
        specialtyCell.textContent = '—';
      }
      row.appendChild(specialtyCell);

      const active = Boolean(user.is_active);
      const statusCell = addCell(row, active ? 'Active' : 'Disabled');
      statusCell.className = active ? 'text-success' : 'text-danger';

      const created = user.created_at ? I18n.formatDate(user.created_at) : '—';
      addCell(row, created);
      const actionsCell = document.createElement('td');
      const statusButton = createActionButton(
        active ? 'Disable' : 'Enable',
        `btn btn-sm ${active ? 'btn-outline' : 'btn-primary'}`,
        async () => {
          if (user.id === AuthService.getUser()?.id) {
            Toast.error('Action not allowed', 'You cannot disable your own account.');
            return;
          }
          const nextStatus = !active;
          if (!window.confirm(`${nextStatus ? 'Enable' : 'Disable'} ${user.full_name || user.email}?`)) return;
          statusButton.disabled = true;
          try {
            const result = await API.patch(`/admin/users/${encodeURIComponent(user.id)}/status`, {
              is_active: nextStatus,
            });
            user.is_active = result.user.is_active;
            await loadUsers();
            Toast.success('Status updated', `The account is now ${nextStatus ? 'active' : 'disabled'}.`);
          } catch (error) {
            statusButton.disabled = false;
            Toast.error('Could not update status', error.message || 'Please try again.');
          }
        },
      );
      statusButton.disabled = user.id === AuthService.getUser()?.id;
      actionsCell.appendChild(statusButton);
      row.appendChild(actionsCell);
      body.appendChild(row);
    });

    table.append(head, body);
    wrapper.appendChild(table);
    tableContainer.appendChild(wrapper);
  };

  const updatePager = () => {
    const pages = Math.max(1, Math.ceil(total / pageSize));
    pageStatus.textContent = `Page ${page} of ${pages} · ${total} users`;
    previousButton.disabled = loading || page <= 1;
    nextButton.disabled = loading || page >= pages;
  };

  const loadUsers = async () => {
    const requestId = ++activeRequest;
    loading = true;
    updatePager();
    tableContainer.textContent = 'Loading users…';
    try {
      const params = {
        page,
        page_size: pageSize,
        search: searchInput.value.trim() || undefined,
        role: roleFilter.value === 'all' ? undefined : roleFilter.value,
      };
      const result = await API.get('/admin/users', { params });
      if (requestId !== activeRequest) return;
      total = result.total;
      render(result.users);
    } catch (error) {
      if (requestId !== activeRequest) return;
      tableContainer.replaceChildren();
      const message = document.createElement('p');
      message.className = 'text-danger';
      message.textContent = error.message || 'Could not load users.';
      const retry = createActionButton('Try again', 'btn btn-outline btn-sm', loadUsers);
      tableContainer.append(message, retry);
      Toast.error('Users unavailable', error.message || 'Could not load users.');
    } finally {
      if (requestId === activeRequest) {
        loading = false;
        updatePager();
      }
    }
  };

  const setSelectedRole = (role) => {
    const roleSelect = document.getElementById('new-user-role');
    const specialtyGroup = document.getElementById('doctor-specialty-group');
    const specialtyInput = userForm.elements.namedItem('specialty');
    roleSelect.value = role;
    specialtyGroup.hidden = role !== 'doctor';
    specialtyInput.required = role === 'doctor';
  };

  const openModal = (role = 'patient') => {
    setSelectedRole(role);
    modal.classList.add('active');
    userForm.querySelector('input[name="full_name"]').focus();
  };

  const closeModal = () => {
    modal.classList.remove('active');
    document.getElementById('add-user-btn').focus();
  };

  const createUser = async (event) => {
    event.preventDefault();
    const submitButton = document.getElementById('add-user-submit');
    const formData = new FormData(userForm);
    submitButton.disabled = true;
    submitButton.textContent = 'Creating…';
    try {
      await API.post('/admin/users', Object.fromEntries(formData.entries()));
      userForm.reset();
      closeModal();
      page = 1;
      await loadUsers();
      Toast.success('User created', 'The account has been created successfully.');
    } catch (error) {
      Toast.error('Could not create user', error.message || 'Please review the details and try again.');
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Create user';
    }
  };

  const init = async () => {
    try {
      document.querySelectorAll('.theme-toggle').forEach((button) => {
        button.addEventListener('click', Theme.toggle);
      });
      document.addEventListener('healthmind:languagechange', () => render(currentUsers));
      document.getElementById('add-user-btn').addEventListener('click', openModal);
      document.getElementById('add-doctor-btn').addEventListener('click', () => openModal('doctor'));
      document.getElementById('add-user-close').addEventListener('click', closeModal);
      document.getElementById('add-user-cancel').addEventListener('click', closeModal);
      modal.addEventListener('click', (event) => {
        if (event.target === modal) closeModal();
      });
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && modal.classList.contains('active')) closeModal();
      });
      userForm.addEventListener('submit', createUser);
      document.getElementById('new-user-role').addEventListener('change', (event) => {
        setSelectedRole(event.target.value);
      });
      searchInput.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
          page = 1;
          loadUsers();
        }, 300);
      });
      roleFilter.addEventListener('change', () => {
        page = 1;
        loadUsers();
      });
      previousButton.addEventListener('click', () => {
        if (page > 1) {
          page -= 1;
          loadUsers();
        }
      });
      nextButton.addEventListener('click', () => {
        if (page * pageSize < total) {
          page += 1;
          loadUsers();
        }
      });
      const params = new URLSearchParams(window.location.search);
      if (['patient', 'doctor', 'admin'].includes(params.get('role'))) {
        roleFilter.value = params.get('role');
      }
      await loadUsers();
      if (params.get('add') === 'doctor') {
        openModal('doctor');
      }
    } catch (error) {
      console.error('Error initializing users page:', error);
      App.handleError(error);
    } finally {
      App.hideLoading();
    }
  };

  return { init, loadUsers };
})();

export default Users;
