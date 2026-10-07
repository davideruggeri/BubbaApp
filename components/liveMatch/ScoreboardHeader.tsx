// components/liveMatch/ScoreboardHeader.tsx
// Componente Header e Tabellone Punteggio Gigante per LiveMatch

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import ScreenTitle from '../ScreenTitle';
import { useTheme } from '../../context/ThemeContext';

interface ScoreboardHeaderProps {
    opponent: string;
    scoreUs: number;
    scoreThem: number;
    isCompleted: boolean;
    activeTab: 'play' | 'stats';
    onTabChange: (tab: 'play' | 'stats') => void;
    isStaff: boolean;
    canEdit: boolean;
    rosterCount: number;
    onExportExcel: () => void;
    onOpenTouches: () => void;
    onOpenRoster: () => void;
    onUndo: () => void;
    onToggleDone: () => void;
    onBack: () => void;
    isMobile: boolean;
}

export const ScoreboardHeader: React.FC<ScoreboardHeaderProps> = React.memo(({
    opponent,
    scoreUs,
    scoreThem,
    isCompleted,
    activeTab,
    onTabChange,
    isStaff,
    canEdit,
    rosterCount,
    onExportExcel,
    onOpenTouches,
    onOpenRoster,
    onUndo,
    onToggleDone,
    onBack,
    isMobile
}) => {
    const { theme } = useTheme();

    return (
        <View style={[styles.matchHeader, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}>
            <ScreenTitle
                title={`vs ${opponent}`}
                onBack={onBack}
                containerStyle={{ marginBottom: 4 }}
            />

            {/* Azioni Rapide Admin/Staff */}
            <View style={styles.headerActionsRow}>
                <TouchableOpacity
                    style={[styles.headerBtn, { backgroundColor: '#2E8540' }, isMobile && styles.headerBtnMobile]}
                    onPress={onExportExcel}
                    activeOpacity={0.8}
                >
                    <Text style={[styles.headerBtnText, isMobile && styles.headerBtnTextMobile]}>📊 Excel</Text>
                </TouchableOpacity>

                {isStaff && (
                    <>
                        <TouchableOpacity
                            style={[styles.headerBtn, { backgroundColor: '#E07A1F' }, isMobile && styles.headerBtnMobile]}
                            onPress={onOpenTouches}
                            activeOpacity={0.8}
                        >
                            <Text style={[styles.headerBtnText, isMobile && styles.headerBtnTextMobile]} numberOfLines={1}>
                                🥏 Tocchi
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.headerBtn, { backgroundColor: '#003057' }, isMobile && styles.headerBtnMobile]}
                            onPress={onOpenRoster}
                            activeOpacity={0.8}
                        >
                            <Text style={[styles.headerBtnText, isMobile && styles.headerBtnTextMobile]} numberOfLines={1}>
                                👥 Roster ({rosterCount})
                            </Text>
                        </TouchableOpacity>

                        {canEdit && (
                            <TouchableOpacity
                                style={[styles.headerBtn, { backgroundColor: '#5B6570' }, isMobile && styles.headerBtnMobile]}
                                onPress={onUndo}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.headerBtnText, isMobile && styles.headerBtnTextMobile]}>↩ Annulla</Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity
                            style={[styles.headerBtn, { backgroundColor: isCompleted ? '#003057' : '#C8323C' }, isMobile && styles.headerBtnMobile]}
                            onPress={onToggleDone}
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
                    <Text style={[styles.scoreValue, { color: '#003057' }]}>{scoreUs}</Text>
                </View>
                <Text style={[styles.scoreDivider, { color: theme.colors.textSecondary }]}>–</Text>
                <View style={styles.teamScore}>
                    <Text style={[styles.teamName, { color: theme.colors.text }]} numberOfLines={1} ellipsizeMode="tail">
                        {opponent.toUpperCase()}
                    </Text>
                    <Text style={[styles.scoreValue, { color: '#E07A1F' }]}>{scoreThem}</Text>
                </View>
            </View>

            {/* Tab Navigator */}
            <View style={styles.tabBar}>
                <TouchableOpacity
                    style={[styles.tabItem, activeTab === 'play' && styles.tabItemOn]}
                    onPress={() => onTabChange('play')}
                >
                    <Text style={[styles.tabText, activeTab === 'play' && styles.tabTextOn]}>
                        {isCompleted ? 'PARTITA (CONCLUSA)' : 'PARTITA (LIVE)'}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tabItem, activeTab === 'stats' && styles.tabItemOn]}
                    onPress={() => onTabChange('stats')}
                >
                    <Text style={[styles.tabText, activeTab === 'stats' && styles.tabTextOn]}>STATISTICHE</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
});

const styles = StyleSheet.create({
    matchHeader: {
        paddingTop: 8,
        paddingHorizontal: 12,
        paddingBottom: 0,
        borderBottomWidth: 1,
    },
    headerActionsRow: {
        flexDirection: 'row',
        gap: 6,
        justifyContent: 'center',
        flexWrap: 'wrap',
        marginBottom: 8,
    },
    headerBtn: {
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerBtnMobile: {
        paddingHorizontal: 8,
        paddingVertical: 6,
    },
    headerBtnText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 13,
    },
    headerBtnTextMobile: {
        fontSize: 11,
    },
    scoreRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 6,
    },
    teamScore: {
        alignItems: 'center',
        minWidth: 100,
        maxWidth: 140,
    },
    teamName: {
        fontSize: 13,
        fontWeight: 'bold',
        letterSpacing: 1,
        marginBottom: 2,
    },
    scoreValue: {
        fontSize: 48,
        fontWeight: '900',
        lineHeight: 52,
    },
    scoreDivider: {
        fontSize: 36,
        fontWeight: '300',
        marginHorizontal: 16,
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
        fontWeight: 'bold',
        color: '#8A9BA8',
    },
    tabTextOn: {
        color: '#003057',
    },
});

export default ScoreboardHeader;
