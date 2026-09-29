// One-time script to seed league data
// Run with: node seedLeagueData.js

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc } = require('firebase/firestore');

const firebaseConfig = {
    apiKey: "AIzaSyDqQhWWLwmOhSKVwKnCKmGZvhGZAkUKXpU",
    authDomain: "bubba-app-d5e4e.firebaseapp.com",
    projectId: "bubba-app-d5e4e",
    storageBucket: "bubba-app-d5e4e.firebasestorage.app",
    messagingSenderId: "1029695959677",
    appId: "1:1029695959677:web:d5d1e6e8c6e8c6e8c6e8c6"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const DEFAULT_RULES = [
    { text: "Vengono assegnati solo durante la partitella finale, qualsiasi cosa accada prima/durante gli esercizi (es. handblock) non conta.", order: 1 },
    { text: "Per le mete in hammer, tamber, scober, greatest i Bonus vanno sia a chi ha fatto l'assist sia a chi ha segnato mentre i rispettivi Malus solo a uno dei due.", order: 2 },
    { text: "Se qualcuno tenta un Hammer (esempio) come semplice passaggio, non per forza cercando la finalizzazione in meta e genera un turnover, riceve il Malus.", order: 3 },
    { text: "Chi arriva in ritardo riceve il Malus.", order: 4 },
    { text: "Nel caso in cui tutti siano in orario, l'ultimo che arriva prende il Malus.", order: 5 },
    { text: "Questo vale solo per gli allenamenti in campo.", order: 6 },
    { text: "Se su un lancio in meta si manca volutamente la presa per far perdere punti al compagno, si riceverà il Malus come se si avesse tentato il lancio.", order: 7 },
    { text: "(es. manco volutamente la presa su uno scober, ricevo un Malus di -2 punti.)", order: 8 },
    { text: "Chi vince il FLIP per le casacche riceverà il Bonus, chi perde, oltre a dover indossare le casacche, riceverà il Malus.", order: 9 },
    { text: "Quelli \"Finali\" possono essere assegnati solo dopo l'ultimo giorno della lega, mentre quelli \"Speciali\" possono essere assegnati più volte durante il corso degli allenamenti.", order: 10 },
    { text: "In assenza della responsabile della Hat League, di default, saranno assegnati solo i punti per la presenza (prese dal sondaggio).", order: 11 },
    { text: "I punti derivanti da qualsiasi altro Bonus o Malus saranno assegnati solo se qualcuno riporterà l'accaduto scrivendo sul gruppo BubbaChat e per questo verrà aggiunto anche un +1.", order: 12 },
];

const DEFAULT_BONUS_OPTIONS = [
    { label: "Presente 1° giorno Winter Hat", points: 2 },
    { label: "Allenamento ≤ 8 persone", points: 1 },
    { label: "Invitare amici", points: 4 },
    { label: "Meteo disagiante", points: 2 },
    { label: "Torneo con i Bubba", points: 2 },
    { label: "Torneo/Evento frisbee", points: 1 },
    { label: "Prestare divise", points: 1 },
    { label: "Callahan", points: 2 },
    { label: "Handblock", points: 1 },
    { label: "Footblock", points: 2 },
    { label: "Scorpionblock", points: 3 },
    { label: "Headblock", points: 4 },
    { label: "Layout buono", points: 1 },
    { label: "Intercetto in layout", points: 2 },
    { label: "Meta in layout", points: 3 },
    { label: "Callahan in layout", points: 4 },
    { label: "Ultima meta (Assist/Goal)", points: 1 },
    { label: "Meta in hammer", points: 1 },
    { label: "Meta in scober", points: 2 },
    { label: "Meta in tamber", points: 3 },
    { label: "Greatest", points: 4 },
    { label: "Assist mano NON dominante", points: 1 },
    { label: "Vincere flip casacche", points: 1 },
    { label: "Lavare casacche", points: 2 },
];

const DEFAULT_MALUS_OPTIONS = [
    { label: "Pacco (Presente -> Assente)", points: -2 },
    { label: "Berna", points: -2 },
    { label: "Rompere un disco", points: -2 },
    { label: "Ritardo", points: -1 },
    { label: "Meta/Lancio hammer", points: -1 },
    { label: "Meta/Lancio scober", points: -2 },
    { label: "Meta/Lancio tamber", points: -3 },
    { label: "Mancata presa volontaria", points: -2 },
    { label: "Pull fuori campo", points: -2 },
    { label: "Perdere flip casacche", points: -1 },
];

async function seedData() {
    console.log("Starting data seeding...");

    const leagues = ['winter', 'summer'];

    for (const league of leagues) {
        console.log(`\nSeeding ${league} league...`);

        // Seed rules
        console.log(`  Adding rules...`);
        for (const rule of DEFAULT_RULES) {
            await addDoc(collection(db, `league/${league}/rules`), rule);
        }
        console.log(`  ✓ Added ${DEFAULT_RULES.length} rules`);

        // Seed bonuses
        console.log(`  Adding bonuses...`);
        for (const bonus of DEFAULT_BONUS_OPTIONS) {
            await addDoc(collection(db, `league/${league}/bonusmalus`), {
                ...bonus,
                type: 'bonus'
            });
        }
        console.log(`  ✓ Added ${DEFAULT_BONUS_OPTIONS.length} bonuses`);

        // Seed maluses
        console.log(`  Adding maluses...`);
        for (const malus of DEFAULT_MALUS_OPTIONS) {
            await addDoc(collection(db, `league/${league}/bonusmalus`), {
                ...malus,
                type: 'malus'
            });
        }
        console.log(`  ✓ Added ${DEFAULT_MALUS_OPTIONS.length} maluses`);
    }

    console.log("\n✅ Data seeding completed!");
    process.exit(0);
}

seedData().catch(error => {
    console.error("Error seeding data:", error);
    process.exit(1);
});
