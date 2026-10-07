import React, { useCallback } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import ScreenTitle from '../components/ScreenTitle';
import ParticipantsModal from '../components/ParticipantsModal';
import LocationPickerModal from '../components/LocationPickerModal';
import DatePickerModal from '../components/DatePickerModal';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
    calendarStyles as styles,
    useCalendarData,
    CalendarGridView,
    CalendarEventCard,
    DayEventsModal,
    TournamentInfoModal,
    EventFormModal,
    isEventOnDate,
} from '../components/calendar';

export default function CalendarScreen() {
    const route = useRoute<any>();
    const navigation = useNavigation<any>();
    const { isBubbaOnly } = useAuth();
    const { theme } = useTheme();

    const onEditFound = useCallback(() => {
        navigation.setParams({ editEventId: undefined });
    }, [navigation]);

    const {
        events,
        worldLocations,
        members,
        allEvents,
        monthEvents,
        currentMonth,
        changeMonth,
        modalVisible,
        openAddModal,
        openEditModal,
        closeModal,
        participantsModalVisible,
        setParticipantsModalVisible,
        detailModalVisible,
        setDetailModalVisible,
        selectedDate,
        openDayDetail,
        tournamentDetailVisible,
        setTournamentDetailVisible,
        selectedTournament,
        setSelectedTournament,
        locationPickerVisible,
        setLocationPickerVisible,
        // Form states
        editingEvent,
        eventTitle,
        setEventTitle,
        eventDate,
        setEventDate,
        eventEndDate,
        setEventEndDate,
        eventType,
        setEventType,
        eventLocation,
        handleLocationChange,
        eventLatitude,
        setEventLatitude,
        eventLongitude,
        setEventLongitude,
        eventShowOnMap,
        setEventShowOnMap,
        eventPlayerFee,
        setEventPlayerFee,
        eventTeamFee,
        setEventTeamFee,
        eventAdditionalInfo,
        setEventAdditionalInfo,
        eventSubType,
        setEventSubType,
        eventImages,
        setEventImages,
        uploading,
        pickImage,
        handleSaveEvent,
        handleDeleteEvent,
        // Date picker modals
        showStartDatePicker,
        setShowStartDatePicker,
        showEndDatePicker,
        setShowEndDatePicker,
    } = useCalendarData(route.params?.editEventId, onEditFound);

    const handlePressTournament = useCallback((item: any) => {
        setSelectedTournament(item);
        setTournamentDetailVisible(true);
    }, [setSelectedTournament, setTournamentDetailVisible]);

    const dayDetailEvents = selectedDate ? allEvents.filter(e => isEventOnDate(e, selectedDate)) : [];

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={[styles.header, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}>
                <ScreenTitle title="CALENDARIO" />
            </View>

            <ScrollView>
                <CalendarGridView
                    currentMonth={currentMonth}
                    onChangeMonth={changeMonth}
                    allEvents={allEvents}
                    onSelectDate={openDayDetail}
                    theme={theme}
                />

                <View style={styles.listContainer}>
                    <Text style={[styles.listTitle, { color: theme.colors.text }]}>Eventi del Mese</Text>
                    {monthEvents.length > 0 ? (
                        monthEvents.map((event, index) => (
                            <View key={event.id}>
                                <CalendarEventCard
                                    item={event}
                                    style={index === monthEvents.length - 1 ? { marginBottom: 0 } : undefined}
                                    theme={theme}
                                    isBubbaOnly={isBubbaOnly}
                                    onPressTournament={handlePressTournament}
                                    onPressEdit={openEditModal}
                                />
                            </View>
                        ))
                    ) : (
                        <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                            Nessun evento questo mese.
                        </Text>
                    )}
                </View>
            </ScrollView>

            {/* Add / Edit Event Modal */}
            <EventFormModal
                visible={modalVisible}
                editingEvent={editingEvent}
                eventTitle={eventTitle}
                setEventTitle={setEventTitle}
                eventDate={eventDate}
                setEventDate={setEventDate}
                eventEndDate={eventEndDate}
                setEventEndDate={setEventEndDate}
                eventType={eventType}
                setEventType={setEventType}
                eventSubType={eventSubType}
                setEventSubType={setEventSubType}
                eventLocation={eventLocation}
                onLocationChange={handleLocationChange}
                eventLatitude={eventLatitude}
                eventLongitude={eventLongitude}
                eventShowOnMap={eventShowOnMap}
                setEventShowOnMap={setEventShowOnMap}
                eventPlayerFee={eventPlayerFee}
                setEventPlayerFee={setEventPlayerFee}
                eventTeamFee={eventTeamFee}
                setEventTeamFee={setEventTeamFee}
                eventAdditionalInfo={eventAdditionalInfo}
                setEventAdditionalInfo={setEventAdditionalInfo}
                eventImages={eventImages}
                setEventImages={setEventImages}
                uploading={uploading}
                pickImage={pickImage}
                worldLocations={worldLocations}
                theme={theme}
                onClose={closeModal}
                onSave={handleSaveEvent}
                onDelete={handleDeleteEvent}
                onOpenLocationPicker={() => setLocationPickerVisible(true)}
                onOpenStartDatePicker={() => setShowStartDatePicker(true)}
                onOpenEndDatePicker={() => setShowEndDatePicker(true)}
            />

            {/* Location Picker Modal */}
            <LocationPickerModal
                visible={locationPickerVisible}
                onClose={() => setLocationPickerVisible(false)}
                onSelect={(lat, lng) => {
                    setEventLatitude(lat);
                    setEventLongitude(lng);
                }}
                theme={theme}
                initialLocation={
                    eventLatitude && eventLongitude ? { latitude: eventLatitude, longitude: eventLongitude } : null
                }
                existingLocations={[
                    ...events
                        .filter(e => e.latitude && e.longitude)
                        .map(e => ({ latitude: e.latitude!, longitude: e.longitude!, title: e.location })),
                    ...worldLocations.map(l => ({ latitude: l.latitude, longitude: l.longitude, title: l.locationName })),
                ]}
            />

            {/* Participants Modal */}
            <ParticipantsModal
                visible={participantsModalVisible}
                onClose={() => setParticipantsModalVisible(false)}
                event={editingEvent || selectedTournament}
                members={members}
            />

            {/* Day Detail Modal */}
            <DayEventsModal
                visible={detailModalVisible}
                selectedDate={selectedDate}
                events={dayDetailEvents}
                theme={theme}
                isBubbaOnly={isBubbaOnly}
                onClose={() => setDetailModalVisible(false)}
                onAddEvent={openAddModal}
                onPressTournament={handlePressTournament}
                onPressEdit={openEditModal}
            />

            {/* Date Picker Modals */}
            <DatePickerModal
                visible={showStartDatePicker}
                onClose={() => setShowStartDatePicker(false)}
                onSelectDate={setEventDate}
                initialDate={eventDate}
            />

            <DatePickerModal
                visible={showEndDatePicker}
                onClose={() => setShowEndDatePicker(false)}
                onSelectDate={setEventEndDate}
                initialDate={eventEndDate}
            />

            {/* Tournament Info Modal */}
            <TournamentInfoModal
                visible={tournamentDetailVisible}
                event={selectedTournament}
                theme={theme}
                isBubbaOnly={isBubbaOnly}
                onClose={() => setTournamentDetailVisible(false)}
                onEditTournament={openEditModal}
                onManageParticipants={event => {
                    setSelectedTournament(event);
                    setTournamentDetailVisible(false);
                    setParticipantsModalVisible(true);
                }}
            />
        </SafeAreaView>
    );
}
