// ============================================================================
// FIREBASE CONFIG
// Ganti nilai di bawah dengan config project Firebase kamu sendiri.
// Project Settings → General → "Your apps" → SDK setup and configuration.
// ============================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCiWn9bQ0nlMNHM8_4JOr_7_ACIb_kTfM8",
  authDomain: "trackkeeping-9e422.firebaseapp.com",
  projectId: "trackkeeping-9e422",
  storageBucket: "trackkeeping-9e422.firebasestorage.app",
  messagingSenderId: "880665369101",
  appId: "1:880665369101:web:9a9a191a4e7bca21f59344"
};

const app = initializeApp(firebaseConfig);

// Firestore with:
// - persistentLocalCache (IndexedDB): repeat visits render instantly from
//   local cache while the fresh snapshot streams in behind it, instead of
//   showing a blank grid until the network round-trip finishes.
// - experimentalAutoDetectLongPolling: some networks/proxies (common on
//   mobile carriers or restrictive Wi-Fi) stall or slow-handshake Firestore's
//   default WebChannel transport. Auto-detection falls back to long-polling
//   only when needed, which removes a big chunk of the first-load stall.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentSingleTabManager({}) }),
  experimentalAutoDetectLongPolling: true,
});

// Name of the Firestore collection used for daily records.
export const COLLECTION = "trackkeeping_days";
export const NOTES_COLLECTION = "trackkeeping_notes";
