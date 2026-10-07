// services/firestore.ts
// Barrel file — re-esporta tutto per retrocompatibilita degli import esistenti.
// I moduli si trovano in services/firestore/*.ts
//
// Per modificare la logica di un dominio, apri il file corrispondente:
//   - Tipi:           services/firestore/types.ts
//   - Utilita:        services/firestore/utils.ts
//   - Membri:         services/firestore/members.ts
//   - Presenze:       services/firestore/attendance.ts
//   - Calendario:     services/firestore/calendar.ts
//   - Hall of Fame:   services/firestore/hallOfFame.ts
//   - Lega:           services/firestore/league.ts
//   - Match Analisi:  services/firestore/matchAnalysis.ts
//   - Stagioni:       services/firestore/season.ts
//   - Mappa Mondiale: services/firestore/world.ts
//   - Impostazioni:   services/firestore/settings.ts

export * from './firestore/types';
export * from './firestore/utils';
export * from './firestore/members';
export * from './firestore/attendance';
export * from './firestore/calendar';
export * from './firestore/hallOfFame';
export * from './firestore/league';
export * from './firestore/matchAnalysis';
export * from './firestore/season';
export * from './firestore/world';
export * from './firestore/settings';
export * from './firestore/badges';
