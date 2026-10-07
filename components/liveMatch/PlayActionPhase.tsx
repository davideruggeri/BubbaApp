// components/liveMatch/PlayActionPhase.tsx
// Componente per la fase attiva di gioco del punto (azioni attacco/difesa, selezione marcatore/assist/turnover e mappa campo)

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { styles } from './liveMatchStyles';
import { useTheme } from '../../context/ThemeContext';
import InteractiveField, { FieldDot, FieldTrajectory } from '../InteractiveField';
import { DSETS, emptyPS } from '../../utils/statsEngine';

export interface PendingAction {
    step: 'goal_s' | 'goal_a' | 'tt' | 'td' | 'ts' | 'd' | 'call' | 'where';
    s?: string;
    a?: string | null;
    e?: any;
}

interface PlayActionPhaseProps {
    curPt: any;
    isOffense: boolean;
    st: any;
    pending: PendingAction | null;
    setPending: (pending: PendingAction | null) => void;
    pendingTrajectory: { x: number; y: number }[] | null;
    setPendingTrajectory: (traj: { x: number; y: number }[] | null) => void;
    prevDots: FieldDot[];
    prevTrajectories: FieldTrajectory[];
    isAttackingRight: boolean;
    onFlipDirection: () => void;
    canEdit: boolean;
    isMobile: boolean;
    pStats: Record<string, any>;
    P: (id: string) => { name: string; g: 'M' | 'F' };
    pushEvent: (event: any) => void;
    onChangeLine: () => void;
}

export default function PlayActionPhase({
    curPt,
    isOffense,
    st,
    pending,
    setPending,
    pendingTrajectory,
    setPendingTrajectory,
    prevDots,
    prevTrajectories,
    isAttackingRight,
    onFlipDirection,
    canEdit,
    isMobile,
    pStats,
    P,
    pushEvent,
    onChangeLine,
}: PlayActionPhaseProps) {
    const { theme } = useTheme();

    // 1. Se siamo in attesa di coordinata campo ("DOVE?")
    if (pending && pending.step === 'where') {
        const currentEvent = pending.e;
        const isThrowTO = currentEvent?.k === 'tt';
        const isDropTO = currentEvent?.k === 'td';
        const isDefense = currentEvent?.k === 'd';
        const isOpponentError = currentEvent?.k === 'err';
        const isTrajectoryTO = isThrowTO || isDropTO || isOpponentError;
        const toColor = isDefense ? '#2E8540' : (isOpponentError ? '#E07A1F' : (curPt.o ? '#C8323C' : '#1F6FD1'));

        const eventDesc = isThrowTO ? 'TO LANCIO'
            : isDropTO ? 'TO PRESA'
            : currentEvent?.k === 'ts' ? 'STALL OUT'
            : isDefense ? 'DIFESA'
            : currentEvent?.k === 'call' ? 'CALLAHAN'
            : isOpponentError ? 'ERRORE LORO'
            : 'TURNOVER';

        const playerDesc = currentEvent?.p ? ` — ${P(currentEvent.p).name}` : '';

        const currentTrajectories = [...prevTrajectories];
        if (pendingTrajectory && pendingTrajectory.length >= 2) {
            currentTrajectories.push({ points: pendingTrajectory, color: toColor });
        }

        const isThem = isDefense || currentEvent?.k === 'call' || isOpponentError;
        const bannerBg = isDefense ? '#2E8540' : (isThem ? '#E07A1F' : (curPt.o ? '#C8323C' : '#1F6FD1'));

        return (
            <View style={styles.phaseContainer}>
                <View style={[styles.statusBanner, { backgroundColor: bannerBg }]}>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.statusTitle, { color: '#fff' }]}>
                            {eventDesc}{playerDesc}
                        </Text>
                        <Text style={[styles.statusSub, { color: '#fff' }]}>
                            {isTrajectoryTO
                                ? (pendingTrajectory ? 'Traiettoria tracciata! Verifica la freccia verso il punto di caduta' : 'Traccia con il mouse o con il dito la traiettoria verso il punto di caduta')
                                : 'Segna la posizione sul campo'}
                        </Text>
                    </View>
                </View>

                <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <Text style={[styles.cardTitle, { color: theme.colors.text, marginBottom: 0 }]}>
                            {isTrajectoryTO ? 'Disegna la traiettoria del disco' : 'Tocca dove è avvenuta l\'azione'}
                        </Text>
                        <TouchableOpacity
                            style={styles.promptActionBtn}
                            onPress={() => {
                                setPending(null);
                                setPendingTrajectory(null);
                            }}
                        >
                            <Text style={styles.promptActionText}>Annulla</Text>
                        </TouchableOpacity>
                    </View>
                    <Text style={{ fontSize: 11, color: theme.colors.textSecondary, marginBottom: 8 }}>
                        {isOpponentError
                            ? 'Tieni premuto e trascina per disegnare la traiettoria dell\'errore oppure tocca un punto per registrare una Difesa'
                            : isTrajectoryTO
                                ? 'Trascina con il mouse o con il dito sul campo dal punto di rilascio a dove è caduto il disco (la freccia indicherà l\'arrivo)'
                                : 'Tocca sul campo per salvare le coordinate oppure tocca "Salta" sotto se non vuoi registrarle'}
                    </Text>

                    <InteractiveField
                        dots={prevDots}
                        trajectories={currentTrajectories}
                        interactive={canEdit}
                        drawTrajectoryMode={isTrajectoryTO && !pendingTrajectory}
                        drawingColor={toColor}
                        isPlayMode={true}
                        flip={!isAttackingRight}
                        onTrajectoryComplete={traj => {
                            setPendingTrajectory(traj);
                        }}
                        onFieldPress={coord => {
                            const e = pending.e!;
                            setPendingTrajectory(null);
                            if (e.k === 'err' || (!isOffense && e.k !== 'd' && e.k !== 'call')) {
                                if (e.p) {
                                    setPending(null);
                                    pushEvent({ k: 'd', p: e.p, x: coord.x, y: coord.y });
                                } else {
                                    setPending({ step: 'd', e: { k: 'd', x: coord.x, y: coord.y } });
                                }
                            } else {
                                setPending(null);
                                pushEvent({ ...e, x: coord.x, y: coord.y });
                            }
                        }}
                        onFlipDirection={onFlipDirection}
                    />

                    {/* Barra azioni per confermare o ridisegnare la traiettoria */}
                    {isTrajectoryTO && pendingTrajectory ? (
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, gap: 8 }}>
                            <TouchableOpacity
                                style={{
                                    backgroundColor: '#E2E8F0',
                                    paddingHorizontal: 12,
                                    paddingVertical: 9,
                                    borderRadius: 8
                                }}
                                onPress={() => setPendingTrajectory(null)}
                            >
                                <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#1E293B' }}>↺ Ridisegna</Text>
                            </TouchableOpacity>

                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                <TouchableOpacity
                                    style={styles.skipBtn}
                                    onPress={() => {
                                        const e = pending.e!;
                                        setPending(null);
                                        setPendingTrajectory(null);
                                        pushEvent(e);
                                    }}
                                >
                                    <Text style={styles.skipBtnText}>Salta</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.skipBtn, { backgroundColor: '#2E8540', borderColor: '#2E8540' }]}
                                    onPress={() => {
                                        const e = pending.e!;
                                        // Errore di lancio: pallino all'inizio della freccia (rilascio)
                                        // Errore di presa: pallino alla fine della freccia (caduta/ricezione)
                                        const isThrow = e.k === 'tt';
                                        const targetPt = isThrow ? pendingTrajectory[0] : pendingTrajectory[pendingTrajectory.length - 1];
                                        setPending(null);
                                        setPendingTrajectory(null);
                                        pushEvent({
                                            ...e,
                                            x: targetPt.x,
                                            y: targetPt.y,
                                            trajectory: pendingTrajectory
                                        });
                                    }}
                                >
                                    <Text style={[styles.skipBtnText, { color: '#fff', fontWeight: 'bold' }]}>
                                        Conferma Traiettoria ✓
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 }}>
                            <TouchableOpacity
                                style={styles.skipBtn}
                                onPress={() => {
                                    const e = pending.e!;
                                    setPending(null);
                                    setPendingTrajectory(null);
                                    pushEvent(e);
                                }}
                            >
                                <Text style={styles.skipBtnText}>Salta (Non registrare coordinate)</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </View>
        );
    }

    // 2. Se siamo in attesa di selezione giocatore (Marcatore, Assist, TO, Difesa)
    let promptText = '';
    let isPickable = false;
    let excludeId: string | undefined = undefined;

    if (pending) {
        const labels: Record<string, string> = {
            goal_a: 'Chi ha fatto l\'ASSIST?',
            goal_s: pending.a ? `Assist di ${P(pending.a).name}. Chi ha SEGNATO la meta?` : 'Chi ha SEGNATO la meta?',
            tt: 'Chi ha sbagliato il LANCIO?',
            td: 'Chi ha sbagliato la PRESA?',
            ts: 'Chi ha subito lo STALL OUT?',
            d: 'Chi ha fatto la DIFESA?',
            call: 'Chi ha fatto il CALLAHAN?'
        };
        promptText = labels[pending.step] || 'Seleziona giocatore:';
        isPickable = true;
        if (pending.step === 'goal_s' && pending.a) excludeId = pending.a;
    }

    return (
        <View style={styles.phaseContainer}>
            {/* Banner Possesso Palla */}
            <View style={[styles.statusBanner, { backgroundColor: isOffense ? '#C0D725' : '#003057' }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={[styles.statusTitle, { color: isOffense ? '#131E29' : '#fff' }]}>
                        {isOffense ? 'DISCO NOSTRO — ATTACCO' : 'DISCO LORO — DIFESA'}
                    </Text>
                    {!isOffense && (
                        <View style={{
                            backgroundColor: st.dset ? '#E07A1F' : 'rgba(255,255,255,0.22)',
                            paddingHorizontal: 10,
                            paddingVertical: 3,
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: st.dset ? '#C25E0A' : 'rgba(255,255,255,0.4)'
                        }}>
                            <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>
                                {st.dset ? `🛡️ ${st.dset.toUpperCase()}` : '🛡️ SCHEMA ?'}
                            </Text>
                        </View>
                    )}
                </View>
                <Text style={[styles.statusSub, { color: isOffense ? '#131E29' : '#fff' }]}>
                    TO nostri: {curPt.toUs} · TO loro: {curPt.toThem}{isOffense ? ` · Tocchi: ${curPt.touches || 0}${st.holder ? ` · 🥏 ${P(st.holder).name}` : ''}` : ''}
                </Text>
            </View>

            {/* Prompt selezione giocatore in corso */}
            {pending && (
                <View style={styles.promptBanner}>
                    <Text style={styles.promptTitle}>{promptText}</Text>
                    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                        {pending.step === 'goal_s' && pending.a && (
                            <TouchableOpacity
                                style={styles.promptActionBtn}
                                onPress={() => setPending({ step: 'goal_a' })}
                            >
                                <Text style={styles.promptActionText}>Cambia Assist</Text>
                            </TouchableOpacity>
                        )}
                        {pending.step === 'goal_s' && pending.a && (
                            <TouchableOpacity
                                style={styles.promptActionBtn}
                                onPress={() => setPending({ step: 'goal_s', a: null })}
                            >
                                <Text style={styles.promptActionText}>Nessun Assist</Text>
                            </TouchableOpacity>
                        )}
                        {pending.step === 'goal_a' && (
                            <TouchableOpacity
                                style={styles.promptActionBtn}
                                onPress={() => setPending({ step: 'goal_s', a: null })}
                            >
                                <Text style={styles.promptActionText}>Nessun Assist</Text>
                            </TouchableOpacity>
                        )}
                        {pending.step === 'd' && pending.e && pending.e.x != null && (
                            <TouchableOpacity
                                style={styles.promptActionBtn}
                                onPress={() => {
                                    const e = pending.e!;
                                    setPending(null);
                                    pushEvent({ ...e, p: null });
                                }}
                            >
                                <Text style={styles.promptActionText}>Senza Giocatore</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity style={styles.promptActionBtn} onPress={() => setPending(null)}>
                            <Text style={styles.promptActionText}>Annulla</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {/* I 5 Giocatori in Campo */}
            <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <View style={styles.rowBetween}>
                    <View>
                        <Text style={[styles.cardTitle, { color: theme.colors.text, marginBottom: isOffense && !pending ? 2 : 8 }]}>Giocatori in Campo</Text>
                        {isOffense && !pending && (
                            <Text style={{ fontSize: 11, color: theme.colors.textSecondary, marginBottom: 6 }}>
                                Tocca un giocatore per passare il disco 🥏
                            </Text>
                        )}
                    </View>
                    {canEdit && (
                        <TouchableOpacity
                            style={styles.changeLineBtn}
                            onPress={onChangeLine}
                        >
                            <Text style={styles.changeLineText}>Cambio Linea</Text>
                        </TouchableOpacity>
                    )}
                </View>

                <View style={styles.playerGrid}>
                    {curPt.line.map((id: string) => {
                        const isHolder = isOffense && st.holder === id;
                        const canPick = (isPickable || (canEdit && isOffense && !pending)) && id !== excludeId;
                        const ps = pStats[id] || emptyPS();
                        return (
                            <TouchableOpacity
                                key={id}
                                style={[
                                    styles.pbtn,
                                    isMobile ? styles.pbtnMobile : styles.pbtnDesktop,
                                    canPick && pending && styles.pbtnPick,
                                    isHolder && styles.pbtnHolder,
                                    {
                                        backgroundColor: isHolder
                                            ? (theme.dark ? '#1B382B' : '#E8F5E9')
                                            : (canPick && pending ? (theme.dark ? '#2A3B1D' : '#F6FAD9') : theme.colors.card),
                                        borderColor: isHolder
                                            ? '#2E8540'
                                            : (canPick && pending ? '#C0D725' : (canPick && isOffense ? '#8EA325' : theme.colors.border))
                                    }
                                ]}
                                disabled={!canPick}
                                onPress={() => {
                                    if (!pending) {
                                        if (canEdit && isOffense) {
                                            pushEvent({ k: 'touch', p: id });
                                        }
                                        return;
                                    }
                                    if (pending.step === 'goal_a') {
                                        setPending({ step: 'goal_s', a: id });
                                    } else if (pending.step === 'goal_s') {
                                        const assist = pending.a;
                                        setPending(null);
                                        pushEvent({ k: 'goal', s: id, a: assist || null });
                                    } else {
                                        const stepKey = pending.step;
                                        if (stepKey === 'tt' || stepKey === 'td' || stepKey === 'ts' || stepKey === 'd' || stepKey === 'call') {
                                            if (pending.e && pending.e.x != null && pending.e.y != null) {
                                                const e = pending.e;
                                                setPending(null);
                                                pushEvent({ ...e, p: id });
                                            } else {
                                                setPending({ step: 'where', e: { k: stepKey, p: id } });
                                            }
                                        }
                                    }
                                }}
                            >
                                <View style={{ paddingRight: 24, flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 }}>
                                    {isHolder && <Text style={{ fontSize: 12 }}>🥏</Text>}
                                    <Text style={[styles.pbtnName, { color: isHolder ? '#2E8540' : theme.colors.text }]} numberOfLines={1} ellipsizeMode="tail">
                                        {P(id).name}
                                    </Text>
                                </View>
                                <View style={[styles.genderBadge, { backgroundColor: P(id).g === 'F' ? '#B8338A' : '#1F6FD1' }]}>
                                    <Text style={styles.genderText}>{P(id).g}</Text>
                                </View>
                                <Text style={styles.pbtnSub} numberOfLines={1}>
                                    {isHolder ? 'DISCO · ' : ''}Tch {ps.touches || 0} · M {ps.goals} · A {ps.ast} · D {ps.ds} · TO {ps.toTot}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>

            {/* Selezione Schema di Difesa in Evidenza (Disponibile in fase di Difesa) */}
            {canEdit && !pending && !isOffense && (
                <View style={[styles.defenseCard, { backgroundColor: theme.colors.card, borderColor: st.dset ? '#E07A1F' : theme.colors.border }]}>
                    <View style={styles.defenseCardHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.defenseCardIcon}>🛡️</Text>
                            <Text style={[styles.defenseCardTitle, { color: theme.colors.text }]}>
                                SCHEMA DI DIFESA
                            </Text>
                        </View>
                        {st.dset ? (
                            <View style={styles.activeSchemaTag}>
                                <Text style={styles.activeSchemaTagText}>ATTIVO: {st.dset.toUpperCase()}</Text>
                            </View>
                        ) : (
                            <View style={styles.missingSchemaTag}>
                                <Text style={styles.missingSchemaTagText}>⚠️ SELEZIONA SCHEMA</Text>
                            </View>
                        )}
                    </View>
                    <View style={styles.defenseSchemaRow}>
                        {DSETS.map(v => {
                            const isSel = st.dset === v;
                            return (
                                <TouchableOpacity
                                    key={v}
                                    style={[
                                        styles.defenseSchemaBtn,
                                        {
                                            backgroundColor: isSel ? '#E07A1F' : theme.dark ? '#1E293B' : '#F8FAFC',
                                            borderColor: isSel ? '#C25E0A' : theme.dark ? '#334155' : '#CBD5E1'
                                        },
                                        isSel && styles.defenseSchemaBtnActive
                                    ]}
                                    onPress={() => {
                                        if (st.dset !== v) pushEvent({ k: 'dset', v });
                                    }}
                                >
                                    <Text style={[styles.defenseSchemaText, { color: isSel ? '#FFFFFF' : theme.colors.text }, isSel && styles.defenseSchemaTextActive]}>
                                        {v}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>
            )}

            {/* Azioni di Gioco */}
            {canEdit && !pending && (
                <View style={styles.actionsContainer}>
                    {isOffense ? (
                        <>
                            <TouchableOpacity
                                style={[styles.actBtn, styles.actBtnHero, { backgroundColor: '#2E8540' }]}
                                onPress={() => {
                                    if (st.holder) {
                                        setPending({ step: 'goal_s', a: st.holder });
                                    } else {
                                        setPending({ step: 'goal_a' });
                                    }
                                }}
                            >
                                <Text style={styles.actTitle}>⭐ META</Text>
                                <Text style={styles.actSub}>
                                    {st.holder ? `Assist: ${P(st.holder).name}` : 'poi assist + meta'}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.actBtn, { backgroundColor: '#C8323C' }]}
                                onPress={() => {
                                    if (st.holder) {
                                        setPending({ step: 'where', e: { k: 'tt', p: st.holder } });
                                    } else {
                                        setPending({ step: 'tt' });
                                    }
                                }}
                            >
                                <Text style={styles.actTitle}>TO LANCIO</Text>
                                <Text style={styles.actSub}>
                                    {st.holder ? `Lancio: ${P(st.holder).name}` : 'lancio sbagliato / bloccato'}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.actBtn, { backgroundColor: '#C8323C' }]}
                                onPress={() => setPending({ step: 'td' })}
                            >
                                <Text style={styles.actTitle}>TO PRESA</Text>
                                <Text style={styles.actSub}>presa sbagliata</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.actBtn, { backgroundColor: '#9E2A31' }]}
                                onPress={() => setPending({ step: 'ts' })}
                            >
                                <Text style={styles.actTitle}>STALL OUT</Text>
                                <Text style={styles.actSub}>fine conteggio</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.actBtn, { backgroundColor: '#9E2A31' }]}
                                onPress={() => setPending({ step: 'where', e: { k: 'tx' } })}
                            >
                                <Text style={styles.actTitle}>TO ALTRO</Text>
                                <Text style={styles.actSub}>senza giocatore</Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <>
                            <TouchableOpacity
                                style={[styles.actBtn, { backgroundColor: '#003057' }]}
                                onPress={() => setPending({ step: 'd' })}
                            >
                                <Text style={styles.actTitle}>DIFESA (D)</Text>
                                <Text style={styles.actSub}>block / intercetto</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.actBtn, { backgroundColor: '#3D6E99' }]}
                                onPress={() => setPending({ step: 'where', e: { k: 'err' } })}
                            >
                                <Text style={styles.actTitle}>ERRORE LORO</Text>
                                <Text style={styles.actSub}>turnover avversario</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.actBtn, { backgroundColor: '#5B6570' }]}
                                onPress={() => pushEvent({ k: 'tg' })}
                            >
                                <Text style={styles.actTitle}>META LORO</Text>
                                <Text style={styles.actSub}>punto subito</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.actBtn, { backgroundColor: '#7A5AA8' }]}
                                onPress={() => setPending({ step: 'call' })}
                            >
                                <Text style={styles.actTitle}>CALLAHAN</Text>
                                <Text style={styles.actSub}>intercetto in meta</Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            )}
        </View>
    );
}
