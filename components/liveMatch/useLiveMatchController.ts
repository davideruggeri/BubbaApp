import { useState, useEffect, useMemo } from 'react';
import {
    MatchAnalysis,
    MatchEvent,
    subscribeToSingleMatch,
    updateMatchAnalysis,
    subscribeToMembers,
    Member,
} from '../../services/firestore';
import { remapEvents } from '../../utils/matchImporter';
import {
    derive,
    ratioFor,
    attRight,
    playerStats,
    teamStats,
} from '../../utils/statsEngine';
import { exportAndDownloadXLSX } from '../../utils/matchExporter';
import { showAlert, showConfirmation } from '../../utils/alert';
import { FieldDot, FieldTrajectory } from '../InteractiveField';
import { PendingAction } from './PlayActionPhase';

export function useLiveMatchController(matchId: string, initialMatch: MatchAnalysis, isStaff: boolean) {
    const [match, setMatch] = useState<MatchAnalysis>(initialMatch);
    const [allMembers, setAllMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);

    const [activeTab, setActiveTab] = useState<'play' | 'stats'>(
        initialMatch?.status === 'completed' ? 'stats' : 'play'
    );

    const [lineSel, setLineSel] = useState<string[]>([]);
    const [lineStartO, setLineStartO] = useState<boolean | null>(null);
    const [pullPuller, setPullPuller] = useState<string | null>(null);
    const [pendingTrajectory, setPendingTrajectory] = useState<{ x: number; y: number }[] | null>(null);
    const [statsSortKey, setStatsSortKey] = useState<string>('pts');
    const [statsSortAsc, setStatsSortAsc] = useState<boolean>(false);
    const [modalLineVisible, setModalLineVisible] = useState(false);
    const [subStep, setSubStep] = useState<'roster' | 'reason'>('roster');
    const [subReason, setSubReason] = useState<'injury' | 'error'>('injury');
    const [modalRosterVisible, setModalRosterVisible] = useState(false);
    const [modalTouchesVisible, setModalTouchesVisible] = useState(false);
    const [dismissedHalfTimePrompt, setDismissedHalfTimePrompt] = useState(false);
    const [pending, setPending] = useState<PendingAction | null>(null);

    // Sottoscrizioni Firestore
    useEffect(() => {
        const unsubscribeMatch = subscribeToSingleMatch(matchId, updated => {
            if (updated) {
                setMatch(updated);
            }
            setLoading(false);
        });

        const unsubscribeMembers = subscribeToMembers(m => {
            setAllMembers(m);
        });

        return () => {
            unsubscribeMatch();
            unsubscribeMembers();
        };
    }, [matchId]);

    // Roster effettivo della partita
    const matchRoster = useMemo(() => {
        if (match.customRoster && match.customRoster.length > 0) {
            const list = match.customRoster.map(p => {
                const mem = allMembers.find(m => m.id === p.id);
                const nickname = mem?.nickname?.trim();
                const displayName = nickname || mem?.firstName || p.name;
                const rawG = (p as any).g || (p as any).gender;
                const assignedGender: 'M' | 'F' = (rawG === 'F' || rawG === 'f') ? 'F' : 'M';
                return {
                    id: p.id,
                    name: displayName,
                    g: mem?.gender ? (mem.gender === 'F' ? ('F' as const) : ('M' as const)) : assignedGender,
                };
            });
            list.sort((a, b) => (a.g === 'F' ? 0 : 1) - (b.g === 'F' ? 0 : 1) || a.name.localeCompare(b.name));
            return list;
        }

        const list: { id: string; name: string; g: 'M' | 'F' }[] = allMembers.map(m => ({
            id: m.id,
            name: (m.nickname && m.nickname.trim()) ? m.nickname.trim() : m.firstName,
            g: m.gender === 'F' ? 'F' : 'M',
        }));
        list.sort((a, b) => (a.g === 'F' ? 0 : 1) - (b.g === 'F' ? 0 : 1) || a.name.localeCompare(b.name));
        return list;
    }, [allMembers, match.customRoster]);

    const playerMap = useMemo(() => {
        const map: any = {};
        for (const p of matchRoster) {
            map[p.id] = p;
        }
        for (const m of allMembers) {
            if (!map[m.id]) {
                map[m.id] = {
                    name: (m.nickname && m.nickname.trim()) ? m.nickname.trim() : m.firstName,
                    g: m.gender === 'F' ? 'F' : 'M',
                };
            }
        }
        if (match.customRoster) {
            for (const p of match.customRoster) {
                if (!map[p.id]) {
                    const rawG = (p as any).g || (p as any).gender;
                    map[p.id] = {
                        name: p.name,
                        g: (rawG === 'F' || rawG === 'f') ? 'F' : 'M',
                    };
                }
            }
        }
        return map;
    }, [matchRoster, allMembers, match.customRoster]);

    const P = (id?: string | null) => {
        if (!id) return { id: '', name: '?', g: 'M' as const };
        const found = playerMap[id];
        if (found) return found;
        const customP = match.customRoster?.find(x => x.id === id);
        if (customP) {
            const rawG = (customP as any).g || (customP as any).gender;
            return {
                id,
                name: customP.name,
                g: (rawG === 'F' || rawG === 'f') ? ('F' as const) : ('M' as const),
            };
        }
        return { id, name: '?', g: 'M' as const };
    };

    const isCompleted = match.status === 'completed';
    const canEdit = isStaff && !isCompleted;

    // Derivazione stato ed engine statistiche
    const st = useMemo(() => derive(match), [match]);
    const pStats = useMemo(() => playerStats([match]), [match]);
    const tStats = useMemo(() => teamStats(match), [match]);

    // Informazioni punto corrente
    const ptsN = st.points.length + 1;
    const curPt = st.cur;
    const needRatio = ratioFor(match, curPt ? curPt.n : ptsN);
    const isAttackingRight = attRight(match, curPt ? curPt.n : ptsN, st.halfTimePoint);

    const fCountInSel = lineSel.filter(id => P(id).g === 'F').length;
    const mCountInSel = lineSel.length - fCountInSel;
    const isGenderRatioOk =
        needRatio === 'F' ? fCountInSel === 3 && mCountInSel === 2 : mCountInSel === 3 && fCountInSel === 2;

    // Punti grafici pull
    const pullPrevDots = useMemo((): FieldDot[] => {
        if (!curPt) return [];
        const wePull = !curPt.o;
        return st.points
            .filter(p => p.pull && p.pull.x != null && p.pull.team === (wePull ? 'us' : 'them'))
            .map(p => ({
                x: p.pull!.x!,
                y: p.pull!.y!,
                c: '#B0B2B5',
                r: 0.8,
            }));
    }, [curPt, st.points]);

    // Punti e traiettorie grafiche gioco — solo punto corrente
    const { playPrevDots, playPrevTrajectories } = useMemo(() => {
        const dots: FieldDot[] = [];
        const trajectories: FieldTrajectory[] = [];
        const curO = st.cur?.o ?? false;
        for (const e of st.cur?.ev || []) {
            const isLoc =
                e.k === 'tt' ||
                e.k === 'td' ||
                e.k === 'ts' ||
                e.k === 'tx' ||
                e.k === 'd' ||
                e.k === 'call' ||
                e.k === 'err';
            if (!isLoc) continue;
            const isDefense = e.k === 'd';
            const isThem = isDefense || e.k === 'call' || e.k === 'err';
            const evColor = isDefense ? '#2E8540' : isThem ? '#E07A1F' : curO ? '#C8323C' : '#1F6FD1';

            let dotX = e.x;
            let dotY = e.y;
            if (e.trajectory && e.trajectory.length >= 2) {
                if (e.k === 'tt' || e.k === 'err') {
                    dotX = e.trajectory[0].x;
                    dotY = e.trajectory[0].y;
                } else if (e.k === 'td') {
                    dotX = e.trajectory[e.trajectory.length - 1].x;
                    dotY = e.trajectory[e.trajectory.length - 1].y;
                }
            }

            if (dotX != null && dotY != null) {
                dots.push({ x: dotX, y: dotY, c: evColor, r: 0.8 });
            }

            if (!isDefense && e.trajectory && e.trajectory.length >= 2) {
                trajectories.push({ points: e.trajectory, color: evColor });
            }
        }
        return { playPrevDots: dots, playPrevTrajectories: trajectories };
    }, [st.cur?.ev]);

    // Push evento
    const pushEvent = async (ev: MatchEvent) => {
        if (isCompleted) {
            showAlert(
                'Partita Terminata',
                "Tocca prima 'Riapri' in alto per poter registrare o modificare le azioni della partita."
            );
            return;
        }

        const currentEvents = match.events ? [...match.events] : [];
        const newEvent: MatchEvent = { ...ev, t: Date.now() };
        currentEvents.push(newEvent);

        const newDerive = derive({ pullFirst: match.pullFirst, events: currentEvents });
        const updatedMatch: Partial<MatchAnalysis> & { id: string } = {
            id: match.id,
            events: currentEvents,
            ourScore: newDerive.score.us,
            theirScore: newDerive.score.them,
            status: match.status === 'scheduled' ? 'live' : match.status,
        };

        try {
            await updateMatchAnalysis(updatedMatch);
        } catch {
            showAlert('Errore', "Impossibile salvare l'evento sul database.");
        }
    };

    // Undo ultimo evento
    const handleUndo = async () => {
        if (!canEdit) {
            showAlert('Partita Terminata', "Tocca prima 'Riapri' in alto per poter modificare o annullare eventi.");
            return;
        }

        if (pending) {
            setPending(null);
            return;
        }

        if (!match.events || !match.events.length) return;

        const currentEvents = [...match.events];
        const lastEv = currentEvents.pop();

        const newDerive = derive({ pullFirst: match.pullFirst, events: currentEvents });
        const updatedMatch: Partial<MatchAnalysis> & { id: string } = {
            id: match.id,
            events: currentEvents,
            ourScore: newDerive.score.us,
            theirScore: newDerive.score.them,
        };

        try {
            await updateMatchAnalysis(updatedMatch);
            if (lastEv && lastEv.k === 'start' && lastEv.line) {
                setLineSel(lastEv.line.slice());
                setLineStartO(!!lastEv.o);
            }
        } catch {
            showAlert('Errore', "Impossibile annullare l'evento.");
        }
    };

    const handleFlipRatio = async () => {
        if (!canEdit) return;
        const newRatio: 'M' | 'F' = (match.firstRatio || 'F') === 'F' ? 'M' : 'F';
        try {
            await updateMatchAnalysis({ id: match.id, firstRatio: newRatio });
        } catch {
            showAlert('Errore', 'Impossibile invertire il rapporto.');
        }
    };

    const handleFlipDir = async () => {
        if (!canEdit) return;
        const newDir: 'R' | 'L' = (match.dir0 || 'R') === 'R' ? 'L' : 'R';
        try {
            await updateMatchAnalysis({ id: match.id, dir0: newDir });
        } catch {
            showAlert('Errore', 'Impossibile invertire la direzione del campo.');
        }
    };

    const handleUpdatePullCoord = async (eventIndex: number, newCoord: { x: number; y: number }) => {
        if (!isStaff) {
            showAlert('Permesso negato', 'Solo lo staff può modificare gli eventi.');
            return;
        }
        if (!match.events || eventIndex < 0 || eventIndex >= match.events.length) {
            showAlert('Errore', 'Evento pull non trovato.');
            return;
        }

        const currentEvents = [...match.events];
        const oldEv = currentEvents[eventIndex];
        currentEvents[eventIndex] = {
            ...oldEv,
            x: Math.round(newCoord.x * 10) / 10,
            y: Math.round(newCoord.y * 10) / 10,
        };

        const newDerive = derive({ pullFirst: match.pullFirst, events: currentEvents });
        const updatedMatch: Partial<MatchAnalysis> & { id: string } = {
            id: match.id,
            events: currentEvents,
            ourScore: newDerive.score.us,
            theirScore: newDerive.score.them,
        };

        try {
            await updateMatchAnalysis(updatedMatch);
            showAlert('Successo', 'Posizione del pull aggiornata.');
        } catch {
            showAlert('Errore', 'Impossibile aggiornare la posizione del pull.');
        }
    };

    const handleUpdateTurnoverEvent = async (
        eventIndex: number,
        updatedFields: {
            k?: 'tt' | 'td' | 'ts' | 'tx' | 'd' | 'err' | 'call';
            p?: string | null;
            x?: number | null;
            y?: number | null;
            trajectory?: { x: number; y: number }[];
        }
    ) => {
        if (!isStaff) {
            showAlert('Permesso negato', 'Solo lo staff può modificare gli eventi.');
            return;
        }
        if (!match.events || eventIndex < 0 || eventIndex >= match.events.length) {
            showAlert('Errore', 'Evento non trovato.');
            return;
        }

        const currentEvents = [...match.events];
        const oldEv = currentEvents[eventIndex];
        currentEvents[eventIndex] = {
            ...oldEv,
            ...updatedFields,
            x: updatedFields.x != null ? Math.round(updatedFields.x * 10) / 10 : oldEv.x,
            y: updatedFields.y != null ? Math.round(updatedFields.y * 10) / 10 : oldEv.y,
        };

        const newDerive = derive({ pullFirst: match.pullFirst, events: currentEvents });
        const updatedMatch: Partial<MatchAnalysis> & { id: string } = {
            id: match.id,
            events: currentEvents,
            ourScore: newDerive.score.us,
            theirScore: newDerive.score.them,
        };

        try {
            await updateMatchAnalysis(updatedMatch);
            showAlert('Successo', 'Evento aggiornato con successo.');
        } catch {
            showAlert('Errore', "Impossibile aggiornare l'evento.");
        }
    };

    const handleUpdateGoalEvent = async (
        eventIndex: number,
        updated: { s?: string | null; a?: string | null }
    ) => {
        if (!isStaff) {
            showAlert('Permesso negato', 'Solo lo staff può modificare gli eventi.');
            return;
        }
        if (!match.events || eventIndex < 0 || eventIndex >= match.events.length) {
            showAlert('Errore', 'Evento gol non trovato.');
            return;
        }

        const currentEvents = [...match.events];
        const oldEv = currentEvents[eventIndex];
        const oldS = oldEv.s;
        const oldA = oldEv.a;
        const newS = updated.s !== undefined ? updated.s : oldS;
        const newA = updated.a !== undefined ? updated.a : oldA;

        // 1. Aggiorna l'evento gol
        currentEvents[eventIndex] = {
            ...oldEv,
            s: newS || undefined,
            a: newA || null,
        };

        // 2. Sincronizza i tocchi per chi ha effettuato l'assist (il passaggio della meta è un tocco del disco)
        let targetTouchIndex = -1;
        for (let j = eventIndex - 1; j >= 0; j--) {
            const ev = currentEvents[j];
            if (ev.k === 'goal' || ev.k === 'call' || ev.k === 'tg' || ev.k === 'start' || ev.k === 'halftime') {
                break;
            }
            if (ev.k === 'touch') {
                if (oldA && ev.p === oldA) {
                    targetTouchIndex = j;
                    break;
                }
                if (targetTouchIndex === -1) {
                    targetTouchIndex = j;
                }
            }
        }

        if (oldA !== newA) {
            if (targetTouchIndex !== -1 && oldA && currentEvents[targetTouchIndex].p === oldA) {
                if (newA) {
                    currentEvents[targetTouchIndex] = {
                        ...currentEvents[targetTouchIndex],
                        p: newA,
                    };
                } else {
                    currentEvents.splice(targetTouchIndex, 1);
                }
            } else if (newA) {
                currentEvents.splice(eventIndex, 0, {
                    k: 'touch',
                    p: newA,
                    t: oldEv.t,
                });
            }
        }

        // 3. Sincronizza manualTouches se presente
        let updatedManualTouches = match.manualTouches ? { ...match.manualTouches } : undefined;
        if (updatedManualTouches) {
            if (oldS && updatedManualTouches[oldS] != null && oldS !== newS) {
                updatedManualTouches[oldS] = Math.max(0, updatedManualTouches[oldS] - 1);
            }
            if (newS && oldS !== newS) {
                updatedManualTouches[newS] = (updatedManualTouches[newS] || 0) + 1;
            }
            if (oldA && updatedManualTouches[oldA] != null && oldA !== newA) {
                updatedManualTouches[oldA] = Math.max(0, updatedManualTouches[oldA] - 1);
            }
            if (newA && oldA !== newA) {
                updatedManualTouches[newA] = (updatedManualTouches[newA] || 0) + 1;
            }
        }

        const newDerive = derive({ pullFirst: match.pullFirst, events: currentEvents });
        const updatedMatch: Partial<MatchAnalysis> & { id: string } = {
            id: match.id,
            events: currentEvents,
            ourScore: newDerive.score.us,
            theirScore: newDerive.score.them,
            ...(updatedManualTouches ? { manualTouches: updatedManualTouches } : {}),
        };

        try {
            await updateMatchAnalysis(updatedMatch);
            showAlert('Successo', 'Gol e assist aggiornati con ricalcolo dei tocchi.');
        } catch {
            showAlert('Errore', "Impossibile aggiornare il gol.");
        }
    };

    const handleInsertTouches = async (beforeRawEventIndex: number, playerIds: string[]) => {
        if (!isStaff) {
            showAlert('Permesso negato', 'Solo lo staff può modificare gli eventi.');
            return;
        }
        if (!match.events || beforeRawEventIndex < 0 || beforeRawEventIndex > match.events.length) {
            showAlert('Errore', 'Posizione inserimento non valida.');
            return;
        }
        if (!playerIds.length) return;

        const currentEvents = [...match.events];
        const touchEvents = playerIds.map(pid => ({ k: 'touch' as const, p: pid }));
        currentEvents.splice(beforeRawEventIndex, 0, ...touchEvents);

        const newDerive = derive({ pullFirst: match.pullFirst, events: currentEvents });
        try {
            await updateMatchAnalysis({
                id: match.id,
                events: currentEvents,
                ourScore: newDerive.score.us,
                theirScore: newDerive.score.them,
            });
        } catch {
            showAlert('Errore', 'Impossibile inserire i tocchi.');
        }
    };

    const handleInsertTouchPhases = async (phases: Array<{ beforeRawEventIndex: number; playerIds: string[] }>) => {
        if (!isStaff) {
            showAlert('Permesso negato', 'Solo lo staff può modificare gli eventi.');
            return;
        }
        if (!match.events) return;

        const toInsert = phases.filter(p => p.playerIds.length > 0);
        if (!toInsert.length) return;

        // Insert in descending index order so earlier insertions don't shift later indices
        const sorted = [...toInsert].sort((a, b) => b.beforeRawEventIndex - a.beforeRawEventIndex);
        const currentEvents = [...match.events];
        for (const { beforeRawEventIndex, playerIds } of sorted) {
            if (beforeRawEventIndex < 0 || beforeRawEventIndex > currentEvents.length) continue;
            const touches = playerIds.map(pid => ({ k: 'touch' as const, p: pid }));
            currentEvents.splice(beforeRawEventIndex, 0, ...touches);
        }

        const newDerive = derive({ pullFirst: match.pullFirst, events: currentEvents });
        try {
            await updateMatchAnalysis({
                id: match.id,
                events: currentEvents,
                ourScore: newDerive.score.us,
                theirScore: newDerive.score.them,
            });
        } catch {
            showAlert('Errore', 'Impossibile salvare i tocchi.');
        }
    };

    const handleUpdatePointLine = async (pointNumber: number, oldPlayerId: string, newPlayerId: string) => {
        if (!isStaff || !match || !match.id) {
            showAlert('Errore', 'Non hai i permessi per modificare questa partita.');
            return;
        }
        if (!match.events || match.events.length === 0) {
            showAlert('Errore', 'Nessun evento registrato nella partita.');
            return;
        }
        if (oldPlayerId === newPlayerId) return;

        const currentEvents = [...match.events];

        // Troviamo l'intervallo degli eventi per questa meta
        let ptCount = 0;
        let startEventIdx = -1;
        let endEventIdx = -1;

        for (let i = 0; i < currentEvents.length; i++) {
            if (currentEvents[i].k === 'start') {
                ptCount++;
                if (ptCount === pointNumber) {
                    startEventIdx = i;
                } else if (startEventIdx !== -1) {
                    endEventIdx = i;
                    break;
                }
            }
        }

        if (startEventIdx === -1) {
            showAlert('Errore', `Meta #${pointNumber} non trovata.`);
            return;
        }
        if (endEventIdx === -1) {
            endEventIdx = currentEvents.length;
        }

        let oldTouchesCount = 0;

        // Sostituiamo oldPlayerId con newPlayerId in tutti gli eventi di questa meta
        for (let i = startEventIdx; i < endEventIdx; i++) {
            const ev = { ...currentEvents[i] };
            let modified = false;

            // Linea (start o line)
            if (ev.line && Array.isArray(ev.line) && ev.line.includes(oldPlayerId)) {
                ev.line = ev.line.map(id => (id === oldPlayerId ? newPlayerId : id));
                modified = true;
            }

            // Pull
            if (ev.k === 'pull' && ev.p === oldPlayerId) {
                ev.p = newPlayerId;
                modified = true;
            }

            // Goal (marcatore o assist)
            if (ev.k === 'goal') {
                if (ev.s === oldPlayerId) {
                    ev.s = newPlayerId;
                    oldTouchesCount++;
                    modified = true;
                }
                if (ev.a === oldPlayerId) {
                    ev.a = newPlayerId;
                    modified = true;
                }
            }

            // Touch
            if (ev.k === 'touch' && ev.p === oldPlayerId) {
                ev.p = newPlayerId;
                oldTouchesCount++;
                modified = true;
            }

            // Difesa o Callahan
            if ((ev.k === 'd' || ev.k === 'call') && ev.p === oldPlayerId) {
                ev.p = newPlayerId;
                if (ev.k === 'call') oldTouchesCount++;
                modified = true;
            }

            // Turnover (tt, td, ts, tx)
            if ((ev.k === 'tt' || ev.k === 'td' || ev.k === 'ts' || ev.k === 'tx') && ev.p === oldPlayerId) {
                ev.p = newPlayerId;
                modified = true;
            }

            // Errore avversario (err)
            if (ev.k === 'err' && ev.p === oldPlayerId) {
                ev.p = newPlayerId;
                modified = true;
            }

            if (modified) {
                currentEvents[i] = ev;
            }
        }

        // Sincronizza manualTouches se presente
        let updatedManualTouches = match.manualTouches ? { ...match.manualTouches } : undefined;
        if (updatedManualTouches && oldTouchesCount > 0) {
            if (updatedManualTouches[oldPlayerId] != null) {
                updatedManualTouches[oldPlayerId] = Math.max(0, updatedManualTouches[oldPlayerId] - oldTouchesCount);
            }
            updatedManualTouches[newPlayerId] = (updatedManualTouches[newPlayerId] || 0) + oldTouchesCount;
        }

        const newDerive = derive({ pullFirst: match.pullFirst, events: currentEvents });
        const updatedMatch: Partial<MatchAnalysis> & { id: string } = {
            id: match.id,
            events: currentEvents,
            ourScore: newDerive.score.us,
            theirScore: newDerive.score.them,
            ...(updatedManualTouches ? { manualTouches: updatedManualTouches } : {}),
        };

        try {
            await updateMatchAnalysis(updatedMatch);
            showAlert('Successo', `Formazione e statistiche della meta #${pointNumber} aggiornate.`);
        } catch {
            showAlert('Errore', 'Impossibile aggiornare la formazione della meta.');
        }
    };

    // Half time automatico
    useEffect(() => {
        if (!canEdit || isCompleted) return;
        if (
            !st.halfTimeDone &&
            !dismissedHalfTimePrompt &&
            st.phase === 'line' &&
            (st.score.us >= 7 || st.score.them >= 7)
        ) {
            showConfirmation(
                'Metà Partita (Half Time)',
                `Una squadra ha raggiunto 7 punti (${st.score.us} - ${st.score.them}). Vuoi attivare l'Half Time adesso? L'attacco/difesa per il prossimo punto verrà invertito rispetto all'avvio della partita.`,
                () => {
                    setLineStartO(null);
                    pushEvent({ k: 'halftime' });
                },
                'Sì, attiva Half Time',
                'No, continua',
                () => {
                    setDismissedHalfTimePrompt(true);
                }
            );
        }
    }, [st.score.us, st.score.them, st.halfTimeDone, dismissedHalfTimePrompt, st.phase, canEdit, isCompleted]);

    const handleTriggerHalfTime = () => {
        showConfirmation(
            'Attiva Half Time (Intervallo)',
            "Vuoi chiamare l'Half Time adesso? I ruoli (attacco/difesa) per il prossimo punto verranno invertiti rispetto al punto di avvio partita.",
            () => {
                setLineStartO(null);
                pushEvent({ k: 'halftime' });
            },
            'Sì, attiva Half Time',
            'Annulla'
        );
    };

    const handleToggleDone = async () => {
        const isDone = match.status === 'completed';
        const newStatus = isDone ? 'live' : 'completed';
        const label = isDone ? 'Riapri' : 'Termina';

        showConfirmation(
            `${label} Partita`,
            isDone
                ? 'Vuoi riaprire questa partita? Le azioni di gioco torneranno modificabili.'
                : 'Vuoi contrassegnare questa partita come terminata? Tutte le azioni verranno bloccate in sola lettura.',
            async () => {
                await updateMatchAnalysis({ id: match.id, status: newStatus });
            },
            label
        );
    };

    const handleExportExcel = async () => {
        try {
            await exportAndDownloadXLSX([match], playerMap);
        } catch (e: any) {
            showAlert('Errore', e?.message || "Impossibile esportare l'Excel.");
        }
    };

    const applyLineChange = async (reason: 'injury' | 'error') => {
        if (isCompleted || !curPt) return;

        if (reason === 'injury') {
            await pushEvent({ k: 'line', line: lineSel.slice(), reason: 'injury' });
        } else {
            const currentEvents = match.events ? [...match.events] : [];
            let lastStartIndex = -1;
            for (let i = currentEvents.length - 1; i >= 0; i--) {
                if (currentEvents[i].k === 'start') {
                    lastStartIndex = i;
                    break;
                }
            }

            if (lastStartIndex !== -1) {
                const outPlayers = (curPt.line || []).filter((id: string) => !lineSel.includes(id));
                const inPlayers = lineSel.filter((id: string) => !(curPt.line || []).includes(id));

                currentEvents[lastStartIndex] = {
                    ...currentEvents[lastStartIndex],
                    line: lineSel.slice(),
                };

                if (outPlayers.length === 1 && inPlayers.length === 1) {
                    const outId = outPlayers[0];
                    const inId = inPlayers[0];
                    for (let i = lastStartIndex + 1; i < currentEvents.length; i++) {
                        if (currentEvents[i].p === outId) currentEvents[i] = { ...currentEvents[i], p: inId };
                        if (currentEvents[i].s === outId) currentEvents[i] = { ...currentEvents[i], s: inId };
                        if (currentEvents[i].a === outId) currentEvents[i] = { ...currentEvents[i], a: inId };
                    }
                }

                const correctedEvents = currentEvents.filter((ev, idx) => {
                    if (idx > lastStartIndex && ev.k === 'line') return false;
                    return true;
                });

                const newDerive = derive({ pullFirst: match.pullFirst, events: correctedEvents });
                const updatedMatch: Partial<MatchAnalysis> & { id: string } = {
                    id: match.id,
                    events: correctedEvents,
                    ourScore: newDerive.score.us,
                    theirScore: newDerive.score.them,
                };

                try {
                    await updateMatchAnalysis(updatedMatch);
                } catch {
                    showAlert('Errore', 'Impossibile aggiornare la formazione iniziale sul database.');
                }
            }
        }
        setModalLineVisible(false);
    };

    const handleRemapPlayer = async (
        oldPlayer: { id: string; name: string; g: 'M' | 'F' },
        targetMember: Member
    ) => {
        try {
            const targetGender = targetMember.gender === 'F' ? ('F' as const) : ('M' as const);
            const targetName = targetMember.nickname || targetMember.firstName;
            const targetId = targetMember.id;

            const current =
                match.customRoster && match.customRoster.length > 0
                    ? [...match.customRoster]
                    : matchRoster.map(p => ({ id: p.id, name: p.name, g: p.g }));

            let updatedRoster: any[];
            if (current.some(p => p.id === targetId)) {
                updatedRoster = current.filter(p => p.id !== oldPlayer.id);
            } else {
                updatedRoster = current.map(p => {
                    if (p.id === oldPlayer.id) {
                        return { id: targetId, name: targetName, g: targetGender };
                    }
                    return p;
                });
                if (!updatedRoster.some(p => p.id === targetId)) {
                    updatedRoster.push({ id: targetId, name: targetName, g: targetGender });
                }
            }

            const updatedEvents = remapEvents(match.events || [], oldPlayer.id, targetId);

            await updateMatchAnalysis({
                id: match.id,
                customRoster: updatedRoster,
                events: updatedEvents,
            });

            setLineSel(prev => prev.map(x => (x === oldPlayer.id ? targetId : x)));
            showAlert('Giocatore Collegato', `"${oldPlayer.name}" è stato collegato a "${targetName}".`);
        } catch (err: any) {
            showAlert('Errore', err?.message || 'Impossibile completare il collegamento.');
        }
    };

    const handleRemovePlayerFromRoster = (playerId: string, playerName: string) => {
        const hasEvents = (match.events || []).some(
            ev =>
                ev.p === playerId ||
                ev.s === playerId ||
                ev.a === playerId ||
                (ev.line && ev.line.includes(playerId))
        );

        const performRemove = async () => {
            const current =
                match.customRoster && match.customRoster.length > 0
                    ? [...match.customRoster]
                    : matchRoster.map(p => ({ id: p.id, name: p.name, g: p.g }));
            const updated = current.filter(p => p.id !== playerId);
            await updateMatchAnalysis({ id: match.id, customRoster: updated });
            setLineSel(prev => prev.filter(x => x !== playerId));
        };

        if (hasEvents) {
            showConfirmation(
                'Attenzione',
                `"${playerName}" ha eventi registrati. Rimuoverlo dai convocati non cancellerà gli eventi passati. Continuare?`,
                performRemove,
                'Rimuovi'
            );
        } else {
            performRemove();
        }
    };

    const toggleSort = (key: string) => {
        if (statsSortKey === key) {
            setStatsSortAsc(!statsSortAsc);
        } else {
            setStatsSortKey(key);
            setStatsSortAsc(false);
        }
    };

    return {
        match,
        allMembers,
        loading,
        activeTab,
        setActiveTab,
        matchRoster,
        playerMap,
        P,
        isCompleted,
        canEdit,
        st,
        pStats,
        tStats,
        ptsN,
        curPt,
        needRatio,
        isAttackingRight,
        fCountInSel,
        mCountInSel,
        isGenderRatioOk,
        pullPrevDots,
        playPrevDots,
        playPrevTrajectories,
        lineSel,
        setLineSel,
        lineStartO,
        setLineStartO,
        pullPuller,
        setPullPuller,
        pendingTrajectory,
        setPendingTrajectory,
        statsSortKey,
        statsSortAsc,
        toggleSort,
        modalLineVisible,
        setModalLineVisible,
        subStep,
        setSubStep,
        subReason,
        setSubReason,
        modalRosterVisible,
        setModalRosterVisible,
        modalTouchesVisible,
        setModalTouchesVisible,
        pending,
        setPending,
        pushEvent,
        handleUndo,
        handleFlipRatio,
        handleFlipDir,
        handleUpdatePullCoord,
        handleUpdateTurnoverEvent,
        handleUpdateGoalEvent,
        handleInsertTouches,
        handleInsertTouchPhases,
        handleUpdatePointLine,
        handleTriggerHalfTime,
        handleToggleDone,
        handleExportExcel,
        applyLineChange,
        handleRemapPlayer,
        handleRemovePlayerFromRoster,
    };
}
