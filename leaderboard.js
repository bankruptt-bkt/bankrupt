import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, query, orderBy, limit, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Insert your Firebase configuration settings here
const firebaseConfig = {
  // your config
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const currentUsername = "Probhat";

function listenToLeaderboard() {
  const container = document.getElementById("leaderboard-list");
  const rankDisplay = document.getElementById("user-rank");
  
  // Create query for top 20 users sorted by balance
  const q = query(collection(db, "users"), orderBy("balance", "desc"), limit(20));

  // onSnapshot automatically triggers every time a balance updates in Firestore
  onSnapshot(q, (snapshot) => {
    container.innerHTML = "";
    let rank = 1;
    let foundUserRank = null;

    snapshot.forEach((doc) => {
      const user = doc.data();
      const isCurrentUser = user.username === currentUsername;

      if (isCurrentUser) {
        foundUserRank = rank;
      }

      const rankClass = rank === 1 ? 'top-1' : rank === 2 ? 'top-2' : rank === 3 ? 'top-3' : '';
      
      const itemHTML = `
        <div class="leaderboard-item" style="${isCurrentUser ? 'border: 1px solid var(--accent-green);' : ''}">
          <span class="rank-badge ${rankClass}">#${rank}</span>
          <div class="user-info">
            <div class="user-name">${user.username || 'Anonymous Degen'} ${isCurrentUser ? ' (You)' : ''}</div>
          </div>
          <div class="user-score">${(user.balance || 0).toFixed(2)} BKT</div>
        </div>
      `;
      
      container.innerHTML += itemHTML;
      rank++;
    });

    rankDisplay.innerText = foundUserRank ? `#${foundUserRank}` : "#--";
  }, (error) => {
    console.error("Error listening to leaderboard updates:", error);
    container.innerHTML = `<div style="color: red; text-align: center;">Failed to sync rankings automatically.</div>`;
  });
}

listenToLeaderboard();
