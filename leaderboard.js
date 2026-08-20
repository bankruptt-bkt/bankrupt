import { db, auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, query, orderBy, limit, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  listenToLeaderboard(user.uid);
});

function listenToLeaderboard(currentUid) {
  const container = document.getElementById("leaderboard-list");
  const rankDisplay = document.getElementById("user-rank");

  const q = query(collection(db, "users"), orderBy("balance", "desc"), limit(20));

  onSnapshot(q, (snapshot) => {
    container.innerHTML = "";
    let rank = 1;
    let userRankStr = "#--";

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const isUser = docSnap.id === currentUid;
      if (isUser) userRankStr = `#${rank}`;

      const rankClass = rank === 1 ? 'top-1' : rank === 2 ? 'top-2' : rank === 3 ? 'top-3' : '';
      
      container.innerHTML += `
        <div class="leaderboard-item" style="${isUser ? 'border: 1px solid var(--accent-green);' : ''}">
          <span class="rank-badge ${rankClass}">#${rank}</span>
          <div class="user-info">
            <div class="user-name">${data.username || 'Anonymous Degen'} ${isUser ? ' (You)' : ''}</div>
          </div>
          <div class="user-score">${(data.balance || 0).toFixed(2)} BKT</div>
        </div>
      `;
      rank++;
    });

    if (rankDisplay) rankDisplay.innerText = userRankStr;
  });
}
