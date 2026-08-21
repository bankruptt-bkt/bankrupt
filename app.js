// ==========================================
// CONFIGURATION & GLOBAL STATES
// ==========================================
const CHECKIN_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 Hours
let currentUser = null;
let userData = {
  balance: 0.00,
  streakDays: 0,
  lastCheckIn: 0,
  referralsUsed: 0,
  referralsAllowed: 10
};
let countdownInterval = null;

// Safe accessor helpers
function getAuth() {
  return window.auth || (typeof firebase !== 'undefined' ? firebase.auth() : null);
}

function getDb() {
  return window.db || (typeof firebase !== 'undefined' ? firebase.database() : null);
}

// Handler for Telegram Link (Placeholder for custom verification script)
function handleTelegramClick() {
  console.log("Telegram button clicked. Waiting for script integration...");
  openComingSoon("Telegram Channel");
}

// Initialize Telegram Mini App SDK
if (window.Telegram && window.Telegram.WebApp) {
  const tg = window.Telegram.WebApp;
  tg.ready();
  tg.expand(); // Expands app to full height inside Telegram
}

// ==========================================
// 1. GLOBAL SYSTEM LISTENERS & AUTH GUARD
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  const authInstance = getAuth();
  const dbInstance = getDb();

  // Catch pending Google Redirect results on page reload
  if (authInstance) {
    authInstance.getRedirectResult().catch((error) => {
      if (error && error.code) {
        console.error("Redirect Sign-In Error:", error.message);
      }
    });
  }

  // Global Maintenance Mode Check
  if (dbInstance) {
    dbInstance.ref("system/maintenance").on("value", (snap) => {
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
        listenToUserData(user.uid);
        listenToUncompletedTasks(user.uid);

        // Global Ban Check
        if (dbInstance) {
          dbInstance.ref(`users/${user.uid}/isBanned`).on("value", (snap) => {
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
// 2. REAL-TIME FIREBASE DATABASE SYNC
// ==========================================
function listenToUserData(uid) {
  const dbInstance = getDb();
  if (!dbInstance) return;

  const userRef = dbInstance.ref('users/' + uid);
  userRef.on('value', (snapshot) => {
    const data = snapshot.val();
    if (data) {
      userData = {
        balance: data.balance || 0.00,
        streakDays: data.streakDays || 0,
        lastCheckIn: data.lastCheckIn || 0,
        referralsUsed: data.referralsUsed || 0,
        referralsAllowed: 10 + (data.referralsCount || 0)
      };
    } else {
      userRef.set({
        balance: 0.00,
        streakDays: 0,
        lastCheckIn: 0,
        referralsUsed: 0,
        referralsCount: 0
      });
    }
    renderUI();
    updateReferralModalUI();
  });
}

function listenToUncompletedTasks(uid) {
  const dbInstance = getDb();
  if (!dbInstance) return;

  dbInstance.ref('tasks').on('value', (tasksSnap) => {
    const tasks = tasksSnap.val() || {};
    
    dbInstance.ref(`users/${uid}/completedTasks`).on('value', (completedSnap) => {
      const completed = completedSnap.val() || {};

      const totalTasks = Object.keys(tasks).length;
      let pendingCount = 0;

      Object.keys(tasks).forEach((taskId) => {
        if (!completed[taskId]) {
          pendingCount++;
        }
      });

      updateTaskHubUI(pendingCount, totalTasks);
    });
  });
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
// 4. CHECK-IN ACTION & SIGN OUT
// ==========================================
async function handleClaim() {
  const claimBtn = document.getElementById('claim-btn');
  if (claimBtn) {
    claimBtn.innerText = "CLAIMING...";
    claimBtn.disabled = true;
  }

  userData.balance += 5.00;
  userData.streakDays += 1;
  userData.lastCheckIn = Date.now();

  renderUI();

  const dbInstance = getDb();
  if (currentUser && dbInstance) {
    try {
      await dbInstance.ref('users/' + currentUser.uid).update({
        balance: userData.balance,
        streakDays: userData.streakDays,
        lastCheckIn: userData.lastCheckIn
      });
    } catch (e) {
      console.error("Failed to commit claim:", e.message);
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

  const uniqueLink = `${window.location.origin}${window.location.pathname}?ref=${currentUser.uid}`;

  if (linkInput) linkInput.value = uniqueLink;
  if (counterEl) counterEl.innerText = `${userData.referralsUsed} / ${userData.referralsAllowed}`;

  if (warningEl) {
    if (userData.referralsUsed >= userData.referralsAllowed) {
      warningEl.classList.remove('hidden');
    } else {
      warningEl.classList.add('hidden');
    }
  }
}

function copyReferralLink() {
  const linkInput = document.getElementById('ref-modal-link');
  if (!linkInput || !linkInput.value) return;

  if (userData.referralsUsed >= userData.referralsAllowed) {
    alert("You have reached your invite limit. Extra invites must be granted by admin.");
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
// GOOGLE AUTH HANDLER FOR TELEGRAM & BROWSER
// ==========================================
function signInWithGoogle() {
  const authInstance = getAuth();
  if (!authInstance) return;

  const provider = new firebase.auth.GoogleAuthProvider();
  const isTelegram = window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData;

  if (isTelegram) {
    // Redirect mode prevents Telegram's embedded browser from closing auth popups
    authInstance.signInWithRedirect(provider);
  } else {
    // Normal browser popup
    authInstance.signInWithPopup(provider).catch((error) => {
      if (error.code !== 'auth/popup-closed-by-user') {
        alert("Google Sign-In Error: " + error.message);
      }
    });
  }
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
