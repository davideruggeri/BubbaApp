import { useState, useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import {
    subscribeToMembers,
    Member,
    subscribeToHallOfFame,
    HallOfFameEntry,
    subscribeToEvents,
    Event,
    subscribeToLeagueDates,
    subscribeToLeagueAttendance,
    subscribeToLeagueBonuses,
    subscribeToMatchAnalysis,
    MatchAnalysis,
    assignTiedRanks,
    RankedItem,
    getAvailableWrappedSeasons,
    subscribeToUserWrapped,
    subscribeToTeamWrapped,
    UserWrappedData,
    TeamWrappedData,
    isWrappedWithinActivePeriod,
    isWrappedViewed,
    subscribeToSeasonPresenzeCounts,
} from '../../services/firestore';

export function useHomeData(stagioneCorrente: string, userProfile: any) {
    const [topMembers, setTopMembers] = useState<RankedItem<Member>[]>([]);
    const [recentTournaments, setRecentTournaments] = useState<HallOfFameEntry[]>([]);
    const [nextEvent, setNextEvent] = useState<Event | null>(null);
    const [leagueStandings, setLeagueStandings] = useState<{ member: Member; points: number }[]>([]);
    const [activeLeagueTitle, setActiveLeagueTitle] = useState<string | null>(null);
    const [liveMatch, setLiveMatch] = useState<MatchAnalysis | null>(null);
    const fadeAnim = useRef(new Animated.Value(0)).current;

    // Bubba Wrapped state
    const [latestWrappedSeason, setLatestWrappedSeason] = useState<string | null>(null);
    const [userWrapped, setUserWrapped] = useState<UserWrappedData | null>(null);
    const [teamWrapped, setTeamWrapped] = useState<TeamWrappedData | null>(null);
    const [wrappedModalVisible, setWrappedModalVisible] = useState(false);
    const [showWrappedBanner, setShowWrappedBanner] = useState(false);

    const [allMembers, setAllMembers] = useState<Member[]>([]);
    const [events, setEvents] = useState<Event[]>([]);
    const [campoCounts, setCampoCounts] = useState<Record<string, number>>({});

    // 1. Wrapped Subscriptions
    useEffect(() => {
        let unsubscribeUser = () => {};
        let unsubscribeTeam = () => {};

        getAvailableWrappedSeasons().then(seasons => {
            if (seasons.length > 0) {
                const topSeason = seasons[0];
                setLatestWrappedSeason(topSeason);

                unsubscribeTeam = subscribeToTeamWrapped(topSeason, teamData => {
                    setTeamWrapped(teamData);
                });

                const currentUserId = userProfile?.memberId || userProfile?.uid || allMembers[0]?.id;
                if (currentUserId) {
                    unsubscribeUser = subscribeToUserWrapped(
                        topSeason,
                        currentUserId,
                        uData => {
                            setUserWrapped(uData);
                        },
                        userProfile?.email || undefined
                    );
                }
            }
        });

        return () => {
            unsubscribeUser();
            unsubscribeTeam();
        };
    }, [userProfile?.memberId, userProfile?.uid, allMembers]);

    // Check Wrapped Banner Visibility
    useEffect(() => {
        if (!latestWrappedSeason) {
            setShowWrappedBanner(false);
            return;
        }

        const checkVisibility = async () => {
            const withinActivePeriod = isWrappedWithinActivePeriod(teamWrapped?.activatedAt, 30);
            if (withinActivePeriod) {
                setShowWrappedBanner(true);
            } else {
                const viewed = await isWrappedViewed(latestWrappedSeason, userProfile?.uid);
                setShowWrappedBanner(!viewed);
            }
        };

        checkVisibility();
    }, [latestWrappedSeason, teamWrapped?.activatedAt, userProfile?.uid]);

    // 2. Real attendance counts for CAMPO only
    useEffect(() => {
        if (events.length === 0 || !stagioneCorrente) return;
        const today = new Date().toISOString().split('T')[0];
        const pastCampoEvents = events.filter(e => {
            if (e.date > today) return false;
            return e.type === 'Campo' || e.type === 'training' || !e.type;
        });
        const validCampoDates = new Set(pastCampoEvents.map(e => e.date));
        const unsubscribe = subscribeToSeasonPresenzeCounts(
            stagioneCorrente,
            'Campo',
            validCampoDates,
            setCampoCounts
        );
        return () => unsubscribe();
    }, [events, stagioneCorrente]);

    // 3. Top 3 Campo
    useEffect(() => {
        if (allMembers.length === 0) {
            setTopMembers([]);
            return;
        }
        const hasLiveCounts = Object.keys(campoCounts).length > 0;
        const sorted = [...allMembers]
            .map(m => {
                const count = hasLiveCounts ? campoCounts[m.id] || 0 : m.attendanceCount || 0;
                return { ...m, attendanceCount: count };
            })
            .filter(m => (m.attendanceCount || 0) > 0)
            .sort((a, b) => {
                const countA = a.attendanceCount || 0;
                const countB = b.attendanceCount || 0;
                if (countB !== countA) return countB - countA;
                return (a.nickname || a.firstName).localeCompare(b.nickname || b.firstName);
            });
        const ranked = assignTiedRanks(sorted, m => m.attendanceCount || 0);
        setTopMembers(ranked.slice(0, 3));
    }, [allMembers, campoCounts]);

    // 4. Subscriptions for Members, Albo, Calendar Events
    useEffect(() => {
        const unsubscribeMembers = subscribeToMembers(members => {
            setAllMembers(members);
        });

        const unsubscribeAlbo = subscribeToHallOfFame(entries => {
            setRecentTournaments(entries.slice(0, 3));
        });

        const unsubscribeEvents = subscribeToEvents(fetchedEvents => {
            setEvents(fetchedEvents);
            const today = new Date().toISOString().split('T')[0];
            const upcoming = fetchedEvents.filter(e => {
                if (e.isArchived) return false;
                if (e.type === 'training' || e.type === 'Campo' || e.type === 'Palestra') return false;
                const end = e.endDate || e.date;
                return end >= today;
            });
            upcoming.sort((a, b) => a.date.localeCompare(b.date));
            setNextEvent(upcoming.length > 0 ? upcoming[0] : null);
        }, stagioneCorrente);

        return () => {
            unsubscribeMembers();
            unsubscribeAlbo();
            unsubscribeEvents();
        };
    }, [stagioneCorrente]);

    // 5. Match Live Subscription
    useEffect(() => {
        const unsubscribeMatches = subscribeToMatchAnalysis(matches => {
            const live = matches.find(m => m.status === 'live');
            setLiveMatch(live || null);
        }, stagioneCorrente);
        return () => unsubscribeMatches();
    }, [stagioneCorrente]);

    // Live Pulse Animation
    useEffect(() => {
        if (liveMatch) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(fadeAnim, {
                        toValue: 1,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                    Animated.timing(fadeAnim, {
                        toValue: 0,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        }
    }, [liveMatch]);

    // 6. League Standings
    useEffect(() => {
        if (allMembers.length === 0) return;

        const leagueType: 'winter' | 'summer' = 'winter';

        let unsubscribeDates = () => {};
        let unsubscribeAttendance = () => {};
        let unsubscribeBonuses = () => {};

        unsubscribeDates = subscribeToLeagueDates(leagueType, dates => {
            if (dates && dates.startDate && dates.endDate) {
                const start = new Date(dates.startDate);
                const end = new Date(dates.endDate);
                const now = new Date();
                now.setHours(0, 0, 0, 0);
                start.setHours(0, 0, 0, 0);
                end.setHours(0, 0, 0, 0);

                if (now >= start && now <= end) {
                    setActiveLeagueTitle('❄️ Winter League ❄️');

                    unsubscribeAttendance = subscribeToLeagueAttendance(
                        dates.startDate,
                        dates.endDate,
                        attendanceData => {
                            unsubscribeBonuses = subscribeToLeagueBonuses(leagueType, bonuses => {
                                const stats: Record<
                                    string,
                                    { member: Member; points: number; attendanceCount: number }
                                > = {};

                                allMembers.forEach(member => {
                                    stats[member.id] = { member, points: 0, attendanceCount: 0 };
                                });

                                attendanceData.forEach(record => {
                                    if (stats[record.memberId]) {
                                        const event = events.find(e => e.date === record.date);
                                        const isPalestra = event?.type === 'Palestra';

                                        stats[record.memberId].points += 2;

                                        if (!isPalestra) {
                                            stats[record.memberId].attendanceCount++;
                                        }
                                    }
                                });

                                bonuses.forEach(bonus => {
                                    if (stats[bonus.memberId]) {
                                        stats[bonus.memberId].points += bonus.points;
                                    }
                                });

                                const sortedStandings = Object.values(stats)
                                    .sort((a, b) => {
                                        if (b.points !== a.points) return b.points - a.points;
                                        return b.attendanceCount - a.attendanceCount;
                                    })
                                    .slice(0, 3);

                                setLeagueStandings(sortedStandings);
                            });
                        }
                    );
                } else {
                    setActiveLeagueTitle(null);
                    setLeagueStandings([]);
                }
            } else {
                setActiveLeagueTitle(null);
                setLeagueStandings([]);
            }
        });

        return () => {
            unsubscribeDates();
            unsubscribeAttendance();
            unsubscribeBonuses();
        };
    }, [allMembers, events]);

    return {
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
    };
}
