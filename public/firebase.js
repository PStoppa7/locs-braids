// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";


const firebaseConfig = {
  apiKey: "AIzaSyDrkktxSv3jJB0daVEb9I_c5LTNuusnKpQ",
  authDomain: "remo-8f3d8.firebaseapp.com",
  projectId: "remo-8f3d8",
  storageBucket: "remo-8f3d8.firebasestorage.app",
  messagingSenderId: "1037644495128",
  appId: "1:1037644495128:web:26429708bebab9cfe8c66d",
  measurementId: "G-REZMJTQMXV"
};


const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };