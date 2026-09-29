// services/firestore/members.ts
// Gestione indirizzario (membri del team)

import { db } from '../../firebaseConfig';
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, updateDoc } from 'firebase/firestore';
import type { Member } from './types';

export const subscribeToMembers = (callback: (members: Member[]) => void, includeInactive: boolean = false) => {
    const q = query(collection(db, 'indirizzario'));
    return onSnapshot(q, (snapshot) => {
        let members = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Member));

        if (!includeInactive) {
            members = members.filter(m => !m.inactiveSince);
        }

        // Client-side sort: Nickname (or FirstName) -> LastName
        members.sort((a, b) => {
            const nameA = (a.nickname || a.firstName).toLowerCase();
            const nameB = (b.nickname || b.firstName).toLowerCase();

            if (nameA < nameB) return -1;
            if (nameA > nameB) return 1;

            // Tie-breaker: Last Name
            const lastA = (a.lastName || '').toLowerCase();
            const lastB = (b.lastName || '').toLowerCase();
            return lastA.localeCompare(lastB);
        });

        callback(members);
    });
};

export const addMember = async (firstName: string, lastName?: string, nickname?: string, birthDate?: string, gender?: 'M' | 'F', jerseyNumber?: string) => {
    try {
        await addDoc(collection(db, 'indirizzario'), {
            firstName,
            lastName: lastName || '',
            nickname: nickname || '',
            birthDate: birthDate || '',
            gender: gender || 'M',
            attendanceCount: 0,
            attendanceCountGym: 0,
            inactiveSince: null,
            jerseyNumber: jerseyNumber || ''
        });
        console.log("Member added successfully to indirizzario");
    } catch (error) {
        console.error("Error adding member:", error);
        throw error;
    }
};

export const deleteMember = async (id: string) => {
    try {
        await deleteDoc(doc(db, 'indirizzario', id));
        console.log("Member deleted successfully");
    } catch (error) {
        console.error("Error deleting member:", error);
        throw error;
    }
};

export const updateMember = async (member: Member) => {
    try {
        const memberRef = doc(db, 'indirizzario', member.id);
        const { id, ...data } = member;
        await updateDoc(memberRef, data);
        console.log("Member updated successfully");
    } catch (error) {
        console.error("Error updating member:", error);
        throw error;
    }
};
