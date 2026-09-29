import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    FlatList,
    StyleSheet,
    Modal,
    Image,
    StatusBar,
    ScrollView,
    ActivityIndicator,
    Dimensions,
    Switch,
} from "react-native";

import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    onSnapshot,
    query,
    orderBy,
    Timestamp,
    writeBatch,
    getDoc,
    setDoc,
    where,
    getDocs,
} from "firebase/firestore";
import { db } from "../firebaseConfig";
import { useAuth } from '../context/AuthContext';
import { useNavigation } from "@react-navigation/native";
import ScreenTitle from '../components/ScreenTitle';
import { SafeAreaView } from 'react-native-safe-area-context';
import { subscribeToMembers, Member } from "../services/firestore";
import { useTheme } from '../context/ThemeContext';
import SearchablePicker from '../components/SearchablePicker';
import { showAlert } from '../utils/alert';

const SCREEN_WIDTH = Dimensions.get("window").width;

const DEFAULT_CATEGORIE = ["Generale", "Cibo", "Trasporti", "Casa", "Materiale", "Altro"];
const METODI = ["Contanti", "Carta"];
const METODI_ENTRATA = ["Contanti", "Carta"];

type Spesa = {
    id: string;
    importo: number; // Cash flow (0 for advances)
    importoDovuto?: number; // Debt amount (only for advances)
    categoria: string;
    metodoPagamento: string;
    descrizione?: string;
    data?: Date | null;
    tipo?: "Spesa" | "Donazione" | "Anticipo" | "Entrata"; // Expanded types
    anticipata?: boolean;
    anticipatoDa?: string;
    rimborsata?: boolean;
    pagatoDa?: string; // For Entrate
    debitore?: string; // For Anticipo Squadra (Chi ha ricevuto i soldi)
};

// --- List Editor Modal Component ---
interface ListEditorModalProps {
    visible: boolean;
    title: string;
    initialList: string[];
    onSave: (newList: string[]) => void;
    onClose: () => void;
    members?: Member[]; // Optional, for importing
    allowImport?: boolean;
}

const ListEditorModal: React.FC<ListEditorModalProps> = ({ visible, title, initialList, onSave, onClose, members, allowImport }) => {
    const { theme } = useTheme();
    const [list, setList] = useState<string[]>([]);
    const [newItem, setNewItem] = useState("");

    useEffect(() => {
        if (visible) {
            setList([...initialList]);
            setNewItem("");
        }
    }, [visible, initialList]);

    const addItem = () => {
        if (!newItem.trim()) return;
        if (!list.includes(newItem.trim())) {
            setList([...list, newItem.trim()]);
        }
        setNewItem("");
    };

    const removeItem = (item: string) => {
        setList(list.filter(i => i !== item));
    };

    const importMember = (member: Member) => {
        const name = member.nickname || `${member.firstName} ${member.lastName || ''}`.trim();
        if (!list.includes(name)) {
            setList([...list, name]);
        }
    };

    const [searchQuery, setSearchQuery] = useState("");

    const filteredMembers = members ? members.filter(m => {
        const q = searchQuery.toLowerCase();
        const first = m.firstName?.toLowerCase() || "";
        const last = m.lastName?.toLowerCase() || "";
        const nick = m.nickname?.toLowerCase() || "";
        return first.includes(q) || last.includes(q) || nick.includes(q);
    }) : [];

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={styles.modalOverlay}>
                <View style={[styles.modalContent, { height: '80%', backgroundColor: theme.colors.card }]}>
                    <Text style={[styles.modalTitle, { color: theme.colors.text }]}>{title}</Text>

                    <View style={{ flexDirection: 'row', marginBottom: 10 }}>
                        <TextInput
                            placeholder="Nuovo elemento..."
                            placeholderTextColor={theme.colors.textSecondary}
                            value={newItem}
                            onChangeText={setNewItem}
                            style={[styles.input, { flex: 1, marginBottom: 0, marginRight: 10, backgroundColor: theme.colors.inputBackground, color: theme.colors.text, borderColor: theme.colors.border }]}
                        />
                        <TouchableOpacity style={[styles.button, { backgroundColor: theme.colors.success }]} onPress={addItem}>
                            <Text style={styles.buttonText}>Aggiungi</Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={[styles.label, { marginTop: 20, color: theme.colors.textSecondary }]}>Lista Attuale (Modifiche non salvate):</Text>
                    <FlatList
                        data={list}
                        keyExtractor={(item) => item}
                        renderItem={({ item }) => (
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 10, borderBottomWidth: 1, borderColor: theme.colors.border }}>
                                <Text style={{ color: theme.colors.text }}>{item}</Text>
                                <TouchableOpacity onPress={() => removeItem(item)}>
                                    <Text style={{ color: theme.colors.danger }}>Elimina</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                        style={{ maxHeight: 200 }}
                    />

                    {allowImport && members && (
                        <>
                            <Text style={[styles.label, { marginTop: 20, color: theme.colors.textSecondary }]}>Importa da Indirizzario:</Text>
                            <TextInput
                                style={[styles.input, { marginBottom: 10, backgroundColor: theme.colors.inputBackground, color: theme.colors.text, borderColor: theme.colors.border }]}
                                placeholder="Cerca persona..."
                                placeholderTextColor={theme.colors.textSecondary}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                            <FlatList
                                data={filteredMembers}
                                keyExtractor={(item) => item.id}
                                renderItem={({ item }) => {
                                    const name = item.nickname || `${item.firstName} ${item.lastName || ''}`.trim();
                                    const isAdded = list.includes(name);
                                    return (
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 10, borderBottomWidth: 1, borderColor: theme.colors.border }}>
                                            <Text style={{ color: theme.colors.text }}>{name}</Text>
                                            {!isAdded && (
                                                <TouchableOpacity onPress={() => importMember(item)}>
                                                    <Text style={{ color: theme.colors.primary }}>Importa</Text>
                                                </TouchableOpacity>
                                            )}
                                            {isAdded && <Text style={{ color: theme.colors.success }}>✓</Text>}
                                        </View>
                                    )
                                }}
                            />
                        </>
                    )}

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 }}>
                        <TouchableOpacity style={[styles.button, { backgroundColor: theme.colors.inputBackground, flex: 1, marginRight: 5 }]} onPress={onClose}>
                            <Text style={[styles.buttonText, { color: theme.colors.textSecondary }]}>Annulla</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.button, { backgroundColor: theme.colors.primary, flex: 1, marginLeft: 5 }]} onPress={() => onSave(list)}>
                            <Text style={styles.buttonText}>💾 Salva Modifiche</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};



export default function FinancialScreen() {
    const { firebaseUser, loading: authLoading } = useAuth();
    const { theme } = useTheme();
    const navigation = useNavigation();

    if (authLoading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={{ color: theme.colors.text }}>Caricamento...</Text>
            </View>
        );
    }

    if (!firebaseUser) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: theme.colors.background }}>
                <Text style={{ fontSize: 18, textAlign: 'center', color: theme.colors.text }}>
                    Accesso negato! Effettua il login.
                </Text>
            </View>
        );
    }

    const speseCollectionPath = `financial`;

    StatusBar.setBarStyle("dark-content");

    // ---------- STATE ----------
    const [speseTotali, setSpeseTotali] = useState<Spesa[]>([]);
    const [speseVisibili, setSpeseVisibili] = useState<Spesa[]>([]);

    // Form State
    const [importo, setImporto] = useState<string>("");
    const [categoria, setCategoria] = useState<string>("Generale");
    const [metodoPagamento, setMetodoPagamento] = useState<string>("Contanti");
    const [descrizione, setDescrizione] = useState<string>("");
    const [editId, setEditId] = useState<string | null>(null);
    const [anticipata, setAnticipata] = useState<boolean>(false);
    const [anticipatoDa, setAnticipatoDa] = useState<string>("");
    const [pagatoDa, setPagatoDa] = useState<string>(""); // For Entrate
    const [isManualPagatoDa, setIsManualPagatoDa] = useState<boolean>(false);
    const [debitore, setDebitore] = useState<string>(""); // For Anticipo Squadra (Chi riceve)

    // Modals & Selection
    const [selectedSpesa, setSelectedSpesa] = useState<Spesa | null>(null);
    const [modalSpesaVisible, setModalSpesaVisible] = useState<boolean>(false);
    const [modalTutteVisibile, setModalTutteVisibile] = useState<boolean>(false);
    const [fabModalVisible, setFabModalVisible] = useState<boolean>(false);
    const [tipoDaAggiungere, setTipoDaAggiungere] = useState<"Spesa" | "Donazione">("Spesa");

    // Filters
    const [filter, setFilter] = useState<"Tutte" | "Contanti" | "Carta" | "Anticipate">("Tutte");

    // Settings State
    const [anticipators, setAnticipators] = useState<string[]>([]);
    const [pagatori, setPagatori] = useState<string[]>([]);
    const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIE);
    const [members, setMembers] = useState<Member[]>([]); // From Indirizzario

    // Settings Modals State
    const [showAnticipatorsModal, setShowAnticipatorsModal] = useState(false);
    const [showPagatoriModal, setShowPagatoriModal] = useState(false);
    const [showCategoriesModal, setShowCategoriesModal] = useState(false);



    // Reimbursement
    const [rimborsi, setRimborsi] = useState<Record<string, number>>({});
    const [personeSpese, setPersoneSpese] = useState<Record<string, Spesa[]>>({});
    const [crediti, setCrediti] = useState<Record<string, number>>({}); // Crediti da riscuotere (Squadra ha anticipato a Persona)
    const [personeCrediti, setPersoneCrediti] = useState<Record<string, Spesa[]>>({});

    const [rimborsoModalVisible, setRimborsoModalVisible] = useState<boolean>(false);
    const [rimborsoImporto, setRimborsoImporto] = useState<string>("");
    const [personaSelezionata, setPersonaSelezionata] = useState<string>("");
    const [rimborsoMetodo, setRimborsoMetodo] = useState<string>("Contanti");

    // New: Selection of specific transactions
    const [transazioniDaRimborsare, setTransazioniDaRimborsare] = useState<Spesa[]>([]);
    const [selectedTransactionIds, setSelectedTransactionIds] = useState<string[]>([]);
    const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({}); // Store custom amounts for each transaction
    const [payerForTeamAdvance, setPayerForTeamAdvance] = useState<string>(""); // Who is paying for a generic team advance


    // Gestione differenziata Debito (Squadra deve a Persona) vs Credito (Persona deve a Squadra) vs Anticipo Squadra (Generico)
    const [tipoRimborso, setTipoRimborso] = useState<"Debito" | "Credito" | "Anticipo Squadra">("Debito");

    const [loading, setLoading] = useState<boolean>(false);


    // ---------- Load Spese TOTALI ----------
    useEffect(() => {
        const qTotali = query(
            collection(db, speseCollectionPath),
            orderBy("data", "desc")
        );

        const unsub = onSnapshot(qTotali, (snapshot) => {
            const speseList: Spesa[] = snapshot.docs.map((docSnap) => {
                const data = docSnap.data();
                const rawImporto = data.importo ?? 0;
                const parsedImporto = typeof rawImporto === "number" ? rawImporto : parseFloat(String(rawImporto).replace(",", "."));
                const safeImporto = isNaN(parsedImporto) ? 0 : parsedImporto;

                const rawImportoDovuto = data.importoDovuto ?? 0;
                const parsedImportoDovuto = typeof rawImportoDovuto === "number" ? rawImportoDovuto : parseFloat(String(rawImportoDovuto).replace(",", "."));
                const safeImportoDovuto = isNaN(parsedImportoDovuto) ? 0 : parsedImportoDovuto;

                return {
                    id: docSnap.id,
                    importo: safeImporto,
                    importoDovuto: safeImportoDovuto,
                    categoria: data.categoria || "",
                    metodoPagamento: data.metodoPagamento || "",
                    descrizione: data.descrizione || "",
                    data: data.data ? (data.data as Timestamp).toDate() : new Date(),
                    tipo: data.tipo || "Spesa",
                    anticipata: data.anticipata || false,
                    anticipatoDa: data.anticipatoDa || "",
                    rimborsata: data.rimborsata || false,
                    pagatoDa: data.pagatoDa || "",
                    debitore: data.debitore || "",
                };
            });
            setSpeseTotali(speseList);
            setSpeseVisibili(speseList);
        });
        return () => unsub();
    }, []);

    // ---------- Load Settings (Anticipators, Pagatori & Categories) & Members ----------
    useEffect(() => {
        // Load Categories
        const unsubCategories = onSnapshot(doc(db, 'impostazione', 'CategorieSpese'), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.values && Array.isArray(data.values)) {
                    setCategories(data.values);
                } else {
                    setCategories(DEFAULT_CATEGORIE);
                }
            } else {
                setCategories(DEFAULT_CATEGORIE);
                setDoc(doc(db, 'impostazione', 'CategorieSpese'), { values: DEFAULT_CATEGORIE }, { merge: true });
            }
        });

        // Load Anticipators
        const unsubAnticipators = onSnapshot(doc(db, 'impostazione', 'ListaAnticipatari'), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setAnticipators(data.values || []);
            } else {
                setAnticipators([]);
                setDoc(doc(db, 'impostazione', 'ListaAnticipatari'), { values: [] }, { merge: true });
            }
        });

        // Load Pagatori
        const unsubPagatori = onSnapshot(doc(db, 'impostazione', 'ListaPagatori'), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setPagatori(data.values || []);
            } else {
                setPagatori([]);
                setDoc(doc(db, 'impostazione', 'ListaPagatori'), { values: [] }, { merge: true });
            }
        });

        // Load members for import
        const unsubMembers = subscribeToMembers((m) => setMembers(m));

        return () => {
            unsubCategories();
            unsubAnticipators();
            unsubPagatori();
            unsubMembers();
        };
    }, []);

    // ---------- Calculate Debts ----------
    useEffect(() => {
        const rimborsiTemp: Record<string, number> = {};
        const grouped: Record<string, Spesa[]> = {};

        speseTotali.forEach((s) => {
            // DEBITI: Team owes someone (anticipatoDa != "Squadra")
            if (s.anticipata && !s.rimborsata && s.anticipatoDa && s.anticipatoDa !== "Squadra") {
                rimborsiTemp[s.anticipatoDa] = (rimborsiTemp[s.anticipatoDa] || 0) + (s.importoDovuto || 0);

                if (!grouped[s.anticipatoDa]) grouped[s.anticipatoDa] = [];
                grouped[s.anticipatoDa].push(s);
            }
        });

        // Sort grouped expenses by date
        Object.keys(grouped).forEach((k) => {
            grouped[k].sort((a, b) => (a.data?.getTime() ?? 0) - (b.data?.getTime() ?? 0));
        });

        setRimborsi(rimborsiTemp);
        setPersoneSpese(grouped);

        // Calcolo CREDITI (Anticipo Squadra -> Persona OR Anticpo Squadra Generic)
        const creditiTemp: Record<string, number> = {};
        const groupedCrediti: Record<string, Spesa[]> = {};

        speseTotali.forEach((s) => {
            // Legacy Credits OR New Anticipo Squadra
            const isLegacyCredit = s.tipo === "Anticipo" && (s.importoDovuto || 0) > 0 && s.debitore;
            const isAnticipoSquadra = s.anticipata && !s.rimborsata && s.anticipatoDa === "Squadra";

            if (isLegacyCredit) {
                // Credit vs specific person
                const target = s.debitore!;
                creditiTemp[target] = (creditiTemp[target] || 0) + (s.importoDovuto || 0);
                if (!groupedCrediti[target]) groupedCrediti[target] = [];
                groupedCrediti[target].push(s);
            } else if (isAnticipoSquadra) {
                // Credit vs "Generic" (or actually logic is we want to see it in the list)
                // We create a special group "Squadra" or "Anticipi Generici"
                const target = "Anticipo Squadra";
                creditiTemp[target] = (creditiTemp[target] || 0) + (s.importoDovuto || 0);
                if (!groupedCrediti[target]) groupedCrediti[target] = [];
                groupedCrediti[target].push(s);
            }
        });

        // Sort grouped credits by date
        Object.keys(groupedCrediti).forEach((k) => {
            groupedCrediti[k].sort((a, b) => (a.data?.getTime() ?? 0) - (b.data?.getTime() ?? 0));
        });

        setCrediti(creditiTemp);
        setPersoneCrediti(groupedCrediti);

    }, [speseTotali]);


    // ---------- Funzioni utili ----------
    const resetForm = () => {
        setImporto("");
        setCategoria(categories[0] || "Generale");
        setMetodoPagamento("Contanti");
        setDescrizione("");
        setEditId(null);
        setTipoDaAggiungere("Spesa");
        setAnticipata(false);
        setAnticipatoDa("");
        setAnticipatoDa("");
        setPagatoDa("");
        setIsManualPagatoDa(false);
        setDebitore("");
    };



    // ---------- Save Settings Handlers ----------
    const saveAnticipators = async (newList: string[]) => {
        try {
            await setDoc(doc(db, 'impostazione', 'ListaAnticipatari'), { values: newList }, { merge: true });
            setShowAnticipatorsModal(false);
        } catch (e: any) {
            showAlert("Errore", e.message);
        }
    };

    const savePagatori = async (newList: string[]) => {
        try {
            await setDoc(doc(db, 'impostazione', 'ListaPagatori'), { values: newList }, { merge: true });
            setShowPagatoriModal(false);
        } catch (e: any) {
            showAlert("Errore", e.message);
        }
    };

    const saveCategories = async (newList: string[]) => {
        try {
            await setDoc(doc(db, 'impostazione', 'CategorieSpese'), { values: newList }, { merge: true });
            setShowCategoriesModal(false);
        } catch (e: any) {
            showAlert("Errore", e.message);
        }
    };


    // ---------- Salva spesa / donazione ----------
    const salvaSpesa = async () => {
        const importoParsed = parseFloat(importo);
        if (!importo || importoParsed <= 0) return showAlert("Attenzione", "Inserisci un importo valido");

        if (tipoDaAggiungere === "Spesa" && anticipata && !anticipatoDa) return showAlert("Attenzione", "Seleziona chi ha anticipato la spesa");
        // pagatoDa is now optional for Donazione


        let importoDaSalvare = 0;
        let importoDovutoDaSalvare = 0;
        let metodoDaSalvare = metodoPagamento;
        let categoriaDaSalvare = categoria;

        if (tipoDaAggiungere === "Donazione") {
            importoDaSalvare = Math.abs(importoParsed);
            importoDovutoDaSalvare = 0;
            categoriaDaSalvare = "Entrata"; // Fixed category for donations
            // metodoDaSalvare is already set from state (restricted to Contanti/Carta)
        } else if (tipoDaAggiungere === "Spesa" && anticipata) {
            // Check if it's a Team Advance ("Anticipo Squadra")
            if (anticipatoDa === "Squadra") {
                // Outflow from Team (Real money spent by team), to be returned by someone (Generic)
                importoDaSalvare = -Math.abs(importoParsed);
                importoDovutoDaSalvare = Math.abs(importoParsed);
                metodoDaSalvare = metodoPagamento; // We need to know HOW the team paid (Cash/Card)
                // Debitore is NOT set here. It's generic.
            } else {
                // Member Advance (Debt: Team owes Member)
                importoDaSalvare = 0; // No cash flow for team yet
                importoDovutoDaSalvare = Math.abs(importoParsed);
                metodoDaSalvare = ""; // Hidden in UI, irrelevant for debt creation
            }
        } else {
            // Standard Expense
            importoDaSalvare = -Math.abs(importoParsed);
            importoDovutoDaSalvare = 0;
        }

        const spesaObj: any = {
            importo: importoDaSalvare,
            importoDovuto: importoDovutoDaSalvare,
            categoria: categoriaDaSalvare,
            metodoPagamento: metodoDaSalvare,
            descrizione: descrizione || (tipoDaAggiungere === "Donazione" ? "Entrata" : (anticipatoDa === "Squadra" ? "Anticipo Squadra" : "")),
            data: new Date(),
            tipo: tipoDaAggiungere,
            anticipata: tipoDaAggiungere === "Spesa" ? anticipata : false,
            anticipatoDa: (tipoDaAggiungere === "Spesa" && anticipata) ? anticipatoDa : "",
            pagatoDa: tipoDaAggiungere === "Donazione" ? pagatoDa : "",
            debitore: "", // Generic Team Advance has no debitore at creation
            rimborsata: false,
        };

        try {
            if (editId) {
                await updateDoc(doc(db, speseCollectionPath, editId), spesaObj);
            } else {
                await addDoc(collection(db, speseCollectionPath), spesaObj);
            }
            resetForm();
            setFabModalVisible(false);
        } catch (e: any) {
            showAlert("Errore", e.message);
        }
    };

    const eliminaSpesa = async (id: string) => {
        try {
            await deleteDoc(doc(db, speseCollectionPath, id));
            setModalSpesaVisible(false);
            showAlert("✅ Spesa eliminata", "La spesa è stata eliminata con successo.");
        } catch (error) {
            console.error("Errore eliminazione spesa:", error);
            showAlert("❌ Errore", "Impossibile eliminare la spesa.");
        }
    };

    // ---------- Reimbursement Logic ----------
    const apriModalRimborso = async (persona: string, tipo: "Debito" | "Credito" | "Anticipo Squadra") => {
        setPersonaSelezionata(persona);
        setTipoRimborso(tipo);
        setRimborsoImporto("");
        setRimborsoMetodo("Contanti");
        setSelectedTransactionIds([]); // Reset selection
        setTransazioniDaRimborsare([]); // Reset list
        setCustomAmounts({});
        setPayerForTeamAdvance("");

        // Fetch refundable transactions
        try {
            let q;
            if (tipo === "Debito") {
                // Team owes Person
                q = query(collection(db, speseCollectionPath), where("anticipatoDa", "==", persona), where("anticipata", "==", true), where("rimborsata", "==", false), orderBy("data", "asc"));
            } else if (tipo === "Credito") {
                // Person owes Team (Legacy types)
                q = query(collection(db, speseCollectionPath), where("debitore", "==", persona), where("tipo", "==", "Anticipo"), where("rimborsata", "==", false), orderBy("data", "asc"));
            } else {
                // "Anticipo Squadra" (Generic)
                q = query(collection(db, speseCollectionPath), where("anticipatoDa", "==", "Squadra"), where("anticipata", "==", true), where("rimborsata", "==", false), orderBy("data", "asc"));
            }

            const snap = await getDocs(q);
            const items = snap.docs
                .map(docSnap => {
                    const data = docSnap.data();
                    return {
                        id: docSnap.id,
                        ...data,
                        data: data.data instanceof Timestamp ? data.data.toDate() : (data.data && data.data.toDate ? data.data.toDate() : data.data)
                    } as Spesa;
                })
                .filter(s => (s.importoDovuto || 0) > 0);

            setTransazioniDaRimborsare(items);
        } catch (error) {
            console.error("Error fetching transactions for reimbursement:", error);
        }

        setRimborsoModalVisible(true);
    };

    const toggleTransactionSelection = (id: string, amount: number) => {
        setSelectedTransactionIds(prev => {
            const isSelected = prev.includes(id);
            const newSelection = isSelected
                ? prev.filter(tid => tid !== id)
                : [...prev, id];

            // Manage custom amounts
            setCustomAmounts(prevAmounts => {
                const newAmounts = { ...prevAmounts };
                if (!isSelected) {
                    // Selecting: Default to full amount
                    newAmounts[id] = amount.toFixed(2);
                } else {
                    // Deselecting: Remove amount
                    delete newAmounts[id];
                }

                // Recalculate total
                const total = Object.values(newAmounts).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
                setRimborsoImporto(total.toFixed(2));

                return newAmounts;
            });

            return newSelection;
        });
    };

    const updateCustomAmount = (id: string, text: string) => {
        setCustomAmounts(prev => {
            const newAmounts = { ...prev, [id]: text };
            // Recalculate total immediately
            const total = Object.values(newAmounts).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
            setRimborsoImporto(total.toFixed(2));
            return newAmounts;
        });
    };

    const eseguiRimborsoProgressivo = async () => {
        const importoDaRimborsare = parseFloat(rimborsoImporto || "0");
        const isAnticipoSquadra = tipoRimborso === "Anticipo Squadra";

        if (!personaSelezionata && !isAnticipoSquadra) return showAlert("Attenzione", "Nessuna persona selezionata");
        if (isAnticipoSquadra && !payerForTeamAdvance) return showAlert("Attenzione", "Seleziona chi sta pagando");
        if (!importoDaRimborsare || importoDaRimborsare <= 0) return showAlert("Attenzione", "Inserisci un importo valido");

        const isDebito = tipoRimborso === "Debito";
        // Calculate total due based on selected mode
        let totaleDovuto = 0;
        if (isAnticipoSquadra) {
            // For team advances, total is sum of all generic advances
            totaleDovuto = transazioniDaRimborsare.reduce((sum, t) => sum + (t.importoDovuto || 0), 0);
        } else {
            totaleDovuto = Math.abs(isDebito ? (rimborsi[personaSelezionata] || 0) : (crediti[personaSelezionata] || 0));
        }

        if (importoDaRimborsare > totaleDovuto + 0.001) {
            return showAlert("Attenzione", `L'importo supera il totale (${totaleDovuto.toFixed(2)} €)`);
        }

        setLoading(true);

        try {
            // If using selection with custom amounts, we skip the query for "non rimborsati" because we have them in state
            // OR we verify them. Best to use state if selection is active.

            let itemsToProcess: Spesa[] = [];

            if (selectedTransactionIds.length > 0) {
                // Process ONLY selected
                itemsToProcess = transazioniDaRimborsare.filter(item => selectedTransactionIds.includes(item.id));
            } else {
                // Legacy / Manual without selection: Fetch again to be safe and process progressively
                // Determine which field to query based on type
                let q;
                if (isAnticipoSquadra) {
                    q = query(collection(db, speseCollectionPath), where("anticipatoDa", "==", "Squadra"), where("anticipata", "==", true), where("rimborsata", "==", false), orderBy("data", "asc"));
                } else {
                    const fieldToCheck = isDebito ? "anticipatoDa" : "debitore";
                    q = query(
                        collection(db, speseCollectionPath),
                        where(fieldToCheck, "==", personaSelezionata),
                        where("rimborsata", "==", false),
                        ...(isDebito ? [where("anticipata", "==", true)] : [where("tipo", "==", "Anticipo")]),
                        orderBy("data", "asc")
                    );
                }
                const snap = await getDocs(q);
                itemsToProcess = snap.docs
                    .map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Spesa))
                    .filter(s => (s.importoDovuto || 0) > 0);
            }

            let importoAncoraDaAllocare = importoDaRimborsare;
            const batch = writeBatch(db);

            for (const item of itemsToProcess) {
                if (importoAncoraDaAllocare <= 0.001) break;

                const docRefOriginale = doc(db, speseCollectionPath, item.id);
                const importoDebitoCorrente = item.importoDovuto || 0;

                let importoPagatoPerQuesta = 0;

                // Determine amount to pay for THIS item
                if (selectedTransactionIds.includes(item.id) && customAmounts[item.id]) {
                    // USE CUSTOM AMOUNT
                    const customAmount = parseFloat(customAmounts[item.id]);
                    importoPagatoPerQuesta = Math.min(customAmount, importoDebitoCorrente); // Can't pay more than owed

                    // Reduce global allocation pool by what we pay here (just to track, though loop might be driven differently if manual)
                    // Actually if we obey customAmounts, we should just pay that.
                } else {
                    // PROGRESSIVE LOGIC
                    if (importoDebitoCorrente <= importoAncoraDaAllocare + 0.001) {
                        importoPagatoPerQuesta = importoDebitoCorrente;
                    } else {
                        importoPagatoPerQuesta = importoAncoraDaAllocare;
                    }
                }

                const nuovoImportoResiduo = importoDebitoCorrente - importoPagatoPerQuesta;
                const isPaidOff = nuovoImportoResiduo <= 0.001;

                if (isPaidOff) {
                    if (isDebito) {
                        // DELETE legacy debts
                        batch.delete(docRefOriginale);
                    } else {
                        // UPDATE credits / advances
                        batch.update(docRefOriginale, {
                            importoDovuto: 0,
                            rimborsata: true
                        });
                    }
                } else {
                    // Partial
                    batch.update(docRefOriginale, {
                        importoDovuto: nuovoImportoResiduo,
                        rimborsata: false
                    });
                }

                // Create Transaction
                const nuovoDocRef = doc(collection(db, speseCollectionPath));

                if (isDebito) {
                    // DEBITO: We pay them. Cash Outflow. "Spesa".
                    // The original "item" has details of what we bought.
                    const { id, ...altro } = item;
                    batch.set(nuovoDocRef, {
                        ...altro,
                        importo: -Math.abs(importoPagatoPerQuesta),
                        importoDovuto: 0,
                        anticipata: false,
                        anticipatoDa: "",
                        metodoPagamento: rimborsoMetodo,
                        data: new Date(),
                        rimborsata: false,
                        tipo: "Spesa",
                        descrizione: `${item.descrizione} (Rimb. ${personaSelezionata})`
                    });
                } else {
                    // CREDITO or ANTICIPO SQUADRA: They pay us. Cash Inflow. "Entrata".
                    const pagatore = isAnticipoSquadra ? payerForTeamAdvance : personaSelezionata;
                    batch.set(nuovoDocRef, {
                        importo: Math.abs(importoPagatoPerQuesta),
                        importoDovuto: 0,
                        categoria: "Entrata",
                        metodoPagamento: rimborsoMetodo,
                        descrizione: `Restituzione da ${pagatore}: ${item.descrizione}`,
                        data: new Date(),
                        tipo: "Entrata",
                        anticipata: false,
                        rimborsata: false,
                        pagatoDa: pagatore
                    });
                }

                if (!selectedTransactionIds.includes(item.id)) {
                    // Only reduce global allocation if we are using the progressive "dump" amount. 
                    // If we are using custom amounts, each item uses its own exact amount.
                    importoAncoraDaAllocare -= importoPagatoPerQuesta;
                }
            }

            await batch.commit();
            setRimborsoModalVisible(false);
            setRimborsoImporto("");
            setPersonaSelezionata("");
            showAlert("✅ Operazione completata", `Operazione di ${importoDaRimborsare.toFixed(2)} € registrata con successo.`);

        } catch (error: any) {
            console.error(error);
            showAlert("Errore", error?.message || "Errore sconosciuto");
        } finally {
            setLoading(false);
        }
    };

    // ---------- Spese filtrate ----------
    const speseFiltrate = speseVisibili.filter((s) => {
        switch (filter) {
            case "Contanti":
                return s.metodoPagamento === "Contanti";
            case "Carta":
                return s.metodoPagamento === "Carta";
            case "Anticipate":
                // Mostra sia debiti della squadra (anticipate) che crediti (anticipi squadra non rimborsati)
                return (s.anticipata && !s.rimborsata) || (s.tipo === "Anticipo" && !s.rimborsata);
            default:
                return true;
        }
    });

    // ---------- Saldo contanti / carta ----------
    const saldoContanti = speseTotali
        .filter((s) => s.metodoPagamento === "Contanti")
        .reduce((sum, s) => sum + s.importo, 0);
    const saldoCarta = speseTotali
        .filter((s) => s.metodoPagamento === "Carta")
        .reduce((sum, s) => sum + s.importo, 0);
    const saldoTotale = saldoContanti + saldoCarta;

    const totaleDebiti = speseTotali
        .filter(s => s.anticipata && !s.rimborsata)
        .reduce((sum, s) => sum + (s.importoDovuto || 0), 0);

    const totaleCrediti = speseTotali
        .filter(s => s.tipo === "Anticipo" && !s.rimborsata)
        .reduce((sum, s) => sum + (s.importoDovuto || 0), 0);


    const entrateContanti = speseTotali.filter(s => s.metodoPagamento === "Contanti" && s.importo > 0).reduce((a, s) => a + s.importo, 0);
    const usciteContanti = speseTotali.filter(s => s.metodoPagamento === "Contanti" && s.importo < 0).reduce((a, s) => a + Math.abs(s.importo), 0);

    const entrateCarta = speseTotali.filter(s => s.metodoPagamento === "Carta" && s.importo > 0).reduce((a, s) => a + s.importo, 0);
    const usciteCarta = speseTotali.filter(s => s.metodoPagamento === "Carta" && s.importo < 0).reduce((a, s) => a + Math.abs(s.importo), 0);


    // ---------- Ultime 3 spese ----------
    const ultime3Spese = [...speseFiltrate]
        .sort((a, b) => (b.data?.getTime() ?? 0) - (a.data?.getTime() ?? 0))
        .slice(0, 3);

    const apriDettaglioSpesa = (s: Spesa) => {
        setSelectedSpesa(s);
        setModalSpesaVisible(true);
    };

    const preparaModifica = (s: Spesa) => {
        setEditId(s.id);
        const importoForm = s.anticipata ? (s.importoDovuto || 0) : s.importo;
        setImporto(Math.abs(importoForm).toString());
        setCategoria(s.categoria);
        setMetodoPagamento(s.metodoPagamento);
        setTipoDaAggiungere(s.tipo === "Donazione" ? "Donazione" : "Spesa");
        setDescrizione(s.descrizione || "");
        setAnticipata(s.anticipata || false);
        setAnticipatoDa(s.anticipatoDa || "");
        setPagatoDa(s.pagatoDa || "");
        setIsManualPagatoDa(s.pagatoDa ? !pagatori.includes(s.pagatoDa) : false);
        setDebitore(s.debitore || "");

        setModalSpesaVisible(false);
        setFabModalVisible(true);
    };

    const getDisplayImporto = (item: Spesa) => {
        if (item.anticipata && !item.rimborsata) {
            return {
                text: `${(item.importoDovuto || 0).toFixed(2)} €`,
                color: theme.colors.warning, // Orange
                subtext: `(Debito) ${item.anticipatoDa}`
            };
        }

        if (item.tipo === "Anticipo" && !item.rimborsata) {
            return {
                text: `${item.importo.toFixed(2)} €`, // Show negative outcome
                color: theme.colors.warning,
                subtext: `(Credito vs ${item.debitore})`
            };
        }

        if (item.importo > 0) {
            return {
                text: `+${item.importo.toFixed(2)} €`,
                color: theme.colors.success,
                subtext: item.tipo === "Donazione" ? `${item.pagatoDa || 'Anonimo'} (${item.metodoPagamento})` : (item.descrizione?.startsWith("Restituzione") ? item.descrizione : item.metodoPagamento)
            };
        }
        return {
            text: `${item.importo.toFixed(2)} €`,
            color: theme.colors.danger,
            subtext: item.metodoPagamento
        };
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
            <StatusBar barStyle={theme.dark ? "light-content" : "dark-content"} backgroundColor={theme.colors.background} />
            <ScreenTitle title="SPESE" onBack={() => navigation.goBack()} containerStyle={{ marginTop: 20 }} />

            <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
                {/* Filtri */}
                <View style={[styles.filterContainer, { backgroundColor: theme.colors.card }]}>
                    {["Tutte", "Contanti", "Carta", "Anticipate"].map((f) => (
                        <TouchableOpacity
                            key={f}
                            style={[styles.filterButton, filter === f ? { backgroundColor: theme.colors.primary } : { backgroundColor: theme.colors.inputBackground }]}
                            onPress={() => setFilter(f as any)}
                        >
                            <Text style={{ color: filter === f ? "#fff" : theme.colors.text }}>{f}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Totali dinamici */}
                <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
                    {filter === "Tutte" && (
                        <>
                            <Text style={[styles.saldoTitle, { color: theme.colors.text }]}>💰 Saldi di Cassa</Text>
                            <Text style={[styles.saldo, { color: theme.colors.text }]}>💵 Contanti: {saldoContanti.toFixed(2)} €</Text>
                            <Text style={[styles.saldo, { color: theme.colors.text }]}>💳 Carta: {saldoCarta.toFixed(2)} €</Text>
                            <Text style={[styles.saldoTotal, { color: theme.colors.text, borderTopColor: theme.colors.border }]}>Totale: {saldoTotale.toFixed(2)} €</Text>
                        </>
                    )}
                    {filter === "Contanti" && (
                        <>
                            <Text style={[styles.saldoTitle, { color: theme.colors.text }]}>💵 Flusso Contanti</Text>
                            <Text style={[styles.saldo, { color: theme.colors.text }]}>Entrate: +{entrateContanti.toFixed(2)} €</Text>
                            <Text style={[styles.saldo, { color: theme.colors.text }]}>Uscite: -{usciteContanti.toFixed(2)} €</Text>
                            <Text style={[styles.saldoTotal, { color: theme.colors.text, borderTopColor: theme.colors.border }]}>Saldo: {saldoContanti.toFixed(2)} €</Text>
                        </>
                    )}
                    {filter === "Carta" && (
                        <>
                            <Text style={[styles.saldoTitle, { color: theme.colors.text }]}>💳 Flusso Carta</Text>
                            <Text style={[styles.saldo, { color: theme.colors.text }]}>Entrate: +{entrateCarta.toFixed(2)} €</Text>
                            <Text style={[styles.saldo, { color: theme.colors.text }]}>Uscite: -{usciteCarta.toFixed(2)} €</Text>
                            <Text style={[styles.saldoTotal, { color: theme.colors.text, borderTopColor: theme.colors.border }]}>Saldo: {saldoCarta.toFixed(2)} €</Text>
                        </>
                    )}
                    {filter === "Anticipate" && (
                        <>
                            <Text style={[styles.saldoTitle, { color: theme.colors.text }]}>🤝 Totale Sospesi</Text>
                            <Text style={[styles.saldo, { color: theme.colors.text }]}>Debiti (da rimborsare): {totaleDebiti.toFixed(2)} €</Text>
                            <Text style={[styles.saldo, { color: theme.colors.text }]}>Crediti (da riscuotere): {totaleCrediti.toFixed(2)} €</Text>
                            <Text style={[styles.saldoTotal, { color: theme.colors.text, borderTopColor: theme.colors.border }]}>Bilancio Sospesi: {(totaleCrediti - totaleDebiti).toFixed(2)} €</Text>
                        </>
                    )}
                </View>

                {/* Debiti da rimborsare Section */}
                {filter === "Anticipate" && (
                    <View style={{ paddingHorizontal: 8, marginTop: 10 }}>
                        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>💼 Debiti da rimborsare</Text>
                        {Object.keys(personeSpese).length === 0 ? (
                            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>Nessun debito da rimborsare</Text>
                        ) : (
                            Object.keys(personeSpese).map((nome) => {
                                const totale = personeSpese[nome].reduce((sum, s) => sum + (s.importoDovuto || 0), 0);
                                if (totale < 0.01) return null;
                                return (
                                    <View key={nome} style={[styles.spesaCard, { backgroundColor: theme.colors.card }]}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Text style={{ fontSize: 16, fontWeight: 'bold', color: theme.colors.text }}>{nome}</Text>
                                            <Text style={{ fontSize: 16, color: '#E67E22', fontWeight: 'bold' }}>{totale.toFixed(2)} €</Text>
                                        </View>
                                        <TouchableOpacity
                                            style={[styles.button, { backgroundColor: '#007bff', marginTop: 10 }]}
                                            onPress={() => apriModalRimborso(nome, "Debito")}
                                        >
                                            <Text style={styles.buttonText}>💸 Rimborsa</Text>
                                        </TouchableOpacity>
                                    </View>
                                )
                            })
                        )}
                    </View>
                )}

                {/* Crediti da riscuotere Section */}
                {filter === "Anticipate" && (
                    <View style={{ paddingHorizontal: 8, marginTop: 10 }}>
                        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>💰 Crediti da riscuotere</Text>
                        {Object.keys(personeCrediti).length === 0 ? (
                            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>Nessun credito da riscuotere</Text>
                        ) : (
                            Object.keys(personeCrediti).map((nome) => {
                                const totale = personeCrediti[nome].reduce((sum, s) => sum + (s.importoDovuto || 0), 0);
                                if (totale < 0.01) return null;
                                return (
                                    <View key={nome} style={[styles.spesaCard, { backgroundColor: theme.colors.card }]}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Text style={{ fontSize: 16, fontWeight: 'bold', color: theme.colors.text }}>{nome}</Text>
                                            <Text style={{ fontSize: 16, color: theme.colors.success, fontWeight: 'bold' }}>{totale.toFixed(2)} €</Text>
                                        </View>
                                        <TouchableOpacity
                                            style={[styles.button, { backgroundColor: theme.colors.success, marginTop: 10 }]}
                                            onPress={() => {
                                                if (nome === "Anticipo Squadra") {
                                                    apriModalRimborso("Anticipo Squadra", "Anticipo Squadra");
                                                } else {
                                                    apriModalRimborso(nome, "Credito");
                                                }
                                            }}
                                        >
                                            <Text style={styles.buttonText}>💵 Riscuoti</Text>
                                        </TouchableOpacity>
                                    </View>
                                )
                            })
                        )}
                    </View>
                )}

                {/* Ultime Transazioni */}
                <View style={{ paddingHorizontal: 8, marginTop: 10 }}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>🧾 Ultime Transazioni</Text>

                    {ultime3Spese.length === 0 ? (
                        <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>Nessuna transazione registrata</Text>
                    ) : (
                        ultime3Spese.map((item) => {
                            const display = getDisplayImporto(item);
                            const isAnticipoAttivo = item.anticipata && !item.rimborsata;

                            return (
                                <TouchableOpacity
                                    key={item.id}
                                    style={[
                                        styles.spesaCard,
                                        { backgroundColor: theme.colors.card },
                                        isAnticipoAttivo
                                            ? { borderLeftColor: "#E67E22", borderLeftWidth: 5 }
                                            : item.metodoPagamento === "Carta"
                                                ? { borderLeftColor: "#2196f3", borderLeftWidth: 5 }
                                                : { borderLeftColor: "#4caf50", borderLeftWidth: 5 },
                                    ]}
                                    onPress={() => apriDettaglioSpesa(item)}
                                >
                                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                                        <Text style={[styles.spesaText, { color: display.color, fontWeight: "bold" }]}>
                                            {display.text}
                                        </Text>
                                        <Text style={styles.badge}>{item.categoria}</Text>
                                    </View>
                                    <Text style={[styles.spesaSub, { color: theme.colors.textSecondary }]}>{display.subtext} | {item.data?.toLocaleDateString()}</Text>
                                    {item.descrizione && (
                                        <Text style={[styles.spesaSub, { fontStyle: "italic", marginTop: 2, color: theme.colors.textSecondary }]}>{item.descrizione}</Text>
                                    )}
                                </TouchableOpacity>
                            )
                        })
                    )}

                    <TouchableOpacity onPress={() => setModalTutteVisibile(true)} style={{ marginTop: 8, alignItems: 'center' }}>
                        <Text style={{ color: theme.colors.primary }}>📜 Vedi tutte le transazioni ({speseFiltrate.length})</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            {/* FAB */}
            <TouchableOpacity style={styles.fab} onPress={() => setFabModalVisible(true)}>
                <View style={[styles.fabCircle, { backgroundColor: theme.colors.primary }]}>
                    <Image source={require("../assets/plus.png")} style={{ width: 30, height: 30, tintColor: 'white' }} />
                </View>
            </TouchableOpacity>

            {/* MODAL: TUTTE LE TRANSAZIONI */}
            <Modal visible={modalTutteVisibile} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { maxHeight: "85%", backgroundColor: theme.colors.card }]}>
                        <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Tutte le transazioni ({speseFiltrate.length})</Text>
                        <FlatList
                            data={[...speseFiltrate].sort((a, b) => (b.data?.getTime() ?? 0) - (a.data?.getTime() ?? 0))}
                            keyExtractor={(item) => item.id}
                            renderItem={({ item }) => {
                                const display = getDisplayImporto(item);
                                const isAnticipoAttivo = item.anticipata && !item.rimborsata;
                                return (
                                    <TouchableOpacity
                                        style={[
                                            styles.spesaCard,
                                            { backgroundColor: theme.colors.card },
                                            isAnticipoAttivo
                                                ? { borderLeftColor: "#E67E22", borderLeftWidth: 5 }
                                                : item.metodoPagamento === "Carta"
                                                    ? { borderLeftColor: "#2196f3", borderLeftWidth: 5 }
                                                    : { borderLeftColor: "#4caf50", borderLeftWidth: 5 },
                                        ]}
                                        onPress={() => apriDettaglioSpesa(item)}
                                    >
                                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                                            <Text style={[styles.spesaText, { color: display.color, fontWeight: "bold" }]}>
                                                {display.text}
                                            </Text>
                                            <Text style={styles.badge}>{item.categoria}</Text>
                                        </View>
                                        <Text style={[styles.spesaSub, { color: theme.colors.textSecondary }]}>{display.subtext} | {item.data?.toLocaleDateString()}</Text>
                                        {item.descrizione && (
                                            <Text style={[styles.spesaSub, { fontStyle: "italic", marginTop: 2, color: theme.colors.textSecondary }]}>{item.descrizione}</Text>
                                        )}
                                    </TouchableOpacity>
                                )
                            }}
                            ListEmptyComponent={<Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>Nessuna transazione da mostrare</Text>}
                        />
                        <TouchableOpacity style={[styles.button, { backgroundColor: theme.colors.inputBackground, marginTop: 10 }]} onPress={() => setModalTutteVisibile(false)}>
                            <Text style={[styles.buttonText, { color: theme.colors.textSecondary }]}>Chiudi</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* MODAL: DETTAGLIO TRANSAZIONE */}
            <Modal visible={modalSpesaVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
                        {selectedSpesa ? (
                            <>
                                <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Dettaglio Transazione</Text>
                                <Text style={{ color: theme.colors.text }}>Tipo: {selectedSpesa.tipo}</Text>
                                <Text style={{ color: theme.colors.text }}>Categoria: {selectedSpesa.categoria}</Text>
                                <Text style={{ color: theme.colors.text }}>Metodo: {selectedSpesa.metodoPagamento}</Text>
                                {selectedSpesa.anticipata && (
                                    <Text style={{ color: '#E67E22', fontWeight: 'bold' }}>Anticipato da: {selectedSpesa.anticipatoDa}</Text>
                                )}
                                {selectedSpesa.tipo === "Donazione" && (
                                    <Text style={{ color: '#2ECC71', fontWeight: 'bold' }}>Pagato da: {selectedSpesa.pagatoDa}</Text>
                                )}
                                {selectedSpesa.tipo === "Anticipo" && (
                                    <Text style={{ color: theme.colors.warning, fontWeight: 'bold' }}>Anticipo a: {selectedSpesa.debitore}</Text>
                                )}
                                <Text style={{ fontWeight: "bold", marginTop: 5, color: theme.colors.text }}>
                                    Importo: {selectedSpesa.anticipata ? selectedSpesa.importoDovuto?.toFixed(2) : Math.abs(selectedSpesa.importo).toFixed(2)} €
                                </Text>
                                <Text style={{ fontStyle: "italic", marginTop: 5, color: theme.colors.textSecondary }}>{selectedSpesa.descrizione}</Text>
                                <Text style={{ marginTop: 5, color: theme.colors.textSecondary }}>Data: {selectedSpesa.data?.toLocaleString()}</Text>

                                <View style={{ flexDirection: "row", justifyContent: "space-around", marginTop: 20 }}>
                                    <TouchableOpacity style={[styles.button, { backgroundColor: "#ffc107" }]} onPress={() => preparaModifica(selectedSpesa)}>
                                        <Text style={styles.buttonText}>Modifica</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.button, { backgroundColor: "#dc3545" }]} onPress={() => eliminaSpesa(selectedSpesa.id)}>
                                        <Text style={styles.buttonText}>Elimina</Text>
                                    </TouchableOpacity>
                                </View>
                                <TouchableOpacity style={[styles.button, { backgroundColor: theme.colors.inputBackground, marginTop: 10 }]} onPress={() => setModalSpesaVisible(false)}>
                                    <Text style={[styles.buttonText, { color: theme.colors.textSecondary }]}>Chiudi</Text>
                                </TouchableOpacity>
                            </>
                        ) : null}
                    </View>
                </View>
            </Modal>

            {/* MODAL: AGGIUNGI/MODIFICA */}
            <Modal visible={fabModalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
                        <Text style={[styles.modalTitle, { color: theme.colors.text }]}>{editId ? "Modifica Transazione" : "Nuova Transazione"}</Text>

                        <View style={[styles.switchContainer, { borderColor: theme.colors.primary }]}>
                            <TouchableOpacity
                                style={[styles.switchButton, tipoDaAggiungere === "Spesa" ? { backgroundColor: theme.colors.primary } : { backgroundColor: theme.colors.card }]}
                                onPress={() => setTipoDaAggiungere("Spesa")}
                            >
                                <Text style={[styles.switchText, tipoDaAggiungere === "Spesa" ? { color: '#fff' } : { color: theme.colors.primary }]}>Spesa</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.switchButton, tipoDaAggiungere === "Donazione" ? { backgroundColor: theme.colors.primary } : { backgroundColor: theme.colors.card }]}
                                onPress={() => {
                                    setTipoDaAggiungere("Donazione");
                                    if (!METODI_ENTRATA.includes(metodoPagamento)) {
                                        setMetodoPagamento("Contanti");
                                    }
                                }}
                            >
                                <Text style={[styles.switchText, tipoDaAggiungere === "Donazione" ? { color: '#fff' } : { color: theme.colors.primary }]}>Entrata</Text>
                            </TouchableOpacity>
                        </View>

                        <TextInput
                            placeholder="Importo"
                            placeholderTextColor={theme.colors.textSecondary}
                            keyboardType="numeric"
                            value={importo}
                            onChangeText={setImporto}
                            style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text, borderColor: theme.colors.border }]}
                        />

                        {tipoDaAggiungere === "Spesa" && (
                            <>
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <Text style={[styles.label, { color: theme.colors.text }]}>Categoria:</Text>
                                    <TouchableOpacity onPress={() => setShowCategoriesModal(true)}>
                                        <Text style={{ fontSize: 20 }}>⚙️</Text>
                                    </TouchableOpacity>
                                </View>
                                <SearchablePicker
                                    selectedValue={categoria}
                                    onValueChange={setCategoria}
                                    items={categories}
                                    title="Seleziona Categoria"
                                />
                            </>
                        )}

                        {tipoDaAggiungere === "Spesa" && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                <Text style={[styles.label, { color: theme.colors.text }]}>Spesa Anticipata?</Text>
                                <Switch value={anticipata} onValueChange={setAnticipata} />
                            </View>
                        )}

                        {tipoDaAggiungere === "Donazione" && (
                            <>
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <Text style={[styles.label, { color: theme.colors.text }]}>Chi ha pagato?</Text>
                                    <View style={{ flexDirection: 'row' }}>
                                        <TouchableOpacity onPress={() => setIsManualPagatoDa(!isManualPagatoDa)} style={{ marginRight: 15 }}>
                                            <Text style={{ fontSize: 18 }}>{isManualPagatoDa ? "📋" : "✍️"}</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => setShowPagatoriModal(true)}>
                                            <Text style={{ fontSize: 20 }}>⚙️</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                                {isManualPagatoDa ? (
                                    <TextInput
                                        placeholder="Nome persona..."
                                        placeholderTextColor={theme.colors.textSecondary}
                                        value={pagatoDa}
                                        onChangeText={setPagatoDa}
                                        style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text, borderColor: theme.colors.border }]}
                                    />
                                ) : (
                                    <SearchablePicker
                                        selectedValue={pagatoDa}
                                        onValueChange={setPagatoDa}
                                        items={pagatori}
                                        title="Chi ha pagato?"
                                        placeholder="Seleziona pagatore (opzionale)"
                                    />
                                )}
                            </>
                        )}

                        {tipoDaAggiungere === "Spesa" && anticipata && (
                            <>
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <Text style={[styles.label, { color: theme.colors.text }]}>Chi ha anticipato?</Text>
                                    <TouchableOpacity onPress={() => setShowAnticipatorsModal(true)}>
                                        <Text style={{ fontSize: 20 }}>⚙️</Text>
                                    </TouchableOpacity>
                                </View>
                                <SearchablePicker
                                    selectedValue={anticipatoDa}
                                    onValueChange={setAnticipatoDa}
                                    items={["Squadra", ...anticipators.filter(a => a !== "Squadra")]} // Ensure Squadra is first and unique
                                    title="Chi ha anticipato?"
                                />
                                {anticipatoDa === "Squadra" && (
                                    <>
                                        <Text style={[styles.label, { color: theme.colors.text }]}>Metodo Pagamento Squadra:</Text>
                                        <SearchablePicker
                                            selectedValue={metodoPagamento}
                                            onValueChange={setMetodoPagamento}
                                            items={METODI}
                                            title="Metodo Pagamento Squadra"
                                        />
                                    </>
                                )}
                            </>
                        )}
                        {!anticipata && (
                            <>
                                <Text style={[styles.label, { color: theme.colors.text }]}>Metodo:</Text>
                                <View style={{ marginBottom: 10 }}>
                                    <SearchablePicker
                                        selectedValue={metodoPagamento}
                                        onValueChange={setMetodoPagamento}
                                        items={tipoDaAggiungere === "Donazione" ? METODI_ENTRATA : METODI}
                                        title="Seleziona Metodo"
                                    />
                                </View>
                            </>
                        )}

                        <TextInput
                            placeholder={tipoDaAggiungere === "Donazione" ? "Causale" : (anticipatoDa === "Squadra" ? "Descrizione anticipo" : "Descrizione (opzionale)")}
                            placeholderTextColor={theme.colors.textSecondary}
                            value={descrizione}
                            onChangeText={setDescrizione}
                            style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text, borderColor: theme.colors.border }]}
                        />

                        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 20 }}>
                            <TouchableOpacity style={[styles.button, { backgroundColor: theme.colors.inputBackground, flex: 1, marginRight: 5 }]} onPress={() => { setFabModalVisible(false); resetForm(); }}>
                                <Text style={[styles.buttonText, { color: theme.colors.textSecondary }]}>Annulla</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.button, { backgroundColor: "#28a745", flex: 1, marginLeft: 5 }]} onPress={salvaSpesa}>
                                <Text style={styles.buttonText}>Salva</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* MODAL: MANAGE ANTICIPATORS */}
            <ListEditorModal
                visible={showAnticipatorsModal}
                title="Gestisci Anticipatari"
                initialList={anticipators}
                onSave={saveAnticipators}
                onClose={() => setShowAnticipatorsModal(false)}
                members={members}
                allowImport
            />

            {/* MODAL: MANAGE PAGATORI */}
            <ListEditorModal
                visible={showPagatoriModal}
                title="Gestisci Pagatori (Entrate)"
                initialList={pagatori}
                onSave={savePagatori}
                onClose={() => setShowPagatoriModal(false)}
                members={members}
                allowImport
            />

            {/* MODAL: MANAGE CATEGORIES */}
            <ListEditorModal
                visible={showCategoriesModal}
                title="Gestisci Categorie"
                initialList={categories}
                onSave={saveCategories}
                onClose={() => setShowCategoriesModal(false)}
            />

            {/* MODAL: RIMBORSO */}
            <Modal visible={rimborsoModalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
                        <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                            {tipoRimborso === "Debito" ? `Rimborsa a ${personaSelezionata}` : `Riscuoti da ${personaSelezionata}`}
                        </Text>
                        <Text style={{ marginBottom: 10, color: theme.colors.text }}>
                            Totale {tipoRimborso === "Debito" ? "dovuto" : "da riscuotere"}: {(tipoRimborso === "Debito" ? rimborsi[personaSelezionata] : crediti[personaSelezionata])?.toFixed(2)} €
                        </Text>

                        {/* Payer Selection for Team Advance */}
                        {tipoRimborso === "Anticipo Squadra" && (
                            <View style={{ marginBottom: 15 }}>
                                <Text style={[styles.label, { color: theme.colors.text }]}>Chi sta pagando?</Text>
                                <SearchablePicker
                                    selectedValue={payerForTeamAdvance}
                                    onValueChange={setPayerForTeamAdvance}
                                    items={(members || []).filter(m => m).map(m => m.nickname || (m.firstName + (m.lastName ? " " + m.lastName : ""))).filter(n => n)}
                                    title="Seleziona Chi Paga"
                                />
                            </View>
                        )}

                        {/* TRANSACTION SELECTION LIST */}
                        {transazioniDaRimborsare.length > 0 && (
                            <View style={{ maxHeight: 250, marginBottom: 10 }}>
                                <Text style={[styles.label, { color: theme.colors.text }]}>Seleziona transazioni specifiche (Opzionale):</Text>
                                <FlatList
                                    data={transazioniDaRimborsare}
                                    keyExtractor={item => item.id}
                                    nestedScrollEnabled
                                    renderItem={({ item }) => {
                                        const isSelected = selectedTransactionIds.includes(item.id);
                                        return (
                                            <View style={{ borderBottomWidth: 1, borderColor: theme.colors.border, paddingVertical: 8 }}>
                                                <TouchableOpacity
                                                    style={{ flexDirection: 'row', alignItems: 'center', padding: 4 }}
                                                    onPress={() => toggleTransactionSelection(item.id, item.importoDovuto || 0)}
                                                >
                                                    <View style={{
                                                        width: 20, height: 20, borderWidth: 2, borderColor: theme.colors.primary, marginRight: 10,
                                                        backgroundColor: isSelected ? theme.colors.primary : 'transparent',
                                                        justifyContent: 'center', alignItems: 'center'
                                                    }}>
                                                        {isSelected && <Text style={{ color: '#fff', fontSize: 14 }}>✓</Text>}
                                                    </View>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={{ color: theme.colors.text }}>
                                                            {item.data?.toLocaleDateString()} - {item.descrizione}
                                                        </Text>
                                                        <Text style={{ fontWeight: 'bold', color: theme.colors.text }}>
                                                            {(item.importoDovuto || 0).toFixed(2)} €
                                                        </Text>
                                                    </View>
                                                </TouchableOpacity>

                                                {/* Custom Amount Input if Selected */}
                                                {isSelected && (
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5, marginLeft: 34 }}>
                                                        <Text style={{ color: theme.colors.text, marginRight: 10 }}>Importo parziale:</Text>
                                                        <TextInput
                                                            style={[styles.input, {
                                                                flex: 1,
                                                                backgroundColor: theme.colors.inputBackground,
                                                                color: theme.colors.text,
                                                                borderColor: theme.colors.border,
                                                                marginBottom: 0,
                                                                padding: 5,
                                                                height: 40
                                                            }]}
                                                            keyboardType="numeric"
                                                            placeholder={customAmounts[item.id] || (item.importoDovuto || 0).toFixed(2)}
                                                            placeholderTextColor={theme.colors.textSecondary}
                                                            value={customAmounts[item.id] || ""}
                                                            onChangeText={(text) => {
                                                                const amount = parseFloat(text.replace(",", "."));
                                                                setCustomAmounts(prev => {
                                                                    const newAmounts = { ...prev };
                                                                    if (!text) {
                                                                        // If empty, revert to full amount in calculation but keep empty string in UI? 
                                                                        // Or just delete and use full amount logically.
                                                                        // Let's keep it simple: if valid number, set it.
                                                                        newAmounts[item.id] = (item.importoDovuto || 0).toFixed(2);
                                                                    } else {
                                                                        newAmounts[item.id] = text;
                                                                    }

                                                                    // Recalculate total
                                                                    const total = Object.values(newAmounts).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
                                                                    setRimborsoImporto(total.toFixed(2));

                                                                    return newAmounts;
                                                                });
                                                            }}
                                                        />
                                                    </View>
                                                )}
                                            </View>
                                        );
                                    }}
                                />
                            </View>
                        )}

                        <Text style={[styles.label, { color: theme.colors.text }]}>
                            Importo {selectedTransactionIds.length > 0 ? "(Calcolato)" : "(Manuale)"}:
                        </Text>
                        <TextInput
                            placeholder={tipoRimborso === "Debito" ? "Importo da rimborsare" : "Importo riscosso"}
                            placeholderTextColor={theme.colors.textSecondary}
                            keyboardType="numeric"
                            value={rimborsoImporto}
                            onChangeText={setRimborsoImporto}
                            editable={selectedTransactionIds.length === 0} // Disable manual entry if specific items selected
                            style={[
                                styles.input,
                                {
                                    backgroundColor: selectedTransactionIds.length > 0 ? theme.colors.card : theme.colors.inputBackground,
                                    color: theme.colors.text,
                                    borderColor: theme.colors.border,
                                    opacity: selectedTransactionIds.length > 0 ? 0.7 : 1
                                }
                            ]}
                        />

                        <Text style={[styles.label, { color: theme.colors.text }]}>
                            {tipoRimborso === "Debito" ? "Metodo Rimborso:" : "Incassato tramite:"}
                        </Text>
                        <View style={[styles.pickerContainer, { borderColor: theme.colors.border, backgroundColor: theme.colors.inputBackground }]}>
                            <SearchablePicker
                                selectedValue={rimborsoMetodo}
                                onValueChange={setRimborsoMetodo}
                                items={["Contanti", "Carta"]}
                                title={tipoRimborso === "Debito" ? "Metodo Rimborso" : "Metodo Incasso"}
                            />
                        </View>

                        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 20 }}>
                            <TouchableOpacity style={[styles.button, { backgroundColor: theme.colors.inputBackground, flex: 1, marginRight: 5 }]} onPress={() => setRimborsoModalVisible(false)}>
                                <Text style={[styles.buttonText, { color: theme.colors.textSecondary }]}>Annulla</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.button, { backgroundColor: "#28a745", flex: 1, marginLeft: 5 }]}
                                onPress={eseguiRimborsoProgressivo}
                                disabled={loading}
                            >
                                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Conferma</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    filterContainer: {
        flexDirection: "row",
        justifyContent: "space-around",
        paddingVertical: 10,
        backgroundColor: "#fff",
    },
    filterButton: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
        backgroundColor: "#e0e0e0",
    },
    card: {
        padding: 16,
        backgroundColor: "#fff",
        borderRadius: 10,
        margin: 10,
        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowRadius: 5,
        elevation: 3,
    },
    saldoTitle: {
        fontWeight: "bold",
        textAlign: "center",
        marginBottom: 5,
        fontSize: 16,
    },
    saldo: {
        fontSize: 14,
        marginBottom: 2,
    },
    saldoTotal: {
        fontWeight: "bold",
        marginTop: 5,
        fontSize: 16,
        borderTopWidth: 1,
        borderTopColor: "#eee",
        paddingTop: 5,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: "bold",
        marginBottom: 10,
        marginLeft: 5,
    },
    spesaCard: {
        backgroundColor: "#fff",
        padding: 12,
        borderRadius: 8,
        marginBottom: 8,
        elevation: 2,
        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    spesaText: {
        fontSize: 16,
    },
    spesaSub: {
        fontSize: 12,
        color: "#666",
    },
    badge: {
        backgroundColor: "#95A5A6",
        color: "#fff",
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        fontSize: 12,
        overflow: "hidden",
    },
    emptyText: {
        textAlign: "center",
        color: "#888",
        marginTop: 20,
        fontStyle: "italic",
    },
    fab: {
        position: "absolute",
        bottom: 20,
        right: 20,
        zIndex: 999,
    },
    fabCircle: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: "#003399",
        justifyContent: "center",
        alignItems: "center",
        elevation: 5,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center",
        alignItems: "center",
    },
    modalContent: {
        width: "90%",
        backgroundColor: "#fff",
        borderRadius: 10,
        padding: 20,
        elevation: 5,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: "bold",
        marginBottom: 15,
        textAlign: "center",
    },
    input: {
        borderWidth: 1,
        borderColor: "#ccc",
        borderRadius: 5,
        padding: 10,
        marginBottom: 10,
    },
    label: {
        fontWeight: "bold",
        marginTop: 10,
        marginBottom: 5,
    },
    pickerContainer: {
        borderWidth: 1,
        borderColor: "#ccc",
        borderRadius: 5,
        marginBottom: 10,
    },
    button: {
        padding: 10,
        borderRadius: 5,
        alignItems: "center",
    },
    buttonText: {
        color: "#fff",
        fontWeight: "bold",
    },
    switchContainer: {
        flexDirection: "row",
        marginBottom: 15,
        borderWidth: 1,
        borderColor: "#003399",
        borderRadius: 5,
        overflow: "hidden",
    },
    switchButton: {
        flex: 1,
        padding: 10,
        alignItems: "center",
        backgroundColor: "#fff",
    },
    switchButtonActive: {
        backgroundColor: "#003399",
    },
    switchText: {
        color: "#003399",
        fontWeight: "bold",
    },
    switchTextActive: {
        color: "#fff",
    },
});
