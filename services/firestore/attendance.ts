// services/firestore/attendance.ts
// Gestione presenze, sessioni di allenamento, statistiche e streak

import { db } from '../../firebaseConfig';
import {
    collection, doc, getDoc, setDoc, updateDoc,
    onSnapshot, query, where, getDocs,
    arrayUnion, arrayRemove, increment, writeBatch
} from 'firebase/firestore';
import type { Session, MemberStreaks, TrainingStats } from './types';
import { getCachedStagioneCorrente, getStagioneFromDate, getSeasonStartDate } from './utils';

// --- Sessioni ---

export const getOrCreateSession = async (date: string, defaultType: 'Campo' | 'Palestra'): Promise<Session> => {
    const sessionRef = doc(db, 'calendario', date);
    const sessionSnap = await getDoc(sessionRef);

    if (sessionSnap.exists()) {
        const data = sessionSnap.data();
        const type = (data.type === 'training' || !data.type) ? defaultType : data.type;
        return { id: sessionSnap.id, ...data, type } as Session;
    }

    const newSession: Session = { id: date, date, type: defaultType };
    await setDoc(sessionRef, newSession, { merge: true });
    return newSession;
};

export const addGuestToSession = async (sessionId: string, guestName: string) => {
    const sessionRef = doc(db, 'calendario', sessionId);
    await updateDoc(sessionRef, { guests: arrayUnion(guestName) });
};

export const updateSessionType = async (sessionId: string, newType: 'Campo' | 'Palestra') => {
    const sessionRef = doc(db, 'calendario', sessionId);
    await updateDoc(sessionRef, { type: newType });
};

export const removeGuestFromSession = async (sessionId: string, guestName: string) => {
    const sessionRef = doc(db, 'calendario', sessionId);
    await updateDoc(sessionRef, { guests: arrayRemove(guestName) });
};

export const subscribeToSession = (date: string, callback: (session: Session | null) => void) => {
    const sessionRef = doc(db, 'calendario', date);
    return onSnapshot(sessionRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            let sessionType = data.type;
            if (sessionType === 'training' || !sessionType) {
                sessionType = 'Campo';
            }
            callback({ id: docSnap.id, ...data, type: sessionType } as Session);
        } else {
            callback(null);
        }
    });
};

// --- Presenze ---

export const subscribeToPresenze = (date: string, callback: (attendeeIds: string[]) => void) => {
    const q = query(collection(db, 'presenze'), where('date', '==', date));
    return onSnapshot(q, (snapshot) => {
        const attendeeIds = snapshot.docs.map(doc => doc.data().memberId);
        callback(attendeeIds);
    });
};

/**
 * Sottoscrive i conteggi presenze per-membro filtrati per stagione e tipo.
 * Usa `validDates` come fonte di verità per evitare dipendenze dal campo stagione sui record presenze.
 */
export const subscribeToSeasonPresenzeCounts = (
    stagione: string,
    type: 'Campo' | 'Palestra',
    validDates: Set<string>,
    callback: (counts: Record<string, number>) => void
): (() => void) => {
    if (validDates.size === 0) {
        callback({});
        return () => {};
    }

    const seasonStart = getSeasonStartDate(stagione).toISOString().split('T')[0];
    const seasonEndDate = new Date(getSeasonStartDate(stagione));
    seasonEndDate.setFullYear(seasonEndDate.getFullYear() + 1);
    seasonEndDate.setMonth(7); // agosto
    seasonEndDate.setDate(31);
    const seasonEnd = seasonEndDate.toISOString().split('T')[0];

    const q = query(
        collection(db, 'presenze'),
        where('date', '>=', seasonStart),
        where('date', '<=', seasonEnd)
    );

    return onSnapshot(q, (snapshot) => {
        const counts: Record<string, number> = {};
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            if (validDates.has(data.date)) {
                const mId = data.memberId;
                if (mId) counts[mId] = (counts[mId] || 0) + 1;
            }
        });
        callback(counts);
    }, () => callback({}));
};

export const markPresent = async (date: string, memberId: string, type: 'Campo' | 'Palestra' = 'Campo', season?: string) => {
    const batch = writeBatch(db);

    const presenceRef = doc(db, 'presenze', `${date}_${memberId}`);
    const stagione = season || getCachedStagioneCorrente() || getStagioneFromDate(date);
    batch.set(presenceRef, { date, memberId, stagione, type }, { merge: true });

    const memberRef = doc(db, 'indirizzario', memberId);
    if (type === 'Palestra') {
        batch.update(memberRef, { attendanceCountGym: increment(1) });
    } else {
        batch.update(memberRef, { attendanceCount: increment(1) });
    }

    await batch.commit();
};

export const markAbsent = async (date: string, memberId: string, type: 'Campo' | 'Palestra' = 'Campo') => {
    const batch = writeBatch(db);

    const presenceRef = doc(db, 'presenze', `${date}_${memberId}`);
    batch.delete(presenceRef);

    const memberRef = doc(db, 'indirizzario', memberId);
    if (type === 'Palestra') {
        batch.update(memberRef, { attendanceCountGym: increment(-1) });
    } else {
        batch.update(memberRef, { attendanceCount: increment(-1) });
    }

    await batch.commit();
};

export const getMemberAttendance = async (memberId: string): Promise<string[]> => {
    const q = query(collection(db, 'presenze'), where('memberId', '==', memberId));
    const snapshot = await getDocs(q);
    const dates = snapshot.docs.map(doc => doc.data().date as string);
    return dates.sort((a, b) => b.localeCompare(a));
};

// --- Statistiche ---

export const getTrainingStats = async (startDate: string = '2025-08-25', type: 'Campo' | 'Palestra' = 'Campo', season?: string): Promise<TrainingStats> => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const targetSeason = season || getCachedStagioneCorrente();

        const calendarSnapshot = await getDocs(collection(db, 'calendario'));
        let totalTrainings = 0;
        const validTrainingDates = new Set<string>();
        const attendancePerDate: Record<string, number> = {};
        let totalAttendance = 0;

        calendarSnapshot.docs.forEach(doc => {
            const data = doc.data();
            const date = data.date || doc.id;
            const eventType = data.type || 'training';
            const docSeason = data.stagione || getStagioneFromDate(date);

            let isMatchingType = false;
            if (type === 'Campo') {
                isMatchingType = eventType === 'Campo' || eventType === 'training';
            } else {
                isMatchingType = eventType === 'Palestra';
            }

            const matchesSeason = !targetSeason || docSeason === targetSeason;

            if (isMatchingType && matchesSeason && (!startDate || date >= startDate) && date < today) {
                totalTrainings++;
                validTrainingDates.add(date);
                const guestCount = data.guests ? data.guests.length : 0;
                attendancePerDate[date] = guestCount;
                totalAttendance += guestCount;
            }
        });

        const presenzeSnapshot = await getDocs(collection(db, 'presenze'));
        presenzeSnapshot.docs.forEach(doc => {
            const data = doc.data();
            const docSeason = data.stagione || getStagioneFromDate(data.date);
            const matchesSeason = !targetSeason || docSeason === targetSeason;
            if (matchesSeason && validTrainingDates.has(data.date)) {
                attendancePerDate[data.date] = (attendancePerDate[data.date] || 0) + 1;
                totalAttendance++;
            }
        });

        let recordDate = '';
        let maxCount = 0;
        for (const [date, count] of Object.entries(attendancePerDate)) {
            if (count > maxCount) { maxCount = count; recordDate = date; }
        }

        const averageAttendance = totalTrainings > 0 ? totalAttendance / totalTrainings : 0;

        return {
            averageAttendance: parseFloat(averageAttendance.toFixed(1)),
            totalTrainings,
            recordAttendance: recordDate ? { date: recordDate, count: maxCount } : null
        };
    } catch (error) {
        console.error("Error calculating training stats:", error);
        return { averageAttendance: 0, totalTrainings: 0, recordAttendance: null };
    }
};

export const calculateMemberStreaks = async (memberId: string, season?: string): Promise<MemberStreaks> => {
    const isAllSeasons = !season || season === 'all';
    const targetSeason = isAllSeasons ? null : season;
    const today = new Date().toISOString().split('T')[0];

    const calSnap = await getDocs(collection(db, 'calendario'));
    const trainings: { date: string; type: 'Campo' | 'Palestra' }[] = [];

    calSnap.docs.forEach(d => {
        const data = d.data();
        const date = (data.date || d.id).split('T')[0];
        const docSeason = data.stagione || getStagioneFromDate(date);

        if ((!targetSeason || docSeason === targetSeason) && date <= today) {
            const eventType = data.type || 'training';
            if (eventType === 'Campo' || eventType === 'Palestra' || eventType === 'training' || !data.type) {
                trainings.push({ date, type: eventType === 'Palestra' ? 'Palestra' : 'Campo' });
            }
        }
    });

    trainings.sort((a, b) => a.date.localeCompare(b.date));

    const presSnap = await getDocs(query(collection(db, 'presenze'), where('memberId', '==', memberId)));
    const attendedDates = new Set<string>();
    presSnap.docs.forEach(d => {
        const data = d.data();
        const docSeason = data.stagione || getStagioneFromDate(data.date);
        if (!targetSeason || docSeason === targetSeason) {
            attendedDates.add(data.date);
        }
    });

    let tempStreak = 0, streakMassima = 0;
    let tempCampo = 0, streakCampo = 0;
    let tempPalestra = 0, streakPalestra = 0;

    for (const t of trainings) {
        if (attendedDates.has(t.date)) {
            tempStreak++;
            if (tempStreak > streakMassima) streakMassima = tempStreak;
            if (t.type === 'Campo') {
                tempCampo++;
                if (tempCampo > streakCampo) streakCampo = tempCampo;
            } else {
                tempPalestra++;
                if (tempPalestra > streakPalestra) streakPalestra = tempPalestra;
            }
        } else {
            tempStreak = 0;
            if (t.type === 'Campo') tempCampo = 0;
            else tempPalestra = 0;
        }
    }

    let currentStreak = 0;
    const revTrainings = [...trainings].reverse();
    for (const t of revTrainings) {
        if (attendedDates.has(t.date)) currentStreak++;
        else break;
    }

    // Controlla anche lo storico archiviato in presenze_history per includere record di stagioni passate
    try {
        const historySnap = await getDocs(collection(db, 'presenze_history'));
        historySnap.docs.forEach(hDoc => {
            const hData = hDoc.data();
            const memberStats = hData.perMembro?.[memberId];
            if (memberStats) {
                if (memberStats.streakMassima && memberStats.streakMassima > streakMassima) {
                    streakMassima = memberStats.streakMassima;
                }
                if (memberStats.streakCampo && memberStats.streakCampo > streakCampo) {
                    streakCampo = memberStats.streakCampo;
                }
                if (memberStats.streakPalestra && memberStats.streakPalestra > streakPalestra) {
                    streakPalestra = memberStats.streakPalestra;
                }
            }
        });
    } catch (e) {
        console.warn("Errore lettura presenze_history in calculateMemberStreaks:", e);
    }

    // Controlla anche il record salvato direttamente sul membro in indirizzario
    try {
        const memberDoc = await getDoc(doc(db, 'indirizzario', memberId));
        if (memberDoc.exists()) {
            const mData = memberDoc.data();
            if (mData.streakMassima && mData.streakMassima > streakMassima) {
                streakMassima = mData.streakMassima;
            }
            if (mData.streakCampo && mData.streakCampo > streakCampo) {
                streakCampo = mData.streakCampo;
            }
            if (mData.streakPalestra && mData.streakPalestra > streakPalestra) {
                streakPalestra = mData.streakPalestra;
            }
        }
    } catch (e) {
        console.warn("Errore lettura indirizzario per streak record:", e);
    }

    return { currentStreak, streakMassima, streakCampo, streakPalestra };
};

export const recalculateAllAttendanceCounts = async (season?: string) => {
    try {
        console.log("Starting attendance recalculation...");
        const targetSeason = season || getCachedStagioneCorrente();
        const today = new Date().toISOString().split('T')[0];

        const calendarSnap = await getDocs(collection(db, 'calendario'));
        const dateTypeMap: Record<string, 'Campo' | 'Palestra'> = {};
        const trainingsList: { date: string; type: 'Campo' | 'Palestra' }[] = [];

        calendarSnap.docs.forEach(doc => {
            const data = doc.data();
            const rawDate = data.date || doc.id;
            const date = rawDate.split('T')[0];
            const docSeason = data.stagione || getStagioneFromDate(date);
            if (!targetSeason || docSeason === targetSeason) {
                const eventType = data.type || 'training';
                if (eventType === 'Palestra') {
                    dateTypeMap[date] = 'Palestra';
                    if (date <= today) trainingsList.push({ date, type: 'Palestra' });
                } else if (eventType === 'Campo' || eventType === 'training' || !data.type) {
                    dateTypeMap[date] = 'Campo';
                    if (date <= today) trainingsList.push({ date, type: 'Campo' });
                }
            }
        });

        trainingsList.sort((a, b) => a.date.localeCompare(b.date));

        const presenzeSnap = await getDocs(collection(db, 'presenze'));
        const counts: Record<string, { campo: number, palestra: number }> = {};
        const memberAttendedDates: Record<string, Set<string>> = {};

        presenzeSnap.docs.forEach(doc => {
            const data = doc.data();
            const date = data.date;
            const memberId = data.memberId;
            const docSeason = data.stagione || getStagioneFromDate(date);

            if (!targetSeason || docSeason === targetSeason) {
                if (!counts[memberId]) counts[memberId] = { campo: 0, palestra: 0 };
                if (!memberAttendedDates[memberId]) memberAttendedDates[memberId] = new Set();
                memberAttendedDates[memberId].add(date);
                const type = dateTypeMap[date] || 'Campo';
                if (type === 'Palestra') counts[memberId].palestra++;
                else counts[memberId].campo++;
            }
        });

        const membersSnap = await getDocs(collection(db, 'indirizzario'));
        const batchSize = 400;
        let batch = writeBatch(db);
        let opCount = 0;

        for (const docSnap of membersSnap.docs) {
            const memberId = docSnap.id;
            const memberCounts = counts[memberId] || { campo: 0, palestra: 0 };
            const attended = memberAttendedDates[memberId] || new Set<string>();

            let tempStreak = 0, streakMassima = 0;
            let tempCampo = 0, streakCampo = 0;
            let tempPalestra = 0, streakPalestra = 0;

            for (const t of trainingsList) {
                if (attended.has(t.date)) {
                    tempStreak++;
                    if (tempStreak > streakMassima) streakMassima = tempStreak;
                    if (t.type === 'Campo') {
                        tempCampo++;
                        if (tempCampo > streakCampo) streakCampo = tempCampo;
                    } else {
                        tempPalestra++;
                        if (tempPalestra > streakPalestra) streakPalestra = tempPalestra;
                    }
                } else {
                    tempStreak = 0;
                    if (t.type === 'Campo') tempCampo = 0;
                    else tempPalestra = 0;
                }
            }

            let currentStreak = 0;
            const revTrainings = [...trainingsList].reverse();
            for (const t of revTrainings) {
                if (attended.has(t.date)) currentStreak++;
                else break;
            }

            const existingData = docSnap.data();
            const prevStreakMassima = existingData?.streakMassima || 0;
            const prevStreakCampo = existingData?.streakCampo || 0;
            const prevStreakPalestra = existingData?.streakPalestra || 0;

            const finalStreakMassima = Math.max(streakMassima, prevStreakMassima);
            const finalStreakCampo = Math.max(streakCampo, prevStreakCampo);
            const finalStreakPalestra = Math.max(streakPalestra, prevStreakPalestra);

            batch.update(docSnap.ref, {
                attendanceCount: memberCounts.campo,
                attendanceCountGym: memberCounts.palestra,
                currentStreak,
                streakMassima: finalStreakMassima,
                streakCampo: finalStreakCampo,
                streakPalestra: finalStreakPalestra
            });

            opCount++;
            if (opCount >= batchSize) {
                await batch.commit();
                batch = writeBatch(db);
                opCount = 0;
            }
        }

        if (opCount > 0) await batch.commit();

        console.log(`Attendance recalculation and streak update complete for season: ${targetSeason}`);
    } catch (error) {
        console.error("Error recalculating attendance and streaks:", error);
        throw error;
    }
};
