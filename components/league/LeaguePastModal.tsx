import React, { useState } from 'react';
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    ScrollView,
    Image
} from 'react-native';
import { PastLeague } from '../../services/firestore';
import { leagueStyles as styles } from './leagueStyles';
import { useTheme } from '../../context/ThemeContext';

interface LeaguePastModalProps {
    visible: boolean;
    onClose: () => void;
    pastLeagues: PastLeague[];
    formatDateForDisplay: (date?: string | null) => string;
}

export const LeaguePastModal: React.FC<LeaguePastModalProps> = ({
    visible,
    onClose,
    pastLeagues,
    formatDateForDisplay
}) => {
    const { theme } = useTheme();
    const [currentHistoryIndex, setCurrentHistoryIndex] = useState(0);

    const currentLeague = pastLeagues[currentHistoryIndex];
    const podium = currentLeague ? currentLeague.standings.slice(0, 3) : [];

    // Reorder for visual podium: 2nd, 1st, 3rd
    const visualPodium = [];
    if (podium.length > 1) visualPodium.push(podium[1]); // 2nd
    if (podium.length > 0) visualPodium.push(podium[0]); // 1st
    if (podium.length > 2) visualPodium.push(podium[2]); // 3rd

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <View style={[styles.modalContent, { backgroundColor: theme.colors.card, maxHeight: '80%' }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                        <TouchableOpacity onPress={onClose}>
                            <Image source={require('../../assets/x.png')} style={{ width: 24, height: 24 }} />
                        </TouchableOpacity>
                    </View>

                    {pastLeagues.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>Nessuna lega passata.</Text>
                        </View>
                    ) : (
                        <>
                            <View style={styles.historyNav}>
                                <TouchableOpacity
                                    onPress={() => setCurrentHistoryIndex(prev => Math.min(prev + 1, pastLeagues.length - 1))}
                                    disabled={currentHistoryIndex >= pastLeagues.length - 1}
                                    style={styles.historyNavButton}
                                >
                                    <Image
                                        source={require('../../assets/arrow.png')}
                                        style={[
                                            styles.navIcon,
                                            {
                                                transform: [{ rotate: '180deg' }],
                                                tintColor: theme.colors.primary,
                                                opacity: currentHistoryIndex >= pastLeagues.length - 1 ? 0.3 : 1
                                            }
                                        ]}
                                    />
                                </TouchableOpacity>
                                <View>
                                    <Text style={[styles.historyTitle, { color: theme.colors.text }]}>
                                        {currentLeague?.name || 'Lega Passata'}
                                    </Text>
                                    <Text style={[styles.historySubtitle, { color: theme.colors.textSecondary }]}>
                                        {formatDateForDisplay(currentLeague?.startDate)} - {formatDateForDisplay(currentLeague?.endDate)}
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    onPress={() => setCurrentHistoryIndex(prev => Math.max(prev - 1, 0))}
                                    disabled={currentHistoryIndex <= 0}
                                    style={styles.historyNavButton}
                                >
                                    <Image
                                        source={require('../../assets/arrow.png')}
                                        style={[
                                            styles.navIcon,
                                            {
                                                tintColor: theme.colors.primary,
                                                opacity: currentHistoryIndex <= 0 ? 0.3 : 1
                                            }
                                        ]}
                                    />
                                </TouchableOpacity>
                            </View>

                            {/* Podium */}
                            <View style={styles.podiumContainer}>
                                {visualPodium.map((member) => {
                                    let rank = 1;
                                    let height = 100;
                                    let color = '#FFD700'; // Gold

                                    if (member.rank === 1) {
                                        rank = 1;
                                        height = 140;
                                        color = '#FFD700';
                                    } else if (member.rank === 2) {
                                        rank = 2;
                                        height = 100;
                                        color = '#C0C0C0'; // Silver
                                    } else {
                                        rank = 3;
                                        height = 70;
                                        color = '#CD7F32'; // Bronze
                                    }

                                    return (
                                        <View key={member.id} style={styles.podiumPlace}>
                                            <Text style={[styles.podiumName, { color: theme.colors.text }]} numberOfLines={1}>
                                                {member.name}
                                            </Text>
                                            <View style={[styles.podiumBar, { height, backgroundColor: color }]}>
                                                <Text style={styles.podiumRank}>{rank}</Text>
                                                <Text style={styles.podiumPoints}>{member.points} pt</Text>
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>

                            <Text style={{ textAlign: 'center', color: theme.colors.textSecondary, marginBottom: 10 }}>
                                Partecipanti totali: {currentLeague?.totalParticipants}
                            </Text>

                            {currentLeague?.standings && currentLeague.standings.length > 0 && (
                                <ScrollView style={{ flex: 1, maxHeight: 220, marginTop: 4 }} contentContainerStyle={{ paddingBottom: 10 }}>
                                    {currentLeague.standings.map((member, sIdx) => (
                                        <View
                                            key={member.id || sIdx}
                                            style={[
                                                styles.row,
                                                sIdx % 2 === 0 && { backgroundColor: theme.colors.sectionBackground },
                                                { borderBottomColor: theme.colors.border, paddingVertical: 6 }
                                            ]}
                                        >
                                            <Text style={[styles.cell, styles.cellRank, { color: theme.colors.primary }]}>{member.rank || sIdx + 1}</Text>
                                            <Text style={[styles.cell, styles.cellTeam, { color: theme.colors.text }]} numberOfLines={1}>{member.name}</Text>
                                            <Text style={[styles.cell, styles.cellPoints, { color: theme.colors.text }]}>{member.points} pt</Text>
                                            <Text style={[styles.cell, { color: theme.colors.textSecondary, fontSize: 12 }]}>{member.attendanceCount} pres.</Text>
                                            <Text style={[
                                                styles.cell,
                                                {
                                                    color: (member.bonusPoints || 0) >= 0 ? theme.colors.success : theme.colors.danger,
                                                    fontSize: 12
                                                }
                                            ]}>
                                                {(member.bonusPoints || 0) > 0 ? `+${member.bonusPoints}` : (member.bonusPoints || 0)}
                                            </Text>
                                        </View>
                                    ))}
                                </ScrollView>
                            )}
                        </>
                    )}
                </View>
            </View>
        </Modal>
    );
};
