import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions, Easing } from 'react-native';

const NUM_SNOWFLAKES = 30;
const { width, height } = Dimensions.get('window');

const Snowflake = ({ index }: { index: number }) => {
    const animValue = useRef(new Animated.Value(0)).current;
    const horizontalValue = useRef(new Animated.Value(0)).current;

    // Randomize initial properties
    const size = Math.random() * 15 + 10; // 10-25px
    // Ensure startX is within bounds considering size and sway (20px)
    const maxSway = 20;
    const startX = Math.random() * (width - size - maxSway);
    const duration = Math.random() * 5000 + 5000; // 5-10s
    const delay = Math.random() * 5000;

    useEffect(() => {
        const runAnimation = () => {
            animValue.setValue(0);
            horizontalValue.setValue(0);

            Animated.parallel([
                Animated.timing(animValue, {
                    toValue: 1,
                    duration: duration,
                    easing: Easing.linear,
                    useNativeDriver: true,
                    delay: index === 0 ? 0 : delay, // Stagger start
                }),
                Animated.sequence([
                    Animated.timing(horizontalValue, {
                        toValue: 1,
                        duration: duration / 2,
                        easing: Easing.sin,
                        useNativeDriver: true,
                        delay: index === 0 ? 0 : delay,
                    }),
                    Animated.timing(horizontalValue, {
                        toValue: 0,
                        duration: duration / 2,
                        easing: Easing.sin,
                        useNativeDriver: true,
                    })
                ])
            ]).start(({ finished }) => {
                if (finished) {
                    runAnimation();
                }
            });
        };

        runAnimation();
    }, []);

    const translateY = animValue.interpolate({
        inputRange: [0, 1],
        outputRange: [-50, height + 50],
    });

    const translateX = horizontalValue.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 20], // Sway effect
    });

    return (
        <Animated.Image
            source={require('../assets/winter.png')}
            style={[
                styles.snowflake,
                {
                    left: startX,
                    width: size,
                    height: size,
                    transform: [{ translateY }, { translateX }],
                },
            ]}
            resizeMode="contain"
        />
    );
};

export default function FallingSnow() {
    return (
        <View style={styles.container} pointerEvents="none">
            {Array.from({ length: NUM_SNOWFLAKES }).map((_, i) => (
                <Snowflake key={i} index={i} />
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        zIndex: -1, // Behind everything
        elevation: -1,
    },
    snowflake: {
        position: 'absolute',
        top: -50,
    },
});
