import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { AlertConfig, registerAlertListener, closeCurrentAlert } from '../utils/alert';

export default function GlobalAlertModal() {
    const { theme } = useTheme();
    const [config, setConfig] = useState<AlertConfig | null>(null);

    useEffect(() => {
        const unsubscribe = registerAlertListener((newConfig) => {
            setConfig(newConfig);
        });
        return unsubscribe;
    }, []);

    if (!config) return null;

    const getStatusIcon = (title: string, message: string, destructive?: boolean) => {
        const text = (title + ' ' + message).toLowerCase();
        if (destructive || text.includes('elimina') || text.includes('cancella') || text.includes('rimuov')) {
            return '🗑️';
        }
        if (text.includes('errore') || text.includes('fallit') || text.includes('sbagliat')) {
            return '❌';
        }
        if (text.includes('successo') || text.includes('completat') || text.includes('salvat') || text.includes('aggiornat') || text.includes('pronto')) {
            return '✅';
        }
        if (text.includes('attenzion') || text.includes('avviso') || text.includes('limite') || text.includes('warning')) {
            return '⚠️';
        }
        if (config.type === 'confirmation') {
            return '💬';
        }
        return 'ℹ️';
    };

    const handleConfirm = () => {
        const onConfirm = config.onConfirm;
        closeCurrentAlert();
        if (onConfirm) {
            onConfirm();
        }
    };

    const handleCancel = () => {
        const onCancel = config.onCancel;
        closeCurrentAlert();
        if (onCancel) {
            onCancel();
        }
    };

    const icon = getStatusIcon(config.title, config.message, config.destructive);
    const isDestructive = config.destructive;

    return (
        <Modal
            visible={true}
            transparent={true}
            animationType="fade"
            onRequestClose={handleCancel}
        >
            <View style={styles.backdrop}>
                <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                    <View style={styles.headerRow}>
                        <Text style={styles.icon}>{icon}</Text>
                        <Text style={[styles.title, { color: theme.colors.text }]}>
                            {config.title}
                        </Text>
                    </View>

                    <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
                        <Text style={[styles.message, { color: theme.colors.textSecondary }]}>
                            {config.message}
                        </Text>
                    </ScrollView>

                    <View style={styles.buttonsRow}>
                        {config.type === 'confirmation' && (
                            <TouchableOpacity
                                style={[styles.button, styles.cancelButton, { borderColor: theme.colors.border }]}
                                onPress={handleCancel}
                                activeOpacity={0.7}
                            >
                                <Text style={[styles.buttonText, { color: theme.colors.text }]}>
                                    {config.cancelText || 'Annulla'}
                                </Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity
                            style={[
                                styles.button,
                                styles.confirmButton,
                                {
                                    backgroundColor: isDestructive
                                        ? (theme.colors.danger || '#DC2626')
                                        : theme.colors.primary,
                                    flex: config.type === 'confirmation' ? 1 : undefined,
                                    width: config.type === 'alert' ? '100%' : undefined,
                                }
                            ]}
                            onPress={handleConfirm}
                            activeOpacity={0.8}
                        >
                            <Text style={[styles.buttonText, { color: '#ffffff' }]}>
                                {config.confirmText || (config.type === 'confirmation' ? 'Conferma' : 'OK')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.65)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        zIndex: 9999,
    },
    card: {
        width: '100%',
        maxWidth: 420,
        borderRadius: 20,
        borderWidth: 1,
        padding: 22,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 12,
    },
    icon: {
        fontSize: 26,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        flex: 1,
        letterSpacing: 0.3,
    },
    scrollArea: {
        maxHeight: 280,
        marginBottom: 20,
    },
    message: {
        fontSize: 15,
        lineHeight: 22,
    },
    buttonsRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 10,
    },
    button: {
        paddingVertical: 12,
        paddingHorizontal: 18,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 100,
    },
    cancelButton: {
        borderWidth: 1,
        backgroundColor: 'transparent',
        flex: 1,
    },
    confirmButton: {
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
    },
    buttonText: {
        fontSize: 15,
        fontWeight: 'bold',
    },
});
