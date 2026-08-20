import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
  getFirestore, 
  doc, 
  getDoc,
  setDoc, 
  increment, 
  arrayUnion 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ================= FIREBASE CONFIG =================
const firebaseConfig = {
  apiKey: "AIzaSyBQT7gM7JxE26bFq061VvZauWkEGjyHPWM",
  authDomain: "bankrupt-9068b.firebaseapp.com",
  databaseURL: "https://bankrupt-9068b-default-rtdb.firebaseio.com",
  projectId: "bankrupt-9068b",
  storageBucket: "bankrupt-9068b.firebasestorage.app",
  messagingSenderId: "961644576786",
  appId: "1:961644576786:web:65eff34df07a18067458cb"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Current active user reference
const currentUser = {
  uid: localStorage.getItem("bkt_user_id") || "Probhat"
};

// Global state tracking
let completedTasks = [];
let activeCategory = "all";

// DOM Elements
const taskListContainer = document.getElementById("task-list");
const filterBtns = document.querySelectorAll(".filter-btn");

// ================= USER DATA LOADER =================
async function loadUserData() {
  try {
    const userRef = doc(db, "users", currentUser.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const data = userSnap.data();
      completedTasks = data.completedTasks || [];
      
      // Update UI balance if element exists on page
      const balanceElem = document.getElementById("user-balance");
      if (balanceElem) {
        balanceElem.innerText = Number(data.balance || 0).toFixed(2);
      }
    }
  } catch (err) {
    console.error("Failed to load user data:", err);
  }
}

// ================= TASK RENDER & CLICK HANDLERS =================
function renderTaskCard(task) {
  const isCompleted = completedTasks.includes(task.id);
  const rewardVal = parseFloat(task.reward) || 0;

  return `
    <div class="task-card">
      <div style="display: flex; align-items: center; gap: 12px;">
        <div class="task-icon-box">${task.icon || '⚡'}</div>
        <div>
          <div class="task-title">${task.title}</div>
          <div class="task-desc">${task.desc || ''}</div>
          <div class="task-reward">+${rewardVal} BKT</div>
        </div>
      </div>
      <div>
        ${
          isCompleted
            ? `<div class="completed-check">✓</div>`
            : `<button class="action-btn" id="btn-${task.id}">Start</button>`
        }
      </div>
    </div>
  `;
}

function attachTaskListeners(tasks) {
  tasks.forEach((task) => {
    if (!completedTasks.includes(task.id)) {
      const btn = document.getElementById(`btn-${task.id}`);
      if (btn) {
        btn.addEventListener("click", () => handleTaskClick(task.id, task.reward, task.link));
      }
    }
  });
}

// Task execution & reward allocation
async function handleTaskClick(taskId, reward, link) {
  if (link && link !== "#") {
    window.open(link, "_blank");
  }

  // Ensure reward is strictly a numeric float/int
  const numericReward = parseFloat(reward);
  if (isNaN(numericReward) || numericReward <= 0) {
    console.error("Invalid reward value:", reward);
    return;
  }

  // Prevent double execution if already in memory array
  if (completedTasks.includes(taskId)) return;

  const userRef = doc(db, "users", currentUser.uid);

  try {
    // setDoc with { merge: true } safely creates the doc if missing, or updates if present
    await setDoc(userRef, {
      balance: increment(numericReward),
      completedTasks: arrayUnion(taskId)
    }, { merge: true });

    completedTasks.push(taskId);
    await loadUserData();
    loadTasks();
  } catch (err) {
    console.error("Task completion failed:", err);
  }
}

// Filter tasks and load into DOM
function loadTasks() {
  const allTasks = [
    { id: "task_1", category: "social", title: "Follow on X", desc: "Join our official Twitter", reward: 25, link: "https://x.com", icon: "🐦" },
    { id: "task_2", category: "social", title: "Join Telegram", desc: "Stay updated on channel", reward: 30, link: "https://t.me", icon: "✈️" },
    { id: "task_3", category: "daily", title: "Share App", desc: "Invite your degen friends", reward: 15, link: "#", icon: "📢" }
  ];

  const filtered = activeCategory === "all" 
    ? allTasks 
    : allTasks.filter(t => t.category === activeCategory);

  if (taskListContainer) {
    taskListContainer.innerHTML = filtered.map(t => renderTaskCard(t)).join("");
    attachTaskListeners(filtered);
  }
}

// ================= CATEGORY TAB SWITCHING =================
filterBtns.forEach((btn) => {
  btn.addEventListener("click", (e) => {
    filterBtns.forEach((b) => b.classList.remove("active"));
    e.target.classList.add("active");
    activeCategory = e.target.getAttribute("data-category");
    loadTasks();
  });
});

// ================= INITIALIZATION =================
async function init() {
  await loadUserData();
  loadTasks();
}

init();
