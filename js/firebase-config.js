// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCXo-IiffwYIlFhWMJjoJYlgWKMuxt6J20",
  authDomain: "cyber-slavery-arrest-map-b1a8b.firebaseapp.com",
  projectId: "cyber-slavery-arrest-map-b1a8b",
  storageBucket: "cyber-slavery-arrest-map-b1a8b.firebasestorage.app",
  messagingSenderId: "321898068802",
  appId: "1:321898068802:web:8457b9604cdbb745c126db"
};

let app = null;
let db = null;
let auth = null;

function initializeFirebase() {
  if (app) return;

  try {
    app = firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    auth = firebase.auth();
    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
  } catch (error) {
    // Silent fail
  }
}

function getFirestore() {
  return db;
}

function getAuth() {
  return auth;
}
