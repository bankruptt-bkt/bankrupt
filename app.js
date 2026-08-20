import { db, auth } from "./conf.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, setDoc, updateDoc, increment, getDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Multipliers & Base Rewards
const STREAK_MULTIPLIERS = { 1: 1.0, 2: 1.1, 3: 1.2, 4: 1.3, 5: 1.4, 6: 1.5, 7: 2.0 };
const BASE_REWARD = 2.5;

const RANK_AVATARS = {
  rookie: "https://via.placeholder.com/60/000/00ff88?text=Rookie",
  grinder: "https://via.placeholder.com/60/000/00ff88?text=Grinder",
  hustler: "https://via.placeholder.com/60/000/00ff88?text=Hustler",
  degenerate: "https://via.placeholder.com/60/000/00ff88?text=Degen",
  tycoon: "https://via.placeholder.com/60/000/00ff88?text=Tycoon",
  bankruptking: "https://via.placeholder.com/60/000/00ff88?text=King"
};

// Cached DOM Elements
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

const infoModal = document.getElementById("info-modal-overlay");
const infoTitle = document.getElementById("info-modal-title");
const infoContent = document.getElementById("info-modal-content");

let currentUser = null;
let userStreak = 1;
let lastCheckIn = null;
let timerInterval = null;

// STEP 1: IMMEDIATELY bind UI events so buttons work before Firebase responds
bindUIEvents();

// STEP 2: Authenticate in parallel without blocking execution
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    localStorage.setItem("bkt_user_id", user.uid);

    // Immediate UI display fallback
    if (headerUsername) headerUsername.textContent = user.displayName || "Degen";
    if (menuUsername) menuUsername.textContent = user.displayName || "Degen User";
    if (menuUid) menuUid.textContent = `UID: ${user.uid.substring(0, 8)}...`;

    // Asynchronous non-blocking data load
    fetchUserData(user);
    fetchPendingTasks(user.uid);
  } else {
    window.location.href = "login.html";
  }
});

async function fetchUserData(user) {
  try {
    const userRef = doc(db, "users", user.uid);
    let userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      const newData = {
        username: user.displayName || "Anonymous",
        email: user.email || "",
        balance: 0,
        streak: 1,
        rank: "rookie",
        lastCheckIn: null,
        completedTasks: []
      };
      await setDoc(userRef, newData);
      userSnap = await getDoc(userRef);
    }

    const data = userSnap.data();
    userStreak = data.streak || 1;
    lastCheckIn = data.lastCheckIn ? data.lastCheckIn.toDate() : null;

    updateUI(data.balance || 0, data.rank || "rookie");
    checkClaimStatus();
  } catch (err) {
    console.error("Data fetch error:", err);
  }
}

async function fetchPendingTasks(uid) {
  if (!pendingTasksBadge) return;
  try {
    const userSnap = await getDoc(doc(db, "users", uid));
    const completedTasks = userSnap.exists() ? (userSnap.data().completedTasks || []) : [];
    
    const tasksSnap = await getDocs(collection(db, "tasks"));
    let count = 0;
    tasksSnap.forEach(tDoc => {
      if (!completedTasks.includes(tDoc.id)) count++;
    });

    pendingTasksBadge.innerText = `${count} ${count === 1 ? 'Task' : 'Tasks'} Pending`;
  } catch (err) {
    if (pendingTasksBadge) pendingTasksBadge.innerText = "0 Tasks Pending";
  }
}

function updateUI(balance, rank) {
  if (balanceDisplay) {
    balanceDisplay.innerHTML = `${Number(balance).toFixed(4)} <span class="brand-font">BKT</span>`;
  }
  if (streakText) streakText.textContent = `DAY ${userStreak} STREAK`;

  if (menuAvatarImg) {
    const normRank = rank.toLowerCase().replace(/\s+/g, '');
    menuAvatarImg.src = RANK_AVATARS[normRank] || RANK_AVATARS["rookie"];
  }

  const effectiveStreak = Math.min(Math.max(userStreak, 1), 7);
  const multiplier = STREAK_MULTIPLIERS[effectiveStreak] || 1.0;
  if (nextRewardText) nextRewardText.textContent = `+${(BASE_REWARD * multiplier).toFixed(2)} BKT`;

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
  const nextTime = new Date(lastCheckIn.getTime() + 24 * 60 * 60 * 1000);
  const diff = nextTime - now;

  if (diff <= 0) {
    clearInterval(timerInterval);
    if ((now - lastCheckIn) / (1000 * 60 * 60) >= 48) userStreak = 1;
    enableClaimButton();
  } else {
    disableClaimButton(diff);
  }
}

function enableClaimButton() {
  if (claimBtn) {
    claimBtn.disabled = false;
    claimBtn.textContent = "CHECK IN & CLAIM";
    claimBtn.style.opacity = "1";
    claimBtn.style.cursor = "pointer";
    claimBtn.style.background = "#00ff88";
    claimBtn.style.color = "#000000";
  }
  if (timerBadge) timerBadge.textContent = "⚡ Ready";
}

function disableClaimButton(msLeft) {
  if (claimBtn) {
    claimBtn.disabled = true;
    claimBtn.textContent = "CHECKED IN";
    claimBtn.style.opacity = "0.6";
    claimBtn.style.cursor = "not-allowed";
    claimBtn.style.background = "#1d2a20";
    claimBtn.style.color = "#556655";
  }
  if (timerBadge) {
    const sec = Math.floor(msLeft / 1000);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    const pad = n => String(n).padStart(2, '0');
    timerBadge.textContent = `⏳ ${pad(h)}h ${pad(m)}m ${pad(s)}s`;
  }
}

function bindUIEvents() {
  const openMenuBtn = document.getElementById("open-menu-btn");
  const closeMenuBtn = document.getElementById("close-menu-btn");
  const menuOverlay = document.getElementById("menu-overlay");
  const closeInfoBtn = document.getElementById("close-info-btn");
  const okInfoBtn = document.getElementById("info-modal-ok-btn");
  const signoutBtn = document.getElementById("signout-btn");

  if (openMenuBtn && menuOverlay) {
    openMenuBtn.onclick = (e) => {
      e.stopPropagation();
      menuOverlay.classList.add("active");
    };
  }

  if (closeMenuBtn && menuOverlay) {
    closeMenuBtn.onclick = () => menuOverlay.classList.remove("active");
  }

  if (menuOverlay) {
    menuOverlay.onclick = (e) => {
      if (e.target === menuOverlay) menuOverlay.classList.remove("active");
    };
  }

  const closeModal = () => { if (infoModal) infoModal.classList.remove("active"); };
  if (closeInfoBtn) closeInfoBtn.onclick = closeModal;
  if (okInfoBtn) okInfoBtn.onclick = closeModal;

  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".menu-info-btn");
    if (btn) {
      if (menuOverlay) menuOverlay.classList.remove("active");
      if (infoTitle) infoTitle.textContent = btn.getAttribute("data-title");
      if (infoContent) infoContent.textContent = btn.getAttribute("data-content");
      if (infoModal) infoModal.classList.add("active");
    }
  });

  if (claimBtn) {
    claimBtn.onclick = async () => {
      if (!currentUser || claimBtn.disabled) return;
      
      const effectiveStreak = Math.min(Math.max(userStreak, 1), 7);
      const reward = BASE_REWARD * (STREAK_MULTIPLIERS[effectiveStreak] || 1.0);
      const userRef = doc(db, "users", currentUser.uid);

      try {
        claimBtn.disabled = true;
        claimBtn.textContent = "CLAIMING...";

        await updateDoc(userRef, {
          balance: increment(reward),
          streak: userStreak >= 7 ? 7 : increment(1),
          lastCheckIn: new Date()
        });

        await fetchUserData(currentUser);
      } catch (err) {
        console.error("Claim failed:", err);
        enableClaimButton();
      }
    };
  }

  if (signoutBtn) {
    signoutBtn.onclick = () => {
      signOut(auth).then(() => {
        localStorage.removeItem("bkt_user_id");
        window.location.href = "login.html";
      });
    };
  }
}
