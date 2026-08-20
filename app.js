import { db, auth, provider } from "./firebase-config.js";
import { onAuthStateChanged, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, setDoc, updateDoc, increment, onSnapshot, getDoc, collection } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Multipliers & Base Rewards
const STREAK_MULTIPLIERS = { 1: 1.0, 2: 1.1, 3: 1.2, 4: 1.3, 5: 1.4, 6: 1.5, 7: 2.0 };
const BASE_REWARD = 2.5;

// Rank Avatars Mapping
const RANK_AVATARS = {
  rookie: "./assets/images/profile/rookie.png",
  grinder: "./assets/images/profile/grinder.png",
  hustler: "./assets/images/profile/hustler.png",
  degenerate: "./assets/images/profile/degenerate.png",
  tycoon: "./assets/images/profile/tycoon.png",
  bankruptking: "./assets/images/profile/bankruptking.png"
};

// UI Elements
const balanceDisplay = document.querySelector(".balance-val");
const headerUsername = document.getElementById("header-username");
const menuUsername = document.getElementById("menu-username-display");
const menuUid = document.getElementById("menu-uid-display");
const claimBtn = document.getElementById("main-claim-btn");
const timerBadge = document.querySelector(".timer-badge");
const streakText = document.querySelector(".streak-header h3");
const nextRewardText = document.querySelector(".streak-footer b");
const menuAvatarImg = document.getElementById("menuUserAvatar");
const pendingTasksBadge = document.getElementById("pending-tasks-count");

// Global State
let currentUser = null;
let userStreak = 1;
let lastCheckIn = null;
let timerInterval = null;
let unsubscribeUser = null;
let unsubscribeTasks = null;

// Rank Upgrade Evaluator
async function checkRankUpgrade(userId, currentBalance) {
  let newRank = "rookie";

  if (currentBalance >= 10000) newRank = "bankruptking";
  else if (currentBalance >= 5000) newRank = "tycoon";
  else if (currentBalance >= 2000) newRank = "degenerate";
  else if (currentBalance >= 1000) newRank = "hustler";
  else if (currentBalance >= 200) newRank = "grinder";

  try {
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, { rank: newRank });
  } catch (err) {
    console.error("Failed to update rank:", err);
  }
}

// 1. Auth Listener
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    // Save UID to localStorage so tasks.js can read the exact same account
    localStorage.setItem("bkt_user_id", user.uid);

    if (headerUsername) headerUsername.textContent = user.displayName || "Degen";
    if (menuUsername) menuUsername.textContent = user.displayName || "Degen User";
    if (menuUid) menuUid.textContent = `UID: ${user.uid.substring(0, 8)}...`;
    
    listenToUserData(user);
  } else {
    signInWithPopup(auth, provider).catch(() => {
      window.location.href = "login.html";
    });
  }
});

// 2. Real-time Firestore Sync (Balance + User Data)
function listenToUserData(user) {
  const userRef = doc(db, "users", user.uid);

  if (unsubscribeUser) unsubscribeUser();

  unsubscribeUser = onSnapshot(userRef, async (userSnap) => {
    if (!userSnap.exists()) {
      const newData = {
        username: user.displayName || "Anonymous",
        email: user.email,
        balance: 0,
        streak: 1,
        rank: "rookie",
        lastCheckIn: null,
        completedTasks: []
      };
      await setDoc(userRef, newData);
      userStreak = 1;
      lastCheckIn = null;
      updateUI(0, "rookie");
      listenToPendingTasks([]);
    } else {
      const data = userSnap.data();
      userStreak = data.streak || 1;
      lastCheckIn = data.lastCheckIn ? data.lastCheckIn.toDate() : null;
      
      updateUI(data.balance || 0, data.rank || "rookie");
      checkClaimStatus();
      
      // Listen to task count using completed array from this user
      listenToPendingTasks(data.completedTasks || []);
    }
  }, (err) => {
    console.error("Snapshot error:", err);
  });
}

// 3. Real-time Pending Task Counter Sync
function listenToPendingTasks(completedTaskIds) {
  if (!pendingTasksBadge) return;
  if (unsubscribeTasks) unsubscribeTasks();

  const tasksRef = collection(db, "tasks");
  unsubscribeTasks = onSnapshot(tasksRef, (querySnap) => {
    let pendingCount = 0;
    querySnap.forEach((taskDoc) => {
      if (!completedTaskIds.includes(taskDoc.id)) {
        pendingCount++;
      }
    });

    pendingTasksBadge.innerText = `${pendingCount} ${pendingCount === 1 ? 'Task' : 'Tasks'} Pending`;
  });
}

// 4. UI Update Engine
function updateUI(balance, rank) {
  if (balanceDisplay) {
    balanceDisplay.innerHTML = `${Number(balance).toFixed(4)} <span class="brand-font">BKT</span>`;
  }

  if (streakText) {
    streakText.textContent = `DAY ${userStreak} STREAK`;
  }

  if (menuAvatarImg) {
    const normalizedRank = rank.toLowerCase().replace(/\s+/g, '');
    menuAvatarImg.src = RANK_AVATARS[normalizedRank] || RANK_AVATARS["rookie"];
  }

  const currentMultiplier = STREAK_MULTIPLIERS[Math.min(userStreak, 7)] || 1.0;
  const nextReward = BASE_REWARD * currentMultiplier;

  if (nextRewardText) {
    nextRewardText.textContent = `+${nextReward.toFixed(2)} BKT`;
  }

  // Update streak indicators on screen
  const streakBoxes = document.querySelectorAll(".streak-days .day-box");
  streakBoxes.forEach((box, index) => {
    const lockIcon = box.querySelector(".lock-icon");
    if (index + 1 <= userStreak) {
      box.classList.add("active");
      if (lockIcon) lockIcon.textContent = "✅";
    } else {
      box.classList.remove("active");
      if (lockIcon) lockIcon.textContent = "🔒";
    }
  });
}

// 5. Live Countdown Timer & Status
function checkClaimStatus() {
  if (timerInterval) clearInterval(timerInterval);

  if (!lastCheckIn) {
    enableClaimButton();
    return;
  }

  updateLiveTimer();
  timerInterval = setInterval(updateLiveTimer, 1000);
}

function updateLiveTimer() {
  const now = new Date();
  const nextCheckInTime = new Date(lastCheckIn.getTime() + 24 * 60 * 60 * 1000);
  const timeRemaining = nextCheckInTime - now;

  if (timeRemaining <= 0) {
    clearInterval(timerInterval);
    const hoursPassed = (now - lastCheckIn) / (1000 * 60 * 60);
    if (hoursPassed >= 48) userStreak = 1;
    enableClaimButton();
  } else {
    disableClaimButton(timeRemaining);
  }
}

function enableClaimButton() {
  if (claimBtn) {
    claimBtn.disabled = false;
    claimBtn.textContent = "CHECK IN & CLAIM";
    claimBtn.style.background = "#00ff88";
    claimBtn.style.color = "#000000";
    claimBtn.style.cursor = "pointer";
    claimBtn.style.opacity = "1";
  }

  if (timerBadge) timerBadge.textContent = "⚡ Ready";
}

function disableClaimButton(msLeft) {
  if (claimBtn) {
    claimBtn.disabled = true;
    claimBtn.textContent = "CHECKED IN";
    claimBtn.style.background = "#1d2a20";
    claimBtn.style.color = "#556655";
    claimBtn.style.cursor = "not-allowed";
    claimBtn.style.opacity = "0.7";
  }

  if (timerBadge) {
    const totalSeconds = Math.floor(msLeft / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;

    const pad = (num) => String(num).padStart(2, '0');
    timerBadge.textContent = `⏳ ${pad(h)}h ${pad(m)}m ${pad(s)}s`;
  }
}

// 6. Event Listeners
if (claimBtn) {
  claimBtn.addEventListener("click", async () => {
    if (!currentUser || claimBtn.disabled) return;

    const multiplier = STREAK_MULTIPLIERS[Math.min(userStreak, 7)] || 1.0;
    const reward = BASE_REWARD * multiplier;
    const userRef = doc(db, "users", currentUser.uid);

    try {
      claimBtn.disabled = true;
      claimBtn.textContent = "CLAIMING...";

      const snap = await getDoc(userRef);
      const currentBalance = snap.exists() ? (snap.data().balance || 0) : 0;
      const newTotalBalance = currentBalance + reward;

      await updateDoc(userRef, {
        balance: increment(reward),
        streak: increment(1),
        lastCheckIn: new Date()
      });

      await checkRankUpgrade(currentUser.uid, newTotalBalance);

    } catch (err) {
      console.error("Failed to claim reward:", err);
      enableClaimButton();
    }
  });
}

// Menu Handlers
const openMenuBtn = document.getElementById("open-menu-btn");
const closeMenuBtn = document.getElementById("close-menu-btn");
const menuOverlay = document.getElementById("menu-overlay");
const signoutBtn = document.getElementById("signout-btn");

if (openMenuBtn && menuOverlay) {
  openMenuBtn.addEventListener("click", () => menuOverlay.classList.add("active"));
}

if (closeMenuBtn && menuOverlay) {
  closeMenuBtn.addEventListener("click", () => menuOverlay.classList.remove("active"));
}

if (menuOverlay) {
  menuOverlay.addEventListener("click", (e) => {
    if (e.target === menuOverlay) menuOverlay.classList.remove("active");
  });
}

document.querySelectorAll(".menu-info-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    if (menuOverlay) menuOverlay.classList.remove("active");
    const title = btn.getAttribute("data-title");
    const content = btn.getAttribute("data-content");
    setTimeout(() => alert(`${title.toUpperCase()}\n\n${content}`), 200);
  });
});

if (signoutBtn) {
  signoutBtn.addEventListener("click", () => {
    signOut(auth).then(() => {
      localStorage.removeItem("bkt_user_id");
      window.location.href = "login.html";
    });
  });
}
