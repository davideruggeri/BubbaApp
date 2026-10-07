// components/liveMatch/PullRecordingPhase.tsx
// Componente per la registrazione della fase di Pull (scelta puller, schema difesa e atterraggio disco sul campo)

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { styles } from './liveMatchStyles';
import { useTheme } from '../../context/ThemeContext';
import InteractiveField, { FieldDot } from '../InteractiveField';
import { DSETS } from '../../utils/statsEngine';
import { showAlert } from '../../utils/alert';

interface PullRecordingPhaseProps {
    curPt: any;
    wePull: boolean;
    canEdit: boolean;
    pullPuller: string | null;
    onSetPullPuller: (id: string) => void;
    onChangeLine: () => void;
    dset?: string | null;
    onSelectDset: (dset: string) => void;
    prevDots: FieldDot[];
    isAttackingRight: boolean;
    onFlipDirection: () => void;
    onRecordPull: (pullerId: string | null, coord: { x: number; y: number } | null) => void;
    P: (id: string) => { name: string; g: 'M' | 'F' };
}

export default function PullRecordingPhase({
    curPt,
    wePull,
    canEdit,
    pullPuller,
    onSetPullPuller,
    onChangeLine,
    dset,
    onSelectDset,
    prevDots,
    isAttackingRight,
    onFlipDirection,
    onRecordPull,
    P,
}: PullRecordingPhaseProps) {
    const { theme } = useTheme();

    return (
        <View style={styles.phaseContainer}>
            <View style={[styles.statusBanner, { backgroundColor: wePull ? '#003057' : '#C0D725', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                <Text style={[styles.statusTitle, { color: wePull ? '#fff' : '#131E29' }]}>
                    PUNTO {curPt.n} · {wePull ? 'PULL NOSTRO (DIFESA)' : 'PULL LORO (ATTACCO)'}
                </Text>
                {canEdit && (
                    <TouchableOpacity
                        style={[styles.changeLineBtn, { backgroundColor: wePull ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)' }]}
                        onPress={onChangeLine}
                    >
                        <Text style={[styles.changeLineText, { color: wePull ? '#fff' : '#131E29' }]}>Cambio Linea</Text>
                    </TouchableOpacity>
                )}
            </View>

            {wePull && (
                <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                    <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Chi effettua il Pull?</Text>
                    <View style={styles.playerGrid}>
                        {curPt.line.map((id: string) => {
                            const isSelected = pullPuller === id;
                            return (
                                <TouchableOpacity
                                    key={id}
                                    style={[
                                        styles.pbtn,
                                        isSelected && styles.pbtnSel,
                                        { backgroundColor: isSelected ? '#E3ECF5' : theme.colors.card, borderColor: isSelected ? '#003057' : theme.colors.border }
                                    ]}
                                    onPress={() => canEdit && onSetPullPuller(id)}
                                >
                                    <Text style={[styles.pbtnName, { color: theme.colors.text }]}>{P(id).name}</Text>
                                    <View style={[styles.genderBadge, { backgroundColor: P(id).g === 'F' ? '#B8338A' : '#1F6FD1' }]}>
                                        <Text style={styles.genderText}>{P(id).g}</Text>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>
            )}

            {/* Scelta Schema di Difesa anticipata in fase di Pull */}
            {wePull && canEdit && (
                <View style={[styles.defenseCard, { backgroundColor: theme.colors.card, borderColor: dset ? '#E07A1F' : theme.colors.border }]}>
                    <View style={styles.defenseCardHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.defenseCardIcon}>🛡️</Text>
                            <Text style={[styles.defenseCardTitle, { color: theme.colors.text }]}>
                                SCHEMA DI DIFESA
                            </Text>
                        </View>
                        {dset ? (
                            <View style={styles.activeSchemaTag}>
                                <Text style={styles.activeSchemaTagText}>ATTIVO: {dset.toUpperCase()}</Text>
                            </View>
                        ) : (
                            <View style={styles.missingSchemaTag}>
                                <Text style={styles.missingSchemaTagText}>⚠️ SELEZIONA SCHEMA</Text>
                            </View>
                        )}
                    </View>
                    <View style={styles.defenseSchemaRow}>
                        {DSETS.map(v => {
                            const isSel = dset === v;
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
                                        if (dset !== v) onSelectDset(v);
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

            <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <Text style={[styles.cardTitle, { color: theme.colors.text, marginBottom: 0 }]}>
                        Tocca dove atterra il Pull
                    </Text>
                    <Text style={{ fontSize: 11, fontWeight: 'bold', color: wePull ? '#003057' : '#E07A1F' }}>
                        {wePull ? '🎯 NOSTRO PULL' : '🛡️ PULL AVVERSARIO'}
                    </Text>
                </View>
                <Text style={{ fontSize: 11, color: theme.colors.textSecondary, marginBottom: 8 }}>
                    Tocca sul campo per salvare le coordinate del pull oppure usa Schermo Intero per la massima precisione
                </Text>
                <InteractiveField
                    dots={prevDots}
                    interactive={canEdit}
                    isPlayMode={false}
                    flip={isAttackingRight !== wePull}
                    onFieldPress={coord => {
                        if (!canEdit) return;
                        if (wePull && !pullPuller) {
                            showAlert("Attenzione", "Seleziona prima chi effettua il pull.");
                            return;
                        }
                        onRecordPull(wePull ? pullPuller : null, coord);
                    }}
                    onFlipDirection={onFlipDirection}
                />

                {canEdit && (
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 }}>
                        <TouchableOpacity
                            style={styles.skipBtn}
                            onPress={() => onRecordPull(null, null)}
                        >
                            <Text style={styles.skipBtnText}>Salta (Non registrare coordinate)</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </View>
    );
}
