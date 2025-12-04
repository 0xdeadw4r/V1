export const dashboardHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Voice Tracker Dashboard</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    :root {
      --bg-primary: #0f0f10;
      --bg-secondary: #18181b;
      --bg-tertiary: #1f1f23;
      --bg-elevated: #26262b;
      --accent-primary: #e84545;
      --accent-hover: #ff5555;
      --text-primary: #ffffff;
      --text-secondary: #a1a1aa;
      --text-muted: #71717a;
      --border-color: #27272a;
      --success: #22c55e;
      --warning: #f59e0b;
      --danger: #ef4444;
      --info: #3b82f6;
      --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
      --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
      --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);
      --shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1);
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      min-height: 100vh;
      line-height: 1.6;
      overflow-x: hidden;
    }

    /* Login Page */
    .login-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: linear-gradient(135deg, #0f0f10 0%, #1f1f23 100%);
      position: relative;
      overflow: hidden;
    }

    .login-container::before {
      content: '';
      position: absolute;
      width: 500px;
      height: 500px;
      background: radial-gradient(circle, rgba(232, 69, 69, 0.1) 0%, transparent 70%);
      top: -250px;
      right: -250px;
      border-radius: 50%;
    }

    .login-container::after {
      content: '';
      position: absolute;
      width: 400px;
      height: 400px;
      background: radial-gradient(circle, rgba(232, 69, 69, 0.08) 0%, transparent 70%);
      bottom: -200px;
      left: -200px;
      border-radius: 50%;
    }

    .login-box {
      background: var(--bg-secondary);
      padding: 48px;
      border-radius: 16px;
      width: 100%;
      max-width: 440px;
      box-shadow: var(--shadow-xl);
      border: 1px solid var(--border-color);
      position: relative;
      z-index: 1;
      animation: slideUp 0.4s ease-out;
    }

    @keyframes slideUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .login-box .logo {
      text-align: center;
      margin-bottom: 32px;
    }

    .login-box .logo h1 {
      font-size: 28px;
      font-weight: 800;
      background: linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-hover) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 8px;
    }

    .login-box .logo p {
      color: var(--text-secondary);
      font-size: 14px;
      font-weight: 500;
    }

    .form-group {
      margin-bottom: 24px;
    }

    .form-group label {
      display: block;
      margin-bottom: 8px;
      color: var(--text-secondary);
      font-size: 13px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .form-group input {
      width: 100%;
      padding: 14px 16px;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      background: var(--bg-tertiary);
      color: var(--text-primary);
      font-size: 15px;
      transition: all 0.2s;
      font-family: 'Inter', sans-serif;
    }

    .form-group input:focus {
      outline: none;
      border-color: var(--accent-primary);
      background: var(--bg-elevated);
    }

    .btn {
      width: 100%;
      padding: 14px;
      border: none;
      border-radius: 8px;
      background: var(--accent-primary);
      color: var(--text-primary);
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      font-family: 'Inter', sans-serif;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .btn:hover {
      background: var(--accent-hover);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(232, 69, 69, 0.4);
    }

    .btn:active {
      transform: translateY(0);
    }

    .btn:disabled {
      background: var(--bg-elevated);
      cursor: not-allowed;
      transform: none;
      opacity: 0.5;
    }

    .error-msg {
      color: var(--danger);
      text-align: center;
      margin-top: 16px;
      font-size: 13px;
      font-weight: 500;
    }

    /* Dashboard */
    .dashboard-container {
      display: none;
    }

    /* Navbar */
    .navbar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 60px;
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 24px;
      z-index: 1000;
    }

    .navbar-brand {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 18px;
      font-weight: 700;
      color: var(--text-primary);
    }

    .navbar-brand img {
      width: 36px;
      height: 36px;
      border-radius: 50%;
    }

    .navbar-right {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .status-indicator {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      background: var(--bg-tertiary);
      border-radius: 20px;
      font-size: 13px;
      font-weight: 500;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--success);
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    .logout-btn {
      padding: 8px 16px;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      color: var(--text-secondary);
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }

    .logout-btn:hover {
      background: var(--bg-elevated);
      color: var(--text-primary);
      border-color: var(--accent-primary);
    }

    /* Sidebar */
    .sidebar {
      position: fixed;
      left: 0;
      top: 60px;
      width: 260px;
      height: calc(100vh - 60px);
      background: var(--bg-secondary);
      border-right: 1px solid var(--border-color);
      overflow-y: auto;
      z-index: 100;
    }

    .sidebar::-webkit-scrollbar {
      width: 6px;
    }

    .sidebar::-webkit-scrollbar-track {
      background: transparent;
    }

    .sidebar::-webkit-scrollbar-thumb {
      background: var(--bg-elevated);
      border-radius: 3px;
    }

    .sidebar::-webkit-scrollbar-thumb:hover {
      background: var(--border-color);
    }

    nav {
      padding: 16px 12px;
    }

    .nav-section {
      margin-bottom: 24px;
    }

    .nav-section-title {
      padding: 8px 12px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      color: var(--text-muted);
      letter-spacing: 1px;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      margin-bottom: 4px;
      cursor: pointer;
      transition: all 0.2s;
      color: var(--text-secondary);
      font-weight: 500;
      font-size: 14px;
      border-radius: 8px;
      position: relative;
    }

    .nav-item:hover {
      background: var(--bg-tertiary);
      color: var(--text-primary);
    }

    .nav-item.active {
      background: var(--bg-tertiary);
      color: var(--accent-primary);
    }

    .nav-item.active::before {
      content: '';
      position: absolute;
      left: 0;
      top: 50%;
      transform: translateY(-50%);
      height: 60%;
      width: 3px;
      background: var(--accent-primary);
      border-radius: 0 2px 2px 0;
    }

    /* Main Content */
    .main-content {
      margin-left: 260px;
      margin-top: 60px;
      padding: 32px;
      min-height: calc(100vh - 60px);
      background: var(--bg-primary);
    }

    .page-header {
      margin-bottom: 32px;
    }

    .page-header h1 {
      font-size: 28px;
      font-weight: 700;
      color: var(--text-primary);
      margin-bottom: 8px;
    }

    .page-header p {
      color: var(--text-secondary);
      font-size: 14px;
    }

    /* Stats Grid */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 32px;
    }

    .stat-card {
      background: var(--bg-secondary);
      padding: 24px;
      border-radius: 12px;
      border: 1px solid var(--border-color);
      transition: all 0.2s;
    }

    .stat-card:hover {
      transform: translateY(-2px);
      border-color: var(--accent-primary);
      box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
    }

    .stat-card .label {
      color: var(--text-muted);
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .stat-card .value {
      font-size: 32px;
      font-weight: 700;
      color: var(--text-primary);
    }

    .stat-card .value.online {
      color: var(--success);
    }

    .stat-card .value.offline {
      color: var(--danger);
    }

    /* Card */
    .card {
      background: var(--bg-secondary);
      border-radius: 12px;
      border: 1px solid var(--border-color);
      margin-bottom: 24px;
      overflow: hidden;
    }

    .card-header {
      padding: 20px 24px;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .card-header h3 {
      font-size: 18px;
      font-weight: 600;
      color: var(--text-primary);
    }

    .card-body {
      padding: 24px;
    }

    /* Table */
    table {
      width: 100%;
      border-collapse: collapse;
    }

    th, td {
      padding: 14px 16px;
      text-align: left;
      border-bottom: 1px solid var(--border-color);
    }

    th {
      color: var(--text-muted);
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      background: var(--bg-tertiary);
    }

    td {
      color: var(--text-secondary);
      font-size: 14px;
    }

    tr:last-child td {
      border-bottom: none;
    }

    tr:hover td {
      background: var(--bg-tertiary);
    }

    /* Buttons */
    .btn-sm {
      padding: 6px 14px;
      font-size: 12px;
      border-radius: 6px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .btn-danger {
      background: var(--danger);
      color: white;
    }

    .btn-danger:hover {
      background: #dc2626;
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
    }

    .btn-success {
      background: var(--success);
      color: white;
    }

    .btn-success:hover {
      background: #16a34a;
      box-shadow: 0 4px 12px rgba(34, 197, 94, 0.4);
    }

    .btn-warning {
      background: var(--warning);
      color: white;
    }

    .btn-warning:hover {
      background: #d97706;
      box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);
    }

    .btn-primary {
      background: var(--accent-primary);
      color: white;
    }

    .btn-primary:hover {
      background: var(--accent-hover);
      box-shadow: 0 4px 12px rgba(232, 69, 69, 0.4);
    }

    /* Modal */
    .modal {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.7);
      justify-content: center;
      align-items: center;
      z-index: 2000;
      backdrop-filter: blur(4px);
      animation: fadeIn 0.2s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .modal.active {
      display: flex;
    }

    .modal-content {
      background: var(--bg-secondary);
      padding: 32px;
      border-radius: 12px;
      width: 100%;
      max-width: 500px;
      border: 1px solid var(--border-color);
      box-shadow: var(--shadow-xl);
      animation: slideUp 0.3s ease-out;
      overflow: hidden;
      max-height: 90vh;
      overflow-y: auto;
    }

    #addEmbedModal .modal-content {
      max-width: 700px;
    }

    .embed-field-row, .embed-price-row {
      width: 100%;
      box-sizing: border-box;
    }

    .embed-field-row button,
    .embed-price-row button {
      width: auto;
      flex-shrink: 0;
      padding: 6px 12px;
    }

    input[type="number"]::-webkit-outer-spin-button,
    input[type="number"]::-webkit-inner-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }

    input[type="number"] {
      -moz-appearance: textfield;
    }

    input[type="checkbox"] {
      width: auto !important;
      min-width: auto;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }

    .modal-header h3 {
      color: var(--text-primary);
      font-size: 20px;
      font-weight: 700;
    }

    .close-btn {
      background: none;
      border: none;
      color: var(--text-muted);
      font-size: 24px;
      cursor: pointer;
      transition: color 0.2s;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
    }

    .close-btn:hover {
      color: var(--text-primary);
      background: var(--bg-tertiary);
    }

    .guild-select, select {
      width: 100%;
      padding: 12px 16px;
      border-radius: 8px;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      color: var(--text-primary);
      font-size: 14px;
      margin-bottom: 24px;
      font-family: 'Inter', sans-serif;
      font-weight: 500;
      transition: all 0.2s;
    }

    .guild-select:focus, select:focus {
      outline: none;
      border-color: var(--accent-primary);
    }

    /* Active Users */
    .active-users {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px;
    }

    .active-user-card {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      padding: 20px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      gap: 16px;
      transition: all 0.2s;
    }

    .active-user-card:hover {
      transform: translateY(-2px);
      border-color: var(--success);
      box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
    }

    .active-user-card img {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      border: 2px solid var(--success);
    }

    .active-user-info h4 {
      color: var(--text-primary);
      font-size: 15px;
      font-weight: 600;
      margin-bottom: 4px;
    }

    .active-user-info p {
      color: var(--success);
      font-size: 13px;
      font-weight: 500;
    }

    .page { display: none; }
    .page.active { display: block; animation: fadeIn 0.3s ease-out; }

    /* Toast */
    .toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      padding: 16px 24px;
      border-radius: 8px;
      color: var(--text-primary);
      font-weight: 500;
      font-size: 14px;
      z-index: 3000;
      animation: slideInRight 0.3s ease;
      box-shadow: var(--shadow-xl);
      border: 1px solid;
      max-width: 400px;
    }

    @keyframes slideInRight {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }

    .toast.success { 
      background: var(--success);
      border-color: #16a34a;
    }
    .toast.error { 
      background: var(--danger);
      border-color: #dc2626;
    }

    /* Badge */
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .badge-success {
      background: rgba(34, 197, 94, 0.2);
      color: var(--success);
    }

    .badge-danger {
      background: rgba(239, 68, 68, 0.2);
      color: var(--danger);
    }

    .badge-warning {
      background: rgba(245, 158, 11, 0.2);
      color: var(--warning);
    }

    .badge-info {
      background: rgba(59, 130, 246, 0.2);
      color: var(--info);
    }

    .genzauth-status {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .status-indicator-small {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }

    .status-indicator-small.active {
      background: var(--success);
      animation: pulse 2s infinite;
    }

    .status-indicator-small.paused {
      background: var(--danger);
    }

    .empty-state {
      text-align: center;
      padding: 48px 24px;
      color: var(--text-muted);
    }

    .empty-state-text {
      font-size: 14px;
      font-weight: 500;
    }
  </style>
</head>
<body>
  <div class="login-container" id="loginContainer">
    <div class="login-box">
      <div class="logo">
        <h1>Voice Tracker</h1>
        <p>Dashboard Login</p>
      </div>
      <form id="loginForm">
        <div class="form-group">
          <label>Username</label>
          <input type="text" id="username" required autocomplete="username" placeholder="Enter username">
        </div>
        <div class="form-group">
          <label>Password</label>
          <input type="password" id="password" required autocomplete="current-password" placeholder="Enter password">
        </div>
        <button type="submit" class="btn" id="loginBtn">Sign In</button>
        <p class="error-msg" id="loginError"></p>
      </form>
    </div>
  </div>

  <div class="dashboard-container" id="dashboardContainer">
    <nav class="navbar">
      <div class="navbar-brand">
        <img id="navBotAvatar" src="" alt="Bot">
        <span id="navBotName">Voice Tracker</span>
      </div>
      <div class="navbar-right">
        <div class="status-indicator">
          <span class="status-dot" id="navStatusDot"></span>
          <span id="navStatus">Online</span>
        </div>
        <button class="logout-btn" id="logoutBtn">Logout</button>
      </div>
    </nav>

    <aside class="sidebar">
      <nav>
        <div class="nav-section">
          <div class="nav-section-title">Dashboard</div>
          <div class="nav-item active" data-page="overview">
            Overview
          </div>
          <div class="nav-item" data-page="active">
            Active Users
          </div>
        </div>

        <div class="nav-section">
          <div class="nav-section-title">Management</div>
          <div class="nav-item" data-page="staff">
            Staff
          </div>
          <div class="nav-item" data-page="genzauth">
            GenzAuth
          </div>
          <div class="nav-item" data-page="whitelist">
            File Whitelist
          </div>
          <div class="nav-item" data-page="embeds">
            Custom Embeds
          </div>
          <div class="nav-item" data-page="discounts">
            Discounts
          </div>
          <div class="nav-item" data-page="youtube">
            YouTube Notifications
          </div>
        </div>

        <div class="nav-section">
          <div class="nav-section-title">System</div>
          <div class="nav-item" data-page="sessions">
            Session Logs
          </div>
          <div class="nav-item" data-page="settings">
            Settings
          </div>
        </div>
      </nav>
    </aside>

    <main class="main-content">
      <div class="page active" id="page-overview">
        <div class="page-header">
          <h1>Dashboard Overview</h1>
          <p>Monitor your bot performance and activity</p>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="label">Status</div>
            <div class="value" id="statusValue">--</div>
          </div>
          <div class="stat-card">
            <div class="label">Ping</div>
            <div class="value" id="pingValue">--</div>
          </div>
          <div class="stat-card">
            <div class="label">Uptime</div>
            <div class="value" id="uptimeValue">--</div>
          </div>
          <div class="stat-card">
            <div class="label">Servers</div>
            <div class="value" id="guildsValue">--</div>
          </div>
          <div class="stat-card">
            <div class="label">Total Users</div>
            <div class="value" id="usersValue">--</div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3>Connected Servers</h3>
          </div>
          <div class="card-body">
            <table>
              <thead>
                <tr>
                  <th>Server Name</th>
                  <th>Members</th>
                  <th>Server ID</th>
                </tr>
              </thead>
              <tbody id="guildList"></tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="page" id="page-staff">
        <div class="page-header">
          <h1>Staff Management</h1>
          <p>Manage your server staff members</p>
        </div>

        <select class="guild-select" id="staffGuildSelect" onchange="loadStaff()">
          <option value="">All Servers</option>
        </select>

        <div class="card">
          <div class="card-header">
            <h3>Staff Members</h3>
            <button class="btn btn-success btn-sm" onclick="openAddStaffModal()">+ Add Staff</button>
          </div>
          <div class="card-body">
            <table>
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Discord ID</th>
                  <th>GenzAuth</th>
                  <th>Required Hours</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="staffList"></tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="page" id="page-genzauth">
        <div class="page-header">
          <h1>GenzAuth Management</h1>
          <p>Manage GenzAuth API keys for automatic staff key control</p>
        </div>

        <select class="guild-select" id="genzauthGuildSelect" onchange="loadGenzAuthStaff()">
          <option value="">Select a Server</option>
        </select>

        <div class="card" id="genzauthCard" style="display: none;">
          <div class="card-header">
            <h3>GenzAuth Staff</h3>
          </div>
          <div class="card-body">
            <table>
              <thead>
                <tr>
                  <th>Staff Member</th>
                  <th>GenzAuth Username</th>
                  <th>Key Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="genzauthStaffList"></tbody>
            </table>
          </div>
        </div>

        <div class="card" id="manualGenzAuthCard" style="display: none; margin-top: 24px;">
          <div class="card-header">
            <h3>Manual Control</h3>
          </div>
          <div class="card-body">
            <form id="manualGenzAuthForm">
              <div class="form-group">
                <label>GenzAuth Username</label>
                <input type="text" id="manualGenzauthUsername" required placeholder="Enter GenzAuth username">
              </div>
              <div style="display: flex; gap: 12px;">
                <button type="button" class="btn btn-warning" onclick="manualPauseUser()">Pause User</button>
                <button type="button" class="btn btn-success" onclick="manualResumeUser()">Resume User</button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div class="page" id="page-whitelist">
        <div class="page-header">
          <h1>File Upload Whitelist</h1>
          <p>Manage users who can upload .zip and .rar files</p>
        </div>

        <select class="guild-select" id="whitelistGuildSelect" onchange="loadWhitelist()">
          <option value="">All Servers</option>
        </select>

        <div class="card">
          <div class="card-header">
            <h3>Whitelisted Users</h3>
            <button class="btn btn-success btn-sm" onclick="openAddWhitelistModal()">+ Add User</button>
          </div>
          <div class="card-body">
            <table>
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Discord ID</th>
                  <th>Added On</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="whitelistTable"></tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="page" id="page-settings">
        <div class="page-header">
          <h1>Server Settings</h1>
          <p>Configure your server settings</p>
        </div>

        <select class="guild-select" id="settingsGuildSelect" onchange="loadGuildConfig()">
          <option value="">Select a Server</option>
        </select>

        <div class="card" id="settingsCard" style="display: none;">
          <div class="card-body">
            <form id="settingsForm">
              <div class="form-group">
                <label>Timezone</label>
                <select id="settingsTimezone" class="guild-select">
                  <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                  <option value="America/New_York">America/New_York (EST/EDT)</option>
                  <option value="America/Chicago">America/Chicago (CST/CDT)</option>
                  <option value="America/Denver">America/Denver (MST/MDT)</option>
                  <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                  <option value="Europe/London">Europe/London (GMT/BST)</option>
                  <option value="Europe/Paris">Europe/Paris (CET/CEST)</option>
                  <option value="Europe/Berlin">Europe/Berlin (CET/CEST)</option>
                  <option value="Europe/Moscow">Europe/Moscow (MSK)</option>
                  <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                  <option value="Asia/Singapore">Asia/Singapore (SGT)</option>
                  <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                  <option value="Asia/Shanghai">Asia/Shanghai (CST)</option>
                  <option value="Asia/Hong_Kong">Asia/Hong_Kong (HKT)</option>
                  <option value="Asia/Seoul">Asia/Seoul (KST)</option>
                  <option value="Australia/Sydney">Australia/Sydney (AEDT/AEST)</option>
                  <option value="Pacific/Auckland">Pacific/Auckland (NZDT/NZST)</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>
              <div class="form-group">
                <label>Log Channel ID</label>
                <input type="text" id="settingsLogChannel" placeholder="Channel ID for logs">
              </div>
              <div class="form-group">
                <label>Webhook URL</label>
                <input type="text" id="settingsWebhook" placeholder="Discord webhook URL">
              </div>
              <div class="form-group">
                <label>GenzAuth Seller Key</label>
                <input type="text" id="settingsGenzauth" placeholder="Your GenzAuth seller API key">
              </div>
              <button type="submit" class="btn btn-primary">Save Settings</button>
            </form>
          </div>
        </div>
      </div>

      <div class="page" id="page-sessions">
        <div class="page-header">
          <h1>Session Logs</h1>
          <p>View all voice channel session history</p>
        </div>

        <select class="guild-select" id="sessionsGuildSelect" onchange="loadSessions()">
          <option value="">All Servers</option>
        </select>

        <div class="card">
          <div class="card-header">
            <h3>Recent Sessions</h3>
          </div>
          <div class="card-body">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Channel</th>
                  <th>Date</th>
                  <th>Join Time</th>
                  <th>Duration</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody id="sessionsList"></tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="page" id="page-active">
        <div class="page-header">
          <h1>Active Voice Users</h1>
          <p>Users currently in voice channels (live updates)</p>
        </div>

        <select class="guild-select" id="activeGuildSelect" onchange="loadActiveSessions()">
          <option value="">All Servers</option>
        </select>

        <div class="active-users" id="activeUsersList"></div>
      </div>

      <div class="page" id="page-embeds">
        <div class="page-header">
          <h1>Custom Embed Sender</h1>
          <p>Create and send custom embeds to your Discord channels</p>
        </div>

        <select class="guild-select" id="embedGuildSelect" onchange="loadCustomEmbeds()">
          <option value="">Select a Server</option>
        </select>

        <div class="card" id="embedCard" style="display: none;">
          <div class="card-header">
            <h3>Custom Embeds</h3>
            <button class="btn btn-success btn-sm" onclick="openAddEmbedModal()">+ Create Embed</button>
          </div>
          <div class="card-body">
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Fields</th>
                  <th>Prices</th>
                  <th>Channel</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="embedsList"></tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="page" id="page-discounts">
        <div class="page-header">
          <h1>Discount Management</h1>
          <p>Create time-limited discounts that auto-apply to embed prices</p>
        </div>

        <select class="guild-select" id="discountGuildSelect" onchange="loadDiscounts()">
          <option value="">Select a Server</option>
        </select>

        <div class="card" id="discountCard" style="display: none;">
          <div class="card-header">
            <h3>Active Discounts</h3>
            <button class="btn btn-success btn-sm" onclick="openAddDiscountModal()">+ Add Discount</button>
          </div>
          <div class="card-body">
            <table>
              <thead>
                <tr>
                  <th>Discount</th>
                  <th>Applies To</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="discountsList"></tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="page" id="page-youtube">
        <div class="page-header">
          <h1>YouTube Notifications</h1>
          <p>Get notified when your YouTube channel uploads videos or goes live</p>
        </div>

        <select class="guild-select" id="youtubeGuildSelect" onchange="loadYouTubeConfigs()">
          <option value="">Select a Server</option>
        </select>

        <div class="card" id="youtubeCard" style="display: none;">
          <div class="card-header">
            <h3>YouTube Channels</h3>
            <button class="btn btn-success btn-sm" onclick="openAddYouTubeModal()">+ Add YouTube Channel</button>
          </div>
          <div class="card-body">
            <table>
              <thead>
                <tr>
                  <th>YouTube Channel ID</th>
                  <th>Discord Channel</th>
                  <th>Added</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="youtubeList"></tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  </div>

  <div class="modal" id="addStaffModal">
    <div class="modal-content">
      <div class="modal-header">
        <h3>Add Staff Member</h3>
        <button class="close-btn" onclick="closeModal('addStaffModal')">&times;</button>
      </div>
      <form id="addStaffForm">
        <div class="form-group">
          <label>Discord User ID</label>
          <input type="text" id="newStaffId" required placeholder="123456789012345678">
        </div>
        <div class="form-group">
          <label>Server</label>
          <select id="newStaffGuild" required class="guild-select"></select>
        </div>
        <div class="form-group">
          <label>Required Hours</label>
          <input type="number" id="newStaffHours" value="2" min="1" max="24">
        </div>
        <div class="form-group">
          <label>GenzAuth Username (Optional)</label>
          <input type="text" id="newStaffGenzauth" placeholder="genzauth_username">
        </div>
        <button type="submit" class="btn btn-primary">Add Staff</button>
      </form>
    </div>
  </div>

  <div class="modal" id="addWhitelistModal">
    <div class="modal-content">
      <div class="modal-header">
        <h3>Add to Whitelist</h3>
        <button class="close-btn" onclick="closeModal('addWhitelistModal')">&times;</button>
      </div>
      <form id="addWhitelistForm">
        <div class="form-group">
          <label>Discord User ID</label>
          <input type="text" id="newWhitelistId" required placeholder="123456789012345678">
        </div>
        <div class="form-group">
          <label>Server</label>
          <select id="newWhitelistGuild" required class="guild-select"></select>
        </div>
        <button type="submit" class="btn btn-primary">Add to Whitelist</button>
      </form>
    </div>
  </div>

  <div class="modal" id="addEmbedModal">
    <div class="modal-content">
      <div class="modal-header">
        <h3>Create Custom Embed</h3>
        <button class="close-btn" onclick="closeModal('addEmbedModal')">&times;</button>
      </div>
      <form id="addEmbedForm">
        <div class="form-group">
          <label>Title</label>
          <input type="text" id="newEmbedTitle" required placeholder="N1x BRUTAL PANEL">
        </div>
        <div class="form-group">
          <label>Description</label>
          <textarea id="newEmbedDescription" placeholder="Main embed description (optional)" style="width: 100%; padding: 12px; border-radius: 8px; background: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary); min-height: 80px;"></textarea>
        </div>
        <div class="form-group">
          <label>Color (Hex)</label>
          <input type="text" id="newEmbedColor" placeholder="#5865F2" value="#5865F2">
        </div>

        <div class="form-group">
          <label>Custom Fields</label>
          <div id="embedFields">
            <div class="embed-field-row" style="display: flex; gap: 8px; margin-bottom: 8px; align-items: flex-start;">
              <input type="text" placeholder="Field Name" style="flex: 1; min-width: 0; padding: 8px; border-radius: 6px; background: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary);">
              <textarea placeholder="Field Value" style="flex: 2; min-width: 0; padding: 8px; border-radius: 6px; background: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary); min-height: 60px; resize: vertical;"></textarea>
              <label style="display: flex; align-items: center; gap: 4px; color: var(--text-secondary); font-size: 12px; white-space: nowrap; flex-shrink: 0;"><input type="checkbox" style="width: auto;"> Inline</label>
            </div>
          </div>
          <button type="button" class="btn btn-sm" onclick="addEmbedField()" style="margin-top: 8px; background: var(--bg-elevated);">+ Add Field</button>
        </div>

        <div class="form-group">
          <label>Pricing Tiers</label>
          <div id="embedPrices">
            <div class="embed-price-row" style="display: grid; grid-template-columns: 2fr 2fr 1fr 1fr; gap: 8px; margin-bottom: 8px;">
              <input type="text" placeholder="Plan name (e.g., 10 Days)" style="padding: 8px; border-radius: 6px; background: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary); min-width: 0;">
              <input type="text" placeholder="Duration" style="padding: 8px; border-radius: 6px; background: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary); min-width: 0;">
              <input type="number" placeholder="Price" step="0.01" style="padding: 8px; border-radius: 6px; background: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary); min-width: 0; -moz-appearance: textfield;">
              <input type="text" placeholder="₹" value="₹" style="padding: 8px; border-radius: 6px; background: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary); min-width: 0;">
            </div>
          </div>
          <button type="button" class="btn btn-sm" onclick="addPriceTier()" style="margin-top: 8px; background: var(--bg-elevated);">+ Add Price Tier</button>
        </div>

        <div class="form-group">
          <label>Image URL (Optional)</label>
          <input type="text" id="newEmbedImage" placeholder="https://example.com/image.png">
        </div>
        <div class="form-group">
          <label>Thumbnail URL (Optional)</label>
          <input type="text" id="newEmbedThumbnail" placeholder="https://example.com/thumb.png">
        </div>
        <div class="form-group">
          <label>Footer Text (Optional)</label>
          <input type="text" id="newEmbedFooter" placeholder="TO BUY, CREATE A TICKET">
        </div>

        <div class="form-group">
          <label>Buttons</label>
          <div id="embedButtons">
            <div class="embed-button-row" style="display: grid; grid-template-columns: 2fr 2fr 1fr auto; gap: 8px; margin-bottom: 8px;">
              <input type="text" placeholder="Button Label (e.g., Create Ticket)" style="padding: 8px; border-radius: 6px; background: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary); min-width: 0;">
              <input type="text" placeholder="Target Channel ID" style="padding: 8px; border-radius: 6px; background: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary); min-width: 0;">
              <select style="padding: 8px; border-radius: 6px; background: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary); min-width: 0;">
                <option value="Primary">Blue</option>
                <option value="Secondary">Gray</option>
                <option value="Success">Green</option>
                <option value="Danger">Red</option>
              </select>
            </div>
          </div>
          <button type="button" class="btn btn-sm" onclick="addEmbedButton()" style="margin-top: 8px; background: var(--bg-elevated);">+ Add Button</button>
        </div>

        <div class="form-group">
          <label>Channel to Send</label>
          <input type="text" id="newEmbedChannel" required placeholder="Channel ID">
        </div>
        <div class="form-group">
          <label>Assign Discount (Optional)</label>
          <select id="newEmbedDiscount" style="width: 100%; padding: 12px; border-radius: 8px; background: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary);">
            <option value="">No Discount (Use Global)</option>
          </select>
        </div>
        <button type="submit" class="btn btn-primary">Create Embed</button>
      </form>
    </div>
  </div>

  <div class="modal" id="addDiscountModal">
    <div class="modal-content">
      <div class="modal-header">
        <h3>Add Discount</h3>
        <button class="close-btn" onclick="closeModal('addDiscountModal')">&times;</button>
      </div>
      <form id="addDiscountForm">
        <div class="form-group">
          <label>Discount Percentage</label>
          <input type="number" id="newDiscountPercent" required placeholder="10" min="1" max="100">
        </div>
        <div class="form-group">
          <label>Start Date</label>
          <input type="datetime-local" id="newDiscountStart" required>
        </div>
        <div class="form-group">
          <label>End Date</label>
          <input type="datetime-local" id="newDiscountEnd" required>
        </div>
        <div class="form-group">
          <label>Apply to Embed</label>
          <select id="newDiscountEmbed" style="width: 100%; padding: 12px; border-radius: 8px; background: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary);">
            <option value="">Global (All Embeds)</option>
          </select>
          <small style="color: var(--text-muted); font-size: 12px; margin-top: 4px; display: block;">Select an embed to apply this discount to, or leave as Global for all embeds</small>
        </div>
        <button type="submit" class="btn btn-primary">Add Discount</button>
      </form>
    </div>
  </div>

  <div class="modal" id="addYouTubeModal">
    <div class="modal-content">
      <div class="modal-header">
        <h3>Add YouTube Channel</h3>
        <button class="close-btn" onclick="closeModal('addYouTubeModal')">&times;</button>
      </div>
      <form id="addYouTubeForm">
        <div class="form-group">
          <label>YouTube Channel ID</label>
          <input type="text" id="newYouTubeChannelId" required placeholder="UCxxxxxxxxxxxxxx">
          <small style="color: var(--text-muted); font-size: 12px; margin-top: 4px; display: block;">Find this in your YouTube channel URL</small>
        </div>
        <div class="form-group">
          <label>Discord Channel ID</label>
          <input type="text" id="newYouTubeDiscordChannel" required placeholder="123456789012345678">
          <small style="color: var(--text-muted); font-size: 12px; margin-top: 4px; display: block;">Where to send notifications</small>
        </div>
        <button type="submit" class="btn btn-primary">Add Channel</button>
      </form>
    </div>
  </div>

  <script>
    let socket;
    let guilds = [];
    let activeSessionsData = []; // Added for active sessions

    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/check');
        const data = await res.json();
        if (data.authenticated) {
          showDashboard();
        }
      } catch (e) {}
    }

    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;
      const btn = document.getElementById('loginBtn');
      const error = document.getElementById('loginError');

      btn.disabled = true;
      btn.textContent = 'Signing in...';
      error.textContent = '';

      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });

        if (res.ok) {
          showDashboard();
        } else {
          error.textContent = 'Invalid credentials';
        }
      } catch (e) {
        error.textContent = 'Connection error';
      }

      btn.disabled = false;
      btn.textContent = 'Sign In';
    });

    document.getElementById('logoutBtn').addEventListener('click', async () => {
      await fetch('/api/logout', { method: 'POST' });
      location.reload();
    });

    function showDashboard() {
      document.getElementById('loginContainer').style.display = 'none';
      document.getElementById('dashboardContainer').style.display = 'block';
      initDashboard();
    }

    function initDashboard() {
      socket = io();

      socket.on('stats', (data) => {
        updateStatsDisplay(data);
      });

      socket.on('activeSessions', (data) => {
        if (document.getElementById('page-active').classList.contains('active')) {
          activeSessionsData = data; // Update the global data
          renderActiveSessions(); // Re-render the list
        }
      });

      // Listen for live discount updates
      socket.on('discountsUpdated', (data) => {
        const currentGuildId = document.getElementById('discountGuildSelect').value;
        if (data.guildId === currentGuildId && document.getElementById('page-discounts').classList.contains('active')) {
          renderDiscounts(data.discounts);
          showToast('Discounts updated!', 'success');
        }
      });

      loadStats();
      setInterval(loadStats, 5000);

      document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
          document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
          document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
          item.classList.add('active');
          document.getElementById('page-' + item.dataset.page).classList.add('active');

          switch(item.dataset.page) {
            case 'staff': loadStaff(); break;
            case 'genzauth': loadGenzAuthStaff(); break;
            case 'whitelist': loadWhitelist(); break;
            case 'sessions': loadSessions(); break;
            case 'active': loadActiveSessions(); break;
            case 'embeds': loadCustomEmbeds(); break;
            case 'discounts': loadDiscounts(); break;
            case 'youtube': loadYouTubeConfigs(); break;
          }
        });
      });
    }

    // Helper function to format uptime
    function formatUptime(seconds) {
      const hours = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      const secs = Math.floor(seconds % 60);
      return hours + 'h ' + mins + 'm ' + secs + 's';
    }

    function updateStatsDisplay(data) {
      document.getElementById('statusValue').textContent = data.isOnline ? 'ONLINE' : 'OFFLINE';
      document.getElementById('statusValue').className = 'value ' + (data.isOnline ? 'online' : 'offline');
      document.getElementById('pingValue').textContent = data.ping + 'ms';
      document.getElementById('uptimeValue').textContent = formatUptime(data.uptime);
      document.getElementById('guildsValue').textContent = data.guilds;
      document.getElementById('usersValue').textContent = data.users ? data.users.toLocaleString() : '0';

      document.getElementById('navBotName').textContent = data.botName || 'Voice Tracker';
      if (data.botAvatar) {
        document.getElementById('navBotAvatar').src = data.botAvatar;
      }
      document.getElementById('navStatus').textContent = data.isOnline ? 'Online' : 'Offline';
      document.getElementById('navStatusDot').style.background = data.isOnline ? 'var(--success)' : 'var(--danger)';

      if (data.guildList) {
        guilds = data.guildList;
        updateGuildSelects();

        const guildListEl = document.getElementById('guildList');
        if (data.guildList.length === 0) {
          guildListEl.innerHTML = '<tr><td colspan="3" class="empty-state"><div class="empty-state-text">No servers connected</div></td></tr>';
        } else {
          guildListEl.innerHTML = data.guildList.map(function(g) {
            return '<tr><td>' + g.name + '</td><td>' + g.memberCount + '</td><td>' + g.id + '</td></tr>';
          }).join('');
        }
      }
    }

    async function loadStats() {
        try {
          const res = await fetch('/api/dashboard/stats');

          if (!res.ok) {
            if (res.status === 401) {
              console.error('Session expired, redirecting to login...');
              window.location.href = '/api/dashboard/auth';
              return;
            }
            throw new Error('Failed to fetch stats: ' + res.statusText);
          }

          const data = await res.json();

          document.getElementById('statusValue').textContent = data.isOnline ? 'ONLINE' : 'OFFLINE';
          document.getElementById('statusValue').className = 'value ' + (data.isOnline ? 'online' : 'offline');
          document.getElementById('pingValue').textContent = data.ping + 'ms';
          document.getElementById('uptimeValue').textContent = formatUptime(data.uptime);
          document.getElementById('guildsValue').textContent = data.guilds;
          document.getElementById('usersValue').textContent = data.users?.toLocaleString() || '0';

          document.getElementById('navBotName').textContent = data.botName || 'Voice Tracker';
          if (data.botAvatar) {
            document.getElementById('navBotAvatar').src = data.botAvatar;
          }
          document.getElementById('navStatus').textContent = data.isOnline ? 'Online' : 'Offline';
          document.getElementById('navStatusDot').style.background = data.isOnline ? 'var(--success)' : 'var(--danger)';

          guilds = data.guildList || [];
          updateGuildSelects();

          const guildList = document.getElementById('guildList');
          if (!data.guildList || data.guildList.length === 0) {
            guildList.innerHTML = '<tr><td colspan="3" class="empty-state"><div class="empty-state-text">No servers connected</div></td></tr>';
          } else {
            guildList.innerHTML = data.guildList.map(g =>
              '<tr><td>' + g.name + '</td><td>' + g.memberCount + '</td><td>' + g.id + '</td></tr>'
            ).join('');
          }
        } catch (error) {
          console.error('Failed to load stats:', error);
          // Optionally redirect to login if the error is due to authentication
          if (error.message.includes('401') || error.message.includes('403')) {
            window.location.href = '/api/dashboard/auth';
          }
        }
      }

    function updateGuildSelects() {
      const selects = ['staffGuildSelect', 'whitelistGuildSelect', 'settingsGuildSelect',
                       'sessionsGuildSelect', 'activeGuildSelect', 'newStaffGuild',
                       'newWhitelistGuild', 'genzauthGuildSelect', 'embedGuildSelect', 'discountGuildSelect', 'youtubeGuildSelect'];

      selects.forEach(id => {
        const select = document.getElementById(id);
        if (!select) return;

        const currentVal = select.value;
        const hasAllOption = !['settingsGuildSelect', 'newStaffGuild', 'newWhitelistGuild', 'genzauthGuildSelect', 'embedGuildSelect', 'discountGuildSelect', 'youtubeGuildSelect'].includes(id);

        select.innerHTML = hasAllOption ? '<option value="">All Servers</option>' : '<option value="">Select a Server</option>';
        guilds.forEach(g => {
          select.innerHTML += '<option value="' + g.id + '">' + g.name + '</option>';
        });

        if (currentVal) select.value = currentVal;
      });
    }

    function addEmbedField() {
      const container = document.getElementById('embedFields');
      const newRow = document.createElement('div');
      newRow.className = 'embed-field-row';
      newRow.style.cssText = 'display: flex; gap: 8px; margin-bottom: 8px; align-items: flex-start;';
      newRow.innerHTML = '<input type="text" placeholder="Field Name" style="flex: 1; min-width: 0; padding: 8px; border-radius: 6px; background: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary);">' +
        '<textarea placeholder="Field Value" style="flex: 2; min-width: 0; padding: 8px; border-radius: 6px; background: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary); min-height: 60px; resize: vertical;"></textarea>' +
        '<label style="display: flex; align-items: center; gap: 4px; color: var(--text-secondary); font-size: 12px; white-space: nowrap; flex-shrink: 0;"><input type="checkbox" style="width: auto;"> Inline</label>' +
        '<button type="button" onclick="this.parentElement.remove()" class="btn btn-danger btn-sm" style="width: auto; flex-shrink: 0;">×</button>';
      container.appendChild(newRow);
    }

    function addPriceTier() {
      const container = document.getElementById('embedPrices');
      const newRow = document.createElement('div');
      newRow.className = 'embed-price-row';
      newRow.style.cssText = 'display: grid; grid-template-columns: 2fr 2fr 1fr 1fr auto; gap: 8px; margin-bottom: 8px;';
      newRow.innerHTML = '<input type="text" placeholder="Plan name" style="padding: 8px; border-radius: 6px; background: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary); min-width: 0;">' +
        '<input type="text" placeholder="Duration" style="padding: 8px; border-radius: 6px; background: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary); min-width: 0;">' +
        '<input type="number" placeholder="Price" step="0.01" style="padding: 8px; border-radius: 6px; background: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary); min-width: 0; -moz-appearance: textfield;">' +
        '<input type="text" placeholder="₹" value="₹" style="padding: 8px; border-radius: 6px; background: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary); min-width: 0;">' +
        '<button type="button" onclick="this.parentElement.remove()" class="btn btn-danger btn-sm" style="width: auto;">×</button>';
      container.appendChild(newRow);
    }

    function addEmbedButton() {
      const container = document.getElementById('embedButtons');
      const newRow = document.createElement('div');
      newRow.className = 'embed-button-row';
      newRow.style.cssText = 'display: grid; grid-template-columns: 2fr 2fr 1fr auto; gap: 8px; margin-bottom: 8px;';
      newRow.innerHTML = '<input type="text" placeholder="Button Label" style="padding: 8px; border-radius: 6px; background: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary); min-width: 0;">' +
        '<input type="text" placeholder="Target Channel ID" style="padding: 8px; border-radius: 6px; background: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary); min-width: 0;">' +
        '<select style="padding: 8px; border-radius: 6px; background: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary); min-width: 0;">' +
          '<option value="Primary">Blue</option>' +
          '<option value="Secondary">Gray</option>' +
          '<option value="Success">Green</option>' +
          '<option value="Danger">Red</option>' +
        '</select>' +
        '<button type="button" onclick="this.parentElement.remove()" class="btn btn-danger btn-sm" style="width: auto;">×</button>';
      container.appendChild(newRow);
    }

    async function loadCustomEmbeds() {
      const guildId = document.getElementById('embedGuildSelect').value;
      const card = document.getElementById('embedCard');

      if (!guildId) {
        card.style.display = 'none';
        return;
      }

      try {
        const embedsRes = await fetch('/api/custom-embeds?guildId=' + guildId);
        if (!embedsRes.ok) {
          showToast('Failed to load embeds', 'error');
          return;
        }
        const embeds = await embedsRes.json();

        if (embeds.length === 0) {
          document.getElementById('embedsList').innerHTML = '<tr><td colspan="6" class="empty-state"><div class="empty-state-text">No custom embeds created</div></td></tr>';
        } else {
          document.getElementById('embedsList').innerHTML = embeds.map(function(e) {
            return '<tr>' +
              '<td>' + e.title + '</td>' +
              '<td>' + ((e.fields && e.fields.length) ? e.fields.length + ' fields' : 'None') + '</td>' +
              '<td>' + ((e.prices && e.prices.length) ? e.prices.length + ' tiers' : 'None') + '</td>' +
              '<td>' + (e.channelId || 'N/A') + '</td>' +
              '<td>' + new Date(e.createdAt).toLocaleDateString() + '</td>' +
              '<td>' +
                '<button class="btn btn-primary btn-sm" onclick="sendEmbed(' + "'" + e._id + "'" + ')">Send</button> ' +
                '<button class="btn btn-danger btn-sm" onclick="deleteEmbed(' + "'" + e._id + "'" + ')">Delete</button>' +
              '</td>' +
            '</tr>';
          }).join('');
        }

        card.style.display = 'block';
      } catch (e) {
        console.error('Failed to load embeds:', e);
        showToast('Failed to load embeds', 'error');
      }
    }

    function renderDiscounts(discounts, embeds) {
      const tbody = document.getElementById('discountsList');

      if (discounts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><div class="empty-state-text">No discounts configured</div></td></tr>';
        return;
      }

      tbody.innerHTML = discounts.map(function(d) {
        const now = new Date();
        const start = new Date(d.startDate);
        const end = new Date(d.endDate);
        const nowTime = now.getTime();
        const startTime = start.getTime();
        const endTime = end.getTime();
        const isEnabled = d.isActive;

        let status;
        if (!isEnabled) {
          status = '<span class="badge badge-danger">Disabled</span>';
        } else if (nowTime < startTime) {
          status = '<span class="badge badge-warning">Scheduled</span>';
        } else if (nowTime > endTime) {
          status = '<span class="badge badge-danger">Expired</span>';
        } else {
          status = '<span class="badge badge-success">Active</span>';
        }

        let appliesTo = '<span class="badge badge-info">Global</span>';
        if (d.embedId && embeds) {
          const embed = embeds.find(function(e) { return e._id === d.embedId; });
          if (embed) {
            appliesTo = '<span class="badge badge-success">' + embed.title + '</span>';
          } else {
            appliesTo = '<span class="badge badge-warning">Invalid Embed</span>';
          }
        }

        const toggleText = isEnabled ? 'Disable' : 'Enable';
        const toggleClass = isEnabled ? 'btn-warning' : 'btn-success';

        // Format dates in IST timezone
        const dateOptions = { 
          timeZone: 'Asia/Kolkata',
          year: 'numeric', 
          month: '2-digit', 
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        };
        const startIST = start.toLocaleString('en-IN', dateOptions);
        const endIST = end.toLocaleString('en-IN', dateOptions);

        return '<tr>' +
          '<td>' + d.discountPercentage + '%</td>' +
          '<td>' + appliesTo + '</td>' +
          '<td>' + startIST + '</td>' +
          '<td>' + endIST + '</td>' +
          '<td>' + status + '</td>' +
          '<td>' +
            '<button class="btn ' + toggleClass + ' btn-sm" style="margin-right: 4px;" onclick="toggleDiscount(' + "'" + d._id + "'" + ', ' + (!isEnabled) + ')">' + toggleText + '</button>' +
            '<button class="btn btn-danger btn-sm" onclick="deleteDiscount(' + "'" + d._id + "'" + ')">Delete</button>' +
          '</td>' +
        '</tr>';
      }).join('');
    }

    async function loadDiscounts() {
      const guildId = document.getElementById('discountGuildSelect').value;
      const card = document.getElementById('discountCard');

      if (!guildId) {
        card.style.display = 'none';
        return;
      }

      try {
        const res = await fetch('/api/discounts?guildId=' + guildId);
        const discounts = await res.json();

        let embeds = [];
        try {
          const embedsRes = await fetch('/api/custom-embeds?guildId=' + guildId);
          if (embedsRes.ok) {
            embeds = await embedsRes.json();
          }
        } catch (embedErr) {
          console.error('Failed to load embeds:', embedErr);
        }

        renderDiscounts(discounts, embeds);
        card.style.display = 'block';
      } catch (e) {
        console.error('Failed to load discounts:', e);
      }
    }

    async function openAddEmbedModal() {
      const guildId = document.getElementById('embedGuildSelect').value;
      if (!guildId) {
        showToast('Please select a server first', 'error');
        return;
      }

      try {
        const res = await fetch('/api/discounts?guildId=' + guildId);
        const discounts = await res.json();
        const select = document.getElementById('newEmbedDiscount');
        select.innerHTML = '<option value="">No Discount (Use Global)</option>';
        discounts.forEach(function(d) {
          const option = document.createElement('option');
          option.value = d._id;
          option.textContent = d.discountPercentage + '% - ' + new Date(d.startDate).toLocaleDateString() + ' to ' + new Date(d.endDate).toLocaleDateString();
          select.appendChild(option);
        });
      } catch (e) {
        console.error('Failed to load discounts:', e);
      }

      document.getElementById('addEmbedModal').classList.add('active');
    }

    async function openAddDiscountModal() {
      const guildId = document.getElementById('discountGuildSelect').value;
      if (!guildId) {
        showToast('Please select a server first', 'error');
        return;
      }

      try {
        const res = await fetch('/api/custom-embeds?guildId=' + guildId);
        const embeds = await res.json();
        const select = document.getElementById('newDiscountEmbed');
        select.innerHTML = '<option value="">Global (All Embeds)</option>';
        embeds.forEach(function(e) {
          const option = document.createElement('option');
          option.value = e._id;
          option.textContent = e.title;
          select.appendChild(option);
        });
      } catch (e) {
        console.error('Failed to load embeds:', e);
      }

      document.getElementById('addDiscountModal').classList.add('active');
    }

    document.getElementById('addEmbedForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const guildId = document.getElementById('embedGuildSelect').value;

      const fields = [];
      document.querySelectorAll('#embedFields .embed-field-row').forEach(row => {
        const nameInput = row.querySelector('input[type="text"]');
        const valueInput = row.querySelector('textarea');
        const inlineInput = row.querySelector('input[type="checkbox"]');

        if (nameInput && valueInput && nameInput.value && valueInput.value) {
          fields.push({
            name: nameInput.value,
            value: valueInput.value,
            inline: inlineInput ? inlineInput.checked : false
          });
        }
      });

      const prices = [];
      document.querySelectorAll('#embedPrices .embed-price-row').forEach(row => {
        const inputs = row.querySelectorAll('input');
        if (inputs.length >= 4 && inputs[0].value && inputs[2].value) {
          prices.push({
            name: inputs[0].value,
            duration: inputs[1].value,
            price: parseFloat(inputs[2].value),
            currency: inputs[3].value || '₹'
          });
        }
      });

      const buttons = [];
      document.querySelectorAll('#embedButtons .embed-button-row').forEach(row => {
        const labelInput = row.querySelector('input[type="text"]');
        const channelInput = row.querySelectorAll('input[type="text"]')[1];
        const styleSelect = row.querySelector('select');
        if (labelInput && channelInput && labelInput.value && channelInput.value) {
          buttons.push({
            label: labelInput.value,
            targetChannelId: channelInput.value,
            style: styleSelect ? styleSelect.value : 'Primary'
          });
        }
      });

      try {
        await fetch('/api/custom-embeds', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guildId,
            title: document.getElementById('newEmbedTitle').value,
            description: document.getElementById('newEmbedDescription').value || '',
            color: document.getElementById('newEmbedColor').value,
            fields: fields.length > 0 ? fields : null,
            prices: prices.length > 0 ? prices : null,
            buttons: buttons.length > 0 ? buttons : null,
            imageUrl: document.getElementById('newEmbedImage').value || null,
            thumbnailUrl: document.getElementById('newEmbedThumbnail').value || null,
            footerText: document.getElementById('newEmbedFooter').value || null,
            channelId: document.getElementById('newEmbedChannel').value,
            discountId: document.getElementById('newEmbedDiscount').value || null
          })
        });
        closeModal('addEmbedModal');
        loadCustomEmbeds();
        showToast('Custom embed created!', 'success');
        document.getElementById('addEmbedForm').reset();
        document.getElementById('embedFields').innerHTML = '<div class="embed-field-row" style="display: flex; gap: 8px; margin-bottom: 8px; align-items: flex-start;">' +
          '<input type="text" placeholder="Field Name" style="flex: 1; min-width: 0; padding: 8px; border-radius: 6px; background: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary);">' +
          '<textarea placeholder="Field Value" style="flex: 2; min-width: 0; padding: 8px; border-radius: 6px; background: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary); min-height: 60px; resize: vertical;"></textarea>' +
          '<label style="display: flex; align-items: center; gap: 4px; color: var(--text-secondary); font-size: 12px; white-space: nowrap; flex-shrink: 0;"><input type="checkbox" style="width: auto;"> Inline</label>' +
          '</div>';
        document.getElementById('embedPrices').innerHTML = '<div class="embed-price-row" style="display: grid; grid-template-columns: 2fr 2fr 1fr 1fr; gap: 8px; margin-bottom: 8px;">' +
          '<input type="text" placeholder="Plan name (e.g., 10 Days)" style="padding: 8px; border-radius: 6px; background: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary); min-width: 0;">' +
          '<input type="text" placeholder="Duration" style="padding: 8px; border-radius: 6px; background: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary); min-width: 0;">' +
          '<input type="number" placeholder="Price" step="0.01" style="padding: 8px; border-radius: 6px; background: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary); min-width: 0; -moz-appearance: textfield;">' +
          '<input type="text" placeholder="₹" value="₹" style="padding: 8px; border-radius: 6px; background: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary); min-width: 0;">' +
          '</div>';
        document.getElementById('embedButtons').innerHTML = '<div class="embed-button-row" style="display: grid; grid-template-columns: 2fr 2fr 1fr auto; gap: 8px; margin-bottom: 8px;">' +
          '<input type="text" placeholder="Button Label (e.g., Create Ticket)" style="padding: 8px; border-radius: 6px; background: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary); min-width: 0;">' +
          '<input type="text" placeholder="Target Channel ID" style="padding: 8px; border-radius: 6px; background: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary); min-width: 0;">' +
          '<select style="padding: 8px; border-radius: 6px; background: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary); min-width: 0;">' +
            '<option value="Primary">Blue</option>' +
            '<option value="Secondary">Gray</option>' +
            '<option value="Success">Green</option>' +
            '<option value="Danger">Red</option>' +
          '</select>' +
          '</div>';
      } catch (e) {
        showToast('Failed to create embed', 'error');
      }
    });

    document.getElementById('addDiscountForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const guildId = document.getElementById('discountGuildSelect').value;

      try {
        await fetch('/api/discounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guildId: guildId,
            discountPercentage: parseInt(document.getElementById('newDiscountPercent').value),
            startDate: document.getElementById('newDiscountStart').value,
            endDate: document.getElementById('newDiscountEnd').value,
            embedId: document.getElementById('newDiscountEmbed').value || null
          })
        });
        closeModal('addDiscountModal');
        loadDiscounts();
        showToast('Discount added!', 'success');
        document.getElementById('addDiscountForm').reset();
      } catch (e) {
        showToast('Failed to add discount', 'error');
      }
    });

    async function sendEmbed(id) {
      try {
        await fetch('/api/custom-embeds/' + id + '/send', { method: 'POST' });
        showToast('Embed sent successfully!', 'success');
      } catch (e) {
        showToast('Failed to send embed', 'error');
      }
    }

    async function deleteEmbed(id) {
      if (!confirm('Delete this embed?')) return;
      try {
        await fetch('/api/custom-embeds/' + id, { method: 'DELETE' });
        loadCustomEmbeds();
        showToast('Embed deleted', 'success');
      } catch (e) {
        showToast('Failed to delete embed', 'error');
      }
    }

    async function deleteDiscount(id) {
      if (!confirm('Delete this discount?')) return;
      try {
        await fetch('/api/discounts/' + id, { method: 'DELETE' });
        loadDiscounts();
        showToast('Discount deleted', 'success');
      } catch (e) {
        showToast('Failed to delete discount', 'error');
      }
    }

    async function toggleDiscount(id, newStatus) {
      try {
        await fetch('/api/discounts/' + id, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: newStatus })
        });
        loadDiscounts();
        showToast(newStatus ? 'Discount enabled' : 'Discount disabled', 'success');
      } catch (e) {
        showToast('Failed to update discount', 'error');
      }
    }

    async function loadYouTubeConfigs() {
      const guildId = document.getElementById('youtubeGuildSelect').value;
      const card = document.getElementById('youtubeCard');

      if (!guildId) {
        card.style.display = 'none';
        return;
      }

      try {
        const res = await fetch('/api/youtube-configs?guildId=' + guildId);
        const configs = await res.json();

        if (configs.length === 0) {
          document.getElementById('youtubeList').innerHTML = '<tr><td colspan="4" class="empty-state"><div class="empty-state-text">No YouTube channels configured</div></td></tr>';
        } else {
          document.getElementById('youtubeList').innerHTML = configs.map(function(c) {
            return '<tr>' +
              '<td>' + c.youtubeChannelId + '</td>' +
              '<td>' + c.channelId + '</td>' +
              '<td>' + new Date(c.createdAt).toLocaleDateString() + '</td>' +
              '<td><button class="btn btn-danger btn-sm" onclick="deleteYouTubeConfig(' + "'" + c._id + "'" + ')">Remove</button></td>' +
            '</tr>';
          }).join('');
        }

        card.style.display = 'block';
      } catch (e) {
        console.error('Failed to load YouTube configs:', e);
      }
    }

    function openAddYouTubeModal() {
      const guildId = document.getElementById('youtubeGuildSelect').value;
      if (!guildId) {
        showToast('Please select a server first', 'error');
        return;
      }
      document.getElementById('addYouTubeModal').classList.add('active');
    }

    document.getElementById('addYouTubeForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const guildId = document.getElementById('youtubeGuildSelect').value;

      try {
        await fetch('/api/youtube-configs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guildId: guildId,
            youtubeChannelId: document.getElementById('newYouTubeChannelId').value,
            channelId: document.getElementById('newYouTubeDiscordChannel').value
          })
        });
        closeModal('addYouTubeModal');
        loadYouTubeConfigs();
        showToast('YouTube channel added!', 'success');
        document.getElementById('addYouTubeForm').reset();
      } catch (e) {
        showToast('Failed to add YouTube channel', 'error');
      }
    });

    async function deleteYouTubeConfig(id) {
      if (!confirm('Remove this YouTube channel?')) return;
      try {
        await fetch('/api/youtube-configs/' + id, { method: 'DELETE' });
        loadYouTubeConfigs();
        showToast('YouTube channel removed', 'success');
      } catch (e) {
        showToast('Failed to remove YouTube channel', 'error');
      }
    }

    async function loadStaff() {
      const guildId = document.getElementById('staffGuildSelect').value;
      const url = '/api/staff' + (guildId ? '?guildId=' + guildId : '');

      try {
        const res = await fetch(url);
        const staff = await res.json();

        if (staff.length === 0) {
          document.getElementById('staffList').innerHTML = '<tr><td colspan="6" class="empty-state"><div class="empty-state-text">No staff members found</div></td></tr>';
        } else {
          document.getElementById('staffList').innerHTML = staff.map(function(s) {
            return '<tr>' +
              '<td>' + s.username + '</td>' +
              '<td>' + s.odcordId + '</td>' +
              '<td>' + (s.genzauthUsername ? '<span class="badge badge-info">' + s.genzauthUsername + '</span>' : '<span class="badge">None</span>') + '</td>' +
              '<td>' + s.requiredHours + 'h</td>' +
              '<td>' + (s.isActive ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-danger">Inactive</span>') + '</td>' +
              '<td><button class="btn btn-danger btn-sm" onclick="deleteStaff(' + "'" + s._id + "'" + ')">Remove</button></td>' +
            '</tr>';
          }).join('');
        }
      } catch (e) {
        console.error('Failed to load staff:', e);
      }
    }

    async function loadGenzAuthStaff() {
      const guildId = document.getElementById('genzauthGuildSelect').value;
      const card = document.getElementById('genzauthCard');
      const manualCard = document.getElementById('manualGenzAuthCard');

      if (!guildId) {
        card.style.display = 'none';
        manualCard.style.display = 'none';
        return;
      }

      try {
        const res = await fetch('/api/staff?guildId=' + guildId);
        const staff = await res.json();
        const genzauthStaff = staff.filter(s => s.genzauthUsername);

        if (genzauthStaff.length === 0) {
          document.getElementById('genzauthStaffList').innerHTML = '<tr><td colspan="4" class="empty-state"><div class="empty-state-text">No staff with GenzAuth configured</div></td></tr>';
        } else {
          document.getElementById('genzauthStaffList').innerHTML = genzauthStaff.map(s => {
            const status = s.genzauthKeyPaused ?
              '<div class="genzauth-status"><span class="status-indicator-small paused"></span><span class="badge badge-danger">Paused</span></div>' :
              '<div class="genzauth-status"><span class="status-indicator-small active"></span><span class="badge badge-success">Active</span></div>';

            const action = s.genzauthKeyPaused ?
              '<button class="btn btn-success btn-sm" onclick="resumeGenzAuth(' + "'" + s.odcordId + "'" + ', ' + "'" + guildId + "'" + ')">Resume</button>' :
              '<button class="btn btn-warning btn-sm" onclick="pauseGenzAuth(' + "'" + s.odcordId + "'" + ', ' + "'" + guildId + "'" + ')">Pause</button>';

            return '<tr>' +
              '<td>' + s.username + '</td>' +
              '<td>' + s.genzauthUsername + '</td>' +
              '<td>' + status + '</td>' +
              '<td>' + action + '</td>' +
            '</tr>';
          }).join('');
        }

        card.style.display = 'block';
        manualCard.style.display = 'block';
      } catch (e) {
        console.error('Failed to load GenzAuth staff:', e);
      }
    }

    async function manualPauseUser() {
      const guildId = document.getElementById('genzauthGuildSelect').value;
      const username = document.getElementById('manualGenzauthUsername').value.trim();

      if (!guildId || !username) {
        showToast('Please select a server and enter a username', 'error');
        return;
      }

      try {
        const res = await fetch('/api/genzauth/pause-username', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, guildId })
        });

        if (res.ok) {
          showToast('Successfully paused user: ' + username, 'success');
          document.getElementById('manualGenzauthUsername').value = '';
        } else {
          const data = await res.json();
          showToast(data.error || 'Failed to pause user', 'error');
        }
      } catch (e) {
        showToast('Error pausing user', 'error');
      }
    }

    async function manualResumeUser() {
      const guildId = document.getElementById('genzauthGuildSelect').value;
      const username = document.getElementById('manualGenzauthUsername').value.trim();

      if (!guildId || !username) {
        showToast('Please select a server and enter a username', 'error');
        return;
      }

      try {
        const res = await fetch('/api/genzauth/resume-username', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, guildId })
        });

        if (res.ok) {
          showToast('Successfully resumed user: ' + username, 'success');
          document.getElementById('manualGenzauthUsername').value = '';
        } else {
          const data = await res.json();
          showToast(data.error || 'Failed to resume user', 'error');
        }
      } catch (e) {
        showToast('Error resuming user', 'error');
      }
    }

    async function pauseGenzAuth(userId, guildId) {
      try {
        const res = await fetch('/api/genzauth/pause', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, guildId })
        });

        if (res.ok) {
          showToast('GenzAuth key paused successfully', 'success');
          loadGenzAuthStaff();
        } else {
          showToast('Failed to pause GenzAuth key', 'error');
        }
      } catch (e) {
        showToast('Error pausing GenzAuth key', 'error');
      }
    }

    async function resumeGenzAuth(userId, guildId) {
      try {
        const res = await fetch('/api/genzauth/resume', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, guildId })
        });

        if (res.ok) {
          showToast('GenzAuth key resumed successfully', 'success');
          loadGenzAuthStaff();
        } else {
          showToast('Failed to resume GenzAuth key', 'error');
        }
      } catch (e) {
        showToast('Error resuming GenzAuth key', 'error');
      }
    }

    async function loadWhitelist() {
      const guildId = document.getElementById('whitelistGuildSelect').value;
      const url = '/api/whitelist' + (guildId ? '?guildId=' + guildId : '');

      try {
        const res = await fetch(url);
        const whitelist = await res.json();

        if (whitelist.length === 0) {
          document.getElementById('whitelistTable').innerHTML = '<tr><td colspan="4" class="empty-state"><div class="empty-state-text">No whitelisted users</div></td></tr>';
        } else {
          document.getElementById('whitelistTable').innerHTML = whitelist.map(function(w) {
            return '<tr>' +
              '<td>' + w.username + '</td>' +
              '<td>' + w.userId + '</td>' +
              '<td>' + new Date(w.addedAt).toLocaleDateString() + '</td>' +
              '<td><button class="btn btn-danger btn-sm" onclick="deleteWhitelist(' + "'" + w._id + "'" + ')">Remove</button></td>' +
            '</tr>';
          }).join('');
        }
      } catch (e) {
        console.error('Failed to load whitelist:', e);
      }
    }

    async function loadGuildConfig() {
      const guildId = document.getElementById('settingsGuildSelect').value;
      const card = document.getElementById('settingsCard');

      if (!guildId) {
        card.style.display = 'none';
        return;
      }

      try {
        const res = await fetch('/api/guild-config?guildId=' + guildId);
        const config = await res.json();

        document.getElementById('settingsTimezone').value = config.timezone || 'Asia/Kolkata';
        document.getElementById('settingsLogChannel').value = config.logChannelId || '';
        document.getElementById('settingsWebhook').value = config.webhookUrl || '';
        document.getElementById('settingsGenzauth').value = config.genzauthSellerKey || '';

        card.style.display = 'block';
      } catch (e) {
        console.error('Failed to load config:', e);
      }
    }

    document.getElementById('settingsForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const guildId = document.getElementById('settingsGuildSelect').value;

      try {
        await fetch('/api/guild-config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guildId,
            timezone: document.getElementById('settingsTimezone').value,
            logChannelId: document.getElementById('settingsLogChannel').value,
            webhookUrl: document.getElementById('settingsWebhook').value,
            genzauthSellerKey: document.getElementById('settingsGenzauth').value
          })
        });
        showToast('Settings saved successfully!', 'success');
      } catch (e) {
        showToast('Failed to save settings', 'error');
      }
    });

    async function loadSessions() {
      const guildId = document.getElementById('sessionsGuildSelect').value;
      const url = '/api/sessions' + (guildId ? '?guildId=' + guildId : '');

      try {
        const res = await fetch(url);
        const sessions = await res.json();

        if (sessions.length === 0) {
          document.getElementById('sessionsList').innerHTML = '<tr><td colspan="6" class="empty-state"><div class="empty-state-text">No sessions found</div></td></tr>';
        } else {
          document.getElementById('sessionsList').innerHTML = sessions.map(s => {
            const duration = s.isActive ? '<span class="badge badge-success">Active</span>' : Math.round(s.duration) + ' min';
            return '<tr>' +
              '<td>' + s.username + '</td>' +
              '<td>' + s.channelName + '</td>' +
              '<td>' + s.date + '</td>' +
              '<td>' + new Date(s.joinTime).toLocaleTimeString() + '</td>' +
              '<td>' + duration + '</td>' +
              '<td>' + (s.isActive ? '<span class="badge badge-success">In VC</span>' : '<span class="badge">Ended</span>') + '</td>' +
            '</tr>';
          }).join('');
        }
      } catch (e) {
        console.error('Failed to load sessions:', e);
      }
    }

    // Helper function to format duration in minutes and seconds
    function formatDuration(minutes) {
      const mins = Math.floor(minutes);
      const secs = Math.round((minutes - mins) * 60);
      return mins + 'm ' + secs + 's';
    }

    async function loadActiveSessions() {
      try {
        const res = await fetch('/api/dashboard/active-sessions');

        if (!res.ok) {
          if (res.status === 401) {
            window.location.href = '/api/dashboard/auth';
            return;
          }
          throw new Error('Failed to fetch active sessions');
        }

        activeSessionsData = await res.json();
        renderActiveSessions();
      } catch (error) {
        console.error('Failed to load active sessions:', error);
      }
    }

    function renderActiveSessions() {
      const container = document.getElementById('activeUsersList');

      if (activeSessionsData.length === 0) {
        container.innerHTML = '<div class="empty-state" style="grid-column: 1/-1;"><div class="empty-state-text">No users currently in voice channels</div></div>';
        return;
      }

      const now = new Date();
      container.innerHTML = activeSessionsData.map(function(session) {
        const joinTime = new Date(session.joinTime);
        const currentDuration = Math.floor((now - joinTime) / 60000); // minutes

        return '<div class="active-user-card">' +
          '<img src="' + (session.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png') + '" alt="' + session.username + '">' +
          '<div class="active-user-info">' +
            '<h4>' + session.username + '</h4>' +
            '<p>' + session.channelName + ' - ' + formatDuration(currentDuration) + '</p>' +
          '</div>' +
        '</div>';
      }).join('');
    }

    // Update active sessions display every second
    setInterval(() => {
      if (activeSessionsData.length > 0 && document.getElementById('page-active').classList.contains('active')) {
        renderActiveSessions();
      }
    }, 1000);

    function openAddStaffModal() {
      document.getElementById('addStaffModal').classList.add('active');
    }

    function openAddWhitelistModal() {
      document.getElementById('addWhitelistModal').classList.add('active');
    }

    function closeModal(id) {
      document.getElementById(id).classList.remove('active');
    }

    document.getElementById('addStaffForm').addEventListener('submit', async (e) => {
      e.preventDefault();

      try {
        await fetch('/api/staff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            odcordId: document.getElementById('newStaffId').value,
            guildId: document.getElementById('newStaffGuild').value,
            requiredHours: parseInt(document.getElementById('newStaffHours').value),
            genzauthUsername: document.getElementById('newStaffGenzauth').value || null
          })
        });
        closeModal('addStaffModal');
        loadStaff();
        showToast('Staff member added successfully!', 'success');
        document.getElementById('addStaffForm').reset();
      } catch (e) {
        showToast('Failed to add staff member', 'error');
      }
    });

    document.getElementById('addWhitelistForm').addEventListener('submit', async (e) => {
      e.preventDefault();

      try {
        await fetch('/api/whitelist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: document.getElementById('newWhitelistId').value,
            guildId: document.getElementById('newWhitelistGuild').value
          })
        });
        closeModal('addWhitelistModal');
        loadWhitelist();
        showToast('User whitelisted successfully!', 'success');
        document.getElementById('addWhitelistForm').reset();
      } catch (e) {
        showToast('Failed to whitelist user', 'error');
      }
    });

    async function deleteStaff(id) {
      if (!confirm('Are you sure you want to remove this staff member?')) return;

      try {
        await fetch('/api/staff/' + id, { method: 'DELETE' });
        loadStaff();
        showToast('Staff member removed', 'success');
      } catch (e) {
        showToast('Failed to remove staff member', 'error');
      }
    }

    async function deleteWhitelist(id) {
      if (!confirm('Are you sure you want to remove this user from the whitelist?')) return;

      try {
        await fetch('/api/whitelist/' + id, { method: 'DELETE' });
        loadWhitelist();
        showToast('User removed from whitelist', 'success');
      } catch (e) {
        showToast('Failed to remove user', 'error');
      }
    }

    function showToast(message, type) {
      const toast = document.createElement('div');
      toast.className = 'toast ' + type;
      toast.textContent = message;
      document.body.appendChild(toast);

      setTimeout(() => {
        toast.style.animation = 'slideInRight 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    }

    checkAuth();
  </script>
</body>
</html>
`;