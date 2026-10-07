import React from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { FIELD, isOB } from '../../utils/statsEngine';
import { FieldDot, MARGIN_X, MARGIN_Y, TOTAL_L, TOTAL_W } from './fieldTypes';
import { fieldStyles as styles } from './fieldStyles';

interface FieldDotsLayerProps {
    dots: FieldDot[];
    flip: boolean;
    onDotPress?: (dot: FieldDot) => void;
}

export const FieldDotsLayer: React.FC<FieldDotsLayerProps> = ({
    dots,
    flip,
    onDotPress
}) => {
    return (
        <>
            {dots.map((d, index) => {
                const displayX = flip ? FIELD.L - d.x : d.x;
                const leftPercent = `${((displayX + MARGIN_X) / TOTAL_L) * 100}%`;
                const topPercent = `${((d.y + MARGIN_Y) / TOTAL_W) * 100}%`;
                const size = Math.round((d.r || 1) * 16);
                const ob = isOB(d);
                const isClickable = !!(d.onPress || onDotPress);

                return (
                    <TouchableOpacity
                        key={index}
                        disabled={!isClickable}
                        activeOpacity={0.7}
                        onPress={() => {
                            if (d.onPress) d.onPress();
                            else if (onDotPress) onDotPress(d);
                        }}
                        style={[
                            styles.dot,
                            {
                                left: leftPercent as any,
                                top: topPercent as any,
                                backgroundColor: d.c,
                                borderColor: ob ? '#FF3B30' : '#ffffff',
                                borderWidth: ob ? 2.5 : 2,
                                width: size,
                                height: size,
                                borderRadius: size / 2,
                                transform: [{ translateX: -size / 2 }, { translateY: -size / 2 }],
                                zIndex: isClickable ? 150 : 10,
                            }
                        ]}
                    >
                        <Text style={styles.dotLabel}>
                            {d.label || (ob ? 'OB' : '')}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </>
    );
};
