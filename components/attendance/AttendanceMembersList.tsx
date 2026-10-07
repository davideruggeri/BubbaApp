import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Member } from '../../services/firestore';
import { attendanceStyles as styles } from './attendanceStyles';
import { ViewMode } from './attendanceTypes';

interface AttendanceMembersListProps {
    men: Member[];
    women: Member[];
    guests?: string[];
    attendeeIds: string[];
    seasonCounts: Record<string, number>;
    viewMode: ViewMode;
    expandedSections: { men: boolean; women: boolean };
    onToggleSection: (section: 'men' | 'women') => void;
    onTogglePresence: (memberId: string, isPresent: boolean) => void;
    onOpenHistory: (member: Member) => void;
    onAddGuest: () => void;
    onRemoveGuest: (guest: string) => void;
    isBubbaOnly?: boolean;
    theme: any;
}

export const AttendanceMembersList: React.FC<AttendanceMembersListProps> = ({
    men,
    women,
    guests = [],
    attendeeIds,
    seasonCounts,
    viewMode,
    expandedSections,
    onToggleSection,
    onTogglePresence,
    onOpenHistory,
    onAddGuest,
    onRemoveGuest,
    isBubbaOnly,
    theme,
}) => {
    const renderMemberCard = (item: Member) => {
        const isPresent = attendeeIds.includes(item.id);
        return (
            <TouchableOpacity
                key={item.id}
                style={[
                    styles.personCard,
                    { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
                    isPresent && { borderColor: theme.colors.success, borderWidth: 2 },
                ]}
                onPress={() => !isBubbaOnly && onTogglePresence(item.id, isPresent)}
                onLongPress={() => onOpenHistory(item)}
                delayLongPress={500}
                activeOpacity={0.7}
            >
                <View style={{ flex: 1 }}>
                    <Text
                        style={[
                            styles.personName,
                            { color: theme.colors.text },
                            isPresent && { color: theme.colors.success },
                        ]}
                    >
                        {item.nickname ? item.nickname : `${item.firstName} ${item.lastName}`}
                        {item.jerseyNumber ? (
                            <Text style={{ color: theme.colors.textSecondary, fontSize: 16 }}>
                                {' '}
                                #{item.jerseyNumber}
                            </Text>
                        ) : (
                            ''
                        )}
                    </Text>
                    <Text style={[styles.attendanceCount, { color: theme.colors.textSecondary }]}>
                        {viewMode === 'Campo' ? '🥏' : '🏋️'} {seasonCounts[item.id] || 0} pres. {viewMode}
                    </Text>
                </View>

                <View
                    style={[
                        styles.checkbox,
                        { borderColor: theme.colors.border },
                        isPresent && { backgroundColor: theme.colors.success, borderColor: theme.colors.success },
                    ]}
                >
                    {isPresent && <Text style={styles.checkmark}>✓</Text>}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <>
            {/* Women Section */}
            {women.length > 0 && (
                <>
                    <TouchableOpacity onPress={() => onToggleSection('women')} style={styles.sectionHeader}>
                        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                            Donne ({women.filter(m => attendeeIds.includes(m.id)).length}/{women.length})
                        </Text>
                        <Text style={[styles.sectionArrow, { color: theme.colors.textSecondary }]}>
                            {expandedSections.women ? '▼' : '▶'}
                        </Text>
                    </TouchableOpacity>
                    {expandedSections.women && women.map(member => renderMemberCard(member))}
                </>
            )}

            {/* Men Section */}
            {men.length > 0 && (
                <>
                    <TouchableOpacity onPress={() => onToggleSection('men')} style={styles.sectionHeader}>
                        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                            Uomini ({men.filter(m => attendeeIds.includes(m.id)).length}/{men.length})
                        </Text>
                        <Text style={[styles.sectionArrow, { color: theme.colors.textSecondary }]}>
                            {expandedSections.men ? '▼' : '▶'}
                        </Text>
                    </TouchableOpacity>
                    {expandedSections.men && men.map(member => renderMemberCard(member))}
                </>
            )}

            {/* Guests Section */}
            <View style={styles.guestsHeader}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                    Ospiti ({guests.length})
                </Text>
                {!isBubbaOnly && (
                    <TouchableOpacity style={styles.addGuestButton} onPress={onAddGuest}>
                        <Text style={styles.addGuestButtonText}>+ Aggiungi</Text>
                    </TouchableOpacity>
                )}
            </View>

            {guests.length > 0 ? (
                guests.map((guest, index) => (
                    <TouchableOpacity
                        key={`guest-${index}`}
                        style={[
                            styles.guestCard,
                            {
                                backgroundColor: theme.colors.card,
                                borderColor: theme.colors.warning,
                                borderWidth: 1,
                            },
                        ]}
                        onPress={() => !isBubbaOnly && onRemoveGuest(guest)}
                        activeOpacity={isBubbaOnly ? 1 : 0.7}
                    >
                        <View>
                            <Text style={[styles.guestName, { color: theme.colors.text }]}>{guest}</Text>
                            <Text style={[styles.guestLabel, { color: theme.colors.warning }]}>Ospite</Text>
                        </View>
                        <View style={[styles.guestRemoveIcon, { backgroundColor: theme.colors.inputBackground }]}>
                            <Text style={[styles.guestRemoveText, { color: theme.colors.danger }]}>✕</Text>
                        </View>
                    </TouchableOpacity>
                ))
            ) : (
                <Text style={[styles.noGuestsText, { color: theme.colors.textSecondary }]}>
                    Nessun ospite aggiunto.
                </Text>
            )}
        </>
    );
};
