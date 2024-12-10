// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage'

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAOUFI_qiOusPnhIaN1w2r-zDb1JDnBg3k",
  authDomain: "shopify-webscraper.firebaseapp.com",
  databaseURL: "https://shopify-webscraper-default-rtdb.firebaseio.com",
  projectId: "shopify-webscraper",
  storageBucket: "shopify-webscraper.appspot.com",
  messagingSenderId: "183674215962",
  appId: "1:183674215962:web:8d6472a0533a721cb37ba3",
  measurementId: "G-1LSFHYVQ2X"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
const auth = getAuth(app);
const database = getDatabase(app);
const storage = getStorage(app)

export { auth, database, storage };
