import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// Segunda instância do Firebase — exclusiva para auth de membros.
// Usa o mesmo projeto mas auth completamente separado do admin.
const firebaseConfig = {
  apiKey:            process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain:        process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.REACT_APP_FIREBASE_APP_ID,
};

// Evita duplicar se já existir (hot reload)
const memberApp = getApps().find(a => a.name === 'member')
  || initializeApp(firebaseConfig, 'member');

export const memberAuth = getAuth(memberApp);
