import React from 'react';
import { View, Text, FlatList, TouchableOpacity, Image } from 'react-native';
import { Member, LeagueBonus, LeagueDates, Event as FirestoreEvent, RosterMember } from '../../services/firestore';
import { leagueStyles as styles } from './leagueStyles';
import { useTheme } from '../../context/ThemeContext';

interface LeagueBonusTabProps {
    bonusDate: string;
    currentEvent: FirestoreEvent | null;
    leagueDates: LeagueDates | null;
    members: Member[];
    bonuses: LeagueBonus[];
    dailyAttendees: string[];
    rosterMembers: RosterMember[];
    isBubbaOnly: boolean;
    formatDateForDisplay: (date?: string | null) => string;
    onChangeDate: (direction: number) => void;
    onOpenDatePicker: () => void;
    onTogglePresence: (memberId: string, hasPresence: boolean) => void;
    onDeleteBonus: (id: string) => void;
    onOpenAddBonusModal: (memberId: string) => void;
}

export const LeagueBonusTab: React.FC<LeagueBonusTabProps> = ({
    bonusDate,
    currentEvent,
    leagueDates,
    members,
    bonuses,
    dailyAttendees,
    rosterMembers,
    isBubbaOnly,
    formatDateForDisplay,
    onChangeDate,
    onOpenDatePicker,
    onTogglePresence,
    onDeleteBonus,
    onOpenAddBonusModal
}) => {
    const { theme } = useTheme();

    const isTournamentOrMatch = currentEvent && (currentEvent.type === 'tournament' || currentEvent.type === 'match');
    const isRestrictedEvent = currentEvent && currentEvent.type === 'Palestra';
    const eventLabel = currentEvent ? currentEvent.title : 'Allenamento';
    const hasDates = !!(leagueDates && leagueDates.startDate);

    const renderTournamentMemberRow = ({ item }: { item: Member }) => {
        const memberBonuses = bonuses.filter(b => b.memberId === item.id && b.date === bonusDate);
        const hasPresence = memberBonuses.some(b => b.reason === 'Presenza');

        return (
            <View style={[styles.attendeeRow, { backgroundColor: theme.colors.card }]}>
                <View style={styles.attendeeInfo}>
                    <Text style={[styles.attendeeName, { color: theme.colors.text }]}>
                        {item.nickname || item.firstName}
                    </Text>
                    <View style={styles.bonusTags}>
                        {memberBonuses.map((bonus, index) => (
                            <TouchableOpacity
                                key={index}
                                style={[
                                    styles.bonusTag,
                                    bonus.points >= 0 ? styles.bonusTagPositive : styles.malusTag,
                                ]}
                                onPress={() => !isBubbaOnly && onDeleteBonus(bonus.id)}
                            >
                                <Text style={styles.bonusTagText}>
                                    {bonus.points > 0 ? '+' : ''}{bonus.points} {bonus.reason}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity
                        style={[styles.actionButton, hasPresence && styles.actionButtonActive]}
                        onPress={() => onTogglePresence(item.id, hasPresence)}
                        disabled={isBubbaOnly}
                    >
                        <Text style={[styles.actionButtonText, hasPresence && styles.actionButtonTextActive]}>P</Text>
                    </TouchableOpacity>
                    {!isBubbaOnly && !isRestrictedEvent && (
                        <TouchableOpacity
                            style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
                            onPress={() => onOpenAddBonusModal(item.id)}
                        >
                            <Image source={require('../../assets/plus.png')} style={{ width: 18, height: 18, tintColor: '#fff' }} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        );
    };

    const renderDailyAttendeeRow = ({ item: memberId }: { item: string }) => {
        const member = members.find(m => m.id === memberId);
        if (!member) return null;

        const memberBonuses = bonuses.filter(b => b.memberId === memberId && b.date === bonusDate);

        return (
            <TouchableOpacity
                style={[styles.attendeeRow, { backgroundColor: theme.colors.card }]}
                onPress={() => {
                    if (!isBubbaOnly) {
                        onOpenAddBonusModal(memberId);
                    }
                }}
                disabled={isRestrictedEvent || isBubbaOnly}
                activeOpacity={isBubbaOnly ? 1 : 0.7}
            >
                <View style={styles.attendeeInfo}>
                    <Text style={[styles.attendeeName, { color: theme.colors.text }]}>
                        {member.nickname || member.firstName}
                    </Text>
                    {memberBonuses.length > 0 && (
                        <View style={styles.bonusTags}>
                            {memberBonuses.map((bonus, index) => (
                                <TouchableOpacity
                                    key={index}
                                    style={[
                                        styles.bonusTag,
                                        bonus.points >= 0 ? styles.bonusTagPositive : styles.malusTag,
                                    ]}
                                    onPress={() => !isBubbaOnly && onDeleteBonus(bonus.id)}
                                >
                                    <Text style={styles.bonusTagText}>
                                        {bonus.points > 0 ? '+' : ''}{bonus.points} {bonus.reason}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </View>
                {!isBubbaOnly && !isRestrictedEvent && (
                    <View style={[styles.actionButton, { backgroundColor: theme.colors.primary, width: 32, height: 32, borderRadius: 16 }]}>
                        <Image source={require('../../assets/plus.png')} style={{ width: 16, height: 16, tintColor: '#fff' }} />
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    return (
        <View style={{ flex: 1 }}>
            {/* Date Navigation */}
            <View style={styles.dateNav}>
                <TouchableOpacity
                    onPress={() => onChangeDate(-1)}
                    style={styles.navButton}
                    disabled={!hasDates}
                >
                    <Image
                        source={require('../../assets/arrow.png')}
                        style={[
                            styles.navIcon,
                            { transform: [{ rotate: '180deg' }], tintColor: theme.colors.primary },
                            !hasDates && { tintColor: '#ccc' }
                        ]}
                    />
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => {
                        if (hasDates) {
                            onOpenDatePicker();
                        }
                    }}
                    disabled={!hasDates}
                >
                    <View style={{ alignItems: 'center' }}>
                        <Text style={[
                            styles.dateDisplay,
                            { color: theme.colors.text },
                            !hasDates && { color: '#ccc' }
                        ]}>
                            {!hasDates ? 'In attesa delle date' : formatDateForDisplay(bonusDate)}
                        </Text>
                        {hasDates && (
                            <Text style={{
                                fontSize: 14,
                                color: isTournamentOrMatch ? theme.colors.warning : theme.colors.primary,
                                fontWeight: 'bold',
                                marginTop: 2
                            }}>
                                {eventLabel}
                            </Text>
                        )}
                    </View>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => onChangeDate(1)}
                    style={styles.navButton}
                    disabled={!hasDates}
                >
                    <Image
                        source={require('../../assets/arrow.png')}
                        style={[
                            styles.navIcon,
                            { tintColor: theme.colors.primary },
                            !hasDates && { tintColor: '#ccc' }
                        ]}
                    />
                </TouchableOpacity>
            </View>

            <Text style={[styles.sectionTitle, { color: theme.colors.primary }]}>
                {isTournamentOrMatch ? `Giocatori (${members.length})` : `Presenti (${dailyAttendees.length})`}
            </Text>

            {isTournamentOrMatch ? (
                <FlatList
                    data={members.filter(m => rosterMembers.some(rm => rm.memberId === m.id))}
                    renderItem={renderTournamentMemberRow}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ padding: 15, paddingBottom: 80 }}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>Nessun giocatore nel roster.</Text>
                        </View>
                    }
                />
            ) : (
                dailyAttendees.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>Nessun presente registrato per questa data.</Text>
                    </View>
                ) : (
                    <FlatList
                        data={dailyAttendees}
                        renderItem={renderDailyAttendeeRow}
                        keyExtractor={item => item}
                        contentContainerStyle={{ padding: 15, paddingBottom: 80 }}
                    />
                )
            )}
        </View>
    );
};
