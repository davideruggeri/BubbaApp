import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { LeagueDates } from '../../services/firestore';
import { LeagueType } from './leagueTypes';
import { leagueStyles as styles } from './leagueStyles';
import { useTheme } from '../../context/ThemeContext';

interface LeagueCountdownProps {
    leagueType: LeagueType;
    leagueDates: LeagueDates | null;
    isLeagueArchived: boolean;
    isBubbaOnly: boolean;
    formatDateForDisplay: (date?: string | null) => string;
    onOpenDatesModal: () => void;
    onArchiveAndReset: () => void;
    onArchiveOnly: () => void;
    onResetOnly: () => void;
}

export const LeagueCountdown: React.FC<LeagueCountdownProps> = ({
    leagueType,
    leagueDates,
    isLeagueArchived,
    isBubbaOnly,
    formatDateForDisplay,
    onOpenDatesModal,
    onArchiveAndReset,
    onArchiveOnly,
    onResetOnly
}) => {
    const { theme } = useTheme();
    const hasDates = leagueDates && leagueDates.startDate && leagueDates.endDate;

    if (!hasDates) {
        return (
            <View style={[styles.countdownCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <View style={styles.countdownHeaderRow}>
                    <View style={[styles.statusChip, { backgroundColor: theme.colors.sectionBackground }]}>
                        <Text style={[styles.statusChipText, { color: theme.colors.textSecondary }]}>⚪ In attesa delle date</Text>
                    </View>
                </View>
                <Text style={[styles.countdownDescText, { color: theme.colors.textSecondary }]}>
                    Le date della {leagueType === 'winter' ? 'Winter' : 'Summer'} League non sono ancora impostate per questa stagione.
                </Text>
                {!isBubbaOnly && (
                    <View style={styles.countdownButtonsRow}>
                        <TouchableOpacity
                            style={[styles.cardActionBtnPrimary, { backgroundColor: theme.colors.primary }]}
                            onPress={onOpenDatesModal}
                        >
                            <Text style={styles.cardActionBtnTextPrimary}>📅 Imposta Date Campionato</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        );
    }

    const parseDate = (dateStr: string) => {
        const [year, month, day] = dateStr.split('-').map(Number);
        return new Date(year, month - 1, day);
    };

    const start = parseDate(leagueDates.startDate);
    const end = parseDate(leagueDates.endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const getDaysDiff = (d1: Date, d2: Date) => {
        const diffTime = d2.getTime() - d1.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };

    const isUpcoming = today < start;
    const isActive = today >= start && today <= end;
    const isFinished = today > end;
    const dateRangeLabel = `${formatDateForDisplay(leagueDates.startDate)} ➔ ${formatDateForDisplay(leagueDates.endDate)}`;

    return (
        <View style={[styles.countdownCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            {/* Header row: Status chip + Date Range */}
            <View style={styles.countdownHeaderRow}>
                {isUpcoming && (
                    <View style={[styles.statusChip, { backgroundColor: '#fef3c7' }]}>
                        <Text style={[styles.statusChipText, { color: '#b45309' }]}>🟡 In Arrivo</Text>
                    </View>
                )}
                {isActive && (
                    <View style={[styles.statusChip, { backgroundColor: '#dcfce7' }]}>
                        <Text style={[styles.statusChipText, { color: '#15803d' }]}>🟢 In Corso</Text>
                    </View>
                )}
                {isFinished && (
                    <View style={[styles.statusChip, { backgroundColor: '#fee2e2' }]}>
                        <Text style={[styles.statusChipText, { color: '#b91c1c' }]}>🏁 Conclusa</Text>
                    </View>
                )}

                <Text style={[styles.dateRangeText, { color: theme.colors.textSecondary }]}>
                    {dateRangeLabel}
                </Text>
            </View>

            {/* Main Countdown or Status Message */}
            <View style={styles.countdownBody}>
                {isUpcoming && (
                    <View style={{ alignItems: 'center' }}>
                        <Text style={[styles.countdownSmallLabel, { color: theme.colors.textSecondary }]}>Inizio campionato</Text>
                        <Text style={[styles.countdownBigValue, { color: theme.colors.primary }]}>
                            tra {getDaysDiff(today, start)} giorni
                        </Text>
                    </View>
                )}
                {isActive && (
                    <View style={{ alignItems: 'center' }}>
                        <Text style={[styles.countdownSmallLabel, { color: theme.colors.textSecondary }]}>Tempo rimanente</Text>
                        <Text style={[styles.countdownBigValue, { color: theme.colors.primary }]}>
                            {getDaysDiff(today, end)} {getDaysDiff(today, end) === 1 ? 'giorno' : 'giorni'}
                        </Text>
                    </View>
                )}
                {isFinished && (
                    <View style={{ alignItems: 'center' }}>
                        <Text style={[styles.countdownBigValue, { color: theme.colors.text, fontSize: 18 }]}>
                            Campionato Concluso
                        </Text>
                        {isLeagueArchived ? (
                            <Text style={{ color: theme.colors.success, fontSize: 13, marginTop: 4, fontWeight: '600' }}>
                                ✓ Classifica archiviata nello storico
                            </Text>
                        ) : (
                            <Text style={[styles.countdownDescText, { color: theme.colors.textSecondary, marginTop: 2 }]}>
                                Archivia i dati per conservare lo storico e azzerare la scheda.
                            </Text>
                        )}
                    </View>
                )}
            </View>

            {/* Admin Action Buttons */}
            {!isBubbaOnly && (
                <View style={styles.countdownButtonsRow}>
                    {isFinished ? (
                        !isLeagueArchived ? (
                            <>
                                <TouchableOpacity
                                    style={[styles.cardActionBtnPrimary, { backgroundColor: theme.colors.primary }]}
                                    onPress={onArchiveAndReset}
                                >
                                    <Text style={styles.cardActionBtnTextPrimary}>📦 Archivia e Pulisci</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.cardActionBtnSecondary, { borderColor: theme.colors.primary }]}
                                    onPress={onArchiveOnly}
                                >
                                    <Text style={[styles.cardActionBtnTextSecondary, { color: theme.colors.primary }]}>💾 Solo Archivia</Text>
                                </TouchableOpacity>
                            </>
                        ) : (
                            <>
                                <TouchableOpacity
                                    style={[styles.cardActionBtnPrimary, { backgroundColor: theme.colors.primary }]}
                                    onPress={onResetOnly}
                                >
                                    <Text style={styles.cardActionBtnTextPrimary}>🔄 Pulisci Scheda per Nuovo Anno</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.cardActionBtnSecondary, { borderColor: theme.colors.border }]}
                                    onPress={onOpenDatesModal}
                                >
                                    <Text style={[styles.cardActionBtnTextSecondary, { color: theme.colors.textSecondary }]}>✏️ Modifica Date</Text>
                                </TouchableOpacity>
                            </>
                        )
                    ) : (
                        <TouchableOpacity
                            style={[styles.cardActionBtnSecondary, { borderColor: theme.colors.border }]}
                            onPress={onOpenDatesModal}
                        >
                            <Text style={[styles.cardActionBtnTextSecondary, { color: theme.colors.textSecondary }]}>✏️ Modifica Date</Text>
                        </TouchableOpacity>
                    )}
                </View>
            )}
        </View>
    );
};
