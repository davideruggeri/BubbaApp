import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from './AuthContext';
import { showAlert } from '../utils/alert';

export type EasterEgg = {
    id: string;
    name: string;
    description: string;
    dateFound: string;
};

export type EffectType = 'rain' | 'huck' | 'layout' | 'spinning' | 'confetti' | 'callahan' | null;

type EasterEggContextType = {
    foundEggs: EasterEgg[];
    findEgg: (id: string, name: string, description: string, effect?: EffectType) => void;
    activeEffect: EffectType;
    triggerEffect: (type: EffectType) => void;
    toast: string | null;
    showToast: (msg: string) => void;
};

const EasterEggContext = createContext<EasterEggContextType>({
    foundEggs: [],
    findEgg: () => { },
    activeEffect: null,
    triggerEffect: () => { },
    toast: null,
    showToast: () => { },
});

export const EasterEggProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [foundEggs, setFoundEggs] = useState<EasterEgg[]>([]);
    const [activeEffect, setActiveEffect] = useState<EffectType>(null);
    const [toast, setToast] = useState<string | null>(null);
    const { firebaseUser, userProfile } = useAuth(); // Import user session

    useEffect(() => {
        loadEggs();
    }, [firebaseUser]);

    const getUserReferenceData = () => {
        if (!firebaseUser) return {};
        return {
            uid: firebaseUser.uid,
            userEmail: firebaseUser.email || '',
            userName: userProfile?.nickname || userProfile?.nome || userProfile?.firstName || firebaseUser.displayName || 'Sconosciuto'
        };
    };

    const loadEggs = async () => {
        try {
            let localEggs: EasterEgg[] = [];
            const stored = await AsyncStorage.getItem('easter_eggs');
            if (stored) {
                localEggs = JSON.parse(stored);
            }

            if (firebaseUser) {
                const eggDocRef = doc(db, 'user_easter_eggs', firebaseUser.uid);
                const eggSnap = await getDoc(eggDocRef);

                if (eggSnap.exists()) {
                    const data = eggSnap.data();
                    const dbEggs: EasterEgg[] = data.eggs || [];

                    // Merge DB eggs and Local eggs
                    const mergedEggs = [...dbEggs];
                    const dbEggIds = new Set(dbEggs.map(e => e.id));
                    let needsUpdate = false;

                    for (const localEgg of localEggs) {
                        if (!dbEggIds.has(localEgg.id)) {
                            mergedEggs.push(localEgg);
                            needsUpdate = true;
                        }
                    }

                    setFoundEggs(mergedEggs);

                    if (needsUpdate) {
                        await setDoc(eggDocRef, { eggs: mergedEggs, ...getUserReferenceData() }, { merge: true });
                    }
                    await AsyncStorage.setItem('easter_eggs', JSON.stringify(mergedEggs));
                } else { // No DB record, use local eggs and save them
                    setFoundEggs(localEggs);
                    await setDoc(eggDocRef, { eggs: localEggs, ...getUserReferenceData() });
                }
            } else {
                setFoundEggs(localEggs);
            }
        } catch (e) {
            console.error("Failed to load eggs", e);
        }
    };

    const triggerEffect = (type: EffectType) => {
        setActiveEffect(type);
        // Effects usually last for a few seconds
        setTimeout(() => {
            setActiveEffect(null);
        }, 3000); // 3 seconds timeout
    };

    const showToast = (msg: string) => {
        setToast(msg);
        setTimeout(() => {
            setToast(null);
        }, 4000); // Toast lasts slightly longer than effect
    };

    const findEgg = async (id: string, name: string, description: string, effect?: EffectType) => {
        const isAlreadyFound = foundEggs.find(egg => egg.id === id);
        
        // Trigger effect regardless of whether it's the first time
        if (effect) {
            triggerEffect(effect);
        }

        let updatedEggs = [...foundEggs];
        let isNew = false;

        if (!isAlreadyFound) {
            const newEgg: EasterEgg = {
                id,
                name,
                description,
                dateFound: new Date().toLocaleDateString(),
            };
            updatedEggs = [...foundEggs, newEgg];
            setFoundEggs(updatedEggs);
            isNew = true;
        }

        try {
            await AsyncStorage.setItem('easter_eggs', JSON.stringify(updatedEggs));
            
            // Sync with Firestore if logged in (FORZA SEMPRE L'AGGIORNAMENTO/RIGENERAZIONE AL CLICK)
            if (firebaseUser) {
                const eggDocRef = doc(db, 'user_easter_eggs', firebaseUser.uid);
                await setDoc(eggDocRef, { eggs: updatedEggs, ...getUserReferenceData() }, { merge: true });
            }

            // Only show toast for new find
            if (isNew) {
                showToast(`Nuovo Easter Egg: ${name}!`);
            }
        } catch (e) {
            console.error("Failed to save egg", e);
        }
    };

    return (
        <EasterEggContext.Provider value={{ foundEggs, findEgg, activeEffect, triggerEffect, toast, showToast }}>
            {children}
        </EasterEggContext.Provider>
    );
};

export const useEasterEggs = () => useContext(EasterEggContext);
