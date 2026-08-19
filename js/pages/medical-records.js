import App from '/js/app.js';
import AuthService from '/js/services/auth.js';
import Navigation from '/js/navigation.js';
import Theme from '/js/theme.js';

const MedicalRecords = (() => {
  const init = async () => {
    try {
      const role = AuthService.getRole() || 'patient';
      Navigation.init(role, true);
      document.querySelector('.theme-toggle')?.addEventListener('click', Theme.toggle);
      App.hideLoading();
    } catch (error) {
      console.error('Error initializing medical records page:', error);
      App.hideLoading();
    }
  };

  return { init };
})();

export default MedicalRecords;
