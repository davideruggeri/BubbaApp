import { useState, useEffect, useMemo, useCallback } from 'react';
import { Platform } from 'react-native';
import {
    subscribeToMatchAnalysis,
    addMatchAnalysis,
    deleteMatchAnalysis,
    subscribeToEvents,
    subscribeToMembers,
    MatchAnalysis,
    Event,
    Member
} from '../../services/firestore';
import { showAlert, showConfirmation } from '../../utils/alert';
import { parseJSONBackup, parseXLSXFile, extractImportedPlayers, RawImportedPlayer } from '../../utils/matchImporter';
import { exportAndDownloadXLSX } from '../../utils/matchExporter';
import { formatDate } from './analisiPartitaUtils';
import { MatchGroup } from './analisiPartitaTypes';

interface UseMatchAnalysisProps {
    stagioneCorrente: string;
}

export function useMatchAnalysis({ stagioneCorrente }: UseMatchAnalysisProps) {
    const [matches, setMatches] = useState<MatchAnalysis[]>([]);
    const [eventsList, setEventsList] = useState<Event[]>([]);
    const [allMembers, setAllMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(false);
    const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

    // Import Mapping State
    const [mappingModalVisible, setMappingModalVisible] = useState(false);
    const [importedRawPlayers, setImportedRawPlayers] = useState<RawImportedPlayer[]>([]);
    const [playerMappings, setPlayerMappings] = useState<Record<string, string>>({});
    const [pendingImportData, setPendingImportData] = useState<{ content: any; isJson: boolean } | null>(null);

    // Export Tournament Modal State
    const [exportTournamentModalVisible, setExportTournamentModalVisible] = useState(false);

    useEffect(() => {
        const unsubscribeMatches = subscribeToMatchAnalysis(setMatches);
        const unsubscribeEvents = subscribeToEvents(setEventsList);
        const unsubscribeMembers = subscribeToMembers(setAllMembers);

        return () => {
            unsubscribeMatches();
            unsubscribeEvents();
            unsubscribeMembers();
        };
    }, []);

    // Mappa giocatori ID -> { name, g }
    const playerMap = useMemo(() => {
        const map: Record<string, { name: string; g: 'M' | 'F' }> = {};
        for (const m of allMembers) {
            map[m.id] = {
                name: m.nickname || m.firstName,
                g: m.gender === 'F' ? 'F' : 'M'
            };
        }
        return map;
    }, [allMembers]);

    // Tornei e Campionati a calendario
    const tournamentEvents = useMemo(() => {
        const filtered = eventsList.filter((ev: Event) => {
            const t = (ev.type || '').toLowerCase();
            return t === 'tournament' || t === 'championship' || t === 'championship_season' || t === 'torneo' || t === 'campionato';
        });

        const uniqueMap = new Map<string, Event>();
        for (const ev of filtered) {
            const normalizedTitle = (ev.title || '').trim().toLowerCase();
            if (!uniqueMap.has(normalizedTitle)) {
                uniqueMap.set(normalizedTitle, ev);
            } else {
                const existing = uniqueMap.get(normalizedTitle)!;
                if ((ev.date || '') < (existing.date || '')) {
                    uniqueMap.set(normalizedTitle, ev);
                }
            }
        }

        for (const m of matches) {
            if (!m.isSingleMatch && m.eventName && m.eventName.trim()) {
                const norm = m.eventName.trim().toLowerCase();
                if (!uniqueMap.has(norm)) {
                    const calendarMatch = eventsList.find(e => (e.title || '').trim().toLowerCase() === norm || e.id === m.eventId);
                    if (calendarMatch) {
                        uniqueMap.set(norm, calendarMatch);
                    } else {
                        uniqueMap.set(norm, {
                            id: m.eventId || `existing_${m.eventName.trim()}`,
                            title: m.eventName.trim(),
                            date: m.date || new Date().toISOString().split('T')[0],
                            type: 'tournament',
                            description: 'Torneo già registrato'
                        } as Event);
                    }
                }
            }
        }

        const list = Array.from(uniqueMap.values());
        list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        return list;
    }, [eventsList, matches]);

    // Raggruppamento partite per cartella (torneo o singole)
    const groupedMatches: MatchGroup[] = useMemo(() => {
        const tournamentMap = new Map<string, MatchAnalysis[]>();
        const singleMatches: MatchAnalysis[] = [];

        matches.forEach(m => {
            if (!m.isSingleMatch && m.eventName && m.eventName.trim()) {
                const key = m.eventName.trim();
                if (!tournamentMap.has(key)) {
                    tournamentMap.set(key, []);
                }
                tournamentMap.get(key)!.push(m);
            } else {
                singleMatches.push(m);
            }
        });

        const groups: MatchGroup[] = [];

        tournamentMap.forEach((tMatches, tName) => {
            if (tMatches.length === 0) return;
            tMatches.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
            const hasLive = tMatches.some(m => m.status === 'live');
            const dates = tMatches.map(m => m.date).filter(Boolean).sort();
            const dateRange = dates.length > 0
                ? (dates[0] === dates[dates.length - 1] ? formatDate(dates[0]) : `${formatDate(dates[0])} - ${formatDate(dates[dates.length - 1])}`)
                : '';

            const sortDate = (dates.length > 0 ? dates[dates.length - 1] : '') || '';

            groups.push({
                id: `tournament_${tName}`,
                title: tName,
                matches: tMatches,
                hasLive,
                dateRange,
                sortDate
            });
        });

        groups.sort((a, b) => b.sortDate.localeCompare(a.sortDate));

        if (singleMatches.length > 0) {
            singleMatches.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
            const hasLive = singleMatches.some(m => m.status === 'live');
            groups.push({
                id: 'single_matches',
                title: 'Partite Singole / Amichevoli',
                isSingleGroup: true,
                matches: singleMatches,
                hasLive,
                dateRange: `${singleMatches.length} ${singleMatches.length === 1 ? 'partita' : 'partite'}`,
                sortDate: singleMatches[0]?.date || ''
            });
        }

        return groups;
    }, [matches]);

    const toggleFolder = useCallback((folderId: string) => {
        setExpandedFolders(prev => ({
            ...prev,
            [folderId]: prev[folderId] !== undefined ? !prev[folderId] : false
        }));
    }, []);

    const handleDeleteMatch = useCallback((id: string) => {
        showConfirmation(
            "Elimina Partita",
            "Sei sicuro di voler eliminare questa partita e tutti i suoi dati?",
            () => deleteMatchAnalysis(id),
            "Elimina"
        );
    }, []);

    const handleExportSingleMatchXLSX = useCallback(async (match: MatchAnalysis) => {
        try {
            await exportAndDownloadXLSX([match], playerMap);
        } catch (error: any) {
            showAlert("Errore", "Impossibile esportare la partita.");
        }
    }, [playerMap]);

    const handleExportTournamentXLSX = useCallback(async () => {
        const tournamentGroups = groupedMatches.filter(g => !g.isSingleGroup && g.matches.length > 0);

        if (!tournamentGroups.length) {
            showAlert("Nessun torneo", "Non ci sono partite di torneo registrate per la stagione corrente.");
            return;
        }

        if (tournamentGroups.length === 1) {
            try {
                await exportAndDownloadXLSX(tournamentGroups[0].matches, playerMap);
                showAlert("Esportazione completata", `Il foglio Excel di "${tournamentGroups[0].title}" è stato scaricato.`);
            } catch (error: any) {
                showAlert("Errore Esportazione", error?.message || "Impossibile esportare l'Excel.");
            }
            return;
        }

        setExportTournamentModalVisible(true);
    }, [groupedMatches, playerMap]);

    const processConfirmedImport = useCallback(async (
        content: string | Uint8Array,
        isJson: boolean,
        mapping: Record<string, string>
    ) => {
        setLoading(true);
        try {
            let importedGames = [];
            if (isJson) {
                importedGames = parseJSONBackup(content as string, allMembers, mapping);
            } else {
                importedGames = parseXLSXFile(content as Uint8Array, allMembers, mapping);
            }

            if (!importedGames.length) {
                showAlert("Attenzione", "Nessuna partita trovata nel file selezionato.");
                return;
            }

            let count = 0;
            for (const g of importedGames) {
                await addMatchAnalysis({
                    opponent: g.opponent,
                    date: g.date,
                    surface: 'sabbia',
                    division: 'mixed',
                    targetScore: 13,
                    pullFirst: g.pullFirst,
                    firstRatio: g.firstRatio,
                    dir0: g.dir0,
                    events: g.events,
                    ourScore: g.ourScore,
                    theirScore: g.theirScore,
                    status: g.status,
                    customRoster: g.customRoster,
                    stagione: stagioneCorrente,
                    isSingleMatch: true,
                });
                count++;
            }

            setMappingModalVisible(false);
            setPendingImportData(null);
            showAlert(
                "Importazione Completata",
                `Sono state importate con successo ${count} partite con giocatori associati ed eventi.`
            );
        } catch (err: any) {
            showAlert("Errore Salvataggio", err?.message || "Impossibile salvare le partite importate.");
        } finally {
            setLoading(false);
        }
    }, [allMembers, stagioneCorrente]);

    const handleImportFile = useCallback(() => {
        if (Platform.OS === 'web') {
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = '.json,.xlsx,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            fileInput.style.display = 'none';

            fileInput.onchange = async (e: any) => {
                const file = e.target?.files?.[0];
                if (!file) return;

                setLoading(true);
                const isJson = file.name.endsWith('.json');
                const reader = new FileReader();

                reader.onload = async (event: any) => {
                    try {
                        const content = isJson ? event.target.result : new Uint8Array(event.target.result);
                        const rawPlayers = extractImportedPlayers(content, isJson, allMembers);

                        if (rawPlayers.length > 0) {
                            const initialMap: Record<string, string> = {};
                            rawPlayers.forEach(p => {
                                initialMap[p.name.toLowerCase()] = p.suggestedMemberId || 'guest';
                            });

                            setImportedRawPlayers(rawPlayers);
                            setPlayerMappings(initialMap);
                            setPendingImportData({ content, isJson });
                            setMappingModalVisible(true);
                            setLoading(false);
                            return;
                        }

                        await processConfirmedImport(content, isJson, {});
                    } catch (err: any) {
                        console.error("Errore durante l'importazione:", err);
                        showAlert("Errore Importazione", err?.message || "Impossibile leggere o analizzare il file.");
                        setLoading(false);
                    }
                };

                if (isJson) {
                    reader.readAsText(file);
                } else {
                    reader.readAsArrayBuffer(file);
                }
            };

            document.body.appendChild(fileInput);
            fileInput.click();
            document.body.removeChild(fileInput);
        } else {
            showAlert("Funzionalità Web", "L'importazione file è attualmente disponibile su browser/web.");
        }
    }, [allMembers, processConfirmedImport]);

    return {
        matches,
        eventsList,
        allMembers,
        loading,
        expandedFolders,
        tournamentEvents,
        playerMap,
        groupedMatches,
        toggleFolder,
        handleDeleteMatch,
        handleExportSingleMatchXLSX,
        handleExportTournamentXLSX,
        handleImportFile,
        processConfirmedImport,
        // Mapping modal
        mappingModalVisible,
        setMappingModalVisible,
        importedRawPlayers,
        playerMappings,
        setPlayerMappings,
        pendingImportData,
        // Export tournament modal
        exportTournamentModalVisible,
        setExportTournamentModalVisible
    };
}
