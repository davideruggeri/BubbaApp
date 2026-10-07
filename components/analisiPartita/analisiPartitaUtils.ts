import { Event } from '../../services/firestore';

export const getEventDays = (ev?: Event | null): string[] => {
    if (!ev || !ev.date) return [];
    const startStr = ev.date;
    const endStr = ev.endDate || ev.date;
    if (startStr === endStr) return [startStr];

    const days: string[] = [];
    const current = new Date(startStr + 'T12:00:00');
    const end = new Date(endStr + 'T12:00:00');
    let count = 0;
    while (current <= end && count < 14) {
        const y = current.getFullYear();
        const m = String(current.getMonth() + 1).padStart(2, '0');
        const d = String(current.getDate()).padStart(2, '0');
        days.push(`${y}-${m}-${d}`);
        current.setDate(current.getDate() + 1);
        count++;
    }
    return days.length > 0 ? days : [startStr];
};

export const formatTournamentDay = (dateStr: string): string => {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr + 'T12:00:00');
        return d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
    } catch {
        return dateStr;
    }
};

export const formatDate = (dateString: string): string => {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
};
