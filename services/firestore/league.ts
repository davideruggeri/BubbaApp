// services/firestore/league.ts
// Gestione lega (campionati winter/summer, team, match, bonus, regole, storico)

import { db } from '../../firebaseConfig';
import {
    collection, addDoc, deleteDoc, doc, setDoc, updateDoc,
    onSnapshot, query, where, getDocs, getDoc, writeBatch
} from 'firebase/firestore';
import type {
    LeagueTeam, LeagueMatch, LeagueDates, LeagueBonus,
    LeagueRule, BonusDefinition, PastLeague, Member
} from './types';

// --- League Dates ---

export const subscribeToLeagueDates = (leagueType: 'winter' | 'summer', callback: (dates: LeagueDates | null) => void) => {
    return onSnapshot(doc(db, 'impostazione', `League_${leagueType}_Dates`), (docSnap) => {
        if (docSnap.exists()) callback(docSnap.data() as LeagueDates);
        else callback(null);
    });
};

export const updateLeagueDates = async (leagueType: 'winter' | 'summer', dates: LeagueDates) => {
    await setDoc(doc(db, 'impostazione', `League_${leagueType}_Dates`), dates);
};

// --- League Rules ---

export const subscribeToLeagueRules = (leagueType: 'winter' | 'summer', callback: (rules: LeagueRule[]) => void) => {
    return onSnapshot(doc(db, 'impostazione', `League_${leagueType}_Rules`), (docSnap) => {
        if (docSnap.exists()) callback(docSnap.data().values || []);
        else callback([]);
    });
};

export const saveLeagueRules = async (leagueType: 'winter' | 'summer', rules: LeagueRule[]) => {
    await setDoc(doc(db, 'impostazione', `League_${leagueType}_Rules`), { values: rules });
};

// --- Bonus Definitions ---

export const subscribeToBonusDefinitions = (leagueType: 'winter' | 'summer', callback: (definitions: BonusDefinition[]) => void) => {
    return onSnapshot(doc(db, 'impostazione', `League_${leagueType}_BonusDefinitions`), (docSnap) => {
        if (docSnap.exists()) callback(docSnap.data().values || []);
        else callback([]);
    });
};

export const saveBonusDefinitions = async (leagueType: 'winter' | 'summer', definitions: BonusDefinition[]) => {
    await setDoc(doc(db, 'impostazione', `League_${leagueType}_BonusDefinitions`), { values: definitions });
};

// --- League Teams ---

export const subscribeToLeagueTeams = (leagueType: 'winter' | 'summer', callback: (teams: LeagueTeam[]) => void) => {
    const q = query(collection(db, 'league', leagueType, 'teams'));
    return onSnapshot(q, (snapshot) => {
        const teams = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeagueTeam));
        teams.sort((a, b) => a.name.localeCompare(b.name));
        callback(teams);
    });
};

export const addLeagueTeam = async (name: string, leagueType: 'winter' | 'summer') => {
    try {
        await addDoc(collection(db, 'league', leagueType, 'teams'), { name });
    } catch (error) {
        console.error("Error adding league team:", error);
        throw error;
    }
};

export const deleteLeagueTeam = async (id: string, leagueType: 'winter' | 'summer') => {
    try {
        await deleteDoc(doc(db, 'league', leagueType, 'teams', id));
    } catch (error) {
        console.error("Error deleting league team:", error);
        throw error;
    }
};

// --- League Matches ---

export const subscribeToLeagueMatches = (leagueType: 'winter' | 'summer', callback: (matches: LeagueMatch[]) => void) => {
    const q = query(collection(db, 'league', leagueType, 'matches'));
    return onSnapshot(q, (snapshot) => {
        const matches = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeagueMatch));
        matches.sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            return (a.round || 0) - (b.round || 0);
        });
        callback(matches);
    });
};

export const addLeagueMatch = async (match: Omit<LeagueMatch, 'id'>, leagueType: 'winter' | 'summer') => {
    try {
        await addDoc(collection(db, 'league', leagueType, 'matches'), match);
    } catch (error) {
        console.error("Error adding league match:", error);
        throw error;
    }
};

export const updateLeagueMatch = async (match: LeagueMatch, leagueType: 'winter' | 'summer') => {
    try {
        const matchRef = doc(db, 'league', leagueType, 'matches', match.id);
        const { id, ...data } = match;
        await updateDoc(matchRef, data);
    } catch (error) {
        console.error("Error updating league match:", error);
        throw error;
    }
};

export const deleteLeagueMatch = async (id: string, leagueType: 'winter' | 'summer') => {
    try {
        await deleteDoc(doc(db, 'league', leagueType, 'matches', id));
    } catch (error) {
        console.error("Error deleting league match:", error);
        throw error;
    }
};

// --- League Bonuses ---

export const subscribeToLeagueBonuses = (leagueType: 'winter' | 'summer', callback: (bonuses: LeagueBonus[]) => void) => {
    const q = query(collection(db, 'league', leagueType, 'bonuses'));
    return onSnapshot(q, (snapshot) => {
        const bonuses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeagueBonus));
        bonuses.sort((a, b) => b.date.localeCompare(a.date));
        callback(bonuses);
    });
};

export const addLeagueBonus = async (bonus: Omit<LeagueBonus, 'id'>) => {
    try {
        await addDoc(collection(db, 'league', bonus.leagueType, 'bonuses'), bonus);
    } catch (error) {
        console.error("Error adding league bonus:", error);
        throw error;
    }
};

export const deleteLeagueBonus = async (id: string, leagueType: 'winter' | 'summer') => {
    try {
        await deleteDoc(doc(db, 'league', leagueType, 'bonuses', id));
    } catch (error) {
        console.error("Error deleting league bonus:", error);
        throw error;
    }
};

// --- League Attendance ---

export const subscribeToLeagueAttendance = (startDate: string, endDate: string, callback: (attendance: { memberId: string, date: string }[]) => void) => {
    const q = query(
        collection(db, 'presenze'),
        where('date', '>=', startDate),
        where('date', '<=', endDate)
    );
    return onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({
            memberId: doc.data().memberId,
            date: doc.data().date
        }));
        callback(data);
    });
};

// --- League History ---

export const subscribeToPastLeagues = (callback: (leagues: PastLeague[]) => void) => {
    const q = query(collection(db, 'league_history'));
    return onSnapshot(q, (snapshot) => {
        const leagues = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PastLeague));
        leagues.sort((a, b) => b.endDate.localeCompare(a.endDate));
        callback(leagues);
    });
};

export const checkIfLeagueArchived = async (leagueId: string): Promise<boolean> => {
    try {
        const docRef = doc(db, 'league_history', leagueId);
        const docSnap = await getDoc(docRef);
        return docSnap.exists();
    } catch (error) {
        console.error("Error checking if league archived:", error);
        return false;
    }
};

export const archiveLeague = async (data: PastLeague) => {
    try {
        if (data.id) {
            await setDoc(doc(db, 'league_history', data.id), data);
        } else {
            await addDoc(collection(db, 'league_history'), data);
        }
    } catch (error) {
        console.error("Error archiving league:", error);
        throw error;
    }
};

export const resetLeagueData = async (leagueType: 'winter' | 'summer') => {
    try {
        // 1. Elimina i bonus correnti dal database attivo
        const bonusesSnap = await getDocs(collection(db, 'league', leagueType, 'bonuses'));
        let batch = writeBatch(db);
        let count = 0;
        for (const docSnap of bonusesSnap.docs) {
            batch.delete(docSnap.ref);
            count++;
            if (count >= 400) {
                await batch.commit();
                batch = writeBatch(db);
                count = 0;
            }
        }
        if (count > 0) {
            await batch.commit();
        }

        // 2. Resetta le date del campionato
        await setDoc(doc(db, 'impostazione', `League_${leagueType}_Dates`), {
            startDate: '',
            endDate: ''
        });
    } catch (error) {
        console.error(`Error resetting ${leagueType} league:`, error);
        throw error;
    }
};

export const archiveAndResetLeague = async (leagueType: 'winter' | 'summer', data: PastLeague) => {
    try {
        // 1. Salva nell'archivio storico (inclusi classifica, vincitore e dettaglio bonus)
        await archiveLeague(data);

        // 2. Pulisce la lega attiva per il nuovo anno
        await resetLeagueData(leagueType);
    } catch (error) {
        console.error(`Error archiving and resetting ${leagueType} league:`, error);
        throw error;
    }
};

export const autoArchiveWinterLeagueIfNeeded = async (): Promise<boolean> => {
    try {
        const datesDoc = await getDoc(doc(db, 'impostazione', 'League_winter_Dates'));
        if (!datesDoc.exists()) return false;
        const dates = datesDoc.data() as LeagueDates;
        if (!dates.startDate || !dates.endDate) return false;

        // Recupera membri per calcolo classifica
        const membersSnap = await getDocs(collection(db, 'members'));
        const members = membersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Member));

        // Presenze nel periodo
        const presenzeSnap = await getDocs(query(
            collection(db, 'presenze'),
            where('date', '>=', dates.startDate),
            where('date', '<=', dates.endDate)
        ));

        // Bonus correnti
        const bonusesSnap = await getDocs(collection(db, 'league', 'winter', 'bonuses'));
        const bonuses = bonusesSnap.docs.map(d => ({ id: d.id, ...d.data() } as LeagueBonus));

        const stats: Record<string, { member: Member, points: number, attendanceCount: number, bonusPoints: number }> = {};
        members.forEach(m => {
            stats[m.id] = { member: m, points: 0, attendanceCount: 0, bonusPoints: 0 };
        });

        presenzeSnap.docs.forEach(docSnap => {
            const data = docSnap.data();
            const mId = data.memberId;
            if (stats[mId]) {
                stats[mId].points += 2;
                stats[mId].attendanceCount += 1;
            }
        });

        const leagueBonuses: LeagueBonus[] = [];
        bonuses.forEach(b => {
            if (b.date >= dates.startDate && b.date <= dates.endDate) {
                leagueBonuses.push(b);
                if (stats[b.memberId]) {
                    stats[b.memberId].bonusPoints += b.points;
                    stats[b.memberId].points += b.points;
                }
            }
        });

        const sorted = Object.values(stats)
            .filter(s => s.points > 0 || s.attendanceCount > 0 || s.bonusPoints !== 0)
            .sort((a, b) => b.points !== a.points ? b.points - a.points : b.attendanceCount - a.attendanceCount);

        const winnerId = sorted.length > 0 ? sorted[0].member.id : '';
        const endYear = dates.endDate.split('-')[0];

        const pastLeagueData: PastLeague = {
            id: `winter_${endYear}`,
            name: `Winter League ${endYear}`,
            startDate: dates.startDate,
            endDate: dates.endDate,
            type: 'winter',
            winnerId,
            totalParticipants: sorted.length,
            bonuses: leagueBonuses,
            standings: sorted.map((s, index) => ({
                id: s.member.id,
                name: s.member.nickname || s.member.firstName,
                points: s.points,
                attendanceCount: s.attendanceCount,
                bonusPoints: s.bonusPoints,
                rank: index + 1
            }))
        };

        await archiveAndResetLeague('winter', pastLeagueData);
        return true;
    } catch (error) {
        console.error("Error auto-archiving winter league:", error);
        return false;
    }
};
