// screens/LiveMatchScreen.tsx
// Interfaccia Live Match e Statistiche per partite di ultimate (CUS Brescia - Bubba)

import React from 'react';
import {
    ScrollView,
    ActivityIndicator,
    useWindowDimensions,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../App';
import ScoreboardHeader from '../components/liveMatch/ScoreboardHeader';
import CompletedMatchSummary from '../components/liveMatch/CompletedMatchSummary';
import LineSelectionPhase from '../components/liveMatch/LineSelectionPhase';
import PullRecordingPhase from '../components/liveMatch/PullRecordingPhase';
import PlayActionPhase from '../components/liveMatch/PlayActionPhase';
import MatchStatsView from '../components/liveMatch/MatchStatsView';
import LineSubstitutionModal from '../components/liveMatch/LineSubstitutionModal';
import MatchRosterModal from '../components/liveMatch/MatchRosterModal';
import EditTouchesModal from '../components/EditTouchesModal';
import { styles } from '../components/liveMatch/liveMatchStyles';
import { useLiveMatchController } from '../components/liveMatch/useLiveMatchController';
import { updateMatchAnalysis } from '../services/firestore';
import { showAlert } from '../utils/alert';

type LiveMatchScreenRouteProp = RouteProp<RootStackParamList, 'LiveMatch'>;

export default function LiveMatchScreen() {
    const { theme } = useTheme();
    const { isStaff } = useAuth();
    const navigation = useNavigation<any>();
    const route = useRoute<LiveMatchScreenRouteProp>();
    const { matchId, initialMatch } = route.params;
    const { width: windowWidth } = useWindowDimensions();
    const isMobile = windowWidth < 600;

    const {
        match,
        allMembers,
        loading,
        activeTab,
        setActiveTab,
        matchRoster,
        playerMap,
        P,
        isCompleted,
        canEdit,
        st,
        pStats,
        tStats,
        ptsN,
        curPt,
        needRatio,
        isAttackingRight,
        fCountInSel,
        mCountInSel,
        isGenderRatioOk,
        pullPrevDots,
        playPrevDots,
        playPrevTrajectories,
        lineSel,
        setLineSel,
        lineStartO,
        setLineStartO,
        pullPuller,
        setPullPuller,
        pendingTrajectory,
        setPendingTrajectory,
        statsSortKey,
        statsSortAsc,
        toggleSort,
        modalLineVisible,
        setModalLineVisible,
        subStep,
        setSubStep,
        subReason,
        setSubReason,
        modalRosterVisible,
        setModalRosterVisible,
        modalTouchesVisible,
        setModalTouchesVisible,
        pending,
        setPending,
        pushEvent,
        handleUndo,
        handleFlipRatio,
        handleFlipDir,
        handleUpdatePullCoord,
        handleUpdateTurnoverEvent,
        handleUpdateGoalEvent,
        handleUpdatePointLine,
        handleTriggerHalfTime,
        handleToggleDone,
        handleExportExcel,
        applyLineChange,
        handleRemapPlayer,
        handleRemovePlayerFromRoster,
    } = useLiveMatchController(matchId, initialMatch, isStaff);

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
                <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 40 }} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            {/* Header Superiore */}
            <ScoreboardHeader
                opponent={match.opponent}
                scoreUs={st.score.us}
                scoreThem={st.score.them}
                isCompleted={isCompleted}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                isStaff={isStaff}
                canEdit={canEdit}
                rosterCount={matchRoster.length}
                onExportExcel={handleExportExcel}
                onOpenTouches={() => setModalTouchesVisible(true)}
                onOpenRoster={() => setModalRosterVisible(true)}
                onUndo={handleUndo}
                onToggleDone={handleToggleDone}
                onBack={() => navigation.goBack()}
                isMobile={isMobile}
            />

            {/* Contenuto Schermata */}
            {activeTab === 'play' ? (
                <ScrollView contentContainerStyle={{ padding: isMobile ? 12 : 16, paddingBottom: 48, gap: 16 }}>
                    {isCompleted ? (
                        <CompletedMatchSummary
                            scoreUs={st.score.us}
                            scoreThem={st.score.them}
                            opponent={match.opponent}
                            pointsCount={st.points.length}
                            eventsCount={match.events?.length || 0}
                            holds={tStats.holds}
                            breaks={tStats.breaks}
                            toUs={tStats.toUs}
                            toThem={tStats.toThem}
                            isStaff={isStaff}
                            onOpenRoster={() => setModalRosterVisible(true)}
                            onToggleDone={handleToggleDone}
                            onOpenStats={() => setActiveTab('stats')}
                        />
                    ) : (
                        <>
                            {st.phase === 'line' && (
                                <LineSelectionPhase
                                    ptsN={ptsN}
                                    needRatio={needRatio}
                                    isStaff={isStaff}
                                    canEdit={canEdit}
                                    startOffense={lineStartO != null ? lineStartO : st.nextO}
                                    onSetLineStartO={setLineStartO}
                                    onFlipRatio={handleFlipRatio}
                                    halfTimeDone={st.halfTimeDone}
                                    onTriggerHalfTime={handleTriggerHalfTime}
                                    lastEventIsHalfTime={
                                        match.events &&
                                        match.events.length > 0 &&
                                        match.events[match.events.length - 1]?.k === 'halftime'
                                    }
                                    matchRoster={matchRoster}
                                    lineSel={lineSel}
                                    onTogglePlayerInLine={id =>
                                        setLineSel(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
                                    }
                                    onSetLineSel={setLineSel}
                                    pStats={pStats}
                                    isMobile={isMobile}
                                    fCountInSel={fCountInSel}
                                    mCountInSel={mCountInSel}
                                    isGenderRatioOk={isGenderRatioOk}
                                    lastPt={st.points.length ? st.points[st.points.length - 1] : null}
                                    lastO={[...st.points].reverse().find(p => p.o)}
                                    lastD={[...st.points].reverse().find(p => !p.o)}
                                    onStartPoint={(line, startOffense) => {
                                        pushEvent({ k: 'start', line, o: startOffense });
                                        setLineSel([]);
                                        setLineStartO(null);
                                        setPullPuller(null);
                                    }}
                                    onOpenRosterModal={() => setModalRosterVisible(true)}
                                />
                            )}
                            {st.phase === 'pull' && curPt && (
                                <PullRecordingPhase
                                    curPt={curPt}
                                    wePull={!curPt.o}
                                    canEdit={canEdit}
                                    pullPuller={pullPuller}
                                    onSetPullPuller={setPullPuller}
                                    onChangeLine={() => {
                                        setLineSel(curPt.line.slice());
                                        setSubStep('roster');
                                        setSubReason('error');
                                        setModalLineVisible(true);
                                    }}
                                    dset={st.dset}
                                    onSelectDset={dset => pushEvent({ k: 'dset', v: dset })}
                                    prevDots={pullPrevDots}
                                    isAttackingRight={isAttackingRight}
                                    onFlipDirection={handleFlipDir}
                                    onRecordPull={(puller, coord) => {
                                        pushEvent({
                                            k: 'pull',
                                            team: !curPt.o ? 'us' : 'them',
                                            p: puller,
                                            x: coord ? coord.x : null,
                                            y: coord ? coord.y : null,
                                        });
                                        setPullPuller(null);
                                    }}
                                    P={P}
                                />
                            )}
                            {st.phase === 'play' && curPt && (
                                <PlayActionPhase
                                    curPt={curPt}
                                    isOffense={st.poss === 'us'}
                                    st={st}
                                    pending={pending}
                                    setPending={setPending}
                                    pendingTrajectory={pendingTrajectory}
                                    setPendingTrajectory={setPendingTrajectory}
                                    prevDots={playPrevDots}
                                    prevTrajectories={playPrevTrajectories}
                                    isAttackingRight={isAttackingRight}
                                    onFlipDirection={handleFlipDir}
                                    canEdit={canEdit}
                                    isMobile={isMobile}
                                    pStats={pStats}
                                    P={P}
                                    pushEvent={pushEvent}
                                    onChangeLine={() => {
                                        setLineSel(curPt.line.slice());
                                        setSubStep('roster');
                                        setSubReason('injury');
                                        setModalLineVisible(true);
                                    }}
                                />
                            )}
                        </>
                    )}
                </ScrollView>
            ) : (
                <MatchStatsView
                    tStats={tStats}
                    pStats={pStats}
                    isMobile={isMobile}
                    statsSortKey={statsSortKey}
                    statsSortAsc={statsSortAsc}
                    onToggleSort={toggleSort}
                    P={P}
                    st={st}
                    match={match}
                    playerMap={playerMap}
                    canEdit={canEdit}
                    onUpdatePullCoord={handleUpdatePullCoord}
                    onUpdateTurnoverEvent={handleUpdateTurnoverEvent}
                    onUpdateGoalEvent={handleUpdateGoalEvent}
                    onUpdatePointLine={handleUpdatePointLine}
                />
            )}

            {/* Modale Sostituzione Linea */}
            <LineSubstitutionModal
                visible={modalLineVisible}
                onClose={() => setModalLineVisible(false)}
                subStep={subStep}
                setSubStep={setSubStep}
                subReason={subReason}
                setSubReason={setSubReason}
                curPt={curPt}
                lineSel={lineSel}
                setLineSel={setLineSel}
                matchRoster={matchRoster}
                P={P}
                onApplyLineChange={applyLineChange}
            />

            {/* Modale Gestione Convocati & Rimappatura */}
            <MatchRosterModal
                visible={modalRosterVisible}
                onClose={() => setModalRosterVisible(false)}
                match={match}
                matchRoster={matchRoster}
                allMembers={allMembers}
                onUpdateCustomRoster={async updated => {
                    await updateMatchAnalysis({ id: match.id, customRoster: updated });
                }}
                onRemovePlayerFromRoster={handleRemovePlayerFromRoster}
                onRemapPlayer={handleRemapPlayer}
            />

            {/* Modale Modifica Manuale Tocchi */}
            <EditTouchesModal
                visible={modalTouchesVisible}
                match={match}
                playerMap={playerMap}
                onClose={() => setModalTouchesVisible(false)}
                onSave={async manualTouches => {
                    try {
                        await updateMatchAnalysis({
                            id: match.id,
                            manualTouches,
                        });
                        showAlert('Tocchi Salvati', `I tocchi dei giocatori per questa partita sono stati aggiornati.`);
                    } catch (err: any) {
                        showAlert('Errore', err?.message || 'Impossibile salvare i tocchi.');
                    }
                }}
            />
        </SafeAreaView>
    );
}
