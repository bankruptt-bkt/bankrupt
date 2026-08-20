import { db, auth } from "./conf.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, doc, getDoc, updateDoc, arrayUnion, increment, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let currentCategory = "Daily";
let currentUser = null;
let completedTaskIds = [];

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (userDoc.exists()) {
      completedTaskIds = userDoc.data().completedTasks || [];
    }
    loadTasks();
  } else {
    window.location.href = "login.html";
  }
});

window.filterTasks = (category, element) => {
  currentCategory = category;
  document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
  element.classList.add("active");
  loadTasks();
};

function loadTasks() {
  const container = document.getElementById("tasks-list");
  
  onSnapshot(collection(db, "tasks"), (snapshot) => {
    container.innerHTML = "";
    let tasksFound = false;

    snapshot.forEach((taskDoc) => {
      const task = taskDoc.data();
      if ((task.category || "Daily") === currentCategory) {
        tasksFound = true;
        const isDone = completedTaskIds.includes(taskDoc.id);

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
              ? `<button class="task-btn completed" disabled>✓ Done</button>`
              : `<button class="task-btn" onclick="executeTask('${taskDoc.id}', '${task.link}', ${task.reward})">Start</button>`
            }
          </div>
        `;
      }
    });

    if (!tasksFound) {
      container.innerHTML = `<div style="text-align: center; color: var(--text-gray);">No ${currentCategory} tasks available right now.</div>`;
    }
  });
}

window.executeTask = async (taskId, link, reward) => {
  if (link && link !== "#") window.open(link, "_blank");
  
  if (!currentUser) return;
  
  try {
    const userRef = doc(db, "users", currentUser.uid);
    await updateDoc(userRef, {
      balance: increment(reward),
      completedTasks: arrayUnion(taskId)
    });
    completedTaskIds.push(taskId);
    loadTasks();
  } catch (err) {
    console.error("Error completing task:", err);
  }
};
