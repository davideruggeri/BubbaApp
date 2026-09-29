import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions, Easing, Text } from 'react-native';
import { useEasterEggs } from '../context/EasterEggContext';
import { useTheme } from '../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

// 1. Rain Of Discs Effect (🥏 Cascading)
const DiscRain = () => {
    const discs = Array.from({ length: 60 });
    return (
        <View style={styles.fullscreenContainer} pointerEvents="none">
            {discs.map((_, i) => <Rainflake key={i} index={i} />)}
        </View>
    );
};

const Rainflake = ({ index }: { index: number }) => {
    const animValue = useRef(new Animated.Value(0)).current;
    const size = Math.random() * 25 + 20;
    const startX = Math.random() * (width - size);
    const duration = Math.random() * 3000 + 5000; // Slower: 4-7 seconds
    const delay = Math.random() * 4000;

    useEffect(() => {
        Animated.timing(animValue, {
            toValue: 1,
            duration: duration,
            delay: delay,
            easing: Easing.bezier(0.4, 0, 0.2, 1),
            useNativeDriver: true,
        }).start();
    }, []);

    const translateY = animValue.interpolate({
        inputRange: [0, 1],
        outputRange: [-100, height + 100],
    });

    const translateX = animValue.interpolate({
        inputRange: [0, 0.25, 0.5, 0.75, 1],
        outputRange: [0, 30, 0, -30, 0],
    });

    const opacity = animValue.interpolate({
        inputRange: [0, 0.1, 0.9, 1],
        outputRange: [0, 1, 1, 0],
    });

    return (
        <Animated.View style={[styles.disc, { left: startX, opacity, transform: [{ translateY }, { translateX }] }]}>
            <Text style={{ fontSize: size }}>🥏</Text>
        </Animated.View>
    );
};

// 2. Huck Effect (Grand Lancio a Spirale Interno)
const HuckEffect = () => {
    const animValue = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        Animated.timing(animValue, {
            toValue: 1,
            duration: 4000,
            easing: Easing.bezier(0.2, 0, 0.1, 1),
            useNativeDriver: true,
        }).start();
    }, []);

    const rotateAngle = 8 * Math.PI;
    const maxRadius = Math.min(width, height) * 0.38; // Rimane dentro i margini

    const inputRange = [];
    const outputRangeX = [];
    const outputRangeY = [];
    const steps = 60;

    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        inputRange.push(t);
        const radius = t * maxRadius;
        const angle = t * rotateAngle;
        outputRangeX.push(radius * Math.cos(angle));
        outputRangeY.push(radius * Math.sin(angle));
    }

    const translateX = animValue.interpolate({
        inputRange,
        outputRange: outputRangeX,
    });

    const translateY = animValue.interpolate({
        inputRange,
        outputRange: outputRangeY,
    });

    const scale = animValue.interpolate({
        inputRange: [0, 1],
        outputRange: [0.3, 3], // Ingrandimento più contenuto per non uscire
    });

    const opacity = animValue.interpolate({
        inputRange: [0, 0.1, 0.9, 1],
        outputRange: [0, 1, 1, 0],
    });

    return (
        <View style={styles.centerContainer}>
            <Animated.View style={{ opacity, transform: [{ translateX }, { translateY }, { scale }] }}>
                <Text style={{ fontSize: 40 }}>🥏</Text>
            </Animated.View>
        </View>
    );
};

// 3. Layout Effect (Il Tuffo Rapido)
const LayoutEffect = () => {
    const animValue = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        Animated.timing(animValue, {
            toValue: 1,
            duration: 1500, // Slower: 1.5 seconds
            easing: Easing.out(Easing.exp),
            useNativeDriver: true,
        }).start();
    }, []);

    const translateX = animValue.interpolate({
        inputRange: [0, 1],
        outputRange: [-150, width + 150],
    });

    return (
        <Animated.View style={[styles.disc, { top: height * 0.4, transform: [{ translateX }] }]}>
            <Text style={{ fontSize: 70 }}>🥏</Text>
        </Animated.View>
    );
};

// 4. Spinning Effect (Vortice Centrale) - QUI LA ROTAZIONE RESTA PERCHÉ È L'EFFETTO STESSO
const SpinningEffect = () => {
    const animValue = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        Animated.parallel([
            Animated.timing(animValue, { toValue: 1, duration: 3000, easing: Easing.inOut(Easing.back(1)), useNativeDriver: true }),
        ]).start();
    }, []);

    const rotate = animValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '2160deg'],
    });

    const scale = animValue.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0, 4, 0],
    });

    const opacity = animValue.interpolate({
        inputRange: [0, 0.2, 0.8, 1],
        outputRange: [0, 1, 1, 0],
    });

    return (
        <View style={styles.centerContainer}>
            <Animated.View style={{ opacity, transform: [{ rotate }, { scale }] }}>
                <Text style={{ fontSize: 100 }}>🥏</Text>
            </Animated.View>
        </View>
    );
};

// 5. Confetti Effect (🥏 Mini-Explosion)
const ConfettiEffect = () => {
    const pieces = Array.from({ length: 60 });
    return (
        <View style={styles.centerContainer}>
            {pieces.map((_, i) => <ConfettiPiece key={i} />)}
        </View>
    );
};

const ConfettiPiece = () => {
    const animValue = useRef(new Animated.Value(0)).current;
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * width * 0.8;
    const endX = Math.cos(angle) * distance;
    const endY = Math.sin(angle) * distance;

    useEffect(() => {
        Animated.timing(animValue, {
            toValue: 1,
            duration: 2000,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
        }).start();
    }, []);

    const translateX = animValue.interpolate({ inputRange: [0, 1], outputRange: [0, endX] });
    const translateY = animValue.interpolate({ inputRange: [0, 1], outputRange: [0, endY] });
    const opacity = animValue.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] });
    const scale = animValue.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.5] });

    return (
        <Animated.View style={{ position: 'absolute', opacity, transform: [{ translateX }, { translateY }, { scale }] }}>
            <Text style={{ fontSize: Math.random() * 20 + 10 }}>{Math.random() > 0.5 ? '🥏' : '✨'}</Text>
        </Animated.View>
    );
};

// 6. The Callahan Effect (Ultimate Goal)
const CallahanEffect = () => {
    const { theme } = useTheme();
    return (
        <View style={[styles.centerContainer, { backgroundColor: 'rgba(0,0,0,0.85)' }]}>
            <View style={StyleSheet.absoluteFill}>
                <DiscRain />
            </View>
            <ConfettiEffect />
            <Animated.View style={{ alignItems: 'center', zIndex: 10 }}>
                <Text style={{ fontSize: 100, marginBottom: 20 }}>🏆</Text>
                <Text style={[styles.callahanText, { color: theme.colors.primary }]}>
                    CALLAHAN!
                </Text>
                <Text style={{ color: '#fff', fontSize: 22, marginTop: 15, fontWeight: '600' }}>
                    INTERCETTO IN ENDZONE!
                </Text>
            </Animated.View>
        </View>
    );
};

// 7. Toast Notification (Sleek Top Message)
const ToastNotification = () => {
    const { toast } = useEasterEggs();
    const { theme } = useTheme();
    const insets = useSafeAreaInsets();
    const animValue = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (toast) {
            Animated.spring(animValue, {
                toValue: 1,
                useNativeDriver: true,
                tension: 60,
                friction: 8
            }).start();
        } else {
            Animated.timing(animValue, {
                toValue: 0,
                duration: 500,
                easing: Easing.out(Easing.quad),
                useNativeDriver: true,
            }).start();
        }
    }, [toast]);

    const translateY = animValue.interpolate({
        inputRange: [0, 1],
        outputRange: [-150, insets.top + 12],
    });

    const opacity = animValue.interpolate({
        inputRange: [0, 0.2, 1],
        outputRange: [0, 1, 1],
    });

    return (
        <Animated.View 
            style={[
                styles.toastContainer, 
                { 
                    backgroundColor: theme.colors.card, 
                    borderColor: theme.colors.border,
                    shadowColor: theme.colors.primary,
                    transform: [{ translateY }],
                    opacity
                }
            ]}
        >
            <View style={[styles.toastAccent, { backgroundColor: theme.colors.primary }]} />
            <Text style={[styles.toastText, { color: theme.colors.text }]}>{toast}</Text>
        </Animated.View>
    );
};

export default function GlobalEffects() {
    const { activeEffect, toast } = useEasterEggs();

    if (!activeEffect && !toast) return null;

    return (
        <View style={styles.overlay} pointerEvents="none">
            <ToastNotification />
            {activeEffect === 'rain' && <DiscRain />}
            {activeEffect === 'huck' && <HuckEffect />}
            {activeEffect === 'layout' && <LayoutEffect />}
            {activeEffect === 'spinning' && <SpinningEffect />}
            {activeEffect === 'confetti' && <ConfettiEffect />}
            {activeEffect === 'callahan' && <CallahanEffect />}
        </View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 9999,
        elevation: 9999,
    },
    fullscreenContainer: {
        ...StyleSheet.absoluteFillObject,
    },
    disc: {
        position: 'absolute',
    },
    centerContainer: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
    callahanText: {
        fontSize: 56,
        fontWeight: '900',
        textAlign: 'center',
        textShadowColor: 'rgba(255, 255, 255, 0.4)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 20,
    },
    toastContainer: {
        position: 'absolute',
        top: 0,
        left: 20,
        right: 20,
        backgroundColor: '#fff',
        borderRadius: 16,
        paddingVertical: 14,
        paddingHorizontal: 18,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        // Glassmorphism effect
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 10,
        zIndex: 10000,
    },
    toastAccent: {
        width: 4,
        height: '100%',
        borderRadius: 2,
        marginRight: 12,
    },
    toastText: {
        fontSize: 15,
        fontWeight: '700',
        letterSpacing: 0.3,
    }
});
