// utils/alert.ts
// Gestore globale notifiche e conferme grafiche per l'intera app (Web & Native)

export interface AlertConfig {
    type: 'alert' | 'confirmation';
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
    onCancel?: () => void;
    destructive?: boolean;
}

type AlertListener = (config: AlertConfig | null) => void;

let activeListener: AlertListener | null = null;
const queue: AlertConfig[] = [];

/**
 * Registra il componente modale globale (GlobalAlertModal) come listener attivo
 */
export const registerAlertListener = (listener: AlertListener) => {
    activeListener = listener;
    if (queue.length > 0) {
        const next = queue.shift()!;
        listener(next);
    }
    return () => {
        if (activeListener === listener) {
            activeListener = null;
        }
    };
};

/**
 * Chiude il modale attualmente visualizzato e apre l'eventuale notifica successiva in coda
 */
export const closeCurrentAlert = () => {
    if (activeListener) {
        activeListener(null);
    }
    if (queue.length > 0) {
        setTimeout(() => {
            if (activeListener && queue.length > 0) {
                activeListener(queue.shift()!);
            }
        }, 120);
    }
};

/**
 * Mostra un modale grafico di notifica (sostituisce window.alert nativo del browser)
 */
export const showAlert = (title: string, message: string) => {
    const config: AlertConfig = {
        type: 'alert',
        title,
        message,
        confirmText: 'OK',
    };

    if (activeListener) {
        activeListener(config);
    } else {
        queue.push(config);
    }
};

/**
 * Mostra un modale grafico di conferma con opzione Annulla/Conferma (sostituisce window.confirm del browser)
 */
export const showConfirmation = (
    title: string,
    message: string,
    onConfirm: () => void,
    confirmText: string = "Conferma",
    cancelText: string = "Annulla",
    onCancel?: () => void
) => {
    const lower = (title + ' ' + message + ' ' + confirmText).toLowerCase();
    const isDestructive =
        lower.includes('elimina') ||
        lower.includes('cancella') ||
        lower.includes('rimuov') ||
        lower.includes('reset') ||
        lower.includes('chiudi stagione');

    const config: AlertConfig = {
        type: 'confirmation',
        title,
        message,
        confirmText,
        cancelText,
        onConfirm,
        onCancel,
        destructive: isDestructive,
    };

    if (activeListener) {
        activeListener(config);
    } else {
        queue.push(config);
    }
};
