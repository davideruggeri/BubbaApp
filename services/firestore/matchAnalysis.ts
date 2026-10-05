// services/firestore/matchAnalysis.ts
// Gestione analisi partite e impostazioni statistiche

import { db } from '../../firebaseConfig';
import { collection, addDoc, deleteDoc, doc, setDoc, updateDoc, onSnapshot, query, getDocs, getDoc } from 'firebase/firestore';
import type { MatchAnalysis, MatchStatsSettings, StatDefinition } from './types';
import { getCachedStagioneCorrente, getStagioneFromDate } from './utils';

export const DEFAULT_STATS_SETTINGS: MatchStatsSettings = {
    offense: [
        { code: 'M', label: 'Meta', color: '#4CAF50', effect: 'score_us', description: 'Segna un punto per noi', requiresPlayer: true },
        { code: 'A', label: 'Assist', color: '#8BC34A', effect: 'none', description: 'Ultimo passaggio prima della meta', requiresPlayer: true },
        { code: 'T', label: 'Throwaway', color: '#FF9800', effect: 'turnover', description: 'Errore, cambio possesso', requiresPlayer: true },
    ],
    defense: [
        { code: 'D', label: 'Difesa', color: '#2196F3', effect: 'switch_possession', description: 'Difesa, cambio possesso', requiresPlayer: true },
        { code: 'C', label: 'Callahan', color: '#9C27B0', effect: 'score_us', description: 'Intercetto in meta avversaria', requiresPlayer: true },
        { code: 'E', label: 'Lato Aperto', color: '#F44336', effect: 'score_them', description: 'Meta subita lato aperto', requiresPlayer: false },
        { code: 'B', label: 'Buco/Break', color: '#D32F2F', effect: 'score_them', description: 'Meta subita lato chiuso', requiresPlayer: false },
        { code: 'S', label: 'Meta Subita', color: '#B71C1C', effect: 'score_them', description: 'Meta subita generica', requiresPlayer: false },
    ]
};

export const getMatchStatsSettings = async (): Promise<MatchStatsSettings> => {
    try {
        const docRef = doc(db, 'settings', 'match_stats');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data() as MatchStatsSettings;
        } else {
            await setDoc(docRef, DEFAULT_STATS_SETTINGS);
            return DEFAULT_STATS_SETTINGS;
        }
    } catch (error) {
        console.error("Error fetching stats settings:", error);
        return DEFAULT_STATS_SETTINGS;
    }
};

export const updateMatchStatsSettings = async (settings: MatchStatsSettings) => {
    try {
        const docRef = doc(db, 'settings', 'match_stats');
        await setDoc(docRef, settings);
    } catch (error) {
        console.error("Error updating stats settings:", error);
        throw error;
    }
};

export const subscribeToMatchAnalysis = (callback: (matches: MatchAnalysis[]) => void, season?: string) => {
    const q = query(collection(db, 'match_analysis'));
    return onSnapshot(q, (snapshot) => {
        let matches = snapshot.docs.map(doc => {
            const data = doc.data();
            const date = data.date || '';
            const docSeason = data.stagione || getStagioneFromDate(date);
            return { id: doc.id, ...data, stagione: docSeason } as MatchAnalysis;
        });
        if (season) {
            matches = matches.filter(m => m.stagione === season);
        }
        matches.sort((a, b) => b.date.localeCompare(a.date));
        callback(matches);
    });
};

export const subscribeToSingleMatch = (matchId: string, callback: (match: MatchAnalysis) => void) => {
    const docRef = doc(db, 'match_analysis', matchId);
    return onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            callback({ id: docSnap.id, ...docSnap.data() } as MatchAnalysis);
        }
    });
};

function sanitizeForFirestore(obj: any): any {
    if (obj === undefined) return null;
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeForFirestore(item));
    }
    const clean: any = {};
    for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
            clean[key] = sanitizeForFirestore(value);
        }
    }
    return clean;
}

export const addMatchAnalysis = async (match: Omit<MatchAnalysis, 'id'>) => {
    try {
        const stagione = (match as any).stagione || getCachedStagioneCorrente() || (match.date ? getStagioneFromDate(match.date) : getCachedStagioneCorrente());
        const cleanData = sanitizeForFirestore({ ...match, stagione });
        const docRef = await addDoc(collection(db, 'match_analysis'), cleanData);
        return docRef.id;
    } catch (error) {
        console.error("Error adding match analysis:", error);
        throw error;
    }
};

export const updateMatchAnalysis = async (match: Partial<MatchAnalysis> & { id: string }) => {
    try {
        const matchRef = doc(db, 'match_analysis', match.id);
        const { id, ...data } = match;
        const cleanData = sanitizeForFirestore(data);
        await updateDoc(matchRef, cleanData);
    } catch (error) {
        console.error("Error updating match analysis:", error);
        throw error;
    }
};

export const deleteMatchAnalysis = async (id: string) => {
    try {
        await deleteDoc(doc(db, 'match_analysis', id));
    } catch (error) {
        console.error("Error deleting match analysis:", error);
        throw error;
    }
};
