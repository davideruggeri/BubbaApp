import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, FlatList, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface SearchablePickerProps {
    selectedValue: string;
    onValueChange: (value: string) => void;
    items: string[];
    placeholder?: string;
    title?: string;
}

const SearchablePicker: React.FC<SearchablePickerProps> = ({ selectedValue, onValueChange, items, placeholder = "Seleziona...", title = "Seleziona" }) => {
    const { theme } = useTheme();
    const [modalVisible, setModalVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const filteredItems = items.filter(item => item.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
        <>
            <TouchableOpacity onPress={() => setModalVisible(true)} style={[styles.input, { justifyContent: 'center', backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.border }]}>
                <Text style={{ color: selectedValue ? theme.colors.text : theme.colors.textSecondary }}>{selectedValue || placeholder}</Text>
            </TouchableOpacity>

            <Modal visible={modalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { maxHeight: '80%', backgroundColor: theme.colors.card }]}>
                        <Text style={[styles.modalTitle, { color: theme.colors.text }]}>{title}</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text, borderColor: theme.colors.border }]}
                            placeholder="Cerca..."
                            placeholderTextColor={theme.colors.textSecondary}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        <FlatList
                            data={filteredItems}
                            keyExtractor={(item) => item}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={{ padding: 15, borderBottomWidth: 1, borderColor: theme.colors.border }}
                                    onPress={() => {
                                        onValueChange(item);
                                        setModalVisible(false);
                                        setSearchQuery("");
                                    }}
                                >
                                    <Text style={{ fontWeight: item === selectedValue ? 'bold' : 'normal', color: theme.colors.text }}>{item}</Text>
                                </TouchableOpacity>
                            )}
                            ListEmptyComponent={<Text style={{ padding: 20, textAlign: 'center', color: theme.colors.textSecondary }}>Nessun risultato</Text>}
                        />
                        <TouchableOpacity style={[styles.button, { backgroundColor: theme.colors.inputBackground, marginTop: 10 }]} onPress={() => setModalVisible(false)}>
                            <Text style={[styles.buttonText, { color: theme.colors.textSecondary }]}>Chiudi</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </>
    );
};

const styles = StyleSheet.create({
    input: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
        marginBottom: 15,
        fontSize: 16,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 20,
    },
    modalContent: {
        borderRadius: 15,
        padding: 20,
        elevation: 5,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 15,
        textAlign: 'center',
    },
    button: {
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
    },
    buttonText: {
        fontSize: 16,
        fontWeight: 'bold',
    },
});

export default SearchablePicker;
