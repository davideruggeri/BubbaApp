import { Event } from '../../services/firestore';

export const getTypeColor = (type: string, theme: any): string => {
    switch (type) {
        case 'training':
        case 'Campo':
        case 'Palestra':
            return theme.colors.training;
        case 'match':
            return theme.colors.match;
        case 'championship':
            return theme.colors.championship;
        case 'tournament':
            return theme.colors.tournament;
        case 'social':
            return theme.colors.social;
        case 'other':
            return theme.colors.other;
        case 'birthday':
            return theme.colors.birthday;
        default:
            return theme.colors.textSecondary;
    }
};

export const translateType = (type: string, subType?: string): string => {
    switch (type) {
        case 'training':
        case 'Campo':
        case 'Palestra':
            return 'ALLENAMENTO';
        case 'match':
            return 'AMICHEVOLE';
        case 'championship':
            return 'CAMPIONATO';
        case 'tournament':
            return 'TORNEO';
        case 'social':
            return 'RIUNIONE DI SQUADRA';
        case 'other':
            if (subType) {
                return `ALTRO (${subType.toUpperCase()})`;
            }
            return 'ALTRO';
        case 'birthday':
            return 'COMPLEANNO';
        default:
            return type.toUpperCase();
    }
};

export const getMonthName = (dateString: string): string => {
    try {
        const date = new Date(dateString);
        return date.toLocaleString('it-IT', { month: 'short' }).toUpperCase();
    } catch {
        return '';
    }
};

export const formatDate = (dateString: string): string => {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
};

export const toLocalISOString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const isEventOnDate = (event: Event, dateStr: string): boolean => {
    if (event.date === dateStr) return true;
    if (event.endDate) {
        return dateStr >= event.date && dateStr <= event.endDate;
    }
    return false;
};

export const getDaysInMonth = (date: Date): (Date | null)[] => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay(); // 0=Sun, 1=Mon

    // Adjust for Monday start (0=Mon, 6=Sun)
    const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;

    const daysArray: (Date | null)[] = [];
    // Add empty slots for previous month
    for (let i = 0; i < adjustedFirstDay; i++) {
        daysArray.push(null);
    }
    // Add days of current month
    for (let i = 1; i <= days; i++) {
        daysArray.push(new Date(year, month, i));
    }
    return daysArray;
};
