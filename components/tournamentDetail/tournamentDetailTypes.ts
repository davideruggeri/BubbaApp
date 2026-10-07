import { MatchAnalysis, Member } from '../../services/firestore/types';
import { PlayerStats } from '../../utils/statsEngine';

export type SortKey = 'name' | 'pts' | 'goals' | 'ast' | 'ds' | 'toTot' | 'plusMinus' | 'touches';

export interface PlayerStatRow extends PlayerStats {
    id: string;
    name: string;
    g: 'M' | 'F';
}

export interface TeamStatsSummary {
    totalMatches: number;
    wins: number;
    losses: number;
    ties: number;
    ourTotalGoals: number;
    theirTotalGoals: number;
    goalDiff: number;
    hasLive: boolean;
}
