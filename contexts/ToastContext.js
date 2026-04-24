// ─── Custom Toast Notification System ───
// Premium animated toast that replaces ugly native Alert.alert() popups.
// Supports: success, error, info, warning variants with auto-dismiss.

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Dimensions, Modal, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ToastContext = createContext({});

export const useToast = () => useContext(ToastContext);

const TOAST_VARIANTS = {
    success: { icon: 'checkmark-circle', color: '#10B981', bg: '#10B98115' },
    error: { icon: 'alert-circle', color: '#EF4444', bg: '#EF444415' },
    info: { icon: 'information-circle', color: '#3B82F6', bg: '#3B82F615' },
    warning: { icon: 'warning', color: '#F59E0B', bg: '#F59E0B15' },
};

// ─── Toast Component ───
const ToastNotification = ({ toast, onDismiss, insets }) => {
    const translateY = useRef(new Animated.Value(-100)).current;
    const opacity = useRef(new Animated.Value(0)).current;
    const scale = useRef(new Animated.Value(0.9)).current;

    useEffect(() => {
        // Slide in with spring
        Animated.parallel([
            Animated.spring(translateY, { toValue: 0, friction: 8, tension: 80, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
            Animated.spring(scale, { toValue: 1, friction: 8, tension: 100, useNativeDriver: true }),
        ]).start();

        // Auto-dismiss
        const timer = setTimeout(() => dismiss(), toast.duration || 2500);
        return () => clearTimeout(timer);
    }, []);

    const dismiss = () => {
        Animated.parallel([
            Animated.timing(translateY, { toValue: -100, duration: 250, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        ]).start(() => onDismiss());
    };

    const variant = TOAST_VARIANTS[toast.type] || TOAST_VARIANTS.info;

    return (
        <Animated.View
            style={[
                styles.toast,
                {
                    transform: [{ translateY }, { scale }],
                    opacity,
                    top: insets.top + 8,
                    borderLeftColor: variant.color,
                    backgroundColor: '#1a1a2e',
                },
            ]}
        >
            <TouchableOpacity style={styles.toastContent} onPress={dismiss} activeOpacity={0.8}>
                <View style={[styles.toastIconBox, { backgroundColor: variant.bg }]}>
                    <Ionicons name={variant.icon} size={20} color={variant.color} />
                </View>
                <View style={styles.toastTextContainer}>
                    {toast.title && <Text style={styles.toastTitle}>{toast.title}</Text>}
                    <Text style={styles.toastMessage} numberOfLines={2}>{toast.message}</Text>
                </View>
                <Ionicons name="close" size={16} color="rgba(255,255,255,0.4)" />
            </TouchableOpacity>
        </Animated.View>
    );
};

// ─── Confirm Modal ───
const ConfirmModal = ({ confirm, onDismiss, insets }) => {
    const scale = useRef(new Animated.Value(0.85)).current;
    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.spring(scale, { toValue: 1, friction: 8, tension: 80, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        ]).start();
    }, []);

    const dismiss = (result) => {
        Animated.parallel([
            Animated.timing(scale, { toValue: 0.85, duration: 150, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0, duration: 150, useNativeDriver: true }),
        ]).start(() => {
            if (result && confirm.onConfirm) confirm.onConfirm();
            onDismiss();
        });
    };

    const isDestructive = confirm.variant === 'destructive';

    return (
        <Modal transparent visible animationType="none" onRequestClose={() => dismiss(false)}>
            <Animated.View style={[styles.confirmOverlay, { opacity }]}>
                <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={() => dismiss(false)} />
                <Animated.View style={[styles.confirmCard, { transform: [{ scale }] }]}>
                    {confirm.icon && (
                        <View style={[styles.confirmIconBox, { backgroundColor: isDestructive ? '#EF444420' : '#3B82F620' }]}>
                            <Ionicons name={confirm.icon || (isDestructive ? 'warning' : 'help-circle')} size={32} color={isDestructive ? '#EF4444' : '#3B82F6'} />
                        </View>
                    )}
                    <Text style={styles.confirmTitle}>{confirm.title}</Text>
                    {confirm.message && <Text style={styles.confirmMessage}>{confirm.message}</Text>}
                    <View style={styles.confirmActions}>
                        <TouchableOpacity style={styles.confirmBtnCancel} onPress={() => {
                            if (confirm.onCancel) {
                                // Custom cancel action — execute it then dismiss
                                Animated.parallel([
                                    Animated.timing(scale, { toValue: 0.85, duration: 150, useNativeDriver: true }),
                                    Animated.timing(opacity, { toValue: 0, duration: 150, useNativeDriver: true }),
                                ]).start(() => {
                                    confirm.onCancel();
                                    onDismiss();
                                });
                            } else {
                                dismiss(false);
                            }
                        }}>
                            <Text style={styles.confirmBtnCancelText}>{confirm.cancelText || 'Cancel'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.confirmBtnAction, isDestructive && styles.confirmBtnDestructive]}
                            onPress={() => dismiss(true)}
                        >
                            <Text style={[styles.confirmBtnActionText, isDestructive && { color: '#fff' }]}>
                                {confirm.confirmText || 'Confirm'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            </Animated.View>
        </Modal>
    );
};

// ─── Toast Provider ───
export const ToastProvider = ({ children }) => {
    const insets = useSafeAreaInsets();
    const [toasts, setToasts] = useState([]);
    const [confirm, setConfirm] = useState(null);
    const idRef = useRef(0);

    const showToast = useCallback((message, type = 'info', title = null, duration = 2500) => {
        const id = ++idRef.current;
        setToasts(prev => [...prev.slice(-2), { id, message, type, title, duration }]);
    }, []);

    const showConfirm = useCallback((title, message, onConfirm, opts = {}) => {
        setConfirm({
            title,
            message,
            onConfirm,
            variant: opts.variant || 'default',
            confirmText: opts.confirmText,
            cancelText: opts.cancelText,
            icon: opts.icon,
            onCancel: opts.onCancel || null,
        });
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ showToast, showConfirm }}>
            {children}
            {/* Toasts */}
            <View style={styles.toastContainer} pointerEvents="box-none">
                {toasts.map(toast => (
                    <ToastNotification key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} insets={insets} />
                ))}
            </View>
            {/* Confirm */}
            {confirm && <ConfirmModal confirm={confirm} onDismiss={() => setConfirm(null)} insets={insets} />}
        </ToastContext.Provider>
    );
};

const styles = StyleSheet.create({
    toastContainer: {
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 9999, elevation: 9999,
        alignItems: 'center', pointerEvents: 'box-none',
    },
    toast: {
        width: SCREEN_WIDTH - 32, borderRadius: 14,
        borderLeftWidth: 4, marginBottom: 8,
        shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3, shadowRadius: 16, elevation: 12,
    },
    toastContent: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingHorizontal: 16, paddingVertical: 14,
    },
    toastIconBox: {
        width: 36, height: 36, borderRadius: 10,
        justifyContent: 'center', alignItems: 'center',
    },
    toastTextContainer: { flex: 1 },
    toastTitle: { color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 2 },
    toastMessage: { color: 'rgba(255,255,255,0.75)', fontSize: 13, lineHeight: 18 },

    confirmOverlay: {
        flex: 1, justifyContent: 'center', alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    confirmCard: {
        width: SCREEN_WIDTH - 64, backgroundColor: '#1a1a2e',
        borderRadius: 20, padding: 28, alignItems: 'center',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
        shadowColor: '#000', shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.4, shadowRadius: 24, elevation: 16,
    },
    confirmIconBox: {
        width: 56, height: 56, borderRadius: 28,
        justifyContent: 'center', alignItems: 'center', marginBottom: 16,
    },
    confirmTitle: { color: '#fff', fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
    confirmMessage: { color: 'rgba(255,255,255,0.6)', fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
    confirmActions: { flexDirection: 'row', gap: 12, width: '100%' },
    confirmBtnCancel: {
        flex: 1, paddingVertical: 14, borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center',
    },
    confirmBtnCancelText: { color: 'rgba(255,255,255,0.7)', fontSize: 15, fontWeight: '600' },
    confirmBtnAction: {
        flex: 1, paddingVertical: 14, borderRadius: 12,
        backgroundColor: '#3B82F6', alignItems: 'center',
    },
    confirmBtnDestructive: { backgroundColor: '#EF4444' },
    confirmBtnActionText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});

export default ToastContext;
