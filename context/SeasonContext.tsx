import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { setCachedStagioneCorrente } from '../services/firestore';

export interface StagioneCorrente {
    stagioneCorrente: string;
    dataInizio: any;
    dataFine: any | null;
}

export const getStagioneFromDate = (dateStr: string): string => {
    if (!dateStr) {
        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth() + 1;
        return m >= 9 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
    }
    // Expected format YYYY-MM-DD or ISO string
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length >= 2) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        if (!isNaN(year) && !isNaN(month)) {
            return month >= 9 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
        }
    }
    const d = new Date(dateStr);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    return month >= 9 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
};

interface SeasonContextType {
    stagioneCorrente: string;
    stagioneData: StagioneCorrente | null;
    loading: boolean;
    getStagioneFromDate: (dateStr: string) => string;
}

const defaultCurrentSeason = getStagioneFromDate(new Date().toISOString());

const SeasonContext = createContext<SeasonContextType>({
    stagioneCorrente: defaultCurrentSeason,
    stagioneData: null,
    loading: true,
    getStagioneFromDate,
});

export const SeasonProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [stagioneCorrente, setStagioneCorrenteState] = useState<string>(defaultCurrentSeason);
    const [stagioneData, setStagioneData] = useState<StagioneCorrente | null>(null);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        const seasonDocRef = doc(db, 'impostazione', 'stagione_corrente');
        const unsubscribe = onSnapshot(
            seasonDocRef,
            (snapshot) => {
                if (snapshot.exists()) {
                    const data = snapshot.data() as StagioneCorrente;
                    const season = data.stagioneCorrente || defaultCurrentSeason;
                    setStagioneCorrenteState(season);
                    setStagioneData(data);
                    setCachedStagioneCorrente(season);
                } else {
                    setStagioneCorrenteState(defaultCurrentSeason);
                    setCachedStagioneCorrente(defaultCurrentSeason);
                }
                setLoading(false);
            },
            (error) => {
                console.error('Error fetching stagione_corrente:', error);
                setStagioneCorrenteState(defaultCurrentSeason);
                setCachedStagioneCorrente(defaultCurrentSeason);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, []);

    return (
        <SeasonContext.Provider
            value={{
                stagioneCorrente,
                stagioneData,
                loading,
                getStagioneFromDate,
            }}
        >
            {children}
        </SeasonContext.Provider>
    );
};

export const useSeason = () => useContext(SeasonContext);
