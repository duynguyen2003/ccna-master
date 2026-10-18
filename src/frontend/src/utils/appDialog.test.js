import { appAlert, appConfirm, appPrompt } from './appDialog';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
});

const opened = async () => {
  await Promise.resolve();
  await Promise.resolve();
  return document.querySelector('dialog');
};

test('cancel never approves a destructive action and restores focus', async () => {
  const trigger = document.createElement('button');
  document.body.append(trigger);
  trigger.focus();
  const result = appConfirm('Xóa tài khoản?');
  const dialog = await opened();
  expect(document.activeElement.textContent).toBe('Hủy');
  dialog.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true })
  );
  expect(document.activeElement.textContent).toBe('Xác nhận');
  dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', cancelable: true }));
  expect(document.activeElement.textContent).toBe('Hủy');
  dialog.querySelector('button').click();
  await expect(result).resolves.toBe(false);
  expect(document.activeElement).toBe(trigger);
  expect(document.querySelector('dialog')).toBeNull();
  trigger.remove();
});

test('confirmation waits for explicit submit', async () => {
  const result = appConfirm('Xác nhận?');
  const dialog = await opened();
  dialog.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
  await expect(result).resolves.toBe(true);
});

test('prompt returns typed text and Escape returns null', async () => {
  const result = appPrompt('Địa chỉ liên kết');
  const dialog = await opened();
  dialog.querySelector('input').value = 'https://example.com';
  dialog.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
  await expect(result).resolves.toBe('https://example.com');
  const cancelled = appPrompt('Địa chỉ liên kết');
  (await opened()).dispatchEvent(new Event('cancel', { cancelable: true }));
  await expect(cancelled).resolves.toBeNull();
});

test('messages are plain text and concurrent dialogs are serialized', async () => {
  const first = appAlert('<img src=x onerror=alert(1)>');
  const second = appConfirm('Thao tác tiếp theo');
  const dialog = await opened();
  expect(document.querySelectorAll('dialog')).toHaveLength(1);
  expect(dialog.querySelector('img')).toBeNull();
  expect(dialog.querySelector('p').textContent).toContain('<img');
  dialog.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
  await first;
  const next = await opened();
  expect(next.querySelector('p').textContent).toBe('Thao tác tiếp theo');
  window.dispatchEvent(new Event('hashchange'));
  await expect(second).resolves.toBe(false);
});
