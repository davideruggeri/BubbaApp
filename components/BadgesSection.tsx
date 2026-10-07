// components/BadgesSection.tsx
// Componente compatto per visualizzare i Badge e la Gamification a livelli, con espansione al click e date di raggiungimento

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { UserBadgeProgress, BadgeTierConfig } from '../services/firestore/badges';
import { useTheme } from '../context/ThemeContext';

interface BadgesSectionProps {
    badges: UserBadgeProgress[];
    loading?: boolean;
}

export default function BadgesSection({ badges, loading }: BadgesSectionProps) {
    const { theme } = useTheme();
    const [selectedCategory, setSelectedCategory] = useState<UserBadgeProgress | null>(null);

    if (loading) {
        return (
            <View style={[styles.container, { backgroundColor: theme.colors.card }]}>
                <Text style={[styles.sectionTitle, { color: theme.colors.primary }]}>🏅 Badge & Traguardi</Text>
                <Text style={{ color: theme.colors.textSecondary, marginTop: 8 }}>Caricamento traguardi...</Text>
            </View>
        );
    }

    if (!badges || badges.length === 0) {
        return null;
    }

    const totalUnlocked = badges.reduce((acc, b) => acc + b.unlockedTiers.length, 0);
    const totalTiers = badges.reduce((acc, b) => acc + b.allTiers.length, 0);

    const getTierColor = (tier: string) => {
        switch (tier) {
            case 'bronze': return '#CD7F32';
            case 'silver': return '#9E9E9E';
            case 'gold': return '#FFD700';
            case 'diamond': return '#00E5FF';
            default: return theme.colors.primary;
        }
    };

    const formatAchievementDate = (dateStr?: string) => {
        if (!dateStr) return null;
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        return dateStr;
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.card }]}>
            <View style={styles.headerRow}>
                <Text style={[styles.sectionTitle, { color: theme.colors.primary }]}>🏅 Badge & Traguardi</Text>
                <View style={[styles.totalPill, { backgroundColor: theme.colors.sectionBackground }]}>
                    <Text style={[styles.totalPillText, { color: theme.colors.primary }]}>
                        {totalUnlocked} / {totalTiers} Sbloccati
                    </Text>
                </View>
            </View>

            {/* Compact Badges Row (Horizontal Scroll) */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalScrollContent}
                style={{ marginTop: 12 }}
            >
                {badges.map((b) => {
                    const highestTier = b.highestTierAchieved;
                    const tierColor = highestTier ? getTierColor(highestTier.tier) : theme.colors.border;
                    const isMaxed = !b.nextTier;

                    return (
                        <TouchableOpacity
                            key={b.categoryId}
                            activeOpacity={0.7}
                            onPress={() => setSelectedCategory(b)}
                            style={[
                                styles.compactCard,
                                {
                                    backgroundColor: theme.colors.inputBackground,
                                    borderColor: highestTier ? tierColor : theme.colors.border,
                                    borderWidth: highestTier ? 1.5 : 1
                                }
                            ]}
                        >
                            {/* Icon & Highest Tier Medal Badge */}
                            <View style={styles.iconContainer}>
                                <Text style={{ fontSize: 28 }}>{b.categoryIcon}</Text>
                                <View style={[styles.miniBadgePill, { backgroundColor: theme.colors.card, borderColor: tierColor }]}>
                                    <Text style={{ fontSize: 13 }}>
                                        {highestTier ? highestTier.badgeEmoji : '🔒'}
                                    </Text>
                                </View>
                            </View>

                            {/* Badge Title */}
                            <Text
                                numberOfLines={1}
                                style={[styles.compactTitle, { color: theme.colors.text }]}
                            >
                                {b.categoryName}
                            </Text>

                            {/* Level or Status */}
                            <Text
                                numberOfLines={1}
                                style={[
                                    styles.compactRank,
                                    { color: highestTier ? tierColor : theme.colors.textSecondary }
                                ]}
                            >
                                {highestTier ? `Liv. ${highestTier.level}` : 'In corso'}
                            </Text>

                            {/* Mini Progress Bar */}
                            <View style={[styles.miniProgressTrack, { backgroundColor: theme.colors.border }]}>
                                <View
                                    style={[
                                        styles.miniProgressFill,
                                        {
                                            width: isMaxed ? '100%' : `${Math.max(6, Math.round(b.progressToNext * 100))}%`,
                                            backgroundColor: isMaxed ? '#00E5FF' : (b.nextTier ? getTierColor(b.nextTier.tier) : theme.colors.primary)
                                        }
                                    ]}
                                />
                            </View>

                            <Text style={[styles.tapHint, { color: theme.colors.textSecondary }]}>
                                {b.currentValue} {b.unit}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            {/* Modal Dettagli / Espansione Completa */}
            <Modal
                visible={!!selectedCategory}
                transparent
                animationType="fade"
                onRequestClose={() => setSelectedCategory(null)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
                        {selectedCategory && (
                            <ScrollView showsVerticalScrollIndicator={false}>
                                {/* Header del Badge */}
                                <View style={{ alignItems: 'center', marginBottom: 16 }}>
                                    <Text style={{ fontSize: 48, marginBottom: 6 }}>{selectedCategory.categoryIcon}</Text>
                                    <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                                        {selectedCategory.categoryName}
                                    </Text>
                                    <Text style={{ color: theme.colors.primary, fontWeight: '600', fontSize: 14, marginTop: 2 }}>
                                        Il tuo record: {selectedCategory.currentValue} {selectedCategory.unit}
                                    </Text>
                                    {selectedCategory.highestTierAchieved && (
                                        <View style={[styles.modalHighestTierChip, { backgroundColor: getTierColor(selectedCategory.highestTierAchieved.tier) + '20', borderColor: getTierColor(selectedCategory.highestTierAchieved.tier) }]}>
                                            <Text style={{ fontSize: 13, color: getTierColor(selectedCategory.highestTierAchieved.tier), fontWeight: 'bold' }}>
                                                {selectedCategory.highestTierAchieved.badgeEmoji} Livello {selectedCategory.highestTierAchieved.level}: {selectedCategory.highestTierAchieved.title}
                                            </Text>
                                        </View>
                                    )}
                                </View>

                                {/* Avanzamento Prossimo Livello */}
                                {!selectedCategory.nextTier ? (
                                    <View style={[styles.maxLevelBanner, { backgroundColor: '#00E5FF20', borderColor: '#00E5FF' }]}>
                                        <Text style={{ color: '#00E5FF', fontWeight: 'bold', fontSize: 14 }}>
                                            💎 Traguardo Massimo Completato!
                                        </Text>
                                    </View>
                                ) : (
                                    <View style={[styles.progressCard, { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.border }]}>
                                        <View style={styles.progressRow}>
                                            <Text style={[styles.progressLabel, { color: theme.colors.textSecondary }]}>
                                                Prossimo: {selectedCategory.nextTier.badgeEmoji} {selectedCategory.nextTier.title}
                                            </Text>
                                            <Text style={[styles.progressPercentage, { color: theme.colors.primary }]}>
                                                {Math.round(selectedCategory.progressToNext * 100)}%
                                            </Text>
                                        </View>
                                        <View style={[styles.progressBarTrack, { backgroundColor: theme.colors.border }]}>
                                            <View
                                                style={[
                                                    styles.progressBarFill,
                                                    {
                                                        width: `${Math.max(4, Math.round(selectedCategory.progressToNext * 100))}%`,
                                                        backgroundColor: getTierColor(selectedCategory.nextTier.tier)
                                                    }
                                                ]}
                                            />
                                        </View>
                                        <Text style={[styles.missingText, { color: theme.colors.textSecondary }]}>
                                            Mancano {Math.max(0, selectedCategory.nextTier.target - selectedCategory.currentValue)} {selectedCategory.unit} per sbloccarlo
                                        </Text>
                                    </View>
                                )}

                                {/* Lista Livelli con date di raggiungimento */}
                                <Text style={[styles.tiersSectionTitle, { color: theme.colors.primary }]}>
                                    Percorso Traguardi
                                </Text>

                                <View style={{ gap: 10, marginTop: 8 }}>
                                    {selectedCategory.allTiers.map((tier) => {
                                        const isUnlocked = selectedCategory.currentValue >= tier.target;
                                        const tierColor = getTierColor(tier.tier);
                                        const formattedDate = formatAchievementDate(tier.achievedDate);

                                        return (
                                            <View
                                                key={tier.level}
                                                style={[
                                                    styles.tierDetailRow,
                                                    {
                                                        backgroundColor: isUnlocked ? tierColor + '12' : theme.colors.inputBackground,
                                                        borderColor: isUnlocked ? tierColor : theme.colors.border,
                                                        opacity: isUnlocked ? 1 : 0.6
                                                    }
                                                ]}
                                            >
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                                                    <View style={[styles.tierIconCircle, { borderColor: tierColor, backgroundColor: isUnlocked ? tierColor + '20' : theme.colors.card }]}>
                                                        <Text style={{ fontSize: 20 }}>{tier.badgeEmoji}</Text>
                                                    </View>
                                                    <View style={{ flex: 1 }}>
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                            <Text style={[styles.tierDetailTitle, { color: theme.colors.text }]}>
                                                                Liv. {tier.level} - {tier.title}
                                                            </Text>
                                                        </View>
                                                        <Text style={[styles.tierDetailDesc, { color: theme.colors.textSecondary }]}>
                                                            {tier.description}
                                                        </Text>
                                                        {isUnlocked && formattedDate && (
                                                            <Text style={[styles.achievedDateText, { color: theme.colors.success }]}>
                                                                🗓️ Sbloccato il {formattedDate}
                                                            </Text>
                                                        )}
                                                    </View>
                                                </View>

                                                <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
                                                    {isUnlocked ? (
                                                        <View style={[styles.statusBadge, { backgroundColor: theme.colors.success + '20' }]}>
                                                            <Text style={{ fontSize: 11, fontWeight: 'bold', color: theme.colors.success }}>
                                                                ✓ FATTO
                                                            </Text>
                                                        </View>
                                                    ) : (
                                                        <View style={[styles.statusBadge, { backgroundColor: theme.colors.border }]}>
                                                            <Text style={{ fontSize: 11, fontWeight: 'bold', color: theme.colors.textSecondary }}>
                                                                🔒 {tier.target} {selectedCategory.unit}
                                                            </Text>
                                                        </View>
                                                    )}
                                                </View>
                                            </View>
                                        );
                                    })}
                                </View>

                                <TouchableOpacity
                                    style={[styles.closeBtn, { backgroundColor: theme.colors.primary, marginTop: 20 }]}
                                    onPress={() => setSelectedCategory(null)}
                                >
                                    <Text style={styles.closeBtnText}>Chiudi</Text>
                                </TouchableOpacity>
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        borderRadius: 16,
        padding: 14,
        marginBottom: 16,
        width: '100%',
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    sectionTitle: {
        fontSize: 17,
        fontWeight: 'bold',
    },
    totalPill: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    totalPillText: {
        fontSize: 12,
        fontWeight: 'bold',
    },
    horizontalScrollContent: {
        paddingVertical: 4,
        gap: 10,
    },
    compactCard: {
        width: 104,
        borderRadius: 14,
        padding: 10,
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    iconContainer: {
        position: 'relative',
        marginBottom: 6,
        alignItems: 'center',
        justifyContent: 'center',
    },
    miniBadgePill: {
        position: 'absolute',
        bottom: -4,
        right: -8,
        borderRadius: 10,
        borderWidth: 1,
        paddingHorizontal: 3,
        paddingVertical: 1,
    },
    compactTitle: {
        fontSize: 12,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 2,
    },
    compactRank: {
        fontSize: 11,
        fontWeight: '600',
        marginBottom: 6,
    },
    miniProgressTrack: {
        width: '100%',
        height: 4,
        borderRadius: 2,
        overflow: 'hidden',
        marginBottom: 4,
    },
    miniProgressFill: {
        height: '100%',
        borderRadius: 2,
    },
    tapHint: {
        fontSize: 10,
        fontWeight: '500',
    },

    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.65)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        width: '100%',
        maxHeight: '85%',
        borderRadius: 20,
        padding: 20,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    modalHighestTierChip: {
        marginTop: 8,
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 12,
        borderWidth: 1,
    },
    maxLevelBanner: {
        padding: 12,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        marginBottom: 16,
    },
    progressCard: {
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 16,
    },
    progressRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    progressLabel: {
        fontSize: 13,
        fontWeight: '600',
    },
    progressPercentage: {
        fontSize: 13,
        fontWeight: 'bold',
    },
    progressBarTrack: {
        height: 8,
        borderRadius: 4,
        overflow: 'hidden',
        width: '100%',
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 4,
    },
    missingText: {
        fontSize: 11,
        marginTop: 6,
        textAlign: 'right',
    },
    tiersSectionTitle: {
        fontSize: 15,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    tierDetailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 10,
        borderRadius: 12,
        borderWidth: 1,
    },
    tierIconCircle: {
        width: 38,
        height: 38,
        borderRadius: 19,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tierDetailTitle: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    tierDetailDesc: {
        fontSize: 12,
        marginTop: 1,
    },
    achievedDateText: {
        fontSize: 11,
        fontWeight: '600',
        marginTop: 3,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    closeBtn: {
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
    },
    closeBtnText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 15,
    },
});
