import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Modal, ScrollView, Platform, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { subscribeToEvents, addEvent, updateEvent, deleteEvent, Event, subscribeToMembers, Member, deleteField, subscribeToWorldLocations, WorldLocation } from '../services/firestore';
import * as ImagePicker from 'expo-image-picker';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../firebaseConfig';
import { useNavigation } from '@react-navigation/native';
import ScreenTitle from '../components/ScreenTitle';
import ParticipantsModal from '../components/ParticipantsModal';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { isChristmasPeriod } from '../utils/date';
import LocationPickerModal from '../components/LocationPickerModal';
import SearchablePicker from '../components/SearchablePicker';
import DatePickerModal from '../components/DatePickerModal';
import { showAlert, showConfirmation } from '../utils/alert';

import { useRoute } from '@react-navigation/native';

export default function CalendarScreen() {
    const route = useRoute<any>();
    const { userProfile, isBubbaOnly } = useAuth();
    const { theme, isChristmasEnabled } = useTheme();
    const isChristmas = isChristmasPeriod() && isChristmasEnabled;
    const navigation = useNavigation<any>();

    const [events, setEvents] = useState<Event[]>([]);
    const [worldLocations, setWorldLocations] = useState<WorldLocation[]>([]);
    const [members, setMembers] = useState<Member[]>([]);

    const [modalVisible, setModalVisible] = useState(false);
    const [participantsModalVisible, setParticipantsModalVisible] = useState(false);
    const [detailModalVisible, setDetailModalVisible] = useState(false);
    const [selectedDate, setSelectedDate] = useState<string>('');

    // Form State
    const [editingEvent, setEditingEvent] = useState<Event | null>(null);
    const [eventTitle, setEventTitle] = useState('');
    const [eventDate, setEventDate] = useState('');
    const [eventEndDate, setEventEndDate] = useState('');
    const [eventType, setEventType] = useState<Event['type']>('training');
    const [eventLocation, setEventLocation] = useState('');
    const [eventLatitude, setEventLatitude] = useState<number | undefined>(undefined);
    const [eventLongitude, setEventLongitude] = useState<number | undefined>(undefined);
    const [eventShowOnMap, setEventShowOnMap] = useState(true);
    const [eventPlayerFee, setEventPlayerFee] = useState('');
    const [eventTeamFee, setEventTeamFee] = useState('');
    const [eventAdditionalInfo, setEventAdditionalInfo] = useState('');
    const [eventSubType, setEventSubType] = useState<string>('raduno');
    const [eventImages, setEventImages] = useState<string[]>([]);
    const [uploading, setUploading] = useState(false);
    const [tournamentDetailVisible, setTournamentDetailVisible] = useState(false);
    const [selectedTournament, setSelectedTournament] = useState<Event | null>(null);
    const [locationPickerVisible, setLocationPickerVisible] = useState(false);

    const [currentMonth, setCurrentMonth] = useState(new Date());

    // Date Picker States
    const [showStartDatePicker, setShowStartDatePicker] = useState(false);
    const [showEndDatePicker, setShowEndDatePicker] = useState(false);

    useEffect(() => {
        if (route.params?.editEventId && events.length > 0) {
            const eventToEdit = events.find(e => e.id === route.params.editEventId);
            if (eventToEdit) {
                openEditModal(eventToEdit);
                // Clear param to avoid reopening on re-render? 
                // Navigation params persist, but we only want this to happen once or when param changes.
                // React Navigation handles this well usually.
                navigation.setParams({ editEventId: undefined });
            }
        }
    }, [route.params?.editEventId, events]);

    useEffect(() => {
        const unsubscribe = subscribeToEvents((updatedEvents) => {
            setEvents(updatedEvents);
        });
        const unsubscribeMembers = subscribeToMembers((updatedMembers) => {
            setMembers(updatedMembers);
        });
        const unsubscribeLocations = subscribeToWorldLocations((locations) => {
            setWorldLocations(locations);
        });

        return () => {
            unsubscribe();
            unsubscribeMembers();
            unsubscribeLocations();
        };
    }, []);

    const birthdayEvents = React.useMemo(() => {
        const bEvents: Event[] = [];
        const currentYear = new Date().getFullYear();
        // Generate for a wide range to cover scrolling
        const years = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1, currentYear + 2];

        members.forEach(member => {
            if (member.birthDate) {
                try {
                    const parts = member.birthDate.split('-');
                    if (parts.length === 3) {
                        const month = parts[1];
                        const day = parts[2];
                        years.forEach(year => {
                            bEvents.push({
                                id: `birthday_${member.id}_${year}`,
                                title: `Compleanno ${member.nickname || member.firstName}`,
                                date: `${year}-${month}-${day}`,
                                type: 'birthday'
                            });
                        });
                    }
                } catch (e) {
                    console.error("Invalid birthdate format", member.birthDate);
                }
            }
        });
        return bEvents;
    }, [members]);

    const allEvents = [...events, ...birthdayEvents].filter(e => e.type !== 'championship_season');

    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.5,
        });

        if (!result.canceled) {
            setUploading(true);
            try {
                const { uri } = result.assets[0];
                const filename = uri.substring(uri.lastIndexOf('/') + 1);
                const storageRef = ref(storage, `images/${filename}`);
                const response = await fetch(uri);
                const blob = await response.blob();
                await uploadBytes(storageRef, blob);
                const downloadURL = await getDownloadURL(storageRef);
                setEventImages(prev => [...prev, downloadURL]);
            } catch (error) {
                console.error("Error uploading image: ", error);
                showAlert("Errore", "Caricamento immagine fallito.");
            } finally {
                setUploading(false);
            }
        }
    };

    const handleLocationChange = (val: string) => {
        setEventLocation(val);
        if (!val || !val.trim()) return;
        const lowerVal = val.trim().toLowerCase();
        const existingLoc = worldLocations.find(l =>
            (l.locationName && l.locationName.toLowerCase() === lowerVal) ||
            (l.title && l.title.toLowerCase() === lowerVal)
        );
        if (existingLoc) {
            setEventLatitude(existingLoc.latitude);
            setEventLongitude(existingLoc.longitude);
            return;
        }
        const existingEvent = events.find(e =>
            e.latitude && e.longitude && e.location && e.location.toLowerCase() === lowerVal
        );
        if (existingEvent) {
            setEventLatitude(existingEvent.latitude);
            setEventLongitude(existingEvent.longitude);
        }
    };

    const handleSaveEvent = async () => {
        if (eventTitle && eventDate) {
            if (editingEvent) {
                showConfirmation(
                    "Conferma Modifica Evento",
                    `Vuoi salvare le modifiche all'evento "${eventTitle}" del ${eventDate}?`,
                    async () => {
                        try {
                            await updateEvent({
                                ...editingEvent,
                                title: eventTitle,
                                date: eventDate,
                                endDate: (eventEndDate || deleteField()) as any,
                                type: eventType,
                                location: eventLocation || deleteField() as any,
                                latitude: eventLatitude || deleteField() as any,
                                longitude: eventLongitude || deleteField() as any,
                                showOnMap: eventLatitude && eventLongitude ? eventShowOnMap : false,
                                playerFee: eventPlayerFee || deleteField() as any,
                                teamFee: eventTeamFee || deleteField() as any,
                                additionalInfo: eventAdditionalInfo || deleteField() as any,
                                subType: eventType === 'other' ? (eventSubType || 'raduno') : (deleteField() as any),
                                images: eventImages
                            });
                            closeModal();
                            showAlert("Successo", "Evento aggiornato correttamente.");
                        } catch (error) {
                            showAlert("Errore", "Impossibile salvare l'evento.");
                        }
                    },
                    "Salva Modifiche"
                );
                return;
            }

            try {
                await addEvent({
                    title: eventTitle,
                    date: eventDate,
                    endDate: eventEndDate || undefined,
                    type: eventType,
                    location: eventLocation,
                    latitude: eventLatitude,
                    longitude: eventLongitude,
                    showOnMap: eventLatitude && eventLongitude ? eventShowOnMap : false,
                    playerFee: eventPlayerFee,
                    teamFee: eventTeamFee,
                    additionalInfo: eventAdditionalInfo,
                    subType: eventType === 'other' ? (eventSubType || 'raduno') : undefined,
                    images: eventImages
                });
                closeModal();
                showAlert("Successo", "Nuovo evento aggiunto a calendario.");
            } catch (error) {
                showAlert("Errore", "Impossibile salvare l'evento.");
            }
        } else {
            showAlert("Attenzione", "Titolo e Data sono obbligatori.");
        }
    };

    const handleDeleteEvent = async () => {
        if (editingEvent) {
            showConfirmation(
                "Elimina Evento",
                "Sei sicuro di voler eliminare questo evento?",
                async () => {
                    try {
                        await deleteEvent(editingEvent.id);
                        closeModal();
                    } catch (error) {
                        showAlert("Errore", "Impossibile eliminare l'evento.");
                    }
                },
                "Elimina"
            );
        }
    };






    const openDayDetail = (dateStr: string) => {
        setSelectedDate(dateStr);
        setDetailModalVisible(true);
    };

    const openAddModal = (date?: string) => {
        setEditingEvent(null);
        setEventTitle('');
        if (date) {
            setEventDate(date);
        } else {
            setEventDate(toLocalISOString(new Date()));
        }
        setEventEndDate('');
        setEventEndDate('');
        setEventType('Campo');
        setEventLocation('');
        setEventLatitude(undefined);
        setEventLongitude(undefined);
        setEventShowOnMap(true);
        setEventPlayerFee('');
        setEventTeamFee('');
        setEventAdditionalInfo('');
        setEventSubType('raduno');
        setEventImages([]);
        setDetailModalVisible(false); // Close detail modal if open
        setModalVisible(true);
    };

    const openEditModal = (event: Event) => {
        setEditingEvent(event);
        setEventTitle(event.title);
        setEventDate(event.date);
        setEventEndDate(event.endDate || '');
        setEventEndDate(event.endDate || '');
        setEventType(event.type);
        setEventSubType(event.subType || 'raduno');
        setEventLocation(event.location || '');
        setEventLatitude(event.latitude);
        setEventLongitude(event.longitude);
        setEventShowOnMap(event.showOnMap !== undefined ? event.showOnMap : true);
        setEventPlayerFee(event.playerFee || '');
        setEventTeamFee(event.teamFee || '');
        setEventAdditionalInfo(event.additionalInfo || '');
        setEventImages(event.images || []);
        setDetailModalVisible(false); // Close detail modal if open
        setModalVisible(true);
    };

    const closeModal = () => {
        setModalVisible(false);
        setEditingEvent(null);
        setEventTitle('');
        setEventDate('');
        setEventEndDate('');
        setEventEndDate('');
        setEventType('Campo');
        setEventLocation('');
        setEventLatitude(undefined);
        setEventLongitude(undefined);
        setEventShowOnMap(true);
        setEventPlayerFee('');
        setEventTeamFee('');
        setEventAdditionalInfo('');
        setEventSubType('raduno');
        setEventImages([]);
        setUploading(false);
    };

    const changeMonth = (increment: number) => {
        const newDate = new Date(currentMonth);
        newDate.setMonth(newDate.getMonth() + increment);
        setCurrentMonth(newDate);
    };

    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const days = new Date(year, month + 1, 0).getDate();
        const firstDay = new Date(year, month, 1).getDay(); // 0=Sun, 1=Mon

        // Adjust for Monday start (0=Mon, 6=Sun)
        const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;

        const daysArray = [];
        // Add empty slots for previous month
        for (let i = 0; i < adjustedFirstDay; i++) {
            daysArray.push(null);
        }
        // Add days of current month
        for (let i = 1; i <= days; i++) {
            daysArray.push(new Date(year, month, i));
        }
        return daysArray;
    };

    const isEventOnDate = (event: Event, dateStr: string) => {
        if (event.date === dateStr) return true;
        if (event.endDate) {
            return dateStr >= event.date && dateStr <= event.endDate;
        }
        return false;
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return '';
        const [year, month, day] = dateString.split('-');
        return `${day}/${month}/${year}`;
    };

    const toLocalISOString = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const renderCalendarGrid = () => {
        const days = getDaysInMonth(currentMonth);
        const weekDays = ['LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB', 'DOM'];

        return (
            <View style={[styles.calendarContainer, { backgroundColor: theme.colors.card }]}>
                <View style={styles.monthHeader}>
                    <TouchableOpacity onPress={() => changeMonth(-1)}>
                        <Text style={[styles.monthNav, { color: theme.colors.primary }]}>{'<'}</Text>
                    </TouchableOpacity>
                    <Text style={[styles.monthTitle, { color: theme.colors.text }]}>
                        {currentMonth.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }).toUpperCase()}
                    </Text>
                    <TouchableOpacity onPress={() => changeMonth(1)}>
                        <Text style={[styles.monthNav, { color: theme.colors.primary }]}>{'>'}</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.weekDaysRow}>
                    {weekDays.map(day => (
                        <Text key={day} style={[styles.weekDayText, { color: theme.colors.textSecondary }]}>{day}</Text>
                    ))}
                </View>

                <View style={styles.daysGrid}>
                    {days.map((date, index) => {
                        if (!date) return <View key={`empty-${index}`} style={styles.dayCell} />;

                        const dateStr = toLocalISOString(date);
                        const dayEvents = allEvents.filter(e => isEventOnDate(e, dateStr))
                            .sort((a, b) => {
                                const isMultiDayA = a.endDate && a.date !== a.endDate;
                                const isMultiDayB = b.endDate && b.date !== b.endDate;
                                if (isMultiDayA && !isMultiDayB) return -1;
                                if (!isMultiDayA && isMultiDayB) return 1;
                                return a.date.localeCompare(b.date);
                            });

                        const isToday = dateStr === toLocalISOString(new Date());

                        return (
                            <TouchableOpacity
                                key={dateStr}
                                style={[styles.dayCell, isToday && [styles.todayCell, { backgroundColor: theme.colors.inputBackground }]]}
                                onPress={() => openDayDetail(dateStr)}
                            >
                                <Text style={[styles.dayNumber, { color: theme.colors.text }, isToday && [styles.todayText, { color: theme.colors.primary }]]}>{date.getDate()}</Text>
                                <View style={styles.eventsContainer}>
                                    {dayEvents.slice(0, 4).map((ev, i) => {
                                        const isStart = ev.date === dateStr;
                                        const isEnd = ev.endDate === dateStr;
                                        const isSingleDay = !ev.endDate || ev.date === ev.endDate;
                                        const isMultiDay = !isSingleDay;

                                        if (isSingleDay) {
                                            return (
                                                <View key={i} style={[styles.eventDot, { backgroundColor: getTypeColor(ev.type, theme) }]} />
                                            );
                                        } else {
                                            // Multi-day bar
                                            return (
                                                <View
                                                    key={i}
                                                    style={[
                                                        styles.eventBar,
                                                        { backgroundColor: getTypeColor(ev.type, theme) },
                                                        isStart && styles.eventBarStart,
                                                        isEnd && styles.eventBarEnd,
                                                        !isStart && !isEnd && styles.eventBarMiddle
                                                    ]}
                                                />
                                            );
                                        }
                                    })}
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>
        );
    };

    const renderEvent = ({ item, style }: { item: Event, style?: any }) => (
        <TouchableOpacity onPress={() => {
            if (item.type === 'tournament' || item.type === 'other') {
                setSelectedTournament(item);
                setTournamentDetailVisible(true);
            } else if (!isBubbaOnly) {
                openEditModal(item);
            }
        }} activeOpacity={isBubbaOnly && (item.type !== 'tournament' && item.type !== 'other') ? 1 : 0.7}>
            <View style={[styles.eventCard, style, { backgroundColor: theme.colors.card }]}>
                <View style={[styles.dateBox, { backgroundColor: getTypeColor(item.type, theme) }]}>
                    <Text style={styles.dateDay}>{item.date.split('-')[2]}</Text>
                    <Text style={styles.dateMonth}>{getMonthName(item.date)}</Text>
                </View>
                <View style={styles.eventInfo}>
                    <Text style={[styles.eventTitle, { color: theme.colors.text }]}>{item.title}</Text>
                    <Text style={[styles.eventType, { color: theme.colors.textSecondary }]}>
                        {translateType(item.type, item.subType)}
                        {item.endDate ? ` (fino al ${formatDate(item.endDate)})` : ''}
                    </Text>
                </View>
            </View>
        </TouchableOpacity>
    );

    // Filter events for the selected month to show in the list below
    // Include events that start in this month OR span across this month
    // AND exclude 'training' events
    // AND exclude 'training' events
    const monthEvents = allEvents.filter(e => {
        if (e.type === 'training' || e.type === 'Campo' || e.type === 'Palestra') return false;

        const start = new Date(e.date);
        const end = e.endDate ? new Date(e.endDate) : start;
        const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
        const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

        return start <= monthEnd && end >= monthStart;
    }).sort((a, b) => a.date.localeCompare(b.date));

    // Events for Day Detail Modal
    // Events for Day Detail Modal
    const dayDetailEvents = selectedDate ? allEvents.filter(e => isEventOnDate(e, selectedDate)) : [];

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={[styles.header, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}>
                <ScreenTitle title="CALENDARIO" />
            </View>

            <ScrollView>
                {renderCalendarGrid()}

                <View style={styles.listContainer}>
                    <Text style={[styles.listTitle, { color: theme.colors.text }]}>Eventi del Mese</Text>
                    {monthEvents.length > 0 ? (
                        monthEvents.map((event, index) => (
                            <View key={event.id}>
                                {renderEvent({
                                    item: event,
                                    style: index === monthEvents.length - 1 ? { marginBottom: 0 } : undefined
                                })}
                            </View>
                        ))
                    ) : (
                        <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>Nessun evento questo mese.</Text>
                    )}
                </View>
            </ScrollView>

            {/* Add/Edit Event Modal */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={modalVisible}
                onRequestClose={closeModal}
            >
                <View style={styles.centeredView}>
                    <View style={[styles.modalView, { backgroundColor: theme.colors.card }]}>
                        <ScrollView style={{ width: '100%' }} showsVerticalScrollIndicator={false}>
                            <TextInput
                                style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text, fontSize: 18, fontWeight: 'bold', marginBottom: 15 }]}
                                placeholder="Nome Evento"
                                placeholderTextColor={theme.colors.textSecondary}
                                value={eventTitle}
                                onChangeText={setEventTitle}
                            />
                            <TouchableOpacity onPress={() => setShowStartDatePicker(true)}>
                                <View style={[styles.input, { backgroundColor: theme.colors.inputBackground }]}>
                                    <Text style={{ color: eventDate ? theme.colors.text : theme.colors.textSecondary }}>
                                        {eventDate ? `Data Inizio: ${formatDate(eventDate)}` : 'Seleziona Data Inizio'}
                                    </Text>
                                </View>
                            </TouchableOpacity>

                            <View style={styles.dateInputRow}>
                                <TouchableOpacity onPress={() => setShowEndDatePicker(true)} style={{ flex: 1 }}>
                                    <View style={[styles.input, { backgroundColor: theme.colors.inputBackground }]}>
                                        <Text style={{ color: eventEndDate ? theme.colors.text : theme.colors.textSecondary }}>
                                            {eventEndDate ? `Data Fine: ${formatDate(eventEndDate)}` : 'Seleziona Data Fine (Opzionale)'}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                                {eventEndDate ? (
                                    <TouchableOpacity onPress={() => setEventEndDate('')} style={styles.clearButton}>
                                        <Image source={require('../assets/x.png')} style={styles.clearIcon} resizeMode="contain" />
                                    </TouchableOpacity>
                                ) : null}
                            </View>

                            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Tipo Evento:</Text>
                            <View style={styles.typeContainer}>
                                <View style={styles.typeRow}>
                                    <TypeButton
                                        type="training"
                                        label="Allenamento"
                                        selected={['training', 'Campo', 'Palestra'].includes(eventType) ? 'training' : eventType}
                                        onSelect={(t) => setEventType('Campo')}
                                        theme={theme}
                                    />
                                    <TypeButton type="match" label="Amichevole" selected={eventType} onSelect={setEventType} theme={theme} />
                                </View>
                                {['training', 'Campo', 'Palestra'].includes(eventType) && (
                                    <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 15, backgroundColor: theme.colors.inputBackground, borderRadius: 10, padding: 5 }}>
                                        <TouchableOpacity
                                            style={{
                                                flex: 1,
                                                paddingVertical: 8,
                                                alignItems: 'center',
                                                borderRadius: 8,
                                                backgroundColor: (eventType === 'Campo' || eventType === 'training') ? theme.colors.card : 'transparent',
                                                shadowColor: (eventType === 'Campo' || eventType === 'training') ? "#000" : "transparent",
                                                shadowOffset: { width: 0, height: 1 },
                                                shadowOpacity: 0.1,
                                                shadowRadius: 2,
                                                elevation: (eventType === 'Campo' || eventType === 'training') ? 2 : 0
                                            }}
                                            onPress={() => setEventType('Campo')}
                                        >
                                            <Text style={{ fontWeight: 'bold', color: (eventType === 'Campo' || eventType === 'training') ? theme.colors.primary : theme.colors.textSecondary }}>🥏 Campo</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={{
                                                flex: 1,
                                                paddingVertical: 8,
                                                alignItems: 'center',
                                                borderRadius: 8,
                                                backgroundColor: eventType === 'Palestra' ? theme.colors.card : 'transparent',
                                                shadowColor: eventType === 'Palestra' ? "#000" : "transparent",
                                                shadowOffset: { width: 0, height: 1 },
                                                shadowOpacity: 0.1,
                                                shadowRadius: 2,
                                                elevation: eventType === 'Palestra' ? 2 : 0
                                            }}
                                            onPress={() => setEventType('Palestra')}
                                        >
                                            <Text style={{ fontWeight: 'bold', color: eventType === 'Palestra' ? theme.colors.primary : theme.colors.textSecondary }}>🏋️ Palestra</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                                <View style={styles.typeRow}>
                                    <TypeButton type="championship" label="Campionato" selected={eventType} onSelect={setEventType} theme={theme} />
                                    <TypeButton type="tournament" label="Torneo" selected={eventType} onSelect={setEventType} theme={theme} />
                                </View>
                                <View style={styles.typeRow}>
                                    <TypeButton type="social" label="Riunione di squadra" selected={eventType} onSelect={setEventType} theme={theme} />
                                    <TypeButton type="other" label="Altro" selected={eventType} onSelect={setEventType} theme={theme} />
                                </View>
                            </View>

                            {eventType === 'other' && (
                                <View style={{ width: '100%', marginTop: 15, marginBottom: 10 }}>
                                    <Text style={[styles.label, { color: theme.colors.textSecondary, marginBottom: 6 }]}>Sotto-sezione:</Text>
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                                        {['Raduno', 'Stage', 'Festa'].map(preset => {
                                            const isSelected = (eventSubType || 'raduno').toLowerCase() === preset.toLowerCase();
                                            return (
                                                <TouchableOpacity
                                                    key={preset}
                                                    style={{
                                                        paddingHorizontal: 14,
                                                        paddingVertical: 6,
                                                        borderRadius: 16,
                                                        backgroundColor: isSelected ? theme.colors.primary : theme.colors.inputBackground,
                                                        borderWidth: 1,
                                                        borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                                                    }}
                                                    onPress={() => setEventSubType(preset.toLowerCase())}
                                                >
                                                    <Text style={{
                                                        fontSize: 13,
                                                        fontWeight: 'bold',
                                                        color: isSelected ? '#fff' : theme.colors.text
                                                    }}>
                                                        {preset}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                    <TextInput
                                        style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text, marginTop: 4 }]}
                                        placeholder="Nome sotto-sezione (es. Raduno, Stage, Festa)"
                                        placeholderTextColor={theme.colors.textSecondary}
                                        value={eventSubType}
                                        onChangeText={setEventSubType}
                                    />
                                </View>
                            )}

                            <View style={{ width: '100%', marginTop: 10 }}>
                                <View style={{ marginBottom: 15 }}>
                                    <SearchablePicker
                                        selectedValue={eventLocation}
                                        onValueChange={(val) => {
                                            handleLocationChange(val);
                                        }}
                                        items={Array.from(new Set(worldLocations.map(l => l.locationName || l.title).filter(n => n)))}
                                        placeholder="Luogo (Opzionale)"
                                        title="Seleziona Luogo"
                                    />
                                </View>
                                <TextInput
                                    style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]}
                                    placeholder="Luogo (Opzionale)"
                                    placeholderTextColor={theme.colors.textSecondary}
                                    value={eventLocation}
                                    onChangeText={handleLocationChange}
                                />
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}>
                                    <TouchableOpacity
                                        style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.primary, padding: 10, borderRadius: 8 }}
                                        onPress={() => setLocationPickerVisible(true)}
                                    >
                                        <Image source={require('../assets/world.png')} style={{ width: 20, height: 20, tintColor: 'white', marginRight: 5 }} />
                                        <Text style={{ color: 'white', fontWeight: 'bold' }}>
                                            {eventLatitude && eventLongitude ? 'Modifica Posizione' : 'Seleziona su Mappa'}
                                        </Text>
                                    </TouchableOpacity>
                                    {eventLatitude && eventLongitude && (
                                        <Text style={{ marginLeft: 10, color: theme.colors.textSecondary, fontSize: 12 }}>
                                            Lat: {eventLatitude.toFixed(4)}, Lon: {eventLongitude.toFixed(4)}
                                        </Text>
                                    )}
                                </View>

                                {eventLatitude !== undefined && eventLongitude !== undefined && (
                                    <TouchableOpacity
                                        style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}
                                        onPress={() => setEventShowOnMap(!eventShowOnMap)}
                                    >
                                        <Ionicons
                                            name={eventShowOnMap ? "checkbox" : "square-outline"}
                                            size={22}
                                            color={theme.colors.primary}
                                        />
                                        <Text style={{ marginLeft: 8, color: theme.colors.text, fontWeight: '500', fontSize: 14 }}>
                                            Mostra su BubbaWorld
                                        </Text>
                                    </TouchableOpacity>
                                )}

                                <TouchableOpacity style={[styles.imageButton, { borderColor: theme.colors.primary, borderWidth: 1, padding: 10, borderRadius: 8, alignItems: 'center', marginBottom: 10 }]} onPress={pickImage} disabled={uploading}>
                                    <Text style={{ color: theme.colors.primary }}>{uploading ? 'Caricamento...' : '+ Aggiungi Foto'}</Text>
                                </TouchableOpacity>

                                <ScrollView horizontal style={{ flexDirection: 'row', marginBottom: 15 }}>
                                    {eventImages.map((uri, index) => (
                                        <View key={index} style={{ position: 'relative', marginRight: 10 }}>
                                            <Image source={{ uri }} style={{ width: 80, height: 80, borderRadius: 5 }} />
                                            <TouchableOpacity
                                                style={{
                                                    position: 'absolute',
                                                    top: -5,
                                                    right: -5,
                                                    backgroundColor: 'white',
                                                    borderRadius: 10,
                                                    width: 20,
                                                    height: 20,
                                                    justifyContent: 'center',
                                                    alignItems: 'center',
                                                    borderWidth: 1,
                                                    borderColor: '#ccc'
                                                }}
                                                onPress={() => {
                                                    setEventImages(prev => prev.filter((_, i) => i !== index));
                                                }}
                                            >
                                                <Image source={require('../assets/x.png')} style={{ width: 10, height: 10 }} resizeMode="contain" />
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </ScrollView>

                                {eventType === 'tournament' && (
                                    <>
                                        <TextInput
                                            style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]}
                                            placeholder="Player Fee (es. 20€)"
                                            placeholderTextColor={theme.colors.textSecondary}
                                            value={eventPlayerFee}
                                            onChangeText={setEventPlayerFee}
                                        />
                                        <TextInput
                                            style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]}
                                            placeholder="Team Fee (es. 100€)"
                                            placeholderTextColor={theme.colors.textSecondary}
                                            value={eventTeamFee}
                                            onChangeText={setEventTeamFee}
                                        />
                                    </>
                                )}
                                <TextInput
                                    style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text, height: 80, textAlignVertical: 'top' }]}
                                    placeholder="Info Aggiuntive"
                                    placeholderTextColor={theme.colors.textSecondary}
                                    value={eventAdditionalInfo}
                                    onChangeText={setEventAdditionalInfo}
                                    multiline={true}
                                />
                            </View>

                            <TouchableOpacity
                                style={[styles.saveButton, { backgroundColor: theme.colors.primary }]}
                                onPress={handleSaveEvent}
                            >
                                <Text style={styles.textStyle}>Salva</Text>
                            </TouchableOpacity>

                            {editingEvent && (
                                <TouchableOpacity
                                    style={styles.deleteButton}
                                    onPress={handleDeleteEvent}
                                >
                                    <Text style={styles.textStyle}>Elimina</Text>
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity
                                style={[styles.closeButton, { backgroundColor: theme.colors.inputBackground }]}
                                onPress={closeModal}
                            >
                                <Text style={[styles.closeButtonText, { color: theme.colors.textSecondary }]}>Annulla</Text>
                            </TouchableOpacity>
                        </ScrollView>


                    </View>
                </View>
            </Modal>

            <LocationPickerModal
                visible={locationPickerVisible}
                onClose={() => setLocationPickerVisible(false)}
                onSelect={(lat, lng) => {
                    setEventLatitude(lat);
                    setEventLongitude(lng);
                }}
                theme={theme}
                initialLocation={eventLatitude && eventLongitude ? { latitude: eventLatitude, longitude: eventLongitude } : null}
                existingLocations={[
                    ...events.filter(e => e.latitude && e.longitude).map(e => ({ latitude: e.latitude!, longitude: e.longitude!, title: e.location })),
                    ...worldLocations.map(l => ({ latitude: l.latitude, longitude: l.longitude, title: l.locationName }))
                ]}
            />

            <ParticipantsModal
                visible={participantsModalVisible}
                onClose={() => setParticipantsModalVisible(false)}
                event={editingEvent}
                members={members}
            />

            {/* Day Detail Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={detailModalVisible}
                onRequestClose={() => setDetailModalVisible(false)}
            >
                <View style={styles.centeredView}>
                    <View style={[styles.modalView, { backgroundColor: theme.colors.card }]}>
                        <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                            {selectedDate ? formatDate(selectedDate) : ''}
                        </Text>

                        <ScrollView style={{ width: '100%', maxHeight: 300 }}>
                            {dayDetailEvents.length > 0 ? (
                                dayDetailEvents.map((event, index) => (
                                    <View key={event.id}>
                                        {renderEvent({
                                            item: event,
                                            style: index === dayDetailEvents.length - 1 ? { marginBottom: 0 } : undefined
                                        })}
                                    </View>
                                ))
                            ) : (
                                <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>Nessun evento.</Text>
                            )}
                        </ScrollView>

                        {!isBubbaOnly && (
                            <TouchableOpacity
                                style={[styles.saveButton, { marginTop: 20, backgroundColor: theme.colors.primary }]}
                                onPress={() => openAddModal(selectedDate)}
                            >
                                <Text style={styles.textStyle}>+ Aggiungi Evento</Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity
                            style={[styles.closeButton, { backgroundColor: theme.colors.inputBackground }]}
                            onPress={() => setDetailModalVisible(false)}
                        >
                            <Text style={[styles.closeButtonText, { color: theme.colors.textSecondary }]}>Chiudi</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

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

            {/* Tournament Details Modal */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={tournamentDetailVisible}
                onRequestClose={() => setTournamentDetailVisible(false)}
            >
                <View style={styles.centeredView}>
                    <View style={[styles.modalView, { backgroundColor: theme.colors.card }]}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 15 }}>
                            <Text style={[styles.modalTitle, { color: theme.colors.text, marginBottom: 0, flex: 1 }]}>
                                {selectedTournament?.title}
                            </Text>
                            {!isBubbaOnly && (
                                <TouchableOpacity onPress={() => {
                                    if (selectedTournament) {
                                        setTournamentDetailVisible(false);
                                        openEditModal(selectedTournament);
                                    }
                                }}>
                                    <Image source={require('../assets/gear.png')} style={{ width: 24, height: 24, tintColor: theme.colors.text }} />
                                </TouchableOpacity>
                            )}
                        </View>

                        <ScrollView style={{ width: '100%', maxHeight: 400 }}>
                            <Text style={[styles.label, { color: theme.colors.textSecondary, marginBottom: 5 }]}>Data:</Text>
                            <Text style={[styles.textStyle, { color: theme.colors.text, marginBottom: 15, textAlign: 'left' }]}>
                                {selectedTournament ? formatDate(selectedTournament.date) : ''}
                                {selectedTournament?.endDate ? ` - ${formatDate(selectedTournament.endDate)}` : ''}
                            </Text>

                            {selectedTournament?.location && (
                                <>
                                    <Text style={[styles.label, { color: theme.colors.textSecondary, marginBottom: 5 }]}>Luogo:</Text>
                                    <Text style={[styles.textStyle, { color: theme.colors.text, marginBottom: 15, textAlign: 'left' }]}>
                                        {selectedTournament.location}
                                    </Text>
                                </>
                            )}

                            {selectedTournament?.playerFee && (
                                <>
                                    <Text style={[styles.label, { color: theme.colors.textSecondary, marginBottom: 5 }]}>Player Fee:</Text>
                                    <Text style={[styles.textStyle, { color: theme.colors.text, marginBottom: 15, textAlign: 'left' }]}>
                                        {selectedTournament.playerFee}
                                    </Text>
                                </>
                            )}

                            {selectedTournament?.teamFee && (
                                <>
                                    <Text style={[styles.label, { color: theme.colors.textSecondary, marginBottom: 5 }]}>Team Fee:</Text>
                                    <Text style={[styles.textStyle, { color: theme.colors.text, marginBottom: 15, textAlign: 'left' }]}>
                                        {selectedTournament.teamFee}
                                    </Text>
                                </>
                            )}

                            {selectedTournament?.additionalInfo && (
                                <>
                                    <Text style={[styles.label, { color: theme.colors.textSecondary, marginBottom: 5 }]}>Info Aggiuntive:</Text>
                                    <Text style={[styles.textStyle, { color: theme.colors.text, marginBottom: 15, textAlign: 'left' }]}>
                                        {selectedTournament.additionalInfo}
                                    </Text>
                                </>
                            )}

                            {selectedTournament?.type === 'other' && selectedTournament.subType && (
                                <>
                                    <Text style={[styles.label, { color: theme.colors.textSecondary, marginBottom: 5 }]}>Sotto-sezione:</Text>
                                    <Text style={[styles.textStyle, { color: theme.colors.text, marginBottom: 15, textAlign: 'left', textTransform: 'capitalize' }]}>
                                        {selectedTournament.subType}
                                    </Text>
                                </>
                            )}

                            {(selectedTournament?.type === 'tournament' || selectedTournament?.type === 'other') && (
                                <TouchableOpacity
                                    style={[styles.participantsButton, { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.primary, marginTop: 10 }]}
                                    onPress={() => {
                                        setEditingEvent(selectedTournament);
                                        setTournamentDetailVisible(false);
                                        setParticipantsModalVisible(true);
                                    }}
                                >
                                    <Text style={[styles.participantsButtonText, { color: theme.colors.primary }]}>👥 Gestisci Roster / Partecipanti</Text>
                                </TouchableOpacity>
                            )}
                        </ScrollView>

                        <TouchableOpacity
                            style={[styles.closeButton, { backgroundColor: theme.colors.inputBackground, marginTop: 10 }]}
                            onPress={() => setTournamentDetailVisible(false)}
                        >
                            <Text style={[styles.closeButtonText, { color: theme.colors.textSecondary }]}>Chiudi</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView >
    );
}

const TypeButton = ({ type, label, selected, onSelect, theme }: { type: any, label: string, selected: string, onSelect: (t: any) => void, theme: any }) => (
    <TouchableOpacity
        style={[styles.typeButton, selected === type && styles.typeButtonSelected, { borderColor: getTypeColor(type, theme) }]}
        onPress={() => onSelect(type)}
    >
        <Text style={[styles.typeButtonText, selected === type && styles.typeButtonTextSelected, { color: selected === type ? '#fff' : getTypeColor(type, theme) }]}>
            {label}
        </Text>
    </TouchableOpacity>
);

const getTypeColor = (type: string, theme: any) => {
    switch (type) {
        case 'training':
        case 'Campo':
        case 'Palestra':
            return theme.colors.training;
        case 'match': return theme.colors.match;
        case 'championship': return theme.colors.championship;
        case 'tournament': return theme.colors.tournament;
        case 'social': return theme.colors.social;
        case 'other': return theme.colors.other;
        case 'birthday': return theme.colors.birthday;
        default: return theme.colors.textSecondary;
    }
};

const translateType = (type: string, subType?: string) => {
    switch (type) {
        case 'training':
        case 'Campo':
        case 'Palestra':
            return 'ALLENAMENTO';
        case 'match': return 'AMICHEVOLE';
        case 'championship': return 'CAMPIONATO';
        case 'tournament': return 'TORNEO';
        case 'social': return 'RIUNIONE DI SQUADRA';
        case 'other':
            if (subType) {
                return `ALTRO (${subType.toUpperCase()})`;
            }
            return 'ALTRO';
        case 'birthday': return 'COMPLEANNO';
        default: return type.toUpperCase();
    }
};

const getMonthName = (dateString: string) => {
    try {
        const date = new Date(dateString);
        return date.toLocaleString('it-IT', { month: 'short' }).toUpperCase();
    } catch (e) {
        return '';
    }
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f0f2f5',
    },
    header: {
        padding: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    title: {
        // fontSize: 32,
        // fontWeight: 'bold',
        // color: '#003399',
        // fontFamily: 'NBAMilwaukeeBucks',
    },
    addButton: {
        position: 'absolute',
        right: 20,
        backgroundColor: '#003399',
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    genButton: {
        position: 'absolute',
        left: 20,
        backgroundColor: '#fbc02d',
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    participantsButton: {
        marginTop: 15,
        padding: 15,
        backgroundColor: '#e3f2fd',
        borderRadius: 10,
        alignItems: 'center',
        width: '100%',
        borderWidth: 1,
        borderColor: '#003399'
    },
    participantsButtonText: {
        color: '#003399',
        fontWeight: 'bold',
        fontSize: 16
    },
    calendarContainer: {
        backgroundColor: '#fff',
        margin: 15,
        borderRadius: 16,
        padding: 15,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        maxWidth: 800,
        width: '100%',
        alignSelf: 'center',
    },
    monthHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    monthTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    monthNav: {
        fontSize: 24,
        color: '#003399',
        paddingHorizontal: 15,
    },
    weekDaysRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 10,
    },
    weekDayText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#888',
        width: 35,
        textAlign: 'center',
    },
    daysGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    dayCell: {
        width: '14.28%', // 100% / 7
        height: 60,
        // alignItems: 'center', // Changed to allow full width bars
        justifyContent: 'flex-start', // Align to top
        marginBottom: 5,
        paddingTop: 2,
    },
    todayCell: {
        backgroundColor: '#e3f2fd',
        borderRadius: 4, // Reduced radius for better bar fit
    },
    lightningIcon: {
        position: 'absolute',
        top: 2,
        left: 2,
        fontSize: 10,
    },
    dayNumber: {
        fontSize: 14,
        color: '#333',
        textAlign: 'center',
        marginBottom: 2,
    },
    todayText: {
        color: '#003399',
        fontWeight: 'bold',
    },
    eventsContainer: {
        flexDirection: 'column', // Stack vertically
        width: '100%',
        alignItems: 'center', // Center dots, stretch bars?
    },
    eventDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        margin: 1,
    },
    eventBar: {
        height: 6,
        width: '100%',
        marginBottom: 2,
    },
    eventBarStart: {
        borderTopLeftRadius: 3,
        borderBottomLeftRadius: 3,
        marginLeft: 2,
        width: '90%', // Visual gap
        alignSelf: 'flex-end',
    },
    eventBarEnd: {
        borderTopRightRadius: 3,
        borderBottomRightRadius: 3,
        marginRight: 2,
        width: '90%', // Visual gap
        alignSelf: 'flex-start',
    },
    eventBarMiddle: {
        width: '100%', // Full width to connect
    },
    listContainer: {
        padding: 20,
    },
    listTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 15,
    },
    emptyText: {
        textAlign: 'center',
        color: '#888',
        marginTop: 10,
        fontSize: 16,
    },
    eventCard: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderRadius: 16,
        marginBottom: 15,
        overflow: 'hidden',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    dateBox: {
        width: 80,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 10,
    },
    dateDay: {
        color: '#fff',
        fontSize: 28,
        fontWeight: 'bold',
    },
    dateMonth: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
        opacity: 0.9,
    },
    eventInfo: {
        flex: 1,
        padding: 15,
        justifyContent: 'center',
    },
    eventTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 4,
    },
    eventType: {
        fontSize: 12,
        color: '#666',
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    centeredView: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalView: {
        margin: 20,
        backgroundColor: "white",
        borderRadius: 20,
        padding: 25,
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
        width: '90%',
        maxHeight: '90%',
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
        color: '#003399',
    },
    input: {
        width: '100%',
        backgroundColor: '#f5f5f5',
        borderRadius: 10,
        padding: 15,
        marginBottom: 15,
        fontSize: 16,
    },
    label: {
        alignSelf: 'flex-start',
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 10,
        color: '#333',
    },
    typeContainer: {
        width: '100%',
        marginBottom: 20,
    },
    typeRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    typeButton: {
        flex: 1,
        paddingVertical: 10,
        paddingHorizontal: 5,
        borderRadius: 8,
        borderWidth: 1,
        alignItems: 'center',
        marginHorizontal: 3,
    },
    typeButtonSelected: {
        backgroundColor: '#003399', // Will be overridden by dynamic color
    },
    typeButtonText: {
        fontSize: 12,
        fontWeight: '600',
    },
    typeButtonTextSelected: {
        color: '#fff',
    },
    saveButton: {
        backgroundColor: "#003399",
        borderRadius: 20,
        padding: 15,
        elevation: 2,
        width: '100%',
        marginBottom: 10,
    },
    deleteButton: {
        backgroundColor: "#d32f2f",
        borderRadius: 20,
        padding: 15,
        elevation: 2,
        width: '100%',
        marginBottom: 10,
    },
    closeButton: {
        padding: 10,
    },
    textStyle: {
        color: "white",
        fontWeight: "bold",
        textAlign: "center",
        fontSize: 16,
    },
    closeButtonText: {
        color: "#666",
        textAlign: "center",
        fontSize: 16,
    },
    dateInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
    },
    clearButton: {
        marginLeft: 10,
        padding: 5,
    },
    clearIcon: {
        width: 20,
        height: 20,
    },
    imageButton: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
});
