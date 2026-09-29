import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { initializeAuth, getAuth } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// TODO: Replace the following with your app's Firebase project configuration
// See: https://firebase.google.com/docs/web/setup#config-object
const firebaseConfig = {
    apiKey: "AIzaSyAk_DGuMw-Mh61b6v1RPl3qyBrE44chfEI",
    authDomain: "bubba-5f927.firebaseapp.com",
    projectId: "bubba-5f927",
    storageBucket: "bubba-5f927.firebasestorage.app",
    messagingSenderId: "624306533340",
    appId: "1:624306533340:web:4bdf6e95e7820ea8e5d519",
    measurementId: "G-72LP7H0W64"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

// Initialize Auth with persistence
let auth: import('firebase/auth').Auth;
if (Platform.OS === 'web') {
    auth = getAuth(app);
} else {
    // @ts-ignore: getReactNativePersistence is available in React Native but not in default types
    const { getReactNativePersistence } = (require('firebase/auth') as any);
    auth = initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage)
    });
}

export const storage = getStorage(app);
export { auth };
