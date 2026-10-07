import React from 'react';
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    ScrollView,
    Image
} from 'react-native';
import { Member } from '../../services/firestore';
import { MemberHistoryItem } from './leagueTypes';
import { leagueStyles as styles } from './leagueStyles';
import { useTheme } from '../../context/ThemeContext';

interface LeagueHistoryModalProps {
    visible: boolean;
    onClose: () => void;
    member: Member | null;
    history: MemberHistoryItem[];
    formatDateForDisplay: (date?: string | null) => string;
}

export const LeagueHistoryModal: React.FC<LeagueHistoryModalProps> = ({
    visible,
    onClose,
    member,
    history,
    formatDateForDisplay
}) => {
    const { theme } = useTheme();

    if (!member) return null;

    const totalPoints = history.reduce((sum, item) => sum + item.points, 0);

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <View style={[styles.modalContent, { backgroundColor: theme.colors.card, overflow: 'hidden' }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                        <Text style={[styles.modalTitle, { margin: 0, color: theme.colors.text }]}>
                            Storia Punti: {member.nickname || member.firstName}
                        </Text>
                        <TouchableOpacity onPress={onClose}>
                            <Image source={require('../../assets/x.png')} style={{ width: 24, height: 24 }} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={{ flex: 1 }}>
                        {history.length === 0 ? (
                            <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>Nessun punto registrato.</Text>
                        ) : (
                            history.map((item, index) => (
                                <View key={index} style={[styles.historyRow, { borderBottomColor: theme.colors.border }]}>
                                    <Text style={[styles.historyDate, { color: theme.colors.textSecondary }]}>{formatDateForDisplay(item.date)}</Text>
                                    <Text style={[styles.historyReason, { color: theme.colors.text }]}>
                                        {item.reason}
                                        {item.type === 'attendance' && <Text style={{ fontSize: 10, color: theme.colors.textSecondary }}> (Presenza)</Text>}
                                    </Text>
                                    <Text style={[
                                        styles.historyPoints,
                                        item.points > 0 ? { color: theme.colors.success } : { color: theme.colors.danger }
                                    ]}>
                                        {item.points > 0 ? '+' : ''}{item.points}
                                    </Text>
                                </View>
                            ))
                        )}
                    </ScrollView>

                    <View style={{ marginTop: 15, padding: 10, backgroundColor: theme.colors.sectionBackground, borderRadius: 8, flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ fontWeight: 'bold', color: theme.colors.text }}>Totale:</Text>
                        <Text style={{ fontWeight: 'bold', color: theme.colors.primary }}>
                            {totalPoints}
                        </Text>
                    </View>
                </View>
            </View>
        </Modal>
    );
};
