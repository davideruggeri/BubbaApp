import React from 'react';
import { View, Text } from 'react-native';
import { FIELD } from '../../utils/statsEngine';
import { MARGIN_X, TOTAL_L } from './fieldTypes';
import { fieldStyles as styles } from './fieldStyles';

interface FieldRulerProps {
    rulerWidth?: number;
}

export const FieldRuler: React.FC<FieldRulerProps> = ({ rulerWidth }) => {
    const marks = [
        { label: 'OB', meter: -MARGIN_X, color: '#DC2626' },
        { label: '0m', meter: 0 },
        { label: '15m', meter: 15 },
        { label: '30m', meter: 30 },
        { label: '37.5m', meter: 37.5 },
        { label: '45m', meter: 45 },
        { label: '60m', meter: 60 },
        { label: '75m', meter: 75 },
        { label: 'OB', meter: FIELD.L + MARGIN_X, color: '#DC2626' },
    ];

    return (
        <View style={[styles.rulerContainer, rulerWidth ? { width: rulerWidth } : { width: '100%' }]}>
            <View style={styles.rulerTrack}>
                {marks.map((m, idx) => {
                    const pct = ((m.meter + MARGIN_X) / TOTAL_L) * 100;
                    return (
                        <View
                            key={idx}
                            style={[
                                styles.rulerMarkWrapper,
                                {
                                    left: `${pct}%`,
                                    transform: [{ translateX: pct < 5 ? 0 : pct > 95 ? -24 : -12 }]
                                }
                            ]}
                        >
                            <View style={[styles.rulerTickLine, m.color ? { backgroundColor: m.color } : null]} />
                            <Text style={[styles.rulerTickText, m.color ? { color: m.color, fontWeight: '800' } : null]}>
                                {m.label}
                            </Text>
                        </View>
                    );
                })}
            </View>
            <View style={styles.footerLabels}>
                <Text style={styles.footerText}>Meta 15m</Text>
                <Text style={styles.footerText}>Campo: 45m (75m in campo) · Margini OB</Text>
                <Text style={styles.footerText}>Meta 15m</Text>
            </View>
        </View>
    );
};
