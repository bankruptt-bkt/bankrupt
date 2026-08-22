// Capture referral parameters prior to authentication redirects
(function captureReferralOnLanding() {
  const urlParams = new URLSearchParams(window.location.search);
  const refCode = urlParams.get("ref");
  if (refCode) {
    localStorage.setItem("pending_referrer", refCode.trim());
  }
})();

// ==========================================
// CONFIGURATION & GLOBAL STATES
// ==========================================
const CHECKIN_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 Hours
const DEFAULT_COMMISSION_RATE = 0.05; // 5% standard mining commission
const BASE_REFERRAL_LIMIT = 10; // Fixed standard 10 invites cap

let currentUser = null;
let userData = {
  balance: 0.00,
  streakDays: 0,
  lastCheckIn: 0,
  referralsCount: 0,
  bonusReferralSlots: 0,
  referralsAllowed: 10,
  referredBy: null,
  completedTasks: {}
};
let countdownInterval = null;

// Safe accessor helpers
function getAuth() {
  return window.auth || (typeof firebase !== 'undefined' ? firebase.auth() : null);
}

function getDb() {
  return window.db || (typeof firebase !== 'undefined' ? firebase.database() : null);
}

// Handler for Telegram Link
function handleTelegramClick() {
  if (typeof openComingSoon === 'function') {
    openComingSoon("Telegram Channel");
  }
}

// Initialize Telegram Mini App SDK
if (window.Telegram && window.Telegram.WebApp) {
  const tg = window.Telegram.WebApp;
  tg.ready();
  tg.expand();
}

// ==========================================
// 1. GLOBAL SYSTEM LISTENERS & AUTH
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  const authInstance = getAuth();
  const dbInstance = getDb();

  if (authInstance) {
    authInstance.getRedirectResult().catch((error) => {
      if (error && error.code) {
        console.error("Redirect Sign-In Error:", error.message);
      }
    });
  }

  // Global Maintenance Mode Check
  if (dbInstance) {
    dbInstance.ref("system/maintenance").once("value", (snap) => {
      if (snap.val() === true && !window.location.pathname.includes("admin.html")) {
        document.body.innerHTML = `
          <div class="flex flex-col items-center justify-center min-h-screen text-center p-6 bg-[#0b0f0c]">
            <h1 class="font-marker text-3xl text-yellow-400 mb-2">UNDER MAINTENANCE</h1>
            <p class="text-gray-400 text-sm">Will be back soon! Upgrade in progress...</p>
          </div>`;
      }
    });
  }

  // Auth Guard & User Initialization
  if (authInstance) {
    authInstance.onAuthStateChanged((user) => {
      if (user) {
        currentUser = user;
        updateUserProfileUI(user);
        
        // Fetch data once on login
        fetchUserDataOnce(user.uid);
        fetchUncompletedTasksOnce(user.uid);

        if (dbInstance) {
          dbInstance.ref(`users/${user.uid}/isBanned`).once("value", (snap) => {
            if (snap.val() === true) {
              document.body.innerHTML = `
                <div class="flex flex-col items-center justify-center min-h-screen text-center p-6 bg-[#0b0f0c]">
                  <h1 class="font-marker text-3xl text-red-500 mb-2">ACCOUNT BANNED</h1>
                  <p class="text-gray-400 text-sm">Your account has been suspended for violating terms.</p>
                </div>`;
            }
          });
        }
      } else {
        if (!window.location.pathname.includes("login.html") && !window.location.pathname.includes("admin.html")) {
          window.location.href = 'login.html';
        }
      }
    });
  }
});

function updateUserProfileUI(user) {
  const headerName = document.getElementById('user-display-name');
  const menuName = document.getElementById('menu-user-name');
  const menuUid = document.getElementById('menu-user-uid');

  const displayName = user.displayName || ("Miner_" + user.uid.substring(0, 5));

  if (headerName) headerName.innerText = displayName;
  if (menuName) menuName.innerText = displayName;
  if (menuUid) menuUid.innerText = "UID: " + user.uid;
}

// ==========================================
// 2. ONE-TIME DATABASE SYNC ENGINE
// ==========================================
async function fetchUserDataOnce(uid) {
  const dbInstance = getDb();
  if (!dbInstance) return;

  try {
    const snapshot = await dbInstance.ref('users/' + uid).once('value');
    const data = snapshot.val();
    if (data) {
      const bonus = data.bonusReferralSlots || 0;
      userData = {
        balance: data.balance || 0.00,
        streakDays: data.streakDays || 0,
        lastCheckIn: data.lastCheckIn || 0,
        referralsCount: data.referralsCount || 0,
        bonusReferralSlots: bonus,
        referralsAllowed: BASE_REFERRAL_LIMIT + bonus, // Dynamically calculates (10 + admin bonus)
        referredBy: data.referredBy || null,
        completedTasks: data.completedTasks || {}
      };

      renderUI();
      updateReferralModalUI();
    }
  } catch (err) {
    console.error("Error fetching user data:", err);
  }
}

async function fetchUncompletedTasksOnce(uid) {
  const dbInstance = getDb();
  if (!dbInstance) return;

  try {
    const tasksSnap = await dbInstance.ref('tasks').once('value');
    const tasks = tasksSnap.val() || {};

    const completedSnap = await dbInstance.ref(`users/${uid}/completedTasks`).once('value');
    const completed = completedSnap.val() || {};

    const totalTasks = Object.keys(tasks).length;
    let pendingCount = 0;

    Object.keys(tasks).forEach((taskId) => {
      if (!completed[taskId]) {
        pendingCount++;
      }
    });

    updateTaskHubUI(pendingCount, totalTasks);
  } catch (err) {
    console.error("Error fetching tasks:", err);
  }
}

// Lifetime 5% Referral Commission Engine
async function payReferralCommission(earnerUid, earnedAmount, commissionRate = DEFAULT_COMMISSION_RATE) {
  const dbInstance = getDb();
  if (!dbInstance || earnedAmount <= 0) return;

  try {
    const earnerSnap = await dbInstance.ref(`users/${earnerUid}/referredBy`).once('value');
    const referrerUid = earnerSnap.val();

    if (referrerUid) {
      const commission = earnedAmount * commissionRate;
      
      // Real-time addition to referrer balance
      await dbInstance.ref(`users/${referrerUid}/balance`).transaction((currBalance) => {
        return (currBalance || 0) + commission;
      });
      
      // Transaction history record
      await dbInstance.ref(`users/${referrerUid}/transactionHistory`).push({
        type: 'MINING_COMMISSION_5_PERCENT',
        amount: commission,
        fromUser: earnerUid,
        timestamp: Date.now()
      });
    }
  } catch (err) {
    console.error("Error crediting referral commission:", err);
  }
}

function updateTaskHubUI(pendingCount, totalTasks) {
  const subtitleEl = document.getElementById('task-hub-subtitle');
  const badgeEl = document.getElementById('task-hub-badge');

  if (!subtitleEl) return;

  if (pendingCount > 0) {
    subtitleEl.innerText = `${pendingCount} New Task${pendingCount > 1 ? 's' : ''} Available`;
    subtitleEl.className = "text-xs text-[#00ff66] font-bold";

    if (badgeEl) {
      badgeEl.innerText = pendingCount;
      badgeEl.classList.remove('hidden');
    }
  } else {
    subtitleEl.innerText = totalTasks > 0 ? "All Tasks Completed!" : "No Active Tasks";
    subtitleEl.className = "text-xs text-gray-400 font-medium";

    if (badgeEl) {
      badgeEl.classList.add('hidden');
    }
  }
}

// ==========================================
// 3. UI RENDER & COUNTDOWN TIMER LOGIC
// ==========================================
function renderUI() {
  const balanceEl = document.getElementById('balance-display');
  if (balanceEl) balanceEl.innerText = userData.balance.toFixed(4);

  const streakTitle = document.getElementById('streak-title');
  if (streakTitle) {
    streakTitle.innerText = userData.streakDays > 0 
      ? `STREAK: DAY ${userData.streakDays}` 
      : "START STREAK";
  }

  renderButtonAndTimer();
}

function renderButtonAndTimer() {
  const claimBtn = document.getElementById('claim-btn');
  const badge = document.getElementById('countdown-badge');
  if (!claimBtn) return;

  const now = Date.now();
  const nextAvailable = userData.lastCheckIn + CHECKIN_INTERVAL_MS;
  const timeRemaining = nextAvailable - now;

  if (timeRemaining <= 0) {
    if (countdownInterval) clearInterval(countdownInterval);

    claimBtn.innerText = "CHECK IN + CLAIM";
    claimBtn.disabled = false;
    claimBtn.onclick = handleClaim;
    claimBtn.className = "w-full py-3 bg-[#00ff66] text-black font-marker text-lg rounded-xl shadow-lg shadow-[#00ff66]/30 cursor-pointer hover:bg-[#00e65c] transition-all";

    if (badge) {
      badge.innerHTML = `<i class="fa-regular fa-clock"></i> Ready`;
      badge.className = "px-2.5 py-1 rounded-full bg-[#0d2216] text-[#00ff66] border border-[#144225] font-mono text-[11px] font-bold flex items-center gap-1";
    }
  } else {
    claimBtn.innerText = "CHECKED IN";
    claimBtn.disabled = true;
    claimBtn.onclick = null;
    claimBtn.className = "w-full py-3 bg-[#1e2721] text-gray-400 font-marker text-lg rounded-xl border border-[#2a382f] cursor-not-allowed";

    startCountdown(nextAvailable);
  }
}

function startCountdown(nextAvailableTime) {
  if (countdownInterval) clearInterval(countdownInterval);

  const updateTimer = () => {
    const now = Date.now();
    const diff = nextAvailableTime - now;
    const badge = document.getElementById('countdown-badge');

    if (diff <= 0) {
      clearInterval(countdownInterval);
      renderButtonAndTimer();
      return;
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    const formattedTime = `${padZero(hours)}:${padZero(minutes)}:${padZero(seconds)}`;

    if (badge) {
      badge.innerHTML = `<i class="fa-regular fa-clock"></i> ${formattedTime}`;
      badge.className = "px-2.5 py-1 rounded-full bg-gray-800 text-gray-400 border border-gray-700 font-mono text-[11px] font-bold flex items-center gap-1";
    }
  };

  updateTimer();
  countdownInterval = setInterval(updateTimer, 1000);
}

function padZero(num) {
  return num < 10 ? '0' + num : num;
}

// ==========================================
// 4. OPTIMISTIC CLAIM & TASK ACTIONS
// ==========================================
async function handleClaim() {
  if (!currentUser) return;

  const claimRewardAmount = 5.00;

  // Preserve state for rollback
  const prevBalance = userData.balance;
  const prevLastCheckIn = userData.lastCheckIn;
  const prevStreak = userData.streakDays;

  // --- 1. OPTIMISTIC UI UPDATE ---
  userData.balance += claimRewardAmount;
  userData.lastCheckIn = Date.now();
  userData.streakDays += 1;

  renderUI();

  // --- 2. BACKGROUND WRITE ---
  const dbInstance = getDb();
  if (dbInstance) {
    try {
      const userRef = dbInstance.ref('users/' + currentUser.uid);

      await userRef.transaction((data) => {
        if (data) {
          data.balance = (data.balance || 0) + claimRewardAmount;
          data.streakDays = (data.streakDays || 0) + 1;
          data.lastCheckIn = Date.now();
        }
        return data;
      });

      // Pay 5% Referral Commission in background
      await payReferralCommission(currentUser.uid, claimRewardAmount, DEFAULT_COMMISSION_RATE);

    } catch (e) {
      console.error("Failed to commit claim, rolling back UI:", e.message);
      
      // Rollback on network failure
      userData.balance = prevBalance;
      userData.lastCheckIn = prevLastCheckIn;
      userData.streakDays = prevStreak;
      renderUI();
      alert("Network error: Claim failed to sync. Please try again.");
    }
  }
}

async function handleCompleteTask(taskId, rewardAmount, taskBtnElement) {
  if (!currentUser) return;

  const prevBalance = userData.balance;
  const dbInstance = getDb();

  // --- 1. OPTIMISTIC UI UPDATE ---
  userData.balance += rewardAmount;
  if (!userData.completedTasks) userData.completedTasks = {};
  userData.completedTasks[taskId] = true;

  const balanceEl = document.getElementById('balance-display');
  if (balanceEl) balanceEl.innerText = userData.balance.toFixed(4);

  if (taskBtnElement) {
    taskBtnElement.disabled = true;
    taskBtnElement.innerText = "COMPLETED";
    taskBtnElement.className = "px-4 py-2 bg-gray-800 text-gray-500 rounded-lg text-xs font-bold cursor-not-allowed";
  }

  // --- 2. BACKGROUND WRITE ---
  if (dbInstance) {
    try {
      const updates = {};
      updates[`users/${currentUser.uid}/balance`] = firebase.database.ServerValue.increment(rewardAmount);
      updates[`users/${currentUser.uid}/completedTasks/${taskId}`] = true;

      await dbInstance.ref().update(updates);
      fetchUncompletedTasksOnce(currentUser.uid);

    } catch (err) {
      console.error("Task update failed, rolling back UI:", err);

      userData.balance = prevBalance;
      delete userData.completedTasks[taskId];

      if (balanceEl) balanceEl.innerText = userData.balance.toFixed(4);
      if (taskBtnElement) {
        taskBtnElement.disabled = false;
        taskBtnElement.innerText = "CLAIM";
        taskBtnElement.className = "px-4 py-2 bg-[#00ff66] text-black rounded-lg text-xs font-bold cursor-pointer hover:bg-[#00e65c]";
      }
      alert("Could not complete task due to a connection issue.");
    }
  }
}

async function handleSignOut(e) {
  if (e) e.preventDefault();
  try {
    const authInstance = getAuth();
    if (authInstance) await authInstance.signOut();
    localStorage.clear();
    window.location.href = 'login.html';
  } catch (err) {
    alert("Sign Out Error: " + err.message);
  }
}

// ==========================================
// 5. REFERRAL MODAL & LOGIC
// ==========================================
function openReferralModal() {
  if (!currentUser) {
    alert("Please log in to view your referral link.");
    return;
  }

  const modal = document.getElementById('referral-modal');
  if (modal) modal.classList.remove('hidden');

  updateReferralModalUI();
}

function closeReferralModal() {
  const modal = document.getElementById('referral-modal');
  if (modal) modal.classList.add('hidden');
}

function updateReferralModalUI() {
  if (!currentUser) return;

  const linkInput = document.getElementById('ref-modal-link');
  const counterEl = document.getElementById('ref-modal-counter');
  const warningEl = document.getElementById('ref-limit-warning');

  const uniqueLink = `${window.location.origin}/login.html?ref=${currentUser.uid}`;

  if (linkInput) linkInput.value = uniqueLink;
  if (counterEl) counterEl.innerText = `${userData.referralsCount} / ${userData.referralsAllowed}`;

  if (warningEl) {
    if (userData.referralsCount >= userData.referralsAllowed) {
      warningEl.classList.remove('hidden');
    } else {
      warningEl.classList.add('hidden');
    }
  }
}

function copyReferralLink() {
  const linkInput = document.getElementById('ref-modal-link');
  if (!linkInput || !linkInput.value) return;

  if (userData.referralsCount >= userData.referralsAllowed) {
    alert(`You have reached your invite limit (${userData.referralsAllowed} Max). Extra invites must be granted by admin.`);
    return;
  }

  navigator.clipboard.writeText(linkInput.value).then(() => {
    alert("Referral link copied to clipboard!");
  }).catch(() => {
    linkInput.select();
    document.execCommand('copy');
    alert("Referral link copied!");
  });
}

// ==========================================
// 6. DRAWER TOGGLE & REAL-TIME DRAG ENGINE
// ==========================================
function toggleMenu() {
  const drawer = document.getElementById('drawer-sheet');
  const overlay = document.getElementById('drawer-overlay');
  if (!drawer) return;

  const isOpen = drawer.classList.contains('open');

  if (isOpen) {
    drawer.classList.remove('open');
    drawer.style.transform = 'translateY(100%)';
    if (overlay) overlay.classList.add('opacity-0', 'pointer-events-none');
  } else {
    drawer.classList.add('open');
    drawer.style.transform = 'translateY(0%)';
    if (overlay) overlay.classList.remove('opacity-0', 'pointer-events-none');
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const drawer = document.getElementById('drawer-sheet');
  const handle = document.getElementById('drawer-handle');
  if (!drawer || !handle) return;

  let startY = 0;
  let currentY = 0;
  let isDragging = false;

  handle.addEventListener('touchstart', onStart, { passive: true });
  window.addEventListener('touchmove', onMove, { passive: false });
  window.addEventListener('touchend', onEnd);

  handle.addEventListener('mousedown', onStart);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onEnd);

  function onStart(e) {
    if (!drawer.classList.contains('open')) return;
    isDragging = true;
    startY = e.touches ? e.touches[0].clientY : e.clientY;
    drawer.classList.add('dragging');
  }

  function onMove(e) {
    if (!isDragging) return;
    currentY = e.touches ? e.touches[0].clientY : e.clientY;
    let deltaY = currentY - startY;

    if (deltaY < 0) deltaY = deltaY * 0.25;

    if (e.cancelable) e.preventDefault();
    drawer.style.transform = `translateY(${deltaY}px)`;
  }

  function onEnd() {
    if (!isDragging) return;
    isDragging = false;
    drawer.classList.remove('dragging');

    let deltaY = currentY - startY;

    if (deltaY > 100) {
      toggleMenu();
    } else {
      drawer.style.transform = 'translateY(0%)';
    }

    startY = 0;
    currentY = 0;
  }
});
