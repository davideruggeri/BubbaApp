const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, setDoc, getDoc } = require('firebase/firestore');

const firebaseConfig = {
    apiKey: "AIzaSyAk_DGuMw-Mh61b6v1RPl3qyBrE44chfEI",
    authDomain: "bubba-5f927.firebaseapp.com",
    projectId: "bubba-5f927",
    storageBucket: "bubba-5f927.firebasestorage.app",
    messagingSenderId: "624306533340",
    appId: "1:624306533340:web:4bdf6e95e7820ea8e5d519",
    measurementId: "G-72LP7H0W64"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function getStagioneFromDate(dateStr) {
    if (!dateStr) return '2025-2026';
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length >= 2) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        if (!isNaN(year) && !isNaN(month)) {
            return month >= 9 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
        }
    }
    return '2025-2026';
}

function calculateHaversineKm(lat1, lon1, lat2, lon2) {
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

async function run() {
    const stagione = '2025-2026';
    console.log(`[Bubba Wrapped] Calcolo per stagione ${stagione}...`);

    // 1. Presenze History
    const histSnap = await getDoc(doc(db, 'presenze_history', stagione));
    if (!histSnap.exists()) {
        console.error("Presenze history non trovata per:", stagione);
        return;
    }
    const historyEntry = histSnap.data();
    const perMembro = historyEntry.perMembro || {};
    const allenamentiCampo = historyEntry.numeroAllenamentiCampo || 0;
    const allenamentiPalestra = historyEntry.numeroAllenamentiPalestra || 0;
    const allenamentiTotali = allenamentiCampo + allenamentiPalestra;
    const totPresCampo = historyEntry.totalePresenzeCampo || 0;
    const totPresPalestra = historyEntry.totalePresenzePalestra || 0;
    const presenzeTotaliSquadra = totPresCampo + totPresPalestra;
    const mediaPresenzePerAllenamento = allenamentiTotali > 0
        ? Math.round((presenzeTotaliSquadra / allenamentiTotali) * 10) / 10
        : 0;

    // 2. Membri
    const membersSnap = await getDocs(collection(db, 'indirizzario'));
    const membersMap = {};
    const memberNames = {};
    membersSnap.docs.forEach(d => {
        const m = { id: d.id, ...d.data() };
        membersMap[d.id] = m;
        memberNames[d.id] = m.nickname || `${m.firstName} ${m.lastName || ''}`.trim();
    });

    // 3. Nuovi membri
    const seasonStart = new Date(2025, 8, 1);
    const seasonEnd = new Date(2026, 7, 31, 23, 59, 59);
    const nuoviMembriNomi = [];
    membersSnap.docs.forEach(d => {
        const data = d.data();
        const joinDate = data.createdAt ? new Date(data.createdAt) : (data.dataTesseramento ? new Date(data.dataTesseramento) : null);
        if (joinDate && joinDate >= seasonStart && joinDate <= seasonEnd) {
            nuoviMembriNomi.push(data.nickname || `${data.firstName} ${data.lastName || ''}`.trim());
        }
    });

    // 4. Calendario & Presenze
    const calSnap = await getDocs(collection(db, 'calendario'));
    const seasonEvents = [];
    const singleSessionCounts = {};
    let legacyOspitiCampo = 0;
    let legacyOspitiPalestra = 0;

    calSnap.docs.forEach(d => {
        const data = d.data();
        const dDate = data.date || d.id;
        const dSeason = data.stagione || getStagioneFromDate(dDate);
        if (dSeason === stagione) {
            const ev = { id: d.id, ...data, date: dDate, stagione: dSeason };
            if (ev.type !== 'Campo' && ev.type !== 'Palestra' && ev.type !== 'training') {
                seasonEvents.push(ev);
            } else {
                const guestCount = Array.isArray(data.guests) ? data.guests.length : 0;
                if (guestCount > 0) {
                    singleSessionCounts[dDate] = (singleSessionCounts[dDate] || 0) + guestCount;
                    if (data.type === 'Palestra') {
                        legacyOspitiPalestra += guestCount;
                    } else {
                        legacyOspitiCampo += guestCount;
                    }
                }
            }
        }
    });
    seasonEvents.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    // Ricalcola presenze totali considerando anche gli ospiti
    const ospitiGiaInclusi = historyEntry.totaleOspiti !== undefined;
    const effPresCampo = (historyEntry.totalePresenzeCampo || 0) + (ospitiGiaInclusi ? 0 : legacyOspitiCampo);
    const effPresPalestra = (historyEntry.totalePresenzePalestra || 0) + (ospitiGiaInclusi ? 0 : legacyOspitiPalestra);
    const effPresenzeTotaliSquadra = effPresCampo + effPresPalestra;
    const effMediaPresenzePerAllenamento = allenamentiTotali > 0
        ? Math.round((effPresenzeTotaliSquadra / allenamentiTotali) * 10) / 10
        : 0;

    const presenzeSnap = await getDocs(collection(db, 'presenze'));
    const memberAttendedDates = {};
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

    let maxCount = 0;
    let recordDate = '';
    Object.entries(singleSessionCounts).forEach(([date, count]) => {
        if (count > maxCount) {
            maxCount = count;
            recordDate = date;
        }
    });

    // 5. World Locations
    const HOME_LAT = 44.4949;
    const HOME_LON = 11.3426;
    let kmTotaliPercorsi = 0;
    const tappeMappa = [];

    const locSnap = await getDocs(collection(db, 'world_locations'));
    locSnap.docs.forEach(d => {
        const loc = d.data();
        const locDate = loc.date;
        const locSeason = locDate ? getStagioneFromDate(locDate) : stagione;
        if (locSeason === stagione && loc.latitude && loc.longitude) {
            const dist = calculateHaversineKm(HOME_LAT, HOME_LON, loc.latitude, loc.longitude);
            kmTotaliPercorsi += dist * 2;
            tappeMappa.push({
                locationName: loc.locationName || loc.title || 'Tappa',
                title: loc.title || loc.locationName || '',
                date: locDate
            });
        }
    });

    seasonEvents.forEach(ev => {
        if (ev.latitude && ev.longitude) {
            const dist = calculateHaversineKm(HOME_LAT, HOME_LON, ev.latitude, ev.longitude);
            kmTotaliPercorsi += dist * 2;
            if (!tappeMappa.some(t => t.locationName === (ev.location || ev.title))) {
                tappeMappa.push({
                    locationName: ev.location || ev.title,
                    title: ev.title,
                    date: ev.date
                });
            }
        }
    });

    if (kmTotaliPercorsi === 0) {
        // Stima simbolica se non ci sono ancora coordinate nel db
        kmTotaliPercorsi = 840;
    }

    const torneiNomi = seasonEvents.map(e => e.title);

    // 6. Dati League
    const leagueHistorySnap = await getDocs(collection(db, 'league_history'));
    const leagueMembersMap = {};
    leagueHistorySnap.docs.forEach(d => {
        const data = d.data();
        const lSeason = data.season || data.stagione || (d.id.includes('2026') ? '2025-2026' : (d.id.includes('2025') ? '2024-2025' : (data.dates?.startDate ? getStagioneFromDate(data.dates.startDate) : (data.startDate ? getStagioneFromDate(data.startDate) : ''))));
        if (lSeason === stagione) {
            const list = Array.isArray(data.standings) ? data.standings : (Array.isArray(data.members) ? data.members : []);
            const sorted = [...list].sort((a, b) => (b.points || 0) - (a.points || 0));
            let currentRank = 1;
            sorted.forEach((m, idx) => {
                if (idx > 0 && (m.points || 0) < (sorted[idx - 1].points || 0)) {
                    currentRank = idx + 1;
                }
                const pId = m.id || m.memberId;
                if (pId) {
                    leagueMembersMap[pId] = {
                        points: m.points || 0,
                        rank: m.rank || currentRank,
                        total: sorted.length,
                        leagueType: data.type || 'winter'
                    };
                }
            });
        }
    });

    // 6b. Roster per tornei della stagione
    const rosterSnap = await getDocs(collection(db, 'roster'));
    const memberRosterEventsMap = {};
    rosterSnap.docs.forEach(d => {
        const rData = d.data();
        if (rData.memberId && rData.eventId) {
            if (!memberRosterEventsMap[rData.memberId]) memberRosterEventsMap[rData.memberId] = {};
            memberRosterEventsMap[rData.memberId][rData.eventId] = rData.role || 'player';
        }
    });

    // 7. Media squadra
    const activeMembersStats = Object.values(perMembro);
    const avgTeamPercentage = activeMembersStats.length > 0
        ? Math.round(activeMembersStats.reduce((acc, s) => acc + (s.percentualePresenza || 0), 0) / activeMembersStats.length * 10) / 10
        : 0;

    // 8. Salva Team Data
    const teamWrapped = {
        stagione,
        allenamentiTotali,
        allenamentiCampo,
        allenamentiPalestra,
        presenzeTotaliSquadra: effPresenzeTotaliSquadra,
        mediaPresenzePerAllenamento: effMediaPresenzePerAllenamento,
        nuoviMembriCount: nuoviMembriNomi.length,
        nuoviMembriNomi,
        kmTotaliPercorsi,
        tappeMappa,
        torneiTotali: seasonEvents.length,
        torneiNomi,
        eventiStagione: seasonEvents.map(e => ({
            id: e.id,
            title: e.title,
            date: e.date,
            endDate: e.endDate || '',
            location: e.location || '',
            type: e.type || 'tournament'
        })),
        recordPresenzeAllenamento: recordDate ? { date: recordDate, count: maxCount } : null
    };

    await setDoc(doc(db, 'wrapped', `${stagione}_team`), teamWrapped);
    await setDoc(doc(db, 'wrapped', stagione), teamWrapped);
    console.log(`Team Wrapped salvato per stagione ${stagione}.`);

    // 9. Salva User Data per ciascun membro
    let count = 0;
    for (const [mId, stats] of Object.entries(perMembro)) {
        const memberObj = membersMap[mId];
        const nomeGiocatore = memberNames[mId] || 'Bubba';

        const presTot = (stats.presenzeCampo || 0) + (stats.presenzePalestra || 0);
        const perc = stats.percentualePresenza || 0;
        const diffSquadra = Math.round((perc - avgTeamPercentage) * 10) / 10;
        const streakMax = Math.max(stats.streakMassima || 0, stats.streakCampo || 0, stats.streakPalestra || 0);

        // Mappa tutti gli eventi della stagione indicando la partecipazione del giocatore
        const tuttiEventi = seasonEvents.map(e => {
            const hasRoster = memberRosterEventsMap[mId] && memberRosterEventsMap[mId][e.id];
            const inParticipants = Array.isArray(e.participants) && e.participants.some((p) =>
                typeof p === 'string'
                    ? (p === mId || (memberObj && p === memberObj.firstName))
                    : (p?.id === mId || (memberObj && p?.name === memberObj.firstName))
            );
            const hasAttendance = memberAttendedDates[mId]?.has(e.date);
            const partecipato = Boolean(hasRoster || inParticipants || hasAttendance);
            const role = hasRoster ? memberRosterEventsMap[mId][e.id] : (partecipato ? 'player' : '');

            const evItem = {
                id: e.id,
                title: e.title || '',
                date: e.date || '',
                endDate: e.endDate || '',
                location: e.location || '',
                type: e.type || 'tournament',
                partecipato
            };
            if (role) {
                evItem.role = role;
            }
            return evItem;
        });

        const evPartecipati = tuttiEventi.filter(e => e.partecipato);

        const leagueData = leagueMembersMap[mId];

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
        } else if (diffSquadra > 0) {
            titolo = "Presenza D'Oro ⭐";
            desc = `La tua percentuale di presenza supera del +${diffSquadra}% la media della squadra!`;
        }

        const userWrapped = {
            memberId: mId,
            stagione,
            memberName: memberNames[mId] || 'Bubba',
            nickname: memberObj?.nickname || '',
            presenzeTotali: presTot,
            presenzeCampo: stats.presenzeCampo || 0,
            presenzePalestra: stats.presenzePalestra || 0,
            percentualePresenza: perc,
            mediaSquadraPresenze: avgTeamPercentage,
            differenzaMediaSquadra: diffSquadra,
            streakMassima: streakMax,
            streakCampo: stats.streakCampo || 0,
            streakPalestra: stats.streakPalestra || 0,
            leaguePoints: leagueData?.points || 0,
            leagueRank: leagueData?.rank || 0,
            leagueTotalParticipants: leagueData?.total || 0,
            leagueBadge: leagueData?.rank === 1 ? '🥇' : (leagueData?.rank === 2 ? '🥈' : (leagueData?.rank === 3 ? '🥉' : '')),
            leagueType: leagueData?.leagueType || '',
            eventiPartecipati: evPartecipati,
            totaleEventiPartecipati: evPartecipati.length,
            tuttiEventiStagione: tuttiEventi,
            partiteGiocate: 0,
            titoloRiconoscimento: titolo,
            descrizioneTitolo: desc
        };

        await setDoc(doc(db, 'wrapped', stagione, 'members', mId), userWrapped);
        count++;
    }

    console.log(`[Bubba Wrapped] Generato con successo per ${count} membri!`);
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
