// screens/LiveMatchScreen.tsx
// Interfaccia Live Match e Statistiche per partite di ultimate (CUS Brescia - Bubba)
import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Modal,
    TextInput,
    ActivityIndicator,
    Alert,
    useWindowDimensions
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenTitle from '../components/ScreenTitle';
import InteractiveField, { FieldDot, FieldTrajectory } from '../components/InteractiveField';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../App';
import {
    MatchAnalysis,
    MatchEvent,
    MatchRosterPlayer,
    subscribeToSingleMatch,
    updateMatchAnalysis,
    subscribeToMembers,
    Member
} from '../services/firestore';
import { remapEvents } from '../utils/matchImporter';
import {
    derive,
    ratioFor,
    ratioLabel,
    attRight,
    playerStats,
    teamStats,
    describeEvent,
    DSETS,
    LOC_EVENTS,
    FIELD,
    emptyPS
} from '../utils/statsEngine';
import { exportAndDownloadXLSX } from '../utils/matchExporter';
import { showAlert, showConfirmation } from '../utils/alert';
import EditTouchesModal from '../components/EditTouchesModal';

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
    const [statsFilter, setStatsFilter] = useState<string>('all');
    const [toStatsFilter, setToStatsFilter] = useState<'all' | 'toUs' | 'toThem'>('all');
    const [toOriginFilter, setToOriginFilter] = useState<'all' | 'O' | 'D'>('all');
    const [toFieldFlip, setToFieldFlip] = useState<boolean>(false);
    const [pendingTrajectory, setPendingTrajectory] = useState<{ x: number; y: number }[] | null>(null);
    const [statsSortKey, setStatsSortKey] = useState<string>('pts');
    const [statsSortAsc, setStatsSortAsc] = useState<boolean>(false);
    const [modalLineVisible, setModalLineVisible] = useState(false);
    const [subStep, setSubStep] = useState<'roster' | 'reason'>('roster');
    const [subReason, setSubReason] = useState<'injury' | 'error'>('injury');
    const [modalRosterVisible, setModalRosterVisible] = useState(false);
    const [modalTouchesVisible, setModalTouchesVisible] = useState(false);
    const [remappingPlayer, setRemappingPlayer] = useState<{ id: string; name: string; g: 'M' | 'F' } | null>(null);
    const [memberSearchQuery, setMemberSearchQuery] = useState('');
    const [allMemberSearchQuery, setAllMemberSearchQuery] = useState('');
    const [newGuestName, setNewGuestName] = useState('');
    const [newGuestGender, setNewGuestGender] = useState<'M' | 'F'>('F');
    const [dismissedHalfTimePrompt, setDismissedHalfTimePrompt] = useState(false);

    // Gestione step interattivi (es: chi ha segnato? chi ha fatto assist? dove è caduto il disco?)
    const [pending, setPending] = useState<{
        step: 'goal_s' | 'goal_a' | 'tt' | 'td' | 'ts' | 'd' | 'call' | 'where';
        s?: string; // scorer
        a?: string | null; // assistman
        e?: MatchEvent; // evento in attesa di coordinata x/y
    } | null>(null);

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

    // Roster effettivo della partita: se specificato customRoster usiamo solo i convocati, altrimenti fallback sui membri
    // Se un giocatore è collegato a un membro Bubba ufficiale, diamo sempre priorità al suo soprannome
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
        const map: Record<string, { name: string; g: 'M' | 'F' }> = {};
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

    const filteredMembersToRemap = useMemo(() => {
        if (!memberSearchQuery.trim()) return allMembers;
        const q = memberSearchQuery.toLowerCase();
        return allMembers.filter(m =>
            (m.nickname && m.nickname.toLowerCase().includes(q)) ||
            (m.firstName && m.firstName.toLowerCase().includes(q)) ||
            (m.lastName && m.lastName.toLowerCase().includes(q))
        );
    }, [allMembers, memberSearchQuery]);

    const filteredAllMembers = useMemo(() => {
        if (!allMemberSearchQuery.trim()) return allMembers;
        const q = allMemberSearchQuery.toLowerCase();
        return allMembers.filter(m =>
            (m.nickname && m.nickname.toLowerCase().includes(q)) ||
            (m.firstName && m.firstName.toLowerCase().includes(q)) ||
            (m.lastName && m.lastName.toLowerCase().includes(q))
        );
    }, [allMembers, allMemberSearchQuery]);

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

    // Derivazione stato di gioco ed eventi
    const st = useMemo(() => {
        return derive(match);
    }, [match]);

    const pStats = useMemo(() => {
        return playerStats([match]);
    }, [match]);

    const tStats = useMemo(() => {
        return teamStats(match);
    }, [match]);

    // Funzione di push evento su Firestore (append-only)
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

    // Annulla ultimo evento (Undo)
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

    // Inverti rapporto ABBA iniziale
    const handleFlipRatio = async () => {
        if (!canEdit) return;
        const newRatio: 'M' | 'F' = (match.firstRatio || 'F') === 'F' ? 'M' : 'F';
        try {
            await updateMatchAnalysis({ id: match.id, firstRatio: newRatio });
        } catch (e) {
            showAlert("Errore", "Impossibile invertire il rapporto.");
        }
    };

    // Inverti orientamento iniziale del campo
    const handleFlipDir = async () => {
        if (!canEdit) return;
        const newDir: 'R' | 'L' = (match.dir0 || 'R') === 'R' ? 'L' : 'R';
        try {
            await updateMatchAnalysis({ id: match.id, dir0: newDir });
        } catch (e) {
            showAlert("Errore", "Impossibile invertire la direzione del campo.");
        }
    };

    // Prompt per proposta Half Time quando una squadra raggiunge 7 punti
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

    // Termina o riapri partita
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

    // Export Excel singola partita
    const handleExportExcel = async () => {
        try {
            await exportAndDownloadXLSX([match], playerMap);
        } catch (e: any) {
            showAlert("Errore", e?.message || "Impossibile esportare l'Excel.");
        }
    };

    // Riassegna/collega un giocatore (ospite, importato o membro) a un membro ufficiale Bubba
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

            // Se il targetId è già presente, rimuoviamo oldPlayer per evitare duplicati
            let updatedRoster: MatchRosterPlayer[];
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

            // Rimappa tutti gli eventi passati (gol, assist, difese, presenze in linea)
            const updatedEvents = remapEvents(match.events || [], oldPlayer.id, targetId);

            await updateMatchAnalysis({
                id: match.id,
                customRoster: updatedRoster,
                events: updatedEvents
            });

            setLineSel(prev => prev.map(x => (x === oldPlayer.id ? targetId : x)));
            setRemappingPlayer(null);
            setMemberSearchQuery('');
            showAlert(
                'Giocatore Collegato',
                `"${oldPlayer.name}" è stato collegato a "${targetName}". Eventi, presenze e statistiche aggiornati!`
            );
        } catch (err: any) {
            console.error("handleRemapPlayer error:", err);
            showAlert('Errore', err?.message || 'Impossibile completare il collegamento del giocatore.');
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
                `"${playerName}" ha eventi o punti registrati in questa partita. Rimuoverlo dai convocati non cancellerà gli eventi passati. Continuare?`,
                performRemove,
                'Rimuovi'
            );
        } else {
            performRemove();
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
                <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 40 }} />
            </SafeAreaView>
        );
    }

    // Informazioni punto corrente
    const ptsN = st.points.length + 1;
    const curPt = st.cur;
    const needRatio = ratioFor(match, curPt ? curPt.n : ptsN);
    const isAttackingRight = attRight(match, curPt ? curPt.n : ptsN, st.halfTimePoint);

    // Conteggi ratio per la linea attualmente selezionata
    const fCountInSel = lineSel.filter(id => P(id).g === 'F').length;
    const mCountInSel = lineSel.length - fCountInSel;
    const isGenderRatioOk = needRatio === 'F' ? fCountInSel === 3 && mCountInSel === 2 : mCountInSel === 3 && fCountInSel === 2;

    // Applicazione del cambio linea durante il punto (per Infortunio o Correzione Errore Iniziale)
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
                const outPlayers = (curPt.line || []).filter(id => !lineSel.includes(id));
                const inPlayers = lineSel.filter(id => !(curPt.line || []).includes(id));

                currentEvents[lastStartIndex] = {
                    ...currentEvents[lastStartIndex],
                    line: lineSel.slice()
                };

                if (outPlayers.length === 1 && inPlayers.length === 1) {
                    const outId = outPlayers[0];
                    const inId = inPlayers[0];
                    for (let i = lastStartIndex + 1; i < currentEvents.length; i++) {
                        if (currentEvents[i].p === outId) {
                            currentEvents[i] = { ...currentEvents[i], p: inId };
                        }
                        if (currentEvents[i].s === outId) {
                            currentEvents[i] = { ...currentEvents[i], s: inId };
                        }
                        if (currentEvents[i].a === outId) {
                            currentEvents[i] = { ...currentEvents[i], a: inId };
                        }
                    }
                }

                const correctedEvents = currentEvents.filter((ev, idx) => {
                    if (idx > lastStartIndex && ev.k === 'line') {
                        return false;
                    }
                    return true;
                });

                const newDerive = derive({ pullFirst: match.pullFirst, events: correctedEvents });
                const updatedMatch: Partial<MatchAnalysis> & { id: string } = {
                    id: match.id,
                    events: correctedEvents,
                    ourScore: newDerive.score.us,
                    theirScore: newDerive.score.them,
                    status: match.status === 'scheduled' ? 'live' : match.status
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

    /* ----------------------------------------------------
       RENDER FASE 1: LINEA (Scelta dei 5 in campo)
    ---------------------------------------------------- */
    const renderPhaseLine = () => {
        if (isCompleted) return null;
        const startOffense = lineStartO != null ? lineStartO : st.nextO;
        const lastPt = st.points.length ? st.points[st.points.length - 1] : null;
        const lastO = [...st.points].reverse().find(p => p.o);
        const lastD = [...st.points].reverse().find(p => !p.o);

        return (
            <View style={styles.phaseContainer}>
                {/* Banner Regola ABBA */}
                <View style={[styles.ratioBanner, { backgroundColor: needRatio === 'F' ? '#B8338A' : '#1F6FD1' }]}>
                    <View>
                        <Text style={styles.ratioSub}>PUNTO {ptsN}</Text>
                        <Text style={styles.ratioMain}>{ratioLabel(needRatio)}</Text>
                    </View>
                    {isStaff && (
                        <TouchableOpacity style={styles.ratioFlipBtn} onPress={handleFlipRatio}>
                            <Text style={styles.ratioFlipText}>⇄ Inverti</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Card Selezione Linea */}
                <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                    <View style={styles.rowBetween}>
                        <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Punto {ptsN} — Scegli Linea</Text>
                        {isStaff && (
                            <View style={styles.segment}>
                                <TouchableOpacity
                                    style={[styles.segBtn, startOffense && styles.segBtnOn]}
                                    onPress={() => setLineStartO(true)}
                                >
                                    <Text style={[styles.segText, startOffense && styles.segTextOn]}>Attacco</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.segBtn, !startOffense && styles.segBtnOn]}
                                    onPress={() => setLineStartO(false)}
                                >
                                    <Text style={[styles.segText, !startOffense && styles.segTextOn]}>Difesa</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 6, flexWrap: 'wrap', gap: 6 }}>
                        <Text style={[styles.muted, { color: theme.colors.textSecondary, flex: 1, minWidth: 140 }]}>
                            {startOffense ? 'Loro battono il pull, noi riceviamo.' : 'Facciamo noi il pull.'}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            {canEdit && !st.halfTimeDone && (
                                <TouchableOpacity
                                    style={styles.halfTimeBtn}
                                    onPress={handleTriggerHalfTime}
                                >
                                    <Text style={styles.halfTimeBtnText}>⏱️ Half Time</Text>
                                </TouchableOpacity>
                            )}
                            {st.halfTimeDone && (
                                <View style={styles.halfTimeBadge}>
                                    <Text style={styles.halfTimeBadgeText}>🏁 2° TEMPO</Text>
                                </View>
                            )}
                            {canEdit && (
                                <TouchableOpacity
                                    style={{
                                        paddingHorizontal: 10,
                                        paddingVertical: 5,
                                        borderRadius: 8,
                                        backgroundColor: theme.colors.primary + '18',
                                        borderWidth: 1,
                                        borderColor: theme.colors.primary,
                                    }}
                                    onPress={() => setModalRosterVisible(true)}
                                >
                                    <Text style={{ fontSize: 11, fontWeight: 'bold', color: theme.colors.primary }}>
                                        👥 Convocati ({matchRoster.length})
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    {match.events && match.events.length > 0 && match.events[match.events.length - 1]?.k === 'halftime' && (
                        <View style={styles.halfTimeNotice}>
                            <Text style={styles.halfTimeNoticeText}>
                                ⏱️ Half Time attivato: ruoli invertiti rispetto all'avvio della partita!
                            </Text>
                        </View>
                    )}

                    {/* Griglia Giocatori Roster */}
                    <View style={styles.playerGrid}>
                        {matchRoster.map(p => {
                            const isSel = lineSel.includes(p.id);
                            const ps = pStats[p.id] || emptyPS();
                            return (
                                <TouchableOpacity
                                    key={p.id}
                                    style={[
                                        styles.pbtn,
                                        isMobile ? styles.pbtnMobile : styles.pbtnDesktop,
                                        isSel && styles.pbtnSel,
                                        { backgroundColor: isSel ? '#E3ECF5' : theme.colors.card, borderColor: isSel ? '#003057' : theme.colors.border }
                                    ]}
                                    onPress={() => {
                                        if (!canEdit) return;
                                        setLineSel(prev => (prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id]));
                                    }}
                                >
                                    <View style={{ paddingRight: 24 }}>
                                        <Text style={[styles.pbtnName, { color: theme.colors.text }]} numberOfLines={1} ellipsizeMode="tail">
                                            {p.name}
                                        </Text>
                                    </View>
                                    <View style={[styles.genderBadge, { backgroundColor: p.g === 'F' ? '#B8338A' : '#1F6FD1' }]}>
                                        <Text style={styles.genderText}>{p.g}</Text>
                                    </View>
                                    <Text style={styles.pbtnSub} numberOfLines={1}>
                                        {ps.pts} pt ({ps.ptsO}O / {ps.ptsD}D)
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {/* Badge di conteggio e validazione */}
                    <View style={styles.lineBar}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', flex: isMobile ? undefined : 1 }}>
                            <View
                                style={[
                                    styles.chip,
                                    { backgroundColor: lineSel.length === 5 && isGenderRatioOk ? '#C0D725' : '#FFE1E1' }
                                ]}
                            >
                                <Text style={styles.chipText}>
                                    {lineSel.length}/5 · {fCountInSel}F {mCountInSel}M
                                </Text>
                            </View>
                            {canEdit && (
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', gap: 6 }}>
                                    {lastPt && (
                                        <TouchableOpacity
                                            style={styles.lineUtilBtn}
                                            onPress={() => setLineSel(lastPt.line.slice())}
                                        >
                                            <Text style={styles.lineUtilText}>Precedente</Text>
                                        </TouchableOpacity>
                                    )}
                                    {lastO && (
                                        <TouchableOpacity
                                            style={styles.lineUtilBtn}
                                            onPress={() => setLineSel(lastO.line.slice())}
                                        >
                                            <Text style={styles.lineUtilText}>Ultima O</Text>
                                        </TouchableOpacity>
                                    )}
                                    {lastD && (
                                        <TouchableOpacity
                                            style={styles.lineUtilBtn}
                                            onPress={() => setLineSel(lastD.line.slice())}
                                        >
                                            <Text style={styles.lineUtilText}>Ultima D</Text>
                                        </TouchableOpacity>
                                    )}
                                    <TouchableOpacity style={styles.lineUtilBtn} onPress={() => setLineSel([])}>
                                        <Text style={styles.lineUtilText}>Svuota</Text>
                                    </TouchableOpacity>
                                </ScrollView>
                            )}
                        </View>

                        {canEdit && (
                            <TouchableOpacity
                                style={[
                                    styles.startPtBtn,
                                    isMobile && styles.startPtBtnMobile,
                                    { opacity: lineSel.length === 5 && isGenderRatioOk ? 1 : 0.4 }
                                ]}
                                disabled={lineSel.length !== 5 || !isGenderRatioOk}
                                onPress={() => {
                                    pushEvent({
                                        k: 'start',
                                        line: lineSel.slice(),
                                        o: startOffense
                                    });
                                    setLineSel([]);
                                    setLineStartO(null);
                                    setPullPuller(null);
                                }}
                            >
                                <Text style={styles.startPtText}>Avvia Punto ▸</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>
        );
    };

    /* ----------------------------------------------------
       RENDER FASE 2: PULL (Registrazione del pull)
    ---------------------------------------------------- */
    const renderPhasePull = () => {
        if (isCompleted || !curPt) return null;
        const wePull = !curPt.o;

        const prevDots: FieldDot[] = st.points
            .filter(p => p.pull && p.pull.x != null && p.pull.team === (wePull ? 'us' : 'them'))
            .map(p => ({
                x: p.pull!.x!,
                y: p.pull!.y!,
                c: '#B0B2B5',
                r: 0.8
            }));

        return (
            <View style={styles.phaseContainer}>
                <View style={[styles.statusBanner, { backgroundColor: wePull ? '#003057' : '#C0D725', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                    <Text style={[styles.statusTitle, { color: wePull ? '#fff' : '#131E29' }]}>
                        PUNTO {curPt.n} · {wePull ? 'PULL NOSTRO (DIFESA)' : 'PULL LORO (ATTACCO)'}
                    </Text>
                    {canEdit && (
                        <TouchableOpacity
                            style={[styles.changeLineBtn, { backgroundColor: wePull ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)' }]}
                            onPress={() => {
                                setLineSel(curPt.line.slice());
                                setSubStep('roster');
                                setSubReason('error');
                                setModalLineVisible(true);
                            }}
                        >
                            <Text style={[styles.changeLineText, { color: wePull ? '#fff' : '#131E29' }]}>Cambio Linea</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {wePull && (
                    <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                        <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Chi effettua il Pull?</Text>
                        <View style={styles.playerGrid}>
                            {curPt.line.map(id => {
                                const isSelected = pullPuller === id;
                                return (
                                    <TouchableOpacity
                                        key={id}
                                        style={[
                                            styles.pbtn,
                                            isSelected && styles.pbtnSel,
                                            { backgroundColor: isSelected ? '#E3ECF5' : theme.colors.card, borderColor: isSelected ? '#003057' : theme.colors.border }
                                        ]}
                                        onPress={() => canEdit && setPullPuller(id)}
                                    >
                                        <Text style={[styles.pbtnName, { color: theme.colors.text }]}>{P(id).name}</Text>
                                        <View style={[styles.genderBadge, { backgroundColor: P(id).g === 'F' ? '#B8338A' : '#1F6FD1' }]}>
                                            <Text style={styles.genderText}>{P(id).g}</Text>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                )}

                {/* Scelta Schema di Difesa anticipata in fase di Pull */}
                {wePull && canEdit && (
                    <View style={[styles.defenseCard, { backgroundColor: theme.colors.card, borderColor: st.dset ? '#E07A1F' : theme.colors.border }]}>
                        <View style={styles.defenseCardHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={styles.defenseCardIcon}>🛡️</Text>
                                <Text style={[styles.defenseCardTitle, { color: theme.colors.text }]}>
                                    SCHEMA DI DIFESA
                                </Text>
                            </View>
                            {st.dset ? (
                                <View style={styles.activeSchemaTag}>
                                    <Text style={styles.activeSchemaTagText}>ATTIVO: {st.dset.toUpperCase()}</Text>
                                </View>
                            ) : (
                                <View style={styles.missingSchemaTag}>
                                    <Text style={styles.missingSchemaTagText}>⚠️ SELEZIONA SCHEMA</Text>
                                </View>
                            )}
                        </View>
                        <View style={styles.defenseSchemaRow}>
                            {DSETS.map(v => {
                                const isSel = st.dset === v;
                                return (
                                    <TouchableOpacity
                                        key={v}
                                        style={[
                                            styles.defenseSchemaBtn,
                                            {
                                                backgroundColor: isSel ? '#E07A1F' : theme.dark ? '#1E293B' : '#F8FAFC',
                                                borderColor: isSel ? '#C25E0A' : theme.dark ? '#334155' : '#CBD5E1'
                                            },
                                            isSel && styles.defenseSchemaBtnActive
                                        ]}
                                        onPress={() => {
                                            if (st.dset !== v) pushEvent({ k: 'dset', v });
                                        }}
                                    >
                                        <Text style={[styles.defenseSchemaText, { color: isSel ? '#FFFFFF' : theme.colors.text }, isSel && styles.defenseSchemaTextActive]}>
                                            {v}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                )}

                <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <Text style={[styles.cardTitle, { color: theme.colors.text, marginBottom: 0 }]}>
                            Tocca dove atterra il Pull
                        </Text>
                        <Text style={{ fontSize: 11, fontWeight: 'bold', color: wePull ? '#003057' : '#E07A1F' }}>
                            {wePull ? '🎯 NOSTRO PULL' : '🛡️ PULL AVVERSARIO'}
                        </Text>
                    </View>
                    <Text style={{ fontSize: 11, color: theme.colors.textSecondary, marginBottom: 8 }}>
                        Tocca sul campo per salvare le coordinate del pull oppure usa Schermo Intero per la massima precisione
                    </Text>
                    <InteractiveField
                        dots={prevDots}
                        interactive={canEdit}
                        isPlayMode={false}
                        flip={isAttackingRight !== wePull}
                        onFieldPress={coord => {
                            if (!canEdit) return;
                            if (wePull && !pullPuller) {
                                showAlert("Attenzione", "Seleziona prima chi effettua il pull.");
                                return;
                            }
                            pushEvent({
                                k: 'pull',
                                team: wePull ? 'us' : 'them',
                                p: wePull ? pullPuller : null,
                                x: coord.x,
                                y: coord.y
                            });
                            setPullPuller(null);
                        }}
                        onFlipDirection={handleFlipDir}
                    />

                    {canEdit && (
                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 }}>
                            <TouchableOpacity
                                style={styles.skipBtn}
                                onPress={() => {
                                    pushEvent({
                                        k: 'pull',
                                        team: wePull ? 'us' : 'them',
                                        p: null,
                                        x: null,
                                        y: null
                                    });
                                }}
                            >
                                <Text style={styles.skipBtnText}>Salta (Non registrare coordinate)</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </View>
        );
    };

    /* ----------------------------------------------------
       RENDER FASE 3: PLAY (Azioni durante il possesso)
    ---------------------------------------------------- */
    const renderPhasePlay = () => {
        if (isCompleted || !curPt) return null;
        const isOffense = st.poss === 'us';
        const prevDots: FieldDot[] = [];
        const prevTrajectories: FieldTrajectory[] = [];
        for (const p of st.points) {
            for (const e of (p.ev || [])) {
                const isLoc = e.k === 'tt' || e.k === 'td' || e.k === 'ts' || e.k === 'tx' || e.k === 'd' || e.k === 'call' || e.k === 'err';
                if (isLoc && e.x != null && e.y != null) {
                    const isThem = e.k === 'd' || e.k === 'call' || e.k === 'err';
                    const evColor = isThem
                        ? '#E07A1F'
                        : (p.o ? '#C8323C' : '#1F6FD1');
                    prevDots.push({
                        x: e.x,
                        y: e.y,
                        c: evColor,
                        r: 0.8
                    });
                    if (e.trajectory && e.trajectory.length >= 2) {
                        prevTrajectories.push({
                            points: e.trajectory,
                            color: evColor
                        });
                    }
                }
            }
        }

        // Se siamo in attesa di coordinata campo ("DOVE?")
        if (pending && pending.step === 'where') {

            const currentEvent = pending.e;
            const isThrowTO = currentEvent?.k === 'tt';
            const isOpponentError = currentEvent?.k === 'err';
            const isTrajectoryTO = isThrowTO || isOpponentError;
            const toColor = isOpponentError ? '#E07A1F' : (curPt.o ? '#C8323C' : '#1F6FD1');

            const eventDesc = isThrowTO ? 'TO LANCIO'
                : currentEvent?.k === 'td' ? 'TO PRESA'
                : currentEvent?.k === 'ts' ? 'STALL OUT'
                : currentEvent?.k === 'd' ? 'DIFESA'
                : currentEvent?.k === 'call' ? 'CALLAHAN'
                : isOpponentError ? 'ERRORE LORO'
                : 'TURNOVER';

            const playerDesc = currentEvent?.p ? ` — ${P(currentEvent.p).name}` : '';

            // Se è presente una traiettoria attiva o appena disegnata
            const currentTrajectories = [...prevTrajectories];
            if (pendingTrajectory && pendingTrajectory.length >= 2) {
                currentTrajectories.push({ points: pendingTrajectory, color: toColor });
            }

            const isThem = currentEvent?.k === 'd' || currentEvent?.k === 'call' || isOpponentError;
            const bannerBg = isThem
                ? '#E07A1F'
                : (curPt.o ? '#C8323C' : '#1F6FD1');

            return (
                <View style={styles.phaseContainer}>
                    <View style={[styles.statusBanner, { backgroundColor: bannerBg }]}>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.statusTitle, { color: '#fff' }]}>
                                {eventDesc}{playerDesc}
                            </Text>
                            <Text style={[styles.statusSub, { color: '#fff' }]}>
                                {isTrajectoryTO
                                    ? (pendingTrajectory ? 'Traiettoria tracciata! Verifica la freccia verso il punto di caduta' : 'Traccia con il mouse o con il dito la traiettoria verso il punto di caduta')
                                    : 'Segna la posizione sul campo'}
                            </Text>
                        </View>
                    </View>

                    <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <Text style={[styles.cardTitle, { color: theme.colors.text, marginBottom: 0 }]}>
                                {isTrajectoryTO ? 'Disegna la traiettoria del disco' : 'Tocca dove è avvenuta l\'azione'}
                            </Text>
                            <TouchableOpacity
                                style={styles.promptActionBtn}
                                onPress={() => {
                                    setPending(null);
                                    setPendingTrajectory(null);
                                }}
                            >
                                <Text style={styles.promptActionText}>Annulla</Text>
                            </TouchableOpacity>
                        </View>
                        <Text style={{ fontSize: 11, color: theme.colors.textSecondary, marginBottom: 8 }}>
                            {isOpponentError
                                ? 'Tieni premuto e trascina per disegnare la traiettoria dell\'errore oppure tocca un punto per registrare una Difesa'
                                : isTrajectoryTO
                                    ? 'Trascina con il mouse o con il dito sul campo dal punto di rilascio a dove è caduto il disco (la freccia indicherà l\'arrivo)'
                                    : 'Tocca sul campo per salvare le coordinate oppure tocca "Salta" sotto se non vuoi registrarle'}
                        </Text>

                        <InteractiveField
                            dots={prevDots}
                            trajectories={currentTrajectories}
                            interactive={canEdit}
                            drawTrajectoryMode={isTrajectoryTO && !pendingTrajectory}
                            drawingColor={toColor}
                            isPlayMode={true}
                            flip={!isAttackingRight}
                            onTrajectoryComplete={traj => {
                                setPendingTrajectory(traj);
                            }}
                            onFieldPress={coord => {
                                const e = pending.e!;
                                setPendingTrajectory(null);
                                if (e.k === 'err' || (!isOffense && e.k !== 'd' && e.k !== 'call')) {
                                    if (e.p) {
                                        setPending(null);
                                        pushEvent({ k: 'd', p: e.p, x: coord.x, y: coord.y });
                                    } else {
                                        setPending({ step: 'd', e: { k: 'd', x: coord.x, y: coord.y } });
                                    }
                                } else {
                                    setPending(null);
                                    pushEvent({ ...e, x: coord.x, y: coord.y });
                                }
                            }}
                            onFlipDirection={handleFlipDir}
                        />

                        {/* Barra azioni per confermare o ridisegnare la traiettoria curva */}
                        {isTrajectoryTO && pendingTrajectory ? (
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, gap: 8 }}>
                                <TouchableOpacity
                                    style={{
                                        backgroundColor: '#E2E8F0',
                                        paddingHorizontal: 12,
                                        paddingVertical: 9,
                                        borderRadius: 8
                                    }}
                                    onPress={() => setPendingTrajectory(null)}
                                >
                                    <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#1E293B' }}>↺ Ridisegna</Text>
                                </TouchableOpacity>

                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                    <TouchableOpacity
                                        style={styles.skipBtn}
                                        onPress={() => {
                                            const e = pending.e!;
                                            setPending(null);
                                            setPendingTrajectory(null);
                                            pushEvent(e);
                                        }}
                                    >
                                        <Text style={styles.skipBtnText}>Salta</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.skipBtn, { backgroundColor: '#2E8540', borderColor: '#2E8540' }]}
                                        onPress={() => {
                                            const e = pending.e!;
                                            const lastPt = pendingTrajectory[pendingTrajectory.length - 1];
                                            setPending(null);
                                            setPendingTrajectory(null);
                                            pushEvent({
                                                ...e,
                                                x: lastPt.x,
                                                y: lastPt.y,
                                                trajectory: pendingTrajectory
                                            });
                                        }}
                                    >
                                        <Text style={[styles.skipBtnText, { color: '#fff', fontWeight: 'bold' }]}>
                                            Conferma Traiettoria ✓
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : (
                            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 }}>
                                <TouchableOpacity
                                    style={styles.skipBtn}
                                    onPress={() => {
                                        const e = pending.e!;
                                        setPending(null);
                                        setPendingTrajectory(null);
                                        pushEvent(e);
                                    }}
                                >
                                    <Text style={styles.skipBtnText}>Salta (Non registrare coordinate)</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            );
        }

        // Se siamo in attesa di selezione giocatore (Marcatore, Assist, TO, Difesa)
        let promptText = '';
        let isPickable = false;
        let excludeId: string | undefined = undefined;

        if (pending) {
            const labels: Record<string, string> = {
                goal_a: 'Chi ha fatto l\'ASSIST?',
                goal_s: pending.a ? `Assist di ${P(pending.a).name}. Chi ha SEGNATO la meta?` : 'Chi ha SEGNATO la meta?',
                tt: 'Chi ha sbagliato il LANCIO?',
                td: 'Chi ha sbagliato la PRESA?',
                ts: 'Chi ha subito lo STALL OUT?',
                d: 'Chi ha fatto la DIFESA?',
                call: 'Chi ha fatto il CALLAHAN?'
            };
            promptText = labels[pending.step] || 'Seleziona giocatore:';
            isPickable = true;
            if (pending.step === 'goal_s' && pending.a) excludeId = pending.a;
        }

        return (
            <View style={styles.phaseContainer}>
                {/* Banner Possesso Palla */}
                <View style={[styles.statusBanner, { backgroundColor: isOffense ? '#C0D725' : '#003057' }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={[styles.statusTitle, { color: isOffense ? '#131E29' : '#fff' }]}>
                            {isOffense ? 'DISCO NOSTRO — ATTACCO' : 'DISCO LORO — DIFESA'}
                        </Text>
                        {!isOffense && (
                            <View style={{
                                backgroundColor: st.dset ? '#E07A1F' : 'rgba(255,255,255,0.22)',
                                paddingHorizontal: 10,
                                paddingVertical: 3,
                                borderRadius: 12,
                                borderWidth: 1,
                                borderColor: st.dset ? '#C25E0A' : 'rgba(255,255,255,0.4)'
                            }}>
                                <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>
                                    {st.dset ? `🛡️ ${st.dset.toUpperCase()}` : '🛡️ SCHEMA ?'}
                                </Text>
                            </View>
                        )}
                    </View>
                    <Text style={[styles.statusSub, { color: isOffense ? '#131E29' : '#fff' }]}>
                        TO nostri: {curPt.toUs} · TO loro: {curPt.toThem}{isOffense ? ` · Tocchi: ${curPt.touches || 0}${st.holder ? ` · 🥏 ${P(st.holder).name}` : ''}` : ''}
                    </Text>
                </View>

                {/* Prompt selezione giocatore in corso */}
                {pending && (
                    <View style={styles.promptBanner}>
                        <Text style={styles.promptTitle}>{promptText}</Text>
                        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                            {pending.step === 'goal_s' && pending.a && (
                                <TouchableOpacity
                                    style={styles.promptActionBtn}
                                    onPress={() => {
                                        setPending({ step: 'goal_a' });
                                    }}
                                >
                                    <Text style={styles.promptActionText}>Cambia Assist</Text>
                                </TouchableOpacity>
                            )}
                            {pending.step === 'goal_s' && pending.a && (
                                <TouchableOpacity
                                    style={styles.promptActionBtn}
                                    onPress={() => {
                                        setPending({ step: 'goal_s', a: null });
                                    }}
                                >
                                    <Text style={styles.promptActionText}>Nessun Assist</Text>
                                </TouchableOpacity>
                            )}
                            {pending.step === 'goal_a' && (
                                <TouchableOpacity
                                    style={styles.promptActionBtn}
                                    onPress={() => {
                                        setPending({ step: 'goal_s', a: null });
                                    }}
                                >
                                    <Text style={styles.promptActionText}>Nessun Assist</Text>
                                </TouchableOpacity>
                            )}
                            {pending.step === 'd' && pending.e && pending.e.x != null && (
                                <TouchableOpacity
                                    style={styles.promptActionBtn}
                                    onPress={() => {
                                        const e = pending.e!;
                                        setPending(null);
                                        pushEvent({ ...e, p: null });
                                    }}
                                >
                                    <Text style={styles.promptActionText}>Senza Giocatore</Text>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity style={styles.promptActionBtn} onPress={() => setPending(null)}>
                                <Text style={styles.promptActionText}>Annulla</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* I 5 Giocatori in Campo */}
                <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                    <View style={styles.rowBetween}>
                        <View>
                            <Text style={[styles.cardTitle, { color: theme.colors.text, marginBottom: isOffense && !pending ? 2 : 8 }]}>Giocatori in Campo</Text>
                            {isOffense && !pending && (
                                <Text style={{ fontSize: 11, color: theme.colors.textSecondary, marginBottom: 6 }}>
                                    Tocca un giocatore per passare il disco 🥏
                                </Text>
                            )}
                        </View>
                        {canEdit && (
                            <TouchableOpacity
                                style={styles.changeLineBtn}
                                onPress={() => {
                                    setLineSel(curPt.line.slice());
                                    setSubStep('roster');
                                    setSubReason('injury');
                                    setModalLineVisible(true);
                                }}
                            >
                                <Text style={styles.changeLineText}>Cambio Linea</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    <View style={styles.playerGrid}>
                        {curPt.line.map(id => {
                            const isHolder = isOffense && st.holder === id;
                            const canPick = (isPickable || (canEdit && isOffense && !pending)) && id !== excludeId;
                            const ps = pStats[id] || emptyPS();
                            return (
                                <TouchableOpacity
                                    key={id}
                                    style={[
                                        styles.pbtn,
                                        isMobile ? styles.pbtnMobile : styles.pbtnDesktop,
                                        canPick && pending && styles.pbtnPick,
                                        isHolder && styles.pbtnHolder,
                                        {
                                            backgroundColor: isHolder
                                                ? (theme.dark ? '#1B382B' : '#E8F5E9')
                                                : (canPick && pending ? (theme.dark ? '#2A3B1D' : '#F6FAD9') : theme.colors.card),
                                            borderColor: isHolder
                                                ? '#2E8540'
                                                : (canPick && pending ? '#C0D725' : (canPick && isOffense ? '#8EA325' : theme.colors.border))
                                        }
                                    ]}
                                    disabled={!canPick}
                                    onPress={() => {
                                        if (!pending) {
                                            if (canEdit && isOffense) {
                                                pushEvent({ k: 'touch', p: id });
                                            }
                                            return;
                                        }
                                        if (pending.step === 'goal_a') {
                                            setPending({ step: 'goal_s', a: id });
                                        } else if (pending.step === 'goal_s') {
                                            const assist = pending.a;
                                            setPending(null);
                                            pushEvent({ k: 'goal', s: id, a: assist || null });
                                        } else {
                                            const stepKey = pending.step;
                                            if (stepKey === 'tt' || stepKey === 'td' || stepKey === 'ts' || stepKey === 'd' || stepKey === 'call') {
                                                if (pending.e && pending.e.x != null && pending.e.y != null) {
                                                    const e = pending.e;
                                                    setPending(null);
                                                    pushEvent({ ...e, p: id });
                                                } else {
                                                    setPending({ step: 'where', e: { k: stepKey, p: id } });
                                                }
                                            }
                                        }
                                    }}
                                >
                                    <View style={{ paddingRight: 24, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                        {isHolder && <Text style={{ fontSize: 12 }}>🥏</Text>}
                                        <Text style={[styles.pbtnName, { color: isHolder ? '#2E8540' : theme.colors.text }]} numberOfLines={1} ellipsizeMode="tail">
                                            {P(id).name}
                                        </Text>
                                    </View>
                                    <View style={[styles.genderBadge, { backgroundColor: P(id).g === 'F' ? '#B8338A' : '#1F6FD1' }]}>
                                        <Text style={styles.genderText}>{P(id).g}</Text>
                                    </View>
                                    <Text style={styles.pbtnSub} numberOfLines={1}>
                                        {isHolder ? 'DISCO · ' : ''}Tch {ps.touches || 0} · M {ps.goals} · A {ps.ast} · D {ps.ds} · TO {ps.toTot}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                {/* Selezione Schema di Difesa in Evidenza (Disponibile in fase di Difesa) */}
                {canEdit && !pending && !isOffense && (
                    <View style={[styles.defenseCard, { backgroundColor: theme.colors.card, borderColor: st.dset ? '#E07A1F' : theme.colors.border }]}>
                        <View style={styles.defenseCardHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={styles.defenseCardIcon}>🛡️</Text>
                                <Text style={[styles.defenseCardTitle, { color: theme.colors.text }]}>
                                    SCHEMA DI DIFESA
                                </Text>
                            </View>
                            {st.dset ? (
                                <View style={styles.activeSchemaTag}>
                                    <Text style={styles.activeSchemaTagText}>ATTIVO: {st.dset.toUpperCase()}</Text>
                                </View>
                            ) : (
                                <View style={styles.missingSchemaTag}>
                                    <Text style={styles.missingSchemaTagText}>⚠️ SELEZIONA SCHEMA</Text>
                                </View>
                            )}
                        </View>
                        <View style={styles.defenseSchemaRow}>
                            {DSETS.map(v => {
                                const isSel = st.dset === v;
                                return (
                                    <TouchableOpacity
                                        key={v}
                                        style={[
                                            styles.defenseSchemaBtn,
                                            {
                                                backgroundColor: isSel ? '#E07A1F' : theme.dark ? '#1E293B' : '#F8FAFC',
                                                borderColor: isSel ? '#C25E0A' : theme.dark ? '#334155' : '#CBD5E1'
                                            },
                                            isSel && styles.defenseSchemaBtnActive
                                        ]}
                                        onPress={() => {
                                            if (st.dset !== v) pushEvent({ k: 'dset', v });
                                        }}
                                    >
                                        <Text style={[styles.defenseSchemaText, { color: isSel ? '#FFFFFF' : theme.colors.text }, isSel && styles.defenseSchemaTextActive]}>
                                            {v}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                )}



                {/* Azioni di Gioco (Disponibili per Staff quando non c'è pending e la partita è attiva) */}
                {canEdit && !pending && (
                    <View style={styles.actionsContainer}>
                        {isOffense ? (
                            <>
                                <TouchableOpacity
                                    style={[styles.actBtn, styles.actBtnHero, { backgroundColor: '#2E8540' }]}
                                    onPress={() => {
                                        if (st.holder) {
                                            setPending({ step: 'goal_s', a: st.holder });
                                        } else {
                                            setPending({ step: 'goal_a' });
                                        }
                                    }}
                                >
                                    <Text style={styles.actTitle}>⭐ META</Text>
                                    <Text style={styles.actSub}>
                                        {st.holder ? `Assist: ${P(st.holder).name}` : 'poi assist + meta'}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.actBtn, { backgroundColor: '#C8323C' }]}
                                    onPress={() => {
                                        if (st.holder) {
                                            setPending({ step: 'where', e: { k: 'tt', p: st.holder } });
                                        } else {
                                            setPending({ step: 'tt' });
                                        }
                                    }}
                                >
                                    <Text style={styles.actTitle}>TO LANCIO</Text>
                                    <Text style={styles.actSub}>
                                        {st.holder ? `Lancio: ${P(st.holder).name}` : 'lancio sbagliato / bloccato'}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.actBtn, { backgroundColor: '#C8323C' }]}
                                    onPress={() => setPending({ step: 'td' })}
                                >
                                    <Text style={styles.actTitle}>TO PRESA</Text>
                                    <Text style={styles.actSub}>presa sbagliata</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.actBtn, { backgroundColor: '#9E2A31' }]}
                                    onPress={() => setPending({ step: 'ts' })}
                                >
                                    <Text style={styles.actTitle}>STALL OUT</Text>
                                    <Text style={styles.actSub}>fine conteggio</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.actBtn, { backgroundColor: '#9E2A31' }]}
                                    onPress={() => setPending({ step: 'where', e: { k: 'tx' } })}
                                >
                                    <Text style={styles.actTitle}>TO ALTRO</Text>
                                    <Text style={styles.actSub}>senza giocatore</Text>
                                </TouchableOpacity>
                            </>
                        ) : (
                            <>
                                <TouchableOpacity
                                    style={[styles.actBtn, { backgroundColor: '#003057' }]}
                                    onPress={() => setPending({ step: 'd' })}
                                >
                                    <Text style={styles.actTitle}>DIFESA (D)</Text>
                                    <Text style={styles.actSub}>block / intercetto</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.actBtn, { backgroundColor: '#3D6E99' }]}
                                    onPress={() => setPending({ step: 'where', e: { k: 'err' } })}
                                >
                                    <Text style={styles.actTitle}>ERRORE LORO</Text>
                                    <Text style={styles.actSub}>turnover avversario</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.actBtn, { backgroundColor: '#5B6570' }]}
                                    onPress={() => pushEvent({ k: 'tg' })}
                                >
                                    <Text style={styles.actTitle}>META LORO</Text>
                                    <Text style={styles.actSub}>punto subito</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.actBtn, { backgroundColor: '#7A5AA8' }]}
                                    onPress={() => setPending({ step: 'call' })}
                                >
                                    <Text style={styles.actTitle}>CALLAHAN</Text>
                                    <Text style={styles.actSub}>intercetto in meta</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                )}
            </View>
        );
    };

    /* ----------------------------------------------------
       RENDER TAB STATISTICHE (Squadra, Giocatori, Mappa Pull)
    ---------------------------------------------------- */
    const renderStatsTab = () => {
        const ids = Object.keys(pStats).sort((a, b) => {
            const valA = (pStats[a] as any)[statsSortKey] ?? 0;
            const valB = (pStats[b] as any)[statsSortKey] ?? 0;
            if (valA !== valB) {
                return statsSortAsc ? valA - valB : valB - valA;
            }
            return P(a).name.localeCompare(P(b).name);
        });

        const toggleSort = (key: string) => {
            if (statsSortKey === key) {
                setStatsSortAsc(!statsSortAsc);
            } else {
                setStatsSortKey(key);
                setStatsSortAsc(false);
            }
        };

        // Punti pull da mostrare nella mappa
        const pullDots: FieldDot[] = [];
        let totalPulls = 0;
        let usPulls = 0;
        let themPulls = 0;

        for (const pt of st.points) {
            const pl = pt.pull;
            if (!pl || pl.x == null || pl.y == null) continue;
            totalPulls++;
            if (pl.team === 'us') usPulls++; else themPulls++;

            const show =
                statsFilter === 'all' ||
                (statsFilter === 'us' && pl.team === 'us') ||
                (statsFilter === 'them' && pl.team === 'them') ||
                statsFilter === pl.p;

            if (show) {
                pullDots.push({
                    x: pl.x,
                    y: pl.y,
                    c: pl.team === 'us' ? '#003057' : '#E07A1F',
                    r: 1.2,
                    label: pl.p ? P(pl.p).name.slice(0, 3).toUpperCase() : undefined
                });
            }
        }

        // Punti e Traiettorie Turnover & Difese da mostrare nella mappa
        const toDots: FieldDot[] = [];
        const toTrajectories: FieldTrajectory[] = [];
        let toUsCount = 0;
        let toThemCount = 0;
        let oPointCount = 0;
        let dPointCount = 0;

        for (const pt of st.points) {
            for (const e of pt.ev) {
                if (!e || e.x == null || e.y == null) continue;
                const isToUs = e.k === 'tt' || e.k === 'td' || e.k === 'ts' || e.k === 'tx';
                const isToThem = e.k === 'err' || e.k === 'd' || e.k === 'call';
                if (!isToUs && !isToThem) continue;

                if (isToUs) toUsCount++;
                else if (isToThem) toThemCount++;

                if (pt.o) oPointCount++;
                else dPointCount++;

                let matchType = false;
                if (toStatsFilter === 'all') matchType = true;
                else if (toStatsFilter === 'toUs') matchType = isToUs;
                else if (toStatsFilter === 'toThem') matchType = isToThem;

                let matchOrigin = false;
                if (toOriginFilter === 'all') matchOrigin = true;
                else if (toOriginFilter === 'O') matchOrigin = !!pt.o;
                else if (toOriginFilter === 'D') matchOrigin = !pt.o;

                if (matchType && matchOrigin) {
                    const color = isToThem ? '#E07A1F' : (pt.o ? '#C8323C' : '#1F6FD1');
                    let shortCode = 'TO';
                    if (e.k === 'tt') shortCode = 'LAN';
                    else if (e.k === 'td') shortCode = 'PRE';
                    else if (e.k === 'ts') shortCode = 'STL';
                    else if (e.k === 'tx') shortCode = 'TO';
                    else if (e.k === 'd') shortCode = 'D';
                    else if (e.k === 'call') shortCode = 'CAL';
                    else if (e.k === 'err') shortCode = 'ERR';

                    const pName = e.p ? P(e.p).name.slice(0, 3).toUpperCase() : undefined;
                    toDots.push({
                        x: e.x,
                        y: e.y,
                        c: color,
                        r: 1.2,
                        label: pName ? pName : shortCode
                    });

                    if (e.trajectory && e.trajectory.length >= 2) {
                        toTrajectories.push({
                            points: e.trajectory,
                            color,
                            label: pName
                        });
                    }
                }
            }
        }
        const totalLocEvents = toUsCount + toThemCount;

        const holdPct = tStats.oPts > 0 ? Math.round((tStats.holds / tStats.oPts) * 100) : 0;
        const breakPct = tStats.dPts > 0 ? Math.round((tStats.breaks / tStats.dPts) * 100) : 0;

        return (
            <ScrollView style={styles.statsScroll} contentContainerStyle={styles.statsScrollContent}>
                {/* KPI Squadra */}
                <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                    <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Statistiche Squadra</Text>
                    <View style={styles.kpiGrid}>
                        <View style={[styles.kpiItem, isMobile ? styles.kpiItemMobile : styles.kpiItemDesktop, { backgroundColor: theme.dark ? '#1E293B' : '#EEF1F4' }]}>
                            <Text style={[styles.kpiVal, { color: theme.colors.text }]}>{tStats.holds}/{tStats.oPts} <Text style={{ fontSize: 11, color: '#2E8540' }}>({holdPct}%)</Text></Text>
                            <Text style={[styles.kpiLbl, { color: theme.colors.textSecondary }]}>Hold (O vinti)</Text>
                        </View>
                        <View style={[styles.kpiItem, isMobile ? styles.kpiItemMobile : styles.kpiItemDesktop, { backgroundColor: theme.dark ? '#1E293B' : '#EEF1F4' }]}>
                            <Text style={[styles.kpiVal, { color: theme.colors.text }]}>{tStats.clean}</Text>
                            <Text style={[styles.kpiLbl, { color: theme.colors.textSecondary }]}>Hold puliti (0 TO)</Text>
                        </View>
                        <View style={[styles.kpiItem, isMobile ? styles.kpiItemMobile : styles.kpiItemDesktop, { backgroundColor: theme.dark ? '#1E293B' : '#EEF1F4' }]}>
                            <Text style={[styles.kpiVal, { color: theme.colors.text }]}>{tStats.breaks}/{tStats.dPts} <Text style={{ fontSize: 11, color: '#1F6FD1' }}>({breakPct}%)</Text></Text>
                            <Text style={[styles.kpiLbl, { color: theme.colors.textSecondary }]}>Break (D vinti)</Text>
                        </View>
                        <View style={[styles.kpiItem, isMobile ? styles.kpiItemMobile : styles.kpiItemDesktop, { backgroundColor: theme.dark ? '#1E293B' : '#EEF1F4' }]}>
                            <Text style={[styles.kpiVal, { color: theme.colors.text }]}>{tStats.breaks}/{tStats.breakChances}</Text>
                            <Text style={[styles.kpiLbl, { color: theme.colors.textSecondary }]}>Break / Occasioni</Text>
                        </View>
                        <View style={[styles.kpiItem, isMobile ? styles.kpiItemMobile : styles.kpiItemDesktop, { backgroundColor: theme.dark ? '#1E293B' : '#EEF1F4' }]}>
                            <Text style={[styles.kpiVal, { color: theme.colors.text }]}>{tStats.toUs}</Text>
                            <Text style={[styles.kpiLbl, { color: theme.colors.textSecondary }]}>TO Nostri</Text>
                        </View>
                        <View style={[styles.kpiItem, isMobile ? styles.kpiItemMobile : styles.kpiItemDesktop, { backgroundColor: theme.dark ? '#1E293B' : '#EEF1F4' }]}>
                            <Text style={[styles.kpiVal, { color: theme.colors.text }]}>{tStats.toThem}</Text>
                            <Text style={[styles.kpiLbl, { color: theme.colors.textSecondary }]}>TO Loro (D + err)</Text>
                        </View>
                        <View style={[styles.kpiItem, isMobile ? styles.kpiItemMobile : styles.kpiItemDesktop, { backgroundColor: theme.dark ? '#1E293B' : '#EEF1F4' }]}>
                            <Text style={[styles.kpiVal, { color: theme.colors.text }]}>
                                {tStats.durN ? Math.round(tStats.durSum / tStats.durN) + 's' : '–'}
                            </Text>
                            <Text style={[styles.kpiLbl, { color: theme.colors.textSecondary }]}>Durata media punto</Text>
                        </View>
                    </View>
                </View>

                {/* Tabella Giocatori */}
                <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <Text style={[styles.cardTitle, { color: theme.colors.text, marginBottom: 0 }]}>Statistiche Giocatori</Text>
                        <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>Scorri e tocca le colonne ➔</Text>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                        <View>
                            <View style={[styles.tableHeaderRow, { backgroundColor: theme.dark ? '#1E293B' : '#EEF1F4' }]}>
                                <TouchableOpacity onPress={() => toggleSort('pts')}>
                                    <Text style={[styles.thCell, { width: 115, textAlign: 'left', paddingLeft: 6 }]}>Giocatore</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => toggleSort('pts')}>
                                    <Text style={[styles.thCell, { width: 44, color: statsSortKey === 'pts' ? (theme.dark ? '#60A5FA' : '#003057') : undefined }]}>
                                        PT{statsSortKey === 'pts' ? (statsSortAsc ? ' ▲' : ' ▼') : ''}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => toggleSort('ptsO')}>
                                    <Text style={[styles.thCell, { width: 44, color: statsSortKey === 'ptsO' ? (theme.dark ? '#60A5FA' : '#003057') : undefined }]}>
                                        O{statsSortKey === 'ptsO' ? (statsSortAsc ? ' ▲' : ' ▼') : ''}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => toggleSort('ptsD')}>
                                    <Text style={[styles.thCell, { width: 44, color: statsSortKey === 'ptsD' ? (theme.dark ? '#60A5FA' : '#003057') : undefined }]}>
                                        D{statsSortKey === 'ptsD' ? (statsSortAsc ? ' ▲' : ' ▼') : ''}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => toggleSort('goals')}>
                                    <Text style={[styles.thCell, { width: 44, color: statsSortKey === 'goals' ? '#2E8540' : undefined }]}>
                                        M{statsSortKey === 'goals' ? (statsSortAsc ? ' ▲' : ' ▼') : ''}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => toggleSort('ast')}>
                                    <Text style={[styles.thCell, { width: 44, color: statsSortKey === 'ast' ? '#1F6FD1' : undefined }]}>
                                        A{statsSortKey === 'ast' ? (statsSortAsc ? ' ▲' : ' ▼') : ''}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => toggleSort('ds')}>
                                    <Text style={[styles.thCell, { width: 44, color: statsSortKey === 'ds' ? (theme.dark ? '#60A5FA' : '#003057') : undefined }]}>
                                        D{statsSortKey === 'ds' ? (statsSortAsc ? ' ▲' : ' ▼') : ''}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => toggleSort('toTot')}>
                                    <Text style={[styles.thCell, { width: 44, color: statsSortKey === 'toTot' ? '#C8323C' : undefined }]}>
                                        TO{statsSortKey === 'toTot' ? (statsSortAsc ? ' ▲' : ' ▼') : ''}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => toggleSort('touches')}>
                                    <Text style={[styles.thCell, { width: 44, color: statsSortKey === 'touches' ? '#E07A1F' : undefined }]}>
                                        TCH{statsSortKey === 'touches' ? (statsSortAsc ? ' ▲' : ' ▼') : ''}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => toggleSort('plusMinus')}>
                                    <Text style={[styles.thCell, { width: 48, fontWeight: 'bold', color: statsSortKey === 'plusMinus' ? (theme.dark ? '#60A5FA' : '#003057') : undefined }]}>
                                        +/-{statsSortKey === 'plusMinus' ? (statsSortAsc ? ' ▲' : ' ▼') : ''}
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {ids.map(id => {
                                const s = pStats[id];
                                return (
                                    <View key={id} style={[styles.tableRow, { borderBottomColor: theme.colors.border }]}>
                                        <Text style={[styles.tdCell, { width: 115, fontWeight: '600', color: theme.colors.text, textAlign: 'left', paddingLeft: 6 }]} numberOfLines={1}>
                                            {P(id).name} <Text style={{ color: P(id).g === 'F' ? '#B8338A' : '#1F6FD1', fontSize: 10 }}>({P(id).g})</Text>
                                        </Text>
                                        <Text style={[styles.tdCell, { width: 44, color: theme.colors.text }]}>{s.pts}</Text>
                                        <Text style={[styles.tdCell, { width: 44, color: theme.colors.text }]}>{s.ptsO}</Text>
                                        <Text style={[styles.tdCell, { width: 44, color: theme.colors.text }]}>{s.ptsD}</Text>
                                        <Text style={[styles.tdCell, { width: 44, color: '#2E8540', fontWeight: 'bold' }]}>{s.goals}</Text>
                                        <Text style={[styles.tdCell, { width: 44, color: '#1F6FD1' }]}>{s.ast}</Text>
                                        <Text style={[styles.tdCell, { width: 44, color: theme.dark ? '#60A5FA' : '#003057', fontWeight: 'bold' }]}>{s.ds}</Text>
                                        <Text style={[styles.tdCell, { width: 44, color: '#C8323C' }]}>{s.toTot}</Text>
                                        <Text style={[styles.tdCell, { width: 44, color: theme.colors.text }]}>{s.touches || 0}</Text>
                                        <Text style={[styles.tdCell, { width: 48, fontWeight: 'bold', color: s.plusMinus >= 0 ? '#2E8540' : '#C8323C' }]}>
                                            {s.plusMinus > 0 ? `+${s.plusMinus}` : s.plusMinus}
                                        </Text>
                                    </View>
                                );
                            })}
                        </View>
                    </ScrollView>
                </View>

                {/* Mappa Pull Ingrandita */}
                <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View>
                            <Text style={[styles.cardTitle, { color: theme.colors.text, marginBottom: 2 }]}>Mappa Pull</Text>
                            <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>
                                Totale: {totalPulls} ({usPulls} nostri · {themPulls} avversari)
                            </Text>
                        </View>
                    </View>

                    {/* Filtri e Legenda */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 10, flexWrap: 'wrap', gap: 8 }}>
                        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                            {[
                                { key: 'all', label: `Tutti (${totalPulls})` },
                                { key: 'us', label: `Nostri (${usPulls})` },
                                { key: 'them', label: `Loro (${themPulls})` }
                            ].map(f => (
                                <TouchableOpacity
                                    key={f.key}
                                    style={[
                                        styles.filterChip,
                                        statsFilter === f.key
                                            ? styles.filterChipOn
                                            : {
                                                backgroundColor: theme.dark ? '#1E293B' : '#F1F5F9',
                                                borderColor: theme.dark ? '#334155' : '#CBD5E1'
                                            }
                                    ]}
                                    onPress={() => setStatsFilter(f.key)}
                                >
                                    <Text
                                        style={[
                                            styles.filterChipText,
                                            statsFilter === f.key
                                                ? styles.filterChipTextOn
                                                : { color: theme.colors.text }
                                        ]}
                                    >
                                        {f.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: '#003057' }} />
                                <Text style={{ fontSize: 11, fontWeight: '600', color: theme.colors.textSecondary }}>Nostri</Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: '#E07A1F' }} />
                                <Text style={{ fontSize: 11, fontWeight: '600', color: theme.colors.textSecondary }}>Loro</Text>
                            </View>
                        </View>
                    </View>

                    <InteractiveField
                        dots={pullDots}
                        interactive={false}
                        isPlayMode={false}
                        flip={toFieldFlip}
                    />
                </View>

                {/* Mappa Turnover & Difese */}
                <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View>
                            <Text style={[styles.cardTitle, { color: theme.colors.text, marginBottom: 2 }]}>
                                Mappa Turnover & Difese
                            </Text>
                            <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>
                                Totale: {totalLocEvents} ({toUsCount} TO nostri · {toThemCount} TO avversari)
                            </Text>
                        </View>
                    </View>

                    {/* Filtri e Legenda */}
                    <View style={{ marginTop: 10, marginBottom: 8, gap: 8 }}>
                        {/* Filtro Mete / Punti (Attacco vs Difesa) */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.textSecondary }}>Mete:</Text>
                            {[
                                { key: 'all', label: `Tutte (${totalLocEvents})` },
                                { key: 'O', label: `⚡ Attacco (${oPointCount})` },
                                { key: 'D', label: `🛡️ Difesa (${dPointCount})` }
                            ].map(f => (
                                <TouchableOpacity
                                    key={f.key}
                                    style={[
                                        styles.filterChip,
                                        toOriginFilter === f.key
                                            ? {
                                                backgroundColor: f.key === 'O' ? '#C8323C' : f.key === 'D' ? '#1F6FD1' : '#003057',
                                                borderColor: f.key === 'O' ? '#A8252F' : f.key === 'D' ? '#1756A4' : '#003057'
                                            }
                                            : {
                                                backgroundColor: theme.dark ? '#1E293B' : '#F1F5F9',
                                                borderColor: theme.dark ? '#334155' : '#CBD5E1'
                                            }
                                    ]}
                                    onPress={() => setToOriginFilter(f.key as any)}
                                >
                                    <Text
                                        style={[
                                            styles.filterChipText,
                                            {
                                                color: toOriginFilter === f.key ? '#fff' : theme.colors.text,
                                                fontWeight: toOriginFilter === f.key ? 'bold' : '600'
                                            }
                                        ]}
                                    >
                                        {f.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Filtro Tipo Evento e Legenda */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                                {[
                                    { key: 'all', label: `Tutti` },
                                    { key: 'toUs', label: `TO Nostri (${toUsCount})` },
                                    { key: 'toThem', label: `TO Loro (${toThemCount})` }
                                ].map(f => (
                                    <TouchableOpacity
                                        key={f.key}
                                        style={[
                                            styles.filterChip,
                                            toStatsFilter === f.key
                                                ? styles.filterChipOn
                                                : {
                                                    backgroundColor: theme.dark ? '#1E293B' : '#F1F5F9',
                                                    borderColor: theme.dark ? '#334155' : '#CBD5E1'
                                                }
                                        ]}
                                        onPress={() => setToStatsFilter(f.key as any)}
                                    >
                                        <Text
                                            style={[
                                                styles.filterChipText,
                                                toStatsFilter === f.key
                                                    ? styles.filterChipTextOn
                                                    : { color: theme.colors.text }
                                            ]}
                                        >
                                            {f.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                    <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: '#C8323C' }} />
                                    <Text style={{ fontSize: 10, fontWeight: '600', color: theme.colors.textSecondary }}>Nostri (O)</Text>
                                </View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                    <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: '#1F6FD1' }} />
                                    <Text style={{ fontSize: 10, fontWeight: '600', color: theme.colors.textSecondary }}>Nostri (D)</Text>
                                </View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                    <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: '#E07A1F' }} />
                                    <Text style={{ fontSize: 10, fontWeight: '600', color: theme.colors.textSecondary }}>Avversari</Text>
                                </View>
                            </View>
                        </View>
                    </View>

                    <InteractiveField
                        dots={toDots}
                        trajectories={toTrajectories}
                        interactive={false}
                        isPlayMode={true}
                        flip={toFieldFlip}
                        onFlipDirection={() => setToFieldFlip(prev => !prev)}
                    />
                </View>

                {/* Log Cronologico Eventi */}
                <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                    <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Cronologia Eventi ({match.events?.length || 0})</Text>
                    <ScrollView style={{ maxHeight: 240 }}>
                        {(match.events || []).slice().reverse().map((e, idx) => (
                            <View key={idx} style={styles.logItem}>
                                <Text style={[styles.logText, { color: theme.colors.text }]}>
                                    • {describeEvent(e, playerMap)}{e.x != null && e.y != null ? ` [${e.x}m, ${e.y}m]` : ''}
                                </Text>
                            </View>
                        ))}
                    </ScrollView>
                </View>
            </ScrollView>
        );
    };

    /* ----------------------------------------------------
       RENDER PARTITA CONCLUSA (Azioni di gioco disabilitate)
    ---------------------------------------------------- */
    const renderCompletedMatchView = () => {
        const isWin = st.score.us > st.score.them;
        const isTie = st.score.us === st.score.them;
        const resultLabel = isTie ? 'PAREGGIO' : isWin ? 'VITTORIA 🎉' : 'SCONFITTA';
        const resultBg = isTie ? '#78909C' : isWin ? '#2E8540' : '#E65100';

        return (
            <View style={{ padding: 16, gap: 14 }}>
                {/* Card Risultato Finale */}
                <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, alignItems: 'center', paddingVertical: 20 }]}>
                    <View style={{ backgroundColor: resultBg, paddingHorizontal: 14, paddingVertical: 4, borderRadius: 20, marginBottom: 10 }}>
                        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13, letterSpacing: 0.5 }}>
                            {resultLabel}
                        </Text>
                    </View>

                    <Text style={{ fontSize: 13, color: theme.colors.textSecondary, marginBottom: 4 }}>
                        RISULTATO FINALE
                    </Text>
                    <Text style={{ fontSize: 32, fontWeight: '900', color: theme.colors.text }}>
                        BUBBA {st.score.us} – {st.score.them} {match.opponent.toUpperCase()}
                    </Text>
                    <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginTop: 4 }}>
                        {st.points.length} punti disputati · {match.events?.length || 0} azioni registrate
                    </Text>

                    {/* KPI Rapidi Partita */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginTop: 18, borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: 14 }}>
                        <View style={{ alignItems: 'center' }}>
                            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#2E8540' }}>{tStats.holds}</Text>
                            <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>Hold</Text>
                        </View>
                        <View style={{ alignItems: 'center' }}>
                            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#003057' }}>{tStats.breaks}</Text>
                            <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>Break</Text>
                        </View>
                        <View style={{ alignItems: 'center' }}>
                            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#C8323C' }}>{tStats.toUs}</Text>
                            <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>TO Nostri</Text>
                        </View>
                        <View style={{ alignItems: 'center' }}>
                            <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.colors.primary }}>{tStats.toThem}</Text>
                            <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>TO Loro</Text>
                        </View>
                    </View>
                </View>

                {/* Banner Azioni Bloccate */}
                <View style={[styles.lockedBanner, { backgroundColor: '#ECEFF1', borderColor: '#B0BEC5', marginHorizontal: 0, marginTop: 0 }]}>
                    <Text style={styles.lockedTitle}>🔒 REGISTRAZIONE EVENTI BLOCCATA</Text>
                    <Text style={styles.lockedSub}>
                        La partita è chiusa. La selezione della linea e l'avvio di ulteriori punti sono disabilitati.
                    </Text>
                    {isStaff && (
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                            <TouchableOpacity
                                style={{
                                    backgroundColor: '#003057',
                                    paddingHorizontal: 12,
                                    paddingVertical: 7,
                                    borderRadius: 6
                                }}
                                onPress={() => setModalRosterVisible(true)}
                            >
                                <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>
                                    👥 Convocati & Roster
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={{
                                    backgroundColor: '#5B6570',
                                    paddingHorizontal: 12,
                                    paddingVertical: 7,
                                    borderRadius: 6
                                }}
                                onPress={handleToggleDone}
                            >
                                <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>
                                    🔓 Riapri Partita
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* Pulsante rapido statistiche */}
                <TouchableOpacity
                    style={{
                        backgroundColor: theme.colors.primary,
                        paddingVertical: 12,
                        borderRadius: 10,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginTop: 4
                    }}
                    onPress={() => setActiveTab('stats')}
                >
                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>
                        📊 Consulta Statistiche e Tabella Giocatori ➔
                    </Text>
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            {/* Header Superiore con Punteggio e Azioni */}
            <View style={[styles.matchHeader, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}>
                <ScreenTitle
                    title={`vs ${match.opponent}`}
                    onBack={() => navigation.goBack()}
                    containerStyle={{ marginBottom: 4 }}
                />

                <View style={styles.headerActionsRow}>
                    <TouchableOpacity
                        style={[styles.headerBtn, { backgroundColor: '#2E8540' }, isMobile && styles.headerBtnMobile]}
                        onPress={handleExportExcel}
                        activeOpacity={0.8}
                    >
                        <Text style={[styles.headerBtnText, isMobile && styles.headerBtnTextMobile]}>📊 Excel</Text>
                    </TouchableOpacity>

                    {isStaff && (
                        <>
                            <TouchableOpacity
                                style={[styles.headerBtn, { backgroundColor: '#E07A1F' }, isMobile && styles.headerBtnMobile]}
                                onPress={() => setModalTouchesVisible(true)}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.headerBtnText, isMobile && styles.headerBtnTextMobile]} numberOfLines={1}>
                                    🥏 Tocchi
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.headerBtn, { backgroundColor: '#003057' }, isMobile && styles.headerBtnMobile]}
                                onPress={() => setModalRosterVisible(true)}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.headerBtnText, isMobile && styles.headerBtnTextMobile]} numberOfLines={1}>
                                    👥 Roster ({matchRoster.length})
                                </Text>
                            </TouchableOpacity>

                            {canEdit && (
                                <TouchableOpacity
                                    style={[styles.headerBtn, { backgroundColor: '#5B6570' }, isMobile && styles.headerBtnMobile]}
                                    onPress={handleUndo}
                                    activeOpacity={0.8}
                                >
                                    <Text style={[styles.headerBtnText, isMobile && styles.headerBtnTextMobile]}>↩ Annulla</Text>
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity
                                style={[styles.headerBtn, { backgroundColor: isCompleted ? '#003057' : '#C8323C' }, isMobile && styles.headerBtnMobile]}
                                onPress={handleToggleDone}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.headerBtnText, isMobile && styles.headerBtnTextMobile]}>
                                    {isCompleted ? '🔓 Riapri' : '🏁 Termina'}
                                </Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>

                {/* Punteggio Gigante */}
                <View style={styles.scoreRow}>
                    <View style={styles.teamScore}>
                        <Text style={[styles.teamName, { color: theme.colors.text }]} numberOfLines={1}>BUBBA</Text>
                        <Text style={[styles.scoreValue, { color: '#003057' }]}>{st.score.us}</Text>
                    </View>
                    <Text style={[styles.scoreDivider, { color: theme.colors.textSecondary }]}>–</Text>
                    <View style={styles.teamScore}>
                        <Text style={[styles.teamName, { color: theme.colors.text }]} numberOfLines={1} ellipsizeMode="tail">
                            {match.opponent.toUpperCase()}
                        </Text>
                        <Text style={[styles.scoreValue, { color: '#E07A1F' }]}>{st.score.them}</Text>
                    </View>
                </View>

                {/* Tab Navigator */}
                <View style={styles.tabBar}>
                    <TouchableOpacity
                        style={[styles.tabItem, activeTab === 'play' && styles.tabItemOn]}
                        onPress={() => setActiveTab('play')}
                    >
                        <Text style={[styles.tabText, activeTab === 'play' && styles.tabTextOn]}>
                            {isCompleted ? 'PARTITA (CONCLUSA)' : 'PARTITA (LIVE)'}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tabItem, activeTab === 'stats' && styles.tabItemOn]}
                        onPress={() => setActiveTab('stats')}
                    >
                        <Text style={[styles.tabText, activeTab === 'stats' && styles.tabTextOn]}>STATISTICHE</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Contenuto Schermata in base al tab */}
            {activeTab === 'play' ? (
                <ScrollView contentContainerStyle={{ padding: isMobile ? 12 : 16, paddingBottom: 48, gap: 16 }}>
                    {isCompleted ? (
                        renderCompletedMatchView()
                    ) : (
                        <>
                            {st.phase === 'line' && renderPhaseLine()}
                            {st.phase === 'pull' && renderPhasePull()}
                            {st.phase === 'play' && renderPhasePlay()}
                        </>
                    )}
                </ScrollView>
            ) : (
                renderStatsTab()
            )}

            {/* Modal Cambio Linea durante il punto */}
            {/* Modal Cambio Linea durante il punto */}
            {!isCompleted && curPt && (
                <Modal visible={modalLineVisible} transparent animationType="slide">
                    <View style={styles.modalBg}>
                        <View style={[styles.modalBox, { backgroundColor: theme.colors.card, maxWidth: 540 }]}>
                            {subStep === 'roster' ? (
                                <>
                                    <View style={styles.rowBetween}>
                                        <Text style={[styles.cardTitle, { color: theme.colors.text, marginBottom: 0 }]}>
                                            Cambio Giocatori in Campo
                                        </Text>
                                        <View style={[
                                            { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
                                            { backgroundColor: lineSel.length === 5 ? '#E2F0D9' : '#FCE8E6' }
                                        ]}>
                                            <Text style={{ fontSize: 11, fontWeight: '700', color: lineSel.length === 5 ? '#2E7D32' : '#C8323C' }}>
                                                {lineSel.length} / 5
                                            </Text>
                                        </View>
                                    </View>
                                    <Text style={[styles.muted, { color: theme.colors.textSecondary, marginVertical: 8 }]}>
                                        Seleziona i 5 giocatori che devono risultare in campo per questo punto.
                                    </Text>

                                    <View style={styles.playerGrid}>
                                        {matchRoster.map(p => {
                                            const isSel = lineSel.includes(p.id);
                                            return (
                                                <TouchableOpacity
                                                    key={p.id}
                                                    style={[
                                                        styles.pbtn,
                                                        isSel && styles.pbtnSel,
                                                        { backgroundColor: isSel ? '#E3ECF5' : theme.colors.card, borderColor: isSel ? '#003057' : theme.colors.border }
                                                    ]}
                                                    onPress={() => {
                                                        setLineSel(prev => (prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id]));
                                                    }}
                                                >
                                                    <Text style={[styles.pbtnName, { color: theme.colors.text }]}>{p.name}</Text>
                                                    <View style={[styles.genderBadge, { backgroundColor: p.g === 'F' ? '#B8338A' : '#1F6FD1' }]}>
                                                        <Text style={styles.genderText}>{p.g}</Text>
                                                    </View>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>

                                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                                        <TouchableOpacity
                                            style={[styles.segBtn, { paddingHorizontal: 16 }]}
                                            onPress={() => setModalLineVisible(false)}
                                        >
                                            <Text style={styles.segText}>Annulla</Text>
                                        </TouchableOpacity>
                                        {(() => {
                                            const outCount = (curPt?.line || []).filter(id => !lineSel.includes(id)).length;
                                            const inCount = lineSel.filter(id => !(curPt?.line || []).includes(id)).length;
                                            const hasChanges = outCount > 0 || inCount > 0;
                                            return (
                                                <TouchableOpacity
                                                    style={[
                                                        styles.startPtBtn,
                                                        { paddingHorizontal: 20, opacity: lineSel.length === 5 ? 1 : 0.4 }
                                                    ]}
                                                    disabled={lineSel.length !== 5}
                                                    onPress={() => {
                                                        if (!hasChanges) {
                                                            setModalLineVisible(false);
                                                            return;
                                                        }
                                                        setSubStep('reason');
                                                    }}
                                                >
                                                    <Text style={styles.startPtText}>
                                                        {hasChanges ? 'Avanti: Motivo Cambio ▸' : 'Nessuna Modifica'}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })()}
                                    </View>
                                </>
                            ) : (
                                <>
                                    <Text style={[styles.cardTitle, { color: theme.colors.text, marginBottom: 4 }]}>
                                        Motivo della Sostituzione
                                    </Text>
                                    <Text style={[styles.muted, { color: theme.colors.textSecondary, marginBottom: 14 }]}>
                                        Specifica quando ha effetto questo cambio giocatore:
                                    </Text>

                                    {/* Riepilogo modifiche */}
                                    {(() => {
                                        const outPlayers = (curPt?.line || []).filter(id => !lineSel.includes(id));
                                        const inPlayers = lineSel.filter(id => !(curPt?.line || []).includes(id));
                                        return (
                                            <View style={{ backgroundColor: '#F8FAFC', borderRadius: 8, padding: 10, marginBottom: 14, borderWidth: 1, borderColor: '#E2E8F0', gap: 4 }}>
                                                {outPlayers.length > 0 && (
                                                    <Text style={{ fontSize: 12, color: '#C8323C', fontWeight: '600' }}>
                                                        🔻 Esce: {outPlayers.map(id => P(id).name).join(', ')}
                                                    </Text>
                                                )}
                                                {inPlayers.length > 0 && (
                                                    <Text style={{ fontSize: 12, color: '#166534', fontWeight: '600' }}>
                                                        🔺 Entra: {inPlayers.map(id => P(id).name).join(', ')}
                                                    </Text>
                                                )}
                                            </View>
                                        );
                                    })()}

                                    {/* Scelta: Infortunio (da questo momento) */}
                                    <TouchableOpacity
                                        activeOpacity={0.8}
                                        style={[
                                            styles.subReasonCard,
                                            subReason === 'injury'
                                                ? { borderColor: '#003057', backgroundColor: '#F0F7FF' }
                                                : { borderColor: theme.colors.border, backgroundColor: theme.colors.card }
                                        ]}
                                        onPress={() => setSubReason('injury')}
                                    >
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                            <Text style={{ fontSize: 20 }}>🚑</Text>
                                            <Text style={[styles.subReasonTitle, { color: '#003057' }]}>
                                                Da questo momento (per Infortunio)
                                            </Text>
                                        </View>
                                        <Text style={[styles.subReasonDesc, { color: theme.colors.textSecondary }]}>
                                            Sostituzione avvenuta durante l'azione. Il giocatore sostituito mantiene il punto disputato fino a questo momento e il subentrante giocherà da adesso in poi.
                                        </Text>
                                    </TouchableOpacity>

                                    {/* Scelta: Errore (da inizio meta) */}
                                    <TouchableOpacity
                                        activeOpacity={0.8}
                                        style={[
                                            styles.subReasonCard,
                                            subReason === 'error'
                                                ? { borderColor: '#003057', backgroundColor: '#F0F7FF' }
                                                : { borderColor: theme.colors.border, backgroundColor: theme.colors.card }
                                        ]}
                                        onPress={() => setSubReason('error')}
                                    >
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                            <Text style={{ fontSize: 20 }}>✏️</Text>
                                            <Text style={[styles.subReasonTitle, { color: '#003057' }]}>
                                                Da inizio meta (per Errore)
                                            </Text>
                                        </View>
                                        <Text style={[styles.subReasonDesc, { color: theme.colors.textSecondary }]}>
                                            Correzione della formazione iniziale del punto. Chi era stato segnato per sbaglio viene rimosso dal punto e sostituito retroattivamente fin dall'inizio.
                                        </Text>
                                    </TouchableOpacity>

                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
                                        <TouchableOpacity
                                            style={[styles.segBtn, { paddingHorizontal: 14 }]}
                                            onPress={() => setSubStep('roster')}
                                        >
                                            <Text style={styles.segText}>◂ Modifica Roster</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.startPtBtn, { paddingHorizontal: 20 }]}
                                            onPress={() => applyLineChange(subReason)}
                                        >
                                            <Text style={styles.startPtText}>Conferma Sostituzione</Text>
                                        </TouchableOpacity>
                                    </View>
                                </>
                            )}
                        </View>
                    </View>
                </Modal>
            )}

            {/* Modal Gestione Convocati Partita & Collegamento Giocatori */}
            <Modal visible={modalRosterVisible} transparent animationType="slide" onRequestClose={() => {
                if (remappingPlayer) setRemappingPlayer(null);
                else setModalRosterVisible(false);
            }}>
                <View style={styles.modalBg}>
                    <View style={[styles.modalBox, { backgroundColor: theme.colors.card, maxHeight: '90%' }]}>
                        {remappingPlayer ? (
                            /* Sub-view: Collegamento a Membro Bubba */
                            <View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                    <Text style={[styles.cardTitle, { color: theme.colors.text, fontSize: 16 }]}>
                                        🔗 Collega a Membro Bubba
                                    </Text>
                                    <TouchableOpacity
                                        style={{ padding: 4 }}
                                        onPress={() => {
                                            setRemappingPlayer(null);
                                            setMemberSearchQuery('');
                                        }}
                                    >
                                        <Text style={{ fontSize: 13, color: theme.colors.primary, fontWeight: 'bold' }}>Annulla</Text>
                                    </TouchableOpacity>
                                </View>

                                <View style={{ backgroundColor: '#FFF3E0', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#FFE0B2', marginBottom: 10 }}>
                                    <Text style={{ fontSize: 12, color: '#E65100', fontWeight: 'bold' }}>
                                        Stai collegando: {remappingPlayer.name} ({remappingPlayer.g})
                                    </Text>
                                    <Text style={{ fontSize: 11, color: '#666', marginTop: 2 }}>
                                        Seleziona a quale membro ufficiale assegnare tutti gli eventi registrati (gol, assist, difese, presenze in linea).
                                    </Text>
                                </View>

                                <TextInput
                                    style={{
                                        borderWidth: 1,
                                        borderColor: theme.colors.border,
                                        borderRadius: 8,
                                        paddingHorizontal: 10,
                                        paddingVertical: 7,
                                        fontSize: 13,
                                        color: theme.colors.text,
                                        marginBottom: 8
                                    }}
                                    placeholder="Cerca membro per nome o soprannome..."
                                    placeholderTextColor={theme.colors.textSecondary}
                                    value={memberSearchQuery}
                                    onChangeText={setMemberSearchQuery}
                                />

                                <ScrollView style={{ maxHeight: 320 }} nestedScrollEnabled>
                                    <View style={{ gap: 6 }}>
                                        {filteredMembersToRemap.length === 0 ? (
                                            <Text style={{ color: theme.colors.textSecondary, fontSize: 12, padding: 8, textAlign: 'center' }}>
                                                Nessun membro trovato con questa ricerca.
                                            </Text>
                                        ) : (
                                            filteredMembersToRemap.map(m => {
                                                const mGender: 'M' | 'F' = m.gender === 'F' ? 'F' : 'M';
                                                return (
                                                    <TouchableOpacity
                                                        key={m.id}
                                                        style={{
                                                            flexDirection: 'row',
                                                            alignItems: 'center',
                                                            paddingVertical: 9,
                                                            paddingHorizontal: 12,
                                                            borderRadius: 8,
                                                            borderWidth: 1,
                                                            borderColor: theme.colors.border,
                                                            backgroundColor: 'rgba(0,0,0,0.02)'
                                                        }}
                                                        onPress={() => {
                                                            const mName = m.nickname || m.firstName;
                                                            showConfirmation(
                                                                'Collega Giocatore',
                                                                `Vuoi collegare "${remappingPlayer.name}" a "${mName}"? Tutti gli eventi e le statistiche storiche verranno aggiornati.`,
                                                                () => handleRemapPlayer(remappingPlayer, m),
                                                                'Collega'
                                                            );
                                                        }}
                                                    >
                                                        <Text style={{ fontSize: 13, fontWeight: 'bold', color: mGender === 'F' ? '#B8338A' : '#1F6FD1', width: 22 }}>
                                                            {mGender}
                                                        </Text>
                                                        <View style={{ flex: 1 }}>
                                                            <Text style={{ fontSize: 14, fontWeight: '600', color: theme.colors.text }}>
                                                                {m.nickname || m.firstName} {m.lastName || ''}
                                                            </Text>
                                                            {m.nickname && m.firstName && (
                                                                <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>
                                                                    {m.firstName} {m.lastName}
                                                                </Text>
                                                            )}
                                                        </View>
                                                        <View style={{ backgroundColor: theme.colors.primary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}>
                                                            <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>Collega ➔</Text>
                                                        </View>
                                                    </TouchableOpacity>
                                                );
                                            })
                                        )}
                                    </View>
                                </ScrollView>
                            </View>
                        ) : (
                            /* Vista Principale: Gestione Roster Convocati */
                            <ScrollView showsVerticalScrollIndicator={false}>
                                <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
                                    Gestione Convocati Partita ({matchRoster.length})
                                </Text>
                                <Text style={[styles.muted, { color: theme.colors.textSecondary, marginBottom: 8 }]}>
                                    Modifica i convocati della partita e collega giocatori importati o ospiti ai membri Bubba.
                                </Text>

                                {/* Lista Convocati Attuali con Azioni */}
                                <Text style={{ fontSize: 12, fontWeight: 'bold', color: theme.colors.text, marginTop: 4, marginBottom: 6 }}>
                                    Convocati in questa Partita:
                                </Text>
                                <View style={{ maxHeight: 200, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, padding: 6, backgroundColor: 'rgba(0,0,0,0.02)' }}>
                                    <ScrollView nestedScrollEnabled>
                                        <View style={{ gap: 6 }}>
                                            {matchRoster.map(p => {
                                                const isGuestOrImported = p.id.startsWith('guest_') || p.id.startsWith('imported_') || (p as any).isGuest;
                                                return (
                                                    <View
                                                        key={p.id}
                                                        style={{
                                                            flexDirection: 'row',
                                                            alignItems: 'center',
                                                            paddingVertical: 6,
                                                            paddingHorizontal: 8,
                                                            borderRadius: 6,
                                                            backgroundColor: theme.colors.card,
                                                            borderWidth: 1,
                                                            borderColor: theme.colors.border
                                                        }}
                                                    >
                                                        <TouchableOpacity
                                                            disabled={!isGuestOrImported}
                                                            onPress={async () => {
                                                                if (!isGuestOrImported) return;
                                                                const current = match.customRoster && match.customRoster.length > 0
                                                                    ? [...match.customRoster]
                                                                    : matchRoster.map(x => ({ id: x.id, name: x.name, g: x.g }));
                                                                const nextG: 'M' | 'F' = p.g === 'F' ? 'M' : 'F';
                                                                const updated = current.map(x => x.id === p.id ? { ...x, g: nextG } : x);
                                                                await updateMatchAnalysis({ id: match.id, customRoster: updated });
                                                            }}
                                                            style={{
                                                                paddingHorizontal: 5,
                                                                paddingVertical: 2,
                                                                borderRadius: 4,
                                                                backgroundColor: isGuestOrImported ? (p.g === 'F' ? '#FCE4EC' : '#E3F2FD') : 'transparent',
                                                                marginRight: 6
                                                            }}
                                                        >
                                                            <Text style={{ fontSize: 13, fontWeight: 'bold', color: p.g === 'F' ? '#B8338A' : '#1F6FD1' }}>
                                                                {p.g}{isGuestOrImported ? ' ⇄' : ''}
                                                            </Text>
                                                        </TouchableOpacity>
                                                        <View style={{ flex: 1 }}>
                                                            <Text style={{ fontSize: 13, fontWeight: '600', color: theme.colors.text }}>
                                                                {p.name}
                                                            </Text>
                                                        </View>
                                                        <View
                                                            style={{
                                                                paddingHorizontal: 6,
                                                                paddingVertical: 2,
                                                                borderRadius: 4,
                                                                marginRight: 6,
                                                                backgroundColor: isGuestOrImported ? '#FFF3E0' : '#E3F2FD'
                                                            }}
                                                        >
                                                            <Text style={{ fontSize: 10, fontWeight: 'bold', color: isGuestOrImported ? '#E65100' : '#1565C0' }}>
                                                                {isGuestOrImported ? 'Ospite/Imp.' : 'Membro'}
                                                            </Text>
                                                        </View>
                                                        <TouchableOpacity
                                                            style={{
                                                                paddingHorizontal: 8,
                                                                paddingVertical: 4,
                                                                borderRadius: 5,
                                                                backgroundColor: theme.colors.primary + '18',
                                                                marginRight: 4
                                                            }}
                                                            onPress={() => setRemappingPlayer(p)}
                                                        >
                                                            <Text style={{ fontSize: 11, color: theme.colors.primary, fontWeight: 'bold' }}>
                                                                🔗 Collega
                                                            </Text>
                                                        </TouchableOpacity>
                                                        <TouchableOpacity
                                                            style={{
                                                                paddingHorizontal: 6,
                                                                paddingVertical: 4,
                                                                borderRadius: 5,
                                                                backgroundColor: '#FFEBEE'
                                                            }}
                                                            onPress={() => handleRemovePlayerFromRoster(p.id, p.name)}
                                                        >
                                                            <Text style={{ fontSize: 11, color: '#C8323C', fontWeight: 'bold' }}>✕</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                );
                                            })}
                                        </View>
                                    </ScrollView>
                                </View>

                                {/* Aggiunta Ospite Esterno */}
                                <Text style={{ fontSize: 12, fontWeight: 'bold', color: theme.colors.text, marginTop: 12, marginBottom: 4 }}>
                                    Aggiungi Ospite al Volo:
                                </Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, padding: 6, backgroundColor: 'rgba(0,0,0,0.03)', borderRadius: 8 }}>
                                    <TextInput
                                        style={{ flex: 1, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5, fontSize: 12, color: theme.colors.text }}
                                        placeholder="Nome Ospite..."
                                        placeholderTextColor={theme.colors.textSecondary}
                                        value={newGuestName}
                                        onChangeText={setNewGuestName}
                                    />
                                    <TouchableOpacity
                                        style={{ paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6, backgroundColor: newGuestGender === 'F' ? '#B8338A' : '#1F6FD1' }}
                                        onPress={() => setNewGuestGender(prev => prev === 'F' ? 'M' : 'F')}
                                    >
                                        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>{newGuestGender}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: theme.colors.primary }}
                                        onPress={async () => {
                                            if (!newGuestName.trim()) return;
                                            const guestId = `guest_${Date.now()}`;
                                            const current = match.customRoster && match.customRoster.length > 0
                                                ? [...match.customRoster]
                                                : matchRoster.map(p => ({ id: p.id, name: p.name, g: p.g }));
                                            const updated = [...current, { id: guestId, name: newGuestName.trim(), g: newGuestGender, isGuest: true }];
                                            await updateMatchAnalysis({ id: match.id, customRoster: updated });
                                            setNewGuestName('');
                                        }}
                                    >
                                        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 11 }}>+ Aggiungi</Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Aggiungi Membri Societari */}
                                <Text style={{ fontSize: 12, fontWeight: 'bold', color: theme.colors.text, marginTop: 12, marginBottom: 4 }}>
                                    Aggiungi / Rimuovi Membri Società:
                                </Text>
                                <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                                    <TouchableOpacity
                                        style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5, backgroundColor: '#B8338A' }}
                                        onPress={async () => {
                                            const females = allMembers.filter(m => m.gender === 'F').map(m => ({
                                                id: m.id,
                                                name: m.nickname || m.firstName,
                                                g: 'F' as const
                                            }));
                                            const others = matchRoster.filter(p => p.g !== 'F');
                                            await updateMatchAnalysis({ id: match.id, customRoster: [...others, ...females] });
                                        }}
                                    >
                                        <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>+ Tutte le Donne</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5, backgroundColor: '#1F6FD1' }}
                                        onPress={async () => {
                                            const males = allMembers.filter(m => m.gender !== 'F').map(m => ({
                                                id: m.id,
                                                name: m.nickname || m.firstName,
                                                g: 'M' as const
                                            }));
                                            const others = matchRoster.filter(p => p.g === 'F');
                                            await updateMatchAnalysis({ id: match.id, customRoster: [...others, ...males] });
                                        }}
                                    >
                                        <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>+ Tutti gli Uomini</Text>
                                    </TouchableOpacity>
                                </View>

                                <TextInput
                                    style={{
                                        borderWidth: 1,
                                        borderColor: theme.colors.border,
                                        borderRadius: 6,
                                        paddingHorizontal: 8,
                                        paddingVertical: 5,
                                        fontSize: 12,
                                        color: theme.colors.text,
                                        marginBottom: 6
                                    }}
                                    placeholder="Filtra membri per nome..."
                                    placeholderTextColor={theme.colors.textSecondary}
                                    value={allMemberSearchQuery}
                                    onChangeText={setAllMemberSearchQuery}
                                />

                                <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled>
                                    <View style={{ gap: 4 }}>
                                        {filteredAllMembers.map(m => {
                                            const mGender: 'M' | 'F' = m.gender === 'F' ? 'F' : 'M';
                                            const isCalled = matchRoster.some(x => x.id === m.id);
                                            return (
                                                <TouchableOpacity
                                                    key={m.id}
                                                    style={{
                                                        flexDirection: 'row',
                                                        alignItems: 'center',
                                                        paddingVertical: 6,
                                                        paddingHorizontal: 8,
                                                        borderRadius: 6,
                                                        borderWidth: 1,
                                                        borderColor: isCalled ? theme.colors.primary : theme.colors.border,
                                                        backgroundColor: isCalled ? theme.colors.primary + '12' : 'transparent'
                                                    }}
                                                    onPress={async () => {
                                                        const current = match.customRoster && match.customRoster.length > 0
                                                            ? [...match.customRoster]
                                                            : matchRoster.map(x => ({ id: x.id, name: x.name, g: x.g }));
                                                        const exists = current.some(x => x.id === m.id);
                                                        const updated = exists
                                                            ? current.filter(x => x.id !== m.id)
                                                            : [...current, { id: m.id, name: m.nickname || m.firstName, g: mGender }];
                                                        await updateMatchAnalysis({ id: match.id, customRoster: updated });
                                                    }}
                                                >
                                                    <Text style={{ fontSize: 13, fontWeight: 'bold', color: mGender === 'F' ? '#B8338A' : '#1F6FD1', width: 20 }}>
                                                        {mGender}
                                                    </Text>
                                                    <Text style={{ flex: 1, fontSize: 13, color: theme.colors.text }}>
                                                        {m.nickname || m.firstName} {m.lastName || ''}
                                                    </Text>
                                                    <Text style={{ fontSize: 15, color: isCalled ? theme.colors.primary : theme.colors.textSecondary, fontWeight: 'bold' }}>
                                                        {isCalled ? '✓' : '○'}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </ScrollView>

                                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 14 }}>
                                    <TouchableOpacity
                                        style={[styles.startPtBtn, { paddingHorizontal: 24 }]}
                                        onPress={() => setModalRosterVisible(false)}
                                    >
                                        <Text style={styles.startPtText}>Fatto</Text>
                                    </TouchableOpacity>
                                </View>
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>

            {/* Modal Modifica Manuale Tocchi */}
            <EditTouchesModal
                visible={modalTouchesVisible}
                match={match}
                playerMap={playerMap}
                onClose={() => setModalTouchesVisible(false)}
                onSave={async (manualTouches) => {
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

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    matchHeader: {
        paddingHorizontal: 16,
        paddingTop: 4,
        paddingBottom: 4,
        borderBottomWidth: 1,
        width: '100%',
    },
    headerActionsRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 6,
        marginVertical: 4,
        flexWrap: 'wrap',
    },
    headerBtn: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        minWidth: 70,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerBtnMobile: {
        flex: 1,
        minWidth: 62,
        paddingHorizontal: 4,
        paddingVertical: 6,
    },
    headerBtnText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 12,
    },
    headerBtnTextMobile: {
        fontSize: 11,
    },
    scoreRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginVertical: 4,
        gap: 16,
    },
    teamScore: {
        alignItems: 'center',
        maxWidth: '44%',
    },
    teamName: {
        fontSize: 12,
        fontWeight: 'bold',
        letterSpacing: 0.5,
        textAlign: 'center',
    },
    scoreValue: {
        fontSize: 28,
        fontWeight: '900',
    },
    scoreDivider: {
        fontSize: 24,
        fontWeight: '300',
    },
    tabBar: {
        flexDirection: 'row',
        marginTop: 6,
    },
    tabItem: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderBottomWidth: 3,
        borderBottomColor: 'transparent',
    },
    tabItemOn: {
        borderBottomColor: '#003057',
    },
    tabText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#777',
    },
    tabTextOn: {
        color: '#003057',
    },
    phaseContainer: {
        padding: 14,
        gap: 12,
    },
    lockedBanner: {
        marginHorizontal: 14,
        marginTop: 12,
        marginBottom: 4,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: 'center',
    },
    lockedTitle: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#37474F',
        marginBottom: 2,
    },
    lockedSub: {
        fontSize: 11,
        color: '#546E7A',
        textAlign: 'center',
    },
    ratioBanner: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
    },
    ratioSub: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#fff',
        opacity: 0.8,
    },
    ratioMain: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
    },
    ratioFlipBtn: {
        backgroundColor: '#fff',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    ratioFlipText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#333',
    },
    statusBanner: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    statusTitle: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    statusSub: {
        fontSize: 13,
        fontWeight: '600',
    },
    promptBanner: {
        backgroundColor: '#C0D725',
        padding: 12,
        borderRadius: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    promptTitle: {
        fontSize: 15,
        fontWeight: '900',
        color: '#131E29',
    },
    promptActionBtn: {
        backgroundColor: '#fff',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
    },
    promptActionText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#131E29',
    },
    card: {
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 6,
    },
    muted: {
        fontSize: 13,
    },
    rowBetween: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    segment: {
        flexDirection: 'row',
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 8,
        overflow: 'hidden',
    },
    segBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: '#fff',
    },
    segBtnOn: {
        backgroundColor: '#003057',
    },
    segText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#333',
    },
    segTextOn: {
        color: '#fff',
        fontWeight: 'bold',
    },
    playerGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 8,
    },
    pbtn: {
        flex: 1,
        minHeight: 56,
        padding: 8,
        borderRadius: 10,
        borderWidth: 2,
        position: 'relative',
        justifyContent: 'center',
    },
    pbtnMobile: {
        minWidth: '47%',
        maxWidth: '49%',
    },
    pbtnDesktop: {
        minWidth: '30%',
        maxWidth: '32%',
    },
    pbtnSel: {
        borderWidth: 2,
        borderColor: '#003057',
    },
    pbtnPick: {
        borderColor: '#C0D725',
        backgroundColor: '#F6FAD9',
    },
    pbtnHolder: {
        borderColor: '#2E8540',
        borderWidth: 2,
    },
    pbtnName: {
        fontSize: 13,
        fontWeight: 'bold',
    },
    pbtnSub: {
        fontSize: 10,
        color: '#777',
        marginTop: 2,
    },
    genderBadge: {
        position: 'absolute',
        top: 6,
        right: 6,
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 4,
    },
    genderText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
    },
    lineBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 12,
        flexWrap: 'wrap',
        gap: 8,
    },
    chip: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 20,
    },
    chipText: {
        fontWeight: 'bold',
        fontSize: 12,
        color: '#131E29',
    },
    lineUtilBtn: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 6,
        backgroundColor: '#f9f9f9',
    },
    lineUtilText: {
        fontSize: 11,
        color: '#444',
    },
    startPtBtn: {
        backgroundColor: '#003057',
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderRadius: 10,
    },
    startPtBtnMobile: {
        width: '100%',
        marginTop: 4,
        alignItems: 'center',
    },
    startPtText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
    },
    skipBtn: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 8,
    },
    skipBtnText: {
        fontSize: 12,
        color: '#555',
    },
    actionsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 8,
    },
    actBtn: {
        flex: 1,
        minWidth: '47%',
        maxWidth: '49%',
        minHeight: 64,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 8,
    },
    actBtnHero: {
        minWidth: '100%',
        maxWidth: '100%',
        minHeight: 62,
    },
    actTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '900',
    },
    actSub: {
        color: '#fff',
        fontSize: 10,
        opacity: 0.85,
        marginTop: 2,
    },
    defenseCard: {
        borderWidth: 2,
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
        elevation: 2,
    },
    defenseCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    defenseCardIcon: {
        fontSize: 16,
    },
    defenseCardTitle: {
        fontSize: 13,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    activeSchemaTag: {
        backgroundColor: '#E07A1F',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
    },
    activeSchemaTagText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: 'bold',
    },
    missingSchemaTag: {
        backgroundColor: '#FFF3E0',
        borderWidth: 1,
        borderColor: '#FFB74D',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
    },
    missingSchemaTagText: {
        color: '#D84315',
        fontSize: 10,
        fontWeight: 'bold',
    },
    defenseSchemaRow: {
        flexDirection: 'row',
        gap: 8,
    },
    defenseSchemaBtn: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    defenseSchemaBtnActive: {
        shadowColor: '#E07A1F',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
        elevation: 3,
    },
    defenseSchemaText: {
        fontSize: 13,
        fontWeight: '600',
    },
    defenseSchemaTextActive: {
        fontWeight: 'bold',
    },
    halfTimeBtn: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        backgroundColor: '#E07A1F18',
        borderWidth: 1,
        borderColor: '#E07A1F',
    },
    halfTimeBtnText: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#E07A1F',
    },
    halfTimeBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: '#2E854018',
        borderWidth: 1,
        borderColor: '#2E8540',
    },
    halfTimeBadgeText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#2E8540',
    },
    halfTimeNotice: {
        backgroundColor: '#FFF3E0',
        borderColor: '#FFB74D',
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 6,
        marginBottom: 8,
    },
    halfTimeNoticeText: {
        color: '#D84315',
        fontSize: 11,
        fontWeight: '600',
    },
    dsetsContainer: {
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 6,
        paddingHorizontal: 4,
    },
    dsetsTitle: {
        fontSize: 13,
        fontWeight: 'bold',
    },
    changeLineBtn: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
        backgroundColor: '#eee',
    },
    changeLineText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#333',
    },
    subReasonCard: {
        borderWidth: 2,
        borderRadius: 10,
        padding: 12,
        marginBottom: 10,
    },
    subReasonTitle: {
        fontSize: 13,
        fontWeight: 'bold',
    },
    subReasonDesc: {
        fontSize: 11,
        lineHeight: 15,
        marginTop: 2,
    },
    statsScroll: {
        flex: 1,
    },
    statsScrollContent: {
        padding: 14,
        paddingBottom: 48,
        gap: 16,
    },
    kpiGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 8,
    },
    kpiItem: {
        flex: 1,
        padding: 10,
        borderRadius: 10,
    },
    kpiItemMobile: {
        minWidth: '47%',
        maxWidth: '49%',
    },
    kpiItemDesktop: {
        minWidth: '30%',
        maxWidth: '32%',
    },
    kpiVal: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#131E29',
    },
    kpiLbl: {
        fontSize: 10,
        color: '#5B6570',
        marginTop: 2,
    },
    tableHeaderRow: {
        flexDirection: 'row',
        backgroundColor: '#EEF1F4',
        paddingVertical: 6,
        paddingHorizontal: 4,
        borderRadius: 6,
    },
    thCell: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#5B6570',
        textAlign: 'center',
    },
    tableRow: {
        flexDirection: 'row',
        paddingVertical: 6,
        paddingHorizontal: 4,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    tdCell: {
        fontSize: 12,
        textAlign: 'center',
    },
    filterChip: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#ccc',
    },
    filterChipOn: {
        backgroundColor: '#C0D725',
        borderColor: '#C0D725',
    },
    filterChipText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#333',
    },
    filterChipTextOn: {
        fontWeight: 'bold',
        color: '#131E29',
    },
    logItem: {
        paddingVertical: 4,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    logText: {
        fontSize: 12,
    },
    modalBg: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 16,
    },
    modalBox: {
        borderRadius: 16,
        padding: 18,
        maxHeight: '80%',
    },
});
