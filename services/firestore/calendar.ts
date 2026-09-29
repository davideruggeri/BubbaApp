// services/firestore/calendar.ts
// Gestione eventi del calendario (collezione 'calendario')

import { db } from '../../firebaseConfig';
import { collection, addDoc, deleteDoc, doc, setDoc, updateDoc, onSnapshot, query, writeBatch, getDocs } from 'firebase/firestore';
import type { Event } from './types';
import { getCachedStagioneCorrente, getStagioneFromDate } from './utils';

export const subscribeToEvents = (callback: (events: Event[]) => void, season?: string) => {
    const q = query(collection(db, 'calendario'));
    return onSnapshot(q, (snapshot) => {
        let events = snapshot.docs.map(doc => {
            const data = doc.data();
            const date = data.date || doc.id;
            const docSeason = data.stagione || getStagioneFromDate(date);
            return {
                id: doc.id,
                ...data,
                stagione: docSeason,
                title: data.title || (data.type === 'Campo' || data.type === 'Palestra' ? 'Allenamento' : 'Evento'),
                date: date,
                endDate: data.endDate,
                type: data.type || 'other'
            } as Event;
        });
        if (season) {
            events = events.filter(e => (e as any).stagione === season);
        }
        events.sort((a, b) => a.date.localeCompare(b.date));
        callback(events);
    });
};

export const addEvent = async (event: Omit<Event, 'id'>) => {
    try {
        const stagione = (event as any).stagione || getCachedStagioneCorrente() || getStagioneFromDate(event.date);
        const eventWithSeason = { ...event, stagione };
        const sanitizedEvent = Object.fromEntries(
            Object.entries(eventWithSeason).filter(([_, v]) => v !== undefined)
        );

        if ((event.type === 'training' || event.type === 'Campo' || event.type === 'Palestra') && (!event.endDate || event.date === event.endDate)) {
            await setDoc(doc(db, 'calendario', event.date), sanitizedEvent, { merge: true });
        } else {
            await addDoc(collection(db, 'calendario'), sanitizedEvent);
        }
    } catch (error) {
        console.error("Error adding event:", error);
        throw error;
    }
};

export const updateEvent = async (event: Event) => {
    try {
        const eventRef = doc(db, 'calendario', event.id);
        const { id, ...data } = event;
        if (!data.stagione && data.date) {
            data.stagione = getStagioneFromDate(data.date);
        }
        const sanitizedData = Object.fromEntries(
            Object.entries(data).filter(([_, v]) => v !== undefined)
        );
        await updateDoc(eventRef, sanitizedData);
    } catch (error) {
        console.error("Error updating event:", error);
        throw error;
    }
};

export const deleteEvent = async (eventId: string) => {
    try {
        await deleteDoc(doc(db, 'calendario', eventId));
    } catch (error) {
        console.error("Error deleting event:", error);
        throw error;
    }
};

export const generateRecurringEvents = async () => {
    const startDate = new Date('2025-08-25');
    const endDate = new Date('2026-09-30');
    let currentDate = new Date(startDate);

    const MAX_BATCH_SIZE = 500;
    let currentBatch = writeBatch(db);
    let batchCount = 0;

    while (currentDate <= endDate) {
        const day = currentDate.getDay(); // 0=Sun, 1=Mon, 3=Wed
        if (day === 1 || day === 3) { // Monday or Wednesday
            const year = currentDate.getFullYear();
            const month = String(currentDate.getMonth() + 1).padStart(2, '0');
            const d = String(currentDate.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${d}`;

            const specificRef = doc(db, 'calendario', dateStr);
            currentBatch.set(specificRef, {
                title: 'Allenamento',
                date: dateStr,
                type: 'training'
            }, { merge: true });

            batchCount++;
            if (batchCount >= MAX_BATCH_SIZE) {
                await currentBatch.commit();
                currentBatch = writeBatch(db);
                batchCount = 0;
            }
        }
        currentDate.setDate(currentDate.getDate() + 1);
    }

    if (batchCount > 0) {
        await currentBatch.commit();
    }
    console.log("Recurring events generated in 'calendario'.");
};

export interface RecurringDayConfig {
    dayOfWeek: number; // 0=Dom, 1=Lun, 2=Mar, 3=Mer, 4=Gio, 5=Ven, 6=Sab
    type: 'Campo' | 'Palestra';
    time?: string;
    location?: string;
}

export interface GenerateSeasonTrainingsOptions {
    startDate: string; // YYYY-MM-DD
    endDate: string;   // YYYY-MM-DD
    daysConfig: RecurringDayConfig[];
    overwriteExisting?: boolean;
}

export const generateSeasonTrainings = async (
    options: GenerateSeasonTrainingsOptions
): Promise<{ totalCreated: number; totalSkipped: number }> => {
    const { startDate, endDate, daysConfig, overwriteExisting = true } = options;
    if (!daysConfig || daysConfig.length === 0) {
        return { totalCreated: 0, totalSkipped: 0 };
    }

    const configMap = new Map<number, RecurringDayConfig>();
    daysConfig.forEach(c => configMap.set(c.dayOfWeek, c));

    let existingDocIds = new Set<string>();
    if (!overwriteExisting) {
        const snap = await getDocs(collection(db, 'calendario'));
        snap.forEach(d => existingDocIds.add(d.id));
    }

    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T23:59:59');
    let current = new Date(start);

    const MAX_BATCH_SIZE = 450;
    let currentBatch = writeBatch(db);
    let batchCount = 0;
    let totalCreated = 0;
    let totalSkipped = 0;

    while (current <= end) {
        const dayOfWeek = current.getDay();
        if (configMap.has(dayOfWeek)) {
            const config = configMap.get(dayOfWeek)!;
            const year = current.getFullYear();
            const month = String(current.getMonth() + 1).padStart(2, '0');
            const day = String(current.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;

            if (!overwriteExisting && existingDocIds.has(dateStr)) {
                totalSkipped++;
            } else {
                const docRef = doc(db, 'calendario', dateStr);
                const stagione = getCachedStagioneCorrente() || getStagioneFromDate(dateStr);
                const eventData: any = {
                    title: 'Allenamento',
                    date: dateStr,
                    type: config.type,
                    stagione: stagione,
                };
                if (config.time && config.time.trim()) {
                    eventData.time = config.time.trim();
                }
                if (config.location && config.location.trim()) {
                    eventData.location = config.location.trim();
                }

                currentBatch.set(docRef, eventData, { merge: true });
                batchCount++;
                totalCreated++;

                if (batchCount >= MAX_BATCH_SIZE) {
                    await currentBatch.commit();
                    currentBatch = writeBatch(db);
                    batchCount = 0;
                }
            }
        }
        current.setDate(current.getDate() + 1);
    }

    if (batchCount > 0) {
        await currentBatch.commit();
    }

    return { totalCreated, totalSkipped };
};

