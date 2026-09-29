import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenTitle from '../components/ScreenTitle';
import ParticipantsModal from '../components/ParticipantsModal';
import { useTheme } from '../context/ThemeContext';
import { RootStackParamList } from '../App';
import { MatchAnalysis, updateMatchAnalysis, subscribeToMembers, Member, MatchPlayer, subscribeToSingleMatch, MatchPoint } from '../services/firestore';

import { showAlert, showConfirmation } from '../utils/alert';
import { useAuth } from '../context/AuthContext';
import PointDetailModal from '../components/PointDetailModal';

import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type MatchDetailScreenRouteProp = RouteProp<RootStackParamList, 'MatchDetail'>;
type MatchDetailScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function MatchDetailScreen() {
    const { theme } = useTheme();
    const { isStaff } = useAuth();
    const navigation = useNavigation<MatchDetailScreenNavigationProp>();
    const route = useRoute<MatchDetailScreenRouteProp>();
    const { match } = route.params;

    const [currentMatch, setCurrentMatch] = useState<MatchAnalysis>(match);
    const [members, setMembers] = useState<Member[]>([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [isPlayersExpanded, setIsPlayersExpanded] = useState(false);
    const [selectedPoint, setSelectedPoint] = useState<MatchPoint | null>(null);
    const [pointModalVisible, setPointModalVisible] = useState(false);

    useEffect(() => {
        const unsubscribeMembers = subscribeToMembers((allMembers) => {
            setMembers(allMembers);
        }, true); // Include inactive members

        const unsubscribeMatch = subscribeToSingleMatch(match.id, (updatedMatch: MatchAnalysis) => {
            setCurrentMatch(updatedMatch);
        });

        return () => {
            unsubscribeMembers();
            unsubscribeMatch();
        };
    }, [match.id]);

    const handleUpdatePlayers = async (newPlayers: MatchPlayer[]) => {
        try {
            await updateMatchAnalysis({ id: currentMatch.id, players: newPlayers });
            setCurrentMatch({ ...currentMatch, players: newPlayers });
        } catch (error) {
            showAlert("Errore", "Impossibile aggiornare i giocatori.");
        }
    };

    const handleAddMember = async (member: Member) => {
        const currentPlayers = currentMatch.players || [];
        if (currentPlayers.some(p => p.memberId === member.id)) {
            showAlert("Attenzione", "Giocatore già presente.");
            return;
        }

        const newPlayer: MatchPlayer = {
            id: Date.now().toString(), // Temporary ID
            name: member.nickname || `${member.firstName} ${member.lastName}`,
            isGuest: false,
            memberId: member.id,
            gender: member.gender || 'M' // Save gender, default to M
        };

        await handleUpdatePlayers([...currentPlayers, newPlayer]);
    };

    const handleAddMembers = async (newMembers: Member[]) => {
        const currentPlayers = currentMatch.players || [];
        const newPlayers: MatchPlayer[] = [];

        for (const member of newMembers) {
            if (!currentPlayers.some(p => p.memberId === member.id)) {
                newPlayers.push({
                    id: Date.now().toString() + Math.random().toString(36).substr(2, 9), // Unique ID
                    name: member.nickname || `${member.firstName} ${member.lastName}`,
                    isGuest: false,
                    memberId: member.id,
                    gender: member.gender || 'M'
                });
            }
        }

        if (newPlayers.length > 0) {
            await handleUpdatePlayers([...currentPlayers, ...newPlayers]);
        }
    };

    const handleAddGuest = async (name: string, gender?: 'M' | 'F') => {
        const currentPlayers = currentMatch.players || [];
        const newPlayer: MatchPlayer = {
            id: Date.now().toString(),
            name: name,
            isGuest: true,
            gender: gender // Save guest gender
        };

        await handleUpdatePlayers([...currentPlayers, newPlayer]);
    };

    const handleRemovePlayer = async (id: string) => {
        const currentPlayers = currentMatch.players || [];
        const updatedPlayers = currentPlayers.filter(p => p.id !== id);
        await handleUpdatePlayers(updatedPlayers);
    };

    const handleStartMatch = (mode: 'normal' | 'live' = 'normal') => {
        const minPlayers = currentMatch.surface === 'sabbia' ? 5 : 7;
        const currentPlayersCount = currentMatch.players?.length || 0;

        if (currentPlayersCount < minPlayers) {
            showAlert("Attenzione", "Giocatori non sufficienti per giocare.");
            return;
        }

        const matchToStart = mode === 'live' ? { ...currentMatch, status: 'live' as const } : currentMatch;
        // If entering in 'normal' mode (not live), ensure we don't accidentally set status to live if it wasn't already.
        // But if it IS live, and we click 'normal', we just want to view/edit without the live banner/timer?
        // User said: "Mentre il tasto vai alla partita non deve avere il timer e non deve comparire come partita live per tutti"
        // So if mode is 'normal', we pass the match as is. LiveMatchScreen should handle the UI based on status.

        navigation.navigate('LiveMatch', { matchId: currentMatch.id, initialMatch: matchToStart, mode: mode });
    };

    const handleResetMatch = () => {
        showConfirmation(
            "Resetta Partita",
            "Sei sicuro? Questo cancellerà il punteggio e tutte le statistiche registrate per questa partita.",
            async () => {
                try {
                    const resetMatch = {
                        ...currentMatch,
                        ourScore: 0,
                        theirScore: 0,
                        points: [],
                        status: 'scheduled' as const
                    };
                    await updateMatchAnalysis(resetMatch);
                    setCurrentMatch(resetMatch);
                    showAlert("Successo", "Partita resettata.");
                } catch (error) {
                    showAlert("Errore", "Impossibile resettare la partita.");
                }
            },
            "Resetta"
        );
    };

    // Map MatchPlayer to RosterMember for ParticipantsModal
    const rosterForModal = (currentMatch.players || []).map(p => ({
        id: p.id,
        name: p.name,
        isGuest: p.isGuest,
        memberId: p.memberId,
        role: 'player' as const,
        gender: p.gender
    }));

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={[styles.header, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}>
                <ScreenTitle title="DETTAGLIO PARTITA" onBack={() => navigation.goBack()} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {/* Match Info Card */}
                <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
                    <Text style={[styles.opponentText, { color: theme.colors.text }]}>Bubba vs {currentMatch.opponent}</Text>
                    <Text style={[styles.dateText, { color: theme.colors.textSecondary }]}>
                        {currentMatch.date.split('-').reverse().join('/')}
                    </Text>

                    <View style={styles.detailsRow}>
                        <Text style={[styles.badge, { backgroundColor: currentMatch.surface === 'sabbia' ? '#ffe0b2' : '#c8e6c9', color: '#333' }]}>
                            {currentMatch.surface === 'sabbia' ? '🏖️ Sabbia' : '🌱 Erba'}
                        </Text>
                        <Text style={[styles.badge, { backgroundColor: '#e3f2fd', color: '#333' }]}>
                            {currentMatch.division === 'open' ? '🔓 Open' : '👫 Mixed'}
                        </Text>
                        {currentMatch.division === 'mixed' && currentMatch.startingGender && (
                            <Text style={[styles.badge, { backgroundColor: currentMatch.startingGender === 'M' ? '#e3f2fd' : '#fce4ec', color: '#333' }]}>
                                Gen: {currentMatch.startingGender}
                            </Text>
                        )}
                    </View>

                    <View style={styles.scoreContainer}>
                        <Text style={[styles.scoreText, { color: theme.colors.text }]}>
                            {currentMatch.ourScore || 0} - {currentMatch.theirScore || 0}
                        </Text>
                        <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>Punteggio Attuale</Text>
                    </View>
                </View>

                {/* Roster Section */}
                <View style={styles.sectionHeader}>
                    <TouchableOpacity
                        style={styles.sectionTitleContainer}
                        onPress={() => setIsPlayersExpanded(!isPlayersExpanded)}
                    >
                        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Giocatori ({currentMatch.players?.length || 0})</Text>
                        <Image
                            source={require('../assets/arrow.png')}
                            style={[
                                styles.arrowIcon,
                                { tintColor: theme.colors.text, transform: [{ rotate: isPlayersExpanded ? '90deg' : '0deg' }] }
                            ]}
                        />
                    </TouchableOpacity>
                    {isStaff && (
                        <TouchableOpacity onPress={() => setModalVisible(true)}>
                            <Text style={{ color: theme.colors.primary, fontWeight: 'bold' }}>+ Gestisci</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {isPlayersExpanded && currentMatch.players?.map((player, index) => {
                    // Calculate points played
                    let pointsPlayed = 0;
                    const totalPoints = currentMatch.points?.length || 0;
                    const stats: Record<string, number> = {};

                    currentMatch.points?.forEach(point => {
                        if (point.players.includes(player.id)) {
                            pointsPlayed++;
                        }

                        // Check if player assisted
                        if (point.assistBy === player.id) {
                            stats['A'] = (stats['A'] || 0) + 1;
                        }

                        // Check all other events
                        point.events.forEach(event => {
                            if (event.playerId === player.id) {
                                // We use the event type code directly
                                stats[event.type] = (stats[event.type] || 0) + 1;
                            }
                        });
                    });

                    // Format stats string
                    // Prioritize G and A, then others alphabetically
                    const statKeys = Object.keys(stats).sort((a, b) => {
                        if (a === 'G') return -1;
                        if (b === 'G') return 1;
                        if (a === 'A') return -1;
                        if (b === 'A') return 1;
                        return a.localeCompare(b);
                    });

                    const statsString = [`${pointsPlayed}/${totalPoints}`, ...statKeys.map(key => `${key}: ${stats[key]}`)].join(' - ');

                    return (
                        <View key={index} style={[styles.playerRow, { backgroundColor: theme.colors.card }]}>
                            <Text style={[styles.playerName, { color: theme.colors.text }]}>
                                {player.name} {player.isGuest ? '(Ospite)' : ''} {player.gender ? `(${player.gender})` : ''}
                            </Text>
                            <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>
                                {statsString}
                            </Text>
                        </View>
                    );
                })}

                {/* Momentum Graph */}
                <View style={[styles.card, { backgroundColor: theme.colors.card, alignItems: 'stretch' }]}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.text, marginBottom: 10 }]}>Andamento Partita</Text>
                    <View style={{ flexDirection: 'row', height: 30, borderRadius: 5, overflow: 'hidden' }}>
                        {currentMatch.points?.map((point, index) => {
                            // Determine who scored based on score change from previous point
                            const prevPoint = index > 0 ? currentMatch.points![index - 1] : { ourScore: 0, theirScore: 0 };
                            const weScored = point.ourScore > prevPoint.ourScore;
                            return (
                                <View
                                    key={index}
                                    style={{
                                        flex: 1,
                                        backgroundColor: weScored ? '#4CAF50' : '#F44336',
                                        marginHorizontal: 1
                                    }}
                                />
                            );
                        })}
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 }}>
                        <Text style={{ fontSize: 10, color: theme.colors.textSecondary }}>Inizio</Text>
                        <Text style={{ fontSize: 10, color: theme.colors.textSecondary }}>Fine</Text>
                    </View>
                </View>

                {/* Match Chronicle */}
                <View style={[styles.card, { backgroundColor: theme.colors.card, alignItems: 'stretch' }]}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.text, marginBottom: 10 }]}>Cronaca</Text>
                    {(() => {
                        const points = currentMatch.points || [];
                        const timeline: React.ReactNode[] = [];
                        const HALF_TIME_SCORE = currentMatch.surface === 'sabbia' ? 7 : 8;
                        let halftimeReached = false;

                        // 1. Start of Match
                        if (points.length > 0) {
                            const firstPoint = points[0];
                            // If first point type was 'offense', we started in offense.
                            // If 'defense', we started in defense (opponent offense).
                            const weStarted = firstPoint.type === 'offense';
                            timeline.push(
                                <View key="start" style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border, alignItems: 'center', backgroundColor: theme.colors.background }}>
                                    <Text style={{ fontWeight: 'bold', color: theme.colors.text }}>
                                        INIZIO PARTITA: ATTACCO {weStarted ? 'BUBBA' : (currentMatch.opponent || 'AVVERSARIO').toUpperCase()}
                                    </Text>
                                </View>
                            );
                        }

                        points.forEach((point, index) => {
                            const prevPoint = index > 0 ? points[index - 1] : { ourScore: 0, theirScore: 0 };

                            // Detect Legacy Data (Start Score vs Result Score)
                            // If the point's score is the SAME as the previous point's score, it's likely "Start Score" data (old format).
                            // In that case, we deduce the result score from the NEXT point or the match total.
                            let displayOurScore = point.ourScore;
                            let displayTheirScore = point.theirScore;
                            const isLegacyData = point.ourScore === prevPoint.ourScore && point.theirScore === prevPoint.theirScore;

                            if (isLegacyData) {
                                if (index + 1 < points.length) {
                                    displayOurScore = points[index + 1].ourScore;
                                    displayTheirScore = points[index + 1].theirScore;
                                } else {
                                    displayOurScore = currentMatch.ourScore || 0;
                                    displayTheirScore = currentMatch.theirScore || 0;
                                }
                            }

                            const weScored = displayOurScore > (isLegacyData ? prevPoint.ourScore : prevPoint.ourScore);
                            // Wait, if legacy, prevPoint is also start score. 
                            // Actually, if legacy:
                            // P1 (0-0). Prev (0-0). Display (0-1). WeScored = 0-1 > 0-0. True.
                            // P2 (0-1). Prev (0-0). Wait. P2 start score is 0-1. Prev P1 start score is 0-0.
                            // So P2.ourScore (0) > P1.ourScore (0) is False.
                            // But Display (0-2). PrevDisplay (0-1).

                            // Let's use the Display Scores for comparison.
                            // We need the "Previous Result Score".
                            // For index 0: Previous Result is 0-0.
                            // For index > 0: Previous Result is... well, we just calculated it for the previous iteration.
                            // But we can't easily access it here without a reduce or external var.

                            // Simpler:
                            // If isLegacyData:
                            //      StartScore = point.ourScore
                            //      ResultScore = displayOurScore
                            //      WeScored = ResultScore > StartScore
                            // If NOT Legacy:
                            //      ResultScore = point.ourScore
                            //      PrevResultScore = prevPoint.ourScore
                            //      WeScored = ResultScore > PrevResultScore

                            let effectivePrevOurScore = 0;
                            if (isLegacyData) {
                                effectivePrevOurScore = point.ourScore;
                            } else {
                                effectivePrevOurScore = prevPoint.ourScore;
                            }

                            const weScoredCorrected = displayOurScore > effectivePrevOurScore;

                            const isCallahan = point.events.some(e => e.type === 'C');

                            let scorer = currentMatch.players?.find(p => p.id === point.scoredBy);
                            if (isCallahan && !scorer) {
                                const callahanEvent = point.events.find(e => e.type === 'C');
                                if (callahanEvent) {
                                    scorer = currentMatch.players?.find(p => p.id === callahanEvent.playerId);
                                }
                            }

                            const assister = currentMatch.players?.find(p => p.id === point.assistBy);

                            // Break Logic
                            const isBreak = (weScoredCorrected && point.type === 'defense') || (!weScoredCorrected && point.type === 'offense');

                            timeline.push(
                                <TouchableOpacity
                                    key={`point-${index}`}
                                    style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}
                                    onPress={() => {
                                        setSelectedPoint(point);
                                        setPointModalVisible(true);
                                    }}
                                >
                                    <View style={{ width: 60, alignItems: 'center' }}>
                                        <Text style={{ fontWeight: 'bold', color: theme.colors.text }}>{displayOurScore} - {displayTheirScore}</Text>
                                        {isBreak && (
                                            <View style={{ backgroundColor: '#FFD700', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4, marginTop: 2 }}>
                                                <Text style={{ fontSize: 8, fontWeight: 'bold', color: '#333' }}>BREAK</Text>
                                            </View>
                                        )}
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 10 }}>
                                        <Text style={{ color: weScoredCorrected ? theme.colors.primary : theme.colors.danger, fontWeight: 'bold' }}>
                                            {weScoredCorrected ? 'Meta Bubba' : 'Meta Avversaria'}
                                        </Text>
                                        {weScoredCorrected && (
                                            <View style={{ marginTop: 2 }}>
                                                <Text style={{ color: theme.colors.text, fontSize: 13 }}>
                                                    {isCallahan ? 'Callahan: ' : 'Meta: '} {scorer ? scorer.name : 'Sconosciuto'} {assister ? `(Assist: ${assister.name})` : ''}
                                                </Text>
                                                {!!point.durationSeconds && (
                                                    <Text style={{ color: theme.colors.textSecondary, fontSize: 11, fontStyle: 'italic' }}>
                                                        Durata: {Math.floor(point.durationSeconds / 60)}m {point.durationSeconds % 60}s
                                                    </Text>
                                                )}
                                            </View>
                                        )}
                                        {!weScored && (
                                            <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>
                                                Meta Subita
                                            </Text>
                                        )}
                                    </View>
                                </TouchableOpacity>
                            );

                            // Check for Halftime
                            // Trigger if one team JUST reached the halftime score
                            const justReachedHalftime = (point.ourScore === HALF_TIME_SCORE && prevPoint.ourScore < HALF_TIME_SCORE) ||
                                (point.theirScore === HALF_TIME_SCORE && prevPoint.theirScore < HALF_TIME_SCORE);

                            if (!halftimeReached && justReachedHalftime) {
                                halftimeReached = true;
                                timeline.push(
                                    <View key="halftime" style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border, alignItems: 'center', backgroundColor: '#e0e0e0', marginVertical: 5 }}>
                                        <Text style={{ fontWeight: 'bold', color: '#333' }}>HALF TIME</Text>
                                    </View>
                                );

                                // Check who starts second half
                                // The NEXT point (index + 1) tells us the possession for the start of 2nd half
                                if (index + 1 < points.length) {
                                    const nextPoint = points[index + 1];
                                    const weStart2nd = nextPoint.type === 'offense';
                                    timeline.push(
                                        <View key="start-2nd" style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border, alignItems: 'center', backgroundColor: theme.colors.background }}>
                                            <Text style={{ fontWeight: 'bold', color: theme.colors.text }}>
                                                INIZIO SECONDO TEMPO: ATTACCO {weStart2nd ? 'BUBBA' : (currentMatch.opponent || 'AVVERSARIO').toUpperCase()}
                                            </Text>
                                        </View>
                                    );
                                }
                            }
                        });

                        return timeline;
                    })()}
                    {(!currentMatch.points || currentMatch.points.length === 0) && (
                        <Text style={{ color: theme.colors.textSecondary, textAlign: 'center' }}>Nessun punto registrato.</Text>
                    )}
                </View>

                {isStaff && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                        <TouchableOpacity
                            style={[styles.startButton, { backgroundColor: theme.colors.primary, flex: 1, marginRight: 5 }]}
                            onPress={() => handleStartMatch('normal')}
                        >
                            <Text style={styles.startButtonText}>
                                {currentMatch.status === 'completed' ? 'RIAPRI PARTITA' : 'VAI ALLA PARTITA'}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.startButton, { backgroundColor: theme.colors.danger, flex: 1, marginLeft: 5 }]}
                            onPress={() => handleStartMatch('live')}
                        >
                            <Text style={styles.startButtonText}>
                                {currentMatch.status === 'live' ? 'RIENTRA IN PARTITA' : 'AVVIA PARTITA LIVE'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}

                {isStaff && (
                    <TouchableOpacity style={[styles.resetButton, { borderColor: theme.colors.danger }]} onPress={handleResetMatch}>
                        <Text style={[styles.resetButtonText, { color: theme.colors.danger }]}>RESETTA PARTITA</Text>
                    </TouchableOpacity>
                )}
            </ScrollView>

            <ParticipantsModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                event={null} // Not a calendar event
                members={members}
                initialRoster={rosterForModal}
                onAddMember={handleAddMember}
                onAddMembers={handleAddMembers}
                onAddGuest={handleAddGuest}
                onRemoveMember={handleRemovePlayer}
                readOnly={false}
            />

            <PointDetailModal
                visible={pointModalVisible}
                onClose={() => setPointModalVisible(false)}
                point={selectedPoint}
                players={currentMatch.players || []}
                previousScore={(() => {
                    if (!selectedPoint || !currentMatch.points) return { our: 0, their: 0 };
                    const index = currentMatch.points.findIndex(p => p === selectedPoint);
                    if (index <= 0) return { our: 0, their: 0 };
                    return {
                        our: currentMatch.points[index - 1].ourScore,
                        their: currentMatch.points[index - 1].theirScore
                    };
                })()}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        padding: 20,
        alignItems: 'center',
        borderBottomWidth: 1,
    },
    content: {
        padding: 20,
    },
    card: {
        padding: 20,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    opponentText: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 5,
    },
    dateText: {
        fontSize: 14,
        marginBottom: 15,
    },
    detailsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        justifyContent: 'center',
    },
    badge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 15,
        fontSize: 12,
        fontWeight: '600',
        overflow: 'hidden',
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    sectionTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    arrowIcon: {
        width: 16,
        height: 16,
        resizeMode: 'contain',
    },
    playerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 15,
        borderRadius: 10,
        marginBottom: 8,
    },
    playerName: {
        fontSize: 16,
        fontWeight: '500',
    },
    startButton: {
        padding: 15,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 30,
    },
    startButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 18,
    },
    scoreContainer: {
        marginTop: 15,
        alignItems: 'center',
    },
    scoreText: {
        fontSize: 32,
        fontWeight: 'bold',
    },
    resetButton: {
        padding: 15,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 15,
        borderWidth: 1,
        marginBottom: 30,
    },
    resetButtonText: {
        fontWeight: 'bold',
        fontSize: 16,
    },
});
