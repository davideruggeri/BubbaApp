// One-time script to migrate league settings to 'impostazione' collection
// Run with: node migrateLeagueSettings.js

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, setDoc, getDoc } = require('firebase/firestore');

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

async function migrateData() {
    console.log("Starting migration...");

    const leagues = ['winter', 'summer'];

    for (const league of leagues) {
        console.log(`\nMigrating ${league} league...`);

        // 1. Migrate Dates
        console.log(`  Migrating Dates...`);
        // Old path: league/{league}/dates (it was likely a collection with one doc or a specific doc structure, 
        // but based on previous code it seemed to be a doc 'dates' in 'league/{league}' or similar.
        // Actually, looking at previous code, subscribeToLeagueDates used: doc(db, 'league', leagueType, 'dates', 'current')
        // Let's check if that exists.
        try {
            const oldDatesRef = doc(db, 'league', league, 'dates', 'current');
            const oldDatesSnap = await getDoc(oldDatesRef);

            if (oldDatesSnap.exists()) {
                const datesData = oldDatesSnap.data();
                const newDatesRef = doc(db, 'impostazione', `League_${league}_Dates`);
                await setDoc(newDatesRef, datesData);
                console.log(`  ✓ Dates migrated.`);
            } else {
                console.log(`  - No dates found in old path.`);
            }
        } catch (e) {
            console.error(`  x Error migrating dates:`, e);
        }

        // 2. Migrate Rules
        console.log(`  Migrating Rules...`);
        try {
            const oldRulesRef = collection(db, 'league', league, 'rules');
            const oldRulesSnap = await getDocs(oldRulesRef);

            if (!oldRulesSnap.empty) {
                const rules = oldRulesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                // Sort by order if available
                rules.sort((a, b) => (a.order || 0) - (b.order || 0));

                // Map to new structure (ensure fields match LeagueRule type)
                const cleanRules = rules.map(r => ({
                    id: r.id,
                    title: r.title || r.text || '', // Handle potential field name diffs
                    description: r.description || r.text || '', // 'text' was used in seed script
                    order: r.order || 0
                }));

                // If description is empty but title is not, maybe title was used as text?
                // In seed script: { text: "...", order: 1 }
                // So 'text' maps to 'description'. Title might be missing.
                // Let's fix that mapping.
                const finalRules = cleanRules.map(r => {
                    if (!r.title && r.description) {
                        // Use first few words as title or generic
                        return { ...r, title: "Regola", description: r.description };
                    }
                    return r;
                });

                const newRulesRef = doc(db, 'impostazione', `League_${league}_Rules`);
                await setDoc(newRulesRef, { values: finalRules });
                console.log(`  ✓ ${finalRules.length} rules migrated.`);
            } else {
                console.log(`  - No rules found in old path.`);
            }
        } catch (e) {
            console.error(`  x Error migrating rules:`, e);
        }

        // 3. Migrate Bonus Definitions
        console.log(`  Migrating Bonus Definitions...`);
        try {
            const oldBonusRef = collection(db, 'league', league, 'bonusmalus');
            const oldBonusSnap = await getDocs(oldBonusRef);

            if (!oldBonusSnap.empty) {
                const bonuses = oldBonusSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                // Sort by points desc
                bonuses.sort((a, b) => b.points - a.points);

                const cleanBonuses = bonuses.map(b => ({
                    id: b.id,
                    label: b.label,
                    points: b.points,
                    type: b.type || (b.points >= 0 ? 'bonus' : 'malus')
                }));

                const newBonusRef = doc(db, 'impostazione', `League_${league}_BonusDefinitions`);
                await setDoc(newBonusRef, { values: cleanBonuses });
                console.log(`  ✓ ${cleanBonuses.length} bonus definitions migrated.`);
            } else {
                console.log(`  - No bonus definitions found in old path.`);
            }
        } catch (e) {
            console.error(`  x Error migrating bonus definitions:`, e);
        }
    }

    console.log("\n✅ Migration completed!");
    process.exit(0);
}

migrateData().catch(error => {
    console.error("Error migrating data:", error);
    process.exit(1);
});
