import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';
import { useAuth } from './AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export type Theme = {
    dark: boolean;
    colors: {
        primary: string;
        background: string;
        card: string;
        text: string;
        border: string;
        notification: string;
        textSecondary: string;
        sectionBackground: string;
        success: string;
        danger: string;
        warning: string;
        inputBackground: string;
        // Semantic Colors
        training: string;
        match: string;
        championship: string;
        tournament: string;
        social: string;
        other: string;
        birthday: string;
    };
};

export const LightTheme: Theme = {
    dark: false,
    colors: {
        primary: '#003399',
        background: '#ffffff',
        card: '#ffffff',
        text: '#333333',
        border: '#cccccc',
        notification: '#ff3b30',
        textSecondary: '#666666',
        sectionBackground: '#f0f2f5',
        success: '#28a745',
        danger: '#dc3545',
        warning: '#ffc107',
        inputBackground: '#f9f9f9',
        // Semantic Colors (Light)
        training: '#003399',
        match: '#d32f2f',
        championship: '#fbc02d',
        tournament: '#7b1fa2',
        social: '#388e3c',
        other: '#616161',
        birthday: '#e91e63',
    },
};

export const DarkTheme: Theme = {
    dark: true,
    colors: {
        primary: '#4d88ff', // Lighter blue for dark mode
        background: '#000000',
        card: '#1e1e1e',
        text: '#ffffff',
        border: '#333333',
        notification: '#ff453a',
        textSecondary: '#aaaaaa',
        sectionBackground: '#1e1e1e', // Same as card in dark mode usually, or slightly lighter/darker
        success: '#4cd964',
        danger: '#ff3b30',
        warning: '#ffd60a',
        inputBackground: '#2c2c2c',
        // Semantic Colors (Dark - Lighter/Pastel)
        training: '#64b5f6', // Light Blue
        match: '#e57373', // Light Red
        championship: '#fff176', // Light Yellow
        tournament: '#ba68c8', // Light Purple
        social: '#81c784', // Light Green
        other: '#9e9e9e', // Light Grey
        birthday: '#f06292', // Light Pink
    },
};

type ThemeContextType = {
    theme: Theme;
    toggleTheme: () => void;
    isDark: boolean;
    isChristmasEnabled: boolean;
    toggleChristmasTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType>({
    theme: LightTheme,
    toggleTheme: () => { },
    isDark: false,
    isChristmasEnabled: true,
    toggleChristmasTheme: () => { },
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const systemScheme = useColorScheme();
    const { userProfile } = useAuth();
    const [isDark, setIsDark] = useState(systemScheme === 'dark');
    const [isChristmasEnabled, setIsChristmasEnabled] = useState(true);

    // Sync with user profile theme preference
    useEffect(() => {
        if (userProfile?.theme) {
            setIsDark(userProfile.theme === 'dark');
        }
    }, [userProfile?.theme]);

    useEffect(() => {
        loadTheme();
    }, []);

    const loadTheme = async () => {
        try {
            const storedTheme = await AsyncStorage.getItem('theme');
            if (storedTheme) {
                setIsDark(storedTheme === 'dark');
            }
            const storedChristmas = await AsyncStorage.getItem('christmas_theme');
            if (storedChristmas !== null) {
                setIsChristmasEnabled(storedChristmas === 'true');
            }
        } catch (e) {
            console.error("Failed to load theme", e);
        }
    };

    const toggleTheme = async () => {
        const newMode = !isDark;
        setIsDark(newMode);
        const themeString = newMode ? 'dark' : 'light';

        try {
            await AsyncStorage.setItem('theme', themeString);

            // If logged in, save to Firestore
            if (userProfile?.uid) {
                const userRef = doc(db, 'users', userProfile.uid);
                await updateDoc(userRef, { theme: themeString });
            }
        } catch (e) {
            console.error("Failed to save theme", e);
        }
    };

    const toggleChristmasTheme = async () => {
        const newState = !isChristmasEnabled;
        setIsChristmasEnabled(newState);
        try {
            await AsyncStorage.setItem('christmas_theme', String(newState));
        } catch (e) {
            console.error("Failed to save christmas theme", e);
        }
    };

    const theme = isDark ? DarkTheme : LightTheme;

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, isDark, isChristmasEnabled, toggleChristmasTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => useContext(ThemeContext);
