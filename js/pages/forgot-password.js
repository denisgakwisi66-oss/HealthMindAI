import AuthService from '/js/services/auth.js';
import App from '/js/app.js';
import { showToast } from '/js/toast.js';

const ForgotPasswordPage = (() => {
  const init = () => {
    const form = document.getElementById('forgot-form');
    const emailInput = document.getElementById('email');
    const resetBtn = document.getElementById('reset-btn');
    const successState = document.getElementById('success-state');
    const sentEmail = document.getElementById('sent-email');
    const emailError = document.getElementById('email-error');
    const returnToLoginBtn = document.getElementById('return-to-login');

    if (!form || !emailInput || !resetBtn || !successState || !sentEmail || !emailError) {
      App.hideLoading();
      return;
    }

    returnToLoginBtn?.addEventListener('click', () => {
      window.location.href = '/login.html';
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      emailError.textContent = '';
      emailInput.classList.remove('error');

      const email = emailInput.value.trim();
      if (!email) {
        emailError.textContent = 'Email is required';
        emailInput.classList.add('error');
        return;
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        emailError.textContent = 'Please enter a valid email address';
        emailInput.classList.add('error');
        return;
      }

      resetBtn.disabled = true;
      resetBtn.innerHTML = '<div class="spinner spinner-sm spinner-white"></div> Sending...';

      try {
        await AuthService.forgotPassword(email);
        form.style.display = 'none';
        successState.style.display = 'block';
        sentEmail.textContent = email;
        showToast('success', 'Reset Link Sent', 'Check your email for the password reset link.');
      } catch (error) {
        App.handleError(error);
        resetBtn.disabled = false;
        resetBtn.textContent = 'Send Reset Link';

        if (error.status === 404) {
          form.style.display = 'none';
          successState.style.display = 'block';
          sentEmail.textContent = email;
        }
      }
    });

    App.hideLoading();
  };

  return { init };
})();

export default ForgotPasswordPage;
