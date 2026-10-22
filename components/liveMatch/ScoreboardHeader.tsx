// components/liveMatch/ScoreboardHeader.tsx
// Componente Header e Tabellone Punteggio Gigante per LiveMatch

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import ScreenTitle from '../ScreenTitle';
import { useTheme } from '../../context/ThemeContext';

interface ScoreboardHeaderProps {
    opponent: string;
    scoreUs: number;
    scoreThem: number;
    targetScore: number;
    isCompleted: boolean;
    activeTab: 'play' | 'stats';
    onTabChange: (tab: 'play' | 'stats') => void;
    isStaff: boolean;
    canEdit: boolean;
    rosterCount: number;
    onOpenRoster: () => void;
    onToggleDone: () => void;
    onBack: () => void;
    isMobile: boolean;
    isLiveMode?: boolean;
    onToggleLiveMode?: () => void;
    onEditOpponent?: () => void;
}

export const ScoreboardHeader: React.FC<ScoreboardHeaderProps> = React.memo(({
    opponent,
    scoreUs,
    scoreThem,
    targetScore,
    isCompleted,
    activeTab,
    onTabChange,
    isStaff,
    canEdit,
    rosterCount,
    onOpenRoster,
    onToggleDone,
    onBack,
    isMobile,
    isLiveMode,
    onToggleLiveMode,
    onEditOpponent,
}) => {
    const { theme } = useTheme();

    // Termina appare solo se nessuno ha ancora raggiunto il punteggio target
    const matchReachedTarget = scoreUs >= targetScore || scoreThem >= targetScore;
    const showTermina = isStaff && canEdit && !isCompleted && !matchReachedTarget;
    const showRiapri = isStaff && isCompleted;

    return (
        <View style={[styles.matchHeader, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}>
            <ScreenTitle
                title={`vs ${opponent}`}
                onBack={onBack}
                containerStyle={{ marginBottom: 2 }}
            />

            {/* Azioni header: solo Roster + Termina/Riapri */}
            {isStaff && (
                <View style={styles.headerActionsRow}>
                    <TouchableOpacity
                        style={[styles.headerBtn, { backgroundColor: theme.dark ? '#1D4ED8' : '#003057' }]}
                        onPress={onOpenRoster}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.headerBtnText} numberOfLines={1}>
                            👥 {rosterCount}
                        </Text>
                    </TouchableOpacity>

                    {onToggleLiveMode && !isCompleted && (
                        <TouchableOpacity
                            style={[styles.headerBtn, { backgroundColor: isLiveMode ? '#C0D725' : '#475569' }]}
                            onPress={onToggleLiveMode}
                            activeOpacity={0.8}
                        >
                            <Text style={[styles.headerBtnText, { color: isLiveMode ? '#1A2600' : '#fff' }]} numberOfLines={1}>
                                {isLiveMode ? '⚡ Live' : '📹 Video'}
                            </Text>
                        </TouchableOpacity>
                    )}

                    {showTermina && (
                        <TouchableOpacity
                            style={[styles.headerBtn, { backgroundColor: '#C8323C', flex: 1 }]}
                            onPress={onToggleDone}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.headerBtnText}>🏁 Termina partita</Text>
                        </TouchableOpacity>
                    )}

                    {showRiapri && (
                        <TouchableOpacity
                            style={[styles.headerBtn, { backgroundColor: '#5B6570', flex: 1 }]}
                            onPress={onToggleDone}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.headerBtnText}>🔓 Riapri partita</Text>
                        </TouchableOpacity>
                    )}
                </View>
            )}

            {/* Punteggio Gigante */}
            <View style={styles.scoreRow}>
                <View style={styles.teamScore}>
                    <Text style={[styles.teamName, { color: theme.colors.text }]} numberOfLines={1}>BUBBA</Text>
                    <Text style={[styles.scoreValue, { color: theme.colors.primary }]}>{scoreUs}</Text>
                </View>
                <Text style={[styles.scoreDivider, { color: theme.colors.textSecondary }]}>–</Text>
                <View style={styles.teamScore}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={[styles.teamName, { color: theme.colors.text }]} numberOfLines={1} ellipsizeMode="tail">
                            {opponent.toUpperCase()}
                        </Text>
                        {isStaff && canEdit && onEditOpponent && (
                            <Pressable onPress={onEditOpponent} hitSlop={8}>
                                <Text style={{ fontSize: 11 }}>✏️</Text>
                            </Pressable>
                        )}
                    </View>
                    <Text style={[styles.scoreValue, { color: '#E07A1F' }]}>{scoreThem}</Text>
                </View>
            </View>

            {/* Tab Navigator */}
            <View style={styles.tabBar}>
                <TouchableOpacity
                    style={[styles.tabItem, activeTab === 'play' && [styles.tabItemOn, { borderBottomColor: theme.colors.primary }]]}
                    onPress={() => onTabChange('play')}
                >
                    <Text style={[styles.tabText, activeTab === 'play' && [styles.tabTextOn, { color: theme.colors.primary }]]}>
                        {isCompleted ? 'PARTITA (CONCLUSA)' : 'PARTITA (LIVE)'}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tabItem, activeTab === 'stats' && [styles.tabItemOn, { borderBottomColor: theme.colors.primary }]]}
                    onPress={() => onTabChange('stats')}
                >
                    <Text style={[styles.tabText, activeTab === 'stats' && [styles.tabTextOn, { color: theme.colors.primary }]]}>STATISTICHE</Text>
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
        gap: 8,
        marginBottom: 6,
        alignItems: 'center',
    },
    headerBtn: {
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerBtnText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 12,
    },
    scoreRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 4,
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
        fontSize: 38,
        fontWeight: '900',
        lineHeight: 44,
    },
    scoreDivider: {
        fontSize: 28,
        fontWeight: '300',
        marginHorizontal: 12,
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
        fontSize: 11,
        fontWeight: 'bold',
        color: '#8A9BA8',
    },
    tabTextOn: {
        color: '#003057',
    },
});

export default ScoreboardHeader;
