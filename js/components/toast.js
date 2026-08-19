import Toast from '../toast.js';

const showToast = (type, title, message, options = {}) => {
  return Toast.show({ type, title, message, ...options });
};

const ToastComponent = Toast;

export { showToast };
export default ToastComponent;
