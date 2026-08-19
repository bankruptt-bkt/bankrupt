import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
  getFirestore, 
  doc, 
  getDoc,
  updateDoc, 
  increment, 
  arrayUnion 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ================= FIREBASE CONFIG =================
const firebaseConfig = {
  // Insert your Firebase configuration object here
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Current active user reference
const currentUser = {
  uid: "Probhat" // Matches the document ID in your 'users' collection
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
        balanceElem.innerText = (data.balance || 0).toFixed(4);
      }
    }
  } catch (err) {
    console.error("Failed to load user data:", err);
  }
}

// ================= TASK RENDER & CLICK HANDLERS =================
function renderTaskCard(task) {
  const isCompleted = completedTasks.includes(task.id);

  return `
    <div class="task-card">
      <div style="display: flex; align-items: center; gap: 12px;">
        <div class="task-icon-box">${task.icon || '⚡'}</div>
        <div>
          <div class="task-title">${task.title}</div>
          <div class="task-desc">${task.desc}</div>
          <div class="task-reward">+${task.reward} BKT</div>
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

  const userRef = doc(db, "users", currentUser.uid);

  try {
    // Atomically increments balance & saves completed task ID to Firestore
    await updateDoc(userRef, {
      balance: increment(reward),
      completedTasks: arrayUnion(taskId)
    });

    completedTasks.push(taskId);
    await loadUserData();
    loadTasks();
  } catch (err) {
    console.error("Task completion failed:", err);
  }
}

// Filter tasks and load into DOM
function loadTasks() {
  // Sample task list (Replace/Expand as needed)
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
