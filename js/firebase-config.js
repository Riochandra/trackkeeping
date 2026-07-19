// ============================================================================
// FIREBASE CONFIG
// Ganti nilai di bawah dengan config project Firebase kamu sendiri.
// Project Settings → General → "Your apps" → SDK setup and configuration.
// ============================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCiWn9bQ0nlMNHM8_4JOr_7_ACIb_kTfM8",
  authDomain: "trackkeeping-9e422.firebaseapp.com",
  projectId: "trackkeeping-9e422",
  storageBucket: "trackkeeping-9e422.firebasestorage.app",
  messagingSenderId: "880665369101",
  appId: "1:880665369101:web:9a9a191a4e7bca21f59344"
};

const app = initializeApp(firebaseConfig);

// Firestore with offline cache disabled by default for simplicity & speed;
// switch to initializeFirestore with persistence if you want offline support.
export const db = getFirestore(app);

// Name of the Firestore collection used for daily records.
export const COLLECTION = "trackkeeping_days";
export const NOTES_COLLECTION = "trackkeeping_notes";
