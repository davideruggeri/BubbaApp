import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RootStackParamList } from '../App';
import ScreenTitle from '../components/ScreenTitle';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

type TrainingScreenProps = {
    navigation: NativeStackNavigationProp<RootStackParamList>;
};

export default function TrainingScreen({ navigation }: TrainingScreenProps) {
    const { theme } = useTheme();
    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <ScreenTitle title="ALLENAMENTI" onBack={() => navigation.goBack()} containerStyle={{ marginTop: 20 }} />

            <ScrollView contentContainerStyle={styles.contentContainer}>
                <TouchableOpacity
                    style={[styles.card, { backgroundColor: theme.colors.card }]}
                    onPress={() => (navigation.navigate as any)('RandomTimer')}
                >
                    <View style={[styles.iconContainer, { backgroundColor: theme.colors.training }]}>
                        <Image source={require('../assets/random.png')} style={styles.icon} />
                    </View>
                    <View style={styles.cardContent}>
                        <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Random Timer</Text>
                        <Text style={[styles.cardDescription, { color: theme.colors.textSecondary }]}>
                            Timer con intervalli casuali per allenare la reattività.
                        </Text>
                    </View>
                    <Image source={require('../assets/arrow.png')} style={[styles.arrowIcon, { tintColor: theme.colors.textSecondary }]} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.card, { backgroundColor: theme.colors.card }]}
                    onPress={() => (navigation.navigate as any)('IntervalTimer')}
                >
                    <View style={[styles.iconContainer, { backgroundColor: theme.colors.warning }]}>
                        <Image source={require('../assets/timer.png')} style={styles.icon} />
                    </View>
                    <View style={styles.cardContent}>
                        <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Interval Timer</Text>
                        <Text style={[styles.cardDescription, { color: theme.colors.textSecondary }]}>
                            Allenamento strutturato con fasi di lavoro e riposo.
                        </Text>
                    </View>
                    <Image source={require('../assets/arrow.png')} style={[styles.arrowIcon, { tintColor: theme.colors.textSecondary }]} />
                </TouchableOpacity>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    contentContainer: {
        padding: 20,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
    },
    iconContainer: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#003399',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    icon: {
        width: 32,
        height: 32,
        resizeMode: 'contain',
        tintColor: '#fff',
    },
    arrowIcon: {
        width: 24,
        height: 24,
        resizeMode: 'contain',
        tintColor: '#ccc',
    },
    cardContent: {
        flex: 1,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 4,
    },
    cardDescription: {
        fontSize: 14,
        color: '#666',
        lineHeight: 20,
    },
    disabledCard: {
        opacity: 0.8,
        backgroundColor: '#f0f0f0',
    },
    disabledText: {
        color: '#666',
    },
    badge: {
        position: 'absolute',
        top: 10,
        right: 10,
        backgroundColor: '#FF3B30',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 10,
    },
    badgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
    },
});
