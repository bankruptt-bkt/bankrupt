import { db } from "./conf.js";
import { collection, query, orderBy, limit, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const currentUsername = "Probhat";

function listenToLeaderboard() {
  const container = document.getElementById("leaderboard-list");
  const rankDisplay = document.getElementById("user-rank");
  
  const q = query(collection(db, "users"), orderBy("balance", "desc"), limit(20));

  onSnapshot(q, (snapshot) => {
    container.innerHTML = "";
    let rank = 1;
    let foundUserRank = null;

    snapshot.forEach((doc) => {
      const user = doc.data();
      const isCurrentUser = user.username === currentUsername;

      if (isCurrentUser) foundUserRank = rank;

      const rankClass = rank === 1 ? 'top-1' : rank === 2 ? 'top-2' : rank === 3 ? 'top-3' : '';
      
      container.innerHTML += `
        <div class="leaderboard-item" style="${isCurrentUser ? 'border: 1px solid var(--accent-green);' : ''}">
          <span class="rank-badge ${rankClass}">#${rank}</span>
          <div class="user-info">
            <div class="user-name">${user.username || 'Anonymous Degen'} ${isCurrentUser ? ' (You)' : ''}</div>
          </div>
          <div class="user-score">${(user.balance || 0).toFixed(2)} BKT</div>
        </div>
      `;
      rank++;
    });

    if (rankDisplay) rankDisplay.innerText = foundUserRank ? `#${foundUserRank}` : "#--";
  }, (error) => {
    console.error("Leaderboard error:", error);
    container.innerHTML = `<div style="color: #ff4d4d; text-align: center;">Failed to load leaderboard.</div>`;
  });
}

listenToLeaderboard();
