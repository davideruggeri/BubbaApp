import * as React from 'react';
import { View, Image, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import ScreenTitle from '../components/ScreenTitle';
import BubbaWrappedModal from '../components/BubbaWrappedModal';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useEasterEggs } from '../context/EasterEggContext';
import { useSeason } from '../context/SeasonContext';
import FallingSnow from '../components/FallingSnow';
import { isChristmasPeriod } from '../utils/date';
import { isWrappedWithinActivePeriod } from '../services/firestore';
import {
    homeStyles as styles,
    useHomeData,
    HomeLiveMatchBanner,
    HomeNextEventCard,
    HomeTopAttendanceCard,
    HomeRecentTournamentsCard,
    HomeLeagueCard,
    HomeWrappedBanner,
} from '../components/home';

export default function HomeScreen() {
    const { theme, isDark, isChristmasEnabled } = useTheme();
    const { findEgg } = useEasterEggs();
    const { stagioneCorrente } = useSeason();
    const isChristmas = isChristmasPeriod() && isChristmasEnabled;

    const navigation = useNavigation<any>();
    const { userProfile } = useAuth();

    const {
        topMembers,
        recentTournaments,
        nextEvent,
        leagueStandings,
        activeLeagueTitle,
        liveMatch,
        fadeAnim,
        latestWrappedSeason,
        userWrapped,
        teamWrapped,
        wrappedModalVisible,
        setWrappedModalVisible,
        showWrappedBanner,
        setShowWrappedBanner,
    } = useHomeData(stagioneCorrente, userProfile);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            {isChristmas && (
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }} pointerEvents="none">
                    <FallingSnow />
                </View>
            )}

            <ScrollView contentContainerStyle={styles.contentContainer}>
                <TouchableOpacity
                    style={styles.logoContainer}
                    activeOpacity={0.9}
                    onPress={() => findEgg('egg_home_logo', 'Il Lanciatore', 'Hai lanciato il disco nel logo!', 'huck')}
                >
                    <Image
                        source={isDark ? require('../assets/logoNero.jpeg') : require('../assets/logoBianco.jpeg')}
                        style={styles.logo}
                        resizeMode="contain"
                    />
                    {isChristmas && (
                        <Image
                            source={require('../assets/santa.png')}
                            style={styles.santaHat}
                            resizeMode="contain"
                        />
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    activeOpacity={1}
                    onPress={() => findEgg('egg_home_title', 'Pioggia Spirit', 'È iniziata una pioggia di frisbee!', 'rain')}
                >
                    <ScreenTitle title="BUBBA APP" style={{ marginBottom: 20 }} hideHat={true} />
                </TouchableOpacity>

                {/* Bubba Wrapped Banner */}
                {latestWrappedSeason && showWrappedBanner && (
                    <HomeWrappedBanner
                        season={latestWrappedSeason}
                        onPress={() => setWrappedModalVisible(true)}
                    />
                )}

                {/* Live Match Banner */}
                {liveMatch && (
                    <HomeLiveMatchBanner
                        liveMatch={liveMatch}
                        fadeAnim={fadeAnim}
                        theme={theme}
                        onPress={() => navigation.navigate('MatchDetail', { match: liveMatch })}
                    />
                )}

                {/* Next Event */}
                {nextEvent && (
                    <HomeNextEventCard
                        nextEvent={nextEvent}
                        theme={theme}
                        onPress={() => navigation.navigate('Calendar')}
                        onFindEgg={() =>
                            findEgg('egg_home_next', 'Sempre Pronti', 'Il prossimo evento sta arrivando a tutta velocità!', 'spinning')
                        }
                    />
                )}

                {/* Active League */}
                {activeLeagueTitle && leagueStandings.length > 0 && (
                    <HomeLeagueCard
                        title={activeLeagueTitle}
                        standings={leagueStandings}
                        theme={theme}
                        onPress={() => navigation.navigate('League')}
                    />
                )}

                {/* Recent Tournaments */}
                {recentTournaments.length > 0 && (
                    <HomeRecentTournamentsCard
                        recentTournaments={recentTournaments}
                        theme={theme}
                        onPress={() => navigation.navigate('HallOfFame')}
                        onFindEgg={() =>
                            findEgg('egg_home_hof', 'Il Tuffatore', 'Un tuffo spettacolare verso i vecchi trofei!', 'layout')
                        }
                    />
                )}

                {/* Top 3 Attendance */}
                <HomeTopAttendanceCard
                    topMembers={topMembers}
                    stagioneCorrente={stagioneCorrente}
                    theme={theme}
                    onPress={() => navigation.navigate('Attendance')}
                    onFindEgg={() =>
                        findEgg('egg_home_attendance', "Presenza d'Oro", 'Celebriamo i Bubba più presenti!', 'confetti')
                    }
                />
            </ScrollView>

            {/* Bubba Wrapped Fullscreen Modal */}
            <BubbaWrappedModal
                visible={wrappedModalVisible}
                onClose={() => {
                    setWrappedModalVisible(false);
                    if (latestWrappedSeason && !isWrappedWithinActivePeriod(teamWrapped?.activatedAt, 30)) {
                        setShowWrappedBanner(false);
                    }
                }}
                userWrapped={userWrapped}
                teamWrapped={teamWrapped}
                stagione={latestWrappedSeason || '2025-2026'}
            />
        </SafeAreaView>
    );
}
