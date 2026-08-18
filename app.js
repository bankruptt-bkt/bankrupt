// Bankrupt Core Script
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, get, child } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "bankrupt.firebaseapp.com",
  databaseURL: "https://bankrupt-default-rtdb.firebaseio.com",
  projectId: "bankrupt",
  storageBucket: "bankrupt.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

console.log("Bankrupt engine initialized successfully!");
