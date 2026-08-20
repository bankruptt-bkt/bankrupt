<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Profile - BANKRUPT Mining App</title>
  
  <!-- Eruda Mobile Console for Debugging -->
  <script src="https://cdn.jsdelivr.net/npm/eruda"></script>
  <script>eruda.init();</script>
  
  <!-- Tailwind CSS & App Styles -->
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="style.css">
  
  <!-- Fonts & Icons -->
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Permanent+Marker&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  
  <style>
    body { background-color: #0b0f0c; color: #e2e8f0; font-family: 'Inter', sans-serif; }
    .font-marker { font-family: 'Permanent Marker', cursive; }
    .neon-text { color: #00ff66; text-shadow: 0 0 10px rgba(0, 255, 102, 0.6); }
    .card-bg { background-color: #121814; border: 1px solid #1c2620; }
    .card-inner { background-color: #0a0d0b; border: 1px solid #162019; }
    
    /* Glowing Avatar Ring */
    .avatar-ring {
      box-shadow: 0 0 20px rgba(0, 255, 102, 0.35);
    }
  </style>
</head>
<body class="pb-28 max-w-md mx-auto relative min-h-screen border-x border-gray-900">

  <!-- TOP HEADER -->
  <header class="flex items-center justify-between p-4 pt-6">
    <a href="index.html" class="text-gray-300 text-lg p-2 bg-[#121814] rounded-lg border border-[#1c2620] hover:border-[#00ff66] transition-colors">
      <i class="fa-solid fa-chevron-left"></i>
    </a>
    <h1 class="font-bold text-lg text-white">Profile</h1>
    <button onclick="openComingSoon('Settings')" class="text-gray-300 text-lg p-2 bg-[#121814] rounded-lg border border-[#1c2620] hover:border-[#00ff66] transition-colors">
      <i class="fa-solid fa-gear"></i>
    </button>
  </header>

  <main class="px-4 space-y-5">

    <!-- USER PROFILE IDENTIFIER SECTION -->
    <div class="flex flex-col items-center justify-center text-center space-y-2 mt-2">
      <div class="relative">
        <div class="w-28 h-28 rounded-full border-2 border-[#00ff66] avatar-ring overflow-hidden bg-[#0a0d0b] flex items-center justify-center">
          <img id="user-avatar" src="assets/images/profile/default.jpg" alt="Profile Logo" class="w-full h-full object-cover onerror-fallback" onerror="this.onerror=null; this.src='https://via.placeholder.com/150/0a0d0b/00ff66?text=👑';">
        </div>
        <button onclick="openBadgeSelector()" class="absolute bottom-0 right-0 bg-[#00ff66] text-black w-8 h-8 rounded-full flex items-center justify-center border-2 border-[#0b0f0c] shadow-lg hover:scale-105 transition-transform">
          <i class="fa-solid fa-pen text-xs"></i>
        </button>
      </div>

      <div>
        <h2 id="profile-display-name" class="text-xl font-bold text-white tracking-wide">Loading...</h2>
        <p id="profile-uid" class="text-xs text-gray-500 font-mono mt-0.5">UID: ...</p>
      </div>
    </div>

    <!-- STATS OVERVIEW GRID -->
    <div class="card-bg rounded-2xl p-3.5 grid grid-cols-4 gap-2 text-center">
      <!-- Balance -->
      <div class="flex flex-col items-center justify-center">
        <div class="w-7 h-7 rounded-full bg-[#18261e] border border-[#00ff66]/40 flex items-center justify-center text-[#00ff66] text-xs mb-1">
          <i class="fa-solid fa-dollar-sign"></i>
        </div>
        <span id="stat-balance" class="font-bold text-white text-sm truncate max-w-full">0.0000</span>
        <span class="text-[10px] text-gray-500 font-medium">Balance</span>
      </div>

      <!-- Current Streak -->
      <div class="flex flex-col items-center justify-center">
        <div class="w-7 h-7 rounded-full bg-[#201c18] border border-orange-500/40 flex items-center justify-center text-orange-400 text-xs mb-1">
          <i class="fa-solid fa-fire"></i>
        </div>
        <span id="stat-streak" class="font-bold text-white text-sm">0</span>
        <span class="text-[10px] text-gray-500 font-medium">Streak</span>
      </div>

      <!-- Longest Streak -->
      <div class="flex flex-col items-center justify-center">
        <div class="w-7 h-7 rounded-full bg-[#201d24] border border-purple-500/40 flex items-center justify-center text-purple-400 text-xs mb-1">
          <i class="fa-solid fa-trophy"></i>
        </div>
        <span id="stat-longest" class="font-bold text-white text-sm">0</span>
        <span class="text-[10px] text-gray-500 font-medium">Longest</span>
      </div>

      <!-- Total Referrals -->
      <div class="flex flex-col items-center justify-center">
        <div class="w-7 h-7 rounded-full bg-[#182026] border border-blue-500/40 flex items-center justify-center text-blue-400 text-xs mb-1">
          <i class="fa-solid fa-users"></i>
        </div>
        <span id="stat-referrals" class="font-bold text-white text-sm">0</span>
        <span class="text-[10px] text-gray-500 font-medium">Referrals</span>
      </div>
    </div>

    <!-- BADGES SECTION -->
    <div class="card-bg rounded-2xl p-4 space-y-3">
      <div class="flex items-center justify-between">
        <span class="font-bold text-xs text-gray-300 tracking-wider">BADGES</span>
        <a href="javascript:void(0)" onclick="openBadgeSelector()" class="text-xs text-gray-500 hover:text-[#00ff66] transition-colors flex items-center gap-1">
          View all <i class="fa-solid fa-chevron-right text-[10px]"></i>
        </a>
      </div>

      <div id="badges-container" class="grid grid-cols-4 gap-2">
        <!-- Rendered dynamically via profile.js -->
        <div class="text-center text-xs text-gray-500 col-span-4 py-4">Loading achievements...</div>
      </div>
    </div>

    <!-- QUICK HISTORY & LOGS LINKS -->
    <div class="card-bg rounded-2xl overflow-hidden divide-y divide-[#1c2620]">
      <button onclick="openHistoryModal('streak')" class="w-full p-4 flex items-center justify-between hover:bg-[#18221b] transition-colors text-left">
        <div class="flex items-center gap-3">
          <span class="text-lg">🐰</span>
          <span class="text-xs font-semibold text-gray-200">Streak History</span>
        </div>
        <i class="fa-solid fa-chevron-right text-xs text-gray-600"></i>
      </button>

      <button onclick="openHistoryModal('transaction')" class="w-full p-4 flex items-center justify-between hover:bg-[#18221b] transition-colors text-left">
        <div class="flex items-center gap-3">
          <span class="text-lg">🎯</span>
          <span class="text-xs font-semibold text-gray-200">Transaction History</span>
        </div>
        <i class="fa-solid fa-chevron-right text-xs text-gray-600"></i>
      </button>

      <button onclick="openHistoryModal('referral')" class="w-full p-4 flex items-center justify-between hover:bg-[#18221b] transition-colors text-left">
        <div class="flex items-center gap-3">
          <span class="text-lg">📇</span>
          <span class="text-xs font-semibold text-gray-200">Referral History</span>
        </div>
        <i class="fa-solid fa-chevron-right text-xs text-gray-600"></i>
      </button>
    </div>

  </main>

  <!-- HISTORY MODAL -->
  <div id="history-modal" class="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] hidden flex items-center justify-center p-4">
    <div class="card-bg rounded-2xl p-5 border border-[#1c2620] max-w-sm w-full space-y-4 relative max-h-[80vh] flex flex-col">
      <div class="flex items-center justify-between border-b border-[#1c2620] pb-3">
        <h3 id="history-modal-title" class="text-white font-bold text-sm">History</h3>
        <button onclick="closeHistoryModal()" class="text-gray-400 hover:text-white text-base">✕</button>
      </div>

      <div id="history-modal-list" class="overflow-y-auto space-y-2 flex-1 pr-1 text-xs">
        <!-- Rendered dynamically -->
      </div>
    </div>
  </div>

  <!-- BADGE & LOGO SELECTOR MODAL -->
  <div id="badge-modal" class="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] hidden flex items-center justify-center p-4">
    <div class="card-bg rounded-2xl p-5 border border-[#1c2620] max-w-sm w-full space-y-4 relative max-h-[85vh] flex flex-col">
      <div class="flex items-center justify-between border-b border-[#1c2620] pb-3">
        <div>
          <h3 class="text-white font-bold text-sm">Select Profile Badge Logo</h3>
          <p class="text-[10px] text-gray-500">Choose an unlocked logo from your achievements</p>
        </div>
        <button onclick="closeBadgeModal()" class="text-gray-400 hover:text-white text-base">✕</button>
      </div>

      <div id="badge-selector-grid" class="grid grid-cols-2 gap-3 overflow-y-auto flex-1 pr-1">
        <!-- Rendered dynamically -->
      </div>
    </div>
  </div>

  <!-- BOTTOM NAVIGATION BAR -->
  <nav class="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-[#0a0d0b] border-t border-[#1a241e] px-4 py-2 flex justify-between items-center text-xs text-gray-500 z-40">
    <a href="index.html" class="flex flex-col items-center gap-1 hover:text-gray-300">
      <i class="fa-solid fa-house text-base"></i>
      <span>Home</span>
    </a>
    <a href="shop.html" class="flex flex-col items-center gap-1 hover:text-gray-300">
      <i class="fa-solid fa-cart-shopping text-base"></i>
      <span>Shop</span>
    </a>
    <a href="tasks.html" class="flex flex-col items-center gap-1 hover:text-gray-300">
      <i class="fa-solid fa-clipboard-list text-base"></i>
      <span>Tasks</span>
    </a>
    <a href="leaderboard.html" class="flex flex-col items-center gap-1 hover:text-gray-300">
      <i class="fa-solid fa-trophy text-base"></i>
      <span>Leaderboard</span>
    </a>
    <a href="profile.html" class="flex flex-col items-center gap-1 text-[#00ff66]">
      <i class="fa-solid fa-user text-base"></i>
      <span>Profile</span>
    </a>
  </nav>

  <!-- Firebase SDKs -->
  <script src="https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.8.0/firebase-database-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.8.0/firebase-auth-compat.js"></script>

  <!-- App Scripts -->
  <script src="firebase-config.js"></script>
  <script src="app.js?v=6.0"></script>
  <script src="profile.js?v=1.1"></script>
</body>
</html>
