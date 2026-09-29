// services/firestore/utils.ts
// Funzioni pure di utilità (no Firestore calls)

export { deleteField } from 'firebase/firestore';
import type { RankedItem } from './types';

let cachedStagioneCorrente: string = '';

export const setCachedStagioneCorrente = (season: string) => {
    cachedStagioneCorrente = season;
};

export const getCachedStagioneCorrente = (): string => {
    if (cachedStagioneCorrente) return cachedStagioneCorrente;
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    return m >= 9 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
};

export const getStagioneFromDate = (dateStr: string): string => {
    if (!dateStr) return getCachedStagioneCorrente();
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length >= 2) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        if (!isNaN(year) && !isNaN(month)) {
            return month >= 9 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
        }
    }
    return getCachedStagioneCorrente();
};

export const getSeasonStartDate = (season: string): Date => {
    const parts = season.split('-');
    if (parts.length >= 1) {
        const startYear = parseInt(parts[0], 10);
        if (!isNaN(startYear)) {
            return new Date(startYear, 8, 1, 0, 0, 0, 0); // 1 Settembre ore 00:00:00
        }
    }
    const y = new Date().getFullYear();
    return new Date(y, 8, 1, 0, 0, 0, 0);
};

export const getSeasonEndDate = (season: string): Date => {
    const parts = season.split('-');
    if (parts.length >= 2) {
        const endYear = parseInt(parts[1], 10);
        if (!isNaN(endYear)) {
            return new Date(endYear, 7, 31, 23, 59, 59, 999); // 31 Agosto ore 23:59:59
        }
    }
    const y = new Date().getFullYear();
    return new Date(y, 7, 31, 23, 59, 59, 999);
};

export function assignTiedRanks<T>(
    items: T[],
    getValue: (item: T) => number
): RankedItem<T>[] {
    let currentRank = 1;
    return items.map((item, index) => {
        const val = getValue(item);
        if (index > 0) {
            const prevVal = getValue(items[index - 1]);
            if (val < prevVal) {
                currentRank = index + 1; // standard competition ranking: 1, 1, 3
            }
        }
        let badge: string | undefined = undefined;
        if (currentRank === 1) badge = '🥇';
        else if (currentRank === 2) badge = '🥈';
        else if (currentRank === 3) badge = '🥉';

        return {
            ...item,
            rank: currentRank,
            badge
        };
    });
}
