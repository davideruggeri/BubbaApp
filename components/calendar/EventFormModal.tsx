import React from 'react';
import {
    View,
    Text,
    Modal,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Event, WorldLocation } from '../../services/firestore';
import SearchablePicker from '../SearchablePicker';
import { calendarStyles as styles } from './calendarStyles';
import { formatDate, getTypeColor } from './calendarUtils';

interface EventFormModalProps {
    visible: boolean;
    editingEvent: Event | null;
    eventTitle: string;
    setEventTitle: (val: string) => void;
    eventDate: string;
    setEventDate: (val: string) => void;
    eventEndDate: string;
    setEventEndDate: (val: string) => void;
    eventType: Event['type'];
    setEventType: (val: Event['type']) => void;
    eventSubType: string;
    setEventSubType: (val: string) => void;
    eventLocation: string;
    onLocationChange: (val: string) => void;
    eventLatitude?: number;
    eventLongitude?: number;
    eventShowOnMap: boolean;
    setEventShowOnMap: (val: boolean) => void;
    eventPlayerFee: string;
    setEventPlayerFee: (val: string) => void;
    eventTeamFee: string;
    setEventTeamFee: (val: string) => void;
    eventAdditionalInfo: string;
    setEventAdditionalInfo: (val: string) => void;
    eventImages: string[];
    setEventImages: React.Dispatch<React.SetStateAction<string[]>>;
    uploading: boolean;
    pickImage: () => void;
    worldLocations: WorldLocation[];
    theme: any;
    onClose: () => void;
    onSave: () => void;
    onDelete: () => void;
    onOpenLocationPicker: () => void;
    onOpenStartDatePicker: () => void;
    onOpenEndDatePicker: () => void;
}

const TypeButton = ({
    type,
    label,
    selected,
    onSelect,
    theme,
}: {
    type: any;
    label: string;
    selected: string;
    onSelect: (t: any) => void;
    theme: any;
}) => (
    <TouchableOpacity
        style={[
            styles.typeButton,
            selected === type && styles.typeButtonSelected,
            { borderColor: getTypeColor(type, theme) },
        ]}
        onPress={() => onSelect(type)}
    >
        <Text
            style={[
                styles.typeButtonText,
                selected === type && styles.typeButtonTextSelected,
                { color: selected === type ? '#fff' : getTypeColor(type, theme) },
            ]}
        >
            {label}
        </Text>
    </TouchableOpacity>
);

export const EventFormModal: React.FC<EventFormModalProps> = ({
    visible,
    editingEvent,
    eventTitle,
    setEventTitle,
    eventDate,
    eventEndDate,
    setEventEndDate,
    eventType,
    setEventType,
    eventSubType,
    setEventSubType,
    eventLocation,
    onLocationChange,
    eventLatitude,
    eventLongitude,
    eventShowOnMap,
    setEventShowOnMap,
    eventPlayerFee,
    setEventPlayerFee,
    eventTeamFee,
    setEventTeamFee,
    eventAdditionalInfo,
    setEventAdditionalInfo,
    eventImages,
    setEventImages,
    uploading,
    pickImage,
    worldLocations,
    theme,
    onClose,
    onSave,
    onDelete,
    onOpenLocationPicker,
    onOpenStartDatePicker,
    onOpenEndDatePicker,
}) => {
    return (
        <Modal
            animationType="fade"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.centeredView}>
                <View style={[styles.modalView, { backgroundColor: theme.colors.card }]}>
                    <ScrollView style={{ width: '100%' }} showsVerticalScrollIndicator={false}>
                        <TextInput
                            style={[
                                styles.input,
                                {
                                    backgroundColor: theme.colors.inputBackground,
                                    color: theme.colors.text,
                                    fontSize: 18,
                                    fontWeight: 'bold',
                                    marginBottom: 15,
                                },
                            ]}
                            placeholder="Nome Evento"
                            placeholderTextColor={theme.colors.textSecondary}
                            value={eventTitle}
                            onChangeText={setEventTitle}
                        />

                        <TouchableOpacity onPress={onOpenStartDatePicker}>
                            <View style={[styles.input, { backgroundColor: theme.colors.inputBackground }]}>
                                <Text style={{ color: eventDate ? theme.colors.text : theme.colors.textSecondary }}>
                                    {eventDate ? `Data Inizio: ${formatDate(eventDate)}` : 'Seleziona Data Inizio'}
                                </Text>
                            </View>
                        </TouchableOpacity>

                        <View style={styles.dateInputRow}>
                            <TouchableOpacity onPress={onOpenEndDatePicker} style={{ flex: 1 }}>
                                <View style={[styles.input, { backgroundColor: theme.colors.inputBackground }]}>
                                    <Text
                                        style={{
                                            color: eventEndDate ? theme.colors.text : theme.colors.textSecondary,
                                        }}
                                    >
                                        {eventEndDate
                                            ? `Data Fine: ${formatDate(eventEndDate)}`
                                            : 'Seleziona Data Fine (Opzionale)'}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                            {eventEndDate ? (
                                <TouchableOpacity onPress={() => setEventEndDate('')} style={styles.clearButton}>
                                    <Image
                                        source={require('../../assets/x.png')}
                                        style={styles.clearIcon}
                                        resizeMode="contain"
                                    />
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
                                    onSelect={() => setEventType('Campo')}
                                    theme={theme}
                                />
                                <TypeButton
                                    type="match"
                                    label="Amichevole"
                                    selected={eventType}
                                    onSelect={setEventType}
                                    theme={theme}
                                />
                            </View>

                            {['training', 'Campo', 'Palestra'].includes(eventType) && (
                                <View
                                    style={{
                                        flexDirection: 'row',
                                        justifyContent: 'center',
                                        marginBottom: 15,
                                        backgroundColor: theme.colors.inputBackground,
                                        borderRadius: 10,
                                        padding: 5,
                                    }}
                                >
                                    <TouchableOpacity
                                        style={{
                                            flex: 1,
                                            paddingVertical: 8,
                                            alignItems: 'center',
                                            borderRadius: 8,
                                            backgroundColor:
                                                eventType === 'Campo' || eventType === 'training'
                                                    ? theme.colors.card
                                                    : 'transparent',
                                            shadowColor:
                                                eventType === 'Campo' || eventType === 'training' ? '#000' : 'transparent',
                                            shadowOffset: { width: 0, height: 1 },
                                            shadowOpacity: 0.1,
                                            shadowRadius: 2,
                                            elevation: eventType === 'Campo' || eventType === 'training' ? 2 : 0,
                                        }}
                                        onPress={() => setEventType('Campo')}
                                    >
                                        <Text
                                            style={{
                                                fontWeight: 'bold',
                                                color:
                                                    eventType === 'Campo' || eventType === 'training'
                                                        ? theme.colors.primary
                                                        : theme.colors.textSecondary,
                                            }}
                                        >
                                            🥏 Campo
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={{
                                            flex: 1,
                                            paddingVertical: 8,
                                            alignItems: 'center',
                                            borderRadius: 8,
                                            backgroundColor: eventType === 'Palestra' ? theme.colors.card : 'transparent',
                                            shadowColor: eventType === 'Palestra' ? '#000' : 'transparent',
                                            shadowOffset: { width: 0, height: 1 },
                                            shadowOpacity: 0.1,
                                            shadowRadius: 2,
                                            elevation: eventType === 'Palestra' ? 2 : 0,
                                        }}
                                        onPress={() => setEventType('Palestra')}
                                    >
                                        <Text
                                            style={{
                                                fontWeight: 'bold',
                                                color:
                                                    eventType === 'Palestra'
                                                        ? theme.colors.primary
                                                        : theme.colors.textSecondary,
                                            }}
                                        >
                                            🏋️ Palestra
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            <View style={styles.typeRow}>
                                <TypeButton
                                    type="championship"
                                    label="Campionato"
                                    selected={eventType}
                                    onSelect={setEventType}
                                    theme={theme}
                                />
                                <TypeButton
                                    type="tournament"
                                    label="Torneo"
                                    selected={eventType}
                                    onSelect={setEventType}
                                    theme={theme}
                                />
                            </View>
                            <View style={styles.typeRow}>
                                <TypeButton
                                    type="social"
                                    label="Riunione di squadra"
                                    selected={eventType}
                                    onSelect={setEventType}
                                    theme={theme}
                                />
                                <TypeButton
                                    type="other"
                                    label="Altro"
                                    selected={eventType}
                                    onSelect={setEventType}
                                    theme={theme}
                                />
                            </View>
                        </View>

                        {eventType === 'other' && (
                            <View style={{ width: '100%', marginTop: 15, marginBottom: 10 }}>
                                <Text style={[styles.label, { color: theme.colors.textSecondary, marginBottom: 6 }]}>
                                    Sotto-sezione:
                                </Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                                    {['Raduno', 'Stage', 'Festa'].map(preset => {
                                        const isSelected =
                                            (eventSubType || 'raduno').toLowerCase() === preset.toLowerCase();
                                        return (
                                            <TouchableOpacity
                                                key={preset}
                                                style={{
                                                    paddingHorizontal: 14,
                                                    paddingVertical: 6,
                                                    borderRadius: 16,
                                                    backgroundColor: isSelected
                                                        ? theme.colors.primary
                                                        : theme.colors.inputBackground,
                                                    borderWidth: 1,
                                                    borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                                                }}
                                                onPress={() => setEventSubType(preset.toLowerCase())}
                                            >
                                                <Text
                                                    style={{
                                                        fontSize: 13,
                                                        fontWeight: 'bold',
                                                        color: isSelected ? '#fff' : theme.colors.text,
                                                    }}
                                                >
                                                    {preset}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                                <TextInput
                                    style={[
                                        styles.input,
                                        {
                                            backgroundColor: theme.colors.inputBackground,
                                            color: theme.colors.text,
                                            marginTop: 4,
                                        },
                                    ]}
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
                                    onValueChange={onLocationChange}
                                    items={Array.from(
                                        new Set(worldLocations.map(l => l.locationName || l.title).filter(n => n))
                                    )}
                                    placeholder="Luogo (Opzionale)"
                                    title="Seleziona Luogo"
                                />
                            </View>
                            <TextInput
                                style={[
                                    styles.input,
                                    { backgroundColor: theme.colors.inputBackground, color: theme.colors.text },
                                ]}
                                placeholder="Luogo (Opzionale)"
                                placeholderTextColor={theme.colors.textSecondary}
                                value={eventLocation}
                                onChangeText={onLocationChange}
                            />
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}>
                                <TouchableOpacity
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        backgroundColor: theme.colors.primary,
                                        padding: 10,
                                        borderRadius: 8,
                                    }}
                                    onPress={onOpenLocationPicker}
                                >
                                    <Image
                                        source={require('../../assets/world.png')}
                                        style={{ width: 20, height: 20, tintColor: 'white', marginRight: 5 }}
                                    />
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
                                        name={eventShowOnMap ? 'checkbox' : 'square-outline'}
                                        size={22}
                                        color={theme.colors.primary}
                                    />
                                    <Text
                                        style={{
                                            marginLeft: 8,
                                            color: theme.colors.text,
                                            fontWeight: '500',
                                            fontSize: 14,
                                        }}
                                    >
                                        Mostra su BubbaWorld
                                    </Text>
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity
                                style={[
                                    styles.imageButton,
                                    {
                                        borderColor: theme.colors.primary,
                                        borderWidth: 1,
                                        padding: 10,
                                        borderRadius: 8,
                                        alignItems: 'center',
                                        marginBottom: 10,
                                    },
                                ]}
                                onPress={pickImage}
                                disabled={uploading}
                            >
                                <Text style={{ color: theme.colors.primary }}>
                                    {uploading ? 'Caricamento...' : '+ Aggiungi Foto'}
                                </Text>
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
                                                borderColor: '#ccc',
                                            }}
                                            onPress={() => {
                                                setEventImages(prev => prev.filter((_, i) => i !== index));
                                            }}
                                        >
                                            <Image
                                                source={require('../../assets/x.png')}
                                                style={{ width: 10, height: 10 }}
                                                resizeMode="contain"
                                            />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </ScrollView>

                            {eventType === 'tournament' && (
                                <>
                                    <TextInput
                                        style={[
                                            styles.input,
                                            { backgroundColor: theme.colors.inputBackground, color: theme.colors.text },
                                        ]}
                                        placeholder="Player Fee (es. 20€)"
                                        placeholderTextColor={theme.colors.textSecondary}
                                        value={eventPlayerFee}
                                        onChangeText={setEventPlayerFee}
                                    />
                                    <TextInput
                                        style={[
                                            styles.input,
                                            { backgroundColor: theme.colors.inputBackground, color: theme.colors.text },
                                        ]}
                                        placeholder="Team Fee (es. 100€)"
                                        placeholderTextColor={theme.colors.textSecondary}
                                        value={eventTeamFee}
                                        onChangeText={setEventTeamFee}
                                    />
                                </>
                            )}
                            <TextInput
                                style={[
                                    styles.input,
                                    {
                                        backgroundColor: theme.colors.inputBackground,
                                        color: theme.colors.text,
                                        height: 80,
                                        textAlignVertical: 'top',
                                    },
                                ]}
                                placeholder="Info Aggiuntive"
                                placeholderTextColor={theme.colors.textSecondary}
                                value={eventAdditionalInfo}
                                onChangeText={setEventAdditionalInfo}
                                multiline={true}
                            />
                        </View>

                        <TouchableOpacity
                            style={[styles.saveButton, { backgroundColor: theme.colors.primary }]}
                            onPress={onSave}
                        >
                            <Text style={styles.textStyle}>Salva</Text>
                        </TouchableOpacity>

                        {editingEvent && (
                            <TouchableOpacity style={styles.deleteButton} onPress={onDelete}>
                                <Text style={styles.textStyle}>Elimina</Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity
                            style={[styles.closeButton, { backgroundColor: theme.colors.inputBackground }]}
                            onPress={onClose}
                        >
                            <Text style={[styles.closeButtonText, { color: theme.colors.textSecondary }]}>
                                Annulla
                            </Text>
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};
