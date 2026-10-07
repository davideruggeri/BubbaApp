// services/firestore/season.ts
// Gestione stagioni, storico presenze, chiusura stagione e Bubba Wrapped

import { db } from '../../firebaseConfig';
import {
    collection, doc, getDoc, setDoc, getDocs, updateDoc,
    onSnapshot, query, where, writeBatch
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
    StagioneCorrente, PresenzeHistoryEntry, MemberSeasonStats,
    Member, Event, UserWrappedData, TeamWrappedData
} from './types';
import {
    getCachedStagioneCorrente, setCachedStagioneCorrente,
    getStagioneFromDate, getSeasonStartDate, getSeasonEndDate, assignTiedRanks
} from './utils';
import { recalculateAllAttendanceCounts } from './attendance';
import { autoArchiveWinterLeagueIfNeeded } from './league';
import { isMemberActiveAtDate } from './members';


// --- Stagione Corrente ---

export const subscribeToStagioneCorrente = (callback: (data: StagioneCorrente | null) => void) => {
    const docRef = doc(db, 'impostazione', 'stagione_corrente');
    return onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) callback(docSnap.data() as StagioneCorrente);
        else callback(null);
    });
};

export const subscribeToPresenzeHistory = (callback: (history: PresenzeHistoryEntry[]) => void) => {
    const q = query(collection(db, 'presenze_history'));
    return onSnapshot(q, (snapshot) => {
        const history = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as PresenzeHistoryEntry));
        history.sort((a, b) => b.stagione.localeCompare(a.stagione));
        callback(history);
    });
};

export const calcolaEArchiviaStagione = async (stagioneTarget: string): Promise<PresenzeHistoryEntry> => {
    // 1. Leggi tutti gli allenamenti della stagione
    const calendarSnap = await getDocs(collection(db, 'calendario'));
    const trainingDatesMap: Record<string, 'Campo' | 'Palestra'> = {};
    let ospitiCampo = 0;
    let ospitiPalestra = 0;

    calendarSnap.docs.forEach(d => {
        const data = d.data();
        const rawDate = data.date || d.id;
        const date = rawDate.split('T')[0];
        const docSeason = data.stagione || getStagioneFromDate(date);
        if (docSeason === stagioneTarget) {
            const eventType = data.type || 'training';
            if (eventType === 'Campo' || eventType === 'Palestra' || eventType === 'training') {
                const normalizedType: 'Campo' | 'Palestra' = eventType === 'Palestra' ? 'Palestra' : 'Campo';
                trainingDatesMap[date] = normalizedType;
                const guestCount = Array.isArray(data.guests) ? data.guests.length : 0;
                if (normalizedType === 'Palestra') ospitiPalestra += guestCount;
                else ospitiCampo += guestCount;
            }
        }
    });

    // 2. Leggi le presenze della stagione
    const presenzeSnap = await getDocs(collection(db, 'presenze'));
    const memberPresences: Record<string, { campo: number; palestra: number; datesCampo: Set<string>; datesPalestra: Set<string>; datesAll: Set<string> }> = {};
    let totalePresenzeCampo = ospitiCampo;
    let totalePresenzePalestra = ospitiPalestra;

    presenzeSnap.docs.forEach(d => {
        const data = d.data();
        const rawDate = data.date || d.id.split('_')[0];
        const date = rawDate.split('T')[0];
        const memberId = data.memberId;
        const docSeason = data.stagione || getStagioneFromDate(date);

        if (docSeason === stagioneTarget) {
            if (!memberPresences[memberId]) {
                memberPresences[memberId] = { campo: 0, palestra: 0, datesCampo: new Set(), datesPalestra: new Set(), datesAll: new Set() };
            }
            const type = trainingDatesMap[date] || 'Campo';
            if (!trainingDatesMap[date]) trainingDatesMap[date] = type;

            if (type === 'Palestra') {
                memberPresences[memberId].palestra++;
                memberPresences[memberId].datesPalestra.add(date);
                totalePresenzePalestra++;
            } else {
                memberPresences[memberId].campo++;
                memberPresences[memberId].datesCampo.add(date);
                totalePresenzeCampo++;
            }
            memberPresences[memberId].datesAll.add(date);
        }
    });

    const uniqueTrainingDates = Object.keys(trainingDatesMap).sort();
    const trainingDatesCampo = Object.entries(trainingDatesMap).filter(([_, t]) => t === 'Campo').map(([d]) => d).sort();
    const trainingDatesPalestra = Object.entries(trainingDatesMap).filter(([_, t]) => t === 'Palestra').map(([d]) => d).sort();

    const numeroAllenamenti = uniqueTrainingDates.length;
    const numeroAllenamentiCampo = trainingDatesCampo.length;
    const numeroAllenamentiPalestra = trainingDatesPalestra.length;

    // 3. Calcola metriche per membro
    const membersSnap = await getDocs(collection(db, 'indirizzario'));
    const perMembro: Record<string, MemberSeasonStats> = {};

    membersSnap.docs.forEach(docSnap => {
        const memberId = docSnap.id;
        const memberData = { id: memberId, ...docSnap.data() } as Member;
        const stats = memberPresences[memberId] || { campo: 0, palestra: 0, datesCampo: new Set(), datesPalestra: new Set(), datesAll: new Set() };
        const presenzeCampo = stats.campo;
        const presenzePalestra = stats.palestra;
        const totalPresences = presenzeCampo + presenzePalestra;

        // Calcola allenamenti effettivi in cui il membro era attivo/disponibile
        const eligibleDatesCampo = trainingDatesCampo.filter(d => isMemberActiveAtDate(memberData, d));
        const eligibleDatesPalestra = trainingDatesPalestra.filter(d => isMemberActiveAtDate(memberData, d));
        const eligibleDatesAll = uniqueTrainingDates.filter(d => isMemberActiveAtDate(memberData, d));

        const countEligibleCampo = eligibleDatesCampo.length;
        const countEligiblePalestra = eligibleDatesPalestra.length;
        const countEligibleAll = eligibleDatesAll.length;

        const percentualeCampo = countEligibleCampo > 0
            ? Math.round((presenzeCampo / countEligibleCampo) * 1000) / 10 : 0;
        const percentualePalestra = countEligiblePalestra > 0
            ? Math.round((presenzePalestra / countEligiblePalestra) * 1000) / 10 : 0;
        const percentualePresenza = countEligibleAll > 0
            ? Math.round((totalPresences / countEligibleAll) * 1000) / 10 : 0;

        let streakMassima = 0, currentStreak = 0;
        for (const tDate of uniqueTrainingDates) {
            if (stats.datesAll.has(tDate)) { currentStreak++; if (currentStreak > streakMassima) streakMassima = currentStreak; }
            else currentStreak = 0;
        }

        let streakCampo = 0, curStreakCampo = 0;
        for (const tDate of trainingDatesCampo) {
            if (stats.datesCampo.has(tDate)) { curStreakCampo++; if (curStreakCampo > streakCampo) streakCampo = curStreakCampo; }
            else curStreakCampo = 0;
        }

        let streakPalestra = 0, curStreakPalestra = 0;
        for (const tDate of trainingDatesPalestra) {
            if (stats.datesPalestra.has(tDate)) { curStreakPalestra++; if (curStreakPalestra > streakPalestra) streakPalestra = curStreakPalestra; }
            else curStreakPalestra = 0;
        }

        perMembro[memberId] = {
            presenzeCampo, presenzePalestra,
            percentualeCampo, percentualePalestra, percentualePresenza,
            streakMassima, streakCampo, streakPalestra
        };
    });

    const seasonEndDate = getSeasonEndDate(stagioneTarget);
    const historyData: PresenzeHistoryEntry = {
        stagione: stagioneTarget,
        dataChiusura: seasonEndDate,
        totalePresenzeCampo,
        totalePresenzePalestra,
        totaleOspitiCampo: ospitiCampo,
        totaleOspitiPalestra: ospitiPalestra,
        totaleOspiti: ospitiCampo + ospitiPalestra,
        numeroAllenamenti,
        numeroAllenamentiCampo,
        numeroAllenamentiPalestra,
        perMembro
    };

    await setDoc(doc(db, 'presenze_history', stagioneTarget), historyData);
    return historyData;
};

export const chiudiStagione = async (nuovaStagione: string): Promise<void> => {
    try {
        const stagioneCorrente = getCachedStagioneCorrente();
        console.log(`Chiudo stagione: ${stagioneCorrente} -> Nuova stagione: ${nuovaStagione}`);

        await calcolaEArchiviaStagione(stagioneCorrente);

        try {
            await generateBubbaWrapped(stagioneCorrente);
        } catch (wrappedErr) {
            console.warn("Errore generazione automatica Bubba Wrapped durante chiusura:", wrappedErr);
        }

        try {
            await autoArchiveWinterLeagueIfNeeded();
            console.log("Winter League archiviata e pulita automaticamente.");
        } catch (leagueErr) {
            console.warn("Errore archiviazione automatica Winter League durante chiusura stagione:", leagueErr);
        }

        const currentSeasonDocRef = doc(db, 'impostazione', 'stagione_corrente');
        const currentSeasonSnap = await getDoc(currentSeasonDocRef);
        const currentSeasonData = currentSeasonSnap.exists() ? currentSeasonSnap.data() : null;
        const seasonEndDate = getSeasonEndDate(stagioneCorrente);
        const newSeasonStartDate = getSeasonStartDate(nuovaStagione);

        await setDoc(doc(db, 'stagioni_storico', stagioneCorrente), {
            stagione: stagioneCorrente,
            dataInizio: currentSeasonData?.dataInizio || getSeasonStartDate(stagioneCorrente),
            dataFine: seasonEndDate
        });

        await setDoc(currentSeasonDocRef, {
            stagioneCorrente: nuovaStagione,
            dataInizio: newSeasonStartDate,
            dataFine: null
        });

        await recalculateAllAttendanceCounts(nuovaStagione);
        setCachedStagioneCorrente(nuovaStagione);
        console.log(`Stagione ${stagioneCorrente} archiviata. Nuova stagione ${nuovaStagione} avviata.`);
    } catch (error) {
        console.error("Errore durante chiusura stagione:", error);
        throw error;
    }
};

export const eseguiMigrazioneStagioni = async (): Promise<{ presenze: number; calendario: number; matchAnalysis: number; stagioneCorrente: string }> => {
    try {
        console.log("Inizio migrazione dati storici stagioni...");

        // 1. Presenze
        const presenzeSnap = await getDocs(collection(db, 'presenze'));
        let batch = writeBatch(db);
        let opCount = 0, countPresenze = 0;

        for (const docSnap of presenzeSnap.docs) {
            const data = docSnap.data();
            const date = data.date || docSnap.id.split('_')[0];
            const stagione = getStagioneFromDate(date);
            if (data.stagione !== stagione) {
                batch.update(docSnap.ref, { stagione });
                opCount++;
                countPresenze++;
                if (opCount >= 400) { await batch.commit(); batch = writeBatch(db); opCount = 0; }
            }
        }
        if (opCount > 0) await batch.commit();

        // 2. Calendario
        const calSnap = await getDocs(collection(db, 'calendario'));
        batch = writeBatch(db);
        opCount = 0;
        let countCal = 0;

        for (const docSnap of calSnap.docs) {
            const data = docSnap.data();
            const date = data.date || docSnap.id;
            const stagione = getStagioneFromDate(date);
            if (data.stagione !== stagione) {
                batch.update(docSnap.ref, { stagione });
                opCount++;
                countCal++;
                if (opCount >= 400) { await batch.commit(); batch = writeBatch(db); opCount = 0; }
            }
        }
        if (opCount > 0) await batch.commit();

        // 3. Match Analysis
        const matchSnap = await getDocs(collection(db, 'match_analysis'));
        batch = writeBatch(db);
        opCount = 0;
        let countMatches = 0;

        for (const docSnap of matchSnap.docs) {
            const data = docSnap.data();
            const date = data.date;
            const stagione = getStagioneFromDate(date);
            if (data.stagione !== stagione) {
                batch.update(docSnap.ref, { stagione });
                opCount++;
                countMatches++;
                if (opCount >= 400) { await batch.commit(); batch = writeBatch(db); opCount = 0; }
            }
        }
        if (opCount > 0) await batch.commit();

        // 4. Inizializza singleton impostazione/stagione_corrente
        const seasonRef = doc(db, 'impostazione', 'stagione_corrente');
        const seasonSnap = await getDoc(seasonRef);
        let currentSeason = getCachedStagioneCorrente();

        if (!seasonSnap.exists()) {
            await setDoc(seasonRef, {
                stagioneCorrente: currentSeason,
                dataInizio: getSeasonStartDate(currentSeason),
                dataFine: null
            });
        } else {
            currentSeason = seasonSnap.data().stagioneCorrente || currentSeason;
        }

        return { presenze: countPresenze, calendario: countCal, matchAnalysis: countMatches, stagioneCorrente: currentSeason };
    } catch (error) {
        console.error("Errore durante migrazione stagioni:", error);
        throw error;
    }
};

// --- Bubba Wrapped ---

function calculateHaversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
}

export const generateBubbaWrapped = async (stagione: string): Promise<{ team: TeamWrappedData; membersCount: number }> => {
    try {
        console.log(`[Bubba Wrapped] Avvio generazione per stagione ${stagione}...`);

        // 1. Assicura dati storici presenze
        let historyEntry: PresenzeHistoryEntry;
        const histDocSnap = await getDoc(doc(db, 'presenze_history', stagione));
        if (histDocSnap.exists()) {
            historyEntry = histDocSnap.data() as PresenzeHistoryEntry;
        } else {
            historyEntry = await calcolaEArchiviaStagione(stagione);
        }

        const perMembro = historyEntry.perMembro || {};
        const allenamentiCampo = historyEntry.numeroAllenamentiCampo ?? historyEntry.numeroAllenamenti ?? 0;
        const allenamentiPalestra = historyEntry.numeroAllenamentiPalestra ?? 0;
        const allenamentiTotali = allenamentiCampo + allenamentiPalestra;

        // 2. Membri
        const membersSnap = await getDocs(collection(db, 'indirizzario'));
        const membersMap: Record<string, Member> = {};
        const memberNames: Record<string, string> = {};
        membersSnap.docs.forEach(d => {
            const m = { id: d.id, ...d.data() } as Member;
            membersMap[d.id] = m;
            memberNames[d.id] = m.nickname || `${m.firstName} ${m.lastName || ''}`.trim();
        });

        // 3. Nuovi membri nella stagione
        const seasonStart = getSeasonStartDate(stagione);
        const seasonEnd = getSeasonEndDate(stagione);
        const nuoviMembriNomi: string[] = [];
        membersSnap.docs.forEach(d => {
            const data = d.data();
            const joinDate = data.createdAt ? new Date(data.createdAt) : (data.dataTesseramento ? new Date(data.dataTesseramento) : null);
            if (joinDate && joinDate >= seasonStart && joinDate <= seasonEnd) {
                nuoviMembriNomi.push(data.nickname || `${data.firstName} ${data.lastName || ''}`.trim());
            }
        });

        // 4. Calendario: tornei & eventi della stagione
        const calSnap = await getDocs(collection(db, 'calendario'));
        const seasonEvents: Event[] = [];
        const singleSessionCounts: Record<string, number> = {};
        let legacyOspitiCampo = 0;
        let legacyOspitiPalestra = 0;

        calSnap.docs.forEach(d => {
            const data = d.data();
            const dDate = data.date || d.id;
            const dSeason = data.stagione || getStagioneFromDate(dDate);
            if (dSeason === stagione) {
                const ev = { id: d.id, ...data, date: dDate, stagione: dSeason } as Event;
                if (ev.type !== 'Campo' && ev.type !== 'Palestra' && ev.type !== 'training') {
                    seasonEvents.push(ev);
                } else {
                    const guestCount = Array.isArray(data.guests) ? data.guests.length : 0;
                    if (guestCount > 0) {
                        singleSessionCounts[dDate] = (singleSessionCounts[dDate] || 0) + guestCount;
                        if (data.type === 'Palestra') legacyOspitiPalestra += guestCount;
                        else legacyOspitiCampo += guestCount;
                    }
                }
            }
        });
        seasonEvents.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

        const ospitiGiaInclusi = historyEntry.totaleOspiti !== undefined;
        const totPresCampo = (historyEntry.totalePresenzeCampo || 0) + (ospitiGiaInclusi ? 0 : legacyOspitiCampo);
        const totPresPalestra = (historyEntry.totalePresenzePalestra || 0) + (ospitiGiaInclusi ? 0 : legacyOspitiPalestra);
        const presenzeTotaliSquadra = totPresCampo + totPresPalestra;
        const mediaPresenzePerAllenamento = allenamentiTotali > 0
            ? Math.round((presenzeTotaliSquadra / allenamentiTotali) * 10) / 10 : 0;

        // Record presenze singolo allenamento
        const presenzeSnap = await getDocs(collection(db, 'presenze'));
        const memberAttendedDates: Record<string, Set<string>> = {};
        presenzeSnap.docs.forEach(d => {
            const data = d.data();
            const date = data.date;
            const memId = data.memberId;
            const docSeason = data.stagione || getStagioneFromDate(date);
            if (docSeason === stagione) {
                singleSessionCounts[date] = (singleSessionCounts[date] || 0) + 1;
                if (!memberAttendedDates[memId]) memberAttendedDates[memId] = new Set();
                memberAttendedDates[memId].add(date);
            }
        });

        let maxCount = 0, recordDate = '';
        Object.entries(singleSessionCounts).forEach(([date, count]) => {
            if (count > maxCount) { maxCount = count; recordDate = date; }
        });

        // 5. World Locations & Km
        const HOME_LAT = 44.4949;
        const HOME_LON = 11.3426;
        let kmTotaliPercorsi = 0;
        const tappeMappa: Array<{ locationName: string; title: string; date?: string }> = [];

        const locSnap = await getDocs(collection(db, 'world_locations'));
        locSnap.docs.forEach(d => {
            const loc = d.data();
            const locDate = loc.date;
            const locSeason = locDate ? getStagioneFromDate(locDate) : stagione;
            if (locSeason === stagione && loc.latitude && loc.longitude) {
                const dist = calculateHaversineKm(HOME_LAT, HOME_LON, loc.latitude, loc.longitude);
                kmTotaliPercorsi += dist * 2;
                tappeMappa.push({ locationName: loc.locationName || loc.title || 'Tappa', title: loc.title || loc.locationName || '', date: locDate });
            }
        });

        seasonEvents.forEach(ev => {
            if (ev.latitude && ev.longitude) {
                const dist = calculateHaversineKm(HOME_LAT, HOME_LON, ev.latitude, ev.longitude);
                kmTotaliPercorsi += dist * 2;
                if (!tappeMappa.some(t => t.locationName === (ev.location || ev.title))) {
                    tappeMappa.push({ locationName: ev.location || ev.title, title: ev.title, date: ev.date });
                }
            }
        });

        const torneiNomi = seasonEvents.map(e => e.title);

        // 6. League data
        const leagueHistorySnap = await getDocs(collection(db, 'league_history'));
        const leagueMembersMap: Record<string, { points: number; rank: number; total: number; leagueType: string }> = {};
        leagueHistorySnap.docs.forEach(d => {
            const data = d.data();
            const lSeason = data.season || data.stagione || (d.id.includes('2026') ? '2025-2026' : (d.id.includes('2025') ? '2024-2025' : (data.startDate ? getStagioneFromDate(data.startDate) : '')));
            if (lSeason === stagione) {
                const list = Array.isArray(data.standings) ? data.standings : (Array.isArray(data.members) ? data.members : []);
                const sorted = [...list].sort((a, b) => (b.points || 0) - (a.points || 0));
                const ranked = assignTiedRanks(sorted, m => m.points || 0);
                ranked.forEach(m => {
                    const pId = m.id || m.memberId;
                    if (pId) leagueMembersMap[pId] = { points: m.points || 0, rank: m.rank || 1, total: ranked.length, leagueType: data.type || 'winter' };
                });
            }
        });

        // 7. Match analysis
        const matchSnap = await getDocs(collection(db, 'match_analysis'));
        const memberMatchesCount: Record<string, number> = {};
        matchSnap.docs.forEach(d => {
            const mData = d.data();
            const mSeason = mData.stagione || (mData.date ? getStagioneFromDate(mData.date) : '');
            if (mSeason === stagione && Array.isArray(mData.players)) {
                mData.players.forEach((p: any) => {
                    const pId = p.memberId || p.id;
                    if (pId) memberMatchesCount[pId] = (memberMatchesCount[pId] || 0) + 1;
                });
            }
        });

        // 7b. Roster per tornei
        const rosterSnap = await getDocs(collection(db, 'roster'));
        const memberRosterEventsMap: Record<string, Map<string, string>> = {};
        rosterSnap.docs.forEach(d => {
            const rData = d.data();
            if (rData.memberId && rData.eventId) {
                if (!memberRosterEventsMap[rData.memberId]) memberRosterEventsMap[rData.memberId] = new Map();
                memberRosterEventsMap[rData.memberId].set(rData.eventId, rData.role || 'player');
            }
        });

        // 8. Media presenze squadra
        const activeMembersStats = Object.values(perMembro);
        const avgTeamPercentage = activeMembersStats.length > 0
            ? Math.round(activeMembersStats.reduce((acc, s) => acc + (s.percentualePresenza || 0), 0) / activeMembersStats.length * 10) / 10
            : 0;

        // 9. Team Wrapped
        const activatedAt = new Date().toISOString();
        const teamWrapped: TeamWrappedData = {
            stagione, activatedAt, allenamentiTotali, allenamentiCampo, allenamentiPalestra,
            presenzeTotaliSquadra, mediaPresenzePerAllenamento,
            nuoviMembriCount: nuoviMembriNomi.length, nuoviMembriNomi,
            kmTotaliPercorsi, tappeMappa,
            torneiTotali: seasonEvents.length, torneiNomi,
            eventiStagione: seasonEvents.map(e => ({
                id: e.id, title: e.title, date: e.date,
                endDate: e.endDate || '', location: e.location || '', type: e.type || 'tournament'
            })),
            recordPresenzeAllenamento: recordDate ? { date: recordDate, count: maxCount } : undefined
        };

        await setDoc(doc(db, 'wrapped', stagione), teamWrapped);
        await setDoc(doc(db, 'wrapped', `${stagione}_team`), teamWrapped);

        // 10. User Wrapped per membro
        let membersProcessed = 0;
        const allMemberIds = Array.from(new Set([...Object.keys(membersMap), ...Object.keys(perMembro)]));

        for (const mId of allMemberIds) {
            const memberObj = membersMap[mId];
            const stats = perMembro[mId] || { presenzeCampo: 0, presenzePalestra: 0, percentualePresenza: 0, streakMassima: 0, streakCampo: 0, streakPalestra: 0 };

            const presTot = (stats.presenzeCampo || 0) + (stats.presenzePalestra || 0);
            const perc = stats.percentualePresenza || 0;
            const diffSquadra = Math.round((perc - avgTeamPercentage) * 10) / 10;
            const streakMax = Math.max(stats.streakMassima || 0, stats.streakCampo || 0, stats.streakPalestra || 0);

            const tuttiEventi = seasonEvents.map(e => {
                const hasRoster = memberRosterEventsMap[mId]?.has(e.id);
                const inParticipants = Array.isArray(e.participants) && e.participants.some((p: any) =>
                    typeof p === 'string'
                        ? (p === mId || (memberObj && p === memberObj.firstName))
                        : (p?.id === mId || (memberObj && p?.name === memberObj.firstName))
                );
                const hasAttendance = memberAttendedDates[mId]?.has(e.date);
                const partecipato = Boolean(hasRoster || inParticipants || hasAttendance);
                const role = hasRoster ? memberRosterEventsMap[mId]?.get(e.id) : (partecipato ? 'player' : '');

                const evItem: any = {
                    id: e.id, title: e.title || '', date: e.date || '',
                    endDate: e.endDate || '', location: e.location || '',
                    type: e.type || 'tournament', partecipato
                };
                if (role) evItem.role = role;
                return evItem;
            });

            const evPartecipati = tuttiEventi.filter(e => e.partecipato);
            const leagueData = leagueMembersMap[mId];
            const partiteGiocate = memberMatchesCount[mId] || 0;

            let titolo = "Puro Spirito Bubba 🥏";
            let desc = "Sempre presente nel cuore della squadra!";

            if (perc >= 80) {
                titolo = "La Colonna Portante 🏛️";
                desc = `Hai risposto presente all'${perc}% degli allenamenti. Una certezza assoluta per la squadra!`;
            } else if (streakMax >= 10) {
                titolo = "L'Inarrestabile 🔥";
                desc = `Una striscia incredibile di ${streakMax} allenamenti consecutivi senza mai mollare!`;
            } else if (leagueData && leagueData.rank <= 3) {
                titolo = "Il Fuoriclasse 👑";
                desc = `Sul podio della League con ${leagueData.points} punti! Spettacolare!`;
            } else if (evPartecipati.length >= 3) {
                titolo = "Il Globetrotter 🌍";
                desc = `Non perdi un torneo: ${evPartecipati.length} trasferte ed eventi vissuti insieme!`;
            } else if (partiteGiocate >= 5) {
                titolo = "Il Guerriero del Campo ⚔️";
                desc = `Sempre in prima linea nelle sfide ufficiali con ${partiteGiocate} partite giocate!`;
            } else if (diffSquadra > 0) {
                titolo = "Presenza D'Oro ⭐";
                desc = `La tua percentuale di presenza supera del +${diffSquadra}% la media della squadra!`;
            }

            const userWrapped: UserWrappedData = {
                memberId: mId, stagione,
                memberName: memberNames[mId] || 'Bubba',
                nickname: memberObj?.nickname,
                photoUrl: (memberObj as any)?.photoUrl,
                presenzeTotali: presTot,
                presenzeCampo: stats.presenzeCampo || 0,
                presenzePalestra: stats.presenzePalestra || 0,
                percentualePresenza: perc,
                mediaSquadraPresenze: avgTeamPercentage,
                differenzaMediaSquadra: diffSquadra,
                streakMassima: streakMax,
                streakCampo: stats.streakCampo,
                streakPalestra: stats.streakPalestra,
                leaguePoints: leagueData?.points,
                leagueRank: leagueData?.rank,
                leagueTotalParticipants: leagueData?.total,
                leagueBadge: leagueData?.rank === 1 ? '🥇' : (leagueData?.rank === 2 ? '🥈' : (leagueData?.rank === 3 ? '🥉' : undefined)),
                leagueType: leagueData?.leagueType,
                eventiPartecipati: evPartecipati,
                totaleEventiPartecipati: evPartecipati.length,
                tuttiEventiStagione: tuttiEventi,
                partiteGiocate,
                titoloRiconoscimento: titolo,
                descrizioneTitolo: desc
            };

            await setDoc(doc(db, 'wrapped', stagione, 'members', mId), userWrapped);
            membersProcessed++;
        }

        console.log(`[Bubba Wrapped] Generazione completata con successo per ${membersProcessed} membri.`);
        return { team: teamWrapped, membersCount: membersProcessed };
    } catch (error) {
        console.error("Errore durante la generazione del Bubba Wrapped:", error);
        throw error;
    }
};

export const subscribeToUserWrapped = (
    stagione: string,
    userId: string,
    callback: (data: UserWrappedData | null) => void,
    userEmail?: string
): (() => void) => {
    const docRef = doc(db, 'wrapped', stagione, 'members', userId);
    let unsubscribeFallback: (() => void) | null = null;

    const unsubscribePrimary = onSnapshot(docRef, async (docSnap) => {
        if (docSnap.exists()) {
            callback(docSnap.data() as UserWrappedData);
            return;
        }

        if (userEmail) {
            try {
                const q = query(collection(db, 'indirizzario'), where('email', '==', userEmail.toLowerCase().trim()));
                const snap = await getDocs(q);
                if (!snap.empty) {
                    const resolvedMemberId = snap.docs[0].id;
                    if (resolvedMemberId !== userId) {
                        console.log(`[Wrapped] Fallback: trovato memberId=${resolvedMemberId} per email=${userEmail}`);
                        const fallbackRef = doc(db, 'wrapped', stagione, 'members', resolvedMemberId);
                        unsubscribeFallback = onSnapshot(fallbackRef, (fbSnap) => {
                            callback(fbSnap.exists() ? fbSnap.data() as UserWrappedData : null);
                        }, () => callback(null));
                        return;
                    }
                }
            } catch (err) {
                console.warn('[Wrapped] Fallback email lookup failed:', err);
            }
        }

        callback(null);
    }, (error) => {
        console.error("Error subscribing to user wrapped:", error);
        callback(null);
    });

    return () => {
        unsubscribePrimary();
        unsubscribeFallback?.();
    };
};

export const subscribeToTeamWrapped = (stagione: string, callback: (data: TeamWrappedData | null) => void) => {
    const docRef = doc(db, 'wrapped', `${stagione}_team`);
    return onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            callback(docSnap.data() as TeamWrappedData);
        } else {
            getDoc(doc(db, 'wrapped', stagione)).then(sSnap => {
                if (sSnap.exists()) callback(sSnap.data() as TeamWrappedData);
                else callback(null);
            }).catch(() => callback(null));
        }
    }, (error) => {
        console.error("Error subscribing to team wrapped:", error);
        callback(null);
    });
};

export const getAvailableWrappedSeasons = async (): Promise<string[]> => {
    try {
        const snap = await getDocs(collection(db, 'wrapped'));
        const seasons = snap.docs.map(d => d.id).filter(id => !id.startsWith('_') && !id.endsWith('_team'));
        seasons.sort((a, b) => b.localeCompare(a));
        return seasons;
    } catch (error) {
        console.error("Error getting available wrapped seasons:", error);
        return [];
    }
};

/**
 * Controlla se il Bubba Wrapped rientra nel periodo di attivazione (default 30 giorni)
 */
export const isWrappedWithinActivePeriod = (activatedAt?: string, daysLimit: number = 30): boolean => {
    if (!activatedAt) return true;
    const activationDate = new Date(activatedAt);
    if (isNaN(activationDate.getTime())) return true;
    const now = new Date();
    const diffMs = now.getTime() - activationDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return diffDays <= daysLimit;
};

/**
 * Segna il Wrapped come visualizzato per l'utente corrente
 */
export const markWrappedAsViewed = async (season: string, userId?: string): Promise<void> => {
    try {
        const storageKey = `bubba_wrapped_viewed_${season}_${userId || 'anonymous'}`;
        await AsyncStorage.setItem(storageKey, 'true');
        if (userId) {
            const userRef = doc(db, 'users', userId);
            await updateDoc(userRef, {
                [`viewedWrapped.${season}`]: new Date().toISOString()
            }).catch(() => {});
        }
    } catch (e) {
        console.warn("Could not mark wrapped as viewed:", e);
    }
};

/**
 * Verifica se l'utente ha già visualizzato il Wrapped per questa stagione
 */
export const isWrappedViewed = async (season: string, userId?: string): Promise<boolean> => {
    try {
        const storageKey = `bubba_wrapped_viewed_${season}_${userId || 'anonymous'}`;
        const stored = await AsyncStorage.getItem(storageKey);
        if (stored === 'true') return true;

        if (userId) {
            const userRef = doc(db, 'users', userId);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                const data = userSnap.data();
                if (data?.viewedWrapped && data.viewedWrapped[season]) {
                    await AsyncStorage.setItem(storageKey, 'true');
                    return true;
                }
            }
        }
        return false;
    } catch (e) {
        console.warn("Could not check if wrapped was viewed:", e);
        return false;
    }
};
