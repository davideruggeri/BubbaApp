import { useState, useEffect, useMemo, MutableRefObject } from 'react';
import { Platform, PanResponder, GestureResponderEvent } from 'react-native';
import { FIELD } from '../../utils/statsEngine';
import { MARGIN_X, MARGIN_Y, TOTAL_L, TOTAL_W } from './fieldTypes';
import { getCoordFromEvent } from './fieldMath';

interface UseFieldGesturesOptions {
    interactive: boolean;
    drawTrajectoryMode: boolean;
    flip: boolean;
    isExpanded: boolean;
    inlineDomRef: MutableRefObject<any>;
    modalDomRef: MutableRefObject<any>;
    grassSize: { width: number; height: number };
    modalGrassSize: { width: number; height: number };
    inlineFieldWidth: number;
    onFieldPress?: (coord: { x: number; y: number }) => void;
    onTrajectoryComplete?: (trajectory: { x: number; y: number }[]) => void;
    setIsExpanded: (expanded: boolean) => void;
    setLastCoord: (coord: { x: number; y: number } | null) => void;
}

export function useFieldGestures({
    interactive,
    drawTrajectoryMode,
    flip,
    isExpanded,
    inlineDomRef,
    modalDomRef,
    grassSize,
    modalGrassSize,
    inlineFieldWidth,
    onFieldPress,
    onTrajectoryComplete,
    setIsExpanded,
    setLastCoord
}: UseFieldGesturesOptions) {
    const [activeDrawingPts, setActiveDrawingPts] = useState<{ x: number; y: number }[]>([]);

    // Gestione nativa Pointer/Mouse Events per browser Web da PC
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
    }, [drawTrajectoryMode, interactive, flip, isExpanded, onFieldPress, onTrajectoryComplete, setIsExpanded, setLastCoord, inlineDomRef, modalDomRef]);

    const handlePress = (e: GestureResponderEvent, isModal: boolean) => {
        if (!interactive || !onFieldPress || drawTrajectoryMode) return;
        const rawNode = isModal ? modalDomRef.current : inlineDomRef.current;
        const currentSize = isModal ? modalGrassSize : grassSize;
        const coord = getCoordFromEvent(e, rawNode, isModal, currentSize, flip, inlineFieldWidth);
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
            onPanResponderGrant: (evt) => {
                if (!interactive || !drawTrajectoryMode) return;
                initialPageX = evt.nativeEvent.pageX;
                initialPageY = evt.nativeEvent.pageY;
                initialLocX = evt.nativeEvent.locationX;
                initialLocY = evt.nativeEvent.locationY;
                const rawNode = isModal ? modalDomRef.current : inlineDomRef.current;
                const currentSize = isModal ? modalGrassSize : grassSize;
                const pt = getCoordFromEvent(evt, rawNode, isModal, currentSize, flip, inlineFieldWidth);
                if (pt) setActiveDrawingPts([pt]);
            },
            onPanResponderMove: (evt) => {
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
                const rawNode = isModal ? modalDomRef.current : inlineDomRef.current;
                const currentSize = isModal ? modalGrassSize : grassSize;
                const pt = getCoordFromEvent(syntheticEvt, rawNode, isModal, currentSize, flip, inlineFieldWidth);
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
            onPanResponderRelease: (evt) => {
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
                const rawNode = isModal ? modalDomRef.current : inlineDomRef.current;
                const currentSize = isModal ? modalGrassSize : grassSize;
                const pt = getCoordFromEvent(syntheticEvt, rawNode, isModal, currentSize, flip, inlineFieldWidth);
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

    const panResponderInline = useMemo(() => createPanResponder(false), [interactive, drawTrajectoryMode, flip, grassSize, inlineFieldWidth]);
    const panResponderModal = useMemo(() => createPanResponder(true), [interactive, drawTrajectoryMode, flip, modalGrassSize, inlineFieldWidth]);

    return {
        activeDrawingPts,
        setActiveDrawingPts,
        handlePress,
        panResponderInline,
        panResponderModal
    };
}
