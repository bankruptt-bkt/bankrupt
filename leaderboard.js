// ==========================================
// LEADERBOARD LOGIC (DYNAMIC LOGO MAPPING & REALTIME RANK)
// ==========================================

const FALLBACK_AVATAR = "https://api.dicebear.com/7.x/bottts/svg?seed=Bankrupt";
const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 Hours in milliseconds

// LEADERBOARD DIRECTORY ASSETS
const LEADERBOARD_IMG_PATH = "assets/images/leaderboard/";
const LOGO_MAP = {
  rank1: LEADERBOARD_IMG_PATH + "rank1.jpg",
  rank2: LEADERBOARD_IMG_PATH + "rank2.jpg",
  rank3: LEADERBOARD_IMG_PATH + "rank3.jpg",
  top10: LEADERBOARD_IMG_PATH + "top10.jpg",
  bkt_og: LEADERBOARD_IMG_PATH + "bkt_og.jpg",
  gold: LEADERBOARD_IMG_PATH + "gold.jpg",
  silver: LEADERBOARD_IMG_PATH + "silver.jpg",
  bronze: LEADERBOARD_IMG_PATH + "bronze.jpg",
  daimond: LEADERBOARD_IMG_PATH + "daimond.jpg",
  platinum: LEADERBOARD_IMG_PATH + "platinum.jpg",
  elite: LEADERBOARD_IMG_PATH + "elite.jpg",
  legend: LEADERBOARD_IMG_PATH + "legend.jpg"
};

let currentTab = "balance"; // "balance" | "streak" | "referrals"
let cachedLeaderboardData = [];
let currentUserId = null;

document.addEventListener("DOMContentLoaded", async () => {
  // Load leaderboard immediately so data displays right away
  await loadOrSyncLeaderboard();
  renderLeaderboard();

  // Listen for user auth state to link "YOU" card
  try {
    const authInstance = getAuth();
    if (authInstance) {
      authInstance.onAuthStateChanged((user) => {
        if (user) {
          currentUserId = user.uid;
          listenToUserRealtimeData(user.uid);
          updateUserRankCard(cachedLeaderboardData);
        }
      });
    }
  } catch(e) {
    console.warn("Auth initialization pending...", e);
  }
});

// Helper to determine which rank image/badge to display for a user
function getLeaderboardBadge(rankNumber, userTierKey) {
  if (rankNumber === 1) return LOGO_MAP.rank1;
  if (rankNumber === 2) return LOGO_MAP.rank2;
  if (rankNumber === 3) return LOGO_MAP.rank3;
  if (rankNumber <= 10) return LOGO_MAP.top10;
  
  if (userTierKey && LOGO_MAP[userTierKey]) {
    return LOGO_MAP[userTierKey];
  }

  if (rankNumber <= 50) return LOGO_MAP.legend;
  if (rankNumber <= 100) return LOGO_MAP.daimond;
  if (rankNumber <= 250) return LOGO_MAP.platinum;
  if (rankNumber <= 500) return LOGO_MAP.gold;
  if (rankNumber <= 1000) return LOGO_MAP.silver;
  return LOGO_MAP.bronze;
}

// 24-Hour Synchronization & Caching Engine
async function loadOrSyncLeaderboard() {
  const dbInstance = typeof getDb === "function" ? getDb() : (window.db || null);
  if (!dbInstance) {
    console.error("Firebase DB instance not ready.");
    return;
  }

  const localCache = localStorage.getItem("bkt_leaderboard_cache");
  const lastSyncTime = localStorage.getItem("bkt_leaderboard_last_sync");
  const now = Date.now();

  if (localCache && lastSyncTime && (now - parseInt(lastSyncTime, 10) < SYNC_INTERVAL_MS)) {
    try {
      cachedLeaderboardData = JSON.parse(localCache);
      if (cachedLeaderboardData.length > 0) return;
    } catch (e) {
      console.warn("Failed to parse local leaderboard cache, re-fetching...");
    }
  }

  try {
    const snap = await dbInstance.ref("users").once("value");
    const usersObj = snap.val() || {};
    
    const userList = Object.keys(usersObj).map((uidKey) => {
      const u = usersObj[uidKey];
      return {
        uid: uidKey,
        name: u.displayName || ("Miner_" + uidKey.substring(0, 5)),
        avatar: u.activeProfileLogo || "assets/images/profile/rookie.jpg",
        tier: u.userTier || null,
        balance: parseFloat(u.balance || 0),
        streak: parseInt(u.streakDays || 0, 10),
        referrals: parseInt(u.referralsUsed || 0, 10)
      };
    });

    cachedLeaderboardData = userList;
    localStorage.setItem("bkt_leaderboard_cache", JSON.stringify(userList));
    localStorage.setItem("bkt_leaderboard_last_sync", now.toString());
  } catch (err) {
    console.error("Leaderboard synchronization error:", err);
  }
}

// Tab Switcher Handler
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

// Render Podium & Ranked List
function renderLeaderboard() {
  const sorted = [...cachedLeaderboardData].sort((a, b) => b[currentTab] - a[currentTab]);

  renderPodium(sorted.slice(0, 3));
  renderList(sorted.slice(3));
  updateUserRankCard(sorted);
}

// Render Top 3 Podium Cards
function renderPodium(top3) {
  const container = document.getElementById("podium-container");
  if (!container) return;

  container.innerHTML = "";

  const displayOrder = [
    { rank: 2, data: top3[1], border: "border-gray-400", logo: LOGO_MAP.rank2, height: "h-36" },
    { rank: 1, data: top3[0], border: "border-yellow-400", logo: LOGO_MAP.rank1, height: "h-44", isCrown: true },
    { rank: 3, data: top3[2], border: "border-amber-700", logo: LOGO_MAP.rank3, height: "h-36" }
  ];

  displayOrder.forEach((item) => {
    const user = item.data || { name: "N/A", avatar: "", [currentTab]: 0 };
    const valueFormatted = formatTabScore(user[currentTab]);

    const card = document.createElement("div");
    card.className = `card-bg rounded-2xl p-3 flex flex-col items-center justify-between text-center ${item.height} relative`;

    card.innerHTML = `
      <div class="relative mt-1">
        <div class="w-14 h-14 rounded-full border-2 ${item.border} overflow-hidden bg-[#0a0d0b] flex items-center justify-center">
          <img src="${user.avatar || 'assets/images/profile/rookie.jpg'}" alt="${user.name}" class="w-full h-full object-cover" onerror="this.onerror=null; this.src='${FALLBACK_AVATAR}';">
        </div>
        <div class="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full overflow-hidden border border-black/50 shadow-md">
          <img src="${item.logo}" alt="Rank ${item.rank}" class="w-full h-full object-cover"/>
        </div>
      </div>

      <div class="w-full truncate px-1">
        <p class="font-bold text-xs text-white truncate">${user.name}</p>
        <p class="text-xs font-black text-[#00ff66] tracking-tight mt-0.5">${valueFormatted}</p>
        <p class="text-[9px] text-gray-500 uppercase">${getTabUnit()}</p>
      </div>
    `;

    container.appendChild(card);
  });
}

// Render Rankings 4 and onwards
function renderList(listData) {
  const container = document.getElementById("leaderboard-list");
  if (!container) return;

  if (listData.length === 0) {
    container.innerHTML = `<p class="text-center text-xs text-gray-500 py-4">No additional rankings available.</p>`;
    return;
  }

  container.innerHTML = "";

  listData.forEach((user, idx) => {
    const rankNum = idx + 4;
    const badgeImg = getLeaderboardBadge(rankNum, user.tier);

    const item = document.createElement("div");
    item.className = "card-bg rounded-xl p-3 flex items-center justify-between border border-[#1c2620]";

    item.innerHTML = `
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-1.5 w-10">
          <span class="font-bold text-xs text-gray-400 w-4 text-center">${rankNum}</span>
          <img src="${badgeImg}" alt="Badge" class="w-4 h-4 rounded-full object-cover border border-gray-700"/>
        </div>
        <div class="w-8 h-8 rounded-full overflow-hidden bg-[#0a0d0b] border border-gray-800">
          <img src="${user.avatar || 'assets/images/profile/rookie.jpg'}" alt="${user.name}" class="w-full h-full object-cover" onerror="this.onerror=null; this.src='${FALLBACK_AVATAR}';">
        </div>
        <span class="font-semibold text-xs text-white truncate max-w-[120px]">${user.name}</span>
      </div>
      <div class="text-right">
        <span class="font-bold text-xs text-white">${formatTabScore(user[currentTab])} ${getTabUnit()}</span>
      </div>
    `;

    container.appendChild(item);
  });
}

// Update Fixed Bottom User Rank Card
function updateUserRankCard(sortedList) {
  if (!currentUserId || !sortedList.length) return;

  const rankIndex = sortedList.findIndex((u) => u.uid === currentUserId);
  const userObj = sortedList[rankIndex];

  const rankElem = document.getElementById("user-current-rank");
  const subtextElem = document.getElementById("user-rank-subtext");
  const scoreElem = document.getElementById("user-rank-score");
  const avatarElem = document.getElementById("user-rank-avatar");

  if (rankIndex !== -1 && userObj) {
    if (rankElem) rankElem.innerText = `#${rankIndex + 1}`;
    if (subtextElem) subtextElem.innerText = `#${(rankIndex + 1).toLocaleString()} of ${sortedList.length.toLocaleString()} miners`;
    if (scoreElem) scoreElem.innerText = `${formatTabScore(userObj[currentTab])} ${getTabUnit()}`;
    if (avatarElem && userObj.avatar) avatarElem.src = userObj.avatar;
  } else {
    if (rankElem) rankElem.innerText = "#-";
    if (subtextElem) subtextElem.innerText = "Unranked";
  }
}

// Real-time update listener for current user
function listenToUserRealtimeData(uid) {
  const dbInstance = typeof getDb === "function" ? getDb() : (window.db || null);
  if (!dbInstance) return;

  dbInstance.ref("users/" + uid).on("value", (snap) => {
    const data = snap.val() || {};
    
    const existingIndex = cachedLeaderboardData.findIndex((u) => u.uid === uid);
    if (existingIndex !== -1) {
      cachedLeaderboardData[existingIndex].balance = parseFloat(data.balance || 0);
      cachedLeaderboardData[existingIndex].streak = parseInt(data.streakDays || 0, 10);
      cachedLeaderboardData[existingIndex].referrals = parseInt(data.referralsUsed || 0, 10);
      cachedLeaderboardData[existingIndex].avatar = data.activeProfileLogo || "assets/images/profile/rookie.jpg";
      cachedLeaderboardData[existingIndex].tier = data.userTier || null;
      
      localStorage.setItem("bkt_leaderboard_cache", JSON.stringify(cachedLeaderboardData));
      renderLeaderboard();
    }
  });
}

// Formatting Helpers
function formatTabScore(val) {
  if (currentTab === "balance") {
    return (val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  }
  return (val || 0).toLocaleString();
}

function getTabUnit() {
  if (currentTab === "balance") return "BKT";
  if (currentTab === "streak") return "Days";
  return "Invites";
}
