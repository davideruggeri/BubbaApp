// services/firestore/types.ts
// Tutti i tipi e interfacce condivisi dell'app

export type Member = {
    id: string;
    firstName: string;
    lastName?: string;
    nickname?: string;
    birthDate?: string;
    gender?: 'M' | 'F';
    attendanceCount: number;
    attendanceCountGym?: number; // New field for gym attendance
    inactiveSince?: string | null; // YYYY-MM-DD if inactive, null/undefined if active
    jerseyNumber?: string;
    currentStreak?: number;
    streakMassima?: number;
    streakCampo?: number;
    streakPalestra?: number;
};

export type StagioneCorrente = {
    stagioneCorrente: string;
    dataInizio: any;
    dataFine: any | null;
};

export type MemberSeasonStats = {
    presenzeCampo: number;
    presenzePalestra: number;
    percentualeCampo?: number;
    percentualePalestra?: number;
    percentualePresenza: number;
    streakMassima: number;
    streakCampo?: number;
    streakPalestra?: number;
};

export type PresenzeHistoryEntry = {
    stagione: string;
    dataChiusura: any;
    totalePresenzeCampo: number;
    totalePresenzePalestra: number;
    totaleOspitiCampo?: number;
    totaleOspitiPalestra?: number;
    totaleOspiti?: number;
    numeroAllenamenti: number;
    numeroAllenamentiCampo?: number;
    numeroAllenamentiPalestra?: number;
    perMembro: {
        [memberId: string]: MemberSeasonStats;
    };
};

export type RankedItem<T> = T & {
    rank: number;
    badge?: string;
};

export type Session = {
    id: string; // Date string YYYY-MM-DD
    date: string;
    type: 'Campo' | 'Palestra';
    guests?: string[]; // List of guest names
};

export type Event = {
    id: string;
    title: string;
    date: string; // Start date YYYY-MM-DD
    endDate?: string; // Optional end date YYYY-MM-DD
    type: 'training' | 'match' | 'social' | 'championship' | 'tournament' | 'other' | 'Campo' | 'Palestra' | 'birthday' | 'championship_season';
    subType?: string; // e.g. "raduno", "stage", "festa", etc.
    surface?: 'erba' | 'sabbia';
    season?: string; // e.g. "2025"
    stagione?: string; // e.g. "2025-2026"
    isArchived?: boolean;
    linkedEventIds?: string[]; // IDs of calendar events linked to this championship
    participants?: {
        id: string;
        name: string;
        isGuest: boolean;
        present: boolean;
        role?: 'player' | 'guest';
    }[];
    location?: string;
    playerFee?: string;
    teamFee?: string;
    additionalInfo?: string;
    latitude?: number;
    longitude?: number;
    showOnMap?: boolean;
    images?: string[];
};

export type RosterMember = {
    id: string;
    name: string;
    isGuest: boolean;
    memberId?: string; // If linked to an internal member
    role?: 'player' | 'guest';
    eventId?: string;
    gender?: 'M' | 'F';
};

export type HallOfFameEntry = {
    id: string;
    title: string;          // Tournament Name
    location?: string;       // e.g., "Rimini"
    dateDescription: string; // e.g., "Spring 2024" or "12-14 July"
    date: string;           // ISO Date string YYYY-MM-DD for sorting (end date of tournament)
    placement: string;      // e.g., "1st Place", "Quarterfinals"
    awards: string[];       // e.g., ["MVP: Mario", "SOTG"]
    roster?: RosterMember[]; // Snapshot of the roster
    createdAt?: string;     // ISO Date string for sorting
    latitude?: number;
    longitude?: number;
    images?: string[];
};

export type MemberTournament = {
    id: string; // event id
    rosterId: string;
    title: string;
    date: string;
    endDate?: string;
    location?: string;
    type: string;
    stagione: string;
    role: 'player' | 'guest';
    isCurrentSeason: boolean;
};

export type MemberStreaks = {
    currentStreak: number;
    streakMassima: number;
    streakCampo: number;
    streakPalestra: number;
};

export type TrainingStats = {
    averageAttendance: number;
    totalTrainings: number;
    recordAttendance: {
        date: string;
        count: number;
    } | null;
};

export type LeagueTeam = {
    id: string;
    name: string;
};

export type LeagueMatch = {
    id: string;
    homeTeamId: string;
    awayTeamId: string;
    homeScore: number | null;
    awayScore: number | null;
    date: string; // YYYY-MM-DD
    played: boolean;
    round?: number; // Giornata
};

export type LeagueDates = {
    startDate: string; // YYYY-MM-DD
    endDate: string;   // YYYY-MM-DD
};

export type LeagueBonus = {
    id: string;
    date: string;       // YYYY-MM-DD
    memberId: string;
    points: number;     // Can be negative
    reason: string;
    leagueType: 'winter' | 'summer';
};

export type LeagueRule = {
    id: string;
    title: string;
    description: string;
    order: number;
};

export type BonusDefinition = {
    id: string;
    label: string;
    points: number;
    type: 'bonus' | 'malus';
};

export type PastLeagueMember = {
    id: string; // Member ID
    name: string;
    points: number;
    attendanceCount: number;
    bonusPoints: number;
    rank: number;
};

export type PastLeague = {
    id: string; // e.g., "winter_2024" or auto-generated
    name: string; // e.g., "Winter League 2024"
    startDate: string;
    endDate: string;
    type: 'winter' | 'summer';
    winnerId: string; // Member ID of the winner
    standings: PastLeagueMember[];
    totalParticipants: number;
    bonuses?: LeagueBonus[];
};

export type MatchStatType = 'M' | 'A' | 'C' | 'D' | 'T' | 'E' | 'B' | 'S';

export type LegacyMatchEvent = {
    id: string;
    playerId: string;
    type: MatchStatType;
    timestamp: number;
};

export type MatchPoint = {
    id: string;
    events: LegacyMatchEvent[];
    ourScore: number;
    theirScore: number;
    type: 'offense' | 'defense';
    players: string[]; // IDs of players on the field
    scoredBy?: string | null;
    assistBy?: string | null;
    durationSeconds?: number;
    startTime?: number;
};

export type MatchPlayer = {
    id: string;
    name: string;
    isGuest: boolean;
    memberId?: string;
    gender?: 'M' | 'F';
};

export type StatEffect = 'score_us' | 'score_them' | 'turnover' | 'switch_possession' | 'none';

export type StatDefinition = {
    code: string;
    label: string;
    color: string;
    effect: StatEffect;
    description?: string;
    requiresPlayer?: boolean;
};

export type MatchStatsSettings = {
    offense: StatDefinition[];
    defense: StatDefinition[];
};

export type MatchEvent = {
    k: 'start' | 'pull' | 'goal' | 'call' | 'tt' | 'td' | 'ts' | 'tx' | 'd' | 'err' | 'tg' | 'line' | 'dset' | 'touch' | 'halftime';
    t?: number;
    line?: string[]; // array di id giocatori
    o?: boolean; // vero se partiamo in attacco
    team?: 'us' | 'them';
    p?: string | null; // id giocatore
    s?: string; // id marcatore gol
    a?: string | null; // id assist
    x?: number | null; // coordinata x in metri
    y?: number | null; // coordinata y in metri
    trajectory?: { x: number; y: number }[]; // tracciato curva lancio dal punto di rilascio al punto di caduta
    v?: string; // valore schema difesa (es. 'Veltroni', 'Zona', 'Uomo')
    reason?: 'injury' | 'error'; // motivo cambio giocatore: infortunio a metà punto o errore da inizio meta
};

export type MatchRosterPlayer = {
    id: string;
    name: string;
    g: 'M' | 'F';
};

export type MatchAnalysis = {
    id: string;
    opponent: string;
    surface: 'sabbia' | 'erba';
    division: 'open' | 'mixed';
    targetScore: 13 | 15;
    date: string; // YYYY-MM-DD
    stagione?: string; // e.g. "2025-2026"
    startingGender?: 'M' | 'F';
    ourScore?: number;
    theirScore?: number;
    notes?: string;
    // Nuova logica eventi (StatistichePartita)
    events?: MatchEvent[];
    pullFirst?: 'us' | 'them';
    firstRatio?: 'M' | 'F';
    dir0?: 'R' | 'L'; // orientamento iniziale nostro attacco
    status?: 'scheduled' | 'live' | 'completed';
    // Associazione Evento
    isSingleMatch?: boolean;
    eventId?: string | null;
    eventName?: string | null;
    // Roster personalizzato / salvato con la partita
    customRoster?: MatchRosterPlayer[];
    // Override manuale tocchi per partita conclusa o recupero dati
    manualTouches?: Record<string, number>;
    // Campi legacy per retrocompatibilità opzionale
    players?: MatchPlayer[];
    points?: MatchPoint[];
    currentPossession?: 'offense' | 'defense';
    activePoint?: MatchPoint | null;
    timeouts?: {
        our: ('first' | 'second')[];
        their: ('first' | 'second')[];
    };
    rules?: {
        timeoutLimit: '1_per_half' | '1_per_match' | 'none' | { count: number, scope: 'half' | 'match' };
        scoreLimit: 'standard' | 'no_limit';
        halftimeMode: 'standard' | 'manual';
    };
    statsSettings?: MatchStatsSettings;
};

export type ChristmasSettings = {
    mode: 'auto' | 'enabled' | 'disabled';
};

export type TacticalScheme = {
    id: string;
    name: string;
    createdBy: string;
    createdAt: string;
    gameFormat: '5v5' | '7v7';
    offensePositions: { x: number; y: number }[];
    defensePositions: { x: number; y: number }[];
    forceDirection: 1 | -1;
    flightPath?: { x: number; y: number }[];
    discPaths?: { x: number; y: number }[][];
    movementSequences?: Array<{
        playerPaths: Record<number, { x: number; y: number }[]>;
        basePositions: Record<number, { x: number; y: number }>;
    }>;
    notes?: string;
};

export interface WorldLocation {
    id: string;
    title: string;
    description?: string;
    latitude: number;
    longitude: number;
    date: string;
    images: string[];
    locationName: string;
}

export interface UserWrappedData {
    memberId: string;
    stagione: string;
    memberName: string;
    nickname?: string;
    photoUrl?: string;
    presenzeTotali: number;
    presenzeCampo: number;
    presenzePalestra: number;
    percentualePresenza: number;
    mediaSquadraPresenze: number;
    differenzaMediaSquadra: number;
    streakMassima: number;
    streakCampo?: number;
    streakPalestra?: number;
    leaguePoints?: number;
    leagueRank?: number;
    leagueTotalParticipants?: number;
    leagueBadge?: string;
    leagueType?: string;
    eventiPartecipati: Array<{
        id?: string;
        title: string;
        date: string;
        endDate?: string;
        type: string;
        location?: string;
        role?: string;
    }>;
    totaleEventiPartecipati: number;
    tuttiEventiStagione?: Array<{
        id: string;
        title: string;
        date: string;
        endDate?: string;
        type: string;
        location?: string;
        partecipato: boolean;
        role?: string;
    }>;
    partiteGiocate: number;
    titoloRiconoscimento: string;
    descrizioneTitolo: string;
}

export interface TeamWrappedData {
    stagione: string;
    activatedAt?: string;
    allenamentiTotali: number;
    allenamentiCampo: number;
    allenamentiPalestra: number;
    presenzeTotaliSquadra: number;
    mediaPresenzePerAllenamento: number;
    nuoviMembriCount: number;
    nuoviMembriNomi: string[];
    kmTotaliPercorsi: number;
    tappeMappa: Array<{
        locationName: string;
        title: string;
        date?: string;
    }>;
    torneiTotali: number;
    torneiNomi: string[];
    eventiStagione?: Array<{
        id: string;
        title: string;
        date: string;
        endDate?: string;
        type: string;
        location?: string;
    }>;
    recordPresenzeAllenamento?: {
        date: string;
        count: number;
    };
}
