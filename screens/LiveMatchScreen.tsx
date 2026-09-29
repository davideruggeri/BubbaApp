import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Image, TextInput } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RootStackParamList } from '../App';
import { MatchAnalysis, MatchPlayer, MatchPoint, MatchEvent, MatchStatType, updateMatchAnalysis, MatchStatsSettings, getMatchStatsSettings, updateMatchStatsSettings, DEFAULT_STATS_SETTINGS, StatDefinition } from '../services/firestore';
import { useTheme } from '../context/ThemeContext';
import ScreenTitle from '../components/ScreenTitle';
import { showAlert, showConfirmation } from '../utils/alert';

import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type LiveMatchScreenRouteProp = RouteProp<RootStackParamList, 'LiveMatch'>;
type LiveMatchScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'LiveMatch'>;

export default function LiveMatchScreen() {
    const { theme } = useTheme();
    const navigation = useNavigation<LiveMatchScreenNavigationProp>();
    const route = useRoute<LiveMatchScreenRouteProp>();
    const { matchId, initialMatch, mode } = route.params; // mode is 'normal' or 'live'
    const isLiveMode = mode === 'live';

    const [match, setMatch] = useState<MatchAnalysis>({
        ...initialMatch,
        rules: initialMatch.rules || {
            timeoutLimit: initialMatch.surface === 'sabbia' ? '1_per_match' : '1_per_half',
            scoreLimit: 'standard',
            halftimeMode: 'standard'
        }
    });
    const [currentPoint, setCurrentPoint] = useState<MatchPoint | null>(initialMatch.activePoint || null);
    const [activePlayers, setActivePlayers] = useState<string[]>([]); // IDs of players on field
    const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
    const [isLineupModalVisible, setIsLineupModalVisible] = useState(false);
    const [pointType, setPointType] = useState<'offense' | 'defense'>(match.currentPossession || 'offense');
    const [currentPossession, setCurrentPossession] = useState<'offense' | 'defense'>(match.currentPossession || 'offense');

    // Configurable Stats State
    const [statsSettings, setStatsSettings] = useState<MatchStatsSettings>(DEFAULT_STATS_SETTINGS);
    const [isSettingsModalVisible, setIsSettingsModalVisible] = useState(false);
    const [editingStat, setEditingStat] = useState<{ context: 'offense' | 'defense', index: number, stat: StatDefinition } | null>(null);

    // Derived state
    const [isAssistModalVisible, setIsAssistModalVisible] = useState(false);
    const [pendingScorerId, setPendingScorerId] = useState<string | null>(null);

    // Timer State
    const [timer, setTimer] = useState(0);
    const [isTimerRunning, setIsTimerRunning] = useState(false);

    // Derived state
    const ourScore = match.ourScore || 0;
    const theirScore = match.theirScore || 0;
    const maxPlayers = match.surface === 'sabbia' ? 5 : 7;

    useEffect(() => {
        loadStatsSettings();
    }, []);

    // Timer Logic
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isTimerRunning && currentPoint?.startTime) {
            interval = setInterval(() => {
                const now = Date.now();
                const elapsed = Math.floor((now - currentPoint.startTime!) / 1000);
                setTimer(elapsed);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isTimerRunning, currentPoint]);

    // Start/Stop Timer based on Point Status
    useEffect(() => {
        if (currentPoint && match.status === 'live') {
            setIsTimerRunning(true);
            if (currentPoint.startTime) {
                const now = Date.now();
                const elapsed = Math.floor((now - currentPoint.startTime) / 1000);
                setTimer(elapsed);
            }
        } else {
            setIsTimerRunning(false);
            setTimer(0);
        }
    }, [currentPoint, match.status]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const loadStatsSettings = async () => {
        if (match.statsSettings) {
            setStatsSettings(match.statsSettings);
        } else {
            const settings = await getMatchStatsSettings();
            setStatsSettings(settings);
        }
    };

    const handleStartPoint = async (type: 'offense' | 'defense') => {
        setPointType(type);
        setCurrentPossession(type);

        // Persist initial possession
        try {
            const updatedMatch = {
                ...match,
                currentPossession: type,
                status: isLiveMode ? 'live' as const : match.status // Only set live if in live mode
            };
            await updateMatchAnalysis(updatedMatch);
            setMatch(updatedMatch);
        } catch (e) {
            console.error("Error saving start point possession", e);
        }

        setIsLineupModalVisible(true);
    };

    const copyLastLineup = () => {
        if (match.points && match.points.length > 0) {
            const lastPoint = match.points[match.points.length - 1];
            setActivePlayers(lastPoint.players);
        } else {
            showAlert("Info", "Nessun punto precedente da cui copiare.");
        }
    };

    const togglePlayerInLineup = (playerId: string) => {
        setActivePlayers(prev => {
            if (prev.includes(playerId)) {
                return prev.filter(id => id !== playerId);
            } else {
                if (prev.length >= maxPlayers) {
                    showAlert("Limite Raggiunto", `Massimo ${maxPlayers} giocatori.`);
                    return prev;
                }
                return [...prev, playerId];
            }
        });
    };

    const getRequiredGenderCounts = () => {
        if (match.division !== 'mixed' || !match.startingGender) return null;

        const pointIndex = match.points ? match.points.length : 0;
        const isStartGenderMajority = Math.floor((pointIndex + 1) / 2) % 2 === 0;
        const majorityGender = isStartGenderMajority ? match.startingGender : (match.startingGender === 'M' ? 'F' : 'M');

        const totalPlayers = maxPlayers;
        const majorityCount = Math.ceil(totalPlayers / 2);
        const minorityCount = Math.floor(totalPlayers / 2);

        return {
            majorityGender,
            majorityCount,
            minorityCount
        };
    };

    const confirmLineup = () => {
        if (activePlayers.length === 0) {
            showAlert("Attenzione", "Seleziona almeno un giocatore.");
            return;
        }
        if (activePlayers.length > maxPlayers) {
            showAlert("Attenzione", `Massimo ${maxPlayers} giocatori in campo.`);
            return;
        }

        // Gender Ratio Validation
        const requirements = getRequiredGenderCounts();
        if (requirements) {
            const selectedPlayers = match.players?.filter(p => activePlayers.includes(p.id)) || [];
            const menCount = selectedPlayers.filter(p => p.gender === 'M').length;
            const womenCount = selectedPlayers.filter(p => p.gender === 'F').length;

            const { majorityGender, majorityCount, minorityCount } = requirements;
            const requiredMen = majorityGender === 'M' ? majorityCount : minorityCount;
            const requiredWomen = majorityGender === 'F' ? majorityCount : minorityCount;

            if (menCount !== requiredMen || womenCount !== requiredWomen) {
                showAlert(
                    "Ratio Errato",
                    `Per questo punto servono:\n${requiredMen} Uomini e ${requiredWomen} Donne.\n\nHai selezionato:\n${menCount} Uomini e ${womenCount} Donne.`
                );
                return;
            }
        }

        if (currentPoint) {
            // EDITING EXISTING POINT LINEUP
            const updatedPoint = {
                ...currentPoint,
                players: activePlayers
            };
            setCurrentPoint(updatedPoint);

            // Update active point in Firestore
            const updatedMatch = { ...match, activePoint: updatedPoint };
            updateMatchAnalysis(updatedMatch).catch(e => console.error("Error updating active point lineup", e));
            setMatch(updatedMatch);

            setIsLineupModalVisible(false);
        } else {
            // STARTING NEW POINT
            const newPoint: MatchPoint = {
                id: Date.now().toString(),
                events: [],
                ourScore,
                theirScore,
                type: pointType, // Uses the type set by handlePointEnd or handleStartPoint
                players: activePlayers,
                startTime: Date.now() // Start timer
            };
            setCurrentPoint(newPoint);

            // Persist active point
            const updatedMatch = { ...match, activePoint: newPoint };
            updateMatchAnalysis(updatedMatch).catch(e => console.error("Error starting new point", e));
            setMatch(updatedMatch);

            setIsLineupModalVisible(false);
            setSelectedPlayerId(null);
        }
    };

    const handleManualHalftime = async () => {
        const firstPoint = (match.points && match.points.length > 0) ? match.points[0] : null;
        if (!firstPoint) return;

        const startingPossession = firstPoint.type;
        const nextPossessionAfterHalftime = startingPossession === 'offense' ? 'defense' : 'offense';

        let nextType: 'offense' | 'defense' = nextPossessionAfterHalftime;
        setPointType(nextType);
        setCurrentPossession(nextType);

        showAlert("HALF TIME", `Cambio Campo!\nPossesso: ${nextType === 'offense' ? 'ATTACCO' : 'DIFESA'}`);
    };

    const handleEndMatch = async () => {
        showConfirmation(
            "Termina Partita",
            "Sei sicuro di voler terminare la partita?",
            async () => {
                try {
                    const updatedMatch: MatchAnalysis = { ...match, status: 'completed' };
                    await updateMatchAnalysis(updatedMatch);
                    setMatch(updatedMatch);
                    navigation.goBack();
                } catch (e) {
                    showAlert("Errore", "Impossibile terminare la partita.");
                }
            }
        );
    };

    const handlePointEnd = async (point: MatchPoint, weScored: boolean, scorerId?: string, assistId?: string) => {
        // 1. Update Score
        const newOurScore = weScored ? ourScore + 1 : ourScore;
        const newTheirScore = weScored ? theirScore : theirScore + 1;

        // 2. Finalize Point
        const finalizedPoint: MatchPoint = {
            ...point,
            ourScore: newOurScore,
            theirScore: newTheirScore,
            scoredBy: scorerId || null,
            assistBy: assistId || null,
            durationSeconds: timer // Save duration
        };

        // 3. Update Match in Firestore
        const updatedMatch: MatchAnalysis = {
            ...match,
            ourScore: newOurScore,
            theirScore: newTheirScore,
            points: [...(match.points || []), finalizedPoint],
            status: isLiveMode ? 'live' : match.status, // Only set live if in live mode
            currentPossession: weScored ? 'defense' : 'offense', // Persist next possession
            activePoint: null // Clear active point
        };

        try {
            await updateMatchAnalysis(updatedMatch);
            setMatch(updatedMatch);
            setCurrentPoint(null);

            // Auto-Possession Logic
            let nextType: 'offense' | 'defense' = weScored ? 'defense' : 'offense';
            setPointType(nextType);
            setCurrentPossession(nextType);

            setActivePlayers([]); // Clear lineup for next point

            // Half Time Logic
            const HALF_TIME_SCORE = match.surface === 'sabbia' ? 7 : 8;

            // Trigger ONLY if one team reached the target AND the other hasn't yet (meaning it's the first time)
            const isFirstTimeReachingHalftime = (newOurScore === HALF_TIME_SCORE && ourScore < HALF_TIME_SCORE && newTheirScore < HALF_TIME_SCORE) ||
                (newTheirScore === HALF_TIME_SCORE && theirScore < HALF_TIME_SCORE && newOurScore < HALF_TIME_SCORE);

            if (match.rules?.halftimeMode !== 'manual' && isFirstTimeReachingHalftime) {
                // Logic is the same for both: swap possession relative to START of match
                const firstPoint = (match.points && match.points.length > 0) ? match.points[0] : finalizedPoint;
                const startingPossession = firstPoint.type;
                const nextPossessionAfterHalftime = startingPossession === 'offense' ? 'defense' : 'offense';

                nextType = nextPossessionAfterHalftime;
                setPointType(nextType);
                setCurrentPossession(nextType);

                showAlert("HALF TIME", `Punteggio: ${newOurScore} - ${newTheirScore}\nCambio Campo!\nPossesso: ${nextType === 'offense' ? 'ATTACCO' : 'DIFESA'}`);
            }

            // Match End Logic
            // Ensure targetScore is a number
            const defaultTarget = match.surface === 'sabbia' ? 13 : 15;
            const targetScore = Number(match.targetScore) || defaultTarget;

            // Check if match is over
            const isScoreReached = newOurScore >= targetScore || newTheirScore >= targetScore;
            const isNoLimit = match.rules?.scoreLimit === 'no_limit';
            const isMatchOver = !isNoLimit && isScoreReached;

            if (isMatchOver) {
                const winner = newOurScore > newTheirScore ? 'Bubba' : (match.opponent || 'Avversario');
                showConfirmation(
                    "Partita Terminata!",
                    `Vince ${winner}!\nPunteggio Finale: ${newOurScore} - ${newTheirScore}`,
                    async () => {
                        try {
                            // Use updatedMatch which contains the latest point
                            const completedMatch: MatchAnalysis = { ...updatedMatch, status: 'completed' };
                            await updateMatchAnalysis(completedMatch);
                            setMatch(completedMatch);
                            navigation.navigate('MatchDetail', { match: completedMatch });
                        } catch (e) {
                            showAlert("Errore", "Impossibile terminare la partita.");
                        }
                    },
                    "OK"
                );
            } else {
                // Automatically open Lineup Modal for the next point if match is not over
                setIsLineupModalVisible(true);
            }

        } catch (error) {
            showAlert("Errore", "Impossibile salvare il punto.");
        }
    };

    const handleStatClick = (statDef: StatDefinition) => {
        if (!currentPoint) return;

        // Use the new flag, default to true if undefined
        const requiresPlayer = statDef.requiresPlayer !== false;

        if (!selectedPlayerId && requiresPlayer) {
            showAlert("Seleziona Giocatore", "Tocca un giocatore prima di assegnare una statistica.");
            return;
        }

        const newEvent: MatchEvent = {
            id: Date.now().toString(),
            playerId: selectedPlayerId || 'opponent',
            type: statDef.code as MatchStatType,
            timestamp: Date.now()
        };

        const updatedPoint = {
            ...currentPoint,
            events: [...currentPoint.events, newEvent]
        };

        // Update active point in Firestore immediately for persistence
        const updatedMatch = { ...match, activePoint: updatedPoint };
        updateMatchAnalysis(updatedMatch).catch(e => console.error("Error updating active point events", e));
        setMatch(updatedMatch);

        if (statDef.effect === 'score_us') {
            // Special case for Callahan (Challan) - No Assist
            if (statDef.code === 'C') {
                const finalPoint: MatchPoint = {
                    ...updatedPoint,
                    scoredBy: selectedPlayerId,
                    assistBy: null
                };
                setCurrentPoint(finalPoint);
                handlePointEnd(finalPoint, true, selectedPlayerId || undefined);
            } else {
                // Trigger Assist Flow for normal goals
                setPendingScorerId(selectedPlayerId);
                setIsAssistModalVisible(true);
                setCurrentPoint(updatedPoint);
            }
        } else if (statDef.effect === 'score_them') {
            setCurrentPoint(updatedPoint);
            handlePointEnd(updatedPoint, false);
        } else if (statDef.effect === 'turnover' || statDef.effect === 'switch_possession') {
            setCurrentPoint(updatedPoint);
            setCurrentPossession(prev => prev === 'offense' ? 'defense' : 'offense');
            setSelectedPlayerId(null);
        } else {
            setCurrentPoint(updatedPoint);
            setSelectedPlayerId(null);
        }
    };

    const handleAssistSelection = (assistId: string | null) => {
        if (!currentPoint) return;
        setIsAssistModalVisible(false);
        handlePointEnd(currentPoint, true, pendingScorerId || undefined, assistId || undefined);
        setPendingScorerId(null);
    };

    const handleRemoveTimeout = async (who: 'our' | 'their') => {
        const currentTimeouts = match.timeouts || { our: [], their: [] };
        const teamTimeouts = currentTimeouts[who] || [];

        if (teamTimeouts.length === 0) {
            showAlert("Info", "Nessun timeout da rimuovere.");
            return;
        }

        showConfirmation(
            "Rimuovi Timeout",
            `Vuoi rimuovere l'ultimo timeout chiamato da ${who === 'our' ? 'Bubba' : 'Avversario'}?`,
            async () => {
                const updatedTeamTimeouts = [...teamTimeouts];
                updatedTeamTimeouts.pop();

                const updatedTimeouts = {
                    ...currentTimeouts,
                    [who]: updatedTeamTimeouts
                };

                const updatedMatch = { ...match, timeouts: updatedTimeouts };

                try {
                    await updateMatchAnalysis(updatedMatch);
                    setMatch(updatedMatch);
                    showAlert("Successo", "Timeout rimosso.");
                } catch (e) {
                    showAlert("Errore", "Impossibile rimuovere il timeout.");
                }
            }
        );
    };

    const togglePossession = async () => {
        const newPossession = currentPossession === 'offense' ? 'defense' : 'offense';

        // Update local state
        setCurrentPossession(newPossession);
        setPointType(newPossession);

        // Update match state in Firestore
        const updatedMatch: MatchAnalysis = { ...match, currentPossession: newPossession };
        try {
            await updateMatchAnalysis(updatedMatch);
            setMatch(updatedMatch);
        } catch (e) {
            console.error("Error updating possession toggle", e);
            showAlert("Errore", "Impossibile aggiornare il possesso.");
        }
    };

    const handleTimeout = async (who: 'our' | 'their') => {
        const HALF_TIME_SCORE = match.surface === 'sabbia' ? 7 : 8;
        const currentHalf = (ourScore < HALF_TIME_SCORE && theirScore < HALF_TIME_SCORE) ? 'first' : 'second';

        const currentTimeouts = match.timeouts || { our: [], their: [] };
        const teamTimeouts = currentTimeouts[who] || [];
        let limitCount = 1;
        let limitScope = 'match';

        const limit = match.rules?.timeoutLimit || (match.surface === 'sabbia' ? '1_per_match' : '1_per_half');

        if (typeof limit === 'object' && limit !== null) {
            limitCount = limit.count;
            limitScope = limit.scope;
        } else if (limit === '1_per_half') {
            limitCount = 1;
            limitScope = 'half';
        } else if (limit === '1_per_match') {
            limitCount = 1;
            limitScope = 'match';
        } else if (limit === 'none') {
            limitCount = 999;
        }

        if (limitScope === 'match') {
            if (teamTimeouts.length >= limitCount) {
                showAlert("Timeout Esauriti", `Il team ${who === 'our' ? 'Bubba' : 'Avversario'} ha già chiamato ${limitCount} timeout.`);
                return;
            }
        } else {
            // Per Half
            const timeoutsInHalf = teamTimeouts.filter(t => t === currentHalf).length;
            if (timeoutsInHalf >= limitCount) {
                showAlert("Timeout Esauriti", `Il team ${who === 'our' ? 'Bubba' : 'Avversario'} ha già chiamato ${limitCount} timeout in questo tempo.`);
                return;
            }
        }
        // If limit is 'none', we just proceed.

        // Record Timeout
        const updatedTimeouts = {
            ...currentTimeouts,
            [who]: [...teamTimeouts, currentHalf]
        };

        const updatedMatch = { ...match, timeouts: updatedTimeouts };

        try {
            await updateMatchAnalysis(updatedMatch);
            setMatch(updatedMatch);
            showAlert("Timeout Chiamato", `Timeout ${who === 'our' ? 'Bubba' : 'Avversario'} (${currentHalf === 'first' ? '1°' : '2°'} Tempo)`);
        } catch (e) {
            showAlert("Errore", "Impossibile salvare il timeout.");
        }
    };



    const undoLastEvent = () => {
        if (!currentPoint || currentPoint.events.length === 0) return;
        const updatedEvents = [...currentPoint.events];
        const removedEvent = updatedEvents.pop();

        const statDef = [...statsSettings.offense, ...statsSettings.defense].find(s => s.code === removedEvent?.type);

        if (statDef && (statDef.effect === 'turnover' || statDef.effect === 'switch_possession')) {
            setCurrentPossession(prev => prev === 'offense' ? 'defense' : 'offense');
        }

        const newPointState = { ...currentPoint, events: updatedEvents };
        setCurrentPoint(newPointState);

        // Update active point in Firestore
        const updatedMatch = { ...match, activePoint: newPointState };
        updateMatchAnalysis(updatedMatch).catch(e => console.error("Error undoing event", e));
        setMatch(updatedMatch);
    };

    const undoLastPoint = async () => {
        if (!match.points || match.points.length === 0) {
            showAlert("Info", "Nessun punto da annullare.");
            return;
        }

        showConfirmation(
            "Annulla Ultimo Punto",
            "Sei sicuro di voler annullare l'ultimo punto assegnato?",
            async () => {
                try {
                    const updatedPoints = [...(match.points || [])];
                    const poppedPoint = updatedPoints.pop();

                    if (!poppedPoint) return;

                    // Revert Score
                    // Since points now store the RESULT score, we need to revert to the score of the PREVIOUS point.
                    // If there are no previous points, we revert to 0-0.
                    const previousPoint = updatedPoints.length > 0 ? updatedPoints[updatedPoints.length - 1] : null;
                    const revertedOurScore = previousPoint ? previousPoint.ourScore : 0;
                    const revertedTheirScore = previousPoint ? previousPoint.theirScore : 0;

                    // Restore the point as 'live'
                    // We want to resume playing this point.
                    // So `currentPoint` should be `poppedPoint` but we need to remove the *scoring event* if it was added?
                    // `handlePointEnd` doesn't add a scoring event to `point.events` explicitly in the `events` array?
                    // `handleStatClick` adds events.
                    // If `score_us` -> `handleAssistSelection` -> `handlePointEnd`. The scoring event (Meta) was added in `handleStatClick`.
                    // If `score_them` -> `handlePointEnd`. The scoring event (Meta Subita) was added in `handleStatClick`.
                    // So `poppedPoint.events` contains the scoring event. We should probably remove it so the user can "undo" the action that caused the point to end.

                    const restoredEvents = [...poppedPoint.events];
                    if (restoredEvents.length > 0) {
                        restoredEvents.pop(); // Remove the event that ended the point
                    }

                    const restoredPoint: MatchPoint = {
                        ...poppedPoint,
                        events: restoredEvents
                    };

                    // Determine possession
                    // If we are restoring a point, we need to know who had possession.
                    // `poppedPoint.type` stores the possession at the start of that point.
                    // But wait, during the point, possession might have changed (turnovers).
                    // We need to replay the events to find current possession?
                    // Or just trust `poppedPoint.type` is the *starting* type.
                    // If we restore it, we should probably set `pointType` to `poppedPoint.type`.
                    // But `currentPossession` needs to be calculated based on events.

                    let calculatedPossession = poppedPoint.type;
                    restoredEvents.forEach(evt => {
                        const statDef = [...statsSettings.offense, ...statsSettings.defense].find(s => s.code === evt.type);
                        if (statDef && (statDef.effect === 'turnover' || statDef.effect === 'switch_possession')) {
                            calculatedPossession = calculatedPossession === 'offense' ? 'defense' : 'offense';
                        }
                    });

                    const updatedMatch = {
                        ...match,
                        ourScore: revertedOurScore,
                        theirScore: revertedTheirScore,
                        points: updatedPoints,
                        currentPossession: calculatedPossession
                    };

                    await updateMatchAnalysis(updatedMatch);
                    setMatch(updatedMatch);

                    // Restore local state
                    setCurrentPoint(restoredPoint);
                    setPointType(poppedPoint.type);
                    setCurrentPossession(calculatedPossession);
                    setActivePlayers(poppedPoint.players); // Restore lineup

                    showAlert("Successo", "Ultimo punto annullato. Puoi continuare a giocare.");

                } catch (e) {
                    console.error(e);
                    showAlert("Errore", "Impossibile annullare il punto.");
                }
            }
        );
    };

    const saveSettings = async () => {
        try {
            // Save to LOCAL match settings instead of global
            const updatedMatch = { ...match, statsSettings: statsSettings };
            await updateMatchAnalysis(updatedMatch);
            setMatch(updatedMatch);
            setIsSettingsModalVisible(false);
            showAlert("Successo", "Impostazioni salvate per questa partita.");
        } catch (error) {
            showAlert("Errore", "Impossibile salvare le impostazioni.");
        }
    };

    const updateStatSetting = (value: any, field: keyof StatDefinition) => {
        if (!editingStat) return;
        const { context, index, stat } = editingStat;
        const newStat = { ...stat, [field]: value };

        setStatsSettings(prev => {
            const newList = [...prev[context]];
            newList[index] = newStat;
            return { ...prev, [context]: newList };
        });
        setEditingStat({ ...editingStat, stat: newStat });
    };

    const handleAddStat = (context: 'offense' | 'defense') => {
        const newStat: StatDefinition = {
            code: 'N',
            label: 'Nuova',
            color: '#999999',
            effect: 'none',
            requiresPlayer: true
        };
        setStatsSettings(prev => ({
            ...prev,
            [context]: [...prev[context], newStat]
        }));
        setEditingStat({ context, index: statsSettings[context].length, stat: newStat });
    };

    const handleDeleteStat = () => {
        if (!editingStat) return;
        const { context, index } = editingStat;

        showConfirmation(
            "Elimina Statistica",
            "Eliminare questa statistica?",
            () => {
                setStatsSettings(prev => {
                    const newList = [...prev[context]];
                    newList.splice(index, 1);
                    return { ...prev, [context]: newList };
                });
                setEditingStat(null);
            },
            "Elimina"
        );
    };

    const renderStatButton = (statDef: StatDefinition) => (
        <TouchableOpacity
            key={statDef.code}
            style={[styles.statButton, { backgroundColor: statDef.color }]}
            onPress={() => handleStatClick(statDef)}
        >
            <Text style={styles.statButtonText}>{statDef.code}</Text>
            <Text style={styles.statButtonLabel}>{statDef.label}</Text>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={[styles.header, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border, flexDirection: 'column', alignItems: 'stretch' }]}>
                <ScreenTitle
                    title="LIVE MATCH"
                    onBack={() => navigation.goBack()}
                    rightAction={{
                        icon: require('../assets/gear.png'),
                        onPress: () => setIsSettingsModalVisible(true),
                        color: theme.colors.text
                    }}
                    containerStyle={{ marginBottom: 0 }}
                />

                <View style={[styles.scoreContainer, { marginTop: 5, width: '100%' }]}>
                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                        <Text style={[styles.teamName, { color: theme.colors.text }]} numberOfLines={1}>Bubba</Text>
                        <Text style={[styles.scoreText, { color: theme.colors.text }]}>{ourScore}</Text>
                        <TouchableOpacity onPress={() => handleTimeout('our')} onLongPress={() => handleRemoveTimeout('our')} style={{ marginTop: 5, padding: 4, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 5 }}>
                            <Text style={{ fontSize: 10, color: theme.colors.primary, fontWeight: 'bold' }}>
                                TO: {match.timeouts?.our?.length || 0}
                            </Text>
                        </TouchableOpacity>
                    </View>
                    <Text style={[styles.scoreLabel, { color: theme.colors.textSecondary, width: 20, textAlign: 'center' }]}>-</Text>
                    <View style={{ flex: 1, alignItems: 'flex-start' }}>
                        <Text style={[styles.teamName, { color: theme.colors.text }]} numberOfLines={1}>{match.opponent || 'Avv.'}</Text>
                        <Text style={[styles.scoreText, { color: theme.colors.text }]}>{theirScore}</Text>
                        <TouchableOpacity onPress={() => handleTimeout('their')} onLongPress={() => handleRemoveTimeout('their')} style={{ marginTop: 5, padding: 4, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 5 }}>
                            <Text style={{ fontSize: 10, color: theme.colors.primary, fontWeight: 'bold' }}>
                                TO: {match.timeouts?.their?.length || 0}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Timer Display */}
                {currentPoint && (
                    <View style={{ alignItems: 'center', marginTop: 10 }}>
                        <Text style={{ fontSize: 24, fontWeight: 'bold', color: isTimerRunning ? theme.colors.danger : theme.colors.textSecondary }}>
                            {formatTime(timer)}
                        </Text>
                    </View>
                )}
            </View>

            {!currentPoint ? (
                <View style={styles.setupContainer}>
                    <Text style={[styles.setupTitle, { color: theme.colors.text }]}>
                        {match.points && match.points.length > 0 ? 'Punto Successivo' : 'Inizia Partita'}
                    </Text>

                    {match.points && match.points.length > 0 ? (
                        <>
                            <TouchableOpacity style={[styles.setupButton, { backgroundColor: theme.colors.primary }]} onPress={() => setIsLineupModalVisible(true)}>
                                <Text style={styles.setupButtonText}>
                                    {pointType === 'offense' ? 'Inizia Attacco' : 'Inizia Difesa'}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={{ marginTop: 20, padding: 10 }}
                                onPress={undoLastPoint}
                            >
                                <Text style={{ color: theme.colors.textSecondary, textDecorationLine: 'underline' }}>Annulla Ultimo Punto</Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <View style={styles.setupButtons}>
                            <TouchableOpacity style={[styles.setupButton, { backgroundColor: '#4CAF50' }]} onPress={() => handleStartPoint('offense')}>
                                <Text style={styles.setupButtonText}>Attacco</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.setupButton, { backgroundColor: '#F44336' }]} onPress={() => handleStartPoint('defense')}>
                                <Text style={styles.setupButtonText}>Difesa</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            ) : (
                <View style={styles.activePointContainer}>
                    <View style={styles.pointInfo}>
                        <TouchableOpacity onPress={togglePossession}>
                            <Text style={{ color: theme.colors.text, fontWeight: 'bold', textDecorationLine: 'underline' }}>
                                {currentPossession === 'offense' ? 'ATTACCO' : 'DIFESA'}
                            </Text>
                        </TouchableOpacity>
                        <Text style={{ color: theme.colors.text }}> - {activePlayers.length} Giocatori</Text>
                        <TouchableOpacity onPress={undoLastEvent} style={styles.undoButton}>
                            <Text style={{ color: theme.colors.primary }}>Annulla</Text>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        style={{ alignSelf: 'center', marginBottom: 10, padding: 5 }}
                        onPress={() => setIsLineupModalVisible(true)}
                    >
                        <Text style={{ color: theme.colors.textSecondary, fontSize: 12, textDecorationLine: 'underline' }}>Modifica Lineup / Sostituzione</Text>
                    </TouchableOpacity>

                    <ScrollView style={styles.playerList} horizontal showsHorizontalScrollIndicator={false}>
                        {match.players?.filter(p => activePlayers.includes(p.id)).map(player => (
                            <TouchableOpacity
                                key={player.id}
                                style={[
                                    styles.playerCard,
                                    { backgroundColor: theme.colors.card, borderColor: selectedPlayerId === player.id ? theme.colors.primary : 'transparent', borderWidth: 2 }
                                ]}
                                onPress={() => setSelectedPlayerId(player.id)}
                            >
                                <Text style={[styles.playerName, { color: theme.colors.text }]}>{player.name}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    <View style={styles.statsGrid}>
                        <View style={styles.statsRow}>
                            {statsSettings[currentPossession].map(stat => renderStatButton(stat))}
                        </View>
                    </View>

                    <ScrollView style={styles.logContainer}>
                        {currentPoint.events.slice().reverse().map((event, index) => {
                            const player = match.players?.find(p => p.id === event.playerId);
                            const statDef = [...statsSettings.offense, ...statsSettings.defense].find(s => s.code === event.type);
                            const isTeamStat = statDef?.requiresPlayer === false;

                            return (
                                <Text key={event.id} style={{ color: theme.colors.textSecondary, fontSize: 12 }}>
                                    {isTeamStat ? 'SQ' : (player?.name || 'Avversario')}: {event.type}
                                </Text>
                            );
                        })}
                    </ScrollView>
                </View>
            )}

            {/* Lineup Modal */}
            <Modal visible={isLineupModalVisible} animationType="slide" transparent={true} onRequestClose={() => { }}>
                <View style={styles.modalContainer}>
                    <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
                        <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                            {pointType === 'offense' ? 'ATTACCO' : 'DIFESA'} - Lineup ({activePlayers.length}/{maxPlayers})
                        </Text>
                        {match.division === 'mixed' && (
                            <Text style={{ textAlign: 'center', marginBottom: 10, color: theme.colors.textSecondary, fontWeight: 'bold' }}>
                                {(() => {
                                    const req = getRequiredGenderCounts();
                                    if (!req) return '';
                                    const { majorityGender, majorityCount, minorityCount } = req;
                                    const men = majorityGender === 'M' ? majorityCount : minorityCount;
                                    const women = majorityGender === 'F' ? majorityCount : minorityCount;
                                    return `Richiesti: ${men} Uomini - ${women} Donne`;
                                })()}
                            </Text>
                        )}

                        <TouchableOpacity
                            style={[styles.copyButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderWidth: 1 }]}
                            onPress={copyLastLineup}
                        >
                            <Text style={{ color: theme.colors.text }}>Copia Lineup Scorsa</Text>
                        </TouchableOpacity>

                        <ScrollView style={styles.modalList}>
                            {(() => {
                                const men = match.players?.filter(p => p.gender === 'M' || !p.gender) || [];
                                const women = match.players?.filter(p => p.gender === 'F') || [];

                                const renderPlayerItem = (player: MatchPlayer) => {
                                    const pointsPlayed = match.points?.filter(p => p.players.includes(player.id)).length || 0;
                                    const totalPoints = match.points?.length || 0;
                                    return (
                                        <TouchableOpacity
                                            key={player.id}
                                            style={[
                                                styles.modalItem,
                                                activePlayers.includes(player.id) && { backgroundColor: theme.colors.primary + '20' }
                                            ]}
                                            onPress={() => togglePlayerInLineup(player.id)}
                                        >
                                            <View>
                                                <Text style={[styles.modalItemText, { color: theme.colors.text }]}>
                                                    {player.name}
                                                </Text>
                                                <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>
                                                    Giocate: {pointsPlayed}/{totalPoints}
                                                </Text>
                                            </View>
                                            {activePlayers.includes(player.id) && <Text style={{ color: theme.colors.primary }}>✓</Text>}
                                        </TouchableOpacity>
                                    );
                                };

                                return (
                                    <>
                                        {men.length > 0 && (
                                            <>
                                                <Text style={{ fontWeight: 'bold', color: theme.colors.text, marginTop: 10, marginBottom: 5 }}>Uomini</Text>
                                                {men.map(renderPlayerItem)}
                                            </>
                                        )}
                                        {women.length > 0 && (
                                            <>
                                                <Text style={{ fontWeight: 'bold', color: theme.colors.text, marginTop: 10, marginBottom: 5 }}>Donne</Text>
                                                {women.map(renderPlayerItem)}
                                            </>
                                        )}
                                    </>
                                );
                            })()}
                        </ScrollView>
                        <TouchableOpacity style={[styles.confirmButton, { backgroundColor: theme.colors.primary }]} onPress={confirmLineup}>
                            <Text style={styles.confirmButtonText}>Conferma ({activePlayers.length})</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.confirmButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderWidth: 1, marginTop: 10 }]}
                            onPress={() => setIsLineupModalVisible(false)}
                        >
                            <Text style={[styles.confirmButtonText, { color: theme.colors.text }]}>Annulla</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Assist Modal */}
            <Modal visible={isAssistModalVisible} animationType="fade" transparent={true}>
                <View style={styles.modalContainer}>
                    <View style={[styles.modalContent, { backgroundColor: theme.colors.card, height: '60%' }]}>
                        <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Chi ha fatto Assist?</Text>

                        <TouchableOpacity
                            style={[styles.modalItem, { justifyContent: 'center', backgroundColor: '#eee' }]}
                            onPress={() => handleAssistSelection(null)}
                        >
                            <Text style={[styles.modalItemText, { color: '#333', fontWeight: 'bold' }]}>Nessun Assist</Text>
                        </TouchableOpacity>

                        <ScrollView style={styles.modalList}>
                            {match.players?.filter(p => activePlayers.includes(p.id) && p.id !== pendingScorerId).map(player => (
                                <TouchableOpacity
                                    key={player.id}
                                    style={styles.modalItem}
                                    onPress={() => handleAssistSelection(player.id)}
                                >
                                    <Text style={[styles.modalItemText, { color: theme.colors.text }]}>{player.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        <TouchableOpacity
                            style={[styles.confirmButton, { backgroundColor: theme.colors.textSecondary, marginTop: 10 }]}
                            onPress={() => setIsAssistModalVisible(false)} // Cancel? Or force selection?
                        >
                            <Text style={styles.confirmButtonText}>Annulla</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Settings Modal */}
            <Modal visible={isSettingsModalVisible} animationType="slide" transparent={true}>
                <View style={styles.modalContainer}>
                    <View style={[styles.modalContent, { backgroundColor: theme.colors.card, height: '90%' }]}>
                        <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Impostazioni Statistiche</Text>

                        {editingStat ? (
                            <View style={{ flex: 1 }}>
                                <Text style={{ color: theme.colors.text, marginBottom: 5 }}>Codice (es. M)</Text>
                                <TextInput
                                    style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border }]}
                                    value={editingStat.stat.code}
                                    onChangeText={(t) => updateStatSetting(t, 'code')}
                                />
                                <Text style={{ color: theme.colors.text, marginBottom: 5, marginTop: 10 }}>Etichetta (es. Meta)</Text>
                                <TextInput
                                    style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border }]}
                                    value={editingStat.stat.label}
                                    onChangeText={(t) => updateStatSetting(t, 'label')}
                                />
                                <Text style={{ color: theme.colors.text, marginBottom: 5, marginTop: 10 }}>Descrizione</Text>
                                <TextInput
                                    style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border }]}
                                    value={editingStat.stat.description || ''}
                                    onChangeText={(t) => updateStatSetting(t, 'description')}
                                />
                                <Text style={{ color: theme.colors.text, marginBottom: 5, marginTop: 10 }}>Colore</Text>
                                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                                    {['#4CAF50', '#F44336', '#2196F3', '#FF9800', '#9C27B0', '#607D8B'].map(color => (
                                        <TouchableOpacity
                                            key={color}
                                            style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: color, borderWidth: editingStat.stat.color === color ? 2 : 0, borderColor: theme.colors.text }}
                                            onPress={() => updateStatSetting(color, 'color')}
                                        />
                                    ))}
                                </View>

                                <Text style={{ color: theme.colors.text, marginBottom: 5, marginTop: 10 }}>Effetto</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
                                    {[
                                        { label: 'Nessuno', value: 'none' },
                                        { label: 'Cambio Possesso', value: 'switch_possession' },
                                        { label: 'Meta (Noi)', value: 'score_us' },
                                        { label: 'Meta (Loro)', value: 'score_them' },
                                    ].map((opt) => (
                                        <TouchableOpacity
                                            key={opt.value}
                                            style={{
                                                padding: 8,
                                                borderRadius: 8,
                                                borderWidth: 1,
                                                borderColor: editingStat.stat.effect === opt.value ? theme.colors.primary : theme.colors.border,
                                                backgroundColor: editingStat.stat.effect === opt.value ? theme.colors.primary + '20' : 'transparent',
                                                marginBottom: 5
                                            }}
                                            onPress={() => updateStatSetting(opt.value, 'effect')}
                                        >
                                            <Text style={{ color: theme.colors.text, fontSize: 12 }}>{opt.label}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                <Text style={{ color: theme.colors.text, marginBottom: 5, marginTop: 10 }}>Richiede Giocatore?</Text>
                                <TouchableOpacity
                                    style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}
                                    onPress={() => updateStatSetting(editingStat.stat.requiresPlayer === false, 'requiresPlayer')}
                                >
                                    <View style={{
                                        width: 24, height: 24, borderRadius: 4, borderWidth: 2, borderColor: theme.colors.primary,
                                        backgroundColor: editingStat.stat.requiresPlayer !== false ? theme.colors.primary : 'transparent',
                                        alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        {editingStat.stat.requiresPlayer !== false && <Text style={{ color: 'white', fontWeight: 'bold' }}>✓</Text>}
                                    </View>
                                    <Text style={{ color: theme.colors.text, marginLeft: 10 }}>
                                        {editingStat.stat.requiresPlayer !== false ? 'Sì, richiede un giocatore' : 'No, statistica di squadra/avversaria'}
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={[styles.confirmButton, { backgroundColor: '#d32f2f', marginTop: 10 }]} onPress={handleDeleteStat}>
                                    <Text style={styles.confirmButtonText}>Elimina Statistica</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={[styles.confirmButton, { backgroundColor: theme.colors.primary, marginTop: 20 }]} onPress={() => setEditingStat(null)}>
                                    <Text style={styles.confirmButtonText}>Fatto</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <ScrollView style={{ flex: 1 }}>
                                <Text style={[styles.sectionTitle, { color: theme.colors.text, marginTop: 0 }]}>Regole Partita</Text>

                                {/* Timeout Rules */}
                                <Text style={{ color: theme.colors.text, marginBottom: 5, fontWeight: 'bold' }}>Timeout</Text>
                                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 15 }}>
                                    {[
                                        { label: '1/Tempo', value: '1_per_half' },
                                        { label: '1/Partita', value: '1_per_match' },
                                        { label: 'Illimitati', value: 'none' }
                                    ].map((opt) => (
                                        <TouchableOpacity
                                            key={opt.value}
                                            style={{
                                                padding: 8,
                                                borderRadius: 8,
                                                borderWidth: 1,
                                                borderColor: (match.rules?.timeoutLimit || (match.surface === 'sabbia' ? '1_per_match' : '1_per_half')) === opt.value ? theme.colors.primary : theme.colors.border,
                                                backgroundColor: (match.rules?.timeoutLimit || (match.surface === 'sabbia' ? '1_per_match' : '1_per_half')) === opt.value ? theme.colors.primary + '20' : 'transparent'
                                            }}
                                            onPress={async () => {
                                                const updatedMatch = {
                                                    ...match,
                                                    rules: {
                                                        timeoutLimit: opt.value as any,
                                                        scoreLimit: (match.rules?.scoreLimit || 'standard') as 'standard' | 'no_limit',
                                                        halftimeMode: (match.rules?.halftimeMode || 'standard') as 'standard' | 'manual'
                                                    }
                                                };
                                                setMatch(updatedMatch);
                                                await updateMatchAnalysis(updatedMatch);
                                            }}
                                        >
                                            <Text style={{ color: theme.colors.text, fontSize: 12 }}>{opt.label}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                {/* Game Mode */}
                                <Text style={{ color: theme.colors.text, marginBottom: 5, fontWeight: 'bold' }}>Modalità</Text>
                                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 15 }}>
                                    {[
                                        { label: 'Standard', value: 'standard' },
                                        { label: 'Senza Limiti', value: 'no_limit' }
                                    ].map((opt) => (
                                        <TouchableOpacity
                                            key={opt.value}
                                            style={{
                                                padding: 8,
                                                borderRadius: 8,
                                                borderWidth: 1,
                                                borderColor: (match.rules?.scoreLimit || 'standard') === opt.value ? theme.colors.primary : theme.colors.border,
                                                backgroundColor: (match.rules?.scoreLimit || 'standard') === opt.value ? theme.colors.primary + '20' : 'transparent'
                                            }}
                                            onPress={async () => {
                                                const updatedMatch = {
                                                    ...match,
                                                    rules: {
                                                        timeoutLimit: match.rules?.timeoutLimit || (match.surface === 'sabbia' ? '1_per_match' : '1_per_half'),
                                                        scoreLimit: opt.value as any,
                                                        halftimeMode: (opt.value === 'no_limit' ? 'manual' : 'standard') as 'standard' | 'manual'
                                                    }
                                                };
                                                setMatch(updatedMatch);
                                                await updateMatchAnalysis(updatedMatch);
                                            }}
                                        >
                                            <Text style={{ color: theme.colors.text, fontSize: 12 }}>{opt.label}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                {/* Manual Actions */}
                                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
                                    <TouchableOpacity
                                        style={[styles.confirmButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderWidth: 1, flex: 1, padding: 10, marginTop: 0 }]}
                                        onPress={() => {
                                            setIsSettingsModalVisible(false);
                                            handleManualHalftime();
                                        }}
                                    >
                                        <Text style={{ color: theme.colors.text, fontWeight: 'bold', textAlign: 'center' }}>Chiama Halftime</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.confirmButton, { backgroundColor: '#d32f2f', flex: 1, padding: 10, marginTop: 0 }]}
                                        onPress={() => {
                                            setIsSettingsModalVisible(false);
                                            handleEndMatch();
                                        }}
                                    >
                                        <Text style={{ color: 'white', fontWeight: 'bold', textAlign: 'center' }}>Termina Partita</Text>
                                    </TouchableOpacity>
                                </View>

                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Attacco</Text>
                                    <TouchableOpacity onPress={() => handleAddStat('offense')}>
                                        <Text style={{ color: theme.colors.primary, fontWeight: 'bold' }}>+ Aggiungi</Text>
                                    </TouchableOpacity>
                                </View>
                                {statsSettings.offense.map((stat, index) => (
                                    <TouchableOpacity key={index} style={styles.settingItem} onPress={() => setEditingStat({ context: 'offense', index, stat })}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                            <View style={[styles.colorDot, { backgroundColor: stat.color }]} />
                                            <Text style={{ color: theme.colors.text, fontWeight: 'bold' }}>{stat.code}</Text>
                                            <Text style={{ color: theme.colors.text }}>{stat.label}</Text>
                                        </View>
                                        <Image source={require('../assets/gear.png')} style={[styles.gearIconSmall, { tintColor: theme.colors.textSecondary }]} />
                                    </TouchableOpacity>
                                ))}

                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }}>
                                    <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Difesa</Text>
                                    <TouchableOpacity onPress={() => handleAddStat('defense')}>
                                        <Text style={{ color: theme.colors.primary, fontWeight: 'bold' }}>+ Aggiungi</Text>
                                    </TouchableOpacity>
                                </View>
                                {statsSettings.defense.map((stat, index) => (
                                    <TouchableOpacity key={index} style={styles.settingItem} onPress={() => setEditingStat({ context: 'defense', index, stat })}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                            <View style={[styles.colorDot, { backgroundColor: stat.color }]} />
                                            <Text style={{ color: theme.colors.text, fontWeight: 'bold' }}>{stat.code}</Text>
                                            <Text style={{ color: theme.colors.text }}>{stat.label}</Text>
                                        </View>
                                        <Image source={require('../assets/gear.png')} style={[styles.gearIconSmall, { tintColor: theme.colors.textSecondary }]} />
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        )}

                        {!editingStat && (
                            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                                <TouchableOpacity style={[styles.confirmButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderWidth: 1, flex: 1 }]} onPress={() => setIsSettingsModalVisible(false)}>
                                    <Text style={{ color: theme.colors.text, fontWeight: 'bold' }}>Annulla</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.confirmButton, { backgroundColor: theme.colors.primary, flex: 1 }]} onPress={saveSettings}>
                                    <Text style={styles.confirmButtonText}>Salva</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1 },
    scoreContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    scoreText: { fontSize: 24, fontWeight: 'bold' },
    scoreLabel: { fontSize: 24 },
    setupContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 20 },
    setupTitle: { fontSize: 20, fontWeight: 'bold' },
    setupButtons: { flexDirection: 'row', gap: 20 },
    setupButton: { paddingVertical: 15, paddingHorizontal: 30, borderRadius: 10 },
    setupButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    activePointContainer: { flex: 1, padding: 10 },
    pointInfo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    undoButton: { padding: 5 },
    playerList: { maxHeight: 60, marginBottom: 10 },
    playerCard: { padding: 8, borderRadius: 8, marginRight: 8, justifyContent: 'center', minWidth: 70, alignItems: 'center' },
    playerName: { fontWeight: 'bold', fontSize: 12 },
    statsGrid: { marginTop: 5 },
    statsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
    statButton: { width: '30%', height: 80, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
    statButtonText: { color: 'white', fontSize: 20, fontWeight: 'bold' },
    statButtonLabel: { color: 'white', fontSize: 10, textAlign: 'center' },
    logContainer: { marginTop: 10, flex: 1 },
    modalContainer: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
    modalContent: { height: '70%', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
    modalList: { flex: 1 },
    modalItem: { padding: 15, borderBottomWidth: 0.5, borderBottomColor: '#ccc', flexDirection: 'row', justifyContent: 'space-between' },
    modalItemText: { fontSize: 16 },
    confirmButton: { padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 10 },
    confirmButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    copyButton: { padding: 10, borderRadius: 8, alignItems: 'center', marginBottom: 10 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', marginTop: 10, marginBottom: 5 },
    settingItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: '#ccc' },
    colorDot: { width: 16, height: 16, borderRadius: 8 },
    gearIconSmall: { width: 16, height: 16 },
    input: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 16 },
    teamName: { fontSize: 12, fontWeight: 'bold', marginBottom: 2, maxWidth: 100 },
});
