import * as React from 'react';
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, FlatList, ScrollView, TouchableOpacity, Animated } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
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
  LeagueDates,
  LeagueBonus,
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
  subscribeToSeasonPresenzeCounts
} from '../services/firestore';
import ScreenTitle from '../components/ScreenTitle';
import BubbaWrappedModal from '../components/BubbaWrappedModal';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useEasterEggs } from '../context/EasterEggContext';
import { useSeason } from '../context/SeasonContext';
import FallingSnow from '../components/FallingSnow';
import { isChristmasPeriod } from '../utils/date';


export default function HomeScreen() {
  const { theme, isDark, isChristmasEnabled } = useTheme();
  const { findEgg } = useEasterEggs();
  const { stagioneCorrente } = useSeason();
  const isChristmas = isChristmasPeriod() && isChristmasEnabled;


  const navigation = useNavigation<any>();
  const { userProfile } = useAuth();
  const [topMembers, setTopMembers] = useState<RankedItem<Member>[]>([]);
  const [recentTournaments, setRecentTournaments] = useState<HallOfFameEntry[]>([]);
  const [nextEvent, setNextEvent] = useState<Event | null>(null);
  const [leagueStandings, setLeagueStandings] = useState<{ member: Member, points: number }[]>([]);
  const [activeLeagueTitle, setActiveLeagueTitle] = useState<string | null>(null);
  const [liveMatch, setLiveMatch] = useState<MatchAnalysis | null>(null);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  // Bubba Wrapped state
  const [latestWrappedSeason, setLatestWrappedSeason] = useState<string | null>(null);
  const [userWrapped, setUserWrapped] = useState<UserWrappedData | null>(null);
  const [teamWrapped, setTeamWrapped] = useState<TeamWrappedData | null>(null);
  const [wrappedModalVisible, setWrappedModalVisible] = useState(false);
  const [showWrappedBanner, setShowWrappedBanner] = useState(false);

  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [campoCounts, setCampoCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    let unsubscribeUser = () => { };
    let unsubscribeTeam = () => { };

    getAvailableWrappedSeasons().then(seasons => {
      if (seasons.length > 0) {
        const topSeason = seasons[0];
        setLatestWrappedSeason(topSeason);

        unsubscribeTeam = subscribeToTeamWrapped(topSeason, (teamData) => {
          setTeamWrapped(teamData);
        });

        const currentUserId = userProfile?.memberId || userProfile?.uid || allMembers[0]?.id;
        if (currentUserId) {
          unsubscribeUser = subscribeToUserWrapped(topSeason, currentUserId, (uData) => {
            setUserWrapped(uData);
          }, userProfile?.email || undefined);
        }
      }
    });

    return () => {
      unsubscribeUser();
      unsubscribeTeam();
    };
  }, [userProfile?.memberId, userProfile?.uid, allMembers]);

  // Check Wrapped Banner Visibility (active for 30 days, or until first view thereafter)
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

  // Ascolta le presenze reali della stagione corrente solo per eventi CAMPO
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

  // Calcola e ordina la Top 3 Campo reattivamente da presenze reali o contatore indirizzario
  useEffect(() => {
    if (allMembers.length === 0) {
      setTopMembers([]);
      return;
    }
    const hasLiveCounts = Object.keys(campoCounts).length > 0;
    const sorted = [...allMembers]
      .map(m => {
        const count = hasLiveCounts ? (campoCounts[m.id] || 0) : (m.attendanceCount || 0);
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

  useEffect(() => {
    const unsubscribeMembers = subscribeToMembers((members) => {
      setAllMembers(members);
    });

    const unsubscribeAlbo = subscribeToHallOfFame((entries) => {
      setRecentTournaments(entries.slice(0, 3));
    });

    const unsubscribeEvents = subscribeToEvents((fetchedEvents) => {
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

  useEffect(() => {
    const unsubscribeMatches = subscribeToMatchAnalysis((matches) => {
      const live = matches.find(m => m.status === 'live');
      setLiveMatch(live || null);
    }, stagioneCorrente);
    return () => unsubscribeMatches();
  }, [stagioneCorrente]);



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

  useEffect(() => {
    if (allMembers.length === 0) return;

    const leagueType: 'winter' | 'summer' = 'winter';

    let unsubscribeDates = () => { };
    let unsubscribeAttendance = () => { };
    let unsubscribeBonuses = () => { };

    unsubscribeDates = subscribeToLeagueDates(leagueType, (dates) => {
      if (dates && dates.startDate && dates.endDate) {
        const start = new Date(dates.startDate);
        const end = new Date(dates.endDate);
        const now = new Date();
        // Reset time for accurate comparison
        now.setHours(0, 0, 0, 0);
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);

        if (now >= start && now <= end) {
          setActiveLeagueTitle('❄️ Winter League ❄️');

          unsubscribeAttendance = subscribeToLeagueAttendance(dates.startDate, dates.endDate, (attendanceData) => {
            unsubscribeBonuses = subscribeToLeagueBonuses(leagueType, (bonuses) => {

              const stats: Record<string, { member: Member, points: number, attendanceCount: number }> = {};

              allMembers.forEach(member => {
                stats[member.id] = { member, points: 0, attendanceCount: 0 };
              });

              attendanceData.forEach(record => {
                if (stats[record.memberId]) {
                  const event = events.find(e => e.date === record.date);
                  const isPalestra = event?.type === 'Palestra';

                  stats[record.memberId].points += 2;

                  // Palestra gives points but DOES NOT count towards attendance statistics
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
          });
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
  }, [allMembers]);

  const getPlacementColor = (placement: string) => {
    const p = placement.trim();
    if (p === '1') return '#FFD700'; // Gold
    if (p === '2') return '#C0C0C0'; // Silver
    if (p === '3') return '#CD7F32'; // Bronze
    return '#333';
  };

  const renderMember = ({ item }: { item: RankedItem<Member> }) => (
    <View style={[styles.memberCard, { backgroundColor: theme.colors.card }]}>
      <Text style={[styles.rank, { color: theme.colors.primary }]}>
        {item.badge ? `${item.badge}\n#${item.rank}` : `#${item.rank}`}
      </Text>
      <View style={styles.memberInfo}>
        <Text style={[styles.memberName, { color: theme.colors.text }]}>
          {item.nickname ? item.nickname : `${item.firstName} ${item.lastName}`}
          {item.jerseyNumber ? <Text style={{ color: theme.colors.textSecondary, fontSize: 16 }}> #{item.jerseyNumber}</Text> : ''}
        </Text>
        <Text style={[styles.attendanceCount, { color: theme.colors.textSecondary }]}>{item.attendanceCount} presenze</Text>
      </View>
    </View>
  );

  const formatDate = (dateString: any) => {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
  };

  const translateType = (type: string) => {
    switch (type) {
      case 'training':
      case 'Campo':
      case 'Palestra':
        return 'ALLENAMENTO';
      case 'match': return 'AMICHEVOLE';
      case 'championship': return 'CAMPIONATO';
      case 'tournament': return 'TORNEO';
      case 'social': return 'RIUNIONE DI SQUADRA';
      case 'other': return 'ALTRO';
      case 'birthday': return 'COMPLEANNO';
      default: return type.toUpperCase();
    }
  };

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
          <TouchableOpacity
            style={[styles.wrappedBanner, { borderColor: '#FF007F' }]}
            onPress={() => setWrappedModalVisible(true)}
            activeOpacity={0.88}
          >
            <View style={styles.wrappedBannerLeft}>
              <View style={styles.wrappedIconCircle}>
                <Text style={{ fontSize: 28 }}>🎁</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.wrappedBadge}>RECAP STAGIONALE</Text>
                  <Text style={styles.wrappedSeasonText}>{latestWrappedSeason}</Text>
                </View>
                <Text style={styles.wrappedBannerTitle}>Il tuo Bubba Wrapped è pronto!</Text>
                <Text style={styles.wrappedBannerSub}>
                  Rivivi presenze, streak da record, league e trasferte dell&apos;anno 🎉
                </Text>
              </View>
            </View>
            <View style={styles.wrappedBannerAction}>
              <Text style={styles.wrappedActionText}>Guarda le Storie ›</Text>
            </View>
          </TouchableOpacity>
        )}

        {
          liveMatch && (
            <TouchableOpacity
              style={[styles.liveBanner, { backgroundColor: theme.colors.card, borderColor: theme.colors.danger }]}
              onPress={() => navigation.navigate('MatchDetail', { match: liveMatch })}
              activeOpacity={0.9}
            >
              <View style={styles.liveHeader}>
                <Animated.View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: 'red',
                    marginRight: 8,
                    opacity: fadeAnim
                  }}
                />
                <Text style={{ color: 'red', fontWeight: 'bold', fontSize: 16 }}>PARTITA LIVE</Text>
              </View>
              <Text style={[styles.liveMatchTitle, { color: theme.colors.text }]}>
                Bubba vs {liveMatch.opponent}
              </Text>
              <Text style={[styles.liveScore, { color: theme.colors.text }]}>
                {liveMatch.ourScore} - {liveMatch.theirScore}
              </Text>
              <Text style={{ color: theme.colors.primary, marginTop: 5, fontWeight: 'bold' }}>Segui la diretta &gt;</Text>
            </TouchableOpacity>
          )
        }

        {
          nextEvent && (
            <TouchableOpacity
              style={[styles.sectionContainer, { backgroundColor: theme.colors.sectionBackground }]}
              onPress={() => navigation.navigate('Calendar')}
              activeOpacity={0.7}
            >
              <TouchableOpacity activeOpacity={1} onPress={() => findEgg('egg_home_next', 'Sempre Pronti', 'Il prossimo evento sta arrivando a tutta velocità!', 'spinning')}>
                <Text style={[styles.sectionTitle, { color: theme.colors.primary }]}>📅 Prossimo Evento 📅</Text>
              </TouchableOpacity>
              <View style={[styles.eventCard, { backgroundColor: theme.colors.card, borderLeftColor: theme.colors.primary }]}>
                <Text style={[styles.eventTitle, { color: theme.colors.text }]}>{nextEvent.title}</Text>
                <Text style={[styles.eventDate, { color: theme.colors.textSecondary }]}>
                  {formatDate(nextEvent.date)}
                  {nextEvent.endDate ? ` - ${formatDate(nextEvent.endDate)}` : ''}
                </Text>
                <Text style={[styles.eventType, { color: theme.colors.primary }]}>{translateType(nextEvent.type)}</Text>
              </View>
            </TouchableOpacity>
          )
        }

        {
          activeLeagueTitle && leagueStandings.length > 0 && (
            <TouchableOpacity
              style={[styles.sectionContainer, { backgroundColor: theme.colors.sectionBackground }]}
              onPress={() => navigation.navigate('League')}
              activeOpacity={0.7}
            >
              <Text style={[styles.sectionTitle, { color: theme.colors.primary }]}>{activeLeagueTitle}</Text>
              <FlatList
                data={leagueStandings}
                renderItem={({ item, index }) => (
                  <View style={[styles.memberCard, { backgroundColor: theme.colors.card }]}>
                    <Text style={[styles.rank, { color: theme.colors.primary }]}>#{index + 1}</Text>
                    <View style={styles.memberInfo}>
                      <Text style={[styles.memberName, { color: theme.colors.text }]}>
                        {item.member.nickname ? item.member.nickname : `${item.member.firstName} ${item.member.lastName}`}
                        {item.member.jerseyNumber ? <Text style={{ color: theme.colors.textSecondary, fontSize: 14 }}> #{item.member.jerseyNumber}</Text> : ''}
                      </Text>
                      <Text style={[styles.attendanceCount, { color: theme.colors.textSecondary }]}>{item.points} punti</Text>
                    </View>
                  </View>
                )}
                keyExtractor={(item) => item.member.id}
                scrollEnabled={false}
              />
            </TouchableOpacity>
          )
        }

        {
          recentTournaments.length > 0 && (
            <TouchableOpacity
              style={[styles.sectionContainer, { backgroundColor: theme.colors.sectionBackground }]}
              onPress={() => navigation.navigate('HallOfFame')}
              activeOpacity={0.7}
            >
              <TouchableOpacity activeOpacity={1} onPress={() => findEgg('egg_home_hof', 'Il Tuffatore', 'Un tuffo spettacolare verso i vecchi trofei!', 'layout')}>
                <Text style={[styles.sectionTitle, { color: theme.colors.primary }]}>🏅 Ultimi Tornei 🏅</Text>
              </TouchableOpacity>
              {recentTournaments.map(t => (
                <View key={t.id} style={[styles.tournamentCard, { backgroundColor: theme.colors.card }]}>
                  <Text style={[styles.tournamentTitle, { color: theme.colors.text }]}>{t.title}</Text>
                  <Text style={[styles.tournamentPlacement, { color: getPlacementColor(t.placement) }]}>
                    {t.placement}
                  </Text>
                  {t.awards && t.awards.length > 0 && (
                    <Text style={[styles.tournamentAwards, { color: theme.colors.textSecondary }]}>{t.awards.join(', ')}</Text>
                  )}
                </View>
              ))}
            </TouchableOpacity>
          )
        }

        <TouchableOpacity
          style={[styles.sectionContainer, { backgroundColor: theme.colors.sectionBackground }]}
          onPress={() => navigation.navigate('Attendance')}
          activeOpacity={0.7}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => findEgg('egg_home_attendance', 'Presenza d\'Oro', 'Celebriamo i Bubba più presenti!', 'confetti')}>
            <Text style={[styles.sectionTitle, { color: theme.colors.primary }]}>
              🏆 Top 3 Presenze 🏆{'\n'}
              <Text style={[styles.seasonTitleSmall, { color: theme.colors.textSecondary }]}>({stagioneCorrente})</Text>
            </Text>
          </TouchableOpacity>
          <FlatList
            data={topMembers}
            renderItem={renderMember}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
          />
        </TouchableOpacity>
      </ScrollView >

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
    </SafeAreaView >
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor: '#fff', // Removed hardcoded white
  },
  contentContainer: {
    alignItems: 'center',
    padding: 20,
    paddingTop: 40,
  },
  logo: {
    width: 200,
    height: 200,
    marginBottom: 20,
    borderRadius: 100,
  },
  logoContainer: {
    position: 'relative',
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  santaHat: {
    position: 'absolute',
    top: -40,
    left: 56, // Centered on 200px wide logo (200 - 100) / 2 = 50
    width: 100,
    height: 100,
    transform: [{ rotate: '-10deg' }],
    zIndex: 10,
  },
  title: {
    // fontSize: 40,
    // fontWeight: 'bold',
    // marginBottom: 30,
    // textAlign: 'center',
    // color: '#003399',
    // fontFamily: 'NBAMilwaukeeBucks',
  },
  sectionContainer: {
    width: '100%',
    backgroundColor: '#f0f2f5',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#003399',
    marginBottom: 15,
    textAlign: 'center',
  },
  wrappedBanner: {
    width: '100%',
    backgroundColor: '#0F0C20',
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1.5,
    shadowColor: '#FF007F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  wrappedBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  wrappedIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FF007F24',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wrappedBadge: {
    backgroundColor: '#FF007F',
    color: '#FFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  wrappedSeasonText: {
    color: '#FF007FCC',
    fontSize: 11,
    fontWeight: 'bold',
  },
  wrappedBannerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 3,
  },
  wrappedBannerSub: {
    color: '#FFFFFF99',
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  wrappedBannerAction: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#FFFFFF18',
    alignItems: 'flex-end',
  },
  wrappedActionText: {
    color: '#FF007F',
    fontWeight: 'bold',
    fontSize: 13,
  },
  seasonTitleSmall: {
    fontSize: 14,
    fontWeight: 'normal',
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
  },
  rank: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#003399',
    marginRight: 15,
    width: 40,
    textAlign: 'center',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  attendanceCount: {
    fontSize: 14,
    color: '#666',
  },
  tournamentCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    alignItems: 'center',
  },
  tournamentTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  tournamentDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  tournamentPlacement: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  tournamentAwards: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  eventCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    alignItems: 'center',
    borderLeftWidth: 5,
    borderLeftColor: '#003399',
  },
  eventTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  eventDate: {
    fontSize: 16,
    color: '#666',
    marginBottom: 5,
    fontWeight: '600',
  },
  eventType: {
    fontSize: 14,
    color: '#003399',
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  liveBanner: {
    width: '100%',
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
    alignItems: 'center',
    borderWidth: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  liveHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  liveMatchTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  liveScore: {
    fontSize: 24,
    fontWeight: 'bold',
  }
});
