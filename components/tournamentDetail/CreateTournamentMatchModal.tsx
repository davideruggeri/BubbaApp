// components/tournamentDetail/CreateTournamentMatchModal.tsx
// Modal semplificato per creare una nuova partita all'interno di un torneo

import React, { useState, useEffect } from 'react';
import { View, Text, Modal, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { MatchRosterPlayer } from '../../services/firestore/types';
import { tournamentDetailStyles as styles } from './tournamentDetailStyles';
import { formatTournamentDay } from '../../screens/AnalisiPartitaScreen';
import { useTheme } from '../../context/ThemeContext';

interface Props {
    visible: boolean;
    tournamentName: string;
    tournamentDays: string[];
    surface: 'sabbia' | 'erba';
    latestRoster: MatchRosterPlayer[];
    onClose: () => void;
    onCreate: (data: {
        opponent: string;
        date: string;
        firstRatio: 'M' | 'F';
        pullFirst: 'us' | 'them';
        dir0: 'R' | 'L';
        customRoster: MatchRosterPlayer[];
    }) => Promise<void>;
}

const formatDateLabel = (d: string) => {
    if (!d) return '';
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
};

const SegRow = ({ label, options, value, onChange, theme }: {
    label: string;
    options: { key: string; label: string }[];
    value: string;
    onChange: (v: any) => void;
    theme: any;
}) => (
    <View style={{ marginBottom: 14 }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.textSecondary, marginBottom: 6, textTransform: 'uppercase' }}>
            {label}
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
            {options.map(opt => {
                const active = value === opt.key;
                return (
                    <TouchableOpacity
                        key={opt.key}
                        style={{
                            flex: 1,
                            paddingVertical: 10,
                            borderRadius: 9,
                            alignItems: 'center',
                            backgroundColor: active ? '#003057' : (theme.dark ? '#1E293B' : '#F1F5F9'),
                            borderWidth: 1.5,
                            borderColor: active ? '#003057' : theme.colors.border,
                        }}
                        onPress={() => onChange(opt.key)}
                        activeOpacity={0.8}
                    >
                        <Text style={{ fontSize: 13, fontWeight: '700', color: active ? '#fff' : theme.colors.text }}>
                            {opt.label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    </View>
);

export const CreateTournamentMatchModal: React.FC<Props> = ({
    visible,
    tournamentName,
    tournamentDays,
    surface,
    latestRoster,
    onClose,
    onCreate,
}) => {
    const { theme } = useTheme();
    const [opponent, setOpponent] = useState('');
    const [date, setDate] = useState(tournamentDays[0] || new Date().toISOString().split('T')[0]);
    const [firstRatio, setFirstRatio] = useState<'M' | 'F'>('M');
    const [pullFirst, setPullFirst] = useState<'us' | 'them'>('them');
    const [dir0, setDir0] = useState<'R' | 'L'>('R');
    const [saving, setSaving] = useState(false);

    // Quando cambia il torneo (nuova apertura), resetta la data al primo giorno disponibile
    useEffect(() => {
        if (visible && tournamentDays.length > 0) {
            setDate(tournamentDays[0]);
        }
    }, [visible, tournamentDays]);

    const handleCreate = async () => {
        if (!opponent.trim()) return;
        setSaving(true);
        try {
            await onCreate({
                opponent: opponent.trim(),
                date,
                firstRatio,
                pullFirst,
                dir0,
                customRoster: latestRoster,
            });
            setOpponent('');
            onClose();
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, maxHeight: '90%' }]}>
                        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                                ➕ Nuova Partita — {tournamentName}
                            </Text>

                            {/* Avversario */}
                            <View style={{ marginBottom: 14 }}>
                                <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.textSecondary, marginBottom: 6, textTransform: 'uppercase' }}>
                                    Avversario
                                </Text>
                                <TextInput
                                    style={{
                                        borderWidth: 1.5,
                                        borderColor: theme.colors.border,
                                        borderRadius: 9,
                                        padding: 10,
                                        fontSize: 14,
                                        color: theme.colors.text,
                                        backgroundColor: theme.dark ? '#1E293B' : '#F8FAFC',
                                    }}
                                    placeholder="Nome squadra avversaria"
                                    placeholderTextColor={theme.colors.textSecondary}
                                    value={opponent}
                                    onChangeText={setOpponent}
                                    autoCapitalize="words"
                                    returnKeyType="done"
                                />
                            </View>

                            {/* Data / Giorno del torneo */}
                            <View style={{ marginBottom: 14 }}>
                                <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.textSecondary, marginBottom: 6, textTransform: 'uppercase' }}>
                                    Giorno del torneo
                                </Text>
                                {tournamentDays.length > 0 ? (
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                        {tournamentDays.map((d, idx) => {
                                            const active = date === d;
                                            return (
                                                <TouchableOpacity
                                                    key={d}
                                                    style={[
                                                        styles.dayChipBtn,
                                                        { borderColor: active ? '#003057' : theme.colors.border },
                                                        active && { backgroundColor: '#003057' },
                                                    ]}
                                                    onPress={() => setDate(d)}
                                                    activeOpacity={0.8}
                                                >
                                                    <Text style={[styles.dayChipNum, { color: active ? '#C0D725' : theme.colors.textSecondary }]}>
                                                        Giorno {idx + 1}
                                                    </Text>
                                                    <Text style={[styles.dayChipDate, { color: active ? '#fff' : theme.colors.text }]}>
                                                        {formatTournamentDay(d)}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                ) : (
                                    <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>
                                        Data: {formatDateLabel(date)} · (nessuna data a calendario, collega prima il torneo)
                                    </Text>
                                )}
                            </View>

                            {/* Superficie (solo informativa, pre-impostata) */}
                            <View style={{ marginBottom: 14, padding: 10, borderRadius: 9, backgroundColor: theme.dark ? '#1E293B' : '#F1F5F9', borderWidth: 1, borderColor: theme.colors.border }}>
                                <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>
                                    🏟️ Superficie: <Text style={{ fontWeight: '700', color: theme.colors.text }}>
                                        {surface === 'sabbia' ? '🏖️ Sabbia (target 13)' : '🌱 Erba (target 15)'}
                                    </Text>
                                </Text>
                            </View>

                            {/* Ratio M/F */}
                            <SegRow
                                label="Prima ratio"
                                options={[
                                    { key: 'M', label: '3M / 2F' },
                                    { key: 'F', label: '3F / 2M' },
                                ]}
                                value={firstRatio}
                                onChange={setFirstRatio}
                                theme={theme}
                            />

                            {/* Chi tira il pull */}
                            <SegRow
                                label="Chi tira il pull?"
                                options={[
                                    { key: 'them', label: '⚔️ Loro (noi attacchiamo)' },
                                    { key: 'us', label: '🛡 Noi (noi difendiamo)' },
                                ]}
                                value={pullFirst}
                                onChange={setPullFirst}
                                theme={theme}
                            />

                            {/* Direzione attacco */}
                            <SegRow
                                label="Direzione attacco primo punto"
                                options={[
                                    { key: 'R', label: '▶ Destra' },
                                    { key: 'L', label: '◀ Sinistra' },
                                ]}
                                value={dir0}
                                onChange={setDir0}
                                theme={theme}
                            />

                            {/* Roster info */}
                            <View style={{ padding: 10, borderRadius: 9, backgroundColor: theme.dark ? '#0F172A' : '#EFF6FF', borderWidth: 1, borderColor: '#93C5FD', marginBottom: 16 }}>
                                <Text style={{ fontSize: 12, color: theme.dark ? '#93C5FD' : '#1D4ED8', fontWeight: '600' }}>
                                    👥 Roster: {latestRoster.length > 0
                                        ? `${latestRoster.length} giocatori copiati dall'ultima partita del torneo`
                                        : 'Nessuna partita precedente — potrai aggiungere giocatori dopo'}
                                </Text>
                            </View>

                            {/* Azioni */}
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                <TouchableOpacity
                                    style={[styles.modalCancelBtn, { borderColor: theme.colors.border, flex: 1, justifyContent: 'center', alignItems: 'center' }]}
                                    onPress={onClose}
                                    disabled={saving}
                                >
                                    <Text style={{ color: theme.colors.text, fontWeight: '600' }}>Annulla</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={{
                                        flex: 2,
                                        backgroundColor: opponent.trim() ? '#003057' : '#94A3B8',
                                        paddingVertical: 12,
                                        borderRadius: 9,
                                        alignItems: 'center',
                                    }}
                                    onPress={handleCreate}
                                    disabled={!opponent.trim() || saving}
                                    activeOpacity={0.8}
                                >
                                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>
                                        {saving ? 'Creazione...' : '✅ Crea Partita'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};
