import { MatchAnalysis, MatchRosterPlayer } from '../../services/firestore';

export interface MatchGroup {
    id: string;
    title: string;
    isSingleGroup?: boolean;
    matches: MatchAnalysis[];
    hasLive: boolean;
    dateRange: string;
    sortDate: string;
}

export interface MatchFormState {
    editingMatchId: string | null;
    opponent: string;
    date: string;
    surface: 'sabbia' | 'erba';
    pullFirst: 'us' | 'them';
    firstRatio: 'M' | 'F';
    dir0: 'R' | 'L';
    isSingleMatch: boolean;
    selectedEventId: string;
    selectedRoster: MatchRosterPlayer[];
    rosterSourceEvent: string | null;
}
