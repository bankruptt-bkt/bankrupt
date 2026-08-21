// ==========================================
// CONFIGURATION & GLOBAL STATES
// ==========================================
const ALLOWED_ADMIN_EMAILS = [
  "probhats208@gmail.com"
];

let isMaintenanceActive = false;

// Safe Database & Auth Accessors
function getDb() {
  return window.db || (typeof firebase !== 'undefined' ? firebase.database() : null);
}

function getAuth() {
  return window.auth || (typeof firebase !== 'undefined' ? firebase.auth() : null);
}

// ==========================================
// 1. GOOGLE OAUTH SECURITY GATEWAY
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  const authInstance = getAuth();
  if (authInstance) {
    authInstance.onAuthStateChanged((user) => {
      if (user) {
        if (ALLOWED_ADMIN_EMAILS.includes(user.email)) {
          unlockPanelUI(`Google Admin: ${user.email}`);
        } else {
          showAuthError(`Access Denied: ${user.email} is not authorized.`);
          lockAdminUI();
        }
      } else {
        lockAdminUI();
      }
    });
  }
});

function signInAdminGoogle() {
  const authInstance = getAuth();
  if (!authInstance) return;

  const provider = new firebase.auth.GoogleAuthProvider();
  authInstance.signInWithPopup(provider).then((result) => {
    if (!ALLOWED_ADMIN_EMAILS.includes(result.user.email)) {
      showAuthError(`Account ${result.user.email} is not authorized.`);
      authInstance.signOut();
    }
  }).catch((error) => {
    if (error.code !== "auth/popup-closed-by-user") {
      showAuthError("Google Sign-In Error: " + error.message);
    }
  });
}

function unlockPanelUI(identityLabel) {
  const overlay = document.getElementById("admin-auth-overlay");
  const content = document.getElementById("admin-main-content");
  const emailLabel = document.getElementById("admin-user-email");

  if (overlay) overlay.classList.add("hidden");
  if (content) content.classList.remove("hidden");
  if (emailLabel) emailLabel.innerText = identityLabel;

  // Initialize listeners & screener once unlocked
  listenToMaintenanceState();
  listenToActiveTasks();
  initAdminScreener();
}

function lockAdminUI() {
  const overlay = document.getElementById("admin-auth-overlay");
  const content = document.getElementById("admin-main-content");

  if (overlay) overlay.classList.remove("hidden");
  if (content) content.classList.add("hidden");
}

function lockAdminPanel() {
  const authInstance = getAuth();
  if (authInstance) authInstance.signOut();
  window.location.reload();
}

function showAuthError(msg) {
  const errorEl = document.getElementById("admin-auth-error");
  if (errorEl) {
    if (msg) {
      errorEl.innerText = msg;
      errorEl.classList.remove("hidden");
    } else {
      errorEl.classList.add("hidden");
    }
  }
}

// ==========================================
// 2. LIVE SCREENER & ANALYTICS ENGINE
// ==========================================
function initAdminScreener() {
  const dbInstance = getDb();
  if (!dbInstance) return;

  const usersRef = dbInstance.ref("users");

  usersRef.on("value", (snapshot) => {
    const usersData = snapshot.val() || {};

    let totalUsers = 0;
    let totalMinedTokens = 0;
    let dailyActiveUsers = 0;
    let totalReferralsCount = 0;

    const now = Date.now();
    const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

    Object.keys(usersData).forEach((uid) => {
      const user = usersData[uid];
      totalUsers++;

      if (user.balance) {
        totalMinedTokens += parseFloat(user.balance) || 0;
      }

      if (user.lastCheckIn && (now - user.lastCheckIn) <= TWENTY_FOUR_HOURS_MS) {
        dailyActiveUsers++;
      }

      if (user.referralsCount) {
        totalReferralsCount += parseInt(user.referralsCount, 10) || 0;
      }
    });

    renderScreenerMetrics({
      totalUsers,
      totalMinedTokens,
      dailyActiveUsers,
      totalReferralsCount
    });
  });
}

function renderScreenerMetrics(stats) {
  const minedEl = document.getElementById("stat-total-mined");
  const totalUsersEl = document.getElementById("stat-total-users");
  const dauEl = document.getElementById("stat-dau");
  const refsEl = document.getElementById("stat-total-refs");

  if (minedEl) minedEl.innerText = stats.totalMinedTokens.toFixed(2) + " BKT";
  if (totalUsersEl) totalUsersEl.innerText = stats.totalUsers.toLocaleString();
  if (dauEl) dauEl.innerText = stats.dailyActiveUsers.toLocaleString();
  if (refsEl) refsEl.innerText = stats.totalReferralsCount.toLocaleString();
}

// ==========================================
// 3. MAINTENANCE MODE TOGGLE
// ==========================================
function listenToMaintenanceState() {
  const dbInstance = getDb();
  if (!dbInstance) return;

  dbInstance.ref("system/maintenance").on("value", (snap) => {
    isMaintenanceActive = snap.val() === true;
    const btn = document.getElementById("maintenance-btn");
    if (btn) {
      if (isMaintenanceActive) {
        btn.innerText = "ACTIVE (OFF)";
        btn.className = "px-4 py-2 bg-red-600/30 text-red-400 border border-red-500/50 font-bold text-xs rounded-xl hover:bg-red-600/40 transition-all";
      } else {
        btn.innerText = "INACTIVE (ON)";
        btn.className = "px-4 py-2 bg-emerald-950/60 text-[#00ff66] border border-[#1c422a] font-bold text-xs rounded-xl hover:bg-emerald-900/60 transition-all";
      }
    }
  });
}

async function toggleMaintenance() {
  const dbInstance = getDb();
  if (!dbInstance) return;

  try {
    await dbInstance.ref("system/maintenance").set(!isMaintenanceActive);
  } catch (err) {
    alert("Error toggling maintenance: " + err.message);
  }
}

// ==========================================
// 4. TASK MANAGEMENT
// ==========================================
async function handlePublishTask() {
  const title = document.getElementById('task-title').value.trim();
  const rewardStr = document.getElementById('task-reward').value.trim();
  const icon = document.getElementById('task-icon').value.trim() || '📌';
  const link = document.getElementById('task-link').value.trim();
  const category = document.getElementById('task-category').value;
  const proofReq = document.getElementById('task-proof-req').checked;

  const reward = parseFloat(rewardStr);

  if (!title || isNaN(reward) || reward <= 0 || !link) {
    alert("Please fill in all required task fields with valid data.");
    return;
  }

  const dbInstance = getDb();
  if (!dbInstance) return;

  const newTaskRef = dbInstance.ref('tasks').push();
  const taskData = {
    title,
    reward,
    icon,
    link,
    category,
    proofReq,
    createdAt: Date.now()
  };

  try {
    await newTaskRef.set(taskData);
    alert("Task published successfully!");
    document.getElementById('task-title').value = '';
    document.getElementById('task-reward').value = '';
    document.getElementById('task-icon').value = '';
    document.getElementById('task-link').value = '';
    document.getElementById('task-proof-req').checked = false;
  } catch (err) {
    alert("Error publishing task: " + err.message);
  }
}

function listenToActiveTasks() {
  const dbInstance = getDb();
  if (!dbInstance) return;

  dbInstance.ref('tasks').on('value', (snap) => {
    const listEl = document.getElementById('active-tasks-list');
    if (!listEl) return;

    const tasks = snap.val();
    if (!tasks) {
      listEl.innerHTML = '<p class="text-gray-500 italic">No active tasks found.</p>';
      return;
    }

    let html = '';
    Object.keys(tasks).forEach((taskId) => {
      const task = tasks[taskId];
      html += `
        <div class="card-bg p-3 rounded-xl flex items-center justify-between border border-[#1c2620]">
          <div>
            <p class="font-semibold text-white">${task.title} <span class="text-gray-500 text-[10px]">(${task.category})</span> ${task.proofReq ? '🔒' : ''}</p>
            <p class="text-[#00ff66] text-[11px]">+${task.reward} BKT</p>
          </div>
          <button onclick="handleDeleteTask('${taskId}')" class="px-3 py-1.5 bg-red-900/30 text-red-400 border border-red-800/40 rounded-lg text-xs font-semibold hover:bg-red-800/40">
            Delete
          </button>
        </div>
      `;
    });

    listEl.innerHTML = html;
  });
}

async function handleDeleteTask(taskId) {
  if (!confirm("Are you sure you want to delete this task?")) return;
  const dbInstance = getDb();
  if (dbInstance) {
    await dbInstance.ref(`tasks/${taskId}`).remove();
  }
}

// ==========================================
// 5. GRANT TOKEN BONUS
// ==========================================
async function handleGrantBonus() {
  const uid = document.getElementById('bonus-uid-input').value.trim();
  const amountStr = document.getElementById('bonus-amount-input').value.trim();
  const amount = parseFloat(amountStr);

  if (!uid || isNaN(amount) || amount <= 0) {
    alert("Please enter a valid User UID and a positive bonus amount.");
    return;
  }

  const dbInstance = getDb();
  if (!dbInstance) return;

  const userRef = dbInstance.ref(`users/${uid}`);

  try {
    const result = await userRef.child('balance').transaction((currentBalance) => {
      return (currentBalance || 0) + amount;
    });

    if (result.committed) {
      alert(`Successfully added +${amount} BKT to User: ${uid}`);
      document.getElementById('bonus-uid-input').value = '';
      document.getElementById('bonus-amount-input').value = '';
    } else {
      alert("Failed to update balance. Please verify the UID.");
    }
  } catch (error) {
    alert("Error granting bonus: " + error.message);
  }
}

// ==========================================
// 6. ADD ADDITIONAL REFERRAL SLOTS / COUNTS
// ==========================================
async function handleAddReferrals() {
  const uid = document.getElementById('ref-uid-input').value.trim();
  const refCountStr = document.getElementById('ref-count-input').value.trim();
  const additionalSlots = parseInt(refCountStr, 10);

  if (!uid || isNaN(additionalSlots) || additionalSlots <= 0) {
    alert("Please enter a valid User UID and positive referral count.");
    return;
  }

  const dbInstance = getDb();
  if (!dbInstance) return;

  const userRef = dbInstance.ref(`users/${uid}`);

  try {
    const result = await userRef.child('bonusReferralSlots').transaction((currentSlots) => {
      return (currentSlots || 0) + additionalSlots;
    });

    if (result.committed) {
      alert(`Successfully added +${additionalSlots} invite slots to User: ${uid}`);
      document.getElementById('ref-uid-input').value = '';
      document.getElementById('ref-count-input').value = '';
    } else {
      alert("Failed to update referral slots. Please verify the UID.");
    }
  } catch (error) {
    alert("Error updating referral slots: " + error.message);
  }
}

// ==========================================
// 7. BAN / UNBAN USER
// ==========================================
async function handleBanUser(shouldBan) {
  const uid = document.getElementById('ban-uid-input').value.trim();
  if (!uid) {
    alert("Please enter a User UID.");
    return;
  }

  const dbInstance = getDb();
  if (!dbInstance) return;

  try {
    await dbInstance.ref(`users/${uid}/isBanned`).set(shouldBan);
    alert(`User ${uid} has been ${shouldBan ? 'BANNED' : 'UNBANNED'} successfully.`);
    document.getElementById('ban-uid-input').value = '';
  } catch (err) {
    alert("Error updating ban status: " + err.message);
  }
}
