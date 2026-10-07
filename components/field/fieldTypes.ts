import { FIELD } from '../../utils/statsEngine';

export interface FieldDot {
    x: number;
    y: number;
    c: string; // colore es. '#003057', '#C8323C'
    r?: number;
    label?: string;
    onPress?: () => void;
    data?: any;
}

export interface FieldTrajectory {
    points: { x: number; y: number }[];
    color?: string;
    label?: string;
    onPress?: () => void;
    data?: any;
}

export interface InteractiveFieldProps {
    dots?: FieldDot[];
    trajectories?: FieldTrajectory[];
    interactive?: boolean;
    drawTrajectoryMode?: boolean; // Se true, l'utente traccia con il dito la curva della traiettoria
    isPlayMode?: boolean; // true = turnover/D (difendiamo a x=0, attacchiamo a x=75), false = pull
    flip?: boolean; // inverte la direzione di visualizzazione (destra <-> sinistra)
    enlargeable?: boolean;
    height?: number; // altezza personalizzabile del campo inline
    drawingColor?: string; // colore della traiettoria in fase di disegno (es. '#C8323C' per TO nostro, '#E07A1F' per Errore Loro)
    onFieldPress?: (coord: { x: number; y: number }) => void;
    onTrajectoryComplete?: (trajectory: { x: number; y: number }[]) => void;
    onFlipDirection?: () => void;
    onDotPress?: (dot: FieldDot) => void;
    onTrajectoryPress?: (trajectory: FieldTrajectory) => void;
}

// Dimensioni campo e margini per il Fuori Campo (OB)
export const MARGIN_X = 6; // 6m di margine oltre le linee di meta (-6m a +81m)
export const MARGIN_Y = 5; // 5m di margine oltre le linee laterali (-5m a +30m)
export const TOTAL_L = FIELD.L + 2 * MARGIN_X; // 75 + 12 = 87 metri totali
export const TOTAL_W = FIELD.W + 2 * MARGIN_Y; // 25 + 10 = 35 metri totali
export const FIELD_ASPECT_RATIO = TOTAL_L / TOTAL_W; // 87 / 35 ≈ 2.485714 (proporzione reale del campo completo di OB)
