import App from '/js/app.js';
import Theme from '/js/theme.js';

const Patients = (() => {
  const init = async () => {
    try {
      // App.init() already rendered navigation before this page script ran.
      document.querySelector('.theme-toggle')?.addEventListener('click', Theme.toggle);
      App.hideLoading();
    } catch (error) {
      console.error('Error initializing patients page:', error);
      App.hideLoading();
    }
  };

  return { init };
})();

export default Patients;
