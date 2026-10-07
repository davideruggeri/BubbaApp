// components/liveMatch/ScoreProgressionChart.tsx
// Grafico a punti e linee dell'andamento punteggio della partita (Asse X: Mete, Asse Y: Punteggio)

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useWindowDimensions } from 'react-native';
import Svg, { Line, Circle, Polyline, Text as SvgText, G, Rect } from 'react-native-svg';
import { useTheme } from '../../context/ThemeContext';

interface ScoreProgressionChartProps {
    points: any[];
    opponentName: string;
    isMobile: boolean;
    P?: (id: string) => { name: string; g: 'M' | 'F' };
}

interface ProgressionStep {
    goalNumber: number;
    us: number;
    them: number;
    winner: 'us' | 'them';
    isBreak: boolean;
    breakTeam?: 'us' | 'them';
    isCleanHold?: boolean;
    scorerName?: string;
    assistName?: string;
}

export const ScoreProgressionChart: React.FC<ScoreProgressionChartProps> = ({
    points,
    opponentName,
    isMobile,
    P
}) => {
    const { theme } = useTheme();
    const { width: windowWidth } = useWindowDimensions();
    const [selectedStep, setSelectedStep] = useState<ProgressionStep | null>(null);
    const [isCompact, setIsCompact] = useState<boolean>(isMobile);
    const [cardWidth, setCardWidth] = useState<number>(0);

    // Costruzione sequenza progressiva dei punteggi
    const steps: ProgressionStep[] = [{ goalNumber: 0, us: 0, them: 0, winner: 'us', isBreak: false }];
    let curUs = 0;
    let curThem = 0;

    for (const pt of (points || [])) {
        if (!pt || (pt.result !== 'us' && pt.result !== 'them')) continue;

        if (pt.result === 'us') curUs++;
        else if (pt.result === 'them') curThem++;

        // Un break avviene quando chi parte in difesa fa meta
        // pt.o === true -> attacco Bubba; pt.o === false -> difesa Bubba
        const isBubbaBreak = pt.result === 'us' && !pt.o;
        const isThemBreak = pt.result === 'them' && !!pt.o;
        const isBreak = isBubbaBreak || isThemBreak;
        const breakTeam = isBubbaBreak ? 'us' : isThemBreak ? 'them' : undefined;

        let scorerName: string | undefined = undefined;
        let assistName: string | undefined = undefined;

        if (P && pt.ev) {
            const goalEv = pt.ev.find((e: any) => e.k === 'goal');
            const callEv = pt.ev.find((e: any) => e.k === 'call');
            if (goalEv) {
                if (goalEv.s) scorerName = P(goalEv.s).name;
                if (goalEv.a) assistName = P(goalEv.a).name;
            } else if (callEv && callEv.p) {
                scorerName = `${P(callEv.p).name} (Callahan)`;
            }
        }

        steps.push({
            goalNumber: steps.length,
            us: curUs,
            them: curThem,
            winner: pt.result,
            isBreak,
            breakTeam,
            isCleanHold: pt.result === 'us' && pt.o && pt.toUs === 0,
            scorerName,
            assistName,
        });
    }

    const totalGoals = steps.length - 1;

    if (totalGoals === 0) {
        return (
            <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Andamento Partita</Text>
                <Text style={{ fontSize: 12, color: theme.colors.textSecondary, textAlign: 'center', paddingVertical: 18 }}>
                    Nessuna meta registrata finora. Il grafico mostrerà l'evoluzione del punteggio meta dopo meta.
                </Text>
            </View>
        );
    }

    const maxScore = Math.max(curUs, curThem, 1);
    const yTickInterval = maxScore <= 8 ? 1 : maxScore <= 15 ? 2 : 3;
    const yTicks: number[] = [];
    for (let v = 0; v <= maxScore + 1; v += yTickInterval) {
        yTicks.push(v);
    }
    const yMaxDisplay = yTicks[yTicks.length - 1];

    // Dimensioni grafico
    const chartHeight = 215;
    const paddingLeft = 38;
    const paddingRight = 24;
    const paddingTop = 26;
    const paddingBottom = 38;

    const innerHeight = chartHeight - paddingTop - paddingBottom;
    const availableCardWidth = cardWidth > 0 ? cardWidth - 28 : (windowWidth - (isMobile ? 56 : 80));

    const innerWidth = isCompact
        ? Math.max(availableCardWidth - paddingLeft - paddingRight, 100)
        : Math.max((totalGoals + 1) * (isMobile ? Math.max(34, Math.min(50, (windowWidth - 70) / (totalGoals + 1))) : 46), windowWidth - (isMobile ? 80 : 120));

    const totalSvgWidth = innerWidth + paddingLeft + paddingRight;
    const stepWidth = isCompact
        ? innerWidth / totalGoals
        : (isMobile ? Math.max(34, Math.min(50, (windowWidth - 70) / (totalGoals + 1))) : 46);

    // Funzioni conversione coordinate
    const getX = (goalIdx: number) => paddingLeft + (goalIdx / totalGoals) * innerWidth;
    const getY = (score: number) => paddingTop + innerHeight - (score / yMaxDisplay) * innerHeight;

    // Punti per polilinee
    const usPolyPoints = steps.map(s => `${getX(s.goalNumber)},${getY(s.us)}`).join(' ');
    const themPolyPoints = steps.map(s => `${getX(s.goalNumber)},${getY(s.them)}`).join(' ');

    const bubbaColor = '#1F6FD1';
    const oppColor = '#E07A1F';

    return (
        <View
            style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
            onLayout={e => setCardWidth(e.nativeEvent.layout.width)}
        >
            {/* Header del Grafico con Switch Vista (Compatta / Ampia) */}
            <View style={{ marginBottom: 8, gap: 8 }}>
                {/* Riga Superiore: Titolo e Switch */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <View>
                        <Text style={[styles.cardTitle, { color: theme.colors.text, marginBottom: 1 }]}>
                            Andamento Partita
                        </Text>
                        <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>
                            Progressione del punteggio punto per punto
                        </Text>
                    </View>

                    {/* Switch Visualizzazione Compatta / Ampia */}
                    <View style={{
                        flexDirection: 'row',
                        backgroundColor: theme.dark ? '#334155' : '#E2E8F0',
                        borderRadius: 8,
                        padding: 2,
                        borderWidth: 1,
                        borderColor: theme.dark ? '#475569' : '#CBD5E1',
                    }}>
                        <TouchableOpacity
                            onPress={() => setIsCompact(true)}
                            style={{
                                paddingHorizontal: 8,
                                paddingVertical: 4,
                                borderRadius: 6,
                                backgroundColor: isCompact ? theme.colors.card : 'transparent'
                            }}
                        >
                            <Text style={{
                                fontSize: 11,
                                fontWeight: isCompact ? '800' : '600',
                                color: isCompact ? theme.colors.primary : theme.colors.textSecondary
                            }}>
                                📱 Intera
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setIsCompact(false)}
                            style={{
                                paddingHorizontal: 8,
                                paddingVertical: 4,
                                borderRadius: 6,
                                backgroundColor: !isCompact ? theme.colors.card : 'transparent'
                            }}
                        >
                            <Text style={{
                                fontSize: 11,
                                fontWeight: !isCompact ? '800' : '600',
                                color: !isCompact ? theme.colors.primary : theme.colors.textSecondary
                            }}>
                                ↔️ Ampia
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Riga Inferiore: Legenda Colori */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: bubbaColor }} />
                        <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.text }}>Bubba ({curUs})</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: oppColor }} />
                        <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.text }}>{opponentName || 'Loro'} ({curThem})</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.textSecondary }}>⚡BRK = Break</Text>
                    </View>
                </View>
            </View>

            {/* Dettaglio del punto selezionato (Tooltip inline) */}
            {selectedStep && selectedStep.goalNumber > 0 && (
                <View style={[styles.stepDetailBanner, {
                    backgroundColor: theme.dark ? '#1E293B' : '#F1F5F9',
                    borderColor: selectedStep.isBreak
                        ? '#10B981'
                        : (selectedStep.winner === 'us' ? bubbaColor : oppColor)
                }]}>
                    <View style={{ flex: 1, gap: 5 }}>
                        {/* Riga 1: Info meta, punteggio, badge break/hold e tasto chiusura */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', flex: 1 }}>
                                <Text style={{ fontSize: 12, fontWeight: 'bold', color: theme.colors.text }}>
                                    Meta #{selectedStep.goalNumber}:
                                </Text>
                                <Text style={{ fontSize: 13, fontWeight: '800', color: selectedStep.winner === 'us' ? bubbaColor : oppColor }}>
                                    Bubba {selectedStep.us} - {selectedStep.them} {opponentName || 'Loro'}
                                </Text>
                                {selectedStep.isBreak ? (
                                    <View style={{
                                        backgroundColor: selectedStep.breakTeam === 'us' ? bubbaColor : oppColor,
                                        paddingHorizontal: 7,
                                        paddingVertical: 2,
                                        borderRadius: 4,
                                    }}>
                                        <Text style={{ fontSize: 10, fontWeight: '800', color: '#FFFFFF' }}>
                                            ⚡ BREAK {selectedStep.breakTeam === 'us' ? 'BUBBA' : (opponentName || 'AVVERSARI').toUpperCase()}
                                        </Text>
                                    </View>
                                ) : (
                                    <View style={{
                                        backgroundColor: theme.dark ? '#334155' : '#E2E8F0',
                                        paddingHorizontal: 6,
                                        paddingVertical: 2,
                                        borderRadius: 4,
                                    }}>
                                        <Text style={{ fontSize: 10, fontWeight: '600', color: theme.colors.textSecondary }}>
                                            {selectedStep.winner === 'us' ? (selectedStep.isCleanHold ? 'Meta fatta (Clean)' : 'Meta fatta') : 'Meta subita'}
                                        </Text>
                                    </View>
                                )}
                            </View>
                            <TouchableOpacity onPress={() => setSelectedStep(null)} style={{ padding: 4 }}>
                                <Text style={{ fontSize: 13, color: theme.colors.textSecondary, fontWeight: 'bold' }}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Riga 2: Giocatori (Marcatore e Assist) disposti su riga dedicata per non uscire dallo schermo su mobile */}
                        {selectedStep.scorerName && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
                                <Text style={{ fontSize: 12, fontWeight: '600', color: theme.colors.text, flexShrink: 1 }}>
                                    🥏 Marcatore: <Text style={{ fontWeight: '800', color: bubbaColor }}>{selectedStep.scorerName}</Text>
                                </Text>
                                {selectedStep.assistName ? (
                                    <Text style={{ fontSize: 12, fontWeight: '600', color: theme.colors.textSecondary, flexShrink: 1 }}>
                                        · Assist: <Text style={{ fontWeight: '700', color: theme.colors.text }}>{selectedStep.assistName}</Text>
                                    </Text>
                                ) : null}
                            </View>
                        )}
                    </View>
                </View>
            )}

            {/* Area del Grafico (Scrollabile in modalità Ampia, fissa a larghezza card in modalità Compatta/Intera) */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={!isCompact}
                scrollEnabled={!isCompact}
                contentContainerStyle={{ paddingVertical: 4 }}
            >
                <Svg width={totalSvgWidth} height={chartHeight}>
                    {/* Griglia orizzontale e label asse Y */}
                    {yTicks.map(val => {
                        const y = getY(val);
                        return (
                            <G key={`y-${val}`}>
                                <Line
                                    x1={paddingLeft}
                                    y1={y}
                                    x2={totalSvgWidth - paddingRight}
                                    y2={y}
                                    stroke={theme.dark ? '#334155' : '#E2E8F0'}
                                    strokeDasharray={val === 0 ? undefined : '3,3'}
                                    strokeWidth={val === 0 ? 1.5 : 1}
                                />
                                <SvgText
                                    x={paddingLeft - 8}
                                    y={y + 4}
                                    fontSize={10}
                                    fontWeight="600"
                                    fill={theme.colors.textSecondary}
                                    textAnchor="end"
                                >
                                    {val}
                                </SvgText>
                            </G>
                        );
                    })}

                    {/* Griglia verticale e label asse X (Mete) */}
                    {steps.map(s => {
                        const x = getX(s.goalNumber);
                        const isSelected = selectedStep?.goalNumber === s.goalNumber;
                        const showXLabel = !isCompact
                            || totalGoals <= 10
                            || (totalGoals <= 18 && (s.goalNumber % 2 === 0 || s.goalNumber === totalGoals))
                            || (totalGoals > 18 && (s.goalNumber % 5 === 0 || s.goalNumber === totalGoals))
                            || s.goalNumber === 0;

                        return (
                            <G key={`x-${s.goalNumber}`}>
                                {s.goalNumber > 0 && (
                                    <Line
                                        x1={x}
                                        y1={paddingTop}
                                        x2={x}
                                        y2={paddingTop + innerHeight}
                                        stroke={isSelected ? (theme.dark ? '#475569' : '#CBD5E1') : (theme.dark ? '#1E293B' : '#F1F5F9')}
                                        strokeWidth={isSelected ? 1.5 : 1}
                                    />
                                )}
                                {showXLabel && (
                                    <SvgText
                                        x={x}
                                        y={paddingTop + innerHeight + 14}
                                        fontSize={isCompact && totalGoals > 14 ? 8.5 : 10}
                                        fontWeight={isSelected ? 'bold' : '600'}
                                        fill={isSelected ? theme.colors.text : theme.colors.textSecondary}
                                        textAnchor="middle"
                                    >
                                        {s.goalNumber === 0 ? '0' : `#${s.goalNumber}`}
                                    </SvgText>
                                )}
                                {s.isBreak && (
                                    <SvgText
                                        x={x}
                                        y={paddingTop + innerHeight + 25}
                                        fontSize={isCompact && totalGoals > 14 ? 7 : 7.5}
                                        fontWeight="900"
                                        fill={s.breakTeam === 'us' ? bubbaColor : oppColor}
                                        textAnchor="middle"
                                    >
                                        {isCompact && totalGoals > 14 ? '⚡' : '⚡BRK'}
                                    </SvgText>
                                )}
                            </G>
                        );
                    })}

                    {/* Linea andamento Bubba */}
                    <Polyline
                        points={usPolyPoints}
                        fill="none"
                        stroke={bubbaColor}
                        strokeWidth={isCompact && totalGoals > 20 ? 2 : 2.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />

                    {/* Linea andamento Avversari */}
                    <Polyline
                        points={themPolyPoints}
                        fill="none"
                        stroke={oppColor}
                        strokeWidth={isCompact && totalGoals > 20 ? 2 : 2.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />

                    {/* Punti grafici e aree di tocco */}
                    {steps.map(s => {
                        const x = getX(s.goalNumber);
                        const yUs = getY(s.us);
                        const yThem = getY(s.them);
                        const isSelected = selectedStep?.goalNumber === s.goalNumber;
                        const hitWidth = Math.max(stepWidth, 20);

                        const baseR = isCompact
                            ? (totalGoals > 20 ? 2.5 : totalGoals > 12 ? 3 : 3.8)
                            : (s.goalNumber === 0 ? 3.5 : 4.5);
                        const currentR = isSelected ? baseR + 2.5 : baseR;
                        const strokeW = isCompact && totalGoals > 16 ? 1.5 : 2;

                        return (
                            <G key={`pts-${s.goalNumber}`}>
                                {/* Area di tocco allargata per la colonna del punto */}
                                <Rect
                                    x={x - hitWidth / 2}
                                    y={paddingTop}
                                    width={hitWidth}
                                    height={innerHeight}
                                    fill="transparent"
                                    onPress={() => setSelectedStep(s)}
                                />

                                {/* Punto Bubba */}
                                <Circle
                                    cx={x}
                                    cy={yUs}
                                    r={currentR}
                                    fill={bubbaColor}
                                    stroke="#ffffff"
                                    strokeWidth={strokeW}
                                    onPress={() => setSelectedStep(s)}
                                />

                                {/* Punto Avversari */}
                                <Circle
                                    cx={x}
                                    cy={yThem}
                                    r={currentR}
                                    fill={oppColor}
                                    stroke="#ffffff"
                                    strokeWidth={strokeW}
                                    onPress={() => setSelectedStep(s)}
                                />
                            </G>
                        );
                    })}
                </Svg>
            </ScrollView>

            <Text style={{ fontSize: 10, color: theme.colors.textSecondary, textAlign: 'center', marginTop: 4 }}>
                {isCompact ? '💡 Tocca un punto per visualizzare il punteggio e il marcatore esatto' : '💡 Scorri in orizzontale o tocca un punto per i dettagli'}
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
    },
    cardTitle: {
        fontSize: 15,
        fontWeight: 'bold',
    },
    stepDetailBanner: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1.5,
        marginBottom: 8,
        marginTop: 4,
    },
});

export default ScoreProgressionChart;
