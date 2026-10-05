// utils/matchImporter.ts
// Importatore partite da Backup JSON ed Excel (.xlsx) di StatistichePartita
import * as XLSX from 'xlsx';
import { MatchAnalysis, MatchEvent, MatchRosterPlayer } from '../services/firestore/types';
import { Member } from '../services/firestore/types';
import { derive } from './statsEngine';

export interface ImportedMatchResult {
    opponent: string;
    date: string;
    pullFirst: 'us' | 'them';
    firstRatio: 'M' | 'F';
    dir0: 'R' | 'L';
    events: MatchEvent[];
    ourScore: number;
    theirScore: number;
    status: 'scheduled' | 'live' | 'completed';
    customRoster: MatchRosterPlayer[];
}

export interface RawImportedPlayer {
    name: string;
    gender: 'M' | 'F';
    suggestedMemberId?: string;
}

// Trova o mappa l'id del giocatore dal nome (tenendo conto della mappatura manuale utente se presente)
function findOrMapPlayer(
    name: string,
    gender: 'M' | 'F',
    members: Member[],
    rosterMap: Map<string, MatchRosterPlayer>,
    customMapping?: Record<string, string>
): string {
    const cleanName = (name || '').trim();
    if (!cleanName || cleanName === '?') return 'unknown';

    const cleanLower = cleanName.toLowerCase();

    // 1. Controlla se l'utente ha fornito una mappatura esplicita per questo nome
    if (customMapping && customMapping[cleanLower]) {
        const mappedChoice = customMapping[cleanLower];
        if (mappedChoice !== 'guest' && !mappedChoice.startsWith('guest_')) {
            const member = members.find(m => m.id === mappedChoice);
            if (member) {
                if (!rosterMap.has(member.id)) {
                    rosterMap.set(member.id, {
                        id: member.id,
                        name: member.nickname || member.firstName,
                        g: member.gender === 'F' ? 'F' : 'M'
                    });
                }
                return member.id;
            }
        }
    }

    // 2. Cerca corrispondenza esatta nei membri esistenti
    const member = members.find(m => {
        const nick = (m.nickname || '').trim().toLowerCase();
        const first = (m.firstName || '').trim().toLowerCase();
        const full = `${first} ${(m.lastName || '').trim().toLowerCase()}`;
        return nick === cleanLower || first === cleanLower || full === cleanLower;
    });

    if (member) {
        if (!rosterMap.has(member.id)) {
            rosterMap.set(member.id, {
                id: member.id,
                name: member.nickname || member.firstName,
                g: member.gender === 'F' ? 'F' : 'M'
            });
        }
        return member.id;
    }

    // 3. Altrimenti cerca o inserisci nel customRoster come ospite/giocatore importato
    for (const [id, r] of rosterMap.entries()) {
        if (r.name.toLowerCase() === cleanLower) {
            return id;
        }
    }

    const newId = `imported_${cleanLower.replace(/\s+/g, '_')}_${Math.random().toString(36).slice(2, 6)}`;
    rosterMap.set(newId, {
        id: newId,
        name: cleanName,
        g: gender
    });
    return newId;
}

// Estrae la lista dei giocatori presenti nel file (prima di salvarli) per consentire la mappatura all'utente
export function extractImportedPlayers(
    content: string | ArrayBuffer | Uint8Array,
    isJson: boolean,
    members: Member[]
): RawImportedPlayer[] {
    const playerMap = new Map<string, { name: string; gender: 'M' | 'F' }>();

    if (isJson) {
        try {
            const data = JSON.parse(typeof content === 'string' ? content : new TextDecoder().decode(content));
            const roster: { name: string; g: 'M' | 'F' }[] = data.roster || [];
            const removed: { name: string; g: 'M' | 'F' }[] = data.removed || [];
            for (const p of [...roster, ...removed]) {
                if (p.name && p.name.trim()) {
                    playerMap.set(p.name.trim().toLowerCase(), {
                        name: p.name.trim(),
                        gender: p.g === 'F' ? 'F' : 'M'
                    });
                }
            }

            // Ispeziona anche partite e roster personalizzati interni
            const games = data.games || (Array.isArray(data) ? data : []);
            for (const g of games) {
                const gRoster = g.customRoster || g.roster || [];
                for (const p of gRoster) {
                    if (p.name && p.name.trim()) {
                        playerMap.set(p.name.trim().toLowerCase(), {
                            name: p.name.trim(),
                            gender: p.g === 'F' ? 'F' : 'M'
                        });
                    }
                }
            }
        } catch (e) {
            console.warn("Impossibile estrarre roster da JSON:", e);
        }
    } else {
        try {
            const workbook = XLSX.read(content, { type: 'array' });
            const playersSheet = workbook.Sheets['Giocatori'];
            if (playersSheet) {
                const playerRows: any[] = XLSX.utils.sheet_to_json(playersSheet);
                for (const pr of playerRows) {
                    const name = (pr['Giocatore'] || pr['Nome'] || '').trim();
                    const g = pr['Sesso'] === 'F' ? 'F' : 'M';
                    if (name) {
                        playerMap.set(name.toLowerCase(), { name, gender: g });
                    }
                }
            }

            const eventsSheet = workbook.Sheets['Eventi'];
            if (eventsSheet) {
                const eventRows: any[] = XLSX.utils.sheet_to_json(eventsSheet);
                for (const r of eventRows) {
                    const p1 = (r['Giocatore'] || '').trim();
                    const p2 = (r['Assist'] || '').trim();
                    if (p1 && !playerMap.has(p1.toLowerCase())) playerMap.set(p1.toLowerCase(), { name: p1, gender: 'M' });
                    if (p2 && !playerMap.has(p2.toLowerCase())) playerMap.set(p2.toLowerCase(), { name: p2, gender: 'M' });
                }
            }

            // Estrai lanciatori pull dal foglio 'Pull'
            const pullSheet = workbook.Sheets['Pull'];
            if (pullSheet) {
                const pullRows: any[] = XLSX.utils.sheet_to_json(pullSheet);
                for (const r of pullRows) {
                    const pName = (r['Lanciatore'] || r['Giocatore'] || r['Puller'] || '').trim();
                    if (pName && !playerMap.has(pName.toLowerCase())) {
                        playerMap.set(pName.toLowerCase(), { name: pName, gender: 'M' });
                    }
                }
            }

            // Estrai giocatori dalle intestazioni colonne del foglio 'Linee'
            const linesSheet = workbook.Sheets['Linee'];
            if (linesSheet) {
                const lineRows: any[] = XLSX.utils.sheet_to_json(linesSheet);
                for (const lr of lineRows) {
                    for (const key of Object.keys(lr)) {
                        if (['Partita', 'Punto', 'Inizio', 'Esito', 'Tipo', 'Punteggio', 'F', 'M', 'Linea', 'TO nostri', 'TO loro', 'Durata (s)'].includes(key)) continue;
                        const pName = key.trim();
                        if (pName && !playerMap.has(pName.toLowerCase())) {
                            playerMap.set(pName.toLowerCase(), { name: pName, gender: 'M' });
                        }
                    }
                }
            }
        } catch (e) {
            console.warn("Impossibile estrarre roster da XLSX:", e);
        }
    }

    const result: RawImportedPlayer[] = [];
    for (const item of playerMap.values()) {
        const cleanLower = item.name.toLowerCase();
        // Trova suggerimento nei membri
        const matched = members.find(m => {
            const nick = (m.nickname || '').trim().toLowerCase();
            const first = (m.firstName || '').trim().toLowerCase();
            const full = `${first} ${(m.lastName || '').trim().toLowerCase()}`;
            return nick === cleanLower || first === cleanLower || full === cleanLower;
        });

        result.push({
            name: item.name,
            gender: matched?.gender ? (matched.gender === 'F' ? 'F' : 'M') : item.gender,
            suggestedMemberId: matched?.id
        });
    }

    result.sort((a, b) => (a.gender === 'F' ? 0 : 1) - (b.gender === 'F' ? 0 : 1) || a.name.localeCompare(b.name));
    return result;
}

// 1. IMPORT DA FILE BACKUP JSON (bubbaStats.v1)
export function parseJSONBackup(
    jsonString: string,
    members: Member[],
    customMapping?: Record<string, string>
): ImportedMatchResult[] {
    const data = JSON.parse(jsonString);
    const games = data.games || (Array.isArray(data) ? data : []);
    const originalRoster: { id: string; name: string; g: 'M' | 'F' }[] = data.roster || [];
    const removedRoster: { id: string; name: string; g: 'M' | 'F' }[] = data.removed || [];
    const allOriginal = [...originalRoster, ...removedRoster];

    const results: ImportedMatchResult[] = [];

    for (const g of games) {
        const rosterMap = new Map<string, MatchRosterPlayer>();
        const idMapping = new Map<string, string>(); // vecchio ID -> nuovo ID

        // Mappa i giocatori presenti nel roster originale
        for (const p of allOriginal) {
            const mappedId = findOrMapPlayer(p.name, p.g, members, rosterMap, customMapping);
            idMapping.set(p.id, mappedId);
        }

        const events: MatchEvent[] = (g.events || []).map((e: any) => {
            const mapped: MatchEvent = { ...e };
            if (e.p) mapped.p = idMapping.get(e.p) || e.p;
            if (e.s) mapped.s = idMapping.get(e.s) || e.s;
            if (e.a) mapped.a = idMapping.get(e.a) || e.a;
            if (e.line && Array.isArray(e.line)) {
                mapped.line = e.line.map((id: string) => idMapping.get(id) || id);
            }
            if (e.x != null && e.x !== '') {
                const xVal = typeof e.x === 'number' ? e.x : parseFloat(String(e.x).replace(',', '.'));
                if (!isNaN(xVal)) mapped.x = xVal;
            }
            if (e.y != null && e.y !== '') {
                const yVal = typeof e.y === 'number' ? e.y : parseFloat(String(e.y).replace(',', '.'));
                if (!isNaN(yVal)) mapped.y = yVal;
            }
            if (e.k === 'pull') {
                if (!mapped.team && (e.squadra || e.side)) {
                    const sq = String(e.squadra || e.side).toLowerCase();
                    mapped.team = (sq.includes('noi') || sq.includes('us')) ? 'us' : 'them';
                }
                if (!mapped.p && (e.puller || e.player || e.giocatore)) {
                    const rawP = e.puller || e.player || e.giocatore;
                    mapped.p = idMapping.get(rawP) || rawP;
                }
            }
            return mapped;
        });

        // Arricchisci pull da array separato g.pulls o g.points se presente
        if (Array.isArray(g.pulls)) {
            let pullIdx = 0;
            for (let i = 0; i < events.length; i++) {
                if (events[i].k === 'pull') {
                    const pData = g.pulls[pullIdx++];
                    if (pData) {
                        if (events[i].x == null && pData.x != null) events[i].x = Number(pData.x);
                        if (events[i].y == null && pData.y != null) events[i].y = Number(pData.y);
                        if (!events[i].p && pData.p) events[i].p = idMapping.get(pData.p) || pData.p;
                        if (!events[i].team && pData.team) events[i].team = pData.team;
                    }
                }
            }
        } else if (Array.isArray(g.points)) {
            let ptIdx = 0;
            for (let i = 0; i < events.length; i++) {
                if (events[i].k === 'pull') {
                    const ptData = g.points[ptIdx++];
                    if (ptData && ptData.pull) {
                        const pl = ptData.pull;
                        if (events[i].x == null && pl.x != null) events[i].x = Number(pl.x);
                        if (events[i].y == null && pl.y != null) events[i].y = Number(pl.y);
                        if (!events[i].p && pl.p) events[i].p = idMapping.get(pl.p) || pl.p;
                        if (!events[i].team && pl.team) events[i].team = pl.team;
                    }
                }
            }
        }

        const derived = derive({ pullFirst: g.pullFirst, events });
        const ourScore = derived.score.us;
        const theirScore = derived.score.them;

        results.push({
            opponent: g.opp || 'Avversario',
            date: g.date || new Date().toISOString().split('T')[0],
            pullFirst: g.pullFirst || 'us',
            firstRatio: g.firstRatio || 'F',
            dir0: g.dir0 || 'R',
            events,
            ourScore,
            theirScore,
            status: g.done ? 'completed' : 'live',
            customRoster: Array.from(rosterMap.values())
        });
    }

    return results;
}

// 2. IMPORT DA FILE EXCEL (.xlsx)
export function parseXLSXFile(
    fileBuffer: ArrayBuffer | Uint8Array,
    members: Member[],
    customMapping?: Record<string, string>
): ImportedMatchResult[] {
    const workbook = XLSX.read(fileBuffer, { type: 'array' });
    const sheetNames = workbook.SheetNames;

    // Se esiste il foglio 'Eventi' e 'Squadra', leggiamo da lì
    if (sheetNames.includes('Eventi')) {
        return parseFromEventSheet(workbook, members, customMapping);
    }

    // Altrimenti prova a interpretare fogli "vs ..."
    const vsSheets = sheetNames.filter(s => s.toLowerCase().startsWith('vs '));
    if (vsSheets.length > 0) {
        return parseFromScoutSheets(workbook, vsSheets, members);
    }

    throw new Error("Il file Excel non contiene i fogli 'Eventi' o 'vs <avversario>' compatibili con StatistichePartita.");
}

function parseFromEventSheet(
    workbook: XLSX.WorkBook,
    members: Member[],
    customMapping?: Record<string, string>
): ImportedMatchResult[] {
    const eventsSheet = workbook.Sheets['Eventi'];
    const teamSheet = workbook.Sheets['Squadra'];
    const linesSheet = workbook.Sheets['Linee'];
    const playersSheet = workbook.Sheets['Giocatori'];
    const pullSheet = workbook.Sheets['Pull'];

    const eventRows: any[] = XLSX.utils.sheet_to_json(eventsSheet);
    const teamRows: any[] = teamSheet ? XLSX.utils.sheet_to_json(teamSheet) : [];
    const lineRows: any[] = linesSheet ? XLSX.utils.sheet_to_json(linesSheet) : [];
    const playerRows: any[] = playersSheet ? XLSX.utils.sheet_to_json(playersSheet) : [];
    const pullRows: any[] = pullSheet ? XLSX.utils.sheet_to_json(pullSheet) : [];

    const rosterMap = new Map<string, MatchRosterPlayer>();
    const nameToGender = new Map<string, 'M' | 'F'>();
    for (const pr of playerRows) {
        const name = (pr['Giocatore'] || pr['Nome'] || '').trim();
        const g = pr['Sesso'] === 'F' ? 'F' : 'M';
        if (name) nameToGender.set(name, g);
    }

    // Estrai tutti i pull registrati nel foglio Pull
    interface ParsedPull {
        game: string;
        point: number;
        team: 'us' | 'them';
        pullerName: string | null;
        x: number | null;
        y: number | null;
    }

    const pullsByGameAndPoint = new Map<string, ParsedPull>();
    const pullsByPointOnly = new Map<number, ParsedPull>();

    for (const pr of pullRows) {
        let game = '';
        for (const k of Object.keys(pr)) {
            if (/^(partita|match|opp)/i.test(k)) {
                game = String(pr[k] || '').trim();
                break;
            }
        }
        let point = 0;
        for (const k of Object.keys(pr)) {
            if (/^(punto|point|pt)/i.test(k)) {
                point = Number(pr[k]) || 0;
                break;
            }
        }
        let team: 'us' | 'them' = 'us';
        for (const k of Object.keys(pr)) {
            if (/^(squadra|team)/i.test(k)) {
                const s = String(pr[k] || '').trim().toLowerCase();
                team = (s.includes('noi') || s.includes('us') || s.includes('nostr')) ? 'us' : 'them';
                break;
            }
        }
        let pullerName = '';
        for (const k of Object.keys(pr)) {
            if (/^(lanciatore|puller|giocatore|player)/i.test(k)) {
                pullerName = String(pr[k] || '').trim();
                break;
            }
        }
        let xVal: number | null = null;
        let yVal: number | null = null;
        for (const k of Object.keys(pr)) {
            const lk = k.trim().toLowerCase();
            if (lk.startsWith('x')) {
                const raw = pr[k];
                if (raw != null && raw !== '') {
                    const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(',', '.'));
                    if (!isNaN(n)) xVal = n;
                }
            } else if (lk.startsWith('y')) {
                const raw = pr[k];
                if (raw != null && raw !== '') {
                    const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(',', '.'));
                    if (!isNaN(n)) yVal = n;
                }
            }
        }

        const parsed: ParsedPull = {
            game,
            point,
            team,
            pullerName: pullerName || null,
            x: xVal,
            y: yVal
        };

        if (point > 0) {
            if (game) {
                pullsByGameAndPoint.set(`${game.toLowerCase()}_${point}`, parsed);
            }
            pullsByPointOnly.set(point, parsed);
        }
    }

    // Raggruppa eventi per 'Partita'
    const gamesByOpp = new Map<string, any[]>();
    for (const row of eventRows) {
        const opp = row['Partita'] || 'Partita';
        if (!gamesByOpp.has(opp)) gamesByOpp.set(opp, []);
        gamesByOpp.get(opp)!.push(row);
    }

    const results: ImportedMatchResult[] = [];

    for (const [opp, rows] of gamesByOpp.entries()) {
        const teamInfo = teamRows.find(tr => tr['Partita'] === opp) || {};
        const date = teamInfo['Data'] || new Date().toISOString().split('T')[0];

        // Linee di questa partita
        const gameLineRows = lineRows.filter(lr => lr['Partita'] === opp);
        const linesByPoint = new Map<number, string[]>();

        for (const lr of gameLineRows) {
            const ptNum = Number(lr['Punto']);
            const linePlayerIds: string[] = [];
            for (const key of Object.keys(lr)) {
                if (['Partita', 'Punto', 'Inizio', 'Esito'].includes(key)) continue;
                if (lr[key] === 'O' || lr[key] === 'D' || lr[key] === 'X') {
                    const pName = key.trim();
                    const g = nameToGender.get(pName) || 'M';
                    const pid = findOrMapPlayer(pName, g, members, rosterMap, customMapping);
                    linePlayerIds.push(pid);
                }
            }
            if (linePlayerIds.length > 0) {
                linesByPoint.set(ptNum, linePlayerIds);
            }
        }

        const oppLower = opp.toLowerCase();
        const getPullForPoint = (ptNum: number) => {
            return pullsByGameAndPoint.get(`${oppLower}_${ptNum}`) || pullsByPointOnly.get(ptNum);
        };

        const events: MatchEvent[] = [];
        let currentPt = 0;
        let pullFirst: 'us' | 'them' = 'us';
        const pointsWithPull = new Set<number>();

        // Determina pullFirst se indicato nel foglio Squadra
        if (teamInfo['Pull'] || teamInfo['Pull iniziale'] || teamInfo['Primo pull']) {
            const pFirstRaw = String(teamInfo['Pull'] || teamInfo['Pull iniziale'] || teamInfo['Primo pull']).toLowerCase();
            pullFirst = (pFirstRaw.includes('noi') || pFirstRaw.includes('us') || pFirstRaw.includes('nostr')) ? 'us' : 'them';
        }

        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            const pt = Number(r['Punto']) || currentPt;
            const evName = (r['Evento'] || '').trim().toLowerCase();
            const playerName = (r['Giocatore'] || '').trim();
            const assistName = (r['Assist'] || '').trim();
            const desc = (r['Descrizione'] || '').trim();
            let x = r['x (m dalla nostra linea di fondo)'] != null && r['x (m dalla nostra linea di fondo)'] !== ''
                ? Number(r['x (m dalla nostra linea di fondo)'])
                : null;
            let y = r['y (m)'] != null && r['y (m)'] !== '' ? Number(r['y (m)']) : null;

            let pid = playerName ? findOrMapPlayer(playerName, nameToGender.get(playerName) || 'M', members, rosterMap, customMapping) : null;
            const aid = assistName ? findOrMapPlayer(assistName, nameToGender.get(assistName) || 'M', members, rosterMap, customMapping) : null;

            if (evName.includes('inizio punto') || pt > currentPt) {
                // Se il punto precedente non ha avuto un evento pull in Eventi ma è presente nel foglio Pull, inseriscilo
                if (currentPt > 0 && !pointsWithPull.has(currentPt)) {
                    const prevPull = getPullForPoint(currentPt);
                    if (prevPull) {
                        const pullPid = prevPull.pullerName ? findOrMapPlayer(prevPull.pullerName, nameToGender.get(prevPull.pullerName) || 'M', members, rosterMap, customMapping) : null;
                        events.push({
                            k: 'pull',
                            team: prevPull.team,
                            p: pullPid,
                            x: prevPull.x,
                            y: prevPull.y,
                            t: Date.now() + i * 1000 - 500
                        });
                        pointsWithPull.add(currentPt);
                    }
                }

                currentPt = pt;
                const isOffense = desc.toLowerCase().includes('attacco');
                if (pt === 1 && !teamInfo['Pull']) {
                    const p1Pull = getPullForPoint(1);
                    if (p1Pull) {
                        pullFirst = p1Pull.team === 'us' ? 'us' : 'them';
                    } else {
                        pullFirst = isOffense ? 'them' : 'us';
                    }
                }
                const ptLine = linesByPoint.get(pt) || [];
                events.push({
                    k: 'start',
                    o: isOffense,
                    line: ptLine,
                    t: Date.now() + i * 1000
                });
            }

            if (evName === 'pull') {
                const pullData = getPullForPoint(pt);
                let isOur = pullData ? (pullData.team === 'us') : desc.toLowerCase().includes('nostro');
                if (!pid && pullData && pullData.pullerName) {
                    pid = findOrMapPlayer(pullData.pullerName, nameToGender.get(pullData.pullerName) || 'M', members, rosterMap, customMapping);
                }
                if (!pid && desc) {
                    const pMatch = desc.match(/pull\s+(?:nostro|loro)\s*\(([^)=]+)\)/i);
                    if (pMatch) {
                        const pName = pMatch[1].trim();
                        pid = findOrMapPlayer(pName, nameToGender.get(pName) || 'M', members, rosterMap, customMapping);
                    }
                }

                if (x == null && pullData && pullData.x != null) {
                    x = pullData.x;
                }
                if (y == null && pullData && pullData.y != null) {
                    y = pullData.y;
                }

                if ((x == null || y == null) && desc) {
                    const xMatch = desc.match(/\bx\s*[:=]\s*(-?\d+(?:[.,]\d+)?)/i);
                    const yMatch = desc.match(/\by\s*[:=]\s*(-?\d+(?:[.,]\d+)?)/i);
                    if (xMatch && x == null) x = parseFloat(xMatch[1].replace(',', '.'));
                    if (yMatch && y == null) y = parseFloat(yMatch[1].replace(',', '.'));
                }

                events.push({
                    k: 'pull',
                    team: isOur ? 'us' : 'them',
                    p: pid,
                    x,
                    y,
                    t: Date.now() + i * 1000
                });
                pointsWithPull.add(pt);
            } else if (evName === 'meta') {
                events.push({
                    k: 'goal',
                    s: pid || undefined,
                    a: aid,
                    t: Date.now() + i * 1000
                });
            } else if (evName === 'callahan') {
                events.push({
                    k: 'call',
                    p: pid,
                    x,
                    y,
                    t: Date.now() + i * 1000
                });
            } else if (evName.includes('to lancio')) {
                events.push({ k: 'tt', p: pid, x, y, t: Date.now() + i * 1000 });
            } else if (evName.includes('to presa')) {
                events.push({ k: 'td', p: pid, x, y, t: Date.now() + i * 1000 });
            } else if (evName.includes('stall')) {
                events.push({ k: 'ts', p: pid, x, y, t: Date.now() + i * 1000 });
            } else if (evName.includes('to altro') || evName === 'to') {
                events.push({ k: 'tx', x, y, t: Date.now() + i * 1000 });
            } else if (evName === 'difesa') {
                events.push({ k: 'd', p: pid, x, y, t: Date.now() + i * 1000 });
            } else if (evName.includes('errore loro')) {
                events.push({ k: 'err', x, y, t: Date.now() + i * 1000 });
            } else if (evName.includes('meta loro')) {
                events.push({ k: 'tg', t: Date.now() + i * 1000 });
            } else if (evName.includes('cambio linea')) {
                events.push({ k: 'line', line: linesByPoint.get(pt) || [], t: Date.now() + i * 1000 });
            } else if (evName.includes('schema difesa')) {
                const schema = desc.replace(/difesa:\s*/i, '').trim();
                events.push({ k: 'dset', v: schema, t: Date.now() + i * 1000 });
            }
        }

        // Controllo se l'ultimo punto della partita era rimasto senza evento pull ma presente nel foglio Pull
        if (currentPt > 0 && !pointsWithPull.has(currentPt)) {
            const lastPull = getPullForPoint(currentPt);
            if (lastPull) {
                const pullPid = lastPull.pullerName ? findOrMapPlayer(lastPull.pullerName, nameToGender.get(lastPull.pullerName) || 'M', members, rosterMap, customMapping) : null;
                events.push({
                    k: 'pull',
                    team: lastPull.team,
                    p: pullPid,
                    x: lastPull.x,
                    y: lastPull.y,
                    t: Date.now() + rows.length * 1000
                });
                pointsWithPull.add(currentPt);
            }
        }

        const derived = derive({ pullFirst, events });
        results.push({
            opponent: opp,
            date,
            pullFirst,
            firstRatio: 'F',
            dir0: 'R',
            events,
            ourScore: derived.score.us,
            theirScore: derived.score.them,
            status: 'completed',
            customRoster: Array.from(rosterMap.values())
        });
    }

    return results;
}

function parseFromScoutSheets(workbook: XLSX.WorkBook, sheetNames: string[], members: Member[]): ImportedMatchResult[] {
    const results: ImportedMatchResult[] = [];

    for (const name of sheetNames) {
        const sheet = workbook.Sheets[name];
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        const oppName = name.replace(/^vs\s+/i, '').trim();

        // Cella titolo riga 2 (index 1), colonna B (index 1)
        const titleCell = rows[1]?.[1] || '';
        let date = new Date().toISOString().split('T')[0];
        const dateMatch = String(titleCell).match(/\d{4}-\d{2}-\d{2}/);
        if (dateMatch) date = dateMatch[0];

        results.push({
            opponent: oppName,
            date,
            pullFirst: 'us',
            firstRatio: 'F',
            dir0: 'R',
            events: [],
            ourScore: 0,
            theirScore: 0,
            status: 'completed',
            customRoster: []
        });
    }

    return results;
}

/**
 * Rimappa un singolo ID giocatore su un nuovo ID all'interno della lista eventi della partita
 */
export function remapEvents(events: MatchEvent[], oldId: string, newId: string): MatchEvent[] {
    return (events || []).map(ev => {
        let changed = false;
        let newP = ev.p;
        let newS = ev.s;
        let newA = ev.a;
        let newLine = ev.line;

        if (ev.p === oldId) {
            newP = newId;
            changed = true;
        }
        if (ev.s === oldId) {
            newS = newId;
            changed = true;
        }
        if (ev.a === oldId) {
            newA = newId;
            changed = true;
        }
        if (ev.line && ev.line.includes(oldId)) {
            newLine = Array.from(new Set(ev.line.map(x => (x === oldId ? newId : x))));
            changed = true;
        }

        if (!changed) return ev;
        const res: MatchEvent = { ...ev };
        if (newP !== undefined) res.p = newP;
        else delete res.p;

        if (newS !== undefined) res.s = newS;
        else delete res.s;

        if (newA !== undefined) res.a = newA;
        else delete res.a;

        if (newLine !== undefined) res.line = newLine;
        else delete res.line;

        return res;
    });
}

/**
 * Applica una mappa di sostituzione ID { [oldId]: newId } all'intera lista eventi
 */
export function applyRemappingsToEvents(events: MatchEvent[], remappings: Record<string, string>): MatchEvent[] {
    if (!events || events.length === 0 || Object.keys(remappings).length === 0) {
        return events || [];
    }
    return events.map(ev => {
        let changed = false;
        let newP = ev.p;
        let newS = ev.s;
        let newA = ev.a;
        let newLine = ev.line;

        if (ev.p && remappings[ev.p]) {
            newP = remappings[ev.p];
            changed = true;
        }
        if (ev.s && remappings[ev.s]) {
            newS = remappings[ev.s];
            changed = true;
        }
        if (ev.a && remappings[ev.a]) {
            newA = remappings[ev.a];
            changed = true;
        }
        if (ev.line && ev.line.some(x => !!remappings[x])) {
            const mapped = ev.line.map(x => remappings[x] || x);
            newLine = Array.from(new Set(mapped));
            changed = true;
        }

        if (!changed) return ev;
        const res: MatchEvent = { ...ev };
        if (newP !== undefined) res.p = newP;
        else delete res.p;

        if (newS !== undefined) res.s = newS;
        else delete res.s;

        if (newA !== undefined) res.a = newA;
        else delete res.a;

        if (newLine !== undefined) res.line = newLine;
        else delete res.line;

        return res;
    });
}
