import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { attendanceStyles as styles } from './attendanceStyles';
import { ViewMode } from './attendanceTypes';

interface AttendanceDateSelectorProps {
    currentDate: string;
    viewMode: ViewMode;
    setViewMode: (mode: ViewMode) => void;
    attendeesCount: number;
    onPrevious: () => void;
    onNext: () => void;
    theme: any;
}

export const AttendanceDateSelector: React.FC<AttendanceDateSelectorProps> = ({
    currentDate,
    viewMode,
    setViewMode,
    attendeesCount,
    onPrevious,
    onNext,
    theme,
}) => {
    return (
        <>
            {/* Mode Toggle */}
            <View style={[styles.modeToggleContainer, { backgroundColor: theme.colors.inputBackground }]}>
                <TouchableOpacity
                    style={[
                        styles.modeButton,
                        viewMode === 'Campo' && styles.modeButtonActive,
                        viewMode === 'Campo' && { backgroundColor: theme.colors.card },
                    ]}
                    onPress={() => setViewMode('Campo')}
                >
                    <Text
                        style={[
                            styles.modeButtonText,
                            viewMode === 'Campo' && styles.modeButtonTextActive,
                            { color: viewMode === 'Campo' ? '#003399' : theme.colors.textSecondary },
                        ]}
                    >
                        🥏 Campo
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[
                        styles.modeButton,
                        viewMode === 'Palestra' && styles.modeButtonActive,
                        viewMode === 'Palestra' && { backgroundColor: theme.colors.card },
                    ]}
                    onPress={() => setViewMode('Palestra')}
                >
                    <Text
                        style={[
                            styles.modeButtonText,
                            viewMode === 'Palestra' && styles.modeButtonTextActive,
                            { color: viewMode === 'Palestra' ? '#003399' : theme.colors.textSecondary },
                        ]}
                    >
                        🏋️ Palestra
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Date Control */}
            <View style={styles.dateControl}>
                <TouchableOpacity onPress={onPrevious} style={styles.arrowButton}>
                    <Text style={[styles.arrowText, { color: theme.colors.primary }]}>{'<'}</Text>
                </TouchableOpacity>

                <View style={{ alignItems: 'center' }}>
                    <Text style={[styles.date, { color: theme.colors.text }]}>
                        {currentDate
                            ? new Date(currentDate).toLocaleDateString('it-IT', {
                                  weekday: 'long',
                                  day: 'numeric',
                                  month: 'long',
                              })
                            : 'Caricamento...'}
                    </Text>
                    {currentDate ? (
                        <Text style={[styles.attendeeCountText, { color: theme.colors.primary }]}>
                            Presenti: {attendeesCount}
                        </Text>
                    ) : null}
                </View>

                <TouchableOpacity onPress={onNext} style={styles.arrowButton}>
                    <Text style={[styles.arrowText, { color: theme.colors.primary }]}>{'>'}</Text>
                </TouchableOpacity>
            </View>
        </>
    );
};
