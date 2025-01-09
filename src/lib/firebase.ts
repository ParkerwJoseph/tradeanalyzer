// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBs0Fl4NXkUj6YjQsmjLURhyVRCZH1KDLs",
  authDomain: "stocx-co.firebaseapp.com",
  databaseURL: "https://stocx-co-default-rtdb.firebaseio.com",
  projectId: "stocx-co",
  storageBucket: "stocx-co.firebasestorage.app",
  messagingSenderId: "549556759580",
  appId: "1:549556759580:web:91848001343e8862a1c3d9",
  measurementId: "G-JSN9R8LET5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
const database = getDatabase(app);
const auth = getAuth(app);

export { app, analytics, database, auth };
