import React, { useState } from 'react';
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    ScrollView,
    useWindowDimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { isOB } from '../../utils/statsEngine';
import { FIELD_ASPECT_RATIO } from './fieldTypes';
import { fieldStyles as styles } from './fieldStyles';
import { FieldRuler } from './FieldRuler';

interface FieldExpandedModalProps {
    visible: boolean;
    onClose: () => void;
    isPlayMode: boolean;
    flip: boolean;
    secondEnd: string;
    onFlipDirection?: () => void;
    interactive: boolean;
    lastCoord: { x: number; y: number } | null;
    renderFieldContent: (isModal: boolean, forcedW?: number, forcedH?: number) => React.ReactNode;
}

export const FieldExpandedModal: React.FC<FieldExpandedModalProps> = ({
    visible,
    onClose,
    isPlayMode,
    flip,
    secondEnd,
    onFlipDirection,
    interactive,
    lastCoord,
    renderFieldContent
}) => {
    const { width: windowWidth, height: windowHeight } = useWindowDimensions();
    const isLandscape = windowWidth > windowHeight;
    const [modalZoom, setModalZoom] = useState<'fit' | '1.5x' | '2.2x'>('fit');

    if (!visible) return null;

    const getModalDimensions = () => {
        const isSmallScreen = windowWidth < 600;
        const paddingX = isLandscape ? 32 : 16;
        const chromeHeight = isLandscape ? 68 : (isSmallScreen ? 110 : 130);
        const availableW = Math.max(260, windowWidth - paddingX);
        const availableH = Math.max(120, windowHeight - chromeHeight);

        if (modalZoom === 'fit') {
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
            const baseW = Math.min(availableW, availableH * FIELD_ASPECT_RATIO);
            const minW = isSmallScreen ? Math.round(windowWidth * 2.1) : 900;
            const targetW = Math.round(Math.max(baseW * 2.2, minW));
            const targetH = Math.round(targetW / FIELD_ASPECT_RATIO);
            return { width: targetW, height: targetH, scrollable: true };
        }
    };

    const { width: mW, height: mH, scrollable } = getModalDimensions();
    const content = (
        <View style={{ width: mW, alignItems: 'center' }}>
            {renderFieldContent(true, mW, mH)}
            <FieldRuler rulerWidth={mW} />
        </View>
    );

    return (
        <Modal visible={true} animationType="slide" transparent={false} onRequestClose={onClose}>
            <SafeAreaView style={styles.modalScreen} edges={['top', 'bottom', 'left', 'right']}>
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
                                onPress={onClose}
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
                                onPress={onClose}
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

                <View style={styles.modalContentArea}>
                    {scrollable ? (
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={true}
                            contentContainerStyle={styles.modalScrollContent}
                        >
                            {content}
                        </ScrollView>
                    ) : (
                        <View style={styles.modalFitContent}>
                            {content}
                        </View>
                    )}
                </View>

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
    );
};
