import React, { useState, useMemo } from 'react';
import { ScrollView } from 'react-native';
import { styles } from './liveMatchStyles';
import TeamKpiCard from './TeamKpiCard';
import PlayerStatsTable from './PlayerStatsTable';
import PlayerDetailModal from './PlayerDetailModal';
import ScoreProgressionChart from './ScoreProgressionChart';
import MatchTimelineCard from './MatchTimelineCard';
import { PullMapCard } from './PullMapCard';
import { TurnoverMapCard } from './TurnoverMapCard';
import { MatchStatsViewProps } from './matchStatsTypes';

export default function MatchStatsView({
    tStats,
    pStats,
    isMobile,
    statsSortKey,
    statsSortAsc,
    onToggleSort,
    P,
    st,
    match,
    canEdit = false,
    onUpdatePullCoord,
}: MatchStatsViewProps) {
    const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

    const ids = useMemo(() => {
        return Object.keys(pStats).sort((a, b) => {
            const valA = (pStats[a] as any)[statsSortKey] ?? 0;
            const valB = (pStats[b] as any)[statsSortKey] ?? 0;
            if (valA !== valB) {
                return statsSortAsc ? valA - valB : valB - valA;
            }
            return P(a).name.localeCompare(P(b).name);
        });
    }, [pStats, statsSortKey, statsSortAsc, P]);

    return (
        <ScrollView style={styles.statsScroll} contentContainerStyle={styles.statsScrollContent}>
            {/* KPI Squadra */}
            <TeamKpiCard tStats={tStats} isMobile={isMobile} />

            {/* Grafico Andamento Partita */}
            <ScoreProgressionChart
                points={st.points}
                opponentName={match.opponent}
                isMobile={isMobile}
                P={P}
            />

            {/* Tabella Giocatori */}
            <PlayerStatsTable
                ids={ids}
                pStats={pStats}
                getPlayer={id => ({ name: P(id).name, g: P(id).g })}
                statsSortKey={statsSortKey}
                statsSortAsc={statsSortAsc}
                onToggleSort={onToggleSort}
                onSelectPlayer={setSelectedPlayerId}
            />

            {/* Mappa Pull */}
            <PullMapCard
                st={st}
                match={match}
                P={P}
                isMobile={isMobile}
                canEdit={canEdit}
                onUpdatePullCoord={onUpdatePullCoord}
            />

            {/* Mappa Turnover & Difese */}
            <TurnoverMapCard st={st} match={match} P={P} />

            {/* Modale Scheda Dettaglio Giocatore */}
            <PlayerDetailModal
                visible={!!selectedPlayerId}
                playerId={selectedPlayerId}
                onClose={() => setSelectedPlayerId(null)}
                pStats={pStats}
                points={st.points}
                P={P}
                opponentName={match.opponent}
                isMobile={isMobile}
            />

            {/* Cronologia Interattiva Partita Point-by-Point */}
            <MatchTimelineCard
                points={st.points}
                rawEvents={match.events}
                P={P}
                opponentName={match.opponent}
                isMobile={isMobile}
            />
        </ScrollView>
    );
}
