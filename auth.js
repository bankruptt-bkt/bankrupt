// auth.js - Responsive Auth Logic

// Helper to detect if user is on mobile
function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
    || window.innerWidth <= 768;
}

// 2. GOOGLE OAUTH SIGN IN (Mobile Responsive)
async function handleGoogleSignIn() {
  try {
    const { auth } = getFirebase();
    const provider = new firebase.auth.GoogleAuthProvider();

    if (isMobileDevice()) {
      // Direct full-page redirect for mobile browsers (Forces mobile layout)
      await auth.signInWithRedirect(provider);
    } else {
      // Pop-up mode for desktop screens
      const res = await auth.signInWithPopup(provider);
      await processUserRegistration(res.user, getFirebase().db);
      window.location.href = 'index.html';
    }
  } catch (err) {
    console.error("Google Auth Error:", err);
    alert("Google Sign-In Error: " + err.message);
  }
}

// 3. TWITTER (X) OAUTH SIGN IN (Mobile Responsive)
async function handleTwitterSignIn() {
  try {
    const { auth } = getFirebase();
    const provider = new firebase.auth.TwitterAuthProvider();

    if (isMobileDevice()) {
      await auth.signInWithRedirect(provider);
    } else {
      const res = await auth.signInWithPopup(provider);
      await processUserRegistration(res.user, getFirebase().db);
      window.location.href = 'index.html';
    }
  } catch (err) {
    console.error("Twitter Auth Error:", err);
    alert("X (Twitter) Sign-In Error: " + err.message);
  }
}

// 4. HANDLE REDIRECT RESULT ON PAGE LOAD (Required for Mobile Redirects)
window.addEventListener('DOMContentLoaded', async () => {
  try {
    const { auth, db } = getFirebase();
    const result = await auth.getRedirectResult();
    
    if (result && result.user) {
      await processUserRegistration(result.user, db);
      window.location.href = 'index.html';
    }
  } catch (err) {
    console.error("Redirect Auth Error:", err);
  }
});
