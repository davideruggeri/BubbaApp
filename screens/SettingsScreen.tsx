import React, { useState } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, Modal, TextInput, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import ScreenTitle from '../components/ScreenTitle';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useEasterEggs } from '../context/EasterEggContext';
import { useSeason } from '../context/SeasonContext';
import { isChristmasPeriod } from '../utils/date';
import { recalculateAllAttendanceCounts, chiudiStagione, eseguiMigrazioneStagioni, generateBubbaWrapped, generateSeasonTrainings, RecurringDayConfig } from '../services/firestore';
import DatePickerModal from '../components/DatePickerModal';
import { showAlert, showConfirmation } from '../utils/alert';

export default function SettingsScreen() {
    const navigation = useNavigation<any>();
    const { theme, toggleTheme, isDark, isChristmasEnabled, toggleChristmasTheme } = useTheme();
    const { foundEggs } = useEasterEggs();
    const { userProfile, isGlobalAdmin } = useAuth();
    const { stagioneCorrente } = useSeason();

    // Season Close Modal State
    const [modalCloseVisible, setModalCloseVisible] = useState(false);
    const [newSeasonInput, setNewSeasonInput] = useState('');
    const [isClosingSeason, setIsClosingSeason] = useState(false);
    const [isMigrating, setIsMigrating] = useState(false);
    const [isGeneratingWrapped, setIsGeneratingWrapped] = useState(false);

    // Season Trainings Planning State
    interface DayPlan {
        dayOfWeek: number; // 0=Dom, 1=Lun, 2=Mar, 3=Mer, 4=Gio, 5=Ven, 6=Sab
        name: string;
        shortName: string;
        active: boolean;
        type: 'Campo' | 'Palestra';
    }

    const DEFAULT_DAYS: DayPlan[] = [
        { dayOfWeek: 1, name: 'Lunedì', shortName: 'Lun', active: true, type: 'Campo' },
        { dayOfWeek: 2, name: 'Martedì', shortName: 'Mar', active: false, type: 'Palestra' },
        { dayOfWeek: 3, name: 'Mercoledì', shortName: 'Mer', active: true, type: 'Palestra' },
        { dayOfWeek: 4, name: 'Giovedì', shortName: 'Gio', active: false, type: 'Campo' },
        { dayOfWeek: 5, name: 'Venerdì', shortName: 'Ven', active: false, type: 'Campo' },
        { dayOfWeek: 6, name: 'Sabato', shortName: 'Sab', active: false, type: 'Campo' },
        { dayOfWeek: 0, name: 'Domenica', shortName: 'Dom', active: false, type: 'Campo' },
    ];

    const [modalTrainingsVisible, setModalTrainingsVisible] = useState(false);
    const [trainingsStartDate, setTrainingsStartDate] = useState('');
    const [trainingsEndDate, setTrainingsEndDate] = useState('');
    const [showStartDatePicker, setShowStartDatePicker] = useState(false);
    const [showEndDatePicker, setShowEndDatePicker] = useState(false);
    const [daysConfig, setDaysConfig] = useState<DayPlan[]>(DEFAULT_DAYS);
    const [trainingTime, setTrainingTime] = useState('');
    const [trainingLocation, setTrainingLocation] = useState('');
    const [isGeneratingTrainings, setIsGeneratingTrainings] = useState(false);

    const formatDisplayDate = (dateString: string) => {
        if (!dateString) return '';
        const parts = dateString.split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        return dateString;
    };

    const openTrainingsModal = () => {
        const today = new Date();
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, '0');
        const d = String(today.getDate()).padStart(2, '0');
        setTrainingsStartDate(`${y}-${m}-${d}`);

        let endY = y;
        if (stagioneCorrente && stagioneCorrente.includes('-')) {
            const parts = stagioneCorrente.split('-');
            const parsedY = parseInt(parts[1], 10);
            if (!isNaN(parsedY)) {
                endY = parsedY;
            }
        } else if (today.getMonth() >= 7) {
            endY = y + 1;
        }
        setTrainingsEndDate(`${endY}-06-30`);
        setModalTrainingsVisible(true);
    };

    const toggleDayActive = (dayOfWeek: number) => {
        setDaysConfig(prev => prev.map(d => d.dayOfWeek === dayOfWeek ? { ...d, active: !d.active } : d));
    };

    const setDayType = (dayOfWeek: number, type: 'Campo' | 'Palestra') => {
        setDaysConfig(prev => prev.map(d => d.dayOfWeek === dayOfWeek ? { ...d, type } : d));
    };

    const computeTrainingsPreview = () => {
        if (!trainingsStartDate || !trainingsEndDate) return { total: 0, campo: 0, palestra: 0 };
        const start = new Date(trainingsStartDate + 'T00:00:00');
        const end = new Date(trainingsEndDate + 'T23:59:59');
        if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
            return { total: 0, campo: 0, palestra: 0 };
        }

        const activeMap = new Map<number, 'Campo' | 'Palestra'>();
        daysConfig.filter(d => d.active).forEach(d => activeMap.set(d.dayOfWeek, d.type));

        let total = 0;
        let campo = 0;
        let palestra = 0;
        let cur = new Date(start);

        while (cur <= end) {
            const dow = cur.getDay();
            if (activeMap.has(dow)) {
                total++;
                if (activeMap.get(dow) === 'Campo') campo++;
                else palestra++;
            }
            cur.setDate(cur.getDate() + 1);
        }

        return { total, campo, palestra };
    };

    const handleConfirmGenerateTrainings = () => {
        const preview = computeTrainingsPreview();
        if (preview.total === 0) {
            showAlert("Attenzione", "Nessun allenamento da inserire nel periodo selezionato. Controlla le date e seleziona almeno un giorno attivo.");
            return;
        }

        showConfirmation(
            "Conferma Generazione Allenamenti",
            `Verranno generati ${preview.total} allenamenti a calendario (${preview.campo} in Campo 🥏, ${preview.palestra} in Palestra 🏋️) dal ${trainingsStartDate} al ${trainingsEndDate}.\n\nVuoi procedere?`,
            async () => {
                setIsGeneratingTrainings(true);
                try {
                    const activeConfigs: RecurringDayConfig[] = daysConfig
                        .filter(d => d.active)
                        .map(d => ({
                            dayOfWeek: d.dayOfWeek,
                            type: d.type,
                            time: trainingTime.trim() || undefined,
                            location: trainingLocation.trim() || undefined,
                        }));

                    const result = await generateSeasonTrainings({
                        startDate: trainingsStartDate.trim(),
                        endDate: trainingsEndDate.trim(),
                        daysConfig: activeConfigs,
                        overwriteExisting: true,
                    });

                    setIsGeneratingTrainings(false);
                    setModalTrainingsVisible(false);
                    showAlert(
                        "Calendario Aggiornato 🎉",
                        `Pianificati con successo ${result.totalCreated} allenamenti a calendario per la stagione!`
                    );
                } catch (err: any) {
                    setIsGeneratingTrainings(false);
                    showAlert("Errore", "Impossibile generare gli allenamenti: " + (err?.message || "Errore sconosciuto"));
                }
            },
            "Sì, Genera"
        );
    };

    const computeNextSeason = (current: string) => {
        const parts = current.split('-');
        if (parts.length === 2) {
            const y1 = parseInt(parts[0], 10);
            const y2 = parseInt(parts[1], 10);
            if (!isNaN(y1) && !isNaN(y2)) {
                return `${y1 + 1}-${y2 + 1}`;
            }
        }
        const nextYear = new Date().getFullYear() + 1;
        return `${nextYear}-${nextYear + 1}`;
    };

    const openCloseSeasonModal = () => {
        setNewSeasonInput(computeNextSeason(stagioneCorrente));
        setModalCloseVisible(true);
    };

    const handleConfirmCloseSeason = () => {
        const targetSeason = newSeasonInput.trim();
        if (!targetSeason) {
            showAlert("Errore", "Inserisci la label per la nuova stagione.");
            return;
        }

        // Double confirmation
        showConfirmation(
            "Conferma Definitiva",
            `Sei assolutamente sicuro di voler chiudere la stagione "${stagioneCorrente}" e avviare la stagione "${targetSeason}"?\n\nLe presenze attuali verranno archiviate nello storico e i contatori ripartiranno da zero. I dati grezzi rimarranno intatti.`,
            async () => {
                setIsClosingSeason(true);
                try {
                    await chiudiStagione(targetSeason);
                    setIsClosingSeason(false);
                    setModalCloseVisible(false);
                    showAlert("Stagione Chiusa", `La stagione ${stagioneCorrente} è stata archiviata con successo. Nuova stagione attiva: ${targetSeason}.`);
                } catch (error) {
                    setIsClosingSeason(false);
                    showAlert("Errore", "Si è verificato un errore durante la chiusura della stagione.");
                }
            },
            "Sì, Chiudi Stagione"
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={styles.header}>
                <ScreenTitle title="IMPOSTAZIONI" onBack={() => navigation.goBack()} style={{ marginBottom: 0 }} />
            </View>

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: 40 }}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.content}>
                    {/* Current Season Info Card */}
                    <View style={[styles.seasonCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                        <View style={styles.seasonInfoRow}>
                            <View>
                                <Text style={[styles.seasonBadgeLabel, { color: theme.colors.textSecondary }]}>Stagione Corrente</Text>
                                <Text style={[styles.seasonValue, { color: theme.colors.primary }]}>{stagioneCorrente}</Text>
                            </View>
                            <TouchableOpacity
                                style={[styles.historyLinkBtn, { backgroundColor: theme.colors.primary + '20' }]}
                                onPress={() => navigation.navigate('PresenzeHistory')}
                            >
                                <Text style={[styles.historyLinkText, { color: theme.colors.primary }]}>📜 Storico</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Preferenze App */}
                    <View style={styles.section}>
                        <Text style={[styles.sectionHeader, { color: theme.colors.primary }]}>
                            PREFERENZE APP
                        </Text>
                        <View style={[styles.cardGroup, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                            <View style={[styles.settingRowInner, { borderBottomColor: theme.colors.border }]}>
                                <View style={styles.settingTextCol}>
                                    <Text style={[styles.settingLabel, { color: theme.colors.text }]}>🌙 Modalità Notte</Text>
                                    <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
                                        Attiva il tema scuro per l'applicazione
                                    </Text>
                                </View>
                                <Switch
                                    trackColor={{ false: "#767577", true: theme.colors.primary }}
                                    thumbColor={isDark ? "#fff" : "#f4f3f4"}
                                    ios_backgroundColor="#3e3e3e"
                                    onValueChange={toggleTheme}
                                    value={isDark}
                                />
                            </View>

                            <View style={styles.settingRowInner}>
                                <View style={styles.settingTextCol}>
                                    <Text style={[styles.settingLabel, { color: theme.colors.text }]}>🎄 Tema Natalizio</Text>
                                    <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
                                        {isChristmasPeriod()
                                            ? "Abilita gli effetti natalizi (Neve e Cappello)"
                                            : "Disponibile da 1 dicembre a 6 gennaio"}
                                    </Text>
                                </View>
                                <Switch
                                    trackColor={{ false: "#767577", true: theme.colors.primary }}
                                    thumbColor={isChristmasEnabled ? "#fff" : "#f4f3f4"}
                                    ios_backgroundColor="#3e3e3e"
                                    onValueChange={toggleChristmasTheme}
                                    value={isChristmasEnabled}
                                    disabled={!isChristmasPeriod()}
                                    style={!isChristmasPeriod() ? { opacity: 0.5 } : {}}
                                />
                            </View>
                        </View>
                    </View>

                    {/* Sezioni Amministrazione */}
                    {isGlobalAdmin && (
                        <>
                            {/* Gestione Ordinaria Stagione */}
                            <View style={styles.section}>
                                <Text style={[styles.sectionHeader, { color: theme.colors.primary }]}>
                                    GESTIONE STAGIONE (ORDINARIA)
                                </Text>

                                {/* Pianifica Allenamenti Card */}
                                <TouchableOpacity
                                    style={[styles.actionCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                                    onPress={openTrainingsModal}
                                    activeOpacity={0.7}
                                >
                                    <View style={[styles.actionIconBadge, { backgroundColor: '#0284C7' + '20' }]}>
                                        <Text style={{ fontSize: 22 }}>📅</Text>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.actionCardTitle, { color: theme.colors.text }]}>
                                            Pianifica Allenamenti
                                        </Text>
                                        <Text style={[styles.actionCardDesc, { color: theme.colors.textSecondary }]}>
                                            Genera in blocco le sessioni a calendario per la stagione
                                        </Text>
                                    </View>
                                    <Text style={[styles.actionCardChevron, { color: theme.colors.textSecondary }]}>›</Text>
                                </TouchableOpacity>

                                {/* Ricalcola Presenze Card */}
                                <TouchableOpacity
                                    style={[styles.actionCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                                    onPress={async () => {
                                        try {
                                            await recalculateAllAttendanceCounts(stagioneCorrente);
                                            showAlert("Successo", `Conteggi presenze per la stagione ${stagioneCorrente} ricalcolati con successo!`);
                                        } catch (error) {
                                            showAlert("Errore", "Impossibile ricalcolare i conteggi.");
                                        }
                                    }}
                                    activeOpacity={0.7}
                                >
                                    <View style={[styles.actionIconBadge, { backgroundColor: theme.colors.primary + '20' }]}>
                                        <Text style={{ fontSize: 22 }}>🔄</Text>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.actionCardTitle, { color: theme.colors.text }]}>
                                            Ricalcola Presenze
                                        </Text>
                                        <Text style={[styles.actionCardDesc, { color: theme.colors.textSecondary }]}>
                                            Riallinea i contatori e le statistiche per {stagioneCorrente}
                                        </Text>
                                    </View>
                                    <Text style={[styles.actionCardChevron, { color: theme.colors.textSecondary }]}>›</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Operazioni Annuali: 1 volta l'anno */}
                            <View style={styles.section}>
                                <View style={styles.annualHeaderRow}>
                                    <Text style={[styles.sectionHeader, { color: '#E65100', marginBottom: 0 }]}>
                                        OPERAZIONI ANNUALI (FINE STAGIONE)
                                    </Text>
                                    <View style={styles.annualPill}>
                                        <Text style={styles.annualPillText}>1 VOLTA L'ANNO</Text>
                                    </View>
                                </View>
                                <Text style={[styles.sectionSubHeader, { color: theme.colors.textSecondary }]}>
                                    Azioni da eseguire al termine del campionato per archiviare o creare il recap
                                </Text>

                                {/* Genera Wrapped Card */}
                                <TouchableOpacity
                                    style={[styles.actionCard, { backgroundColor: theme.colors.card, borderColor: '#7928CA' + '40' }]}
                                    disabled={isGeneratingWrapped}
                                    onPress={() => {
                                        showConfirmation(
                                            "Genera Bubba Wrapped",
                                            `Vuoi generare o rigenerare il Bubba Wrapped per la stagione 2025-2026? Tutti i membri avranno a disposizione le storie riepilogative.`,
                                            async () => {
                                                setIsGeneratingWrapped(true);
                                                try {
                                                    const res = await generateBubbaWrapped('2025-2026');
                                                    setIsGeneratingWrapped(false);
                                                    showAlert("Bubba Wrapped Pronto 🎉", `Recap 2025-2026 generato con successo per ${res.membersCount} membri!\nAllenamenti: ${res.team.allenamentiTotali} • Km percorsi: ${res.team.kmTotaliPercorsi}`);
                                                } catch (e) {
                                                    setIsGeneratingWrapped(false);
                                                    showAlert("Errore", "Impossibile generare il Bubba Wrapped.");
                                                }
                                            },
                                            "Genera Wrapped"
                                        );
                                    }}
                                    activeOpacity={0.7}
                                >
                                    <View style={[styles.actionIconBadge, { backgroundColor: '#7928CA' + '20' }]}>
                                        {isGeneratingWrapped ? (
                                            <ActivityIndicator size="small" color="#7928CA" />
                                        ) : (
                                            <Text style={{ fontSize: 22 }}>🎁</Text>
                                        )}
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.actionCardTitle, { color: theme.colors.text }]}>
                                            Genera Bubba Wrapped
                                        </Text>
                                        <Text style={[styles.actionCardDesc, { color: theme.colors.textSecondary }]}>
                                            Crea le storie e statistiche di riepilogo annuale per la squadra
                                        </Text>
                                    </View>
                                    <Text style={[styles.actionCardChevron, { color: '#7928CA' }]}>›</Text>
                                </TouchableOpacity>

                                {/* Chiudi Stagione Card */}
                                <TouchableOpacity
                                    style={[styles.actionCard, { backgroundColor: theme.colors.card, borderColor: (theme.colors.warning || '#E65100') + '40' }]}
                                    onPress={openCloseSeasonModal}
                                    activeOpacity={0.7}
                                >
                                    <View style={[styles.actionIconBadge, { backgroundColor: (theme.colors.warning || '#E65100') + '20' }]}>
                                        <Text style={{ fontSize: 22 }}>🏁</Text>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.actionCardTitle, { color: theme.colors.text }]}>
                                            Archivia e Chiudi Stagione
                                        </Text>
                                        <Text style={[styles.actionCardDesc, { color: theme.colors.textSecondary }]}>
                                            Salva lo storico delle presenze e avvia la nuova annata sportiva
                                        </Text>
                                    </View>
                                    <Text style={[styles.actionCardChevron, { color: theme.colors.warning || '#E65100' }]}>›</Text>
                                </TouchableOpacity>

                                {/* Migra Dati Storici Button (Compatto) */}
                                <TouchableOpacity
                                    style={[styles.compactAdminBtn, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                                    disabled={isMigrating}
                                    onPress={() => {
                                        showConfirmation(
                                            "Migrazione Dati Storici",
                                            "Vuoi avviare la migrazione una tantum per assegnare il campo 'stagione' ai documenti storici esistenti in presenze, calendario e match_analysis?",
                                            async () => {
                                                setIsMigrating(true);
                                                try {
                                                    const res = await eseguiMigrazioneStagioni();
                                                    setIsMigrating(false);
                                                    showAlert("Migrazione Completata", `Aggiornati:\n- Presenze: ${res.presenze}\n- Calendario: ${res.calendario}\n- Partite: ${res.matchAnalysis}\n\nStagione Corrente: ${res.stagioneCorrente}`);
                                                } catch (e) {
                                                    setIsMigrating(false);
                                                    showAlert("Errore", "Errore durante la migrazione dei dati.");
                                                }
                                            },
                                            "Avvia Migrazione"
                                        );
                                    }}
                                    activeOpacity={0.7}
                                >
                                    <Text style={{ fontSize: 16, marginRight: 8 }}>📦</Text>
                                    <Text style={[styles.compactAdminBtnText, { color: theme.colors.textSecondary }]}>
                                        {isMigrating ? "Migrazione in corso..." : "Migra Dati Storici (Una Tantum)"}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </>
                    )}

                    {/* Easter Egg Section - Only visible if at least one found */}
                    {foundEggs.length > 0 && (
                        <View style={[styles.section, { marginTop: 10 }]}>
                            <Text style={[styles.sectionHeader, { color: theme.colors.primary }]}>
                                COLLEZIONE EASTER EGGS ({foundEggs.length}/5)
                            </Text>
                            <View style={[styles.eggList, { backgroundColor: theme.colors.card }]}>
                                {foundEggs.map((egg) => (
                                    <View key={egg.id} style={styles.eggItem}>
                                        <View style={styles.eggHeader}>
                                            <Text style={[styles.eggName, { color: theme.colors.text }]}>
                                                ✅ {egg.name}
                                            </Text>
                                            <Text style={[styles.eggDate, { color: theme.colors.textSecondary }]}>
                                                {egg.dateFound}
                                            </Text>
                                        </View>
                                        <Text style={[styles.eggDesc, { color: theme.colors.textSecondary }]}>
                                            {egg.description}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}
                </View>
            </ScrollView>

            {/* Chiudi Stagione Modal */}
            <Modal
                visible={modalCloseVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => !isClosingSeason && setModalCloseVisible(false)}
            >
                <View style={styles.modalBackdrop}>
                    <View style={[styles.modalCard, { backgroundColor: theme.colors.card }]}>
                        <Text style={[styles.modalTitleText, { color: theme.colors.text }]}>
                            🏁 Chiudi Stagione {stagioneCorrente}
                        </Text>

                        <Text style={[styles.modalWarningText, { color: theme.colors.textSecondary }]}>
                            Questa operazione calcolerà le statistiche aggregate (totali, percentuali e streak) e le salverà nell'archivio storico delle stagioni.
                            I contatori della nuova stagione ripartiranno da zero, ma nessun dato grezzo verrà eliminato.
                        </Text>

                        <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
                            Nome nuova stagione:
                        </Text>
                        <TextInput
                            style={[styles.textInput, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
                            value={newSeasonInput}
                            onChangeText={setNewSeasonInput}
                            placeholder="es. 2026-2027"
                            placeholderTextColor={theme.colors.textSecondary}
                            editable={!isClosingSeason}
                        />

                        {isClosingSeason ? (
                            <View style={{ paddingVertical: 15, alignItems: 'center' }}>
                                <ActivityIndicator size="large" color={theme.colors.primary} />
                                <Text style={{ color: theme.colors.textSecondary, marginTop: 8 }}>
                                    Archiviazione in corso...
                                </Text>
                            </View>
                        ) : (
                            <View style={styles.modalButtonsRow}>
                                <TouchableOpacity
                                    style={[styles.modalActionBtn, { backgroundColor: theme.colors.border }]}
                                    onPress={() => setModalCloseVisible(false)}
                                >
                                    <Text style={[styles.modalActionBtnText, { color: theme.colors.text }]}>Annulla</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.modalActionBtn, { backgroundColor: theme.colors.warning || '#E65100' }]}
                                    onPress={handleConfirmCloseSeason}
                                >
                                    <Text style={[styles.modalActionBtnText, { color: '#fff' }]}>Procedi</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>

            {/* Pianifica Allenamenti Modal */}
            <Modal
                visible={modalTrainingsVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => !isGeneratingTrainings && setModalTrainingsVisible(false)}
            >
                <View style={styles.modalBackdrop}>
                    <View style={[styles.modalCard, { backgroundColor: theme.colors.card, maxHeight: '90%' }]}>
                        <Text style={[styles.modalTitleText, { color: theme.colors.text }]}>
                            📅 Pianifica Allenamenti Stagionali
                        </Text>

                        <ScrollView showsVerticalScrollIndicator={false} style={{ width: '100%' }}>
                            <Text style={[styles.modalWarningText, { color: theme.colors.textSecondary, marginBottom: 12 }]}>
                                Inserisci automaticamente gli allenamenti nel calendario per tutta la stagione selezionando i giorni della settimana e la tipologia (Campo o Palestra).
                            </Text>

                            {/* Date range pickers */}
                            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Data Inizio:</Text>
                                    <TouchableOpacity
                                        style={[styles.datePickerBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
                                        onPress={() => !isGeneratingTrainings && setShowStartDatePicker(true)}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={{ color: trainingsStartDate ? theme.colors.text : theme.colors.textSecondary, fontSize: 14, fontWeight: '600' }}>
                                            📅 {formatDisplayDate(trainingsStartDate) || 'Seleziona data'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Data Fine:</Text>
                                    <TouchableOpacity
                                        style={[styles.datePickerBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
                                        onPress={() => !isGeneratingTrainings && setShowEndDatePicker(true)}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={{ color: trainingsEndDate ? theme.colors.text : theme.colors.textSecondary, fontSize: 14, fontWeight: '600' }}>
                                            📅 {formatDisplayDate(trainingsEndDate) || 'Seleziona data'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Giorni della settimana */}
                            <Text style={[styles.inputLabel, { color: theme.colors.text, marginTop: 4, marginBottom: 8 }]}>
                                Giorni della settimana:
                            </Text>
                            <View style={{ gap: 8, marginBottom: 14 }}>
                                {daysConfig.map((item) => (
                                    <View
                                        key={item.dayOfWeek}
                                        style={[
                                            styles.dayPlanRow,
                                            {
                                                borderColor: item.active ? theme.colors.primary : theme.colors.border,
                                                backgroundColor: item.active ? (theme.colors.primary + '10') : theme.colors.background,
                                            }
                                        ]}
                                    >
                                        <TouchableOpacity
                                            style={styles.dayPlanToggle}
                                            onPress={() => !isGeneratingTrainings && toggleDayActive(item.dayOfWeek)}
                                            activeOpacity={0.7}
                                        >
                                            <View style={[
                                                styles.dayPlanCheckbox,
                                                {
                                                    backgroundColor: item.active ? theme.colors.primary : 'transparent',
                                                    borderColor: item.active ? theme.colors.primary : theme.colors.border,
                                                }
                                            ]}>
                                                {item.active && <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>✓</Text>}
                                            </View>
                                            <Text style={[
                                                styles.dayPlanName,
                                                { color: item.active ? theme.colors.text : theme.colors.textSecondary, fontWeight: item.active ? '700' : '500' }
                                            ]}>
                                                {item.name}
                                            </Text>
                                        </TouchableOpacity>

                                        {item.active && (
                                            <View style={styles.venueToggleGroup}>
                                                <TouchableOpacity
                                                    style={[
                                                        styles.venueBtn,
                                                        item.type === 'Campo' && { backgroundColor: theme.colors.primary }
                                                    ]}
                                                    onPress={() => !isGeneratingTrainings && setDayType(item.dayOfWeek, 'Campo')}
                                                >
                                                    <Text style={[
                                                        styles.venueBtnText,
                                                        { color: item.type === 'Campo' ? '#fff' : theme.colors.textSecondary }
                                                    ]}>
                                                        🥏 Campo
                                                    </Text>
                                                </TouchableOpacity>

                                                <TouchableOpacity
                                                    style={[
                                                        styles.venueBtn,
                                                        item.type === 'Palestra' && { backgroundColor: '#8B5CF6' }
                                                    ]}
                                                    onPress={() => !isGeneratingTrainings && setDayType(item.dayOfWeek, 'Palestra')}
                                                >
                                                    <Text style={[
                                                        styles.venueBtnText,
                                                        { color: item.type === 'Palestra' ? '#fff' : theme.colors.textSecondary }
                                                    ]}>
                                                        🏋️ Palestra
                                                    </Text>
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                    </View>
                                ))}
                            </View>

                            {/* Orario e Luogo opzionali */}
                            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Orario (opz.):</Text>
                                    <TextInput
                                        style={[styles.textInput, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.background, marginBottom: 0 }]}
                                        value={trainingTime}
                                        onChangeText={setTrainingTime}
                                        placeholder="es. 20:30"
                                        placeholderTextColor={theme.colors.textSecondary}
                                        editable={!isGeneratingTrainings}
                                    />
                                </View>
                                <View style={{ flex: 1.4 }}>
                                    <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Luogo (opz.):</Text>
                                    <TextInput
                                        style={[styles.textInput, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.background, marginBottom: 0 }]}
                                        value={trainingLocation}
                                        onChangeText={setTrainingLocation}
                                        placeholder="es. Campo Sportivo"
                                        placeholderTextColor={theme.colors.textSecondary}
                                        editable={!isGeneratingTrainings}
                                    />
                                </View>
                            </View>

                            {/* Box Anteprima Conteggio */}
                            {(() => {
                                const preview = computeTrainingsPreview();
                                return (
                                    <View style={[styles.previewBadge, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                                        <Text style={[styles.previewBadgeTitle, { color: theme.colors.text }]}>
                                            📊 Anteprima: {preview.total} allenamenti da creare
                                        </Text>
                                        <Text style={[styles.previewBadgeSubtitle, { color: theme.colors.textSecondary }]}>
                                            🥏 {preview.campo} Campo • 🏋️ {preview.palestra} Palestra
                                        </Text>
                                    </View>
                                );
                            })()}
                        </ScrollView>

                        {isGeneratingTrainings ? (
                            <View style={{ paddingVertical: 15, alignItems: 'center' }}>
                                <ActivityIndicator size="large" color="#0284C7" />
                                <Text style={{ color: theme.colors.textSecondary, marginTop: 8 }}>
                                    Generazione allenamenti in corso...
                                </Text>
                            </View>
                        ) : (
                            <View style={[styles.modalButtonsRow, { marginTop: 14 }]}>
                                <TouchableOpacity
                                    style={[styles.modalActionBtn, { backgroundColor: theme.colors.border }]}
                                    onPress={() => setModalTrainingsVisible(false)}
                                >
                                    <Text style={[styles.modalActionBtnText, { color: theme.colors.text }]}>Annulla</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.modalActionBtn, { backgroundColor: '#0284C7' }]}
                                    onPress={handleConfirmGenerateTrainings}
                                >
                                    <Text style={[styles.modalActionBtnText, { color: '#fff' }]}>Genera nel Calendario</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>

            {/* DatePicker Modals per selezione grafica date inizio e fine */}
            <DatePickerModal
                visible={showStartDatePicker}
                onClose={() => setShowStartDatePicker(false)}
                onSelectDate={(date) => {
                    setTrainingsStartDate(date);
                    setShowStartDatePicker(false);
                }}
                initialDate={trainingsStartDate || undefined}
            />

            <DatePickerModal
                visible={showEndDatePicker}
                onClose={() => setShowEndDatePicker(false)}
                onSelectDate={(date) => {
                    setTrainingsEndDate(date);
                    setShowEndDatePicker(false);
                }}
                initialDate={trainingsEndDate || undefined}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 20,
    },
    content: {
        padding: 16,
    },
    section: {
        marginBottom: 24,
    },
    sectionHeader: {
        fontSize: 13,
        fontWeight: 'bold',
        marginBottom: 8,
        letterSpacing: 0.8,
    },
    sectionSubHeader: {
        fontSize: 13,
        marginBottom: 10,
        lineHeight: 18,
    },
    cardGroup: {
        borderRadius: 14,
        borderWidth: 1,
        overflow: 'hidden',
    },
    settingRowInner: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
    },
    settingTextCol: {
        flex: 1,
        marginRight: 10,
    },
    settingLabel: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 3,
    },
    settingDescription: {
        fontSize: 13,
        lineHeight: 17,
    },
    actionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 14,
        borderWidth: 1,
        marginBottom: 10,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 2,
    },
    actionIconBadge: {
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
    },
    actionCardTitle: {
        fontSize: 15,
        fontWeight: '700',
        marginBottom: 2,
    },
    actionCardDesc: {
        fontSize: 12,
        lineHeight: 16,
    },
    actionCardChevron: {
        fontSize: 22,
        fontWeight: 'bold',
        marginLeft: 8,
    },
    annualHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    annualPill: {
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    annualPillText: {
        color: '#92400E',
        fontSize: 10,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    compactAdminBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        borderWidth: 1,
        marginTop: 4,
    },
    compactAdminBtnText: {
        fontSize: 13,
        fontWeight: '600',
    },
    eggList: {
        borderRadius: 12,
        padding: 10,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    eggItem: {
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        paddingVertical: 10,
    },
    eggHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    eggName: {
        fontWeight: 'bold',
        fontSize: 16,
    },
    eggDate: {
        fontSize: 12,
    },
    eggDesc: {
        fontSize: 13,
        fontStyle: 'italic',
    },
    seasonCard: {
        padding: 16,
        borderRadius: 14,
        borderWidth: 1,
        marginBottom: 10,
    },
    seasonInfoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    seasonBadgeLabel: {
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    seasonValue: {
        fontSize: 22,
        fontWeight: 'bold',
        marginTop: 2,
    },
    historyLinkBtn: {
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 10,
    },
    historyLinkText: {
        fontSize: 14,
        fontWeight: '700',
    },
    adminButton: {
        padding: 15,
        borderRadius: 12,
        alignItems: 'center',
    },
    adminButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 15,
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.65)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalCard: {
        width: '100%',
        maxWidth: 420,
        borderRadius: 18,
        padding: 22,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
    },
    modalTitleText: {
        fontSize: 19,
        fontWeight: 'bold',
        marginBottom: 12,
    },
    modalWarningText: {
        fontSize: 13,
        lineHeight: 18,
        marginBottom: 16,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 6,
    },
    textInput: {
        borderWidth: 1,
        borderRadius: 10,
        padding: 12,
        fontSize: 16,
        marginBottom: 18,
    },
    modalButtonsRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
    },
    modalActionBtn: {
        paddingVertical: 12,
        paddingHorizontal: 18,
        borderRadius: 10,
        alignItems: 'center',
    },
    modalActionBtnText: {
        fontWeight: 'bold',
        fontSize: 14,
    },
    dayPlanRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 10,
        borderWidth: 1,
    },
    dayPlanToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
    },
    dayPlanCheckbox: {
        width: 20,
        height: 20,
        borderRadius: 4,
        borderWidth: 1.5,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dayPlanName: {
        fontSize: 14,
    },
    venueToggleGroup: {
        flexDirection: 'row',
        gap: 6,
    },
    venueBtn: {
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(150, 150, 150, 0.25)',
    },
    venueBtnText: {
        fontSize: 12,
        fontWeight: '700',
    },
    previewBadge: {
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        marginVertical: 6,
        alignItems: 'center',
    },
    previewBadgeTitle: {
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 2,
    },
    previewBadgeSubtitle: {
        fontSize: 12,
    },
    datePickerBtn: {
        borderWidth: 1,
        borderRadius: 10,
        paddingVertical: 12,
        paddingHorizontal: 12,
        justifyContent: 'center',
    },
});

