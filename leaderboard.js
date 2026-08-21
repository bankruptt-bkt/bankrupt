// ==========================================
// 24-HOUR SYNCHRONIZED LEADERBOARD LOGIC
// ==========================================

const FALLBACK_AVATAR = "https://api.dicebear.com/7.x/bottts/svg?seed=Bankrupt";
const LEADERBOARD_IMG_PATH = "assets/images/leaderboard/";
const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 Hours

const LOGO_MAP = {
  rank1: LEADERBOARD_IMG_PATH + "rank1.jpg",
  rank2: LEADERBOARD_IMG_PATH + "rank2.jpg",
  rank3: LEADERBOARD_IMG_PATH + "rank3.jpg",
  top10: LEADERBOARD_IMG_PATH + "top10.jpg",
  gold: LEADERBOARD_IMG_PATH + "gold.jpg",
  silver: LEADERBOARD_IMG_PATH + "silver.jpg",
  bronze: LEADERBOARD_IMG_PATH + "bronze.jpg",
  daimond: LEADERBOARD_IMG_PATH + "daimond.jpg",
  platinum: LEADERBOARD_IMG_PATH + "platinum.jpg",
  legend: LEADERBOARD_IMG_PATH + "legend.jpg"
};

let currentTab = "balance";
let leaderboardUsers = [];
let currentUserId = null;

// Safe accessor helpers to handle async loading
function getDb() {
  return window.db || (typeof firebase !== 'undefined' ? firebase.database() : null);
}

function getAuth() {
  return window.auth || (typeof firebase !== 'undefined' ? firebase.auth() : null);
}

document.addEventListener("DOMContentLoaded", () => {
  // Start checking for Firebase initialization
  startLeaderboardSync();
});

function startLeaderboardSync() {
  const dbInstance = getDb();
  const authInstance = getAuth();

  // Retry every 100ms until Firebase SDK is fully attached
  if (!dbInstance) {
    setTimeout(startLeaderboardSync, 100);
    return;
  }

  // Get current logged-in user ID
  if (authInstance) {
    authInstance.onAuthStateChanged((user) => {
      if (user) {
        currentUserId = user.uid;
        updateUserRankCard();
      }
    });
  }

  // Check local 24-hour cache first
  const lastSync = localStorage.getItem("bkt_leaderboard_last_sync");
  const cachedData = localStorage.getItem("bkt_leaderboard_data");
  const now = Date.now();

  if (cachedData && lastSync && (now - parseInt(lastSync, 10) < SYNC_INTERVAL_MS)) {
    try {
      leaderboardUsers = JSON.parse(cachedData);
      if (leaderboardUsers.length > 0) {
        renderLeaderboard();
        return;
      }
    } catch (e) {
      console.warn("Failed to parse cached leaderboard, fetching fresh data...");
    }
  }

  // Fetch directly from Firebase Realtime Database
  fetchFirebaseLeaderboard(dbInstance, now);
}

function fetchFirebaseLeaderboard(dbInstance, syncTimestamp) {
  dbInstance.ref("users").once("value").then((snapshot) => {
    const usersObj = snapshot.val() || {};

    leaderboardUsers = Object.keys(usersObj)
      .filter((uidKey) => !usersObj[uidKey].isBanned) // Exclude banned users
      .map((uidKey) => {
        const u = usersObj[uidKey];
        return {
          uid: uidKey,
          name: u.displayName || u.username || ("Miner_" + uidKey.substring(0, 5)),
          avatar: u.activeProfileLogo || u.avatar || u.photoURL || FALLBACK_AVATAR,
          balance: parseFloat(u.balance || 0),
          streak: parseInt(u.streakDays || 0, 10),
          referrals: parseInt(u.referralsUsed || 0, 10)
        };
      });

    // Save sync timestamp and dataset to localStorage
    localStorage.setItem("bkt_leaderboard_last_sync", syncTimestamp.toString());
    localStorage.setItem("bkt_leaderboard_data", JSON.stringify(leaderboardUsers));

    renderLeaderboard();
  }).catch((err) => {
    console.error("Firebase Leaderboard fetch failed:", err);
    const container = document.getElementById("leaderboard-list");
    if (container) {
      container.innerHTML = `<p class="text-center text-xs text-red-500 py-4">Failed to load rankings. Please reload.</p>`;
    }
  });
}

function switchLeaderboardTab(tab) {
  if (currentTab === tab) return;
  currentTab = tab;

  ["balance", "streak", "referrals"].forEach((t) => {
    const btn = document.getElementById(`tab-${t}`);
    if (btn) {
      btn.className = (t === tab) 
        ? "py-2 text-xs rounded-lg transition-all tab-active" 
        : "py-2 text-xs rounded-lg text-gray-400 hover:text-white transition-all font-medium";
    }
  });

  renderLeaderboard();
}

function getRankLogo(rankNumber) {
  if (rankNumber === 1) return LOGO_MAP.rank1;
  if (rankNumber === 2) return LOGO_MAP.rank2;
  if (rankNumber === 3) return LOGO_MAP.rank3;
  if (rankNumber <= 10) return LOGO_MAP.top10;
  if (rankNumber <= 50) return LOGO_MAP.legend;
  if (rankNumber <= 100) return LOGO_MAP.daimond;
  if (rankNumber <= 250) return LOGO_MAP.platinum;
  if (rankNumber <= 500) return LOGO_MAP.gold;
  if (rankNumber <= 1000) return LOGO_MAP.silver;
  return LOGO_MAP.bronze;
}

function renderLeaderboard() {
  const container = document.getElementById("leaderboard-list");
  if (!leaderboardUsers || leaderboardUsers.length === 0) {
    if (container) {
      container.innerHTML = `<p class="text-center text-xs text-gray-500 py-4">No active miners found.</p>`;
    }
    return;
  }

  // Sort by selected metric (Descending)
  const sorted = [...leaderboardUsers].sort((a, b) => b[currentTab] - a[currentTab]);

  renderPodium(sorted.slice(0, 3));
  renderList(sorted.slice(3));
  updateUserRankCard(sorted);
}

function renderPodium(top3) {
  const container = document.getElementById("podium-container");
  if (!container) return;

  container.innerHTML = "";

  const displayOrder = [
    { rank: 2, data: top3[1], border: "border-gray-400", logo: LOGO_MAP.rank2, height: "h-36" },
    { rank: 1, data: top3[0], border: "border-yellow-400", logo: LOGO_MAP.rank1, height: "h-44" },
    { rank: 3, data: top3[2], border: "border-amber-700", logo: LOGO_MAP.rank3, height: "h-36" }
  ];

  displayOrder.forEach((item) => {
    const user = item.data || { name: "Miner", avatar: FALLBACK_AVATAR, balance: 0, streak: 0, referrals: 0 };
    const rawVal = user[currentTab] || 0;

    const card = document.createElement("div");
    card.className = `card-bg rounded-2xl p-3 flex flex-col items-center justify-between text-center ${item.height} relative w-full`;

    card.innerHTML = `
      <div class="relative mt-1">
        <div class="w-14 h-14 rounded-full border-2 ${item.border} overflow-hidden bg-[#0a0d0b] flex items-center justify-center">
          <img src="${user.avatar}" alt="${user.name}" class="w-full h-full object-cover" onerror="this.src='${FALLBACK_AVATAR}';">
        </div>
        <div class="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full overflow-hidden border border-black/50 shadow-md">
          <img src="${item.logo}" alt="Rank ${item.rank}" class="w-full h-full object-cover"/>
        </div>
      </div>

      <div class="w-full truncate px-1">
        <p class="font-bold text-xs text-white truncate">${user.name}</p>
        <p class="text-xs font-black text-[#00ff66] tracking-tight mt-0.5">${formatScore(rawVal)}</p>
        <p class="text-[9px] text-gray-500 uppercase">${getTabUnit()}</p>
      </div>
    `;

    container.appendChild(card);
  });
}

function renderList(listData) {
  const container = document.getElementById("leaderboard-list");
  if (!container) return;

  if (listData.length === 0) {
    container.innerHTML = `<p class="text-center text-xs text-gray-500 py-4">No additional rankings.</p>`;
    return;
  }

  container.innerHTML = "";

  listData.forEach((user, idx) => {
    const rankNum = idx + 4;
    const badgeImg = getRankLogo(rankNum);

    const item = document.createElement("div");
    item.className = "card-bg rounded-xl p-3 flex items-center justify-between border border-[#1c2620]";

    item.innerHTML = `
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-1.5 w-10">
          <span class="font-bold text-xs text-gray-400 w-4 text-center">${rankNum}</span>
          <img src="${badgeImg}" alt="Badge" class="w-4 h-4 rounded-full object-cover border border-gray-700"/>
        </div>
        <div class="w-8 h-8 rounded-full overflow-hidden bg-[#0a0d0b] border border-gray-800">
          <img src="${user.avatar}" alt="${user.name}" class="w-full h-full object-cover" onerror="this.src='${FALLBACK_AVATAR}';">
        </div>
        <span class="font-semibold text-xs text-white truncate max-w-[120px]">${user.name}</span>
      </div>
      <div class="text-right">
        <span class="font-bold text-xs text-white">${formatScore(user[currentTab])} ${getTabUnit()}</span>
      </div>
    `;

    container.appendChild(item);
  });
}

function updateUserRankCard(sortedList = []) {
  if (!currentUserId || sortedList.length === 0) return;

  const rankIndex = sortedList.findIndex((u) => u.uid === currentUserId);
  const userObj = sortedList[rankIndex];

  const rankElem = document.getElementById("user-current-rank");
  const subtextElem = document.getElementById("user-rank-subtext");
  const scoreElem = document.getElementById("user-rank-score");
  const avatarElem = document.getElementById("user-rank-avatar");

  if (rankIndex !== -1 && userObj) {
    if (rankElem) rankElem.innerText = `#${rankIndex + 1}`;
    if (subtextElem) subtextElem.innerText = `#${rankIndex + 1} of ${sortedList.length} miners`;
    if (scoreElem) scoreElem.innerText = `${formatScore(userObj[currentTab])} ${getTabUnit()}`;
    if (avatarElem && userObj.avatar) avatarElem.src = userObj.avatar;
  }
}

function formatScore(val) {
  if (currentTab === "balance") {
    return (val || 0).toFixed(2);
  }
  return (val || 0).toString();
}

function getTabUnit() {
  if (currentTab === "balance") return "BKT";
  if (currentTab === "streak") return "Days";
  return "Invites";
}
