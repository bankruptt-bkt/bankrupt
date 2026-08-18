import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, getDocs, doc, getDoc, updateDoc, increment, arrayUnion } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let currentUser = null;
let completedTasks = [];
let activeCategory = "Daily";

const tasksContainer = document.getElementById("tasks-container");
const balanceDisplay = document.querySelector(".balance-val");
const filterBtns = document.querySelectorAll(".filter-btn");

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    await loadUserData();
    await loadTasks();
  }
});

// Load user completed tasks and balance
async function loadUserData() {
  const userRef = doc(db, "users", currentUser.uid);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    const data = userSnap.data();
    completedTasks = data.completedTasks || [];
    if (balanceDisplay) {
      balanceDisplay.textContent = `${(data.balance || 0).toFixed(4)} BKT`;
    }
  }
}

// Fetch tasks dynamically from Firestore
async function loadTasks() {
  if (!tasksContainer) return;
  tasksContainer.innerHTML = "<p style='color:#888; text-align:center;'>Loading tasks...</p>";

  try {
    const querySnapshot = await getDocs(collection(db, "tasks"));
    tasksContainer.innerHTML = "";

    querySnapshot.forEach((docSnap) => {
      const task = docSnap.data();
      const taskId = docSnap.id;

      if (task.category === activeCategory) {
        renderTaskCard(taskId, task);
      }
    });

    if (tasksContainer.innerHTML === "") {
      tasksContainer.innerHTML = "<p style='color:#666; text-align:center;'>No tasks in this category.</p>";
    }
  } catch (err) {
    console.error("Error fetching tasks:", err);
  }
}

// Render individual task item UI matching screenshot
function renderTaskCard(taskId, task) {
  const isCompleted = completedTasks.includes(taskId);
  
  const card = document.createElement("div");
  card.className = "task-card";

  card.innerHTML = `
    <div class="task-info">
      <div class="task-icon-box">${task.icon || '📋'}</div>
      <div>
        <h3 class="task-title">${task.title}</h3>
        <p class="task-desc">${task.description}</p>
        <p class="task-reward">+${task.reward} BKT</p>
      </div>
    </div>
    ${
      isCompleted
        ? `<div class="completed-check">✓</div>`
        : `<button class="action-btn" data-id="${taskId}" data-reward="${task.reward}" data-url="${task.link}">Go</button>`
    }
  `;

  tasksContainer.appendChild(card);

  // Attach completion listener
  const btn = card.querySelector(".action-btn");
  if (btn) {
    btn.addEventListener("click", () => handleTaskClick(taskId, task.reward, task.link));
  }
}

// Task execution & reward allocation
async function handleTaskClick(taskId, reward, link) {
  if (link && link !== "#") window.open(link, "_blank");

  const userRef = doc(db, "users", currentUser.uid);

  try {
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

// Category Tab Switching
filterBtns.forEach((btn) => {
  btn.addEventListener("click", (e) => {
    filterBtns.forEach((b) => b.classList.remove("active"));
    e.target.classList.add("active");
    activeCategory = e.target.getAttribute("data-category");
    loadTasks();
  });
});
