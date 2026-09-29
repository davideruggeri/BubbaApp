// services/firestore/world.ts
// Gestione mappa mondiale (world_locations)

import { db } from '../../firebaseConfig';
import { collection, addDoc, deleteDoc, doc, updateDoc, onSnapshot, query } from 'firebase/firestore';
import type { WorldLocation } from './types';

export const subscribeToWorldLocations = (callback: (locations: WorldLocation[]) => void) => {
    const q = query(collection(db, 'world_locations'));
    return onSnapshot(q, (snapshot) => {
        const locations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorldLocation));
        callback(locations);
    });
};

export const addWorldLocation = async (location: Omit<WorldLocation, 'id'>) => {
    try {
        await addDoc(collection(db, 'world_locations'), location);
    } catch (error) {
        console.error("Error adding world location:", error);
        throw error;
    }
};

export const updateWorldLocation = async (location: WorldLocation) => {
    try {
        const locationRef = doc(db, 'world_locations', location.id);
        const { id, ...data } = location;
        await updateDoc(locationRef, data);
    } catch (error) {
        console.error("Error updating world location:", error);
        throw error;
    }
};

export const deleteWorldLocation = async (id: string) => {
    try {
        await deleteDoc(doc(db, 'world_locations', id));
    } catch (error) {
        console.error("Error deleting world location:", error);
        throw error;
    }
};
