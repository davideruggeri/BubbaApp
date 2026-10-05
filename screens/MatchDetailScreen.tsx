// screens/MatchDetailScreen.tsx
// Reindirizzamento trasparente a LiveMatchScreen mantenendo compatibilità con route esistenti (es. banner Home)
import React, { useEffect } from 'react';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { RootStackParamList } from '../App';

type MatchDetailScreenRouteProp = RouteProp<RootStackParamList, 'MatchDetail'>;

export default function MatchDetailScreen() {
    const navigation = useNavigation<any>();
    const route = useRoute<MatchDetailScreenRouteProp>();
    const { match } = route.params;

    useEffect(() => {
        if (match && match.id) {
            navigation.replace('LiveMatch', { matchId: match.id, initialMatch: match });
        }
    }, [match?.id]);

    return null;
}
