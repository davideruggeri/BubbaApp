// One-time migration script to backfill 'stagione' field in presenze, calendario, and match_analysis
// Run with: node migrateSeasons.js [admin_email] [admin_password]

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, setDoc, getDoc, writeBatch } = require('firebase/firestore');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');

const firebaseConfig = {
    apiKey: "AIzaSyAk_DGuMw-Mh61b6v1RPl3qyBrE44chfEI",
    authDomain: "bubba-5f927.firebaseapp.com",
    projectId: "bubba-5f927",
    storageBucket: "bubba-5f927.firebasestorage.app",
    messagingSenderId: "624306533340",
    appId: "1:624306533340:web:4bdf6e95e7820ea8e5d519",
    measurementId: "G-72LP7H0W64"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function getStagioneFromDate(dateStr) {
    if (!dateStr) {
        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth() + 1;
        return m >= 9 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
    }
    const cleanDate = dateStr.split('T')[0];
    const parts = cleanDate.split('-');
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
}

async function migrateCollection(collectionName, getDateFn) {
    console.log(`\n--- Migrazione collezione: ${collectionName} ---`);
    const snap = await getDocs(collection(db, collectionName));
    console.log(`Trovati ${snap.size} documenti in '${collectionName}'.`);

    let batch = writeBatch(db);
    let opCount = 0;
    let updatedCount = 0;

    for (const docSnap of snap.docs) {
        const data = docSnap.data();
        const date = getDateFn(data, docSnap.id);
        const stagione = getStagioneFromDate(date);

        if (data.stagione !== stagione) {
            batch.update(docSnap.ref, { stagione });
            opCount++;
            updatedCount++;

            if (opCount >= 400) {
                await batch.commit();
                batch = writeBatch(db);
                opCount = 0;
                console.log(`  Aggiornati ${updatedCount}/${snap.size}...`);
            }
        }
    }

    if (opCount > 0) {
        await batch.commit();
    }

    console.log(`✓ Collezione '${collectionName}' completata: ${updatedCount} documenti aggiornati su ${snap.size}.`);
}

function getSeasonStartDate(season) {
    const parts = season.split('-');
    if (parts.length >= 1) {
        const startYear = parseInt(parts[0], 10);
        if (!isNaN(startYear)) {
            return new Date(startYear, 8, 1, 0, 0, 0, 0); // 1 Settembre ore 00:00:00
        }
    }
    const y = new Date().getFullYear();
    return new Date(y, 8, 1, 0, 0, 0, 0);
}

async function initStagioneCorrente() {
    console.log(`\n--- Verifica singleton impostazione/stagione_corrente ---`);
    const seasonRef = doc(db, 'impostazione', 'stagione_corrente');
    const snap = await getDoc(seasonRef);

    if (!snap.exists()) {
        const currentSeason = getStagioneFromDate(new Date().toISOString());
        await setDoc(seasonRef, {
            stagioneCorrente: currentSeason,
            dataInizio: getSeasonStartDate(currentSeason),
            dataFine: null
        });
        console.log(`✓ Inizializzato 'impostazione/stagione_corrente' con valore: ${currentSeason} (dataInizio: 1 Settembre)`);
    } else {
        console.log(`- 'impostazione/stagione_corrente' già presente: ${snap.data().stagioneCorrente}`);
    }
}

async function run() {
    console.log("Inizio procedura di migrazione stagioni...");

    const email = process.argv[2];
    const password = process.argv[3];

    if (email && password) {
        console.log(`Autenticazione in corso come ${email}...`);
        try {
            const auth = getAuth(app);
            await signInWithEmailAndPassword(auth, email, password);
            console.log("✓ Autenticazione riuscita.");
        } catch (authErr) {
            console.error("❌ Errore di autenticazione:", authErr.message);
            process.exit(1);
        }
    } else {
        console.log("ℹ️ Nessuna credenziale passata. Se ricevi PERMISSION_DENIED esegui:\n   node migrateSeasons.js <email_admin> <password_admin>\noppure usa il pulsante 'Migra Dati Storici' in Impostazioni nell'app.");
    }

    try {
        // 1. Presenze
        await migrateCollection('presenze', (data, id) => data.date || id.split('_')[0]);

        // 2. Calendario
        await migrateCollection('calendario', (data, id) => data.date || id);

        // 3. Match Analysis
        await migrateCollection('match_analysis', (data) => data.date);

        // 4. Singleton stagione corrente
        await initStagioneCorrente();

        console.log("\n🎉 Migrazione completata con successo!");
        process.exit(0);
    } catch (error) {
        console.error("\n❌ Errore durante la migrazione:", error);
        process.exit(1);
    }
}

run();
