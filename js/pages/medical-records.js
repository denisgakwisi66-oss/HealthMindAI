import App from '/js/app.js';
import Theme from '/js/theme.js';

const MedicalRecords = (() => {
  const init = async () => {
    try {
      // App.init() already rendered navigation before this page script ran.
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
