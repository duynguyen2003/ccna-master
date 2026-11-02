import React, { useRef } from 'react';
import Dialog from '../../../components/ui/Dialog';
export default function LabRestartConfirmation({
  onCancel,
  onConfirm,
  theme = 'dark',
  returnFocusRef,
}) {
  const action = useRef(null);
  const closeWith = (event, callback) => {
    action.current = callback;
    event.currentTarget.closest('dialog').dispatchEvent(new Event('cancel', { cancelable: true }));
  };
  return (
    <Dialog
      title="Làm lại từ đầu?"
      className={`cli-lab-restart-dialog cli-lab-restart-dialog--${theme} cli-lab-stitch cli-lab-stitch--${theme}`}
      onClose={() => (action.current || onCancel)()}
      returnFocusRef={returnFocusRef}
      animateExit
    >
      <p>
        Phiên hiện tại sẽ kết thúc và một bài thực hành mới sẽ được mở. Lịch sử cũ vẫn được giữ lại.
      </p>
      <div className="cli-lab-confirm-actions">
        <button type="button" onClick={(event) => closeWith(event, onCancel)}>
          Tiếp tục thực hành
        </button>
        <button type="button" onClick={(event) => closeWith(event, onConfirm)}>
          Làm lại từ đầu
        </button>
      </div>
    </Dialog>
  );
}
