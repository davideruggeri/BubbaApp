import React from 'react';
import { View, Text } from 'react-native';
import { FIELD } from '../../utils/statsEngine';
import { MARGIN_X, MARGIN_Y, TOTAL_L, TOTAL_W } from './fieldTypes';
import { fieldStyles as styles } from './fieldStyles';

interface FieldBackgroundProps {
    firstEnd: string;
    secondEnd: string;
    isPlayMode: boolean;
}

export const FieldBackground: React.FC<FieldBackgroundProps> = ({
    firstEnd,
    secondEnd,
    isPlayMode
}) => {
    return (
        <>
            {/* Etichette discrete area Fuori Campo (OB) */}
            <View pointerEvents="none" style={styles.obBannerTop}>
                <Text style={styles.obBannerText}>FUORI (OB)</Text>
            </View>
            <View pointerEvents="none" style={styles.obBannerBottom}>
                <Text style={styles.obBannerText}>FUORI (OB)</Text>
            </View>
            <View pointerEvents="none" style={styles.obBannerLeft}>
                <Text style={styles.obBannerSideText}>OB</Text>
            </View>
            <View pointerEvents="none" style={styles.obBannerRight}>
                <Text style={styles.obBannerSideText}>OB</Text>
            </View>

            {/* Rettangolo Campo di Gioco Effettivo (75m × 25m) */}
            <View
                pointerEvents="none"
                style={[
                    styles.playingField,
                    {
                        left: `${(MARGIN_X / TOTAL_L) * 100}%`,
                        width: `${(FIELD.L / TOTAL_L) * 100}%`,
                        top: `${(MARGIN_Y / TOTAL_W) * 100}%`,
                        height: `${(FIELD.W / TOTAL_W) * 100}%`,
                    }
                ]}
            >
                {/* Meta Sinistra (15m) */}
                <View style={[styles.endZone, styles.leftEndZone]}>
                    <View style={styles.endZoneHeader}>
                        <Text style={styles.endZoneText}>{firstEnd}</Text>
                        <Text style={styles.endZoneSub}>META 15m</Text>
                    </View>
                </View>

                {/* Campo centrale (45m) */}
                <View style={styles.centralField}>
                    {/* Linea di metà campo tratteggiata */}
                    <View style={styles.midfieldLine} />
                    <View style={styles.midfieldLabelBadge}>
                        <Text style={styles.midfieldLabelText}>37.5m</Text>
                    </View>

                    <View style={[styles.brickMark, { left: '15%' }]}>
                        <Text style={styles.brickCross}>✕</Text>
                        <Text style={styles.brickLabel}>BRICK</Text>
                    </View>
                    <View style={[styles.brickMark, { right: '15%' }]}>
                        <Text style={styles.brickCross}>✕</Text>
                        <Text style={styles.brickLabel}>BRICK</Text>
                    </View>

                    <Text style={styles.fieldNotice}>
                        {isPlayMode ? 'CAMPO DI GIOCO (45m)' : 'ZONA ATTERRAGGIO PULL (45m)'}
                    </Text>
                </View>

                {/* Meta Destra (15m) */}
                <View style={[styles.endZone, styles.rightEndZone]}>
                    <View style={styles.endZoneHeader}>
                        <Text style={styles.endZoneText}>{secondEnd}</Text>
                        <Text style={styles.endZoneSub}>META 15m</Text>
                    </View>
                </View>
            </View>
        </>
    );
};
