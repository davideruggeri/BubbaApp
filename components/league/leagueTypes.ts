import { Member, LeagueBonus, Event as FirestoreEvent, RosterMember, LeagueRule, BonusDefinition, PastLeague, LeagueDates } from '../../services/firestore';

export type LeagueType = 'winter' | 'summer';
export type Tab = 'standings' | 'bonus' | 'rules' | 'bonusList';
export type BonusTypeTab = 'bonus' | 'malus' | 'custom';
export type SettingsTab = 'dates' | 'rules' | 'bonus';

export interface StandingItem {
    member: Member;
    points: number;
    attendanceCount: number;
    attendanceCountCampo: number;
    attendanceCountGym: number;
    bonusPoints: number;
    rank?: number;
}

export interface MemberHistoryItem {
    date: string;
    points: number;
    reason: string;
    type: 'attendance' | 'bonus' | 'malus';
}

export const DEFAULT_BONUS_OPTIONS = [
    { label: "Presente 1° giorno Winter Hat", points: 2 },
    { label: "Allenamento ≤ 8 persone", points: 1 },
    { label: "Invitare amici", points: 4 },
    { label: "Meteo disagiante", points: 2 },
    { label: "Torneo con i Bubba", points: 2 },
    { label: "Torneo/Evento frisbee", points: 1 },
    { label: "Prestare divise", points: 1 },
    { label: "Callahan", points: 2 },
    { label: "Handblock", points: 1 },
    { label: "Footblock", points: 2 },
    { label: "Scorpionblock", points: 3 },
    { label: "Headblock", points: 4 },
    { label: "Layout buono", points: 1 },
    { label: "Intercetto in layout", points: 2 },
    { label: "Meta in layout", points: 3 },
    { label: "Callahan in layout", points: 4 },
    { label: "Ultima meta (Assist/Goal)", points: 1 },
    { label: "Meta in hammer", points: 1 },
    { label: "Meta in scober", points: 2 },
    { label: "Meta in tamber", points: 3 },
    { label: "Greatest", points: 4 },
    { label: "Assist mano NON dominante", points: 1 },
    { label: "Vincere flip casacche", points: 1 },
    { label: "Lavare casacche", points: 2 },
];

export const DEFAULT_MALUS_OPTIONS = [
    { label: "Pacco (Presente -> Assente)", points: -2 },
    { label: "Berna", points: -2 },
    { label: "Rompere un disco", points: -2 },
    { label: "Ritardo", points: -1 },
    { label: "Meta/Lancio hammer", points: -1 },
    { label: "Meta/Lancio scober", points: -2 },
    { label: "Meta/Lancio tamber", points: -3 },
    { label: "Mancata presa volontaria", points: -2 },
    { label: "Pull fuori campo", points: -2 },
    { label: "Perdere flip casacche", points: -1 },
];
