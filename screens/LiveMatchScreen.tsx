// screens/LiveMatchScreen.tsx
// Interfaccia Live Match e Statistiche per partite di ultimate (CUS Brescia - Bubba)

import React, { useState, useEffect, useMemo } from 'react';
import {
    ScrollView,
    ActivityIndicator,
    useWindowDimensions
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FieldDot, FieldTrajectory } from '../components/InteractiveField';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../App';
import ScoreboardHeader from '../components/liveMatch/ScoreboardHeader';
import CompletedMatchSummary from '../components/liveMatch/CompletedMatchSummary';
import LineSelectionPhase from '../components/liveMatch/LineSelectionPhase';
import PullRecordingPhase from '../components/liveMatch/PullRecordingPhase';
import PlayActionPhase, { PendingAction } from '../components/liveMatch/PlayActionPhase';
import MatchStatsView from '../components/liveMatch/MatchStatsView';
import LineSubstitutionModal from '../components/liveMatch/LineSubstitutionModal';
import MatchRosterModal from '../components/liveMatch/MatchRosterModal';
import EditTouchesModal from '../components/EditTouchesModal';
import { styles } from '../components/liveMatch/liveMatchStyles';
import {
    MatchAnalysis,
    MatchEvent,
    subscribeToSingleMatch,
    updateMatchAnalysis,
    subscribeToMembers,
    Member
} from '../services/firestore';
import { remapEvents } from '../utils/matchImporter';
import {
    derive,
    ratioFor,
    attRight,
    playerStats,
    teamStats,
} from '../utils/statsEngine';
import { exportAndDownloadXLSX } from '../utils/matchExporter';
import { showAlert, showConfirmation } from '../utils/alert';

type LiveMatchScreenRouteProp = RouteProp<RootStackParamList, 'LiveMatch'>;

export default function LiveMatchScreen() {
    const { theme } = useTheme();
    const { isStaff } = useAuth();
    const navigation = useNavigation<any>();
    const route = useRoute<LiveMatchScreenRouteProp>();
    const { matchId, initialMatch } = route.params;
    const { width: windowWidth } = useWindowDimensions();
    const isMobile = windowWidth < 600;

    const [match, setMatch] = useState<MatchAnalysis>(initialMatch);
    const [allMembers, setAllMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);

    // Tab attiva: se la partita è completata apri direttamente le statistiche, altrimenti il live
    const [activeTab, setActiveTab] = useState<'play' | 'stats'>(initialMatch?.status === 'completed' ? 'stats' : 'play');

    // Stato temporaneo per la registrazione live
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

    // Gestione step interattivi (scorer, assist, coordinate x/y)
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
                    g: mem?.gender ? (mem.gender === 'F' ? ('F' as const) : ('M' as const)) : assignedGender
                };
            });
            list.sort((a, b) => (a.g === 'F' ? 0 : 1) - (b.g === 'F' ? 0 : 1) || a.name.localeCompare(b.name));
            return list;
        }

        const list: { id: string; name: string; g: 'M' | 'F' }[] = allMembers.map(m => ({
            id: m.id,
            name: (m.nickname && m.nickname.trim()) ? m.nickname.trim() : m.firstName,
            g: m.gender === 'F' ? 'F' : 'M'
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
                    g: m.gender === 'F' ? 'F' : 'M'
                };
            }
        }
        if (match.customRoster) {
            for (const p of match.customRoster) {
                if (!map[p.id]) {
                    const rawG = (p as any).g || (p as any).gender;
                    map[p.id] = {
                        name: p.name,
                        g: (rawG === 'F' || rawG === 'f') ? 'F' : 'M'
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
                g: (rawG === 'F' || rawG === 'f') ? ('F' as const) : ('M' as const)
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
    const isGenderRatioOk = needRatio === 'F' ? fCountInSel === 3 && mCountInSel === 2 : mCountInSel === 3 && fCountInSel === 2;

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
                r: 0.8
            }));
    }, [curPt, st.points]);

    // Punti e traiettorie grafiche gioco
    const { playPrevDots, playPrevTrajectories } = useMemo(() => {
        const dots: FieldDot[] = [];
        const trajectories: FieldTrajectory[] = [];
        for (const p of st.points) {
            for (const e of (p.ev || [])) {
                const isLoc = e.k === 'tt' || e.k === 'td' || e.k === 'ts' || e.k === 'tx' || e.k === 'd' || e.k === 'call' || e.k === 'err';
                if (isLoc) {
                    const isDefense = e.k === 'd';
                    const isThem = isDefense || e.k === 'call' || e.k === 'err';
                    const evColor = isDefense ? '#2E8540' : (isThem ? '#E07A1F' : (p.o ? '#C8323C' : '#1F6FD1'));

                    let dotX = e.x;
                    let dotY = e.y;
                    if (e.trajectory && e.trajectory.length >= 2) {
                        if (e.k === 'tt') {
                            // Lanciatore all'inizio della freccia
                            dotX = e.trajectory[0].x;
                            dotY = e.trajectory[0].y;
                        } else if (e.k === 'td') {
                            // Ricevitore alla fine della freccia
                            dotX = e.trajectory[e.trajectory.length - 1].x;
                            dotY = e.trajectory[e.trajectory.length - 1].y;
                        }
                    }

                    if (dotX != null && dotY != null) {
                        dots.push({ x: dotX, y: dotY, c: evColor, r: 0.8 });
                    }

                    // Le difese sono indicate solo con un punto sullo schermo e mai con traiettoria
                    if (!isDefense && e.trajectory && e.trajectory.length >= 2) {
                        trajectories.push({ points: e.trajectory, color: evColor });
                    }
                }
            }
        }
        return { playPrevDots: dots, playPrevTrajectories: trajectories };
    }, [st.points]);

    // Funzione push evento
    const pushEvent = async (ev: MatchEvent) => {
        if (isCompleted) {
            showAlert("Partita Terminata", "Tocca prima 'Riapri' in alto per poter registrare o modificare le azioni della partita.");
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
            status: match.status === 'scheduled' ? 'live' : match.status
        };

        try {
            await updateMatchAnalysis(updatedMatch);
        } catch (e) {
            console.error("Errore salvataggio evento su Firestore:", e);
            showAlert("Errore", "Impossibile salvare l'evento sul database.");
        }
    };

    // Undo ultimo evento
    const handleUndo = async () => {
        if (!canEdit) {
            showAlert("Partita Terminata", "Tocca prima 'Riapri' in alto per poter modificare o annullare eventi.");
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
            theirScore: newDerive.score.them
        };

        try {
            await updateMatchAnalysis(updatedMatch);
            if (lastEv && lastEv.k === 'start' && lastEv.line) {
                setLineSel(lastEv.line.slice());
                setLineStartO(!!lastEv.o);
            }
        } catch (e) {
            showAlert("Errore", "Impossibile annullare l'evento.");
        }
    };

    // Inverti rapporto ABBA
    const handleFlipRatio = async () => {
        if (!canEdit) return;
        const newRatio: 'M' | 'F' = (match.firstRatio || 'F') === 'F' ? 'M' : 'F';
        try {
            await updateMatchAnalysis({ id: match.id, firstRatio: newRatio });
        } catch (e) {
            showAlert("Errore", "Impossibile invertire il rapporto.");
        }
    };

    // Inverti orientamento campo
    const handleFlipDir = async () => {
        if (!canEdit) return;
        const newDir: 'R' | 'L' = (match.dir0 || 'R') === 'R' ? 'L' : 'R';
        try {
            await updateMatchAnalysis({ id: match.id, dir0: newDir });
        } catch (e) {
            showAlert("Errore", "Impossibile invertire la direzione del campo.");
        }
    };

    // Modifica coordinate di un evento pull esistente
    const handleUpdatePullCoord = async (eventIndex: number, newCoord: { x: number; y: number }) => {
        if (!isStaff) {
            showAlert("Permesso negato", "Solo lo staff può modificare gli eventi.");
            return;
        }
        if (isCompleted) {
            showAlert("Partita Terminata", "Tocca prima 'Riapri' in alto per poter modificare le azioni della partita.");
            return;
        }
        if (!match.events || eventIndex < 0 || eventIndex >= match.events.length) {
            showAlert("Errore", "Evento pull non trovato.");
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
            showAlert("Successo", "Posizione del pull aggiornata.");
        } catch (e) {
            console.error("Errore salvataggio modifica pull su Firestore:", e);
            showAlert("Errore", "Impossibile aggiornare la posizione del pull.");
        }
    };

    // Proposta Half Time automatica a 7 punti
    useEffect(() => {
        if (!canEdit || isCompleted) return;
        if (!st.halfTimeDone && !dismissedHalfTimePrompt && st.phase === 'line' && (st.score.us >= 7 || st.score.them >= 7)) {
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
            `Vuoi chiamare l'Half Time adesso? I ruoli (attacco/difesa) per il prossimo punto verranno invertiti rispetto al punto di avvio partita.`,
            () => {
                setLineStartO(null);
                pushEvent({ k: 'halftime' });
            },
            'Sì, attiva Half Time',
            'Annulla'
        );
    };

    // Termina / Riapri partita
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

    // Esportazione XLSX
    const handleExportExcel = async () => {
        try {
            await exportAndDownloadXLSX([match], playerMap);
        } catch (e: any) {
            showAlert("Errore", e?.message || "Impossibile esportare l'Excel.");
        }
    };

    // Applicazione cambio linea (infortunio / errore)
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
                    line: lineSel.slice()
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
                    theirScore: newDerive.score.them
                };

                try {
                    await updateMatchAnalysis(updatedMatch);
                } catch (e) {
                    console.error("Errore correzione formazione iniziale:", e);
                    showAlert("Errore", "Impossibile aggiornare la formazione iniziale sul database.");
                }
            }
        }
        setModalLineVisible(false);
    };

    // Rimappatura giocatore a membro societario
    const handleRemapPlayer = async (
        oldPlayer: { id: string; name: string; g: 'M' | 'F' },
        targetMember: Member
    ) => {
        try {
            const targetGender = targetMember.gender === 'F' ? ('F' as const) : ('M' as const);
            const targetName = targetMember.nickname || targetMember.firstName;
            const targetId = targetMember.id;

            const current = match.customRoster && match.customRoster.length > 0
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
                events: updatedEvents
            });

            setLineSel(prev => prev.map(x => (x === oldPlayer.id ? targetId : x)));
            showAlert('Giocatore Collegato', `"${oldPlayer.name}" è stato collegato a "${targetName}".`);
        } catch (err: any) {
            showAlert('Errore', err?.message || 'Impossibile completare il collegamento.');
        }
    };

    const handleRemovePlayerFromRoster = (playerId: string, playerName: string) => {
        const hasEvents = (match.events || []).some(
            ev => ev.p === playerId || ev.s === playerId || ev.a === playerId || (ev.line && ev.line.includes(playerId))
        );

        const performRemove = async () => {
            const current = match.customRoster && match.customRoster.length > 0
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

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
                <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 40 }} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            {/* Header Superiore */}
            <ScoreboardHeader
                opponent={match.opponent}
                scoreUs={st.score.us}
                scoreThem={st.score.them}
                isCompleted={isCompleted}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                isStaff={isStaff}
                canEdit={canEdit}
                rosterCount={matchRoster.length}
                onExportExcel={handleExportExcel}
                onOpenTouches={() => setModalTouchesVisible(true)}
                onOpenRoster={() => setModalRosterVisible(true)}
                onUndo={handleUndo}
                onToggleDone={handleToggleDone}
                onBack={() => navigation.goBack()}
                isMobile={isMobile}
            />

            {/* Contenuto Schermata */}
            {activeTab === 'play' ? (
                <ScrollView contentContainerStyle={{ padding: isMobile ? 12 : 16, paddingBottom: 48, gap: 16 }}>
                    {isCompleted ? (
                        <CompletedMatchSummary
                            scoreUs={st.score.us}
                            scoreThem={st.score.them}
                            opponent={match.opponent}
                            pointsCount={st.points.length}
                            eventsCount={match.events?.length || 0}
                            holds={tStats.holds}
                            breaks={tStats.breaks}
                            toUs={tStats.toUs}
                            toThem={tStats.toThem}
                            isStaff={isStaff}
                            onOpenRoster={() => setModalRosterVisible(true)}
                            onToggleDone={handleToggleDone}
                            onOpenStats={() => setActiveTab('stats')}
                        />
                    ) : (
                        <>
                            {st.phase === 'line' && (
                                <LineSelectionPhase
                                    ptsN={ptsN}
                                    needRatio={needRatio}
                                    isStaff={isStaff}
                                    canEdit={canEdit}
                                    startOffense={lineStartO != null ? lineStartO : st.nextO}
                                    onSetLineStartO={setLineStartO}
                                    onFlipRatio={handleFlipRatio}
                                    halfTimeDone={st.halfTimeDone}
                                    onTriggerHalfTime={handleTriggerHalfTime}
                                    lastEventIsHalfTime={match.events && match.events.length > 0 && match.events[match.events.length - 1]?.k === 'halftime'}
                                    matchRoster={matchRoster}
                                    lineSel={lineSel}
                                    onTogglePlayerInLine={id => setLineSel(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
                                    onSetLineSel={setLineSel}
                                    pStats={pStats}
                                    isMobile={isMobile}
                                    fCountInSel={fCountInSel}
                                    mCountInSel={mCountInSel}
                                    isGenderRatioOk={isGenderRatioOk}
                                    lastPt={st.points.length ? st.points[st.points.length - 1] : null}
                                    lastO={[...st.points].reverse().find(p => p.o)}
                                    lastD={[...st.points].reverse().find(p => !p.o)}
                                    onStartPoint={(line, startOffense) => {
                                        pushEvent({ k: 'start', line, o: startOffense });
                                        setLineSel([]);
                                        setLineStartO(null);
                                        setPullPuller(null);
                                    }}
                                    onOpenRosterModal={() => setModalRosterVisible(true)}
                                />
                            )}
                            {st.phase === 'pull' && curPt && (
                                <PullRecordingPhase
                                    curPt={curPt}
                                    wePull={!curPt.o}
                                    canEdit={canEdit}
                                    pullPuller={pullPuller}
                                    onSetPullPuller={setPullPuller}
                                    onChangeLine={() => {
                                        setLineSel(curPt.line.slice());
                                        setSubStep('roster');
                                        setSubReason('error');
                                        setModalLineVisible(true);
                                    }}
                                    dset={st.dset}
                                    onSelectDset={dset => pushEvent({ k: 'dset', v: dset })}
                                    prevDots={pullPrevDots}
                                    isAttackingRight={isAttackingRight}
                                    onFlipDirection={handleFlipDir}
                                    onRecordPull={(puller, coord) => {
                                        pushEvent({
                                            k: 'pull',
                                            team: !curPt.o ? 'us' : 'them',
                                            p: puller,
                                            x: coord ? coord.x : null,
                                            y: coord ? coord.y : null
                                        });
                                        setPullPuller(null);
                                    }}
                                    P={P}
                                />
                            )}
                            {st.phase === 'play' && curPt && (
                                <PlayActionPhase
                                    curPt={curPt}
                                    isOffense={st.poss === 'us'}
                                    st={st}
                                    pending={pending}
                                    setPending={setPending}
                                    pendingTrajectory={pendingTrajectory}
                                    setPendingTrajectory={setPendingTrajectory}
                                    prevDots={playPrevDots}
                                    prevTrajectories={playPrevTrajectories}
                                    isAttackingRight={isAttackingRight}
                                    onFlipDirection={handleFlipDir}
                                    canEdit={canEdit}
                                    isMobile={isMobile}
                                    pStats={pStats}
                                    P={P}
                                    pushEvent={pushEvent}
                                    onChangeLine={() => {
                                        setLineSel(curPt.line.slice());
                                        setSubStep('roster');
                                        setSubReason('injury');
                                        setModalLineVisible(true);
                                    }}
                                />
                            )}
                        </>
                    )}
                </ScrollView>
            ) : (
                <MatchStatsView
                    tStats={tStats}
                    pStats={pStats}
                    isMobile={isMobile}
                    statsSortKey={statsSortKey}
                    statsSortAsc={statsSortAsc}
                    onToggleSort={toggleSort}
                    P={P}
                    st={st}
                    match={match}
                    playerMap={playerMap}
                    canEdit={canEdit}
                    onUpdatePullCoord={handleUpdatePullCoord}
                />
            )}

            {/* Modale Sostituzione Linea */}
            <LineSubstitutionModal
                visible={modalLineVisible}
                onClose={() => setModalLineVisible(false)}
                subStep={subStep}
                setSubStep={setSubStep}
                subReason={subReason}
                setSubReason={setSubReason}
                curPt={curPt}
                lineSel={lineSel}
                setLineSel={setLineSel}
                matchRoster={matchRoster}
                P={P}
                onApplyLineChange={applyLineChange}
            />

            {/* Modale Gestione Convocati & Rimappatura */}
            <MatchRosterModal
                visible={modalRosterVisible}
                onClose={() => setModalRosterVisible(false)}
                match={match}
                matchRoster={matchRoster}
                allMembers={allMembers}
                onUpdateCustomRoster={async updated => {
                    await updateMatchAnalysis({ id: match.id, customRoster: updated });
                }}
                onRemovePlayerFromRoster={handleRemovePlayerFromRoster}
                onRemapPlayer={handleRemapPlayer}
            />

            {/* Modale Modifica Manuale Tocchi */}
            <EditTouchesModal
                visible={modalTouchesVisible}
                match={match}
                playerMap={playerMap}
                onClose={() => setModalTouchesVisible(false)}
                onSave={async manualTouches => {
                    try {
                        await updateMatchAnalysis({
                            id: match.id,
                            manualTouches
                        });
                        showAlert("Tocchi Salvati", `I tocchi dei giocatori per questa partita sono stati aggiornati.`);
                    } catch (err: any) {
                        showAlert("Errore", err?.message || "Impossibile salvare i tocchi.");
                    }
                }}
            />
        </SafeAreaView>
    );
}
