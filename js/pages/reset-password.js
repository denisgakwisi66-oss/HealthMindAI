import AuthService from '/js/services/auth.js';
import App from '/js/app.js';
import { showToast } from '/js/toast.js';

const ResetPasswordPage = (() => {
  const init = () => {
    const form = document.getElementById('reset-password-form');
    const passwordInput = document.getElementById('password');
    const confirmInput = document.getElementById('confirm-password');
    const submitBtn = document.getElementById('reset-password-btn');
    const passwordToggle = document.getElementById('password-toggle');
    const successState = document.getElementById('success-state');
    const formCard = document.getElementById('reset-password-card');
    const token = new URLSearchParams(window.location.search).get('token');

    if (!form || !passwordInput || !confirmInput || !submitBtn || !successState || !formCard) {
      App.hideLoading();
      return;
    }

    const clearErrors = () => {
      document.querySelectorAll('.input-error').forEach(el => {
        el.textContent = '';
      });
      document.querySelectorAll('.input-field').forEach(el => {
        el.classList.remove('error');
      });
    };

    const showError = (fieldId, message) => {
      const errorEl = document.getElementById(`${fieldId}-error`);
      if (errorEl) {
        errorEl.textContent = message;
      }

      const input = document.getElementById(fieldId);
      if (input) {
        input.classList.add('error');
      }
    };

    const showSuccess = () => {
      form.style.display = 'none';
      successState.style.display = 'block';
    };

    if (!token) {
      form.style.display = 'none';
      showError('password', 'This reset link is missing a token.');
      formCard.insertAdjacentHTML(
        'beforeend',
        '<p style="margin-top: var(--spacing-4); color: var(--color-danger); text-align: center;">This reset link is invalid. Please request a new one.</p>'
      );
      App.hideLoading();
      return;
    }

    passwordToggle?.addEventListener('click', () => {
      const type = passwordInput.type === 'password' ? 'text' : 'password';
      passwordInput.type = type;
      passwordToggle.textContent = type === 'password' ? '👁️' : '🙈';
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearErrors();

      const password = passwordInput.value;
      const confirm = confirmInput.value;

      if (!password) {
        showError('password', 'New password is required');
        return;
      }

      if (password.length < 8) {
        showError('password', 'Password must be at least 8 characters');
        return;
      }

      if (!confirm) {
        showError('confirm-password', 'Please confirm your new password');
        return;
      }

      if (password !== confirm) {
        showError('confirm-password', 'Passwords do not match');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<div class="spinner spinner-sm spinner-white"></div> Resetting...';

      try {
        await AuthService.resetPassword(token, password);
        showToast('success', 'Password Reset', 'Your password has been updated successfully.');
        showSuccess();
      } catch (error) {
        App.handleError(error);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Reset Password';

        if (error.status === 400) {
          showError('password', error?.data?.error?.message || 'This reset link is invalid or expired');
        }
      }
    });

    App.hideLoading();
  };

  return { init };
})();

export default ResetPasswordPage;
