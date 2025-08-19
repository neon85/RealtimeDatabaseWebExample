import { initializeApp, getApps } from "firebase/app";
// import { getAnalytics } from "firebase/analytics";
import { 
  getAuth, 
  connectAuthEmulator, 
} from "firebase/auth";
import { getDatabase, connectDatabaseEmulator } from "firebase/database";

// Types
import { FirebaseApp, FirebaseOptions } from "@firebase/app";
// import { Analytics } from "@firebase/analytics";
import { Auth, User } from "@firebase/auth";
import { Database } from "@firebase/database";

import firebaseConfig from './firebase-config';

console.log('firebase.js imported');
const useEmulator = true;

let app: FirebaseApp;
let auth: Auth;
let database: Database;

if (!getApps().length) {
  console.log("[+] initializing app...");
  app = initializeApp(firebaseConfig);
  // const analytics: Analytics = getAnalytics(app);
  auth = getAuth(app);
  database = getDatabase(app);

  if (useEmulator) {
    try {
      console.log("Running emulator!!!");
      connectAuthEmulator(auth, "http://localhost:9099");
      connectDatabaseEmulator(database, "127.0.0.1", 9000);
    } catch(e) {
      console.error(e);
    }
  } else {
    console.log('[+] Running on Production Environment')
  }
}

const authStateListeners: ((arg0: User | null) => void)[] = [];

function subscribeAuthState(listener: (arg0: User | null) => void) {
  authStateListeners.push(listener);
  // return function to stop listening
  return function unsubscribe() {
    const index = authStateListeners.indexOf(listener);
    if (index > -1) {
      authStateListeners.splice(index, 1);
    }
  }
}

export {
  app,
  auth,
  useEmulator,
  database,
  subscribeAuthState,
  authStateListeners,
};