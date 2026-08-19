import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
  getFirestore, 
  doc, 
  onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Firebase Config
const firebaseConfig = {
  // Your Firebase configuration object here
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const currentUsername = "Probhat"; // Active User Document ID

function loadUserProfile() {
  const handleElem = document.getElementById("profile-handle");
  const balanceElem = document.getElementById("profile-balance");
  const tasksElem = document.getElementById("profile-tasks-count");

  const userRef = doc(db, "users", currentUsername);

  // Real-time updates when tasks are completed elsewhere
  onSnapshot(userRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();

      handleElem.innerText = `@${data.username || currentUsername}`;
      balanceElem.innerText = `${(data.balance || 0).toFixed(4)} BKT`;
      
      const completedList = data.completedTasks || [];
      tasksElem.innerText = `${completedList.length} Tasks`;
    } else {
      console.log("User profile not found in Firestore!");
    }
  });
}

loadUserProfile();
