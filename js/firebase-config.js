/* Al-Biruni\'s Challenge 2026 — Firebase initialisation
   This is its own Firebase project. It shares nothing with the MATHSIMIZED
   website: separate accounts, separate Firestore, separate rules. The MATHSIMIZED
   site is not modified in any way, and nothing here reads or writes its data.
   The two are announced side by side and students are created here, in the
   competition\'s own account system.

   The account only exists to take part in this competition, so a username is
   how a student is known. It is reserved at signup and is permanent.

   There is no Cloud Storage here on purpose. Cloud Storage for Firebase
   requires the Blaze plan from 3 February 2026, and this project stays on the
   free Spark plan, so a bucket would answer every call with a 402. Certificate
   files therefore live in Firestore as a data URI, or as a link the team
   pastes in. */

const ABC_FIREBASE_CONFIG = {
  apiKey: "AIzaSyAKdiCxHaBXcGlS-B2nocvMxdHI3gpkLIo",
  authDomain: "al-birunis-challenge.firebaseapp.com",
  projectId: "al-birunis-challenge",
  messagingSenderId: "158585095791",
  appId: "1:158585095791:web:9e0a5586da5e6a343fef9a",
  measurementId: "G-9YBTK7S9YB"
};

if (!firebase.apps.length) {
  firebase.initializeApp(ABC_FIREBASE_CONFIG);
}

window.ABC = window.ABC || {};
ABC.fb = firebase;
ABC.auth = firebase.auth();
ABC.db = firebase.firestore();
ABC.server = firebase.firestore.FieldValue.serverTimestamp();

/* Roles are stored on this site's own user document. Nothing is read from or
   written to any other project. */
/* There is no judge role. Round 2 is judged off the platform, so the only
   roles that exist are a student and an admin. */
ABC.ROLE = {
  STUDENT: 'student',
  ADMIN: 'admin'
};

/* One address opens the panel. This is compared in three places that must
   agree: here, in js/repo.js, and in firestore.rules. */
ABC.ADMIN_EMAIL = 'mathsimized@gmail.com';

ABC.READY = new Promise((resolve) => {
  ABC.auth.onAuthStateChanged((user) => {
    ABC.user = user;
    resolve(user);
  });
});
