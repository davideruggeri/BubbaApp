// components/InteractiveField.tsx
// Componente campo interattivo per la registrazione di Pull e Turnover/Difese con supporto Fuori Campo (OB) e Traiettorie Curve
import React, { useRef, useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, GestureResponderEvent, Platform, Modal, PanResponder, ScrollView, useWindowDimensions, LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Polygon, Circle, G } from 'react-native-svg';
import { FIELD, isOB } from '../utils/statsEngine';

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

interface InteractiveFieldProps {
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
const MARGIN_X = 6; // 6m di margine oltre le linee di meta (-6m a +81m)
const MARGIN_Y = 5; // 5m di margine oltre le linee laterali (-5m a +30m)
const TOTAL_L = FIELD.L + 2 * MARGIN_X; // 75 + 12 = 87 metri totali
const TOTAL_W = FIELD.W + 2 * MARGIN_Y; // 25 + 10 = 35 metri totali
export const FIELD_ASPECT_RATIO = TOTAL_L / TOTAL_W; // 87 / 35 ≈ 2.485714 (proporzione reale del campo completo di OB)

export default function InteractiveField({
    dots = [],
    trajectories = [],
    interactive = false,
    drawTrajectoryMode = false,
    isPlayMode = false,
    flip = false,
    enlargeable = true,
    height,
    drawingColor = '#C8323C',
    onFieldPress,
    onTrajectoryComplete,
    onFlipDirection,
    onDotPress,
    onTrajectoryPress
}: InteractiveFieldProps) {
    const grassRef = useRef<View>(null);
    const modalGrassRef = useRef<View>(null);
    const inlineDomRef = useRef<any>(null);
    const modalDomRef = useRef<any>(null);

    const { width: windowWidth, height: windowHeight } = useWindowDimensions();
    const isLandscape = windowWidth > windowHeight;

    const [isExpanded, setIsExpanded] = useState(false);
    // Di default adatta perfettamente al 100% dello spazio disponibile senza uscire dallo schermo
    const [modalZoom, setModalZoom] = useState<'fit' | '1.5x' | '2.2x'>('fit');
    const [wrapperWidth, setWrapperWidth] = useState<number>(0);
    const [grassSize, setGrassSize] = useState({ width: 0, height: 0 });
    const [modalGrassSize, setModalGrassSize] = useState({ width: 0, height: 0 });
    const [lastCoord, setLastCoord] = useState<{ x: number; y: number } | null>(null);
    const [activeDrawingPts, setActiveDrawingPts] = useState<{ x: number; y: number }[]>([]);

    // Gestione nativa Pointer/Mouse Events per browser Web da PC (massima reattività e precisione)
    useEffect(() => {
        if (Platform.OS !== 'web') return;

        const attachWebDrawEvents = (node: any, isModal: boolean) => {
            if (!node || typeof node.addEventListener !== 'function') return () => { };

            const onPointerDown = (e: any) => {
                if (!drawTrajectoryMode || !interactive) return;
                if (e.button != null && e.button !== 0) return; // solo click sinistro
                e.preventDefault();
                e.stopPropagation();

                const rect = node.getBoundingClientRect();
                if (!rect || rect.width === 0 || rect.height === 0) return;

                const getPt = (clientX: number, clientY: number) => {
                    const relX = clientX - rect.left;
                    const relY = clientY - rect.top;
                    let x = -MARGIN_X + (relX / rect.width) * TOTAL_L;
                    let y = -MARGIN_Y + (relY / rect.height) * TOTAL_W;
                    if (flip) x = FIELD.L - x;
                    x = Math.max(-MARGIN_X, Math.min(FIELD.L + MARGIN_X, Math.round(x * 10) / 10));
                    y = Math.max(-MARGIN_Y, Math.min(FIELD.W + MARGIN_Y, Math.round(y * 10) / 10));
                    return { x, y };
                };

                const startPt = getPt(e.clientX, e.clientY);
                let pts = [startPt];
                setActiveDrawingPts([startPt]);

                const onPointerMove = (me: any) => {
                    me.preventDefault();
                    const pt = getPt(me.clientX, me.clientY);
                    const last = pts[pts.length - 1];
                    if (Math.hypot(pt.x - last.x, pt.y - last.y) >= 0.35) {
                        pts = [...pts, pt];
                        setActiveDrawingPts(pts);
                    }
                };

                const onPointerUp = (ue: any) => {
                    window.removeEventListener('pointermove', onPointerMove);
                    window.removeEventListener('pointerup', onPointerUp);
                    window.removeEventListener('mousemove', onPointerMove);
                    window.removeEventListener('mouseup', onPointerUp);

                    const endPt = getPt(ue.clientX, ue.clientY);
                    const last = pts[pts.length - 1];
                    if (Math.hypot(endPt.x - last.x, endPt.y - last.y) >= 0.2) {
                        pts = [...pts, endPt];
                    }

                    const totalDist = pts.reduce((sum, p, i) => i === 0 ? 0 : sum + Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y), 0);
                    if (pts.length >= 2 && totalDist >= 1.5) {
                        setLastCoord(pts[pts.length - 1]);
                        if (onTrajectoryComplete) onTrajectoryComplete(pts);
                        if (isModal) setIsExpanded(false);
                    } else if (pts.length >= 1) {
                        setLastCoord(pts[0]);
                        if (onFieldPress) onFieldPress(pts[0]);
                        if (isModal) setIsExpanded(false);
                    }
                    setActiveDrawingPts([]);
                };

                window.addEventListener('pointermove', onPointerMove);
                window.addEventListener('pointerup', onPointerUp);
                window.addEventListener('mousemove', onPointerMove);
                window.addEventListener('mouseup', onPointerUp);
            };

            node.addEventListener('pointerdown', onPointerDown, { passive: false });
            node.addEventListener('mousedown', onPointerDown);

            return () => {
                node.removeEventListener('pointerdown', onPointerDown);
                node.removeEventListener('mousedown', onPointerDown);
            };
        };

        const cleanupInline = attachWebDrawEvents(inlineDomRef.current, false);
        const cleanupModal = attachWebDrawEvents(modalDomRef.current, true);

        return () => {
            cleanupInline();
            cleanupModal();
        };
    }, [drawTrajectoryMode, interactive, flip, isExpanded]);

    const getCoordFromEvent = (e: any, isModal: boolean, gestureState?: any): { x: number; y: number } | null => {
        const rawNode = isModal ? modalDomRef.current : inlineDomRef.current;
        const domNode = rawNode?.getBoundingClientRect ? rawNode : (rawNode?.node?.getBoundingClientRect ? rawNode.node : null);
        if (Platform.OS === 'web' && domNode && typeof domNode.getBoundingClientRect === 'function') {
            let clientX: number | undefined = e?.nativeEvent?.clientX ?? e?.clientX;
            let clientY: number | undefined = e?.nativeEvent?.clientY ?? e?.clientY;

            if (clientX == null && e?.nativeEvent?.pageX != null && typeof window !== 'undefined') {
                clientX = e.nativeEvent.pageX - (window.scrollX || 0);
            }
            if (clientY == null && e?.nativeEvent?.pageY != null && typeof window !== 'undefined') {
                clientY = e.nativeEvent.pageY - (window.scrollY || 0);
            }

            const { locationX, locationY } = e?.nativeEvent || {};
            const rect = domNode.getBoundingClientRect();
            if (rect && rect.width > 0 && rect.height > 0) {
                if (clientX == null && locationX != null) {
                    clientX = rect.left + locationX;
                }
                if (clientY == null && locationY != null) {
                    clientY = rect.top + locationY;
                }

                if (clientX != null && clientY != null) {
                    const relX = clientX - rect.left;
                    const relY = clientY - rect.top;
                    let x = -MARGIN_X + (relX / rect.width) * TOTAL_L;
                    let y = -MARGIN_Y + (relY / rect.height) * TOTAL_W;
                    if (flip) x = FIELD.L - x;
                    x = Math.max(-MARGIN_X, Math.min(FIELD.L + MARGIN_X, Math.round(x * 10) / 10));
                    y = Math.max(-MARGIN_Y, Math.min(FIELD.W + MARGIN_Y, Math.round(y * 10) / 10));
                    return { x, y };
                }
            }
        }

        const { locationX, locationY } = e?.nativeEvent || {};
        if (locationX == null || locationY == null) return null;
        const currentSize = isModal ? modalGrassSize : grassSize;
        const width = currentSize.width || (isModal ? 680 : inlineFieldWidth);
        const heightVal = currentSize.height || Math.round(width / FIELD_ASPECT_RATIO);
        let x = -MARGIN_X + (locationX / width) * TOTAL_L;
        let y = -MARGIN_Y + (locationY / heightVal) * TOTAL_W;
        if (flip) x = FIELD.L - x;
        x = Math.max(-MARGIN_X, Math.min(FIELD.L + MARGIN_X, Math.round(x * 10) / 10));
        y = Math.max(-MARGIN_Y, Math.min(FIELD.W + MARGIN_Y, Math.round(y * 10) / 10));
        return { x, y };
    };

    const handlePress = (e: GestureResponderEvent, isModal: boolean) => {
        if (!interactive || !onFieldPress || drawTrajectoryMode) return;
        const coord = getCoordFromEvent(e, isModal);
        if (coord) {
            setLastCoord(coord);
            onFieldPress(coord);
            if (isModal) setIsExpanded(false);
        }
    };

    const createPanResponder = (isModal: boolean) => {
        let initialPageX = 0;
        let initialPageY = 0;
        let initialLocX = 0;
        let initialLocY = 0;

        return PanResponder.create({
            onStartShouldSetPanResponder: () => !!drawTrajectoryMode && interactive,
            onMoveShouldSetPanResponder: () => !!drawTrajectoryMode && interactive,
            onStartShouldSetPanResponderCapture: () => !!drawTrajectoryMode && interactive,
            onMoveShouldSetPanResponderCapture: () => !!drawTrajectoryMode && interactive,
            onPanResponderGrant: (evt, gestureState) => {
                if (!interactive || !drawTrajectoryMode) return;
                initialPageX = evt.nativeEvent.pageX;
                initialPageY = evt.nativeEvent.pageY;
                initialLocX = evt.nativeEvent.locationX;
                initialLocY = evt.nativeEvent.locationY;
                const pt = getCoordFromEvent(evt, isModal, gestureState);
                if (pt) setActiveDrawingPts([pt]);
            },
            onPanResponderMove: (evt, gestureState) => {
                if (!interactive || !drawTrajectoryMode) return;
                const curLocX = initialLocX + (evt.nativeEvent.pageX - initialPageX);
                const curLocY = initialLocY + (evt.nativeEvent.pageY - initialPageY);
                const syntheticEvt = {
                    nativeEvent: {
                        locationX: curLocX,
                        locationY: curLocY,
                        pageX: evt.nativeEvent.pageX,
                        pageY: evt.nativeEvent.pageY
                    }
                };
                const pt = getCoordFromEvent(syntheticEvt, isModal, gestureState);
                if (pt) {
                    setActiveDrawingPts(prev => {
                        if (prev.length === 0) return [pt];
                        const last = prev[prev.length - 1];
                        if (Math.hypot(pt.x - last.x, pt.y - last.y) >= 0.35) {
                            return [...prev, pt];
                        }
                        return prev;
                    });
                }
            },
            onPanResponderRelease: (evt, gestureState) => {
                if (!interactive || !drawTrajectoryMode) return;
                const curLocX = initialLocX + (evt.nativeEvent.pageX - initialPageX);
                const curLocY = initialLocY + (evt.nativeEvent.pageY - initialPageY);
                const syntheticEvt = {
                    nativeEvent: {
                        locationX: curLocX,
                        locationY: curLocY,
                        pageX: evt.nativeEvent.pageX,
                        pageY: evt.nativeEvent.pageY
                    }
                };
                const pt = getCoordFromEvent(syntheticEvt, isModal, gestureState);
                setActiveDrawingPts(prev => {
                    let finalPts = prev;
                    if (pt) {
                        const last = prev[prev.length - 1];
                        if (!last || Math.hypot(pt.x - last.x, pt.y - last.y) >= 0.2) {
                            finalPts = [...prev, pt];
                        }
                    }
                    const totalDist = finalPts.reduce((sum, p, i) => i === 0 ? 0 : sum + Math.hypot(p.x - finalPts[i - 1].x, p.y - finalPts[i - 1].y), 0);
                    if (finalPts.length >= 2 && totalDist >= 1.5) {
                        setLastCoord(finalPts[finalPts.length - 1]);
                        if (onTrajectoryComplete) onTrajectoryComplete(finalPts);
                        if (isModal) setIsExpanded(false);
                    } else if (finalPts.length >= 1) {
                        setLastCoord(finalPts[0]);
                        if (onFieldPress) onFieldPress(finalPts[0]);
                        if (isModal) setIsExpanded(false);
                    }
                    return [];
                });
            }
        });
    };

    const panResponderInline = useMemo(() => createPanResponder(false), [interactive, drawTrajectoryMode, flip, grassSize]);
    const panResponderModal = useMemo(() => createPanResponder(true), [interactive, drawTrajectoryMode, flip, modalGrassSize]);

    // Funzioni helper per la conversione in pixel e generazione curve SVG con freccia
    const toCanvasPx = (p: { x: number; y: number }, size: { width: number; height: number }, isModal: boolean) => {
        const domNode = isModal ? modalDomRef.current : inlineDomRef.current;
        const domW = domNode?.clientWidth || domNode?.getBoundingClientRect?.()?.width;
        const domH = domNode?.clientHeight || domNode?.getBoundingClientRect?.()?.height;

        const w = size.width || domW || (isModal ? 680 : inlineFieldWidth);
        const h = size.height || domH || Math.round(w / FIELD_ASPECT_RATIO);
        const displayX = flip ? FIELD.L - p.x : p.x;
        const px = ((displayX + MARGIN_X) / TOTAL_L) * w;
        const py = ((p.y + MARGIN_Y) / TOTAL_W) * h;
        return { x: px, y: py };
    };

    const buildSmoothPath = (pxPts: { x: number; y: number }[]): string => {
        if (!pxPts || pxPts.length < 2) return '';
        if (pxPts.length === 2) {
            return `M ${pxPts[0].x.toFixed(1)} ${pxPts[0].y.toFixed(1)} L ${pxPts[1].x.toFixed(1)} ${pxPts[1].y.toFixed(1)}`;
        }
        let d = `M ${pxPts[0].x.toFixed(1)} ${pxPts[0].y.toFixed(1)}`;
        for (let i = 1; i < pxPts.length - 1; i++) {
            const xc = (pxPts[i].x + pxPts[i + 1].x) / 2;
            const yc = (pxPts[i].y + pxPts[i + 1].y) / 2;
            d += ` Q ${pxPts[i].x.toFixed(1)} ${pxPts[i].y.toFixed(1)}, ${xc.toFixed(1)} ${yc.toFixed(1)}`;
        }
        d += ` L ${pxPts[pxPts.length - 1].x.toFixed(1)} ${pxPts[pxPts.length - 1].y.toFixed(1)}`;
        return d;
    };

    const buildArrowHead = (pxPts: { x: number; y: number }[], arrowLen = 14, angleDeg = 28): string | null => {
        if (!pxPts || pxPts.length < 2) return null;
        const last = pxPts[pxPts.length - 1];
        let prev = pxPts[pxPts.length - 2];
        for (let i = pxPts.length - 2; i >= 0; i--) {
            const dist = Math.hypot(last.x - pxPts[i].x, last.y - pxPts[i].y);
            if (dist >= 8) {
                prev = pxPts[i];
                break;
            }
        }
        const angle = Math.atan2(last.y - prev.y, last.x - prev.x);
        const rad = (angleDeg * Math.PI) / 180;
        const p1x = last.x - arrowLen * Math.cos(angle - rad);
        const p1y = last.y - arrowLen * Math.sin(angle - rad);
        const p2x = last.x - arrowLen * Math.cos(angle + rad);
        const p2y = last.y - arrowLen * Math.sin(angle + rad);
        return `${last.x.toFixed(1)},${last.y.toFixed(1)} ${p1x.toFixed(1)},${p1y.toFixed(1)} ${p2x.toFixed(1)},${p2y.toFixed(1)}`;
    };

    // Label direzioni
    const leftLabel = isPlayMode ? 'DIFENDIAMO' : 'CHI LANCIA';
    const rightLabel = isPlayMode ? 'ATTACCHIAMO' : 'CHI RICEVE';
    const firstEnd = flip ? rightLabel : leftLabel;
    const secondEnd = flip ? leftLabel : rightLabel;

    const inlineFieldWidth = wrapperWidth > 0 ? wrapperWidth : 340;
    const inlineFieldHeight = height ? Math.round(height) : Math.round(inlineFieldWidth / FIELD_ASPECT_RATIO);

    // Dimensioni per il modale di ingrandimento (proporzioni fisse matematiche garantite in ogni modalità)
    const getModalDimensions = () => {
        const isSmallScreen = windowWidth < 600;
        const paddingX = isLandscape ? 32 : 16;
        // In landscape il chrome è una singola riga ultra-compatta (~44px) + footer compatto (~26px) = ~70px
        // In portrait su telefono il chrome è ~100px
        const chromeHeight = isLandscape ? 68 : (isSmallScreen ? 110 : 130);
        const availableW = Math.max(260, windowWidth - paddingX);
        const availableH = Math.max(120, windowHeight - chromeHeight);

        if (modalZoom === 'fit') {
            // Calcola le dimensioni massime che riempiono lo spazio senza mai sforare né in larghezza né in altezza
            let targetW = availableW;
            let targetH = Math.round(targetW / FIELD_ASPECT_RATIO);
            if (targetH > availableH) {
                targetH = availableH;
                targetW = Math.round(targetH * FIELD_ASPECT_RATIO);
            }
            return { width: targetW, height: targetH, scrollable: false };
        } else if (modalZoom === '1.5x') {
            const baseW = Math.min(availableW, availableH * FIELD_ASPECT_RATIO);
            const minW = isSmallScreen ? Math.round(windowWidth * 1.45) : 620;
            const targetW = Math.round(Math.max(baseW * 1.5, minW));
            const targetH = Math.round(targetW / FIELD_ASPECT_RATIO);
            return { width: targetW, height: targetH, scrollable: true };
        } else {
            // 2.2x Super Zoom
            const baseW = Math.min(availableW, availableH * FIELD_ASPECT_RATIO);
            const minW = isSmallScreen ? Math.round(windowWidth * 2.1) : 900;
            const targetW = Math.round(Math.max(baseW * 2.2, minW));
            const targetH = Math.round(targetW / FIELD_ASPECT_RATIO);
            return { width: targetW, height: targetH, scrollable: true };
        }
    };

    const renderRuler = (rulerWidth?: number) => {
        const marks = [
            { label: 'OB', meter: -MARGIN_X, color: '#DC2626' },
            { label: '0m', meter: 0 },
            { label: '15m', meter: 15 },
            { label: '30m', meter: 30 },
            { label: '37.5m', meter: 37.5 },
            { label: '45m', meter: 45 },
            { label: '60m', meter: 60 },
            { label: '75m', meter: 75 },
            { label: 'OB', meter: FIELD.L + MARGIN_X, color: '#DC2626' },
        ];

        return (
            <View style={[styles.rulerContainer, rulerWidth ? { width: rulerWidth } : { width: '100%' }]}>
                <View style={styles.rulerTrack}>
                    {marks.map((m, idx) => {
                        const pct = ((m.meter + MARGIN_X) / TOTAL_L) * 100;
                        return (
                            <View
                                key={idx}
                                style={[
                                    styles.rulerMarkWrapper,
                                    {
                                        left: `${pct}%`,
                                        transform: [{ translateX: pct < 5 ? 0 : pct > 95 ? -24 : -12 }]
                                    }
                                ]}
                            >
                                <View style={[styles.rulerTickLine, m.color ? { backgroundColor: m.color } : null]} />
                                <Text style={[styles.rulerTickText, m.color ? { color: m.color, fontWeight: '800' } : null]}>
                                    {m.label}
                                </Text>
                            </View>
                        );
                    })}
                </View>
                <View style={styles.footerLabels}>
                    <Text style={styles.footerText}>Meta 15m</Text>
                    <Text style={styles.footerText}>Campo: 45m (75m in campo) · Margini OB</Text>
                    <Text style={styles.footerText}>Meta 15m</Text>
                </View>
            </View>
        );
    };

    const renderFieldContent = (isModal = false, forcedW?: number, forcedH?: number) => {
        const effectiveW = forcedW || (isModal ? (modalGrassSize.width || 680) : inlineFieldWidth);
        const effectiveH = forcedH || Math.round(effectiveW / FIELD_ASPECT_RATIO);
        const outerStyle = {
            width: effectiveW,
            height: effectiveH,
            aspectRatio: FIELD_ASPECT_RATIO,
        };
        const currentSize = isModal ? modalGrassSize : grassSize;
        const panResp = isModal ? panResponderModal : panResponderInline;

        // Tutte le traiettorie da mostrare (salvate + quella attiva in disegno)
        const allTrajectories = [...trajectories];
        if (activeDrawingPts.length >= 2) {
            allTrajectories.push({ points: activeDrawingPts, color: drawingColor || '#C8323C' });
        }

        const webContainerStyle = Platform.OS === 'web' ? ({
            userSelect: 'none',
            touchAction: drawTrajectoryMode ? 'none' : 'auto',
            cursor: drawTrajectoryMode ? 'crosshair' : (interactive ? 'pointer' : 'default'),
        } as any) : null;

        return (
            <View style={[styles.fieldOuter, outerStyle]}>
                {/* Canvas complessivo (Campo regolamentare + Area Fuori Campo OB) */}
                <View
                    ref={node => {
                        if (isModal) {
                            (modalGrassRef as any).current = node;
                            modalDomRef.current = node;
                        } else {
                            (grassRef as any).current = node;
                            inlineDomRef.current = node;
                        }
                    }}
                    {...(Platform.OS !== 'web' && drawTrajectoryMode ? panResp.panHandlers : {})}
                    onLayout={e => {
                        const { width: w, height: h } = e.nativeEvent.layout;
                        const rw = Math.round(w);
                        const rh = Math.round(h);
                        if (rw <= 0 || rh <= 0) return;
                        if (isModal) {
                            setModalGrassSize(prev => (prev.width === rw && prev.height === rh ? prev : { width: rw, height: rh }));
                        } else {
                            setGrassSize(prev => (prev.width === rw && prev.height === rh ? prev : { width: rw, height: rh }));
                        }
                    }}
                    style={[styles.canvasContainer, webContainerStyle]}
                >
                    {/* Etichette discrete area Fuori Campo (OB) */}
                    <View pointerEvents="none" style={styles.obBannerTop}>
                        <Text style={styles.obBannerText}>FUORI (OB)</Text>
                    </View>
                    <View pointerEvents="none" style={styles.obBannerBottom}>
                        <Text style={styles.obBannerText}>FUORI (OB)</Text>
                    </View>
                    <View pointerEvents="none" style={styles.obBannerLeft}>
                        <Text style={styles.obBannerSideText}>OB</Text>
                    </View>
                    <View pointerEvents="none" style={styles.obBannerRight}>
                        <Text style={styles.obBannerSideText}>OB</Text>
                    </View>

                    {/* Rettangolo Campo di Gioco Effettivo (75m × 25m) */}
                    <View
                        pointerEvents="none"
                        style={[
                            styles.playingField,
                            {
                                left: `${(MARGIN_X / TOTAL_L) * 100}%`,
                                width: `${(FIELD.L / TOTAL_L) * 100}%`,
                                top: `${(MARGIN_Y / TOTAL_W) * 100}%`,
                                height: `${(FIELD.W / TOTAL_W) * 100}%`,
                            }
                        ]}
                    >
                        {/* Meta Sinistra (15m) */}
                        <View style={[styles.endZone, styles.leftEndZone]}>
                            <View style={styles.endZoneHeader}>
                                <Text style={styles.endZoneText}>{firstEnd}</Text>
                                <Text style={styles.endZoneSub}>META 15m</Text>
                            </View>
                        </View>

                        {/* Campo centrale (45m) */}
                        <View style={styles.centralField}>
                            {/* Linea di metà campo tratteggiata */}
                            <View style={styles.midfieldLine} />
                            <View style={styles.midfieldLabelBadge}>
                                <Text style={styles.midfieldLabelText}>37.5m</Text>
                            </View>


                            <View style={[styles.brickMark, { left: '15%' }]}>
                                <Text style={styles.brickCross}>✕</Text>
                                <Text style={styles.brickLabel}>BRICK</Text>
                            </View>
                            <View style={[styles.brickMark, { right: '15%' }]}>
                                <Text style={styles.brickCross}>✕</Text>
                                <Text style={styles.brickLabel}>BRICK</Text>
                            </View>

                            <Text style={styles.fieldNotice}>
                                {isPlayMode ? 'CAMPO DI GIOCO (45m)' : 'ZONA ATTERRAGGIO PULL (45m)'}
                            </Text>
                        </View>

                        {/* Meta Destra (15m) */}
                        <View style={[styles.endZone, styles.rightEndZone]}>
                            <View style={styles.endZoneHeader}>
                                <Text style={styles.endZoneText}>{secondEnd}</Text>
                                <Text style={styles.endZoneSub}>META 15m</Text>
                            </View>
                        </View>
                    </View>

                    {/* Layer SVG per le Traiettorie Curve con Freccia */}
                    <Svg
                        width="100%"
                        height="100%"
                        style={[StyleSheet.absoluteFill, { zIndex: 10 }]}
                        pointerEvents="box-none"
                    >
                        {allTrajectories.map((tr, tIdx) => {
                            if (!tr.points || tr.points.length < 2) return null;
                            const pxPts = tr.points.map(p => toCanvasPx(p, currentSize, isModal));
                            const pathData = buildSmoothPath(pxPts);
                            const arrowHead = buildArrowHead(pxPts);
                            const color = tr.color || '#C8323C';
                            const firstPt = pxPts[0];
                            const isClickable = !!(tr.onPress || onTrajectoryPress);

                            return (
                                <G
                                    key={`traj-${tIdx}`}
                                    onPress={isClickable ? () => {
                                        if (tr.onPress) tr.onPress();
                                        else if (onTrajectoryPress) onTrajectoryPress(tr);
                                    } : undefined}
                                >
                                    {/* Area di tocco allargata invisibile per facilitare il tap sulla traiettoria */}
                                    {isClickable && (
                                        <Path
                                            d={pathData}
                                            stroke="transparent"
                                            strokeWidth={22}
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            fill="none"
                                        />
                                    )}
                                    {/* Punto di rilascio iniziale del lancio */}
                                    <Circle
                                        cx={firstPt.x}
                                        cy={firstPt.y}
                                        r={4.5}
                                        fill="#ffffff"
                                        stroke={color}
                                        strokeWidth={2.5}
                                    />
                                    {/* Traiettoria Curva */}
                                    <Path
                                        d={pathData}
                                        stroke={color}
                                        strokeWidth={3.5}
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        fill="none"
                                    />
                                    {/* Freccia orientata verso il punto di caduta */}
                                    {arrowHead && (
                                        <Polygon
                                            points={arrowHead}
                                            fill={color}
                                        />
                                    )}
                                </G>
                            );
                        })}
                        {activeDrawingPts.length === 1 && (() => {
                            const p0 = toCanvasPx(activeDrawingPts[0], currentSize, isModal);
                            return (
                                <Circle
                                    cx={p0.x}
                                    cy={p0.y}
                                    r={5}
                                    fill="#ffffff"
                                    stroke={drawingColor || '#C8323C'}
                                    strokeWidth={3}
                                />
                            );
                        })()}
                    </Svg>

                    {/* Rendering dei punti/marker (in campo o fuori campo!) */}
                    {dots.map((d, index) => {
                        const displayX = flip ? FIELD.L - d.x : d.x;
                        const leftPercent = `${((displayX + MARGIN_X) / TOTAL_L) * 100}%`;
                        const topPercent = `${((d.y + MARGIN_Y) / TOTAL_W) * 100}%`;
                        const size = Math.round((d.r || 1) * 16);
                        const ob = isOB(d);
                        const isClickable = !!(d.onPress || onDotPress);
                        return (
                            <TouchableOpacity
                                key={index}
                                disabled={!isClickable}
                                activeOpacity={0.7}
                                onPress={() => {
                                    if (d.onPress) d.onPress();
                                    else if (onDotPress) onDotPress(d);
                                }}
                                style={[
                                    styles.dot,
                                    {
                                        left: leftPercent as any,
                                        top: topPercent as any,
                                        backgroundColor: d.c,
                                        borderColor: ob ? '#FF3B30' : '#ffffff',
                                        borderWidth: ob ? 2.5 : 2,
                                        width: size,
                                        height: size,
                                        borderRadius: size / 2,
                                        transform: [{ translateX: -size / 2 }, { translateY: -size / 2 }],
                                        zIndex: isClickable ? 150 : 10,
                                    }
                                ]}
                            >
                                <Text style={styles.dotLabel}>
                                    {d.label || (ob ? 'OB' : '')}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}

                    {/* Layer interattivo di tocco: posizionato come ultimo figlio solo se in modalità cattura coordinate sul campo */}
                    {!drawTrajectoryMode && interactive && (
                        <TouchableOpacity
                            activeOpacity={0.92}
                            onPress={e => handlePress(e, isModal)}
                            style={[StyleSheet.absoluteFill, { zIndex: 100 }]}
                        />
                    )}
                </View>
            </View>
        );
    };

    return (
        <View
            style={styles.wrapper}
            onLayout={(e: LayoutChangeEvent) => {
                const w = Math.floor(e.nativeEvent.layout.width);
                if (w > 0 && Math.abs(w - wrapperWidth) > 1) {
                    setWrapperWidth(w);
                }
            }}
        >
            <View style={styles.directionHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Text style={styles.directionText}>
                        {flip ? `◀ ${secondEnd}` : `▶ ${secondEnd}`}
                    </Text>
                    <Text style={styles.dimensionBadge}>75 × 25 m (+OB)</Text>
                </View>

                <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                    {onFlipDirection && (
                        <TouchableOpacity style={styles.flipButton} onPress={onFlipDirection} activeOpacity={0.7}>
                            <Text style={styles.flipButtonText}>⇄ Gira</Text>
                        </TouchableOpacity>
                    )}
                    {enlargeable && (
                        <TouchableOpacity
                            style={styles.expandButton}
                            onPress={() => setIsExpanded(true)}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.expandButtonText}>⛶ Ingrandisci</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {renderFieldContent(false, inlineFieldWidth, inlineFieldHeight)}

            {/* Scala metrica di riferimento (con indicazione Fuori Campo OB) */}
            {renderRuler(inlineFieldWidth)}

            {interactive && lastCoord && (
                <View style={styles.coordFeedback}>
                    <Text style={[styles.coordFeedbackText, isOB(lastCoord) && styles.coordFeedbackOB]}>
                        Ultimo tocco: X={lastCoord.x}m · Y={lastCoord.y}m {isOB(lastCoord) ? '⚠️ FUORI CAMPO (OB)' : '✓ IN CAMPO'}
                    </Text>
                </View>
            )}

            {/* Modale Vista Ingrandita Campo - Esperienza immersiva a schermo intero ad alta definizione */}
            {isExpanded && (
                <Modal visible={true} animationType="slide" transparent={false} onRequestClose={() => setIsExpanded(false)}>
                    <SafeAreaView style={styles.modalScreen} edges={['top', 'bottom', 'left', 'right']}>
                        {/* Header responsivo per telefono e PC */}
                        {isLandscape ? (
                            <View style={styles.modalLandscapeHeader}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Text style={styles.modalTitle}>
                                        {isPlayMode ? 'Mappa Tattica' : 'Mappa Pull'}
                                    </Text>
                                    <Text style={styles.modalDirectionBadge}>
                                        {flip ? `◀ ${secondEnd}` : `▶ ${secondEnd}`}
                                    </Text>
                                </View>

                                <View style={styles.zoomSegment}>
                                    <TouchableOpacity
                                        style={[styles.zoomBtn, modalZoom === 'fit' && styles.zoomBtnActive]}
                                        onPress={() => setModalZoom('fit')}
                                    >
                                        <Text style={[styles.zoomBtnText, modalZoom === 'fit' && styles.zoomBtnTextActive]}>Adatta</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.zoomBtn, modalZoom === '1.5x' && styles.zoomBtnActive]}
                                        onPress={() => setModalZoom('1.5x')}
                                    >
                                        <Text style={[styles.zoomBtnText, modalZoom === '1.5x' && styles.zoomBtnTextActive]}>1.5x</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.zoomBtn, modalZoom === '2.2x' && styles.zoomBtnActive]}
                                        onPress={() => setModalZoom('2.2x')}
                                    >
                                        <Text style={[styles.zoomBtnText, modalZoom === '2.2x' && styles.zoomBtnTextActive]}>2.2x</Text>
                                    </TouchableOpacity>
                                </View>

                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    {onFlipDirection && (
                                        <TouchableOpacity style={styles.modalActionBtn} onPress={onFlipDirection}>
                                            <Text style={styles.modalActionBtnText}>⇄ Gira</Text>
                                        </TouchableOpacity>
                                    )}
                                    <TouchableOpacity
                                        style={styles.modalCloseBtn}
                                        onPress={() => setIsExpanded(false)}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={styles.modalCloseBtnText}>✕ Chiudi</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : (
                            <View style={styles.modalPortraitHeader}>
                                <View style={styles.modalPortraitRow1}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Text style={styles.modalTitle}>
                                            {isPlayMode ? 'Mappa Tattica' : 'Mappa Pull'}
                                        </Text>
                                        <View style={styles.dimensionBadgeDark}>
                                            <Text style={styles.dimensionBadgeDarkText}>75×25m (+OB)</Text>
                                        </View>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.modalCloseBtn}
                                        onPress={() => setIsExpanded(false)}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={styles.modalCloseBtnText}>✕ Chiudi</Text>
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.modalPortraitRow2}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Text style={styles.modalDirectionText}>
                                            {flip ? `◀ ${secondEnd}` : `▶ ${secondEnd}`}
                                        </Text>
                                        {onFlipDirection && (
                                            <TouchableOpacity style={styles.modalActionBtn} onPress={onFlipDirection}>
                                                <Text style={styles.modalActionBtnText}>⇄ Gira</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>

                                    <View style={styles.zoomSegment}>
                                        <TouchableOpacity
                                            style={[styles.zoomBtn, modalZoom === 'fit' && styles.zoomBtnActive]}
                                            onPress={() => setModalZoom('fit')}
                                        >
                                            <Text style={[styles.zoomBtnText, modalZoom === 'fit' && styles.zoomBtnTextActive]}>📱 Adatta</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.zoomBtn, modalZoom === '1.5x' && styles.zoomBtnActive]}
                                            onPress={() => setModalZoom('1.5x')}
                                        >
                                            <Text style={[styles.zoomBtnText, modalZoom === '1.5x' && styles.zoomBtnTextActive]}>1.5x</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.zoomBtn, modalZoom === '2.2x' && styles.zoomBtnActive]}
                                            onPress={() => setModalZoom('2.2x')}
                                        >
                                            <Text style={[styles.zoomBtnText, modalZoom === '2.2x' && styles.zoomBtnTextActive]}>2.2x</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        )}

                        {/* Area centrale con campo ingrandito a proporzioni fisse matematiche */}
                        <View style={styles.modalContentArea}>
                            {(() => {
                                const { width: mW, height: mH, scrollable } = getModalDimensions();
                                const content = (
                                    <View style={{ width: mW, alignItems: 'center' }}>
                                        {renderFieldContent(true, mW, mH)}
                                        {renderRuler(mW)}
                                    </View>
                                );

                                if (scrollable) {
                                    return (
                                        <ScrollView
                                            horizontal
                                            showsHorizontalScrollIndicator={true}
                                            contentContainerStyle={styles.modalScrollContent}
                                        >
                                            {content}
                                        </ScrollView>
                                    );
                                }

                                return (
                                    <View style={styles.modalFitContent}>
                                        {content}
                                    </View>
                                );
                            })()}
                        </View>

                        {/* Footer informativo e chiusura */}
                        <View style={styles.modalFooter}>
                            {interactive && lastCoord ? (
                                <Text style={[styles.coordFeedbackText, isOB(lastCoord) && styles.coordFeedbackOB]}>
                                    Ultimo tocco: X={lastCoord.x}m · Y={lastCoord.y}m {isOB(lastCoord) ? '⚠️ FUORI CAMPO (OB)' : '✓ IN CAMPO'}
                                </Text>
                            ) : (
                                <Text style={styles.modalHintText} numberOfLines={1}>
                                    {windowWidth < windowHeight
                                        ? '💡 Ruota il telefono in orizzontale per sfruttare tutto lo schermo'
                                        : '💡 Proporzioni reali fisse 87m × 35m (campo 75×25 + margini OB)'}
                                </Text>
                            )}
                        </View>
                    </SafeAreaView>
                </Modal>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        width: '100%',
        marginVertical: 6,
    },
    directionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
        flexWrap: 'wrap',
        gap: 6,
    },
    directionText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#003057',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    dimensionBadge: {
        fontSize: 10,
        fontWeight: '700',
        color: '#555',
        backgroundColor: '#EAEAEA',
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 4,
    },
    flipButton: {
        backgroundColor: '#E2E8F0',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 6,
    },
    flipButtonText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#1E293B',
    },
    expandButton: {
        backgroundColor: '#003057',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 6,
    },
    expandButtonText: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#fff',
    },
    fieldOuter: {
        backgroundColor: '#D1C2A5', // sabbia esterna (zona fuori campo OB)
        borderRadius: 10,
        borderWidth: 2,
        borderColor: '#0F172A',
        position: 'relative',
        overflow: 'hidden',
        padding: 0,
    },
    canvasContainer: {
        width: '100%',
        height: '100%',
        backgroundColor: '#D1C2A5',
        position: 'relative',
        borderRadius: 8,
        overflow: 'hidden',
    },
    obBannerTop: {
        position: 'absolute',
        top: 1,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 1,
    },
    obBannerBottom: {
        position: 'absolute',
        bottom: 1,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 1,
    },
    obBannerText: {
        fontSize: 7,
        fontWeight: '800',
        color: '#827156',
        letterSpacing: 1.2,
    },
    obBannerLeft: {
        position: 'absolute',
        top: '50%',
        left: 2,
        marginTop: -6,
        zIndex: 1,
    },
    obBannerRight: {
        position: 'absolute',
        top: '50%',
        right: 2,
        marginTop: -6,
        zIndex: 1,
    },
    obBannerSideText: {
        fontSize: 7,
        fontWeight: '900',
        color: '#827156',
    },
    playingField: {
        position: 'absolute',
        backgroundColor: '#F5ECCF', // sabbia campo regolamentare
        flexDirection: 'row',
        borderWidth: 2,
        borderColor: '#0F172A',
        borderRadius: 4,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.15,
        shadowRadius: 3,
        elevation: 3,
    },
    endZone: {
        width: `${(FIELD.EZ / FIELD.L) * 100}%`,
        height: '100%',
        backgroundColor: '#E6D7B4',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 2,
    },
    leftEndZone: {
        borderRightWidth: 2,
        borderRightColor: '#0F172A',
    },
    rightEndZone: {
        borderLeftWidth: 2,
        borderLeftColor: '#0F172A',
    },
    endZoneHeader: {
        alignItems: 'center',
    },
    endZoneText: {
        fontSize: 9,
        fontWeight: '900',
        color: 'rgba(30, 41, 59, 0.45)',
        textAlign: 'center',
        letterSpacing: 0.5,
    },
    endZoneSub: {
        fontSize: 7,
        fontWeight: 'bold',
        color: 'rgba(100, 116, 139, 0.45)',
        marginTop: 2,
    },
    centralField: {
        flex: 1,
        height: '100%',
        position: 'relative',
        justifyContent: 'center',
        alignItems: 'center',
    },
    midfieldLine: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: '50%',
        width: 1.5,
        backgroundColor: 'rgba(15, 23, 42, 0.35)',
    },
    midfieldLabelBadge: {
        position: 'absolute',
        top: 3,
        backgroundColor: 'rgba(255, 255, 255, 0.85)',
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 3,
    },
    midfieldLabelText: {
        fontSize: 7,
        fontWeight: '700',
        color: '#475569',
    },
    brickMark: {
        position: 'absolute',
        top: '50%',
        marginTop: -10,
        alignItems: 'center',
    },
    brickCross: {
        fontSize: 10,
        color: 'rgba(200, 50, 60, 0.45)',
        fontWeight: '900',
    },
    brickLabel: {
        fontSize: 7,
        fontWeight: 'bold',
        color: 'rgba(71, 85, 105, 0.45)',
        marginTop: -2,
    },
    fieldNotice: {
        fontSize: 8,
        fontWeight: 'bold',
        color: '#64748B',
        opacity: 0.35,
        letterSpacing: 0.8,
    },
    dot: {
        position: 'absolute',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.45,
        shadowRadius: 3,
        elevation: 6,
        zIndex: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dotLabel: {
        fontSize: 7,
        fontWeight: '900',
        color: '#fff',
    },
    rulerContainer: {
        marginTop: 6,
        position: 'relative',
    },
    rulerTrack: {
        position: 'relative',
        height: 18,
        borderTopWidth: 1,
        borderTopColor: '#CBD5E1',
    },
    rulerMarkWrapper: {
        position: 'absolute',
        top: 0,
        alignItems: 'center',
        width: 28,
    },
    rulerTickLine: {
        width: 1.5,
        height: 4,
        backgroundColor: '#94A3B8',
        marginBottom: 1,
    },
    rulerTickText: {
        fontSize: 8,
        fontWeight: '600',
        color: '#64748B',
    },
    footerLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 2,
        paddingHorizontal: 4,
    },
    footerText: {
        fontSize: 10,
        color: '#64748B',
    },
    coordFeedback: {
        marginTop: 6,
        alignItems: 'center',
    },
    coordFeedbackText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#003057',
        backgroundColor: '#E0F2FE',
        paddingHorizontal: 12,
        paddingVertical: 3,
        borderRadius: 12,
    },
    coordFeedbackOB: {
        color: '#DC2626',
        backgroundColor: '#FEE2E2',
    },
    modalScreen: {
        flex: 1,
        backgroundColor: '#0F172A', // Slate 900 scuro da console professionale
        overflow: 'hidden',
    },
    modalLandscapeHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderBottomWidth: 1,
        borderBottomColor: '#1E293B',
    },
    modalPortraitHeader: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderBottomWidth: 1,
        borderBottomColor: '#1E293B',
        gap: 6,
    },
    modalPortraitRow1: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    modalPortraitRow2: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    modalTitle: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#F8FAFC',
    },
    modalDirectionBadge: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#38BDF8',
        backgroundColor: '#1E293B',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        textTransform: 'uppercase',
    },
    dimensionBadgeDark: {
        backgroundColor: '#1E293B',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#334155',
    },
    dimensionBadgeDarkText: {
        fontSize: 9,
        fontWeight: '700',
        color: '#94A3B8',
    },
    modalCloseBtn: {
        backgroundColor: '#EF4444',
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 6,
    },
    modalCloseBtnText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 12,
    },
    modalDirectionText: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#38BDF8',
        textTransform: 'uppercase',
    },
    modalActionBtn: {
        backgroundColor: '#1E293B',
        borderWidth: 1,
        borderColor: '#334155',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    modalActionBtnText: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#F8FAFC',
    },
    zoomSegment: {
        flexDirection: 'row',
        backgroundColor: '#1E293B',
        borderRadius: 6,
        padding: 2,
        borderWidth: 1,
        borderColor: '#334155',
    },
    zoomBtn: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    zoomBtnActive: {
        backgroundColor: '#0284C7',
    },
    zoomBtnText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#94A3B8',
    },
    zoomBtnTextActive: {
        color: '#FFFFFF',
        fontWeight: 'bold',
    },
    modalContentArea: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 4,
        overflow: 'hidden',
    },
    modalScrollContent: {
        alignItems: 'center',
        paddingHorizontal: 16,
    },
    modalFitContent: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 8,
    },
    modalFooter: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        alignItems: 'center',
    },
    modalHintText: {
        fontSize: 10,
        color: '#94A3B8',
        textAlign: 'center',
    },
});


