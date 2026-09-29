/* Al-Biruni's Challenge 2026 — Firebase initialisation
   Reuses the existing MATHSIMIZED Firebase project so students keep their
   existing login identity. No page, asset or code from the MATHSIMIZED
   website is imported here.

   There is no Cloud Storage here on purpose. Cloud Storage for Firebase
   requires the Blaze plan from 3 February 2026, and this project stays on the
   free Spark plan, so a bucket would answer every call with a 402. Certificate
   files therefore live in Firestore as a data URI, or as a link the organiser
   pastes in. */

const ABC_FIREBASE_CONFIG = {
  apiKey: "AIzaSyBwqJ5NLVjW4hyv50lMF9Z5-Sceklczc7M",
  authDomain: "mathsimized.com",
  projectId: "mathsimized-e4ff0",
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
