// Maintenance Check
db.ref("system/maintenance").on("value", (snap) => {
  if (snap.val() === true && !window.location.pathname.includes("admin.html")) {
    document.body.innerHTML = `<div class="flex flex-col items-center justify-center min-h-screen text-center p-6"><h1 class="font-marker text-3xl text-yellow-400 mb-2">UNDER MAINTENANCE</h1><p class="text-gray-400 text-sm">Will be back soon! Upgrade in progress...</p></div>`;
  }
});

// Ban Check
auth.onAuthStateChanged((user) => {
  if (user) {
    db.ref(`users/${user.uid}/isBanned`).on("value", (snap) => {
      if (snap.val() === true) {
        document.body.innerHTML = `<div class="flex flex-col items-center justify-center min-h-screen text-center p-6"><h1 class="font-marker text-3xl text-red-500 mb-2">ACCOUNT BANNED</h1><p class="text-gray-400 text-sm">Your account has been suspended for violating terms.</p></div>`;
      }
    });
  }
});

// ==========================================
// CONFIGURATION & GLOBAL STATES
// ==========================================
const CHECKIN_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 Hours
let currentUser = null;
let userData = {
  balance: 0.00,
  streakDays: 0,
  lastCheckIn: 0
};
let countdownInterval = null;

// Safe accessor helpers
function getAuth() {
  return window.auth || (typeof firebase !== 'undefined' ? firebase.auth() : null);
}

function getDb() {
  return window.db || (typeof firebase !== 'undefined' ? firebase.database() : null);
}

// ==========================================
// 1. AUTHENTICATION SESSION GUARD
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  const authInstance = getAuth();

  if (authInstance) {
    authInstance.onAuthStateChanged((user) => {
      if (user) {
        currentUser = user;
        updateUserProfileUI(user);
        listenToUserData(user.uid);
      } else {
        window.location.href = 'login.html';
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
        lastCheckIn: data.lastCheckIn || 0
      };
    } else {
      userRef.set(userData);
    }
    renderUI();
  });
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
// 5. DRAWER TOGGLE & REAL-TIME DRAG ENGINE
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

  // Touch Events
  handle.addEventListener('touchstart', onStart, { passive: true });
  window.addEventListener('touchmove', onMove, { passive: false });
  window.addEventListener('touchend', onEnd);

  // Mouse Events
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

    // Resistance when dragging upward
    if (deltaY < 0) deltaY = deltaY * 0.25;

    if (e.cancelable) e.preventDefault();
    drawer.style.transform = `translateY(${deltaY}px)`;
  }

  function onEnd() {
    if (!isDragging) return;
    isDragging = false;
    drawer.classList.remove('dragging');

    let deltaY = currentY - startY;

    // Pulling down more than 100px closes drawer
    if (deltaY > 100) {
      toggleMenu();
    } else {
      drawer.style.transform = 'translateY(0%)';
    }

    startY = 0;
    currentY = 0;
  }
});
