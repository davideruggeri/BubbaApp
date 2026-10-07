import * as React from 'react';
import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import ScreenTitle from '../components/ScreenTitle';
import DatePickerModal from '../components/DatePickerModal';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
    Tab,
    leagueStyles as styles,
    useLeagueData,
    LeagueCountdown,
    LeagueStandingsTab,
    LeagueBonusTab,
    LeagueRulesTab,
    LeagueBonusListTab,
    LeagueBonusModal,
    LeagueSettingsModal,
    LeaguePastModal,
    LeagueHistoryModal
} from '../components/league';

export default function LeagueScreen() {
    const navigation = useNavigation<any>();
    const { isBubbaOnly } = useAuth();
    const { theme } = useTheme();

    const [activeTab, setActiveTab] = useState<Tab>('standings');

    // Modals visibility state
    const [bonusModalVisible, setBonusModalVisible] = useState(false);
    const [bonusModalMemberId, setBonusModalMemberId] = useState<string>('');
    const [bonusModalCustomDate, setBonusModalCustomDate] = useState<string>(new Date().toISOString().split('T')[0]);

    const [datesModalVisible, setDatesModalVisible] = useState(false);
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);
    const [showBonusDatePicker, setShowBonusDatePicker] = useState(false);

    const [historyModalVisible, setHistoryModalVisible] = useState(false);
    const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

    const [pastLeaguesModalVisible, setPastLeaguesModalVisible] = useState(false);

    // League domain hook
    const {
        leagueType,
        members,
        bonuses,
        leagueDates,
        sortedEvents,
        setCurrentEventIndex,
        currentEvent,
        bonusDate,
        dailyAttendees,
        rosterMembers,
        rules,
        bonusDefinitions,
        pastLeagues,
        isLeagueArchived,
        standings,
        changeDate,
        formatDateForDisplay,
        handleAddBonus,
        handleDeleteBonus,
        togglePresence,
        handleSaveDates,
        handleArchiveLeague,
        handleArchiveAndResetLeague,
        handleResetLeagueOnly,
        getMemberHistory
    } = useLeagueData('winter');

    // Synchronize dates input with current leagueDates
    const [datesInput, setDatesInput] = useState({ startDate: '', endDate: '' });
    useEffect(() => {
        if (leagueDates) {
            setDatesInput({ startDate: leagueDates.startDate, endDate: leagueDates.endDate });
        } else {
            setDatesInput({ startDate: '', endDate: '' });
        }
    }, [leagueDates]);

    const handleDateSelect = (date: string) => {
        if (showStartPicker) {
            setDatesInput(prev => ({ ...prev, startDate: date }));
            setShowStartPicker(false);
        } else if (showEndPicker) {
            setDatesInput(prev => ({ ...prev, endDate: date }));
            setShowEndPicker(false);
        }
    };

    const handleOpenAddBonusForMember = (memberId: string) => {
        setBonusModalMemberId(memberId);
        setBonusModalVisible(true);
    };

    const handleOpenAddExtraBonus = () => {
        setBonusModalMemberId(members[0]?.id || '');
        setBonusModalCustomDate(new Date().toISOString().split('T')[0]);
        setBonusModalVisible(true);
    };

    const handleSelectMemberForHistory = (memberId: string) => {
        setSelectedMemberId(memberId);
        setHistoryModalVisible(true);
    };

    const selectedMember = members.find(m => m.id === selectedMemberId) || null;
    const selectedMemberHistory = selectedMemberId ? getMemberHistory(selectedMemberId) : [];

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerTop}>
                    <TouchableOpacity
                        onPress={() => setPastLeaguesModalVisible(true)}
                        style={[styles.historyButton, navigation.canGoBack() && { left: 45 }]}
                    >
                        <Image source={require('../assets/trophy.png')} style={[styles.iconImage, { tintColor: theme.colors.text }]} />
                    </TouchableOpacity>
                    <ScreenTitle title="LEAGUE" onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined} />
                    {!isBubbaOnly && (
                        <TouchableOpacity onPress={() => setDatesModalVisible(true)} style={styles.settingsButton}>
                            <Image source={require('../assets/gear.png')} style={[styles.iconImage, { tintColor: theme.colors.text }]} />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Countdown / Season Status */}
                <LeagueCountdown
                    leagueType={leagueType}
                    leagueDates={leagueDates}
                    isLeagueArchived={isLeagueArchived}
                    isBubbaOnly={isBubbaOnly}
                    formatDateForDisplay={formatDateForDisplay}
                    onOpenDatesModal={() => setDatesModalVisible(true)}
                    onArchiveAndReset={handleArchiveAndResetLeague}
                    onArchiveOnly={handleArchiveLeague}
                    onResetOnly={handleResetLeagueOnly}
                />

                {/* Tabs */}
                <View style={styles.tabContainer}>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'standings' && styles.tabActive]}
                        onPress={() => setActiveTab('standings')}
                    >
                        <Text style={[styles.tabText, activeTab === 'standings' && styles.tabTextActive, { color: activeTab === 'standings' ? theme.colors.primary : theme.colors.textSecondary }]}>
                            Classifica
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'bonus' && styles.tabActive]}
                        onPress={() => setActiveTab('bonus')}
                    >
                        <Text style={[styles.tabText, activeTab === 'bonus' && styles.tabTextActive, { color: activeTab === 'bonus' ? theme.colors.primary : theme.colors.textSecondary }]}>
                            Punti
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'rules' && styles.tabActive]}
                        onPress={() => setActiveTab('rules')}
                    >
                        <Text style={[styles.tabText, activeTab === 'rules' && styles.tabTextActive, { color: activeTab === 'rules' ? theme.colors.primary : theme.colors.textSecondary }]}>
                            Regole
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'bonusList' && styles.tabActive]}
                        onPress={() => setActiveTab('bonusList')}
                    >
                        <Text style={[styles.tabText, activeTab === 'bonusList' && styles.tabTextActive, { color: activeTab === 'bonusList' ? theme.colors.primary : theme.colors.textSecondary }]}>
                            Lista Punti
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Content Tabs */}
            <View style={styles.content}>
                {activeTab === 'standings' && (
                    <LeagueStandingsTab
                        standings={standings}
                        onSelectMember={handleSelectMemberForHistory}
                    />
                )}

                {activeTab === 'bonus' && (
                    <LeagueBonusTab
                        bonusDate={bonusDate}
                        currentEvent={currentEvent}
                        leagueDates={leagueDates}
                        members={members}
                        bonuses={bonuses}
                        dailyAttendees={dailyAttendees}
                        rosterMembers={rosterMembers}
                        isBubbaOnly={isBubbaOnly}
                        formatDateForDisplay={formatDateForDisplay}
                        onChangeDate={changeDate}
                        onOpenDatePicker={() => {
                            if (leagueDates && leagueDates.startDate) {
                                setShowBonusDatePicker(true);
                            }
                        }}
                        onTogglePresence={(memberId, hasPresence) => togglePresence(memberId, hasPresence, isBubbaOnly)}
                        onDeleteBonus={handleDeleteBonus}
                        onOpenAddBonusModal={handleOpenAddBonusForMember}
                    />
                )}

                {activeTab === 'rules' && (
                    <LeagueRulesTab rules={rules} />
                )}

                {activeTab === 'bonusList' && (
                    <LeagueBonusListTab
                        bonusDefinitions={bonusDefinitions}
                        isBubbaOnly={isBubbaOnly}
                        onOpenAddExtraBonus={handleOpenAddExtraBonus}
                    />
                )}
            </View>

            {/* Modals */}
            <LeagueHistoryModal
                visible={historyModalVisible}
                onClose={() => setHistoryModalVisible(false)}
                member={selectedMember}
                history={selectedMemberHistory}
                formatDateForDisplay={formatDateForDisplay}
            />

            <LeaguePastModal
                visible={pastLeaguesModalVisible}
                onClose={() => setPastLeaguesModalVisible(false)}
                pastLeagues={pastLeagues}
                formatDateForDisplay={formatDateForDisplay}
            />

            <LeagueBonusModal
                visible={bonusModalVisible}
                onClose={() => setBonusModalVisible(false)}
                bonusDefinitions={bonusDefinitions}
                members={members}
                initialMemberId={bonusModalMemberId}
                bonusDate={bonusDate}
                isBonusListTab={activeTab === 'bonusList'}
                formatDateForDisplay={formatDateForDisplay}
                onAddBonus={handleAddBonus}
                onOpenDatePicker={() => setShowBonusDatePicker(true)}
                customDate={bonusModalCustomDate}
            />

            <LeagueSettingsModal
                visible={datesModalVisible}
                onClose={() => setDatesModalVisible(false)}
                leagueType={leagueType}
                leagueDates={leagueDates}
                rules={rules}
                bonusDefinitions={bonusDefinitions}
                formatDateForDisplay={formatDateForDisplay}
                onOpenStartPicker={() => setShowStartPicker(true)}
                onOpenEndPicker={() => setShowEndPicker(true)}
                datesInput={datesInput}
                onSaveDates={handleSaveDates}
            />

            {/* Date Picker Modals */}
            <DatePickerModal
                visible={showStartPicker}
                onClose={() => setShowStartPicker(false)}
                onSelectDate={handleDateSelect}
                initialDate={datesInput.startDate || undefined}
            />
            <DatePickerModal
                visible={showEndPicker}
                onClose={() => setShowEndPicker(false)}
                onSelectDate={handleDateSelect}
                initialDate={datesInput.endDate || undefined}
            />
            <DatePickerModal
                visible={showBonusDatePicker}
                onClose={() => setShowBonusDatePicker(false)}
                onSelectDate={(date) => {
                    if (activeTab === 'bonusList') {
                        setBonusModalCustomDate(date);
                    } else {
                        const index = sortedEvents.findIndex(e => e.date === date);
                        if (index !== -1) {
                            setCurrentEventIndex(index);
                        } else {
                            const nextIndex = sortedEvents.findIndex(e => e.date > date);
                            if (nextIndex !== -1) {
                                setCurrentEventIndex(nextIndex);
                            } else if (sortedEvents.length > 0) {
                                setCurrentEventIndex(sortedEvents.length - 1);
                            }
                        }
                    }
                    setShowBonusDatePicker(false);
                }}
                initialDate={activeTab === 'bonusList' ? bonusModalCustomDate : bonusDate}
            />
        </SafeAreaView>
    );
}
