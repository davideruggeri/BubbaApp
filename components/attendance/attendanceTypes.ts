import { Member } from '../../services/firestore';

export type ViewMode = 'Campo' | 'Palestra';

export interface MemberHistoryItem {
    date: string;
    present: boolean;
    type: string;
}

export interface MemberHistoryData {
    member: Member;
    history: MemberHistoryItem[];
    currentStreak: number;
    maxStreak: number;
}
