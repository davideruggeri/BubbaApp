import { MatchAnalysis } from '../../services/firestore';

export interface ActionDetailModalData {
    event: any;
    point: any;
    pointIndex: number;
    kind: string;
    scoreUs: number;
    scoreThem: number;
    targetEndzone: string;
    startType: 'O' | 'D';
    throwerName?: string;
    receiverName?: string;
    defenderName?: string;
    defenseSchema?: string;
    coordX?: number;
    coordY?: number;
    eventIndex?: number;
}

export interface PullDetailModalData {
    eventIndex: number;
    pointNumber: number;
    pullEvent: any;
    pullerName: string;
    team: 'us' | 'them';
    coord: { x: number; y: number };
}

export interface MatchStatsViewProps {
    tStats: any;
    pStats: Record<string, any>;
    isMobile: boolean;
    statsSortKey: string;
    statsSortAsc: boolean;
    onToggleSort: (key: string) => void;
    P: (id: string) => { name: string; g: 'M' | 'F' };
    st: any;
    match: MatchAnalysis;
    playerMap: Record<string, { name: string; g: 'M' | 'F' }>;
    canEdit?: boolean;
    onUpdatePullCoord?: (eventIndex: number, newCoord: { x: number; y: number }) => Promise<void>;
    onUpdateTurnoverEvent?: (eventIndex: number, updatedFields: any) => Promise<void>;
    onUpdateGoalEvent?: (eventIndex: number, updated: { s?: string | null; a?: string | null }) => Promise<void>;
    onUpdatePointLine?: (pointNumber: number, oldPlayerId: string, newPlayerId: string) => Promise<void>;
}
