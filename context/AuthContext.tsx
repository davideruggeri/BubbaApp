import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User as FirebaseUser, signOut } from "firebase/auth";
import {
    doc, getDoc, setDoc, onSnapshot,
    collection, query,
    where
} from "firebase/firestore";
import { auth, db } from "../firebaseConfig";

export type GlobalRole = "amministratore" | "staff" | "Bubba" | null; // 'amministratore' (Observer) | 'staff' (Game Advisor) | 'Bubba' (User) | null (Legacy Bubba)

export type UserProfile = {
    uid: string;
    email: string;
    firstName?: string;
    lastName?: string;
    nickname?: string;
    nome?: string; // Fallback/Legacy
    role: GlobalRole;
    theme?: 'light' | 'dark';
    memberId?: string;
} | null;

type AuthContextType = {
    firebaseUser: FirebaseUser | null;
    userProfile: UserProfile;
    loading: boolean;
    isGlobalAdmin: boolean; // isObserver (Amministratore)
    isStaff: boolean; // Game Advisor (Staff)
    isBubbaOnly: boolean; // true solo se ruolo === 'Bubba' (utente base)
    refreshUserProfile: () => Promise<void>;
    hasNewComunicazioni: boolean;
    setHasNewComunicazioni: React.Dispatch<React.SetStateAction<boolean>>;
};

const AuthContext = createContext<AuthContextType>({
    firebaseUser: null,
    userProfile: null,
    loading: true,
    isGlobalAdmin: false,
    isStaff: false,
    isBubbaOnly: false,
    refreshUserProfile: async () => { },
    hasNewComunicazioni: false,
    setHasNewComunicazioni: () => { },
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile>(null);
    const [loading, setLoading] = useState(true);
    const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);
    const [isStaff, setIsStaff] = useState(false);
    const [isBubbaOnly, setIsBubbaOnly] = useState(false);
    const [hasNewComunicazioni, setHasNewComunicazioni] = useState(false);


    const refreshUserProfile = async (): Promise<void> => {
        if (!firebaseUser) {
            console.log("RefreshProfile: Utente non loggato, impossibile aggiornare.");
            return;
        }
        console.log("RefreshProfile: Forzo aggiornamento manuale profilo...");
        try {
            const userRef = doc(db, "users", firebaseUser.uid);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                const data = userSnap.data();

                // Map role: prioritize ruolo_globale (legacy/manual DB edit) over role
                let globalRole: GlobalRole = null;
                if (data.ruolo_globale !== undefined) {
                    globalRole = data.ruolo_globale as GlobalRole;
                } else if (data.role !== undefined) {
                    globalRole = data.role as GlobalRole;
                }

                const profile: UserProfile = {
                    uid: firebaseUser.uid,
                    email: firebaseUser.email ?? "",
                    firstName: data.firstName || "",
                    lastName: data.lastName || "",
                    nickname: data.nickname || "",
                    nome: data.nome || "",
                    role: globalRole,
                    theme: data.theme || 'light',
                    memberId: data.memberId || undefined,
                };
                setUserProfile(profile);
                console.log("RefreshProfile: Profilo aggiornato manually dal server.");

                if (profile.role === 'amministratore') {
                    setIsGlobalAdmin(true);
                    setIsStaff(true); // Admin is also Staff
                    setIsBubbaOnly(false);
                } else if (profile.role === 'staff') {
                    setIsGlobalAdmin(false);
                    setIsStaff(true);
                    setIsBubbaOnly(false);
                } else {
                    setIsGlobalAdmin(false);
                    setIsStaff(false);
                    setIsBubbaOnly(profile.role === 'Bubba');
                }
            } else {
                console.warn("RefreshProfile: Utente non trovato in DB durante refresh.");
                await signOut(auth);
            }
        } catch (error) {
            console.error("Errore during refreshUserProfile:", error);
        }
    };

    useEffect(() => {
        let userProfileUnsubscribe: () => void = () => { };
        const unsubscribeAuth = onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
            userProfileUnsubscribe();
            try {
                if (fbUser) {
                    setFirebaseUser(fbUser);
                    const userRef = doc(db, "users", fbUser.uid);
                    userProfileUnsubscribe = onSnapshot(userRef, (userSnap) => {
                        if (userSnap.exists()) {
                            const data = userSnap.data();

                            // Map role: prioritize ruolo_globale (legacy/manual DB edit) over role
                            let globalRole: GlobalRole = null;
                            if (data.ruolo_globale !== undefined) {
                                globalRole = data.ruolo_globale as GlobalRole;
                            } else if (data.role !== undefined) {
                                globalRole = data.role as GlobalRole;
                            }

                            const profile: UserProfile = {
                                uid: fbUser.uid,
                                email: fbUser.email ?? "",
                                firstName: data.firstName || "",
                                lastName: data.lastName || "",
                                nickname: data.nickname || "",
                                nome: data.nome || "",
                                role: globalRole,
                                theme: data.theme || 'light',
                                memberId: data.memberId || undefined,
                            };
                            setUserProfile(profile);

                            if (profile.role === 'amministratore') {
                                setIsGlobalAdmin(true);
                                setIsStaff(true); // Admin is also Staff
                                setIsBubbaOnly(false);
                            } else if (profile.role === 'staff') {
                                setIsGlobalAdmin(false);
                                setIsStaff(true);
                                setIsBubbaOnly(false);
                            } else {
                                setIsGlobalAdmin(false);
                                setIsStaff(false);
                                setIsBubbaOnly(profile.role === 'Bubba');
                            }
                            setLoading(false);
                        } else {
                            console.log("Nuovo utente (rilevato da onSnapshot). Creazione profilo...");
                            const defaultProfile: UserProfile = {
                                uid: fbUser.uid,
                                email: fbUser.email ?? "",
                                firstName: "",
                                lastName: "",
                                nickname: "",
                                nome: fbUser.displayName || fbUser.email?.split('@')[0] || "",
                                role: null,
                                theme: 'light',
                                memberId: undefined,
                            };
                            setDoc(userRef, defaultProfile).catch(err => {
                                console.error("Errore creazione profilo utente:", err);
                            });
                        }
                    }, (error) => {
                        console.error("Errore onSnapshot profilo utente:", error);
                        setFirebaseUser(null); setUserProfile(null); setIsGlobalAdmin(false); setIsStaff(false);
                        setLoading(false);
                    });
                } else {
                    setFirebaseUser(null); setUserProfile(null); setIsGlobalAdmin(false); setIsStaff(false); setIsBubbaOnly(false);
                    setLoading(false);
                }
            } catch (error) {
                console.error("Errore in onAuthStateChanged:", error);
                setFirebaseUser(null); setUserProfile(null); setIsGlobalAdmin(false); setIsStaff(false); setIsBubbaOnly(false);
                setLoading(false);
            }
        });
        return () => {
            unsubscribeAuth();
            userProfileUnsubscribe();
        };
    }, []);



    const value: AuthContextType = {
        firebaseUser,
        userProfile,
        loading,
        isGlobalAdmin,
        isStaff,
        isBubbaOnly,
        refreshUserProfile,
        hasNewComunicazioni,
        setHasNewComunicazioni,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth deve essere usato all'interno di un AuthProvider");
    }
    return context;
};

export const hasRole = (
    userRole: GlobalRole,
    requiredRole: GlobalRole
): boolean => {
    const roleLevels: Record<string, number> = {
        'amministratore': 3,
        'staff': 2,
        'Bubba': 1,
        'null': 1 // Treat null as Bubba
    };

    const userLevel = roleLevels[userRole || 'null'] || 0;
    const requiredLevel = roleLevels[requiredRole || 'null'] || 0;

    return userLevel >= requiredLevel;
};
