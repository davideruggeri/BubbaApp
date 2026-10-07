import React from 'react';
import { View, Text, Modal, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Member, assignTiedRanks } from '../../services/firestore';
import { attendanceStyles as styles } from './attendanceStyles';
import { ViewMode } from './attendanceTypes';

interface AttendanceRankingModalProps {
    visible: boolean;
    rankingMode: ViewMode;
    setRankingMode: (mode: ViewMode) => void;
    members: Member[];
    seasonCountsCampo: Record<string, number>;
    seasonCountsPalestra: Record<string, number>;
    theme: any;
    onClose: () => void;
}

export const AttendanceRankingModal: React.FC<AttendanceRankingModalProps> = ({
    visible,
    rankingMode,
    setRankingMode,
    members,
    seasonCountsCampo,
    seasonCountsPalestra,
    theme,
    onClose,
}) => {
    const getRankingCount = (m: Member) => {
        if (rankingMode === 'Palestra') {
            return seasonCountsPalestra[m.id] !== undefined
                ? seasonCountsPalestra[m.id]
                : (m.attendanceCountGym || 0);
        } else {
            return seasonCountsCampo[m.id] !== undefined
                ? seasonCountsCampo[m.id]
                : (m.attendanceCount || 0);
        }
    };

    const relevantMembers = members.filter(m => getRankingCount(m) > 0);
    const sortedMembers = relevantMembers.sort((a, b) => {
        const countA = getRankingCount(a);
        const countB = getRankingCount(b);
        if (countB !== countA) return countB - countA;
        return (a.nickname || a.firstName).localeCompare(b.nickname || b.firstName);
    });

    const rankedMembers = assignTiedRanks(sortedMembers, m => getRankingCount(m));
    const top3 = rankedMembers.slice(0, 3);
    const rest = rankedMembers.slice(3);

    const visualPodium = [];
    if (top3.length > 1) visualPodium.push(top3[1]);
    if (top3.length > 0) visualPodium.push(top3[0]);
    if (top3.length > 2) visualPodium.push(top3[2]);

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.centeredView}>
                <View
                    style={[
                        styles.modalView,
                        { height: '80%', backgroundColor: theme.colors.card, width: '90%', maxWidth: 600 },
                    ]}
                >
                    <View
                        style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            width: '100%',
                            marginBottom: 10,
                        }}
                    >
                        <View style={{ width: 24 }} />
                        <Text style={[styles.modalTitle, { margin: 0, color: theme.colors.text }]}>
                            Classifica {rankingMode}
                        </Text>
                        <TouchableOpacity onPress={onClose}>
                            <Image source={require('../../assets/x.png')} style={{ width: 24, height: 24 }} />
                        </TouchableOpacity>
                    </View>

                    {/* Mode Toggle inside Modal */}
                    <View
                        style={[
                            styles.modeToggleContainer,
                            { backgroundColor: theme.colors.inputBackground, marginBottom: 20 },
                        ]}
                    >
                        <TouchableOpacity
                            style={[
                                styles.modeButton,
                                rankingMode === 'Campo' && styles.modeButtonActive,
                                rankingMode === 'Campo' && { backgroundColor: theme.colors.card },
                            ]}
                            onPress={() => setRankingMode('Campo')}
                        >
                            <Text
                                style={[
                                    styles.modeButtonText,
                                    rankingMode === 'Campo' && styles.modeButtonTextActive,
                                    { color: rankingMode === 'Campo' ? '#003399' : theme.colors.textSecondary },
                                ]}
                            >
                                Campo
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                styles.modeButton,
                                rankingMode === 'Palestra' && styles.modeButtonActive,
                                rankingMode === 'Palestra' && { backgroundColor: theme.colors.card },
                            ]}
                            onPress={() => setRankingMode('Palestra')}
                        >
                            <Text
                                style={[
                                    styles.modeButtonText,
                                    rankingMode === 'Palestra' && styles.modeButtonTextActive,
                                    { color: rankingMode === 'Palestra' ? '#003399' : theme.colors.textSecondary },
                                ]}
                            >
                                Palestra
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={{ width: '100%' }} contentContainerStyle={{ paddingBottom: 20 }}>
                        {visualPodium.length > 0 && (
                            <View style={styles.podiumContainer}>
                                {visualPodium.map(member => {
                                    const count = getRankingCount(member);
                                    let height = 100;
                                    let color = '#FFD700';

                                    if (member.rank === 1) {
                                        height = 140;
                                        color = '#FFD700';
                                    } else if (member.rank === 2) {
                                        height = 100;
                                        color = '#C0C0C0';
                                    } else {
                                        height = 70;
                                        color = '#CD7F32';
                                    }

                                    return (
                                        <View key={member.id} style={styles.podiumPlace}>
                                            <Text
                                                style={[styles.podiumName, { color: theme.colors.text }]}
                                                numberOfLines={1}
                                            >
                                                {member.nickname || member.firstName}
                                            </Text>
                                            <View style={[styles.podiumBar, { height, backgroundColor: color }]}>
                                                <Text style={styles.podiumRank}>{member.rank}</Text>
                                                <Text style={styles.podiumPoints}>{count}</Text>
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>
                        )}

                        <View style={styles.rankingList}>
                            {rest.map(member => {
                                const count = getRankingCount(member);
                                return (
                                    <View
                                        key={member.id}
                                        style={[styles.rankingRow, { borderBottomColor: theme.colors.border }]}
                                    >
                                        <Text style={[styles.rankingRank, { color: theme.colors.textSecondary }]}>
                                            {member.badge ? `${member.badge} ` : ''}
                                            {member.rank}
                                        </Text>
                                        <Text style={[styles.rankingName, { color: theme.colors.text }]}>
                                            {member.nickname || member.firstName}
                                        </Text>
                                        <Text style={[styles.rankingCount, { color: theme.colors.primary }]}>
                                            {count}
                                        </Text>
                                    </View>
                                );
                            })}
                        </View>

                        {sortedMembers.length === 0 && (
                            <Text
                                style={[
                                    styles.emptyStateText,
                                    { color: theme.colors.textSecondary, textAlign: 'center', marginTop: 20 },
                                ]}
                            >
                                Nessuna presenza registrata.
                            </Text>
                        )}
                    </ScrollView>

                    <TouchableOpacity
                        style={[styles.fullWidthButton, { backgroundColor: theme.colors.inputBackground, marginTop: 10 }]}
                        onPress={onClose}
                    >
                        <Text style={[styles.buttonText, { color: theme.colors.textSecondary }]}>Chiudi</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};
