// services/firestore/settings.ts
// Impostazioni app: Christmas mode e schemi tattici

import { db } from '../../firebaseConfig';
import { collection, addDoc, deleteDoc, doc, setDoc, updateDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
import type { ChristmasSettings, TacticalScheme } from './types';

// --- Christmas Settings ---

export const subscribeToChristmasSettings = (callback: (settings: ChristmasSettings) => void) => {
    const docRef = doc(db, 'settings', 'christmas');
    return onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) callback(docSnap.data() as ChristmasSettings);
        else callback({ mode: 'auto' });
    });
};

export const updateChristmasSettings = async (settings: ChristmasSettings) => {
    try {
        const docRef = doc(db, 'settings', 'christmas');
        await setDoc(docRef, settings);
    } catch (error) {
        console.error("Error updating Christmas settings:", error);
        throw error;
    }
};

// --- Tactical Schemes ---

export const subscribeToTacticalSchemes = (callback: (schemes: TacticalScheme[]) => void) => {
    const q = query(collection(db, 'tactical_schemes'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
        const schemes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TacticalScheme));
        callback(schemes);
    });
};

export const saveTacticalScheme = async (scheme: Omit<TacticalScheme, 'id'>) => {
    try {
        const docRef = await addDoc(collection(db, 'tactical_schemes'), {
            ...scheme,
            createdAt: new Date().toISOString()
        });
        console.log("Tactical scheme saved successfully:", docRef.id);
        return docRef.id;
    } catch (error) {
        console.error("Error saving tactical scheme:", error);
        throw error;
    }
};

export const updateTacticalScheme = async (scheme: TacticalScheme) => {
    try {
        const schemeRef = doc(db, 'tactical_schemes', scheme.id);
        const { id, ...data } = scheme;
        await updateDoc(schemeRef, data);
        console.log("Tactical scheme updated successfully");
    } catch (error) {
        console.error("Error updating tactical scheme:", error);
        throw error;
    }
};

export const deleteTacticalScheme = async (id: string) => {
    try {
        await deleteDoc(doc(db, 'tactical_schemes', id));
        console.log("Tactical scheme deleted successfully");
    } catch (error) {
        console.error("Error deleting tactical scheme:", error);
        throw error;
    }
};
