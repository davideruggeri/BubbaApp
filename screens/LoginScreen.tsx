import React, { useState } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Platform,
    ActivityIndicator,
} from "react-native";
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    setPersistence,
    browserLocalPersistence,
    browserSessionPersistence,
} from "firebase/auth";
import { auth, db } from "../firebaseConfig";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { showAlert } from "../utils/alert";

export default function LoginScreen() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [nickname, setNickname] = useState("");
    const [isRegistering, setIsRegistering] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(true);

    const navigation = useNavigation();

    const {
        loading: authLoading,
    } = useAuth();



    const handleAuth = async () => {
        if (!email || !password) {
            showAlert("Attenzione", "Inserisci email e password");
            return;
        }

        if (isRegistering && (!firstName || !lastName || !nickname)) {
            showAlert("Attenzione", "Tutti i campi sono obbligatori per la registrazione.");
            return;
        }

        try {
            if (Platform.OS === "web") {
                const persistenceType = rememberMe
                    ? browserLocalPersistence
                    : browserSessionPersistence;
                await setPersistence(auth, persistenceType);
            }

            if (isRegistering) {
                const userCredential = await createUserWithEmailAndPassword(
                    auth,
                    email,
                    password
                );
                const user = userCredential.user;
                const userRef = doc(db, "users", user.uid);
                const userSnap = await getDoc(userRef);

                if (!userSnap.exists()) {
                    await setDoc(userRef, {
                        email: user.email,
                        firstName: firstName.trim(),
                        lastName: lastName.trim(),
                        nickname: nickname.trim(),
                        nome: `${firstName.trim()} ${lastName.trim()}`, // Backward compatibility
                        role: "Bubba",
                        createdAt: new Date(),
                        isDisabled: false,
                    });
                }
                // mostraAlert("Benvenuto!", "Account creato. Contatta un amministratore per essere aggiunto a un gruppo.");
            } else {
                const userCredential = await signInWithEmailAndPassword(
                    auth,
                    email,
                    password
                );
                const user = userCredential.user;
                const docRef = doc(db, "users", user.uid);
                const docSnap = await getDoc(docRef);
                let isDisabled = false;
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    isDisabled = !!data.isDisabled;
                    if (isDisabled) {
                        await auth.signOut();
                        showAlert(
                            "Accesso Bloccato",
                            "Il tuo account è disabilitato. Contatta un amministratore per riabilitarlo."
                        );
                        return;
                    }
                }
            }
            // Navigation handled by AuthContext state change in App.tsx
            // No manual navigation needed here

        } catch (error: any) {
            let message = "Si è verificato un errore.";
            switch (error.code) {
                case "auth/email-already-in-use":
                    message = "Questa email è già registrata.";
                    break;
                case "auth/invalid-email":
                    message = "Email non valida.";
                    break;
                case "auth/weak-password":
                    message = "La password deve essere di almeno 6 caratteri.";
                    break;
                case "auth/wrong-password":
                case "auth/user-not-found":
                case "auth/invalid-credential":
                    message = "Credenziali non valide.";
                    break;
            }
            showAlert("Errore", message);
        }
    };

    if (authLoading) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" color="#003399" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>
                {isRegistering ? "Crea un Account" : "Accedi"}
            </Text>

            {isRegistering && (
                <>
                    <TextInput
                        style={styles.input}
                        placeholder="Nome"
                        value={firstName}
                        onChangeText={setFirstName}
                        placeholderTextColor="#999"
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Cognome"
                        value={lastName}
                        onChangeText={setLastName}
                        placeholderTextColor="#999"
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Soprannome (Bubba Name)"
                        value={nickname}
                        onChangeText={setNickname}
                        placeholderTextColor="#999"
                    />
                </>
            )}

            <TextInput
                style={styles.input}
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholderTextColor="#999"
            />

            <View style={styles.passwordContainer}>
                <TextInput
                    style={styles.inputPassword}
                    placeholder="Password"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                    placeholderTextColor="#999"
                />
                <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.showButton}
                >
                    <Text style={styles.showButtonText}>
                        {showPassword ? "🙈" : "👁️"}
                    </Text>
                </TouchableOpacity>
            </View>

            <TouchableOpacity
                style={styles.rememberContainer}
                onPress={() => setRememberMe(!rememberMe)}
            >
                <Text style={styles.checkboxIcon}>
                    {rememberMe ? "✅" : "⬜️"}
                </Text>
                <Text style={styles.rememberText}>Ricordami</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.button} onPress={handleAuth}>
                <Text style={styles.buttonText}>
                    {isRegistering ? "Registrati" : "Accedi"}
                </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setIsRegistering(!isRegistering)}>
                <Text style={styles.switchText}>
                    {isRegistering
                        ? "Hai già un account? Accedi"
                        : "Non hai un account? Registrati"}
                </Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: "center", padding: 20, backgroundColor: "#f5f5ff" },
    title: { fontSize: 32, fontWeight: "bold", marginBottom: 40, textAlign: "center", color: "#003399" },
    input: { width: "100%", borderWidth: 1, borderColor: "#ccc", backgroundColor: "#fff", paddingVertical: 12, paddingHorizontal: 15, borderRadius: 8, marginBottom: 15, fontSize: 16, color: "#333" },
    passwordContainer: { flexDirection: "row", alignItems: "center", width: "100%", marginBottom: 15 },
    inputPassword: { flex: 1, borderWidth: 1, borderColor: "#ccc", backgroundColor: "#fff", paddingVertical: 12, paddingHorizontal: 15, borderRadius: 8, fontSize: 16, color: "#333" },
    showButton: { position: "absolute", right: 15, height: "100%", justifyContent: "center" },
    showButtonText: { fontSize: 22 },
    rememberContainer: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", marginBottom: 20 },
    checkboxIcon: { fontSize: 20, marginRight: 10 },
    rememberText: { fontSize: 16, color: "#333" },
    button: { backgroundColor: "#003399", padding: 15, borderRadius: 8, marginTop: 10 },
    buttonText: { color: "#fff", textAlign: "center", fontWeight: "bold", fontSize: 16 },
    switchText: { marginTop: 25, color: "#003399", textAlign: "center", fontWeight: "500" },
});
