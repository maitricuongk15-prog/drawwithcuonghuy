import { useCallback, useRef, useState } from 'react';

let nextToastId = 1;

export function useFeedback() {
  const [toasts, setToasts] = useState([]);
  const [confirmDialog, setConfirmDialog] = useState({
    visible: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
  });
  const confirmCallbackRef = useRef(null);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const showToast = useCallback(
    ({ type = 'info', message, duration = 2600 }) => {
      if (!message) {
        return;
      }

      const id = nextToastId++;
      setToasts((prev) => [...prev, { id, type, message }]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const showConfirm = useCallback(
    ({ title, message, confirmText = 'Confirm', cancelText = 'Cancel', onConfirm }) => {
      confirmCallbackRef.current = onConfirm || null;
      setConfirmDialog({
        visible: true,
        title: title || 'Confirm',
        message: message || '',
        confirmText,
        cancelText,
      });
    },
    []
  );

  const closeConfirm = useCallback(() => {
    confirmCallbackRef.current = null;
    setConfirmDialog((prev) => ({ ...prev, visible: false }));
  }, []);

  const confirm = useCallback(() => {
    const callback = confirmCallbackRef.current;
    closeConfirm();
    callback?.();
  }, [closeConfirm]);

  return {
    toasts,
    showToast,
    removeToast,
    confirmDialog,
    showConfirm,
    closeConfirm,
    confirm,
  };
}
