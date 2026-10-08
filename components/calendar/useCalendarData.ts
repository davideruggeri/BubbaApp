import { useState, useEffect, useMemo } from 'react';
import {
    subscribeToEvents,
    addEvent,
    updateEvent,
    deleteEvent,
    Event,
    subscribeToMembers,
    Member,
    deleteField,
    subscribeToWorldLocations,
    WorldLocation,
    checkAndAutoArchivePastTournaments,
} from '../../services/firestore';
import * as ImagePicker from 'expo-image-picker';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../../firebaseConfig';
import { showAlert, showConfirmation } from '../../utils/alert';
import { toLocalISOString } from './calendarUtils';
import { resolveLocationCoordinates } from '../../utils/geocoding';

export function useCalendarData(initialEditEventId?: string, onEditFound?: (event: Event) => void) {
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
    const [showStartDatePicker, setShowStartDatePicker] = useState(false);
    const [showEndDatePicker, setShowEndDatePicker] = useState(false);

    // Subscriptions
    useEffect(() => {
        checkAndAutoArchivePastTournaments();

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

    // Birthdays
    const birthdayEvents = useMemo(() => {
        const bEvents: Event[] = [];
        const currentYear = new Date().getFullYear();
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
                                type: 'birthday',
                            });
                        });
                    }
                } catch (e) {
                    console.error('Invalid birthdate format', member.birthDate);
                }
            }
        });
        return bEvents;
    }, [members]);

    const allEvents = useMemo(() => {
        return [...events, ...birthdayEvents].filter(e => e.type !== 'championship_season');
    }, [events, birthdayEvents]);

    const openEditModal = (event: Event) => {
        setEditingEvent(event);
        setEventTitle(event.title);
        setEventDate(event.date);
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
        setDetailModalVisible(false);
        setModalVisible(true);
    };

    const openAddModal = (date?: string) => {
        setEditingEvent(null);
        setEventTitle('');
        setEventDate(date || toLocalISOString(new Date()));
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
        setDetailModalVisible(false);
        setModalVisible(true);
    };

    const closeModal = () => {
        setModalVisible(false);
        setEditingEvent(null);
        setEventTitle('');
        setEventDate('');
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

    // Deep link editEventId handling
    useEffect(() => {
        if (initialEditEventId && events.length > 0) {
            const eventToEdit = events.find(e => e.id === initialEditEventId);
            if (eventToEdit) {
                openEditModal(eventToEdit);
                if (onEditFound) onEditFound(eventToEdit);
            }
        }
    }, [initialEditEventId, events]);

    const changeMonth = (increment: number) => {
        const newDate = new Date(currentMonth);
        newDate.setMonth(newDate.getMonth() + increment);
        setCurrentMonth(newDate);
    };

    const openDayDetail = (dateStr: string) => {
        setSelectedDate(dateStr);
        setDetailModalVisible(true);
    };

    const handleLocationChange = async (val: string) => {
        setEventLocation(val);
        if (!val || !val.trim()) return;
        const coords = await resolveLocationCoordinates(val, [...worldLocations, ...events]);
        if (coords) {
            setEventLatitude(coords.latitude);
            setEventLongitude(coords.longitude);
            setEventShowOnMap(true);
        }
    };

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
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
                console.error('Error uploading image: ', error);
                showAlert('Errore', 'Caricamento immagine fallito.');
            } finally {
                setUploading(false);
            }
        }
    };

    const handleSaveEvent = async () => {
        if (!eventTitle || !eventDate) {
            showAlert('Attenzione', 'Titolo e Data sono obbligatori.');
            return;
        }

        let finalLat = eventLatitude;
        let finalLng = eventLongitude;
        let finalShowOnMap = eventShowOnMap;

        if (eventLocation && (finalLat === undefined || finalLng === undefined)) {
            const coords = await resolveLocationCoordinates(eventLocation, [...worldLocations, ...events]);
            if (coords) {
                finalLat = coords.latitude;
                finalLng = coords.longitude;
            }
        }
        if (finalLat !== undefined && finalLng !== undefined && eventLocation) {
            finalShowOnMap = true;
        }

        if (editingEvent) {
            showConfirmation(
                'Conferma Modifica Evento',
                `Vuoi salvare le modifiche all'evento "${eventTitle}" del ${eventDate}?`,
                async () => {
                    try {
                        await updateEvent({
                            ...editingEvent,
                            title: eventTitle,
                            date: eventDate,
                            endDate: (eventEndDate || deleteField()) as any,
                            type: eventType,
                            location: (eventLocation || deleteField()) as any,
                            latitude: (finalLat || deleteField()) as any,
                            longitude: (finalLng || deleteField()) as any,
                            showOnMap: finalLat && finalLng ? finalShowOnMap : false,
                            playerFee: (eventPlayerFee || deleteField()) as any,
                            teamFee: (eventTeamFee || deleteField()) as any,
                            additionalInfo: (eventAdditionalInfo || deleteField()) as any,
                            subType: eventType === 'other' ? (eventSubType || 'raduno') : (deleteField() as any),
                            images: eventImages,
                        });
                        closeModal();
                        showAlert('Successo', 'Evento aggiornato correttamente.');
                    } catch {
                        showAlert('Errore', "Impossibile salvare l'evento.");
                    }
                },
                'Salva Modifiche'
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
                latitude: finalLat,
                longitude: finalLng,
                showOnMap: finalLat && finalLng ? finalShowOnMap : false,
                playerFee: eventPlayerFee,
                teamFee: eventTeamFee,
                additionalInfo: eventAdditionalInfo,
                subType: eventType === 'other' ? (eventSubType || 'raduno') : undefined,
                images: eventImages,
            });
            closeModal();
            showAlert('Successo', 'Nuovo evento aggiunto a calendario.');
        } catch {
            showAlert('Errore', "Impossibile salvare l'evento.");
        }
    };

    const handleDeleteEvent = async () => {
        if (editingEvent) {
            showConfirmation(
                'Elimina Evento',
                'Sei sicuro di voler eliminare questo evento?',
                async () => {
                    try {
                        await deleteEvent(editingEvent.id);
                        closeModal();
                    } catch {
                        showAlert('Errore', "Impossibile eliminare l'evento.");
                    }
                },
                'Elimina'
            );
        }
    };

    // Filter events for current month list view (excludes training/campo/palestra)
    const monthEvents = useMemo(() => {
        return allEvents.filter(e => {
            if (e.type === 'training' || e.type === 'Campo' || e.type === 'Palestra') return false;

            const start = new Date(e.date);
            const end = e.endDate ? new Date(e.endDate) : start;
            const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
            const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

            return start <= monthEnd && end >= monthStart;
        }).sort((a, b) => a.date.localeCompare(b.date));
    }, [allEvents, currentMonth]);

    return {
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
    };
}
