/* Al-Biruni's Challenge 2026 — Firebase initialisation
   Reuses the existing MATHSIMIZED Firebase project so students keep their
   existing login identity. No page, asset or code from the MATHSIMIZED
   website is imported here. */

const ABC_FIREBASE_CONFIG = {
  apiKey: "AIzaSyBwqJ5NLVjW4hyv50lMF9Z5-Sceklczc7M",
  authDomain: "mathsimized.com",
  projectId: "mathsimized-e4ff0",
  storageBucket: "mathsimized-e4ff0.firebasestorage.app",
  messagingSenderId: "665303048442",
  appId: "1:665303048442:web:27a4e833cf0645e5582943",
  measurementId: "G-BCEZZMLBHC"
};

if (!firebase.apps.length) {
  firebase.initializeApp(ABC_FIREBASE_CONFIG);
}

window.ABC = window.ABC || {};
ABC.fb = firebase;
ABC.auth = firebase.auth();
ABC.db = firebase.firestore();
ABC.storage = firebase.storage();
ABC.server = firebase.firestore.FieldValue.serverTimestamp();

/* Roles are stored on the competition user document, not on the identity
   provider, so this app never mutates MATHSIMIZED user records. */
ABC.ROLE = {
  STUDENT: 'student',
  JUDGE: 'judge',
  ADMIN: 'admin'
};

ABC.ADMIN_EMAIL = 'mathsimized@gmail.com';

ABC.READY = new Promise((resolve) => {
  ABC.auth.onAuthStateChanged((user) => {
    ABC.user = user;
    resolve(user);
  });
});
