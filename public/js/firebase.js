import { initializeApp } from
  "https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyC98LDXD4nw3EHZUXyC-79wpGjYnuR8bkU",
  authDomain: "ip-baba-jarvis.firebaseapp.com",
  projectId: "ip-baba-jarvis",
  storageBucket: "ip-baba-jarvis.firebasestorage.app",
  messagingSenderId: "5302091196",
  appId: "1:5302091196:web:85bd72aeaa5c3246033fb9"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const googleProvider = new GoogleAuthProvider();

export {
  auth,
  googleProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
};
