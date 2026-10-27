import '../components/ui/styles/UiControls.css';

// Serialize dialogs so simultaneous failures never stack modal focus traps.
let pending = Promise.resolve();

function openDialog(kind, message, initialValue = '') {
  const task = () =>
    new Promise((resolve) => {
      const previousFocus = document.activeElement;
      const dialog = document.createElement('dialog');
      dialog.className = 'app-dialog';
      dialog.setAttribute('aria-labelledby', 'app-dialog-title');
      dialog.setAttribute('aria-describedby', 'app-dialog-message');
      const title = document.createElement('h2');
      title.id = 'app-dialog-title';
      title.textContent =
        kind === 'alert' ? 'Thông báo' : kind === 'prompt' ? 'Thêm liên kết' : 'Xác nhận thao tác';
      const description = document.createElement('p');
      description.id = 'app-dialog-message';
      description.textContent = String(message || 'Vui lòng thử lại.');
      const form = document.createElement('form');
      const actions = document.createElement('div');
      actions.className = 'app-dialog__actions';
      let input;
      if (kind === 'prompt') {
        input = document.createElement('input');
        input.type = 'text';
        input.value = initialValue;
        input.setAttribute('aria-labelledby', description.id);
        form.append(input);
      }
      const finish = (value) => {
        window.removeEventListener('hashchange', cancel);
        window.removeEventListener('popstate', cancel);
        window.removeEventListener('netmaster:navigation', cancel);
        dialog.close();
        dialog.remove();
        if (previousFocus?.isConnected) previousFocus.focus();
        resolve(value);
      };
      const cancel = () => finish(kind === 'prompt' ? null : false);
      if (kind !== 'alert') {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'ui-button ui-button--secondary';
        button.textContent = 'Hủy';
        button.addEventListener('click', cancel);
        actions.append(button);
      }
      const accept = document.createElement('button');
      accept.type = 'submit';
      accept.className = 'ui-button';
      accept.textContent =
        kind === 'alert' ? 'Đã hiểu' : kind === 'prompt' ? 'Thêm liên kết' : 'Xác nhận';
      actions.append(accept);
      form.append(actions);
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        finish(kind === 'prompt' ? input.value : true);
      });
      dialog.addEventListener('cancel', (event) => {
        event.preventDefault();
        cancel();
      });
      dialog.addEventListener('keydown', (event) => {
        if (event.key !== 'Tab') return;
        const controls = [...dialog.querySelectorAll('input, button')];
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      });
      window.addEventListener('hashchange', cancel, { once: true });
      window.addEventListener('popstate', cancel, { once: true });
      window.addEventListener('netmaster:navigation', cancel, { once: true });
      dialog.append(title, description, form);
      document.body.append(dialog);
      dialog.showModal();
      (input || actions.firstElementChild).focus();
    });
  const result = pending.then(task);
  pending = result.catch(() => {});
  return result;
}

export const appAlert = (message) => openDialog('alert', message);
export const appConfirm = (message) => openDialog('confirm', message);
export const appPrompt = (message, initialValue) => openDialog('prompt', message, initialValue);
