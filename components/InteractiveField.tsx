// components/InteractiveField.tsx
// Componente campo interattivo per la registrazione di Pull e Turnover/Difese con supporto Fuori Campo (OB) e Traiettorie Curve
import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Platform, StyleSheet, LayoutChangeEvent } from 'react-native';
import { isOB } from '../utils/statsEngine';
import {
    FieldDot,
    FieldTrajectory,
    InteractiveFieldProps,
    FIELD_ASPECT_RATIO,
    fieldStyles as styles,
    useFieldGestures,
    FieldRuler,
    FieldBackground,
    FieldSvgTrajectories,
    FieldDotsLayer,
    FieldExpandedModal
} from './field';

export type { FieldDot, FieldTrajectory, InteractiveFieldProps };
export { FIELD_ASPECT_RATIO };

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

    const [isExpanded, setIsExpanded] = useState(false);
    const [wrapperWidth, setWrapperWidth] = useState<number>(0);
    const [grassSize, setGrassSize] = useState({ width: 0, height: 0 });
    const [modalGrassSize, setModalGrassSize] = useState({ width: 0, height: 0 });
    const [lastCoord, setLastCoord] = useState<{ x: number; y: number } | null>(null);

    const inlineFieldWidth = wrapperWidth > 0 ? wrapperWidth : 340;
    const inlineFieldHeight = height ? Math.round(height) : Math.round(inlineFieldWidth / FIELD_ASPECT_RATIO);

    const {
        activeDrawingPts,
        handlePress,
        panResponderInline,
        panResponderModal
    } = useFieldGestures({
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
    });

    // Label direzioni
    const leftLabel = isPlayMode ? 'DIFENDIAMO' : 'CHI LANCIA';
    const rightLabel = isPlayMode ? 'ATTACCHIAMO' : 'CHI RICEVE';
    const firstEnd = flip ? rightLabel : leftLabel;
    const secondEnd = flip ? leftLabel : rightLabel;

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
        const domNode = isModal ? modalDomRef.current : inlineDomRef.current;

        const webContainerStyle = Platform.OS === 'web' ? ({
            userSelect: 'none',
            touchAction: drawTrajectoryMode ? 'none' : 'auto',
            cursor: drawTrajectoryMode ? 'crosshair' : (interactive ? 'pointer' : 'default'),
        } as any) : null;

        return (
            <View style={[styles.fieldOuter, outerStyle]}>
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
                    <FieldBackground
                        firstEnd={firstEnd}
                        secondEnd={secondEnd}
                        isPlayMode={isPlayMode}
                    />

                    <FieldSvgTrajectories
                        trajectories={trajectories}
                        activeDrawingPts={activeDrawingPts}
                        drawingColor={drawingColor}
                        currentSize={currentSize}
                        isModal={isModal}
                        domNode={domNode}
                        flip={flip}
                        fallbackW={inlineFieldWidth}
                        onTrajectoryPress={onTrajectoryPress}
                    />

                    <FieldDotsLayer
                        dots={dots}
                        flip={flip}
                        onDotPress={onDotPress}
                    />

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

            <FieldRuler rulerWidth={inlineFieldWidth} />

            {interactive && lastCoord && (
                <View style={styles.coordFeedback}>
                    <Text style={[styles.coordFeedbackText, isOB(lastCoord) && styles.coordFeedbackOB]}>
                        Ultimo tocco: X={lastCoord.x}m · Y={lastCoord.y}m {isOB(lastCoord) ? '⚠️ FUORI CAMPO (OB)' : '✓ IN CAMPO'}
                    </Text>
                </View>
            )}

            <FieldExpandedModal
                visible={isExpanded}
                onClose={() => setIsExpanded(false)}
                isPlayMode={isPlayMode}
                flip={flip}
                secondEnd={secondEnd}
                onFlipDirection={onFlipDirection}
                interactive={interactive}
                lastCoord={lastCoord}
                renderFieldContent={renderFieldContent}
            />
        </View>
    );
}
