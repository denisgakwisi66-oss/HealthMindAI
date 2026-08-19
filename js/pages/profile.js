import App from '/js/app.js';
import AuthService from '/js/services/auth.js';
import Navigation from '/js/navigation.js';
import Theme from '/js/theme.js';

const Profile = (() => {
  const init = async () => {
    try {
      const role = AuthService.getRole() || 'patient';
      Navigation.init(role, true);
      document.querySelector('.theme-toggle')?.addEventListener('click', Theme.toggle);
      App.hideLoading();
    } catch (error) {
      console.error('Error initializing profile page:', error);
      App.hideLoading();
    }
  };

  return { init };
})();

export default Profile;
