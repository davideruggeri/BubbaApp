import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MatchAnalysis } from '../../services/firestore';
import { MatchGroup } from './analisiPartitaTypes';
import { MatchCardItem, LivePulseBadge } from './MatchCardItem';
import { analisiPartitaStyles as styles } from './analisiPartitaStyles';
import { useTheme } from '../../context/ThemeContext';

interface MatchFolderCardProps {
    folder: MatchGroup;
    isStaff: boolean;
    isExpanded: boolean;
    onToggleFolder: (folderId: string) => void;
    onOpenTournament: (tournamentName: string) => void;
    onExportTournamentExcel: (matches: MatchAnalysis[]) => void;
    onOpenMatch: (match: MatchAnalysis) => void;
    onExportMatchXLSX: (match: MatchAnalysis) => void;
    onEditMatch: (match: MatchAnalysis) => void;
    onDeleteMatch: (id: string) => void;
}

export const MatchFolderCard: React.FC<MatchFolderCardProps> = ({
    folder,
    isStaff,
    isExpanded,
    onToggleFolder,
    onOpenTournament,
    onExportTournamentExcel,
    onOpenMatch,
    onExportMatchXLSX,
    onEditMatch,
    onDeleteMatch
}) => {
    const { theme } = useTheme();

    if (!folder.isSingleGroup) {
        return (
            <View style={styles.folderContainer}>
                <TouchableOpacity
                    style={[
                        styles.folderHeader,
                        {
                            backgroundColor: theme.colors.card,
                            borderColor: theme.colors.border,
                        }
                    ]}
                    onPress={() => onOpenTournament(folder.title)}
                    activeOpacity={0.7}
                >
                    <View style={styles.folderLeft}>
                        <Text style={styles.folderIcon}>🏆</Text>
                        <View style={{ flex: 1, marginLeft: 10 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                                <Text style={[styles.folderTitle, { color: theme.colors.text }]} numberOfLines={1}>
                                    {folder.title}
                                </Text>
                                {folder.hasLive && <LivePulseBadge />}
                            </View>
                            <Text style={[styles.folderSubtitle, { color: theme.colors.textSecondary }]}>
                                {folder.matches.length} {folder.matches.length === 1 ? 'partita' : 'partite'}{folder.dateRange ? ` • ${folder.dateRange}` : ''}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.folderRight}>
                        {isStaff && (
                            <TouchableOpacity
                                style={styles.folderExportBtn}
                                onPress={(e) => {
                                    e.stopPropagation();
                                    onExportTournamentExcel(folder.matches);
                                }}
                            >
                                <Text style={styles.folderExportText}>📊 Excel</Text>
                            </TouchableOpacity>
                        )}
                        <Text style={[styles.chevron, { color: theme.colors.primary, fontWeight: 'bold' }]}>
                            Apri ➔
                        </Text>
                    </View>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.folderContainer}>
            <TouchableOpacity
                style={[
                    styles.folderHeader,
                    {
                        backgroundColor: theme.colors.card,
                        borderColor: theme.colors.border,
                    }
                ]}
                onPress={() => onToggleFolder(folder.id)}
                activeOpacity={0.7}
            >
                <View style={styles.folderLeft}>
                    <Text style={styles.folderIcon}>🏐</Text>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={[styles.folderTitle, { color: theme.colors.text }]}>
                            {folder.title}
                        </Text>
                        <Text style={[styles.folderSubtitle, { color: theme.colors.textSecondary }]}>
                            {folder.matches.length} {folder.matches.length === 1 ? 'partita' : 'partite'}
                        </Text>
                    </View>
                </View>

                <Text style={[styles.chevron, { color: theme.colors.textSecondary }]}>
                    {isExpanded ? '▼' : '▶'}
                </Text>
            </TouchableOpacity>

            {isExpanded && (
                <View style={styles.folderBody}>
                    {folder.matches.map(match => (
                        <MatchCardItem
                            key={match.id}
                            item={match}
                            isStaff={isStaff}
                            onOpen={onOpenMatch}
                            onExportXLSX={onExportMatchXLSX}
                            onEdit={onEditMatch}
                            onDelete={onDeleteMatch}
                        />
                    ))}
                </View>
            )}
        </View>
    );
};
