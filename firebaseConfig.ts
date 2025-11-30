import { initializeApp, getApp, getApps, FirebaseApp } from "firebase/app";
import { getDatabase } from "firebase/database";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB0ZPykUBeEYZGv7LGYVDCtyj9uy6oNvL4",
  authDomain: "ekipsohbet-a1ef9.firebaseapp.com",
  databaseURL: "https://ekipsohbet-a1ef9-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "ekipsohbet-a1ef9",
  storageBucket: "ekipsohbet-a1ef9.appspot.com",
  messagingSenderId: "778164817469",
  appId: "1:778164817469:web:234b2e62261a888282e454",
  measurementId: "G-MXWN8VCYRS"
};

let app: FirebaseApp;

// Initialize Firebase, but only if it hasn't been initialized already.
// This prevents errors in development environments with hot-reloading.
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

// Get a reference to the database service and export it
export const database = getDatabase(app);