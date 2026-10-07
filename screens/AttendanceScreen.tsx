import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import ScreenTitle from '../components/ScreenTitle';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useSeason } from '../context/SeasonContext';
import {
    attendanceStyles as styles,
    useAttendanceData,
    AttendanceDateSelector,
    AttendanceStatsCard,
    AttendanceMembersList,
    AttendanceHistoryModal,
    AttendanceRankingModal,
    AttendanceGuestModal,
} from '../components/attendance';

export default function AttendanceScreen() {
    const navigation = useNavigation<any>();
    const { isBubbaOnly } = useAuth();
    const { stagioneCorrente } = useSeason();
    const { theme } = useTheme();

    const {
        members,
        session,
        attendeeIds,
        currentDate,
        stats,
        viewMode,
        setViewMode,
        expandedSections,
        toggleSection,
        goToPreviousSession,
        goToNextSession,
        togglePresence,
        seasonCounts,
        seasonCountsCampo,
        seasonCountsPalestra,
        men,
        women,
        newGuestName,
        setNewGuestName,
        guestModalVisible,
        setGuestModalVisible,
        handleAddGuest,
        handleRemoveGuest,
        historyModalVisible,
        setHistoryModalVisible,
        selectedMemberHistory,
        loadingHistory,
        handleOpenHistory,
        rankingModalVisible,
        setRankingModalVisible,
        rankingMode,
        setRankingMode,
    } = useAttendanceData(stagioneCorrente, isBubbaOnly);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={[styles.header, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}>
                <View style={styles.headerTop}>
                    <TouchableOpacity
                        onPress={() => {
                            setRankingMode(viewMode);
                            setRankingModalVisible(true);
                        }}
                        style={styles.rankingButton}
                    >
                        <Image
                            source={require('../assets/trophy.png')}
                            style={[styles.iconImage, { tintColor: theme.colors.text }]}
                        />
                    </TouchableOpacity>
                    <View style={{ alignItems: 'center' }}>
                        <ScreenTitle title="PRESENZE" style={{ marginBottom: 2 }} />
                        <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.primary, letterSpacing: 0.5 }}>
                            {stagioneCorrente}
                        </Text>
                    </View>
                    <TouchableOpacity onPress={() => navigation.navigate('League')} style={styles.winterButton}>
                        <Image
                            source={require('../assets/winter.png')}
                            style={[styles.iconImage, { tintColor: theme.colors.text }]}
                        />
                    </TouchableOpacity>
                </View>

                <AttendanceDateSelector
                    currentDate={currentDate}
                    viewMode={viewMode}
                    setViewMode={setViewMode}
                    attendeesCount={attendeeIds.length + (session?.guests?.length || 0)}
                    onPrevious={goToPreviousSession}
                    onNext={goToNextSession}
                    theme={theme}
                />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContainer}>
                {stats && <AttendanceStatsCard stats={stats} theme={theme} />}

                {!currentDate && (
                    <View style={styles.emptyStateContainer}>
                        <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>
                            {viewMode === 'Palestra'
                                ? 'Non sono programmati allenamenti in palestra.'
                                : 'Non sono programmati allenamenti al campo.'}
                        </Text>
                    </View>
                )}

                {currentDate && (
                    <AttendanceMembersList
                        men={men}
                        women={women}
                        guests={session?.guests}
                        attendeeIds={attendeeIds}
                        seasonCounts={seasonCounts}
                        viewMode={viewMode}
                        expandedSections={expandedSections}
                        onToggleSection={toggleSection}
                        onTogglePresence={togglePresence}
                        onOpenHistory={handleOpenHistory}
                        onAddGuest={() => setGuestModalVisible(true)}
                        onRemoveGuest={handleRemoveGuest}
                        isBubbaOnly={isBubbaOnly}
                        theme={theme}
                    />
                )}

                <View style={{ height: 40 }} />
            </ScrollView>

            <AttendanceGuestModal
                visible={guestModalVisible}
                guestName={newGuestName}
                setGuestName={setNewGuestName}
                onAddGuest={handleAddGuest}
                onClose={() => setGuestModalVisible(false)}
                theme={theme}
            />

            <AttendanceHistoryModal
                visible={historyModalVisible}
                data={selectedMemberHistory}
                loading={loadingHistory}
                theme={theme}
                onClose={() => setHistoryModalVisible(false)}
            />

            <AttendanceRankingModal
                visible={rankingModalVisible}
                rankingMode={rankingMode}
                setRankingMode={setRankingMode}
                members={members}
                seasonCountsCampo={seasonCountsCampo}
                seasonCountsPalestra={seasonCountsPalestra}
                theme={theme}
                onClose={() => setRankingModalVisible(false)}
            />
        </SafeAreaView>
    );
}
