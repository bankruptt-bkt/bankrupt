import { db, auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, doc, onSnapshot, updateDoc, arrayUnion, increment } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let currentCategory = "Daily";
let currentUser = null;
let completedTasks = [];

onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    listenToUserData(user.uid);
  } else {
    window.location.href = "login.html";
  }
});

function listenToUserData(uid) {
  onSnapshot(doc(db, "users", uid), (snap) => {
    if (snap.exists()) {
      completedTasks = snap.data().completedTasks || [];
      renderTasks();
    }
  });
}

export function switchCategory(category, el) {
  currentCategory = category;
  document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
  if (el) el.classList.add("active");
  renderTasks();
}

window.switchCategory = switchCategory;

function renderTasks() {
  const container = document.getElementById("tasks-list");
  
  onSnapshot(collection(db, "tasks"), (snapshot) => {
    container.innerHTML = "";
    
    const filtered = [];
    snapshot.forEach((docSnap) => {
      const task = { id: docSnap.id, ...docSnap.data() };
      if ((task.category || "Daily") === currentCategory) {
        filtered.push(task);
      }
    });

    if (filtered.length === 0) {
      container.innerHTML = `<div style="color: #889988; text-align: center; margin-top: 20px;">No tasks available in ${currentCategory}.</div>`;
      return;
    }

    filtered.forEach((task) => {
      const isDone = completedTasks.includes(task.id);
      container.innerHTML += `
        <div class="task-card">
          <div class="task-left">
            <div class="task-icon-box">${task.icon || '📋'}</div>
            <div>
              <div class="task-title">${task.title}</div>
              <div class="task-reward">+${task.reward} BKT</div>
            </div>
          </div>
          ${isDone 
            ? `<button class="task-btn completed">Completed</button>`
            : `<button class="task-btn" onclick="completeTask('${task.id}', ${task.reward}, '${task.link}')">Start</button>`
          }
        </div>
      `;
    });
  });
}

window.completeTask = async function(taskId, reward, link) {
  if (!currentUser) return;
  if (link && link !== "#") window.open(link, "_blank");

  try {
    const userRef = doc(db, "users", currentUser.uid);
    await updateDoc(userRef, {
      balance: increment(reward),
      completedTasks: arrayUnion(taskId)
    });
  } catch (err) {
    console.error("Error completing task:", err);
  }
};
