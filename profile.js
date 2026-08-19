import { db, auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.x.x/firebase-auth.js";
import { doc, getDoc, setDoc, runTransaction } from "https://www.gstatic.com/firebasejs/9.x.x/firebase-firestore.js";

const REFERRAL_REWARD = 100;
const MAX_REFERRALS = 10;

// Immediate DOM Setup (Runs instantly before waiting on Firebase)
document.addEventListener("DOMContentLoaded", () => {
  renderReferralLink("guest");
});

// Firebase Auth Listener
try {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      renderReferralLink(user.uid);
      await handleIncomingWebReferral(user);

      try {
        const userSnap = await getDoc(doc(db, "users", user.uid));
        const refCount = userSnap.exists() ? (userSnap.data().referralCount || 0) : 0;
        const countDisplay = document.getElementById("ref-count-display");
        if (countDisplay) countDisplay.textContent = `${refCount} / ${MAX_REFERRALS}`;
      } catch (e) {
        console.error("Firestore read error:", e);
      }
    }
  });
} catch (err) {
  console.error("Firebase Auth failed to initialize:", err);
}

function renderReferralLink(userId) {
  const refInput = document.getElementById("referral-link");
  const copyBtn = document.getElementById("copy-ref-btn");

  const inviteLink = `${window.location.origin}${window.location.pathname}?ref=${userId}`;

  if (refInput) refInput.value = inviteLink;

  if (copyBtn) {
    copyBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(inviteLink);
        alert("Referral link copied!");
      } catch (err) {
        refInput.select();
        document.execCommand("copy");
        alert("Referral link copied!");
      }
    };
  }
}

async function handleIncomingWebReferral(newUser) {
  const newUserRef = doc(db, "users", newUser.uid);
  let newUserSnap;
  
  try {
    newUserSnap = await getDoc(newUserRef);
  } catch (e) {
    console.error("Error fetching user snapshot:", e);
    return;
  }

  if (newUserSnap.exists()) return;

  const urlParams = new URLSearchParams(window.location.search);
  const referrerId = urlParams.get("ref");

  if (!referrerId || referrerId === newUser.uid || referrerId === "guest") {
    await setDoc(newUserRef, {
      username: newUser.displayName || "Anonymous",
      balance: 0,
      referralCount: 0,
      referredBy: null,
      createdAt: new Date()
    });
    return;
  }

  const referrerRef = doc(db, "users", referrerId);

  try {
    await runTransaction(db, async (transaction) => {
      const referrerDoc = await transaction.get(referrerRef);
      let referrerEligible = false;
      let currentRefCounts = 0;

      if (referrerDoc.exists()) {
        currentRefCounts = referrerDoc.data().referralCount || 0;
        if (currentRefCounts < MAX_REFERRALS) referrerEligible = true;
      }

      transaction.set(newUserRef, {
        username: newUser.displayName || "Anonymous",
        balance: referrerEligible ? REFERRAL_REWARD : 0,
        referralCount: 0,
        referredBy: referrerId,
        createdAt: new Date()
      });

      if (referrerEligible) {
        const referrerBalance = referrerDoc.data().balance || 0;
        transaction.update(referrerRef, {
          balance: referrerBalance + REFERRAL_REWARD,
          referralCount: currentRefCounts + 1
        });
      }
    });
  } catch (err) {
    console.error("Error processing referral transaction:", err);
  }
}
