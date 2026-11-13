import App from '/js/app.js';
import Theme from '/js/theme.js';
import AuthService from '/js/services/auth.js';
import Toast from '/js/toast.js';
import I18n from '/js/services/i18n.js';

const Settings = (() => {
  const PREFERENCES_KEY = 'healthmind-notification-preferences';
  const preferenceIds = [
    'notif-appointments',
    'notif-medications',
    'notif-updates',
    'notif-promotions',
  ];

  const readPreferences = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(PREFERENCES_KEY) || '{}');
      return Object.fromEntries(
        preferenceIds.map((id) => [id, typeof saved[id] === 'boolean' ? saved[id] : id !== 'notif-promotions']),
      );
    } catch (error) {
      console.error('Failed to read notification preferences:', error);
      return Object.fromEntries(preferenceIds.map((id) => [id, id !== 'notif-promotions']));
    }
  };

  const updateThemeLabel = () => {
    const label = document.getElementById('theme-toggle-label');
    if (label) label.textContent = Theme.isDark() ? 'Switch to Light Mode' : 'Switch to Dark Mode';
  };

  const init = async () => {
    try {
      document.querySelectorAll('.theme-toggle').forEach((button) => {
        button.addEventListener('click', () => {
          Theme.toggle();
          updateThemeLabel();
        });
      });

      const themeButton = document.getElementById('theme-toggle-settings');
      themeButton?.addEventListener('click', () => {
        Theme.toggle();
        updateThemeLabel();
      });
      updateThemeLabel();

      const preferences = readPreferences();
      preferenceIds.forEach((id) => {
        const checkbox = document.getElementById(id);
        if (checkbox) checkbox.checked = preferences[id];
      });

      document.getElementById('notification-settings-form')?.addEventListener('submit', (event) => {
        event.preventDefault();
        const next = Object.fromEntries(
          preferenceIds.map((id) => [id, Boolean(document.getElementById(id)?.checked)]),
        );
        try {
          localStorage.setItem(PREFERENCES_KEY, JSON.stringify(next));
          Toast.success('Saved', 'Notification preferences saved on this device.');
        } catch (error) {
          console.error('Failed to save notification preferences:', error);
          Toast.error('Save failed', 'Could not save notification preferences on this device.');
        }
      });

      const languageSelect = document.getElementById('language-select');
      if (languageSelect) {
        languageSelect.value = I18n.getLanguage();
        languageSelect.addEventListener('change', () => {
          try {
            I18n.setLanguage(languageSelect.value);
            Toast.success('Saved', I18n.translateText('Your language preference has been saved.'));
          } catch (error) {
            console.error('Failed to save language preference:', error);
            languageSelect.value = I18n.getLanguage();
            Toast.error(
              I18n.translateText('Save failed'),
              I18n.translateText('Could not save your language preference on this device.'),
            );
          }
        });
      }

      document.getElementById('logout-settings')?.addEventListener('click', async () => {
        const button = document.getElementById('logout-settings');
        button.disabled = true;
        try {
          await AuthService.logout();
        } catch (error) {
          button.disabled = false;
          console.error('Failed to log out from settings:', error);
          Toast.error('Log out failed', error.message || 'Could not log out. Please try again.');
        }
      });

      App.hideLoading();
    } catch (error) {
      console.error('Error initializing settings page:', error);
      Toast.error('Settings unavailable', 'Could not initialize settings. Please reload the page.');
      App.hideLoading();
    }
  };

  return { init };
})();

export default Settings;
