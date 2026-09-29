import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import BubbaWrappedModal from '../components/BubbaWrappedModal';
import {
    getAvailableWrappedSeasons,
    subscribeToUserWrapped,
    subscribeToTeamWrapped,
    UserWrappedData,
    TeamWrappedData
} from '../services/firestore';

type MoreScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function MoreScreen() {
    const navigation = useNavigation<MoreScreenNavigationProp>();
    const { theme } = useTheme();

    const { userProfile, isGlobalAdmin, isBubbaOnly } = useAuth(); // Use AuthContext


    const [wrappedModalVisible, setWrappedModalVisible] = useState(false);
    const [wrappedSeason, setWrappedSeason] = useState('2025-2026');
    const [userWrapped, setUserWrapped] = useState<UserWrappedData | null>(null);
    const [teamWrapped, setTeamWrapped] = useState<TeamWrappedData | null>(null);

    const handleOpenWrapped = async () => {
        const seasons = await getAvailableWrappedSeasons();
        const targetSeason = seasons.length > 0 ? seasons[0] : '2025-2026';
        setWrappedSeason(targetSeason);
        const uId = userProfile?.memberId || userProfile?.uid;
        if (uId) {
            subscribeToUserWrapped(targetSeason, uId, setUserWrapped, userProfile?.email || undefined);
        }
        subscribeToTeamWrapped(targetSeason, setTeamWrapped);
        setWrappedModalVisible(true);
    };

    const menuItems = [
        {
            title: 'Il Tuo Account',
            image: require('../assets/account.png'),
            screen: 'Account',
            description: 'Gestisci il tuo profilo',
            visible: true
        },
        {
            title: 'Indirizzario',
            image: require('../assets/people.png'),
            screen: 'Directory',
            description: 'Gestisci i membri della squadra',
            visible: !isBubbaOnly
        },
        {
            title: 'Roster',
            image: require('../assets/roster.png'),
            screen: 'Roster',
            description: 'Rosa Campionato e Tornei',
            visible: true
        },
        {
            title: 'Storico Presenze',
            image: require('../assets/folder.png'),
            screen: 'PresenzeHistory',
            description: 'Archivio stagioni passate',
            visible: true
        },
        {
            title: 'Bubba Wrapped',
            image: require('../assets/trophy.png'),
            action: () => handleOpenWrapped(),
            description: 'Recap stagionale a storie 🎉',
            visible: true
        },

        {
            title: 'Analisi Partita',
            image: require('../assets/analytics.png'),
            screen: 'AnalisiPartita',
            description: 'Analisi tattica e statistiche',
            visible: true
        },
        {
            title: 'Ultimate Tactics',
            image: require('../assets/tactics.png'),
            screen: 'TacticsGame',
            description: 'Disegna la tattica vincente!',
            visible: false // Hidden temporarily during development
        },

        {
            title: 'Bubba World',
            image: require('../assets/world.png'),
            screen: 'WorldMap',
            description: 'Mappa eventi nel mondo',
            visible: true
        },
        {
            title: 'Spese',
            image: require('../assets/dollar.png'),
            screen: 'Financial',
            description: 'Gestione finanziaria',
            visible: false
        },
        {
            title: 'Impostazioni',
            image: require('../assets/gear.png'),
            screen: 'Settings',
            description: 'Tema e preferenze',
            visible: true
        },
    ].filter(item => item.visible);

    const handleNavigate = (item: any) => {
        if (item.action) {
            item.action();
            return;
        }
        navigation.goBack(); // Close the modal
        navigation.navigate(item.screen as any);
    };

    return (
        <TouchableOpacity
            style={styles.fullScreenOverlay}
            activeOpacity={1}
            onPress={() => navigation.goBack()}
        >
            <ScrollView
                style={[styles.menuContainer, { backgroundColor: theme.colors.card }]}
                contentContainerStyle={{ paddingBottom: 30 }}
                onStartShouldSetResponder={() => true}
            >
                <Text style={[styles.title, { color: theme.colors.text }]}>Menu Altro</Text>

                {menuItems.map((item, index) => (
                    <TouchableOpacity
                        key={index}
                        style={[styles.menuItemButton, { backgroundColor: theme.colors.sectionBackground }]}
                        onPress={() => handleNavigate(item)}
                    >
                        <Image source={item.image} style={[styles.itemIcon, { tintColor: theme.colors.primary }]} resizeMode="contain" />
                        <View style={styles.textContainer}>
                            <Text style={[styles.menuItemText, { color: theme.colors.text }]}>{item.title}</Text>
                            <Text style={[styles.menuItemDescription, { color: theme.colors.textSecondary }]}>{item.description}</Text>
                        </View>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* Bubba Wrapped Fullscreen Modal */}
            <BubbaWrappedModal
                visible={wrappedModalVisible}
                onClose={() => setWrappedModalVisible(false)}
                userWrapped={userWrapped}
                teamWrapped={teamWrapped}
                stagione={wrappedSeason}
            />
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    fullScreenOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)', // Semi-transparent background
        justifyContent: 'flex-end',
        alignItems: 'center',
    },
    menuContainer: {
        width: '95%',
        maxHeight: 450, // Limit height to show approx 4 items
        // backgroundColor: '#fff', // Handled by theme
        padding: 20,
        paddingBottom: 30,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
        marginBottom: 20, // Added some margin from bottom
        elevation: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -5 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
    },
    title: {
        fontSize: 26,
        fontWeight: 'bold',
        marginBottom: 25,
        textAlign: 'center',
        // color: '#333', // Handled by theme
    },
    menuItemButton: {
        flexDirection: 'row',
        alignItems: 'center',
        // backgroundColor: '#f9f9f9', // Handled by theme
        paddingVertical: 15,
        paddingHorizontal: 15,
        borderRadius: 10,
        marginBottom: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    itemIcon: {
        width: 28,
        height: 28,
        marginRight: 15,
        // tintColor: '#003399', // Handled by theme
    },
    textContainer: {
        flex: 1,
    },
    menuItemText: {
        fontSize: 18,
        fontWeight: '600',
        // color: '#444', // Handled by theme
    },
    menuItemDescription: {
        fontSize: 12,
        // color: '#888', // Handled by theme
        marginTop: 2,
    },
});
