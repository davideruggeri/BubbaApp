# BubbaApp 🥏

App gestionale per **Bubba**, squadra di Ultimate Frisbee di Brescia.
La squadra la usa per organizzare allenamenti, tornei e presenze e per raccogliere le statistiche delle partite in tempo reale.

Sviluppata con **React Native + Expo** e **Firebase**. È pubblicata come **PWA** su Firebase Hosting, quindi i compagni la usano dal browser del telefono senza installare nulla.

<p align="center">
  <img width="160" alt="Home" src="https://github.com/user-attachments/assets/c100521f-bfec-4405-8703-a2033a083e0b" />
  <img width="160" alt="Calendario" src="https://github.com/user-attachments/assets/b342e9ef-e93e-4f54-a07d-6a776bceae9d" />
  <img width="160" alt="Presenze" src="https://github.com/user-attachments/assets/ba07d321-b883-4106-b274-5a164944e4bb" />
  <img width="160" alt="Analisi partita" src="https://github.com/user-attachments/assets/ec1bce2f-fbb5-4960-ae5c-4f5d4938fece" />
  <img width="160" alt="Statistiche partita" src="https://github.com/user-attachments/assets/438369ee-2dcd-453e-a353-70667a39f1b4" />
</p>



## Funzionalità principali

**Partite e statistiche**
- **Live match**: registrazione punto per punto durante la partita (linee in campo, pull, passaggi, mete, turnover) con tabellone e sostituzioni.
- **Statistiche** per giocatore e di squadra: KPI, andamento del punteggio, mappe dei pull e dei turnover sul campo.
- **Analisi partite e tornei**: import da backup JSON o Excel ed **export in Excel (.xlsx)**.

**Gestione della squadra**
- **Calendario** di allenamenti, tornei ed eventi.
- **Presenze** con storico e classifica.
- **Roster** dei tornei e **indirizzario** dei membri.
- **Spese** della squadra.

**Engagement**
- **Hat League** interna con bonus/malus, classifica e storico delle stagioni.
- **Hall of Fame** e badge.
- **Bubba Wrapped**: riepilogo personale e di squadra di fine stagione.
- **BubbaWorld**: mappa dei tornei e delle trasferte con foto.

**Strumenti per l'allenamento**
- Interval timer e random timer.
- Lavagna tattica.

**Account e ruoli**
- Accesso con email/password.
- Tre livelli di permesso (utente base, staff, amministratore), applicati sia nell'interfaccia sia nelle **regole di sicurezza Firestore e Storage**.
- Tema chiaro/scuro (più un tema natalizio 🎄).

## Stack tecnico

| Area | Tecnologie |
|---|---|
| App | React Native, Expo, TypeScript |
| Navigazione | React Navigation (bottom tabs + stack) |
| Backend | Firebase Authentication, Cloud Firestore, Cloud Storage |
| Deploy | Expo web export → PWA su Firebase Hosting |
| Grafici e campo | react-native-svg |
| Mappe | Leaflet / react-leaflet |
| Export dati | SheetJS (xlsx) |

## Struttura del progetto

```
screens/      Schermate principali (Home, Calendario, Live match, Lega, ...)
components/   Componenti divisi per funzionalità, ognuno con hook, tipi e stili
              (es. liveMatch/, calendar/, league/, field/, attendance/)
services/     Accesso a Firestore, un modulo per ogni dominio
context/      Stato globale: autenticazione e ruoli, stagione, tema
utils/        Motore delle statistiche, import/export partite, date, geocoding
scripts/      Script di supporto (PWA, Bubba Wrapped, migrazioni dati)
firestore.rules / storage.rules   Regole di sicurezza del backend
```

## Avvio in locale

Requisiti: Node.js e un progetto Firebase con Authentication (email/password), Firestore e Storage attivi.

```bash
npm install
# inserisci la configurazione del tuo progetto Firebase in firebaseConfig.ts
npx expo start        # poi premi "w" per il web, oppure apri con Expo Go
```

Pubblicazione web (build, manifest PWA e deploy su Firebase):

```bash
npx expo export --platform web
node scripts/inject-pwa.js
npx firebase deploy
```

## Autore

**Davide Ruggeri**, studente di Ingegneria Informatica all'Università degli Studi di Brescia.
