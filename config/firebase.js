import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
    apiKey: "AIzaSyATPsgrZNbZqYOebABp_-_dbBNFRKO9sds",
    authDomain: "bananaxchat.firebaseapp.com",
    projectId: "bananaxchat",
    storageBucket: "bananaxchat.firebasestorage.app",
    messagingSenderId: "634058545725",
    appId: "1:634058545725:web:efe86ee63780433e346854",
    databaseURL: "https://bananaxchat-default-rtdb.asia-southeast1.firebasedatabase.app",
};

const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
});

export const db = getFirestore(app);
export const rtdb = getDatabase(app);

export default app;
