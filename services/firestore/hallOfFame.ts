// services/firestore/hallOfFame.ts
// Gestione albo d'oro, roster tornei e member tournaments

import { db } from '../../firebaseConfig';
import {
    collection, addDoc, deleteDoc, doc, getDoc, setDoc, updateDoc,
    onSnapshot, query, where, getDocs, writeBatch
} from 'firebase/firestore';
import type { HallOfFameEntry, RosterMember, MemberTournament, Event } from './types';
import { getStagioneFromDate } from './utils';

// --- Hall of Fame ---

export const subscribeToHallOfFame = (callback: (entries: HallOfFameEntry[]) => void) => {
    const q = query(collection(db, 'albo'));
    return onSnapshot(q, (snapshot) => {
        const entries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HallOfFameEntry));
        entries.sort((a, b) => {
            const dateA = a.date || a.createdAt || '';
            const dateB = b.date || b.createdAt || '';
            return dateB.localeCompare(dateA);
        });
        callback(entries);
    });
};

export const addHallOfFameEntry = async (entry: Omit<HallOfFameEntry, 'id'>) => {
    try {
        const sanitizedEntry = Object.fromEntries(
            Object.entries(entry).filter(([_, v]) => v !== undefined)
        );
        await addDoc(collection(db, 'albo'), {
            ...sanitizedEntry,
            createdAt: new Date().toISOString()
        });
    } catch (error) {
        console.error("Error adding Hall of Fame entry:", error);
        throw error;
    }
};

export const updateHallOfFameEntry = async (entry: Partial<HallOfFameEntry> & { id: string }) => {
    try {
        const entryRef = doc(db, 'albo', entry.id);
        const { id, ...data } = entry;
        const sanitizedData = Object.fromEntries(
            Object.entries(data).filter(([_, v]) => v !== undefined)
        );
        await updateDoc(entryRef, sanitizedData);
    } catch (error) {
        console.error("Error updating Hall of Fame entry:", error);
        throw error;
    }
};

export const deleteHallOfFameEntry = async (id: string) => {
    try {
        await deleteDoc(doc(db, 'albo', id));
    } catch (error) {
        console.error("Error deleting Hall of Fame entry:", error);
        throw error;
    }
};

export const archiveEvent = async (eventId: string, placement: string, awards: string[]) => {
    try {
        const eventRef = doc(db, 'calendario', eventId);
        const eventSnap = await getDoc(eventRef);
        if (!eventSnap.exists()) throw new Error("Event not found");
        const eventData = eventSnap.data() as Event;

        const rosterQuery = query(collection(db, 'roster'), where('eventId', '==', eventId));
        const rosterSnap = await getDocs(rosterQuery);
        const roster = rosterSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as RosterMember));

        const entry: Omit<HallOfFameEntry, 'id'> = {
            title: eventData.title,
            location: eventData.location || (eventData.surface ? (eventData.surface === 'erba' ? 'Erba' : 'Sabbia') : 'Unknown'),
            dateDescription: eventData.season || eventData.date,
            date: eventData.date || new Date().toISOString().split('T')[0],
            placement,
            awards,
            roster,
            createdAt: new Date().toISOString(),
            latitude: eventData.latitude,
            longitude: eventData.longitude
        };
        await addHallOfFameEntry(entry);

        const batch = writeBatch(db);
        batch.update(eventRef, { isArchived: true });
        await batch.commit();

        console.log("Event archived to Hall of Fame and preserved in Calendar.");
    } catch (error) {
        console.error("Error archiving event:", error);
        throw error;
    }
};

export const restoreEventFromHallOfFame = async (entry: HallOfFameEntry) => {
    try {
        const batch = writeBatch(db);

        const newEventRef = doc(collection(db, 'calendario'));
        const newEventId = newEventRef.id;

        const newEventData: any = {
            id: newEventId,
            title: entry.title,
            date: entry.date,
            type: 'tournament',
            isArchived: true,
            location: entry.location,
            season: entry.dateDescription
        };

        if (entry.latitude !== undefined) newEventData.latitude = entry.latitude;
        if (entry.longitude !== undefined) newEventData.longitude = entry.longitude;

        batch.set(newEventRef, newEventData);

        if (entry.roster && entry.roster.length > 0) {
            entry.roster.forEach(member => {
                const rosterRef = doc(collection(db, 'roster'));
                batch.set(rosterRef, { ...member, eventId: newEventId, id: rosterRef.id });
            });
        }

        await batch.commit();
        console.log("Event restored from Hall of Fame:", newEventId);
        return newEventId;
    } catch (error) {
        console.error("Error restoring event:", error);
        throw error;
    }
};

// --- Roster ---

export const subscribeToRoster = (eventId: string, callback: (roster: RosterMember[]) => void) => {
    const q = query(collection(db, 'roster'), where('eventId', '==', eventId));
    return onSnapshot(q, (snapshot) => {
        const roster = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RosterMember));
        roster.sort((a, b) => a.name.localeCompare(b.name));
        callback(roster);
    });
};

export const addToRoster = async (eventId: string, name: string, isGuest: boolean, memberId?: string, role: 'player' | 'guest' = 'player') => {
    try {
        await addDoc(collection(db, 'roster'), {
            eventId, name, isGuest,
            memberId: memberId || null,
            role
        });
    } catch (error) {
        console.error("Error adding to roster:", error);
        throw error;
    }
};

export const removeFromRoster = async (id: string) => {
    try {
        await deleteDoc(doc(db, 'roster', id));
    } catch (error) {
        console.error("Error removing from roster:", error);
        throw error;
    }
};

export const updateRosterMember = async (id: string, data: Partial<RosterMember>) => {
    try {
        await updateDoc(doc(db, 'roster', id), data);
    } catch (error) {
        console.error("Error updating roster member:", error);
        throw error;
    }
};

// --- Member Tournaments ---

export const subscribeToMemberTournaments = (
    memberId: string,
    currentSeason: string,
    callback: (tournaments: MemberTournament[]) => void
) => {
    if (!memberId) {
        callback([]);
        return () => { };
    }

    const loadAllTournaments = async () => {
        try {
            let memberFullName = '';
            try {
                const memDoc = await getDoc(doc(db, 'indirizzario', memberId));
                if (memDoc.exists()) {
                    const mData = memDoc.data();
                    memberFullName = `${mData.firstName || ''} ${mData.lastName || ''}`.trim().toLowerCase();
                }
            } catch (e) {
                // Ignore error, use ID match
            }

            const tournamentsMap = new Map<string, MemberTournament>();

            // 1. Tournaments from 'roster' (linked to 'calendario')
            const rosterQuery = query(collection(db, 'roster'), where('memberId', '==', memberId));
            const rosterSnap = await getDocs(rosterQuery);
            const calSnap = await getDocs(collection(db, 'calendario'));
            const calMap = new Map<string, any>();
            calSnap.docs.forEach(d => calMap.set(d.id, { id: d.id, ...d.data() }));

            rosterSnap.docs.forEach(docSnap => {
                const rData = docSnap.data();
                const event = calMap.get(rData.eventId);
                if (event) {
                    const eventDate = event.date || event.id;
                    const eventSeason = event.stagione || getStagioneFromDate(eventDate);
                    const isCurrent = eventSeason === currentSeason;
                    const key = `${(event.title || '').trim().toLowerCase()}_${eventDate}`;

                    tournamentsMap.set(key, {
                        id: event.id,
                        rosterId: docSnap.id,
                        title: event.title || 'Torneo',
                        date: eventDate,
                        endDate: event.endDate,
                        location: event.location,
                        type: event.type || 'tournament',
                        stagione: eventSeason,
                        role: rData.role || 'player',
                        isCurrentSeason: isCurrent
                    });
                }
            });

            // 2. Tournaments from 'albo' (Hall of Fame / storico)
            const alboSnap = await getDocs(collection(db, 'albo'));
            alboSnap.docs.forEach(d => {
                const data = d.data();
                const roster = Array.isArray(data.roster) ? data.roster : [];
                const entry = roster.find((r: any) =>
                    r.memberId === memberId ||
                    r.id === memberId ||
                    (memberFullName && r.name && r.name.toLowerCase().includes(memberFullName))
                );

                if (entry) {
                    const date = data.date || (data.createdAt ? data.createdAt.split('T')[0] : '');
                    const title = data.title || 'Torneo';
                    const key = `${title.trim().toLowerCase()}_${date}`;

                    const alreadyExists = Array.from(tournamentsMap.values()).some(existing => {
                        if (existing.date && date && existing.date === date) {
                            const eTitle = existing.title.toLowerCase().trim();
                            const aTitle = title.toLowerCase().trim();
                            return eTitle === aTitle || eTitle.includes(aTitle) || aTitle.includes(eTitle);
                        }
                        return false;
                    });

                    if (!alreadyExists) {
                        const eventSeason = getStagioneFromDate(date);
                        tournamentsMap.set(key, {
                            id: d.id,
                            rosterId: entry.id || d.id,
                            title,
                            date,
                            location: data.location,
                            type: 'tournament',
                            stagione: eventSeason,
                            role: entry.role || 'player',
                            isCurrentSeason: eventSeason === currentSeason
                        });
                    }
                }
            });

            const tournaments = Array.from(tournamentsMap.values());
            tournaments.sort((a, b) => b.date.localeCompare(a.date));
            callback(tournaments);
        } catch (err) {
            console.error("Error fetching member tournaments:", err);
            callback([]);
        }
    };

    const rosterQuery = query(collection(db, 'roster'), where('memberId', '==', memberId));
    const unsubscribeRoster = onSnapshot(rosterQuery, () => {
        loadAllTournaments();
    }, (err) => {
        console.error("Roster subscription error:", err);
        loadAllTournaments();
    });

    return () => { unsubscribeRoster(); };
};
