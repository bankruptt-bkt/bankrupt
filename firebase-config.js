import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, TwitterAuthProvider } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBQT7gM7JxE26bFq061VvZauWkEGjyHPWM",
  authDomain: "bankrupt-9068b.firebaseapp.com",
  databaseURL: "https://bankrupt-9068b-default-rtdb.firebaseio.com",
  projectId: "bankrupt-9068b",
  storageBucket: "bankrupt-9068b.firebasestorage.app",
  messagingSenderId: "961644576786",
  appId: "1:961644576786:web:65eff34df07a18067458cb"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
export const twitterProvider = new TwitterAuthProvider();
