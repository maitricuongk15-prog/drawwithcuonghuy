import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

function toastTypeStyle(type) {
  if (type === 'success') {
    return styles.toastSuccess;
  }
  if (type === 'error') {
    return styles.toastError;
  }
  if (type === 'warning') {
    return styles.toastWarning;
  }
  return styles.toastInfo;
}

export function ToastStack({ toasts, onClose }) {
  if (!toasts?.length) {
    return null;
  }

  return (
    <View pointerEvents="box-none" style={styles.toastStack}>
      {toasts.map((toast) => (
        <TouchableOpacity
          key={toast.id}
          activeOpacity={0.9}
          onPress={() => onClose?.(toast.id)}
          style={[styles.toastCard, toastTypeStyle(toast.type)]}
        >
          <Text style={styles.toastText}>{toast.message}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export function ConfirmDialog({ visible, title, message, confirmText, cancelText, onCancel, onConfirm }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.modalMessage}>{message}</Text>
          <View style={styles.modalActions}>
            <TouchableOpacity onPress={onCancel} style={styles.modalCancelButton}>
              <Text style={styles.modalCancelText}>{cancelText || 'Cancel'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onConfirm} style={styles.modalConfirmButton}>
              <Text style={styles.modalConfirmText}>{confirmText || 'Confirm'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  toastStack: {
    position: 'absolute',
    top: 48,
    left: 12,
    right: 12,
    zIndex: 1000,
    gap: 8,
  },
  toastCard: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 4,
  },
  toastInfo: {
    backgroundColor: '#eef4ff',
    borderColor: '#9eb7e6',
  },
  toastSuccess: {
    backgroundColor: '#eaf9ef',
    borderColor: '#8ec79e',
  },
  toastError: {
    backgroundColor: '#feeceb',
    borderColor: '#e2a5a2',
  },
  toastWarning: {
    backgroundColor: '#fff8e7',
    borderColor: '#e2c37d',
  },
  toastText: {
    color: '#1f2937',
    fontSize: 13,
    fontWeight: '500',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    padding: 18,
    borderWidth: 1,
    borderColor: '#d7dce5',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalCancelButton: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  modalConfirmButton: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#0078d4',
  },
  modalCancelText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
  },
  modalConfirmText: {
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '700',
  },
});
