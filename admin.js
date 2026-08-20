// Safe Database & Auth Accessors
function getDb() {
  return window.db || (typeof firebase !== 'undefined' ? firebase.database() : null);
}

function getAuth() {
  return window.auth || (typeof firebase !== 'undefined' ? firebase.auth() : null);
}

let isMaintenanceActive = false;

// Initialization Guard & Listeners
document.addEventListener("DOMContentLoaded", () => {
  const authInstance = getAuth();
  if (authInstance) {
    authInstance.onAuthStateChanged((user) => {
      if (!user) {
        window.location.href = "login.html";
      }
    });
  }

  listenToMaintenanceState();
  listenToActiveTasks();
});

// ==========================================
// 1. MAINTENANCE MODE TOGGLE
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
// 2. TASK MANAGEMENT
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
// 3. GRANT TOKEN BONUS
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
// 4. ADD ADDITIONAL REFERRALS
// ==========================================
async function handleAddReferrals() {
  const uid = document.getElementById('ref-uid-input').value.trim();
  const refCountStr = document.getElementById('ref-count-input').value.trim();
  const additionalRefs = parseInt(refCountStr, 10);

  if (!uid || isNaN(additionalRefs) || additionalRefs <= 0) {
    alert("Please enter a valid User UID and positive referral count.");
    return;
  }

  const dbInstance = getDb();
  if (!dbInstance) return;

  const userRef = dbInstance.ref(`users/${uid}`);

  try {
    const result = await userRef.child('referralsCount').transaction((currentCount) => {
      return (currentCount || 0) + additionalRefs;
    });

    if (result.committed) {
      alert(`Successfully added +${additionalRefs} referrals to User: ${uid}`);
      document.getElementById('ref-uid-input').value = '';
      document.getElementById('ref-count-input').value = '';
    } else {
      alert("Failed to update referrals. Please verify the UID.");
    }
  } catch (error) {
    alert("Error updating referrals: " + error.message);
  }
}

// ==========================================
// 5. BAN / UNBAN USER
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
