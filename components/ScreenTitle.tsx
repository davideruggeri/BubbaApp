import { Text, StyleSheet, StyleProp, TextStyle, View, TouchableOpacity, Image, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { isChristmasPeriod } from '../utils/date';

interface ScreenTitleProps {
    title: string;
    style?: StyleProp<TextStyle>;
    containerStyle?: StyleProp<ViewStyle>;
    onBack?: () => void;
    rightAction?: {
        icon: any;
        onPress: () => void;
        color?: string;
    };
    hideHat?: boolean;
}

export default function ScreenTitle({ title, style, containerStyle, onBack, rightAction, hideHat }: ScreenTitleProps) {
    const { theme, isChristmasEnabled } = useTheme();
    const isChristmas = isChristmasPeriod() && isChristmasEnabled && !hideHat;
    return (
        <View style={[styles.container, containerStyle]}>
            {onBack && (
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={28} color={theme.colors.primary} />
                </TouchableOpacity>
            )}
            <View style={{ position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={[styles.title, { color: theme.colors.primary }, style]}>
                    {title}
                </Text>
                {isChristmas && (
                    <Image
                        source={require('../assets/santa.png')}
                        style={styles.santaHat}
                        resizeMode="contain"
                    />
                )}
            </View>
            {rightAction && (
                <TouchableOpacity onPress={rightAction.onPress} style={styles.rightButton}>
                    <Image source={rightAction.icon} style={[styles.rightIcon, { tintColor: rightAction.color || theme.colors.primary }]} />
                </TouchableOpacity>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        marginBottom: 10,
        position: 'relative',
        minHeight: 40,
    },
    backButton: {
        position: 'absolute',
        left: 10,
        zIndex: 1,
        padding: 5,
    },
    title: {
        fontSize: 30,
        fontWeight: 'bold',
        color: '#003399',
        fontFamily: 'NBAMilwaukeeBucks',
        textAlign: 'center',
    },
    rightButton: {
        position: 'absolute',
        right: 10,
        zIndex: 1,
        padding: 5,
    },
    rightIcon: {
        width: 24,
        height: 24,
        resizeMode: 'contain',
    },
    santaHat: {
        position: 'absolute',
        top: -18,
        right: -12,
        width: 35,
        height: 35,
        transform: [{ rotate: '15deg' }],
        zIndex: 10,
    },
});
