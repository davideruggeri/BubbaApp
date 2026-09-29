import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Animated, Easing, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAudioPlayer } from 'expo-audio';
import { Ionicons } from '@expo/vector-icons';
import ScreenTitle from '../components/ScreenTitle';

import { useTheme } from '../context/ThemeContext';
import { showAlert } from '../utils/alert';

export default function RandomTimerScreen() {
    const navigation = useNavigation();
    const { theme } = useTheme();
    const [minInterval, setMinInterval] = useState('10'); // seconds
    const [totalDuration, setTotalDuration] = useState('30'); // minutes
    const [maxSounds, setMaxSounds] = useState('10'); // Max number of sounds
    const [isRunning, setIsRunning] = useState(false);
    const [timeLeft, setTimeLeft] = useState(30 * 60);
    const [nextSoundTime, setNextSoundTime] = useState<number | null>(null);
    const [soundsPlayed, setSoundsPlayed] = useState(0);

    // Animation values
    const pulseAnim = useRef(new Animated.Value(1)).current;

    // Sounds
    const whistlePlayer = useAudioPlayer('https://actions.google.com/sounds/v1/sports/referee_whistle.ogg');
    const beepPlayer = useAudioPlayer('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');

    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const playSound = async (type: 'whistle' | 'beep') => {
        try {
            if (type === 'whistle') {
                // Play whistle 3 times for a longer effect (End or Start)
                for (let i = 0; i < 3; i++) {
                    whistlePlayer.seekTo(0);
                    whistlePlayer.play();
                    // Wait for 600ms before next blast
                    await new Promise(resolve => setTimeout(resolve, 600));
                }
            } else if (type === 'beep') {
                // Play beep continuously for 2 seconds
                beepPlayer.loop = true;
                beepPlayer.seekTo(0);
                beepPlayer.play();

                await new Promise(resolve => setTimeout(resolve, 2000));

                beepPlayer.pause();
                beepPlayer.seekTo(0);
                beepPlayer.loop = false;
            }
        } catch (error) {
            console.error('Error playing sound', error);
        }
    };

    const startPulse = () => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.2,
                    duration: 500,
                    useNativeDriver: true,
                    easing: Easing.inOut(Easing.ease),
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 500,
                    useNativeDriver: true,
                    easing: Easing.inOut(Easing.ease),
                }),
            ])
        ).start();
    };

    const stopPulse = () => {
        pulseAnim.stopAnimation();
        pulseAnim.setValue(1);
    };

    const startTimer = () => {
        const min = parseInt(minInterval);
        const duration = parseInt(totalDuration);
        const max = parseInt(maxSounds);

        if (isNaN(min) || min <= 0) {
            showAlert('Invalid Input', 'Please enter a valid minimum interval.');
            return;
        }
        if (isNaN(duration) || duration <= 0) {
            showAlert('Invalid Input', 'Please enter a valid total duration.');
            return;
        }
        if (isNaN(max) || max <= 0) {
            showAlert('Invalid Input', 'Please enter a valid max sounds count.');
            return;
        }

        setIsRunning(true);
        setTimeLeft(duration * 60);
        setSoundsPlayed(0);
        startPulse();
        playSound('whistle'); // Start sound
        scheduleNextSound(min);
    };

    const stopTimer = () => {
        setIsRunning(false);
        stopPulse();
        if (timerRef.current) {
            clearInterval(timerRef.current);
        }
        setNextSoundTime(null);
    };

    const scheduleNextSound = (min: number) => {
        // Random time between min and min + 60 seconds
        const randomDelay = Math.floor(Math.random() * (min * 2)) + min;
        setNextSoundTime(randomDelay);
    };

    useEffect(() => {
        if (isRunning) {
            timerRef.current = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev <= 0) {
                        stopTimer();
                        playSound('whistle'); // Final whistle
                        showAlert('Finished', 'Time is up!');
                        return 0;
                    }
                    return prev - 1;
                });

                if (nextSoundTime !== null) {
                    setNextSoundTime((prev) => {
                        if (prev !== null && prev <= 1) {
                            // Check if max sounds reached
                            if (soundsPlayed + 1 >= parseInt(maxSounds)) {
                                stopTimer();
                                playSound('whistle'); // Final whistle
                                showAlert('Finished', 'Max sounds reached!');
                                return null;
                            }

                            playSound('beep'); // Interval beep
                            setSoundsPlayed(s => s + 1);

                            const min = parseInt(minInterval);
                            // Schedule next
                            const randomDelay = Math.floor(Math.random() * (min * 2)) + min;
                            return randomDelay;
                        }
                        return prev !== null ? prev - 1 : null;
                    });
                }
            }, 1000);
        }

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            stopPulse();
        };
    }, [isRunning, nextSoundTime, minInterval, maxSounds, soundsPlayed]);

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Image source={require('../assets/arrow.png')} style={[styles.headerIcon, { transform: [{ rotate: '180deg' }], tintColor: theme.colors.primary }]} />
                </TouchableOpacity>
                <ScreenTitle title="RANDOM TIMER" />
                <TouchableOpacity onPress={() => showAlert('Presto disponibile!', 'Qui potrai scegliere i suoni.')}>
                    <Image source={require('../assets/music.png')} style={[styles.headerIcon, { tintColor: theme.colors.primary }]} />
                </TouchableOpacity>
            </View>

            <View style={styles.timerContainer}>
                <Animated.Text style={[styles.timerText, { transform: [{ scale: pulseAnim }], color: theme.colors.text }]}>
                    {formatTime(timeLeft)}
                </Animated.Text>
                <Text style={[styles.subText, { color: theme.colors.textSecondary }]}>Sounds: {soundsPlayed} / {maxSounds}</Text>
                {isRunning && nextSoundTime !== null && (
                    <Text style={[styles.nextSoundText, { color: theme.colors.primary }]}>Next sound in ~{nextSoundTime}s</Text>
                )}
            </View>

            {!isRunning ? (
                <View style={styles.controlsContainer}>
                    <View style={styles.row}>
                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Duration (min)</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text, borderColor: theme.colors.border }]}
                                keyboardType="numeric"
                                value={totalDuration}
                                onChangeText={setTotalDuration}
                            />
                        </View>
                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Min Interval (s)</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text, borderColor: theme.colors.border }]}
                                keyboardType="numeric"
                                value={minInterval}
                                onChangeText={setMinInterval}
                            />
                        </View>
                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Max Sounds</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text, borderColor: theme.colors.border }]}
                                keyboardType="numeric"
                                value={maxSounds}
                                onChangeText={setMaxSounds}
                            />
                        </View>
                    </View>

                    <TouchableOpacity style={[styles.playButton, { backgroundColor: theme.colors.primary }]} onPress={startTimer}>
                        <Image source={require('../assets/play.png')} style={styles.playIcon} />
                    </TouchableOpacity>
                </View>
            ) : (
                <View style={styles.controlsContainer}>
                    <TouchableOpacity style={[styles.stopButton, { backgroundColor: theme.colors.danger }]} onPress={stopTimer}>
                        <Ionicons name="stop" size={40} color="#fff" />
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        paddingTop: 60,
        paddingHorizontal: 20,
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        marginBottom: 20,
    },
    backButton: {
        padding: 5,
    },
    headerIcon: {
        width: 28,
        height: 28,
        resizeMode: 'contain',
        tintColor: '#003399',
    },
    timerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    timerText: {
        fontSize: 80,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 10,
    },
    subText: {
        fontSize: 24,
        color: '#666',
        fontWeight: '600',
    },
    nextSoundText: {
        marginTop: 20,
        fontSize: 18,
        color: '#003399',
        fontStyle: 'italic',
    },
    controlsContainer: {
        width: '100%',
        alignItems: 'center',
        paddingBottom: 40,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        marginBottom: 30,
    },
    inputGroup: {
        alignItems: 'center',
        width: '30%',
    },
    label: {
        fontSize: 14,
        color: '#666',
        marginBottom: 8,
        textAlign: 'center',
    },
    input: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 12,
        padding: 12,
        width: '100%',
        textAlign: 'center',
        fontSize: 18,
        backgroundColor: '#f9f9f9',
        color: '#333',
        fontWeight: 'bold',
    },
    playButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#003399',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
        elevation: 8,
    },
    playIcon: {
        width: 40,
        height: 40,
        resizeMode: 'contain',
        tintColor: '#fff',
    },
    stopButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#FF3B30',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
        elevation: 8,
    },
});
