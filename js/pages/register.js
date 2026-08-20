import AuthService from '/js/services/auth.js';
import App from '/js/app.js';
import { showToast } from '/js/toast.js';

const RegisterPage = (() => {
  const init = () => {
    const form = document.getElementById('register-form');
    const registerBtn = document.getElementById('register-btn');
    const passwordInput = document.getElementById('password');
    const confirmInput = document.getElementById('confirm-password');
    const passwordToggle = document.getElementById('password-toggle');
    const strengthBars = document.querySelectorAll('#password-strength div');
    const strengthLabel = document.getElementById('password-strength-label');

    if (!form || !registerBtn || !passwordInput || !confirmInput) {
      App.hideLoading();
      return;
    }

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

    const clearErrors = () => {
      document.querySelectorAll('.input-error').forEach(el => {
        el.textContent = '';
      });
      document.querySelectorAll('.input-field').forEach(el => {
        el.classList.remove('error');
      });
    };

    const calculateAge = (dob) => {
      const today = new Date();
      const birthDate = new Date(dob);
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age;
    };

    const calculatePasswordStrength = (password) => {
      const checks = [
        password.length >= 8,
        /[a-z]/.test(password),
        /[A-Z]/.test(password),
        /[0-9]/.test(password),
        /[^a-zA-Z0-9]/.test(password),
      ];

      const score = checks.filter(Boolean).length;
      const levels = [
        { label: 'Very Weak', color: 'var(--color-danger)' },
        { label: 'Weak', color: 'var(--color-danger)' },
        { label: 'Fair', color: 'var(--color-warning)' },
        { label: 'Good', color: 'var(--color-success)' },
        { label: 'Strong', color: 'var(--color-success)' },
      ];

      const index = Math.min(score, 4);
      return {
        score: index + 1,
        label: levels[index].label,
        color: levels[index].color,
      };
    };

    const validateForm = () => {
      let isValid = true;

      const fullName = document.getElementById('full-name').value.trim();
      const email = document.getElementById('email').value.trim();
      const phone = document.getElementById('phone').value.trim();
      const dob = document.getElementById('dob').value;
      const role = document.getElementById('role').value;
      const password = passwordInput.value;
      const confirm = confirmInput.value;

      if (!fullName) {
        showError('full-name', 'Full name is required');
        isValid = false;
      } else if (fullName.length < 2) {
        showError('full-name', 'Name must be at least 2 characters');
        isValid = false;
      }

      if (!email) {
        showError('email', 'Email is required');
        isValid = false;
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showError('email', 'Please enter a valid email address');
        isValid = false;
      }

      if (phone && !/^[\+\d\s\-\(\)]{7,20}$/.test(phone)) {
        showError('phone', 'Please enter a valid phone number');
        isValid = false;
      }

      if (!dob) {
        showError('dob', 'Date of birth is required');
        isValid = false;
      } else if (calculateAge(dob) < 18) {
        showError('dob', 'You must be at least 18 years old');
        isValid = false;
      }

      if (!role) {
        showError('role', 'Please select your role');
        isValid = false;
      }

      if (!password) {
        showError('password', 'Password is required');
        isValid = false;
      } else if (password.length < 8) {
        showError('password', 'Password must be at least 8 characters');
        isValid = false;
      }

      if (!confirm) {
        showError('confirm-password', 'Please confirm your password');
        isValid = false;
      } else if (password && confirm !== password) {
        showError('confirm-password', 'Passwords do not match');
        isValid = false;
      }

      if (!document.getElementById('terms').checked) {
        showError('terms', 'You must agree to the Terms of Service');
        isValid = false;
      }

      return isValid;
    };

    passwordToggle?.addEventListener('click', () => {
      const type = passwordInput.type === 'password' ? 'text' : 'password';
      passwordInput.type = type;
      passwordToggle.textContent = type === 'password' ? '👁️' : '🙈';
    });

    passwordInput.addEventListener('input', () => {
      const strength = calculatePasswordStrength(passwordInput.value);

      strengthBars.forEach((bar, index) => {
        bar.style.background = index < strength.score ? strength.color : 'var(--color-border)';
      });

      if (strengthLabel) {
        strengthLabel.textContent = strength.label;
        strengthLabel.style.color = strength.color;
      }
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearErrors();

      if (!validateForm()) {
        return;
      }

      registerBtn.disabled = true;
      registerBtn.innerHTML = '<div class="spinner spinner-sm spinner-white"></div> Creating account...';

      try {
        const formData = {
          full_name: document.getElementById('full-name').value.trim(),
          email: document.getElementById('email').value.trim(),
          phone: document.getElementById('phone').value.trim(),
          password: passwordInput.value,
          date_of_birth: document.getElementById('dob').value,
          role: document.getElementById('role').value,
        };

        const response = await AuthService.register(formData);

        showToast('success', 'Account Created!', 'Welcome to HealthMind AI. Redirecting...');

        const role = response.user?.role || 'patient';
        let redirectUrl = '/dashboard.html';
        if (role === 'doctor') {
          redirectUrl = '/doctor-dashboard.html';
        } else if (role === 'admin') {
          redirectUrl = '/admin-dashboard.html';
        }

        setTimeout(() => {
          window.location.href = redirectUrl;
        }, 1000);
      } catch (error) {
        App.handleError(error);
        registerBtn.disabled = false;
        registerBtn.textContent = 'Create Account';

        if (error.data?.error?.details) {
          const details = error.data.error.details;
          Object.keys(details).forEach(key => {
            const fieldMap = {
              email: 'email',
              password: 'password',
              full_name: 'full-name',
              phone: 'phone',
              date_of_birth: 'dob',
              role: 'role',
            };
            const fieldId = fieldMap[key];
            if (fieldId) {
              showError(fieldId, Array.isArray(details[key]) ? details[key][0] : details[key]);
            }
          });
        } else if (/already registered|already exists/i.test(error.message || '')) {
          showError('email', 'An account with this email already exists.');
        }
      }
    });

    document.getElementById('google-register')?.addEventListener('click', async () => {
      try {
        await AuthService.loginWithGoogle();
      } catch (error) {
        App.handleError(error);
      }
    });

    App.hideLoading();
  };

  return { init };
})();

export default RegisterPage;
