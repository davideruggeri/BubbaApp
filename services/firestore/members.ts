// services/firestore/members.ts
// Gestione indirizzario (membri del team)

import { db } from '../../firebaseConfig';
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, updateDoc } from 'firebase/firestore';
import type { Member } from './types';

/**
 * Verifica se un membro era attivo a una specifica data (YYYY-MM-DD).
 * Tiene conto sia dei periodi di inattività strutturati che del campo legacy `inactiveSince`.
 */
export const isMemberActiveAtDate = (member: Partial<Member> | null | undefined, date: string): boolean => {
    if (!member) return false;

    // 1. Controlla la lista dei periodi di inattività se presente
    if (member.inactivityPeriods && member.inactivityPeriods.length > 0) {
        const isPaused = member.inactivityPeriods.some(period => {
            if (!period.startDate) return false;
            // Se la data richiesta è prima dell'inizio della pausa, non è in pausa per questo periodo
            if (date < period.startDate) return false;
            // Se c'è una data di fine e la data richiesta è successiva alla fine, la pausa è conclusa
            if (period.endDate && date > period.endDate) return false;
            // La data cade nel periodo [startDate, endDate || in corso]
            return true;
        });
        if (isPaused) return false;
    }

    // 2. Controllo legacy sul campo inactiveSince (se non gestito dai periodi)
    if (member.inactiveSince) {
        if (date >= member.inactiveSince) {
            return false;
        }
    }

    return true;
};

/**
 * Verifica se un membro è attualmente attivo (alla data odierna).
 */
export const isMemberCurrentlyActive = (member: Partial<Member> | null | undefined): boolean => {
    const today = new Date().toISOString().split('T')[0];
    return isMemberActiveAtDate(member, today);
};

export const subscribeToMembers = (callback: (members: Member[]) => void, includeInactive: boolean = false) => {
    const q = query(collection(db, 'indirizzario'));
    return onSnapshot(q, (snapshot) => {
        let members = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Member));

        if (!includeInactive) {
            members = members.filter(m => isMemberCurrentlyActive(m));
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

/**
 * Mette in pausa/inattività un membro con data inizio, data fine opzionale e motivo.
 * Mantiene tutto lo storico precedente e aggiorna inactiveSince per retrocompatibilità.
 */
export const pauseMember = async (
    member: Member,
    startDate?: string,
    endDate?: string | null,
    reason?: string
) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const effectiveStartDate = startDate || today;
        const currentPeriods = member.inactivityPeriods ? [...member.inactivityPeriods] : [];

        // Genera un ID univoco per il nuovo periodo
        const newPeriodId = `inact_${Date.now()}`;
        const newPeriod = {
            id: newPeriodId,
            startDate: effectiveStartDate,
            endDate: endDate || null,
            reason: reason || ''
        };

        const updatedPeriods = [...currentPeriods, newPeriod];
        
        // Se il periodo è in corso oggi (endDate non c'è oppure è >= oggi) e startDate <= oggi
        const isNowInactive = effectiveStartDate <= today && (!endDate || endDate >= today);

        const updatedMember: Member = {
            ...member,
            inactivityPeriods: updatedPeriods,
            inactiveSince: isNowInactive ? effectiveStartDate : null
        };

        await updateMember(updatedMember);
        return updatedMember;
    } catch (error) {
        console.error("Error pausing member:", error);
        throw error;
    }
};

/**
 * Riattiva un membro chiudendo l'ultimo periodo di inattività aperto e azzerando inactiveSince.
 * Mantiene intatti tutti i dati storici (presenze, badge, streak record, etc.).
 */
export const reactivateMember = async (member: Member, returnDate?: string) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const effectiveReturnDate = returnDate || today;

        let updatedPeriods = member.inactivityPeriods ? [...member.inactivityPeriods] : [];

        if (updatedPeriods.length > 0) {
            // Chiudi i periodi aperti (endDate nullo o endDate > returnDate)
            updatedPeriods = updatedPeriods.map(p => {
                if (!p.endDate || p.endDate > effectiveReturnDate) {
                    return { ...p, endDate: effectiveReturnDate };
                }
                return p;
            });
        } else if (member.inactiveSince) {
            // Se aveva solo il vecchio inactiveSince, convertiamo in periodo concluso
            updatedPeriods = [{
                id: `inact_${Date.now()}`,
                startDate: member.inactiveSince,
                endDate: effectiveReturnDate,
                reason: 'Inattività passata'
            }];
        }

        const updatedMember: Member = {
            ...member,
            inactiveSince: null,
            inactivityPeriods: updatedPeriods
        };

        await updateMember(updatedMember);
        return updatedMember;
    } catch (error) {
        console.error("Error reactivating member:", error);
        throw error;
    }
};

