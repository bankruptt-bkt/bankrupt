import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Firebase Configuration (Same as tasks.js)
const firebaseConfig = {
  // Your Firebase config settings here
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function loadLeaderboard() {
  const container = document.getElementById("leaderboard-list");
  
  try {
    // Fetch top 20 users by balance
    const q = query(collection(db, "users"), orderBy("balance", "desc"), limit(20));
    const querySnapshot = await getDocs(q);
    
    container.innerHTML = "";
    let rank = 1;

    querySnapshot.forEach((doc) => {
      const user = doc.data();
      const rankClass = rank === 1 ? 'top-1' : rank === 2 ? 'top-2' : rank === 3 ? 'top-3' : '';
      
      const itemHTML = `
        <div class="leaderboard-item">
          <span class="rank-badge ${rankClass}">#${rank}</span>
          <div class="user-info">
            <div class="user-name">${user.username || 'Anonymous Degen'}</div>
          </div>
          <div class="user-score">${(user.balance || 0).toFixed(2)} BKT</div>
        </div>
      `;
      
      container.innerHTML += itemHTML;
      rank++;
    });

  } catch (error) {
    console.error("Error loading leaderboard:", error);
    container.innerHTML = `<div style="color: red; text-align: center;">Failed to load rankings.</div>`;
  }
}

loadLeaderboard();
