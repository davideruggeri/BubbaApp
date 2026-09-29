import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Animated, Easing, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAudioPlayer } from 'expo-audio';
import ScreenTitle from '../components/ScreenTitle';

import * as Speech from 'expo-speech';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../context/ThemeContext';
import { showAlert } from '../utils/alert';

export default function IntervalTimerScreen() {
    const navigation = useNavigation();
    const { theme } = useTheme();
    const [workDuration, setWorkDuration] = useState('60'); // seconds
    const [restDuration, setRestDuration] = useState('15'); // seconds
    const [cycles, setCycles] = useState('5'); // Number of cycles

    const [isRunning, setIsRunning] = useState(false);
    const [isWorkPhase, setIsWorkPhase] = useState(true);
    const [timeLeft, setTimeLeft] = useState(60);
    const [currentCycle, setCurrentCycle] = useState(1);

    // Animations
    const fadeAnim = useRef(new Animated.Value(1)).current;
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const whistlePlayer = useAudioPlayer('https://actions.google.com/sounds/v1/sports/referee_whistle.ogg');
    const beepPlayer = useAudioPlayer('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');

    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const playSound = async (type: 'whistle' | 'beep') => {
        try {
            if (type === 'whistle') {
                for (let i = 0; i < 3; i++) {
                    whistlePlayer.seekTo(0);
                    whistlePlayer.play();
                    await new Promise(resolve => setTimeout(resolve, 600));
                }
            } else if (type === 'beep') {
                beepPlayer.seekTo(0);
                beepPlayer.play();
            }
        } catch (error) {
            console.error('Error playing sound', error);
        }
    };

    const speak = (text: string) => {
        Speech.speak(text, { language: 'en-US' });
    };

    const animatePhaseChange = () => {
        Animated.sequence([
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
                Animated.timing(scaleAnim, { toValue: 0.9, duration: 200, useNativeDriver: true }),
            ]),
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
                Animated.spring(scaleAnim, { toValue: 1, friction: 5, useNativeDriver: true }),
            ])
        ]).start();
    };

    const startTimer = () => {
        const work = parseInt(workDuration);
        const rest = parseInt(restDuration);
        const numCycles = parseInt(cycles);

        if (isNaN(work) || work <= 0 || isNaN(rest) || rest < 0) {
            showAlert('Invalid Input', 'Please enter valid durations.');
            return;
        }
        if (isNaN(numCycles) || numCycles <= 0) {
            showAlert('Invalid Input', 'Please enter a valid number of cycles.');
            return;
        }

        setIsRunning(true);
        setIsWorkPhase(true);
        setTimeLeft(work);
        setCurrentCycle(1);
        playSound('whistle');
        speak('Start');
    };

    const stopTimer = () => {
        setIsRunning(false);
        if (timerRef.current) {
            clearInterval(timerRef.current);
        }
        Speech.stop();
    };

    useEffect(() => {
        if (isRunning) {
            timerRef.current = setInterval(() => {
                setTimeLeft((prev) => {
                    // Voice countdown for restart during rest
                    if (!isWorkPhase && prev === 6) {
                        speak('Restart in 5 seconds');
                    }

                    if (prev <= 1) {
                        // Phase switch or End
                        if (isWorkPhase) {
                            // End of Work -> Go to Rest
                            speak('Pause');
                            setIsWorkPhase(false);
                            animatePhaseChange();
                            return parseInt(restDuration);
                        } else {
                            // End of Rest -> Go to Work (Next Cycle)
                            if (currentCycle >= parseInt(cycles)) {
                                stopTimer();
                                playSound('whistle');
                                speak('Training Complete');
                                showAlert('Finished', 'Training Complete!');
                                return 0;
                            }

                            setCurrentCycle(c => c + 1);
                            setIsWorkPhase(true);
                            animatePhaseChange();
                            speak('Start');
                            playSound('whistle');
                            return parseInt(workDuration);
                        }
                    }
                    return prev - 1;
                });
            }, 1000);
        }

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            Speech.stop();
        };
    }, [isRunning, isWorkPhase, workDuration, restDuration, cycles, currentCycle]);

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }, isRunning && (isWorkPhase ? { backgroundColor: theme.dark ? '#1565c0' : '#E3F2FD' } : { backgroundColor: theme.dark ? '#c62828' : '#FFEBEE' })]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Image source={require('../assets/arrow.png')} style={[styles.headerIcon, { transform: [{ rotate: '180deg' }], tintColor: theme.colors.primary }]} />
                </TouchableOpacity>
                <ScreenTitle title={isRunning ? (isWorkPhase ? 'WORK' : 'REST') : 'INTERVAL TIMER'} />
                <TouchableOpacity onPress={() => showAlert('Presto disponibile!', 'Qui potrai scegliere i suoni.')}>
                    <Image source={require('../assets/music.png')} style={[styles.headerIcon, { tintColor: theme.colors.primary }]} />
                </TouchableOpacity>
            </View>

            <Animated.View style={[styles.timerContainer, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
                <Text style={[styles.timerText, { color: theme.colors.text }]}>{formatTime(timeLeft)}</Text>
                <Text style={[styles.subText, { color: theme.colors.textSecondary }]}>Cycle: {currentCycle} / {cycles}</Text>
            </Animated.View>

            {!isRunning ? (
                <View style={styles.controlsContainer}>
                    <View style={styles.row}>
                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Work (s)</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text, borderColor: theme.colors.border }]}
                                keyboardType="numeric"
                                value={workDuration}
                                onChangeText={setWorkDuration}
                            />
                        </View>
                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Rest (s)</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text, borderColor: theme.colors.border }]}
                                keyboardType="numeric"
                                value={restDuration}
                                onChangeText={setRestDuration}
                            />
                        </View>
                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Cycles</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text, borderColor: theme.colors.border }]}
                                keyboardType="numeric"
                                value={cycles}
                                onChangeText={setCycles}
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
        alignItems: 'center',
        paddingTop: 60,
        paddingHorizontal: 20,
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
    workBg: {
        backgroundColor: '#E3F2FD', // Light Blue
    },
    restBg: {
        backgroundColor: '#FFEBEE', // Light Red
    },
    timerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    timerText: {
        fontSize: 90,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 10,
    },
    subText: {
        fontSize: 24,
        color: '#555',
        fontWeight: '600',
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
        backgroundColor: 'rgba(255,255,255,0.8)',
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
