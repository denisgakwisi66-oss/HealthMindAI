/**
 * ============================================
 * HEALTHMIND AI — PROFILE PAGE
 * ============================================
 */

import App from '/js/app.js';
import Theme from '/js/theme.js';
import AuthService from '/js/services/auth.js';
import Toast from '/js/toast.js';

const Profile = (() => {
  const el = (id) => document.getElementById(id);

  const init = async () => {
    try {
      document.querySelector('.theme-toggle')?.addEventListener('click', Theme.toggle);
      const user = await AuthService.getCurrentUser();
      if (!user) {
        window.location.href = '/login.html';
        return;
      }
      renderUser(user);
      bindEvents();
      App.hideLoading();
    } catch (error) {
      console.error('Error initializing profile page:', error);
      Toast.error('Error', 'Failed to load profile.');
      App.hideLoading();
    }
  };

  const initialsFor = (name) => {
    const parts = String(name || 'U').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'U';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  };

  const renderUser = (user) => {
    const fullName = user.full_name || 'User';
    const initials = el('profile-initials');
    const name = el('profile-name');
    const email = el('profile-email');
    const roleBadge = el('profile-role');
    const fullNameInput = el('profile-fullname');
    const emailInput = el('profile-email-input');
    const phone = el('profile-phone');
    const dob = el('profile-dob');

    if (initials) initials.textContent = initialsFor(fullName);
    if (name) name.textContent = fullName;
    if (email) email.textContent = user.email || '';
    if (roleBadge) {
      const role = user.role || 'patient';
      roleBadge.textContent = role.charAt(0).toUpperCase() + role.slice(1);
    }
    if (fullNameInput) fullNameInput.value = fullName;
    if (emailInput) {
      emailInput.value = user.email || '';
      emailInput.readOnly = true;
      emailInput.title = 'Email is managed by your login account';
    }
    if (phone) phone.value = user.phone || '';
    if (dob) dob.value = user.date_of_birth || '';
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    const fullName = el('profile-fullname')?.value?.trim();
    if (!fullName || fullName.length < 2) {
      Toast.error('Validation', 'Full name must be at least 2 characters.');
      return;
    }
    try {
      const response = await AuthService.updateProfile({
        full_name: fullName,
        phone: el('profile-phone')?.value?.trim() || null,
        date_of_birth: el('profile-dob')?.value || null,
      });
      renderUser(response.user || AuthService.getUser());
      Toast.success('Saved', 'Profile updated.');
    } catch (error) {
      Toast.error('Save failed', error.message || 'Could not update profile.');
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    const next = el('new-password')?.value || '';
    const confirm = el('confirm-password')?.value || '';
    if (next.length < 8) {
      Toast.error('Validation', 'New password must be at least 8 characters.');
      return;
    }
    if (next !== confirm) {
      Toast.error('Validation', 'New password and confirmation do not match.');
      return;
    }
    try {
      await AuthService.changePassword(next);
      el('password-form')?.reset();
      Toast.success('Updated', 'Password changed successfully.');
    } catch (error) {
      Toast.error('Password update failed', error.message || 'Could not change password.');
    }
  };

  const deleteAccount = async () => {
    const confirmation = prompt('Type DELETE to permanently disable your account:');
    if (confirmation !== 'DELETE') {
      Toast.info('Cancelled', 'Account was not deleted.');
      return;
    }
    if (!confirm('This will disable your account. Continue?')) return;
    try {
      await AuthService.deleteAccount();
      Toast.success('Deleted', 'Your account has been disabled.');
      window.location.href = '/login.html';
    } catch (error) {
      Toast.error('Delete failed', error.message || 'Could not delete account.');
    }
  };

  const bindEvents = () => {
    el('profile-form')?.addEventListener('submit', saveProfile);
    el('password-form')?.addEventListener('submit', changePassword);
    el('delete-account-btn')?.addEventListener('click', deleteAccount);
  };

  return { init };
})();

export default Profile;
