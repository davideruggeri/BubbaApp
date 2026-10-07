// services/firestore/badges.ts
// Gestione sistema Badge & Gamification a livelli

import { db } from '../../firebaseConfig';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { calculateMemberStreaks } from './attendance';

export type BadgeTier = 'bronze' | 'silver' | 'gold' | 'diamond';

export interface BadgeTierConfig {
    tier: BadgeTier;
    level: number;
    target: number;
    title: string;
    description: string;
    icon: string;
    badgeEmoji: string;
    achievedDate?: string;
}

export interface BadgeCategory {
    id: string;
    name: string;
    icon: string;
    unit: string;
    tiers: BadgeTierConfig[];
}

export interface UserBadgeProgress {
    categoryId: string;
    categoryName: string;
    categoryIcon: string;
    currentValue: number;
    unit: string;
    highestTierAchieved: BadgeTierConfig | null;
    nextTier: BadgeTierConfig | null;
    unlockedTiers: BadgeTierConfig[];
    allTiers: BadgeTierConfig[];
    progressToNext: number; // 0 to 1
}

export const BADGE_CATEGORIES: BadgeCategory[] = [
    {
        id: 'streak',
        name: 'Presenza di Ferro',
        icon: '🛡️',
        unit: 'all. di fila',
        tiers: [
            { tier: 'bronze', level: 1, target: 5, title: 'Costanza Iniziale', description: '5 allenamenti consecutivi', icon: '🥉', badgeEmoji: '🥉' },
            { tier: 'silver', level: 2, target: 10, title: 'Presenza di Ferro', description: '10 allenamenti consecutivi', icon: '🥈', badgeEmoji: '🥈' },
            { tier: 'gold', level: 3, target: 18, title: 'Inarrestabile', description: '18 allenamenti consecutivi', icon: '🥇', badgeEmoji: '🥇' },
            { tier: 'diamond', level: 4, target: 30, title: 'Muro Portante', description: '30 allenamenti consecutivi', icon: '💎', badgeEmoji: '💎' },
        ]
    },
    {
        id: 'total_attendance',
        name: 'Fedeltà Bubba',
        icon: '💯',
        unit: 'presenze',
        tiers: [
            { tier: 'bronze', level: 1, target: 25, title: 'Rookie Affidabile', description: '25 presenze complessive', icon: '🥉', badgeEmoji: '🥉' },
            { tier: 'silver', level: 2, target: 50, title: 'Pilastro del Club', description: '50 presenze complessive', icon: '🥈', badgeEmoji: '🥈' },
            { tier: 'gold', level: 3, target: 100, title: 'Centenario', description: '100 presenze complessive', icon: '🥇', badgeEmoji: '🥇' },
            { tier: 'diamond', level: 4, target: 200, title: 'Leggenda Bubba', description: '200 presenze complessive', icon: '💎', badgeEmoji: '💎' },
        ]
    },
    {
        id: 'campo',
        name: 'Guerriero del Campo',
        icon: '🏟️',
        unit: 'pres. campo',
        tiers: [
            { tier: 'bronze', level: 1, target: 15, title: 'Aria Aperta', description: '15 presenze al campo', icon: '🥉', badgeEmoji: '🥉' },
            { tier: 'silver', level: 2, target: 35, title: 'Combattente dell\'Erba', description: '35 presenze al campo', icon: '🥈', badgeEmoji: '🥈' },
            { tier: 'gold', level: 3, target: 75, title: 'Padrone del Prato', description: '75 presenze al campo', icon: '🥇', badgeEmoji: '🥇' },
            { tier: 'diamond', level: 4, target: 150, title: 'Re dell\'Outdoor', description: '150 presenze al campo', icon: '💎', badgeEmoji: '💎' },
        ]
    },
    {
        id: 'palestra',
        name: 'Re del Parquet',
        icon: '🏋️',
        unit: 'pres. palestra',
        tiers: [
            { tier: 'bronze', level: 1, target: 10, title: 'Indoor Starter', description: '10 presenze in palestra', icon: '🥉', badgeEmoji: '🥉' },
            { tier: 'silver', level: 2, target: 25, title: 'Specialista Parquet', description: '25 presenze in palestra', icon: '🥈', badgeEmoji: '🥈' },
            { tier: 'gold', level: 3, target: 40, title: 'Signore del Palazzetto', description: '40 presenze in palestra', icon: '🥇', badgeEmoji: '🥇' },
            { tier: 'diamond', level: 4, target: 50, title: 'Maestro Indoor', description: '50 presenze in palestra', icon: '💎', badgeEmoji: '💎' },
        ]
    },
    {
        id: 'tournaments',
        name: 'Veterano dei Tornei',
        icon: '🏆',
        unit: 'tornei',
        tiers: [
            { tier: 'bronze', level: 1, target: 1, title: 'Battesimo del Campo', description: 'Partecipazione a 1 torneo', icon: '🥉', badgeEmoji: '🥉' },
            { tier: 'silver', level: 2, target: 5, title: 'Viaggiatore Seriale', description: 'Partecipazione a 5 tornei', icon: '🥈', badgeEmoji: '🥈' },
            { tier: 'gold', level: 3, target: 10, title: 'Veterano di Guerra', description: 'Partecipazione a 10 tornei', icon: '🥇', badgeEmoji: '🥇' },
            { tier: 'diamond', level: 4, target: 20, title: 'Leggenda delle Trasferte', description: 'Partecipazione a 20 tornei', icon: '💎', badgeEmoji: '💎' },
        ]
    }
];

export const calculateMemberBadges = async (memberId: string): Promise<UserBadgeProgress[]> => {
    if (!memberId) return [];

    try {
        const today = new Date().toISOString().split('T')[0];

        // 1. Calendario e mappatura eventi
        const calendarSnap = await getDocs(collection(db, 'calendario'));
        const eventTypeMap = new Map<string, string>();
        const eventDateMap = new Map<string, string>();
        const allTrainings: { date: string; type: 'Campo' | 'Palestra' }[] = [];

        calendarSnap.docs.forEach(docSnap => {
            const data = docSnap.data();
            const date = (data.date || docSnap.id).split('T')[0];
            const eventType = data.type || 'Campo';
            eventTypeMap.set(date, eventType);
            eventDateMap.set(docSnap.id, date);

            if (date <= today && (eventType === 'Campo' || eventType === 'Palestra' || eventType === 'training')) {
                allTrainings.push({ date, type: eventType === 'Palestra' ? 'Palestra' : 'Campo' });
            }
        });
        allTrainings.sort((a, b) => a.date.localeCompare(b.date));

        // 2. Presenze storiche del membro
        const presenzeSnap = await getDocs(query(
            collection(db, 'presenze'),
            where('memberId', '==', memberId)
        ));

        const attendedRecords: { date: string; type: 'Campo' | 'Palestra' }[] = [];
        presenzeSnap.docs.forEach(docSnap => {
            const p = docSnap.data();
            const date = (p.date || '').split('T')[0];
            if (date) {
                const type = eventTypeMap.get(date) || 'Campo';
                attendedRecords.push({ date, type: type === 'Palestra' ? 'Palestra' : 'Campo' });
            }
        });
        // Ordina cronologicamente
        attendedRecords.sort((a, b) => a.date.localeCompare(b.date));

        const attendedSet = new Set(attendedRecords.map(r => r.date));
        const totalDates = attendedRecords.map(r => r.date);
        const campoDates = attendedRecords.filter(r => r.type === 'Campo').map(r => r.date);
        const palestraDates = attendedRecords.filter(r => r.type === 'Palestra').map(r => r.date);

        // 3. Calcolo Streak all-time e date in cui ciascun livello di streak è stato raggiunto
        let currentStreakRun = 0;
        const streakDatesAtTarget: Record<number, string> = {};
        for (const t of allTrainings) {
            if (attendedSet.has(t.date)) {
                currentStreakRun++;
                if (!streakDatesAtTarget[currentStreakRun]) {
                    streakDatesAtTarget[currentStreakRun] = t.date;
                }
            } else {
                currentStreakRun = 0;
            }
        }

        const streaks = await calculateMemberStreaks(memberId, 'all');
        const maxStreak = Math.max(streaks.streakMassima || 0, streaks.currentStreak || 0);

        // 4. Tornei del membro con date
        const rosterSnap = await getDocs(query(
            collection(db, 'roster'),
            where('memberId', '==', memberId)
        ));
        const tournamentDates: string[] = [];
        rosterSnap.docs.forEach(d => {
            const rData = d.data();
            if (rData.eventId) {
                const evDate = eventDateMap.get(rData.eventId) || (rData.date ? rData.date.split('T')[0] : '');
                if (evDate) tournamentDates.push(evDate);
            }
        });
        tournamentDates.sort();

        // 5. Mappatura valori correnti
        const categoryValues: Record<string, number> = {
            streak: maxStreak,
            total_attendance: totalDates.length,
            campo: campoDates.length,
            palestra: palestraDates.length,
            tournaments: tournamentDates.length
        };

        // 6. Calcolo progressi e date di raggiungimento per ciascun badge
        return BADGE_CATEGORIES.map(category => {
            const currentValue = categoryValues[category.id] || 0;

            const tiersWithDates = category.tiers.map(tier => {
                const isUnlocked = currentValue >= tier.target;
                let achievedDate: string | undefined = undefined;

                if (isUnlocked) {
                    if (category.id === 'streak') {
                        achievedDate = streakDatesAtTarget[tier.target];
                    } else if (category.id === 'total_attendance') {
                        achievedDate = totalDates[tier.target - 1];
                    } else if (category.id === 'campo') {
                        achievedDate = campoDates[tier.target - 1];
                    } else if (category.id === 'palestra') {
                        achievedDate = palestraDates[tier.target - 1];
                    } else if (category.id === 'tournaments') {
                        achievedDate = tournamentDates[tier.target - 1];
                    }
                }

                return {
                    ...tier,
                    achievedDate
                };
            });

            const unlockedTiers = tiersWithDates.filter(t => currentValue >= t.target);
            const highestTierAchieved = unlockedTiers.length > 0 ? unlockedTiers[unlockedTiers.length - 1] : null;
            const nextTier = tiersWithDates.find(t => currentValue < t.target) || null;

            let progressToNext = 1;
            if (nextTier) {
                const prevTarget = highestTierAchieved ? highestTierAchieved.target : 0;
                const range = nextTier.target - prevTarget;
                const earned = currentValue - prevTarget;
                progressToNext = Math.min(1, Math.max(0, range > 0 ? earned / range : 0));
            }

            return {
                categoryId: category.id,
                categoryName: category.name,
                categoryIcon: category.icon,
                currentValue,
                unit: category.unit,
                highestTierAchieved,
                nextTier,
                unlockedTiers,
                allTiers: tiersWithDates,
                progressToNext
            };
        });
    } catch (error) {
        console.error("Error calculating member badges:", error);
        return [];
    }
};
