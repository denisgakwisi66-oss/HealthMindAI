import AuthService from '/js/services/auth.js';
import App from '/js/app.js';
import { showToast } from '/js/toast.js';

const LoginPage = (() => {
  const init = async () => {
    const form = document.getElementById('login-form');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const passwordToggle = document.getElementById('password-toggle');
    const loginBtn = document.getElementById('login-btn');
    const rememberMe = document.getElementById('remember-me');

    if (!form || !emailInput || !passwordInput || !loginBtn) {
      App.hideLoading();
      return;
    }

    try {
      const isGoogleCallback = await AuthService.completeGoogleSignIn();
      if (isGoogleCallback) {
        App.hideLoading();
        return;
      }
    } catch (error) {
      App.handleError(error);
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

    const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    const validateForm = () => {
      let isValid = true;
      const email = emailInput.value.trim();
      const password = passwordInput.value;

      if (!email) {
        showError('email', 'Email is required');
        isValid = false;
      } else if (!isValidEmail(email)) {
        showError('email', 'Please enter a valid email address');
        isValid = false;
      }

      if (!password) {
        showError('password', 'Password is required');
        isValid = false;
      } else if (password.length < 8) {
        showError('password', 'Password must be at least 8 characters');
        isValid = false;
      }

      return isValid;
    };

    passwordToggle?.addEventListener('click', () => {
      const type = passwordInput.type === 'password' ? 'text' : 'password';
      passwordInput.type = type;
      passwordToggle.textContent = type === 'password' ? '👁️' : '🙈';
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearErrors();

      if (!validateForm()) {
        return;
      }

      loginBtn.disabled = true;
      loginBtn.innerHTML = '<div class="spinner spinner-sm spinner-white"></div> Logging in...';

      try {
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        const response = await AuthService.login(email, password);

        if (rememberMe?.checked) {
          localStorage.setItem('remember-email', email);
        } else {
          localStorage.removeItem('remember-email');
        }

        showToast('success', 'Welcome back!', `Hello, ${response.user?.full_name || 'User'}!`);
        setTimeout(() => {
          window.location.href = AuthService.getDashboardPath(response.user);
        }, 500);
      } catch (error) {
        App.handleError(error);
        loginBtn.disabled = false;
        loginBtn.textContent = 'Log In';

        if (error.status === 401 || error.status === 400) {
          showError('email', 'Invalid email or password');
          showError('password', 'Please check your credentials');
        }
      }
    });

    const rememberedEmail = localStorage.getItem('remember-email');
    if (rememberedEmail) {
      emailInput.value = rememberedEmail;
      if (rememberMe) rememberMe.checked = true;
    }

    const googleButton = document.getElementById('google-login');
    googleButton?.addEventListener('click', async () => {
      const originalContent = googleButton.innerHTML;
      googleButton.disabled = true;
      googleButton.setAttribute('aria-busy', 'true');
      googleButton.innerHTML = '<div class="spinner spinner-sm"></div> Connecting...';
      try {
        await AuthService.loginWithGoogle();
      } catch (error) {
        App.handleError(error);
        googleButton.disabled = false;
        googleButton.removeAttribute('aria-busy');
        googleButton.innerHTML = originalContent;
      }
    });

    App.hideLoading();
  };

  return { init };
})();

export default LoginPage;
