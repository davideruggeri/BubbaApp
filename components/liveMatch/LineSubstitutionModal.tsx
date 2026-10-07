// components/liveMatch/LineSubstitutionModal.tsx
// Modale per la sostituzione dei giocatori in campo durante il punto (infortunio o correzione errore iniziale)

import React from 'react';
import { View, Text, Modal, TouchableOpacity } from 'react-native';
import { styles } from './liveMatchStyles';
import { useTheme } from '../../context/ThemeContext';
import { MatchRosterPlayer } from '../../services/firestore';

interface LineSubstitutionModalProps {
    visible: boolean;
    onClose: () => void;
    subStep: 'roster' | 'reason';
    setSubStep: (step: 'roster' | 'reason') => void;
    subReason: 'injury' | 'error';
    setSubReason: (reason: 'injury' | 'error') => void;
    curPt: any;
    lineSel: string[];
    setLineSel: React.Dispatch<React.SetStateAction<string[]>>;
    matchRoster: MatchRosterPlayer[];
    P: (id: string) => { name: string; g: 'M' | 'F' };
    onApplyLineChange: (reason: 'injury' | 'error') => void;
}

export default function LineSubstitutionModal({
    visible,
    onClose,
    subStep,
    setSubStep,
    subReason,
    setSubReason,
    curPt,
    lineSel,
    setLineSel,
    matchRoster,
    P,
    onApplyLineChange,
}: LineSubstitutionModalProps) {
    const { theme } = useTheme();

    if (!curPt) return null;

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.modalBg}>
                <View style={[styles.modalBox, { backgroundColor: theme.colors.card }]}>
                    {subStep === 'roster' ? (
                        <>
                            <View style={styles.rowBetween}>
                                <Text style={[styles.cardTitle, { color: theme.colors.text, marginBottom: 0 }]}>
                                    Cambio Giocatori in Campo
                                </Text>
                                <View style={[
                                    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
                                    { backgroundColor: lineSel.length === 5 ? '#E2F0D9' : '#FCE8E6' }
                                ]}>
                                    <Text style={{ fontSize: 11, fontWeight: '700', color: lineSel.length === 5 ? '#2E7D32' : '#C8323C' }}>
                                        {lineSel.length} / 5
                                    </Text>
                                </View>
                            </View>
                            <Text style={[styles.muted, { color: theme.colors.textSecondary, marginVertical: 8 }]}>
                                Seleziona i 5 giocatori che devono risultare in campo per questo punto.
                            </Text>

                            <View style={styles.playerGrid}>
                                {matchRoster.map(p => {
                                    const isSel = lineSel.includes(p.id);
                                    return (
                                        <TouchableOpacity
                                            key={p.id}
                                            style={[
                                                styles.pbtn,
                                                isSel && styles.pbtnSel,
                                                { backgroundColor: isSel ? '#E3ECF5' : theme.colors.card, borderColor: isSel ? '#003057' : theme.colors.border }
                                            ]}
                                            onPress={() => {
                                                setLineSel(prev => (prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id]));
                                            }}
                                        >
                                            <View style={{ paddingRight: 24, flex: 1 }}>
                                                <Text style={[styles.pbtnName, { color: theme.colors.text }]} numberOfLines={1} ellipsizeMode="tail">
                                                    {p.name}
                                                </Text>
                                            </View>
                                            <View style={[styles.genderBadge, { backgroundColor: p.g === 'F' ? '#B8338A' : '#1F6FD1' }]}>
                                                <Text style={styles.genderText}>{p.g}</Text>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                                <TouchableOpacity
                                    style={[styles.segBtn, { paddingHorizontal: 16 }]}
                                    onPress={onClose}
                                >
                                    <Text style={styles.segText}>Annulla</Text>
                                </TouchableOpacity>
                                {(() => {
                                    const outCount = (curPt?.line || []).filter((id: string) => !lineSel.includes(id)).length;
                                    const inCount = lineSel.filter((id: string) => !(curPt?.line || []).includes(id)).length;
                                    const hasChanges = outCount > 0 || inCount > 0;
                                    return (
                                        <TouchableOpacity
                                            style={[
                                                styles.startPtBtn,
                                                { paddingHorizontal: 20, opacity: lineSel.length === 5 ? 1 : 0.4 }
                                            ]}
                                            disabled={lineSel.length !== 5}
                                            onPress={() => {
                                                if (!hasChanges) {
                                                    onClose();
                                                    return;
                                                }
                                                setSubStep('reason');
                                            }}
                                        >
                                            <Text style={styles.startPtText}>
                                                {hasChanges ? 'Avanti: Motivo Cambio ▸' : 'Nessuna Modifica'}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })()}
                            </View>
                        </>
                    ) : (
                        <>
                            <Text style={[styles.cardTitle, { color: theme.colors.text, marginBottom: 4 }]}>
                                Motivo della Sostituzione
                            </Text>
                            <Text style={[styles.muted, { color: theme.colors.textSecondary, marginBottom: 14 }]}>
                                Specifica quando ha effetto questo cambio giocatore:
                            </Text>

                            {/* Riepilogo modifiche */}
                            {(() => {
                                const outPlayers = (curPt?.line || []).filter((id: string) => !lineSel.includes(id));
                                const inPlayers = lineSel.filter((id: string) => !(curPt?.line || []).includes(id));
                                return (
                                    <View style={{ backgroundColor: '#F8FAFC', borderRadius: 8, padding: 10, marginBottom: 14, borderWidth: 1, borderColor: '#E2E8F0', gap: 4 }}>
                                        {outPlayers.length > 0 && (
                                            <Text style={{ fontSize: 12, color: '#C8323C', fontWeight: '600' }}>
                                                🔻 Esce: {outPlayers.map((id: string) => P(id).name).join(', ')}
                                            </Text>
                                        )}
                                        {inPlayers.length > 0 && (
                                            <Text style={{ fontSize: 12, color: '#166534', fontWeight: '600' }}>
                                                🔺 Entra: {inPlayers.map((id: string) => P(id).name).join(', ')}
                                            </Text>
                                        )}
                                    </View>
                                );
                            })()}

                            {/* Scelta: Infortunio */}
                            <TouchableOpacity
                                activeOpacity={0.8}
                                style={[
                                    styles.subReasonCard,
                                    subReason === 'injury'
                                        ? { borderColor: '#003057', backgroundColor: '#F0F7FF' }
                                        : { borderColor: theme.colors.border, backgroundColor: theme.colors.card }
                                ]}
                                onPress={() => setSubReason('injury')}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                    <Text style={{ fontSize: 20 }}>🚑</Text>
                                    <Text style={[styles.subReasonTitle, { color: '#003057' }]}>
                                        Da questo momento (per Infortunio)
                                    </Text>
                                </View>
                                <Text style={[styles.subReasonDesc, { color: theme.colors.textSecondary }]}>
                                    Sostituzione avvenuta durante l'azione. Il giocatore sostituito mantiene il punto disputato fino a questo momento e il subentrante giocherà da adesso in poi.
                                </Text>
                            </TouchableOpacity>

                            {/* Scelta: Errore */}
                            <TouchableOpacity
                                activeOpacity={0.8}
                                style={[
                                    styles.subReasonCard,
                                    subReason === 'error'
                                        ? { borderColor: '#003057', backgroundColor: '#F0F7FF' }
                                        : { borderColor: theme.colors.border, backgroundColor: theme.colors.card }
                                ]}
                                onPress={() => setSubReason('error')}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                    <Text style={{ fontSize: 20 }}>✏️</Text>
                                    <Text style={[styles.subReasonTitle, { color: '#003057' }]}>
                                        Da inizio meta (per Errore)
                                    </Text>
                                </View>
                                <Text style={[styles.subReasonDesc, { color: theme.colors.textSecondary }]}>
                                    Correzione della formazione iniziale del punto. Chi era stato segnato per sbaglio viene rimosso dal punto e sostituito retroattivamente fin dall'inizio.
                                </Text>
                            </TouchableOpacity>

                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
                                <TouchableOpacity
                                    style={[styles.segBtn, { paddingHorizontal: 14 }]}
                                    onPress={() => setSubStep('roster')}
                                >
                                    <Text style={styles.segText}>◂ Modifica Roster</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.startPtBtn, { paddingHorizontal: 20 }]}
                                    onPress={() => onApplyLineChange(subReason)}
                                >
                                    <Text style={styles.startPtText}>Conferma Sostituzione</Text>
                                </TouchableOpacity>
                            </View>
                        </>
                    )}
                </View>
            </View>
        </Modal>
    );
}
