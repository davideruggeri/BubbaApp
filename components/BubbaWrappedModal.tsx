import { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Dimensions,
    Animated,
    Image,
    ScrollView,
    StatusBar,
    Share,
    Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UserWrappedData, TeamWrappedData, markWrappedAsViewed } from '../services/firestore';
import { useAuth } from '../context/AuthContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface BubbaWrappedModalProps {
    visible: boolean;
    onClose: () => void;
    userWrapped: UserWrappedData | null;
    teamWrapped: TeamWrappedData | null;
    stagione: string;
}

const SLIDE_BACKGROUNDS = [
    { bg: '#0F0C20', accent: '#FF007F', glow: '#7928CA' }, // 0: Intro (Deep Neon Violet)
    { bg: '#0A192F', accent: '#00E5FF', glow: '#0052D4' }, // 1: Presenze (Electric Blue)
    { bg: '#1A0B00', accent: '#FF5722', glow: '#FF9800' }, // 2: Streak (Fire Orange)
    { bg: '#120024', accent: '#FFD700', glow: '#9C27B0' }, // 3: League (Royal Gold)
    { bg: '#001A14', accent: '#00FF87', glow: '#00A86B' }, // 4: Tornei (Emerald)
    { bg: '#14001A', accent: '#FF1493', glow: '#8A2BE2' }, // 5: Team collective (Neon Magenta)
    { bg: '#080816', accent: '#FFD700', glow: '#4361EE' }, // 6: Finale / Titolo
];

function formatEventDates(startDate?: string, endDate?: string) {
    if (!startDate) return '';
    try {
        const parts = startDate.split('T')[0].split('-');
        if (parts.length < 3) return startDate;
        const startDay = parseInt(parts[2], 10);
        const startMonthIdx = parseInt(parts[1], 10) - 1;
        const startYear = parts[0];

        const MONTH_NAMES = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
        const startMonth = MONTH_NAMES[startMonthIdx] || parts[1];

        if (endDate && endDate !== startDate) {
            const endParts = endDate.split('T')[0].split('-');
            if (endParts.length === 3) {
                const endDay = parseInt(endParts[2], 10);
                const endMonthIdx = parseInt(endParts[1], 10) - 1;
                const endMonth = MONTH_NAMES[endMonthIdx] || endParts[1];
                const endYear = endParts[0];

                if (startMonth === endMonth && startYear === endYear) {
                    return `${startDay} - ${endDay} ${startMonth} ${startYear}`;
                }
                return `${startDay} ${startMonth} - ${endDay} ${endMonth} ${endYear}`;
            }
        }
        return `${startDay} ${startMonth} ${startYear}`;
    } catch {
        return startDate;
    }
}

export default function BubbaWrappedModal({
    visible,
    onClose,
    userWrapped,
    teamWrapped,
    stagione
}: BubbaWrappedModalProps) {
    const { userProfile } = useAuth();
    const TOTAL_SLIDES = 7;
    const [currentSlide, setCurrentSlide] = useState(0);

    // Animations
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.92)).current;
    const progressAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            setCurrentSlide(0);
            animateSlide();
            markWrappedAsViewed(stagione, userProfile?.uid);
        }
    }, [visible, stagione, userProfile?.uid]);

    const animateSlide = () => {
        fadeAnim.setValue(0);
        scaleAnim.setValue(0.92);
        progressAnim.setValue(0);

        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 320,
                useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
                toValue: 1,
                friction: 8,
                tension: 40,
                useNativeDriver: true,
            }),
            Animated.timing(progressAnim, {
                toValue: 1,
                duration: 400,
                useNativeDriver: false,
            })
        ]).start();
    };

    const handleNext = () => {
        if (currentSlide < TOTAL_SLIDES - 1) {
            setCurrentSlide(prev => prev + 1);
            animateSlide();
        } else {
            onClose();
        }
    };

    const handlePrev = () => {
        if (currentSlide > 0) {
            setCurrentSlide(prev => prev - 1);
            animateSlide();
        }
    };

    const handleShare = async () => {
        if (!userWrapped) return;
        try {
            const message = `🥏 Il mio Bubba Wrapped ${stagione}!\n` +
                `⭐ Titolo: ${userWrapped.titoloRiconoscimento}\n` +
                `📅 Presenze: ${userWrapped.presenzeTotali} (${userWrapped.percentualePresenza}%)\n` +
                `🔥 Max Streak: ${userWrapped.streakMassima} allenamenti\n` +
                `${userWrapped.leaguePoints ? `🏆 League: ${userWrapped.leaguePoints} pts (#${userWrapped.leagueRank})\n` : ''}` +
                `#BubbaFrisbee #BubbaWrapped`;

            await Share.share({
                message,
                title: `Bubba Wrapped ${stagione}`
            });
        } catch (error) {
            console.log("Share error:", error);
        }
    };

    if (!visible) return null;

    const themeColors = SLIDE_BACKGROUNDS[currentSlide] || SLIDE_BACKGROUNDS[0];

    // Helper data
    const memberName = userWrapped?.nickname || userWrapped?.memberName || 'Bubba';
    const presenze = userWrapped?.presenzeTotali || 0;
    const perc = userWrapped?.percentualePresenza || 0;
    const diff = userWrapped?.differenzaMediaSquadra || 0;
    const streak = userWrapped?.streakMassima || 0;

    // Solo i tornei ed eventi a cui il giocatore ha effettivamente partecipato
    const myEvents: Array<{
        id?: string;
        title: string;
        date: string;
        endDate?: string;
        type: string;
        location?: string;
        role?: string;
    }> = userWrapped?.eventiPartecipati || (userWrapped?.tuttiEventiStagione?.filter(e => e.partecipato)) || [];

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent={false}
            onRequestClose={onClose}
        >
            <StatusBar barStyle="light-content" backgroundColor={themeColors.bg} />
            <SafeAreaView style={[styles.container, { backgroundColor: themeColors.bg }]}>
                {/* Background Glow Effect */}
                <View
                    pointerEvents="none"
                    style={[
                        styles.glowCircle,
                        { backgroundColor: themeColors.glow }
                    ]}
                />

                {/* Top Header: Progress Bar Segments & Close Button */}
                <View style={styles.topBar}>
                    <View style={styles.progressRow}>
                        {Array.from({ length: TOTAL_SLIDES }).map((_, index) => {
                            const isPast = index < currentSlide;
                            const isCurrent = index === currentSlide;
                            return (
                                <View key={index} style={styles.progressBarBackground}>
                                    <View
                                        style={[
                                            styles.progressBarFill,
                                            isPast && { width: '100%', backgroundColor: '#FFFFFF' },
                                            isCurrent && { width: '100%', backgroundColor: themeColors.accent },
                                            !isPast && !isCurrent && { width: '0%' }
                                        ]}
                                    />
                                </View>
                            );
                        })}
                    </View>

                    <View style={styles.headerInfoRow}>
                        <View style={styles.headerLeft}>
                            <Text style={styles.headerBadgeText}>BUBBA WRAPPED</Text>
                            <Text style={styles.headerSeasonText}>{stagione}</Text>
                        </View>
                        <TouchableOpacity
                            onPress={onClose}
                            style={styles.closeButton}
                            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        >
                            <Text style={styles.closeButtonText}>✕</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Interactive Center Content with Left/Right Tap Zones */}
                <View style={styles.contentWrapper}>
                    {/* Left Tap Zone */}
                    <TouchableOpacity
                        style={[styles.tapZoneLeft, currentSlide === 4 && { zIndex: 1 }]}
                        onPress={handlePrev}
                        activeOpacity={1}
                    />

                    {/* Right Tap Zone */}
                    <TouchableOpacity
                        style={[styles.tapZoneRight, currentSlide === 4 && { zIndex: 1 }]}
                        onPress={handleNext}
                        activeOpacity={1}
                    />

                    {/* Animated Slide Body */}
                    <Animated.View
                        style={[
                            styles.slideCard,
                            {
                                opacity: fadeAnim,
                                transform: [{ scale: scaleAnim }]
                            }
                        ]}
                        pointerEvents="box-none"
                    >
                        {/* SLIDE 0: INTRO */}
                        {currentSlide === 0 && (
                            <View style={styles.slideCenter}>
                                <View style={[styles.iconBubble, { borderColor: themeColors.accent }]}>
                                    <Text style={styles.megaEmoji}>🎁</Text>
                                </View>
                                <Text style={[styles.eyebrow, { color: themeColors.accent }]}>È ARRIVATO IL MOMENTO</Text>
                                <Text style={styles.slideTitle}>Il tuo Bubba Wrapped</Text>
                                <Text style={[styles.slideSubtitleHighlight, { color: themeColors.accent }]}>
                                    Stagione {stagione}
                                </Text>
                                <Text style={styles.slideBodyText}>
                                    Ciao <Text style={{ fontWeight: 'bold', color: '#FFF' }}>{memberName}</Text>! Un anno di lanci, tuffi, mete e terzi tempi indimenticabili.
                                </Text>
                                <View style={[styles.tipPill, { backgroundColor: '#FFFFFF18' }]}>
                                    <Text style={styles.tipPillText}>Tocca a destra per iniziare 👉</Text>
                                </View>
                            </View>
                        )}

                        {/* SLIDE 1: PRESENZE & DEDIZIONE */}
                        {currentSlide === 1 && (
                            <View style={styles.slideCenter}>
                                <Text style={[styles.eyebrow, { color: themeColors.accent }]}>COSTANZA & IMPEGNO</Text>
                                <Text style={styles.slideTitle}>Sempre sul pezzo!</Text>

                                <View style={styles.bigStatContainer}>
                                    <Text style={[styles.heroNumber, { color: themeColors.accent }]}>{presenze}</Text>
                                    <Text style={styles.heroLabel}>PRESENZE TOTALI</Text>
                                </View>

                                <View style={styles.splitBadgeRow}>
                                    <View style={[styles.splitBadge, { backgroundColor: '#FFFFFF12' }]}>
                                        <Text style={styles.splitBadgeVal}>🥏 {userWrapped?.presenzeCampo || 0}</Text>
                                        <Text style={styles.splitBadgeLabel}>Campo</Text>
                                    </View>
                                    <View style={[styles.splitBadge, { backgroundColor: '#FFFFFF12' }]}>
                                        <Text style={styles.splitBadgeVal}>🏋️ {userWrapped?.presenzePalestra || 0}</Text>
                                        <Text style={styles.splitBadgeLabel}>Palestra</Text>
                                    </View>
                                </View>

                                <View style={[styles.statHighlightCard, { borderColor: themeColors.accent + '40' }]}>
                                    <Text style={styles.highlightVal}>{perc}%</Text>
                                    <Text style={styles.highlightLabel}>Percentuale di presenza</Text>
                                    {diff !== 0 && (
                                        <Text style={[styles.highlightSub, { color: diff > 0 ? '#00FF87' : '#FFB74D' }]}>
                                            {diff > 0 ? `+${diff}% rispetto alla media della squadra` : `${diff}% rispetto alla media squadra`}
                                        </Text>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* SLIDE 2: STREAK DI FUOCO */}
                        {currentSlide === 2 && (
                            <View style={styles.slideCenter}>
                                <Text style={[styles.eyebrow, { color: themeColors.accent }]}>LA STRISCIA DI FUOCO</Text>
                                <View style={styles.flameIconContainer}>
                                    <Text style={{ fontSize: 64 }}>🔥</Text>
                                </View>
                                <Text style={styles.slideTitle}>Inarrestabile!</Text>

                                <View style={styles.bigStatContainer}>
                                    <Text style={[styles.heroNumber, { color: themeColors.accent }]}>{streak}</Text>
                                    <Text style={styles.heroLabel}>ALLENAMENTI CONSECUTIVI</Text>
                                </View>

                                <View style={styles.splitBadgeRow}>
                                    <View style={[styles.splitBadge, { backgroundColor: '#FFFFFF12' }]}>
                                        <Text style={styles.splitBadgeVal}>🌱 {userWrapped?.streakCampo || 0}</Text>
                                        <Text style={styles.splitBadgeLabel}>Streak Campo</Text>
                                    </View>
                                    <View style={[styles.splitBadge, { backgroundColor: '#FFFFFF12' }]}>
                                        <Text style={styles.splitBadgeVal}>🏋️ {userWrapped?.streakPalestra || 0}</Text>
                                        <Text style={styles.splitBadgeLabel}>Streak Palestra</Text>
                                    </View>
                                </View>

                                <Text style={styles.slideBodyText}>
                                    {streak >= 10
                                        ? "Che grinta! Una continuità pazzesca che ispira tutta la squadra."
                                        : streak >= 5
                                            ? "Una striscia degna di un vero atleta Bubba. Quando scendi in campo si vede!"
                                            : "Ogni presenza conta per costruire lo spirito di squadra!"}
                                </Text>

                                <View style={[styles.tipPill, { backgroundColor: '#FF572224', borderColor: '#FF572260' }]}>
                                    <Text style={[styles.tipPillText, { color: '#FFAB91' }]}>
                                        Massima serie di presenze consecutive della stagione
                                    </Text>
                                </View>
                            </View>
                        )}

                        {/* SLIDE 3: BUBBA LEAGUE */}
                        {currentSlide === 3 && (
                            <View style={styles.slideCenter}>
                                <Text style={[styles.eyebrow, { color: themeColors.accent }]}>SFIDE TRA BUBBA</Text>
                                <View style={styles.trophyContainer}>
                                    <Text style={{ fontSize: 56 }}>🏆</Text>
                                </View>
                                <Text style={styles.slideTitle}>Bubba League</Text>

                                {userWrapped?.leaguePoints !== undefined && userWrapped.leaguePoints > 0 ? (
                                    <>
                                        <View style={styles.bigStatContainer}>
                                            <Text style={[styles.heroNumber, { color: themeColors.accent }]}>
                                                {userWrapped.leaguePoints}
                                            </Text>
                                            <Text style={styles.heroLabel}>PUNTI LEAGUE TOTALI</Text>
                                        </View>

                                        <View style={[styles.leagueRankCard, { backgroundColor: '#FFFFFF12' }]}>
                                            <Text style={styles.leagueRankBadge}>
                                                {userWrapped.leagueBadge || `#${userWrapped.leagueRank || '-'}`}
                                            </Text>
                                            <View style={{ marginLeft: 12 }}>
                                                <Text style={styles.leagueRankTitle}>Posizione in Classifica</Text>
                                                <Text style={styles.leagueRankSub}>
                                                    Su {userWrapped.leagueTotalParticipants || 'tutti i'} compagni
                                                </Text>
                                            </View>
                                        </View>
                                    </>
                                ) : (
                                    <View style={{ alignItems: 'center', marginTop: 20 }}>
                                        <Text style={styles.slideBodyText}>
                                            Nessun punto registrato nelle sfide di League quest&apos;anno.
                                        </Text>
                                        <View style={[styles.tipPill, { backgroundColor: '#FFFFFF14' }]}>
                                            <Text style={styles.tipPillText}>🎯 Ti aspettiamo nella prossima edizione!</Text>
                                        </View>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* SLIDE 4: TRASFERTE & EVENTI */}
                        {currentSlide === 4 && (
                            <View style={[styles.slideCenter, { flex: 1, maxHeight: '88%' }]}>
                                <TouchableOpacity
                                    activeOpacity={0.9}
                                    onPress={handleNext}
                                    style={{ width: '100%', alignItems: 'center' }}
                                >
                                    <Text style={[styles.eyebrow, { color: themeColors.accent }]}>IN VIAGGIO CON I BUBBA</Text>
                                    <View style={styles.slideTitleRow}>
                                        <Text style={{ fontSize: 26, marginRight: 8 }}>🌍</Text>
                                        <Text style={styles.slideTitleCompact}>Tornei & Eventi</Text>
                                    </View>
                                    <Text style={[styles.slideSubtitleSmall, { color: themeColors.accent }]}>
                                        Stagione {stagione}
                                    </Text>

                                    {/* Banner riassuntivo presenze tornei */}
                                    <View style={[styles.eventsSummaryCard, { borderColor: themeColors.accent + '40', backgroundColor: '#FFFFFF10' }]}>
                                        <Text style={styles.eventsSummaryText}>
                                            Hai partecipato a <Text style={{ color: themeColors.accent, fontWeight: 'bold' }}>{myEvents.length}</Text> {myEvents.length === 1 ? 'evento di squadra' : 'eventi di squadra'}
                                        </Text>
                                    </View>
                                </TouchableOpacity>

                                {/* Lista dei soli tornei a cui il giocatore ha partecipato */}
                                {myEvents.length > 0 ? (
                                    <ScrollView
                                        style={styles.fullEventsScroll}
                                        contentContainerStyle={{ paddingBottom: 24 }}
                                        showsVerticalScrollIndicator={true}
                                        nestedScrollEnabled={true}
                                    >
                                        {myEvents.map((ev, idx) => (
                                            <TouchableOpacity
                                                key={ev.id || idx}
                                                activeOpacity={0.8}
                                                onPress={handleNext}
                                                style={[
                                                    styles.fullEventRow,
                                                    { backgroundColor: '#FFFFFF15', borderColor: themeColors.accent + '40' }
                                                ]}
                                            >
                                                <Text style={styles.eventItemEmoji}>
                                                    {ev.type === 'tournament' ? '🏅'
                                                        : ev.type === 'championship' || ev.type === 'championship_season' ? '🏆'
                                                            : ev.type === 'match' ? '⚔️'
                                                                : ev.type === 'social' ? '🍻'
                                                                    : '🌍'}
                                                </Text>
                                                <View style={{ flex: 1, marginLeft: 10 }}>
                                                    <Text style={[styles.fullEventTitle, { color: '#FFFFFF' }]} numberOfLines={1}>
                                                        {ev.title}
                                                    </Text>
                                                    <Text style={styles.fullEventDate}>
                                                        {formatEventDates(ev.date, ev.endDate)}
                                                        {ev.location && ev.location !== 'Unknown' ? ` • ${ev.location}` : ''}
                                                    </Text>
                                                </View>
                                                {ev.role && (
                                                    <View style={[styles.rolePillPresent, { backgroundColor: themeColors.accent + '25', borderColor: themeColors.accent }]}>
                                                        <Text style={[styles.rolePillPresentText, { color: themeColors.accent }]}>
                                                            {ev.role === 'guest' ? 'Ospite' : 'Giocatore'}
                                                        </Text>
                                                    </View>
                                                )}
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                ) : (
                                    <TouchableOpacity activeOpacity={0.9} onPress={handleNext}>
                                        <Text style={styles.slideBodyText}>
                                            Un anno concentrato sugli allenamenti di casa. Pronti per le prossime trasferte! 🚌
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}

                        {/* SLIDE 5: TEAM STATS */}
                        {currentSlide === 5 && (
                            <View style={styles.slideCenter}>
                                <Text style={styles.slideTitle}>I Numeri della Squadra</Text>

                                <View style={styles.teamGrid}>
                                    <View style={[styles.teamMetricBox, { backgroundColor: '#FFFFFF10' }]}>
                                        <Text style={[styles.teamMetricVal, { color: themeColors.accent }]}>
                                            {teamWrapped?.presenzeTotaliSquadra?.toLocaleString('it-IT') || '1.321'}
                                        </Text>
                                        <Text style={styles.teamMetricLabel}>Presenze complessive 👥</Text>
                                        <Text style={styles.teamMetricSub}>Agli allenamenti</Text>
                                    </View>

                                    <View style={[styles.teamMetricBox, { backgroundColor: '#FFFFFF10' }]}>
                                        <Text style={[styles.teamMetricVal, { color: themeColors.accent }]}>
                                            {teamWrapped?.allenamentiTotali || 120}
                                        </Text>
                                        <Text style={styles.teamMetricLabel}>Allenamenti disputati 🏟️</Text>
                                        <Text style={styles.teamMetricSub}>
                                            {teamWrapped?.allenamentiCampo || 93} Campo • {teamWrapped?.allenamentiPalestra || 27} Palestra
                                        </Text>
                                    </View>

                                    <View style={[styles.teamMetricBox, { backgroundColor: '#FFFFFF10' }]}>
                                        <Text style={[styles.teamMetricVal, { color: themeColors.accent }]}>
                                            {teamWrapped?.mediaPresenzePerAllenamento || 11}
                                        </Text>
                                        <Text style={styles.teamMetricLabel}>Media per serata 🥏</Text>
                                        <Text style={styles.teamMetricSub}>Costanza del gruppo</Text>
                                    </View>

                                    <View style={[styles.teamMetricBox, { backgroundColor: '#FFFFFF10' }]}>
                                        <Text style={[styles.teamMetricVal, { color: themeColors.accent }]}>
                                            {teamWrapped?.torneiTotali || 13}
                                        </Text>
                                        <Text style={styles.teamMetricLabel}>Tornei & Eventi 🏆</Text>
                                        <Text style={styles.teamMetricSub}>Vissuti insieme</Text>
                                    </View>
                                </View>

                                {teamWrapped?.recordPresenzeAllenamento && (
                                    <View style={[styles.tipPill, { backgroundColor: '#FFFFFF14', marginTop: 16 }]}>
                                        <Text style={styles.tipPillText}>
                                            👑 Serata record: {teamWrapped.recordPresenzeAllenamento.count} presenti il {formatEventDates(teamWrapped.recordPresenzeAllenamento.date)}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* SLIDE 6: FINALE & TITOLO RICONOSCIMENTO */}
                        {currentSlide === 6 && (
                            <View style={styles.slideCenter}>
                                <Text style={[styles.eyebrow, { color: themeColors.accent }]}>IL TUO TITOLO STAGIONALE</Text>

                                {/* Badge Card */}
                                <View style={[styles.badgeFinalCard, { borderColor: themeColors.accent }]}>
                                    <View style={styles.badgeAvatarCircle}>
                                        <Text style={{ fontSize: 44 }}>
                                            {userWrapped?.titoloRiconoscimento?.includes('🏛️') ? '🏛️'
                                                : userWrapped?.titoloRiconoscimento?.includes('🔥') ? '🔥'
                                                    : userWrapped?.titoloRiconoscimento?.includes('👑') ? '👑'
                                                        : userWrapped?.titoloRiconoscimento?.includes('🌍') ? '🌍'
                                                            : '⭐'}
                                        </Text>
                                    </View>
                                    <Text style={[styles.badgeFinalTitle, { color: themeColors.accent }]}>
                                        {userWrapped?.titoloRiconoscimento || 'Spirito Bubba 🥏'}
                                    </Text>
                                    <Text style={styles.badgeFinalPlayer}>{memberName}</Text>
                                    <Text style={styles.badgeFinalDesc}>
                                        {userWrapped?.descrizioneTitolo || "Grazie per aver reso questa stagione straordinaria!"}
                                    </Text>

                                    {/* Mini stats recap */}
                                    <View style={styles.finalScoreGrid}>
                                        <View style={styles.finalScoreCol}>
                                            <Text style={styles.finalScoreVal}>{presenze}</Text>
                                            <Text style={styles.finalScoreSub}>Presenze</Text>
                                        </View>
                                        <View style={styles.finalScoreCol}>
                                            <Text style={styles.finalScoreVal}>{perc}%</Text>
                                            <Text style={styles.finalScoreSub}>Frequenza</Text>
                                        </View>
                                        <View style={styles.finalScoreCol}>
                                            <Text style={styles.finalScoreVal}>🔥 {streak}</Text>
                                            <Text style={styles.finalScoreSub}>Max Streak</Text>
                                        </View>
                                        <View style={styles.finalScoreCol}>
                                            <Text style={styles.finalScoreVal}>{userWrapped?.totaleEventiPartecipati || 0}</Text>
                                            <Text style={styles.finalScoreSub}>Eventi</Text>
                                        </View>
                                    </View>
                                </View>

                                {/* Action Buttons */}
                                <View style={styles.finalButtonsRow}>
                                    <TouchableOpacity
                                        style={[styles.actionBtn, { backgroundColor: themeColors.accent }]}
                                        onPress={handleShare}
                                    >
                                        <Text style={styles.actionBtnTextDark}>Condividi 📤</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.actionBtn, { backgroundColor: '#FFFFFF22' }]}
                                        onPress={onClose}
                                    >
                                        <Text style={styles.actionBtnTextLight}>Chiudi 🎉</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                    </Animated.View>
                </View>

                {/* Bottom Navigation Hint */}
                <View style={styles.bottomBar}>
                    <TouchableOpacity onPress={handlePrev} disabled={currentSlide === 0}>
                        <Text style={[styles.navHintText, currentSlide === 0 && { opacity: 0 }]}>
                            ‹ Indietro
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleNext}>
                        <Text style={[styles.navHintText, { color: themeColors.accent, fontWeight: 'bold' }]}>
                            {currentSlide === TOTAL_SLIDES - 1 ? 'Fine ✓' : 'Avanti ›'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    glowCircle: {
        position: 'absolute',
        top: -SCREEN_WIDTH * 0.4,
        alignSelf: 'center',
        width: SCREEN_WIDTH * 1.4,
        height: SCREEN_WIDTH * 1.4,
        borderRadius: SCREEN_WIDTH * 0.7,
        opacity: 0.22,
    },
    topBar: {
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 4,
        zIndex: 10,
    },
    progressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 10,
    },
    progressBarBackground: {
        flex: 1,
        height: 3.5,
        backgroundColor: '#FFFFFF30',
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 2,
    },
    headerInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    headerBadgeText: {
        color: '#FFFFFF',
        fontWeight: '900',
        fontSize: 12,
        letterSpacing: 1.5,
    },
    headerSeasonText: {
        color: '#FFFFFF90',
        fontSize: 12,
        fontWeight: '600',
    },
    closeButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#FFFFFF20',
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
        lineHeight: 18,
    },
    contentWrapper: {
        flex: 1,
        position: 'relative',
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    tapZoneLeft: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        width: '35%',
        zIndex: 5,
    },
    tapZoneRight: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        right: 0,
        width: '65%',
        zIndex: 5,
    },
    slideCard: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2,
    },
    slideCenter: {
        width: '100%',
        alignItems: 'center',
        paddingHorizontal: 12,
    },
    iconBubble: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#FFFFFF12',
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    flameIconContainer: {
        marginBottom: 12,
    },
    trophyContainer: {
        marginBottom: 12,
    },
    megaEmoji: {
        fontSize: 48,
    },
    eyebrow: {
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 2,
        marginBottom: 8,
        textTransform: 'uppercase',
    },
    slideTitle: {
        color: '#FFFFFF',
        fontSize: 28,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 6,
    },
    slideSubtitleHighlight: {
        fontSize: 22,
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: 16,
    },
    slideBodyText: {
        color: '#E0E0E0',
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
        marginHorizontal: 12,
        marginTop: 8,
    },
    bigStatContainer: {
        alignItems: 'center',
        marginVertical: 18,
    },
    heroNumber: {
        fontSize: 72,
        fontWeight: '900',
        lineHeight: 78,
    },
    heroLabel: {
        color: '#FFFFFF99',
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 1.5,
        marginTop: 4,
    },
    splitBadgeRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
    },
    splitBadge: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 14,
        alignItems: 'center',
    },
    splitBadgeVal: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    splitBadgeLabel: {
        color: '#FFFFFF80',
        fontSize: 11,
        marginTop: 2,
    },
    statHighlightCard: {
        width: '100%',
        maxWidth: 320,
        backgroundColor: '#FFFFFF10',
        borderRadius: 18,
        borderWidth: 1.5,
        padding: 16,
        alignItems: 'center',
        marginTop: 8,
    },
    highlightVal: {
        color: '#FFFFFF',
        fontSize: 32,
        fontWeight: 'bold',
    },
    highlightLabel: {
        color: '#FFFFFF90',
        fontSize: 13,
        marginTop: 2,
    },
    highlightSub: {
        fontSize: 12,
        fontWeight: '700',
        marginTop: 6,
    },
    leagueRankCard: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 18,
        marginTop: 16,
        width: '100%',
        maxWidth: 320,
    },
    leagueRankBadge: {
        fontSize: 32,
        fontWeight: '900',
        color: '#FFD700',
    },
    leagueRankTitle: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    leagueRankSub: {
        color: '#FFFFFF80',
        fontSize: 12,
        marginTop: 2,
    },
    eventsScroll: {
        maxHeight: 180,
        width: '100%',
        maxWidth: 320,
        marginTop: 12,
    },
    eventItemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
    },
    eventItemEmoji: {
        fontSize: 22,
    },
    eventItemTitle: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '600',
    },
    eventItemDate: {
        color: '#FFFFFF80',
        fontSize: 12,
        marginTop: 2,
    },
    rolePill: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
        marginLeft: 6,
    },
    rolePillText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '600',
    },
    slideTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 2,
    },
    slideTitleCompact: {
        color: '#FFFFFF',
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    slideSubtitleSmall: {
        fontSize: 13,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 8,
    },
    eventsSummaryCard: {
        width: '100%',
        maxWidth: 340,
        paddingVertical: 7,
        paddingHorizontal: 12,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 8,
        alignItems: 'center',
    },
    eventsSummaryText: {
        color: '#FFFFFFD0',
        fontSize: 12,
        fontWeight: '600',
        textAlign: 'center',
    },
    fullEventsScroll: {
        width: '100%',
        maxWidth: 340,
        maxHeight: 380,
    },
    fullEventRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 9,
        paddingHorizontal: 12,
        borderRadius: 14,
        borderWidth: 1,
        marginBottom: 6,
    },
    fullEventTitle: {
        color: '#E0E0E0',
        fontSize: 13,
        fontWeight: '600',
    },
    fullEventDate: {
        color: '#FFFFFF80',
        fontSize: 11,
        marginTop: 2,
    },
    rolePillPresent: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
        borderWidth: 1,
        marginLeft: 6,
    },
    rolePillPresentText: {
        fontSize: 10,
        fontWeight: '700',
    },
    rolePillAbsent: {
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 10,
        backgroundColor: '#FFFFFF12',
        marginLeft: 6,
    },
    rolePillAbsentText: {
        color: '#FFFFFF60',
        fontSize: 10,
        fontWeight: '600',
    },
    teamGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        justifyContent: 'center',
        marginTop: 16,
        width: '100%',
        maxWidth: 340,
    },
    teamMetricBox: {
        width: '47%',
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderRadius: 16,
        alignItems: 'center',
    },
    teamMetricVal: {
        fontSize: 24,
        fontWeight: '900',
        marginBottom: 4,
    },
    teamMetricLabel: {
        color: '#FFFFFF90',
        fontSize: 11,
        textAlign: 'center',
        lineHeight: 14,
    },
    teamMetricSub: {
        color: '#FFFFFF60',
        fontSize: 10,
        textAlign: 'center',
        marginTop: 3,
        lineHeight: 13,
    },
    badgeFinalCard: {
        width: '100%',
        maxWidth: 340,
        backgroundColor: '#111124',
        borderRadius: 24,
        borderWidth: 2,
        padding: 22,
        alignItems: 'center',
        marginVertical: 12,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.4,
                shadowRadius: 10,
            },
            android: {
                elevation: 10,
            },
        }),
    },
    badgeAvatarCircle: {
        width: 76,
        height: 76,
        borderRadius: 38,
        backgroundColor: '#FFFFFF16',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    badgeFinalTitle: {
        fontSize: 22,
        fontWeight: '900',
        textAlign: 'center',
        letterSpacing: 0.5,
    },
    badgeFinalPlayer: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
        marginTop: 4,
        marginBottom: 8,
    },
    badgeFinalDesc: {
        color: '#FFFFFF90',
        fontSize: 13,
        textAlign: 'center',
        lineHeight: 18,
        marginBottom: 16,
    },
    finalScoreGrid: {
        flexDirection: 'row',
        width: '100%',
        borderTopWidth: 1,
        borderTopColor: '#FFFFFF18',
        paddingTop: 12,
        justifyContent: 'space-around',
    },
    finalScoreCol: {
        alignItems: 'center',
    },
    finalScoreVal: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    finalScoreSub: {
        color: '#FFFFFF70',
        fontSize: 10,
        marginTop: 2,
    },
    finalButtonsRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 10,
    },
    actionBtn: {
        paddingVertical: 12,
        paddingHorizontal: 22,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionBtnTextDark: {
        color: '#000000',
        fontSize: 14,
        fontWeight: 'bold',
    },
    actionBtnTextLight: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: 'bold',
    },
    tipPill: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        marginTop: 20,
        borderWidth: 1,
        borderColor: '#FFFFFF24',
    },
    tipPillText: {
        color: '#FFFFFFD0',
        fontSize: 13,
        fontWeight: '600',
        textAlign: 'center',
    },
    bottomBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingVertical: 12,
        zIndex: 10,
    },
    navHintText: {
        color: '#FFFFFF80',
        fontSize: 14,
        fontWeight: '600',
    },
});
