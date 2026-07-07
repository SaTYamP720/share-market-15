document.addEventListener('DOMContentLoaded', () => {
  // Navigation & Tab elements
  const navItems = document.querySelectorAll('.nav-item');
  const pageTitle = document.getElementById('page-title');
  const pageSubtitle = document.getElementById('page-subtitle');
  const viewContainer = document.getElementById('view-container');
  
  // Script Overlay elements
  const addScriptOverlay = document.getElementById('add-script-overlay');
  const closeOverlayBtn = document.getElementById('close-overlay-btn');
  const scriptSearchInput = document.getElementById('script-search-input');
  const addedCounter = document.getElementById('added-counter');
  const scriptListContent = document.getElementById('script-list-content');
  const categoryTabBtns = document.querySelectorAll('.overlay-tabs .tab-btn');

  // Watchlist Elements
  const watchlistTbody = document.getElementById('watchlist-tbody');
  const watchlistSearchInput = document.getElementById('watchlist-search-input');

  // Global Session State
  let apiConnected = false;
  let clientCode = null;
  let userName = null;
  let addedScripts = [];
  let selectedScript = null;
  let positionQuoteCache = {}; // Cache live quotes for open positions not in watchlist

  // Custom Toast notification helper
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast-msg ${type}`;
    toast.innerHTML = `
      <div style="flex: 1;">${message.replace(/\n/g, '<br>')}</div>
    `;

    container.appendChild(toast);

    // Auto dismiss after 4 seconds
    setTimeout(() => {
      toast.style.animation = 'toastFadeOut 0.4s ease forwards';
      setTimeout(() => {
        toast.remove();
      }, 400);
    }, 4000);
  }

  // Mock Database for scripts (categorized)
  const scriptsDb = {
    futures: [
      { code: 'ABB', name: 'ABB26JULFUT', expiry: 'Exp: 28 Jul 26' },
      { code: 'ABCAPITAL', name: 'ABCAPITAL26JULFUT', expiry: 'Exp: 28 Jul 26' },
      { code: 'ADANIENT', name: 'ADANIENT26JULFUT', expiry: 'Exp: 28 Jul 26' },
      { code: 'ADANIGREEN', name: 'ADANIGREEN26JULFUT', expiry: 'Exp: 28 Jul 26' },
      { code: 'ADANIPORTS', name: 'ADANIPORTS26JULFUT', expiry: 'Exp: 28 Jul 26' },
      { code: 'AMBUJACEM', name: 'AMBUJACEM26JULFUT', expiry: 'Exp: 28 Jul 26' },
      { code: 'ANGELONE', name: 'ANGELONE26JULFUT', expiry: 'Exp: 28 Jul 26' },
      { code: 'APOLLOHOSP', name: 'APOLLOHOSP26JULFUT', expiry: 'Exp: 28 Jul 26' },
      { code: 'ASHOKLEY', name: 'ASHOKLEY26JULFUT', expiry: 'Exp: 28 Jul 26' },
      { code: 'ASIANPAINT', name: 'ASIANPAINT26JULFUT', expiry: 'Exp: 28 Jul 26' }
    ],
    mcx: [
      { code: 'GOLD', name: 'GOLD26AUGFUT', expiry: 'Exp: 05 Aug 26' },
      { code: 'CRUDEOIL', name: 'CRUDEOIL26JULFUT', expiry: 'Exp: 19 Jul 26' },
      { code: 'SILVER', name: 'SILVER26SEPFUT', expiry: 'Exp: 04 Sep 26' },
      { code: 'NATURALGAS', name: 'NATGAS26JULFUT', expiry: 'Exp: 25 Jul 26' },
      { code: 'COPPER', name: 'COPPER26JULFUT', expiry: 'Exp: 31 Jul 26' },
      { code: 'NICKEL', name: 'NICKEL26JULFUT', expiry: 'Exp: 31 Jul 26' },
      { code: 'ALUMINI', name: 'ALUMINI26JULFUT', expiry: 'Exp: 31 Jul 26' }
    ],
    options: [
      { code: 'NIFTY 24200 CE', name: 'NIFTY26JUL24200CE', expiry: 'Exp: 24 Jul 26' },
      { code: 'NIFTY 24200 PE', name: 'NIFTY26JUL24200PE', expiry: 'Exp: 24 Jul 26' },
      { code: 'BANKNIFTY 52000 CE', name: 'BANKNIFTY26JUL52000CE', expiry: 'Exp: 24 Jul 26' },
      { code: 'BANKNIFTY 52000 PE', name: 'BANKNIFTY26JUL52000PE', expiry: 'Exp: 24 Jul 26' },
      { code: 'RELIANCE 3100 CE', name: 'RELIANCE26JUL3100CE', expiry: 'Exp: 24 Jul 26' },
      { code: 'TCS 4200 PE', name: 'TCS26JUL4200PE', expiry: 'Exp: 24 Jul 26' }
    ],
    forex: [
      { code: 'USDINR', name: 'USDINR26JULFUT', expiry: 'Exp: 29 Jul 26' },
      { code: 'EURINR', name: 'EURINR26JULFUT', expiry: 'Exp: 29 Jul 26' },
      { code: 'GBPINR', name: 'GBPINR26JULFUT', expiry: 'Exp: 29 Jul 26' },
      { code: 'JPYINR', name: 'JPYINR26JULFUT', expiry: 'Exp: 29 Jul 26' }
    ],
    'us-stocks': [
      { code: 'AAPL', name: 'APPLE INC', expiry: 'NASDAQ' },
      { code: 'MSFT', name: 'MICROSOFT CORP', expiry: 'NASDAQ' },
      { code: 'TSLA', name: 'TESLA INC', expiry: 'NASDAQ' },
      { code: 'NVDA', name: 'NVIDIA CORP', expiry: 'NASDAQ' },
      { code: 'AMZN', name: 'AMAZON.COM INC', expiry: 'NASDAQ' },
      { code: 'GOOGL', name: 'ALPHABET INC', expiry: 'NASDAQ' }
    ],
    comex: [
      { code: 'GC', name: 'GOLD COMEX', expiry: 'Exp: 28 Aug 26' },
      { code: 'SI', name: 'SILVER COMEX', expiry: 'Exp: 28 Sep 26' },
      { code: 'HG', name: 'COPPER COMEX', expiry: 'Exp: 28 Jul 26' }
    ],
    'us-index': [
      { code: 'DJI', name: 'DOW JONES INDUSTRIAL AVERAGE', expiry: 'INDEX' },
      { code: 'IXIC', name: 'NASDAQ COMPOSITE', expiry: 'INDEX' },
      { code: 'SPX', name: 'S&P 500 INDEX', expiry: 'INDEX' }
    ]
  };

  // Mock HTML for views
  const staticViewsHtml = {
    orders: `
      <table class="terminal-table">
        <thead>
          <tr>
            <th>TIME</th>
            <th>SYMBOL</th>
            <th>TYPE</th>
            <th>SIDE</th>
            <th>QTY</th>
            <th>PRICE</th>
            <th>STATUS</th>
            <th>ACTIONS</th>
          </tr>
        </thead>
        <tbody id="orders-tbody">
          <tr class="empty-state-row">
            <td colspan="8" class="empty-state-cell">
              <div class="empty-state-container">
                <p>No pending orders</p>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    `,
    'trade-history': `
      <table class="terminal-table">
        <thead>
          <tr>
            <th>DATE</th>
            <th>SYMBOL</th>
            <th>TYPE</th>
            <th>SIDE</th>
            <th>QTY</th>
            <th>PRICE</th>
            <th>VALUE</th>
          </tr>
        </thead>
        <tbody>
          <tr class="empty-state-row">
            <td colspan="7" class="empty-state-cell">
              <div class="empty-state-container">
                <p>No trades executed today</p>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    `,
    funds: `
      <table class="terminal-table">
        <thead>
          <tr>
            <th>LIMIT COMPONENT</th>
            <th>EQUITY (₹)</th>
            <th>COMMODITY (₹)</th>
          </tr>
        </thead>
        <tbody id="funds-tbody">
          <tr>
            <td>Opening Balance</td>
            <td id="equity-val">0.00</td>
            <td>0.00</td>
          </tr>
          <tr>
            <td>Payin Amount</td>
            <td>0.00</td>
            <td>0.00</td>
          </tr>
          <tr>
            <td>Payout Amount</td>
            <td>0.00</td>
            <td>0.00</td>
          </tr>
          <tr>
            <td>Funds Utilized</td>
            <td>0.00</td>
            <td>0.00</td>
          </tr>
          <tr style="font-weight: 600; border-top: 2px solid #edf2f7;">
            <td>Net Available Balance</td>
            <td id="equity-net" style="color: #0b57d0;">0.00</td>
            <td style="color: #0b57d0;">0.00</td>
          </tr>
        </tbody>
      </table>
    `,
    withdraw: `
      <table class="terminal-table">
        <thead>
          <tr>
            <th>REQUEST DATE</th>
            <th>AMOUNT (₹)</th>
            <th>BANK ACCOUNT</th>
            <th>STATUS</th>
          </tr>
        </thead>
        <tbody>
          <tr class="empty-state-row">
            <td colspan="4" class="empty-state-cell">
              <div class="empty-state-container">
                <p>No withdrawal requests found</p>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    `,
    ledger: `
      <table class="terminal-table">
        <thead>
          <tr>
            <th>DATE</th>
            <th>PARTICULARS</th>
            <th>DEBIT (₹)</th>
            <th>CREDIT (₹)</th>
            <th>BALANCE (₹)</th>
          </tr>
        </thead>
        <tbody>
          <tr class="empty-state-row">
            <td colspan="5" class="empty-state-cell">
              <div class="empty-state-container">
                <p>No transactions available in current statement</p>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    `,
    rejections: `
      <table class="terminal-table">
        <thead>
          <tr>
            <th>TIME</th>
            <th>SYMBOL</th>
            <th>SIDE</th>
            <th>QTY</th>
            <th>REJECTION REASON</th>
          </tr>
        </thead>
        <tbody>
          <tr class="empty-state-row">
            <td colspan="5" class="empty-state-cell">
              <div class="empty-state-container">
                <p>No rejected orders recorded</p>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    `,
    profile: `
      <table class="terminal-table">
        <thead>
          <tr>
            <th>PARAMETER</th>
            <th>VALUE</th>
          </tr>
        </thead>
        <tbody id="profile-tbody">
          <tr>
            <td>Client ID</td>
            <td id="profile-client-id">SM18_GUEST</td>
          </tr>
          <tr>
            <td>Client Name</td>
            <td id="profile-name">Terminal Guest Account</td>
          </tr>
          <tr>
            <td>Email ID</td>
            <td id="profile-email">guest@sharemarket18.com</td>
          </tr>
          <tr>
            <td>Broker Name</td>
            <td>Angel One (Integrated API Ready)</td>
          </tr>
        </tbody>
      </table>
    `
  };

  // Check initial login session status on local server
  checkSessionStatus();

  // Sidebar Tab Switching
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const tabName = item.getAttribute('data-tab');

      // Update active state of sidebar links
      navItems.forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');

      // Hide all predefined panes inside container
      const panes = document.querySelectorAll('.view-pane');
      panes.forEach(pane => pane.classList.remove('active'));

      // Remove old dynamic panes
      const oldDynamic = document.querySelector('[id^="view-dynamic-"]');
      if (oldDynamic) oldDynamic.remove();

      if (tabName === 'positions') {
        pageTitle.textContent = 'Positions';
        pageSubtitle.textContent = '0 open';
        document.getElementById('view-positions').classList.add('active');
        fetchPositions();
      } else if (tabName === 'watchlist') {
        pageTitle.textContent = 'Watchlist';
        pageSubtitle.textContent = `${addedScripts.length} items`;
        document.getElementById('view-watchlist').classList.add('active');
        renderWatchlistTable();
      } else if (tabName === 'settings') {
        if (activePlatformUser) {
          // If logged in, Settings page allows logging out
          pageTitle.textContent = 'Account Profile';
          pageSubtitle.textContent = 'Active Client Session';
          renderProfileSettingsView();
        } else {
          pageTitle.textContent = 'Authentication';
          pageSubtitle.textContent = 'Sign In or Sign Up';
          renderAuthView();
        }
      } else {
        // Dynamic views (Orders, Funds, Profile, etc.)
        pageTitle.textContent = item.textContent.trim();
        pageSubtitle.textContent = tabName === 'funds' ? 'Equity & Derivatives' : 'Details';
        
        // Render dynamic content directly in a custom pane
        const newPane = document.createElement('div');
        newPane.className = 'view-pane active';
        newPane.id = `view-dynamic-${tabName}`;
        newPane.innerHTML = staticViewsHtml[tabName] || '<p>Content not available</p>';
        viewContainer.appendChild(newPane);

        // Fetch actual data
        if (tabName === 'orders') fetchOrders();
        if (tabName === 'funds') fetchFunds();
        if (tabName === 'profile') fetchProfile();
        if (tabName === 'trade-history') fetchTradeHistory();
        if (tabName === 'withdraw') fetchWithdrawals();
        if (tabName === 'ledger') fetchLedger();
        if (tabName === 'rejections') fetchRejections();
      }
    });
  });

  // Render Authentication View (Login/Register Forms)
  function renderAuthView() {
    const pane = document.createElement('div');
    pane.className = 'view-pane active';
    pane.id = 'view-dynamic-auth';
    
    pane.innerHTML = `
      <div style="display: flex; gap: 30px; max-width: 800px; margin: 0 auto; padding-top: 20px;">
        <!-- Login Card -->
        <div style="flex: 1; background: white; padding: 24px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; display: flex; flex-direction: column; gap: 16px;">
          <h3 style="margin: 0; font-size: 16px; font-weight: 700; color: #1a202c;">Client Login</h3>
          <div class="form-group">
            <label style="font-size: 12px; font-weight: 600; color: #4a5568;">Email Address</label>
            <input type="email" id="login-email" placeholder="Enter your email" style="padding: 10px; border: 1px solid #cbd5e0; border-radius: 6px; outline: none; background: #f8fafc; color: #1a202c;">
          </div>
          <div class="form-group">
            <label style="font-size: 12px; font-weight: 600; color: #4a5568;">Password</label>
            <input type="password" id="login-password" placeholder="Enter password" style="padding: 10px; border: 1px solid #cbd5e0; border-radius: 6px; outline: none; background: #f8fafc; color: #1a202c;">
          </div>
          <button class="btn btn-connect" id="btn-login-submit" style="width: 100%; height: 40px; justify-content: center; font-weight: 700; background-color: #0b57d0; color: white; border: none; border-radius: 6px; cursor: pointer;">Log In</button>
        </div>

        <!-- Register Card -->
        <div style="flex: 1; background: white; padding: 24px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; display: flex; flex-direction: column; gap: 16px;">
          <h3 style="margin: 0; font-size: 16px; font-weight: 700; color: #1a202c;">Client Sign Up</h3>
          <div class="form-group">
            <label style="font-size: 12px; font-weight: 600; color: #4a5568;">Full Name</label>
            <input type="text" id="register-name" placeholder="Enter your name" style="padding: 10px; border: 1px solid #cbd5e0; border-radius: 6px; outline: none; background: #f8fafc; color: #1a202c;">
          </div>
          <div class="form-group">
            <label style="font-size: 12px; font-weight: 600; color: #4a5568;">Email Address</label>
            <input type="email" id="register-email" placeholder="Enter email" style="padding: 10px; border: 1px solid #cbd5e0; border-radius: 6px; outline: none; background: #f8fafc; color: #1a202c;">
          </div>
          <div class="form-group">
            <label style="font-size: 12px; font-weight: 600; color: #4a5568;">Password</label>
            <input type="password" id="register-password" placeholder="Create password" style="padding: 10px; border: 1px solid #cbd5e0; border-radius: 6px; outline: none; background: #f8fafc; color: #1a202c;">
          </div>
          <button class="btn btn-connect" id="btn-register-submit" style="width: 100%; height: 40px; justify-content: center; font-weight: 700; background-color: #38a169; color: white; border: none; border-radius: 6px; cursor: pointer;">Sign Up</button>
        </div>
      </div>
    `;

    pane.querySelector('#btn-login-submit').addEventListener('click', handleLogin);
    pane.querySelector('#btn-register-submit').addEventListener('click', handleRegister);

    const oldDynamic = document.querySelector('[id^="view-dynamic-"]');
    if (oldDynamic) oldDynamic.remove();
    viewContainer.appendChild(pane);
  }

  // Render profile view when settings tab is clicked while logged in
  function renderProfileSettingsView() {
    const pane = document.createElement('div');
    pane.className = 'view-pane active';
    pane.id = 'view-dynamic-settings';

    const isBypassChecked = localStorage.getItem('bypassMarketHours') === 'true';

    pane.innerHTML = `
      <div style="background: white; padding: 24px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; max-width: 500px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px;">
        <h3 style="margin: 0; font-size: 16px; font-weight: 700; color: #1a202c;">Active Account Settings</h3>
        <p style="font-size: 13px; color: #718096; margin: 0;">You are currently logged in as: <strong>${activePlatformUser.name}</strong> (${activePlatformUser.email})</p>
        
        <div style="display: flex; align-items: center; gap: 8px; padding: 12px; background: #f7fafc; border-radius: 6px; border: 1px solid #e2e8f0;">
          <input type="checkbox" id="bypass-market-hours-toggle" ${isBypassChecked ? 'checked' : ''} style="cursor: pointer; width: 16px; height: 16px;">
          <label for="bypass-market-hours-toggle" style="font-size: 13px; font-weight: 600; color: #4a5568; cursor: pointer; user-select: none;">Bypass market hours check (Developer Test Mode)</label>
        </div>

        <button class="btn" id="btn-logout-submit" style="height: 40px; background-color: #e53e3e; color: white; border: none; border-radius: 6px; font-weight: 700; cursor: pointer;">Logout Account</button>
      </div>
    `;

    pane.querySelector('#bypass-market-hours-toggle').addEventListener('change', (e) => {
      localStorage.setItem('bypassMarketHours', e.target.checked ? 'true' : 'false');
    });

    pane.querySelector('#btn-logout-submit').addEventListener('click', () => {
      localStorage.removeItem('activePlatformUser');
      activePlatformUser = null;
      selectedScript = null;
      updateHeaderBalance();
      
      document.getElementById('settings-nav-text').textContent = 'Login';
      
      // Clear positions tbody view
      const tbody = document.querySelector('#view-positions tbody');
      if (tbody) {
        tbody.innerHTML = `
          <tr class="empty-state-row">
            <td colspan="8" class="empty-state-cell">
              <div class="empty-state-container">
                <p>Please log in to view positions</p>
              </div>
            </td>
          </tr>
        `;
      }
      
      alert("Logged out successfully from your platform account.");
      renderAuthView();
    });

    const oldDynamic = document.querySelector('[id^="view-dynamic-"]');
    if (oldDynamic) oldDynamic.remove();
    viewContainer.appendChild(pane);
  }

  function handleRegister() {
    const name = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value.trim().toLowerCase();
    const password = document.getElementById('register-password').value.trim();

    if (!name || !email || !password) {
      alert("All fields are required for sign up!");
      return;
    }

    const users = JSON.parse(localStorage.getItem('users_db') || '[]');
    if (users.some(u => u.email === email)) {
      alert("This email is already registered!");
      return;
    }

    // Create user with ₹0 starting balance
    const newUser = { name, email, password, walletBalance: 0 };
    users.push(newUser);
    localStorage.setItem('users_db', JSON.stringify(users));

    alert("Registration successful! You can now log in.");
    document.getElementById('register-name').value = '';
    document.getElementById('register-email').value = '';
    document.getElementById('register-password').value = '';
  }

  function handleLogin() {
    const email = document.getElementById('login-email').value.trim().toLowerCase();
    const password = document.getElementById('login-password').value.trim();

    if (!email || !password) {
      alert("Please enter both email and password!");
      return;
    }

    const users = JSON.parse(localStorage.getItem('users_db') || '[]');
    const user = users.find(u => u.email === email && u.password === password);

    if (!user) {
      alert("Invalid email or password!");
      return;
    }

    activePlatformUser = user;
    localStorage.setItem('activePlatformUser', JSON.stringify(user));

    addedScripts = JSON.parse(localStorage.getItem('watchlist_' + activePlatformUser.email) || '[]');

    alert(`Welcome back, ${user.name}!`);
    updateHeaderBalance();
    
    // Switch view to Positions view
    navItems.forEach(nav => nav.classList.remove('active'));
    document.querySelector('.nav-item[data-tab="positions"]').classList.add('active');
    document.getElementById('settings-nav-text').textContent = 'Logout';

    pageTitle.textContent = 'Positions';
    pageSubtitle.textContent = '0 open';
    document.getElementById('view-positions').classList.add('active');
    fetchPositions();
  }

  function updateHeaderBalance() {
    const balanceAmount = document.querySelector('.balance-amount');
    const statValBalance = document.querySelector('.header-lower-row .stat-item .stat-val');
    
    if (activePlatformUser) {
      const balance = activePlatformUser.walletBalance || 0;
      balanceAmount.textContent = `₹${balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      if (statValBalance) {
        statValBalance.textContent = `₹${balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      }
    } else {
      balanceAmount.textContent = '₹0.00';
      if (statValBalance) {
        statValBalance.textContent = '₹0.00';
      }
    }
  }

  function saveUserData() {
    localStorage.setItem('activePlatformUser', JSON.stringify(activePlatformUser));
    const users = JSON.parse(localStorage.getItem('users_db') || '[]');
    const idx = users.findIndex(u => u.email === activePlatformUser.email);
    if (idx !== -1) {
      users[idx].walletBalance = activePlatformUser.walletBalance;
      localStorage.setItem('users_db', JSON.stringify(users));
    }
  }

  function saveWatchlist() {
    if (activePlatformUser) {
      localStorage.setItem('watchlist_' + activePlatformUser.email, JSON.stringify(addedScripts));
    }
  }

  function logTransaction(type, amount) {
    const txs = JSON.parse(localStorage.getItem('transactions_db') || '[]');
    txs.push({
      id: 'TX' + Date.now(),
      userEmail: activePlatformUser.email,
      type: type,
      amount: amount,
      createdAt: new Date().toLocaleString()
    });
    localStorage.setItem('transactions_db', JSON.stringify(txs));
  }

  // Check initial login session status on local server and activePlatformUser
  checkSessionStatus();

  async function checkSessionStatus() {
    try {
      const res = await fetch('/api/session-status');
      const data = await res.json();
      if (data.loggedIn) {
        apiConnected = true;
        clientCode = data.clientCode;
        userName = data.userName;
      }
    } catch (e) {
      console.error("Session check failed", e);
    }
    
    // Load local platform user session
    activePlatformUser = JSON.parse(localStorage.getItem('activePlatformUser') || 'null');
    updateHeaderBalance();
    
    if (activePlatformUser) {
      document.getElementById('settings-nav-text').textContent = 'Logout';
      addedScripts = JSON.parse(localStorage.getItem('watchlist_' + activePlatformUser.email) || '[]');
      fetchPositions();
    } else {
      document.getElementById('settings-nav-text').textContent = 'Login';
      
      // Auto redirect to authentication tab if logged out on start
      navItems.forEach(nav => nav.classList.remove('active'));
      document.getElementById('settings-nav-btn').classList.add('active');
      pageTitle.textContent = 'Authentication';
      pageSubtitle.textContent = 'Sign In or Sign Up';
      renderAuthView();
    }
  }

  // Fetch virtual positions from LocalStorage
  function fetchPositions() {
    const tbody = document.querySelector('#view-positions tbody');
    if (!tbody) return;

    if (!activePlatformUser) {
      tbody.innerHTML = `
        <tr class="empty-state-row">
          <td colspan="9" class="empty-state-cell">
            <div class="empty-state-container">
              <p>Please log in to view positions</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    const positions = JSON.parse(localStorage.getItem('positions_db') || '[]');
    const openPositions = positions.filter(p => p.userEmail === activePlatformUser.email && p.status === 'OPEN');

    if (openPositions.length === 0) {
      tbody.innerHTML = `
        <tr class="empty-state-row">
          <td colspan="9" class="empty-state-cell">
            <div class="empty-state-container">
              <p>No open positions</p>
            </div>
          </td>
        </tr>
      `;
      pageSubtitle.textContent = '0 open';
      return;
    }

    pageSubtitle.textContent = `${openPositions.length} open`;
    tbody.innerHTML = '';
    
    openPositions.forEach(pos => {
      // Resolve live quote from watchlist or cache
      const matchingScript = addedScripts.find(s => s.token === pos.token);
      const liveQuote = (matchingScript && matchingScript.quote) ? matchingScript.quote
                      : positionQuoteCache[pos.token] || null;

      // Backward compat: old positions used buyPrice, new ones use entryPrice
      const entryPrice = pos.entryPrice || pos.buyPrice || 0;
      const ltp = liveQuote ? parseFloat(liveQuote.ltp) : entryPrice;

      const side = pos.side || 'BUY'; // backward compat: old positions default to BUY

      let exitPrice;
      let pl;
      if (side === 'BUY') {
        // LONG: exit at current Bid price
        exitPrice = liveQuote && liveQuote.depth && liveQuote.depth.buy && liveQuote.depth.buy.length > 0
          ? parseFloat(liveQuote.depth.buy[0].price) : ltp;
        pl = (exitPrice - entryPrice) * pos.quantity;
      } else {
        // SHORT: exit at current Ask price
        exitPrice = liveQuote && liveQuote.depth && liveQuote.depth.sell && liveQuote.depth.sell.length > 0
          ? parseFloat(liveQuote.depth.sell[0].price) : ltp;
        pl = (entryPrice - exitPrice) * pos.quantity;
      }

      const plClass = pl >= 0 ? 'green' : 'red';
      const plSign = pl >= 0 ? '+' : '';
      const sideColor = side === 'BUY' ? '#38a169' : '#e53e3e';
      const orderType = pos.orderType || 'NRML';
      const orderTypeBg = orderType === 'MIS' ? '#ebf4ff' : '#f0fff4';
      const orderTypeColor = orderType === 'MIS' ? '#3182ce' : '#38a169';

      const slText = pos.stopLoss ? `SL: ₹${parseFloat(pos.stopLoss).toFixed(2)}` : '—';
      const tgtText = pos.target ? `TGT: ₹${parseFloat(pos.target).toFixed(2)}` : '—';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="bold">${pos.symbol}<div style="font-size:9px;color:#a0aec0;margin-top:2px;">${pos.exchange}</div></td>
        <td>
          <span style="font-size:9px;padding:2px 6px;border-radius:10px;font-weight:700;background:${orderTypeBg};color:${orderTypeColor};">${orderType}</span>
          ${orderType === 'MIS' ? '<div style="font-size:9px;color:#3182ce;margin-top:2px;">5x Lev.</div>' : ''}
        </td>
        <td style="color:${sideColor};font-weight:700;">${side}</td>
        <td>${pos.quantity}</td>
        <td>₹${entryPrice.toFixed(2)}</td>
        <td>₹${exitPrice.toFixed(2)}</td>
        <td style="font-size:10px;color:#718096;">
          <div>${slText}</div>
          <div>${tgtText}</div>
        </td>
        <td class="${plClass}" style="font-weight:700;">${plSign}₹${pl.toFixed(2)}</td>
        <td>
          <button class="btn btn-withdraw btn-squareoff-pos" data-id="${pos.id}" style="height:24px;padding:2px 8px;font-size:11px;background-color:#fff5f5;border-color:#e53e3e;color:#e53e3e;">
            Squareoff
          </button>
        </td>
      `;

      tr.querySelector('.btn-squareoff-pos').addEventListener('click', () => {
        closeVirtualPosition(pos.id, exitPrice, 'MANUAL');
      });
      
      tbody.appendChild(tr);
    });
  }

  function closeVirtualPosition(posId, exitPrice, closeReason) {
    if (!activePlatformUser) return;
    const positions = JSON.parse(localStorage.getItem('positions_db') || '[]');
    const idx = positions.findIndex(p => p.id === posId && p.status === 'OPEN');
    
    if (idx === -1) return;
    
    const pos = positions[idx];
    const side = pos.side || 'BUY';
    const orderType = pos.orderType || 'NRML';
    
    // P&L depends on direction
    let pnl;
    if (side === 'BUY') {
      pnl = (exitPrice - pos.entryPrice) * pos.quantity;
    } else {
      pnl = (pos.entryPrice - exitPrice) * pos.quantity;
    }

    // Penalty for auto squareoff
    const penalty = (closeReason === 'AUTO_SQUAREOFF') ? 59 : 0; // ₹50 + 18% GST

    // Close position
    pos.status = 'CLOSED';
    pos.closePrice = exitPrice;
    pos.pnl = pnl;
    pos.closeReason = closeReason || 'MANUAL';
    
    localStorage.setItem('positions_db', JSON.stringify(positions));

    // Return margin + P&L to wallet (margin was what was actually debited at buy)
    const marginPaid = pos.marginPaid || (pos.entryPrice * pos.quantity); // backward compat
    const payout = marginPaid + pnl - penalty;
    activePlatformUser.walletBalance = (activePlatformUser.walletBalance || 0) + payout;
    saveUserData();
    
    logTransaction('TRADE_CLOSE', pnl);

    let alertMsg = `Position squared off!\n${pos.symbol} ${side} closed at ₹${exitPrice.toFixed(2)}\nP&L: ${pnl >= 0 ? '+' : ''}₹${pnl.toFixed(2)}`;
    if (penalty > 0) alertMsg += `\n⚠️ Auto Squareoff Penalty: ₹${penalty} deducted.`;
    showToast(alertMsg, pnl >= 0 ? 'success' : 'error');
    
    updateHeaderBalance();
    fetchPositions();
    renderDetailsPanel();
  }

  function fetchOrders() {
    const tbody = document.getElementById('orders-tbody');
    if (!tbody) return;

    if (!activePlatformUser) {
      tbody.innerHTML = `
        <tr class="empty-state-row">
          <td colspan="8" class="empty-state-cell">
            <div class="empty-state-container">
              <p>Please log in to view orders</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    const positions = JSON.parse(localStorage.getItem('positions_db') || '[]');
    const closedPositions = positions.filter(p => p.userEmail === activePlatformUser.email && p.status === 'CLOSED');

    if (closedPositions.length === 0) {
      tbody.innerHTML = `
        <tr class="empty-state-row">
          <td colspan="8" class="empty-state-cell">
            <div class="empty-state-container">
              <p>No executed orders</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = '';
    closedPositions.forEach(pos => {
      const tr = document.createElement('tr');
      const pl = parseFloat(pos.pnl || 0);
      const plClass = pl >= 0 ? 'green' : 'red';
      const plSign = pl >= 0 ? '+' : '';
      const side = pos.side || 'BUY';
      const sideColor = side === 'BUY' ? '#38a169' : '#e53e3e';
      const orderType = pos.orderType || 'NRML';
      const closeReasonBadge = pos.closeReason === 'AUTO_SQUAREOFF' ? '⚠️ AUTO' : pos.closeReason === 'SL_HIT' ? '🔴 SL' : pos.closeReason === 'TARGET_HIT' ? '🟢 TGT' : '';
      tr.innerHTML = `
        <td>${pos.createdAt || '--'}</td>
        <td class="bold">${pos.symbol}<div style="font-size:9px;color:#a0aec0;">${pos.exchange}</div></td>
        <td><span style="font-size:9px;padding:2px 5px;border-radius:10px;font-weight:700;background:${orderType==='MIS'?'#ebf4ff':'#f0fff4'};color:${orderType==='MIS'?'#3182ce':'#38a169'};">${orderType}</span></td>
        <td style="color:${sideColor};font-weight:700;">${side}</td>
        <td>${pos.quantity}</td>
        <td>₹${(pos.entryPrice || pos.buyPrice || 0).toFixed(2)}</td>
        <td>₹${pos.closePrice ? pos.closePrice.toFixed(2) : '--'} ${closeReasonBadge}</td>
        <td class="${plClass}" style="font-weight:700;">${plSign}₹${pl.toFixed(2)}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function fetchFunds() {
    if (!activePlatformUser) return;
    const balance = activePlatformUser.walletBalance || 0;
    
    const equityVal = document.getElementById('equity-val');
    const equityNet = document.getElementById('equity-net');
    
    if (equityVal) equityVal.textContent = balance.toFixed(2);
    if (equityNet) equityNet.textContent = balance.toFixed(2);
  }

  function fetchProfile() {
    const tbody = document.getElementById('profile-tbody');
    if (!tbody || !activePlatformUser) return;

    tbody.innerHTML = `
      <tr>
        <td>Client Name</td>
        <td class="bold">${activePlatformUser.name}</td>
      </tr>
      <tr>
        <td>Email ID</td>
        <td>${activePlatformUser.email}</td>
      </tr>
      <tr>
        <td>Virtual Wallet Balance</td>
        <td class="bold" style="color: #0b57d0;">₹${activePlatformUser.walletBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
      </tr>
      <tr>
        <td>Broker Connection</td>
        <td>Angel One SmartAPI (Live Feed Active)</td>
      </tr>
    `;
  }

  function fetchTradeHistory() {
    const tbody = document.querySelector('#view-dynamic-trade-history tbody');
    if (!tbody) return;

    if (!activePlatformUser) {
      tbody.innerHTML = `
        <tr class="empty-state-row">
          <td colspan="7" class="empty-state-cell">
            <div class="empty-state-container"><p>Please log in to view trade history</p></div>
          </td>
        </tr>
      `;
      return;
    }

    const positions = JSON.parse(localStorage.getItem('positions_db') || '[]');
    const userPos = positions.filter(p => p.userEmail === activePlatformUser.email);

    if (userPos.length === 0) {
      tbody.innerHTML = `
        <tr class="empty-state-row">
          <td colspan="7" class="empty-state-cell">
            <div class="empty-state-container"><p>No trades executed today</p></div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = '';
    userPos.forEach(pos => {
      const tr = document.createElement('tr');
      const val = pos.buyPrice * pos.quantity;
      tr.innerHTML = `
        <td>${pos.createdAt || '--'}</td>
        <td class="bold">${pos.symbol}</td>
        <td><span class="watchlist-pill" style="font-size: 9px; padding: 2px 6px;">${pos.exchange}</span></td>
        <td style="color: #38a169; font-weight: 600;">BUY</td>
        <td>${pos.quantity}</td>
        <td>₹${pos.buyPrice.toFixed(2)}</td>
        <td>₹${val.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
      `;
      tbody.appendChild(tr);

      if (pos.status === 'CLOSED') {
        const trClose = document.createElement('tr');
        const closeVal = pos.closePrice * pos.quantity;
        trClose.innerHTML = `
          <td>${pos.createdAt || '--'}</td>
          <td class="bold">${pos.symbol}</td>
          <td><span class="watchlist-pill" style="font-size: 9px; padding: 2px 6px;">${pos.exchange}</span></td>
          <td style="color: #e53e3e; font-weight: 600;">SELL</td>
          <td>${pos.quantity}</td>
          <td>₹${pos.closePrice ? pos.closePrice.toFixed(2) : '--'}</td>
          <td>₹${closeVal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
        `;
        tbody.appendChild(trClose);
      }
    });
  }

  function fetchWithdrawals() {
    const tbody = document.querySelector('#view-dynamic-withdraw tbody');
    if (!tbody) return;

    if (!activePlatformUser) {
      tbody.innerHTML = `
        <tr class="empty-state-row">
          <td colspan="4" class="empty-state-cell">
            <div class="empty-state-container"><p>Please log in to view withdrawals</p></div>
          </td>
        </tr>
      `;
      return;
    }

    const txs = JSON.parse(localStorage.getItem('transactions_db') || '[]');
    const userWithdraws = txs.filter(t => t.userEmail === activePlatformUser.email && t.type === 'WITHDRAWAL');

    if (userWithdraws.length === 0) {
      tbody.innerHTML = `
        <tr class="empty-state-row">
          <td colspan="4" class="empty-state-cell">
            <div class="empty-state-container"><p>No withdrawal requests found</p></div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = '';
    userWithdraws.forEach(t => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${t.createdAt || '--'}</td>
        <td style="color: #e53e3e; font-weight: 600;">₹${t.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        <td>Bank Account (HDFC ****8901)</td>
        <td><span style="padding: 2px 6px; border-radius: 4px; font-size: 11px; background-color: #e6fffa; color: #38a169; font-weight: 600;">APPROVED</span></td>
      `;
      tbody.appendChild(tr);
    });
  }

  function fetchLedger() {
    const tbody = document.querySelector('#view-dynamic-ledger tbody');
    if (!tbody) return;

    if (!activePlatformUser) {
      tbody.innerHTML = `
        <tr class="empty-state-row">
          <td colspan="5" class="empty-state-cell">
            <div class="empty-state-container"><p>Please log in to view ledger</p></div>
          </td>
        </tr>
      `;
      return;
    }

    const txs = JSON.parse(localStorage.getItem('transactions_db') || '[]');
    const userTxs = txs.filter(t => t.userEmail === activePlatformUser.email);

    if (userTxs.length === 0) {
      tbody.innerHTML = `
        <tr class="empty-state-row">
          <td colspan="5" class="empty-state-cell">
            <div class="empty-state-container"><p>No transactions available in current statement</p></div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = '';
    let runningBalance = 0;
    
    userTxs.forEach(t => {
      const tr = document.createElement('tr');
      
      let particulars = '';
      let debit = '--';
      let credit = '--';

      if (t.type === 'DEPOSIT') {
        particulars = 'Simulated Net Banking Payin';
        credit = `₹${t.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
        runningBalance += t.amount;
      } else if (t.type === 'WITHDRAWAL') {
        particulars = 'Payout request processed';
        debit = `₹${t.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
        runningBalance -= t.amount;
      } else if (t.type === 'TRADE_BUY') {
        particulars = 'Virtual Trade BUY (incl. 10% commission)';
        debit = `₹${Math.abs(t.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
        runningBalance += t.amount;
      } else if (t.type === 'TRADE_CLOSE') {
        particulars = 'Virtual Trade Close payout';
        if (t.amount >= 0) {
          credit = `₹${t.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
        } else {
          debit = `₹${Math.abs(t.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
        }
        runningBalance += t.amount;
      }

      tr.innerHTML = `
        <td>${t.createdAt || '--'}</td>
        <td>${particulars}</td>
        <td style="color: #e53e3e;">${debit}</td>
        <td style="color: #38a169;">${credit}</td>
        <td class="bold" style="color: #0b57d0;">₹${runningBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function fetchRejections() {
    const tbody = document.querySelector('#view-dynamic-rejections tbody');
    if (!tbody) return;

    if (!activePlatformUser) {
      tbody.innerHTML = `
        <tr class="empty-state-row">
          <td colspan="5" class="empty-state-cell">
            <div class="empty-state-container"><p>Please log in to view rejections</p></div>
          </td>
        </tr>
      `;
      return;
    }

    const rejections = JSON.parse(localStorage.getItem('rejections_db') || '[]');
    const userRejects = rejections.filter(r => r.userEmail === activePlatformUser.email);

    if (userRejects.length === 0) {
      tbody.innerHTML = `
        <tr class="empty-state-row">
          <td colspan="5" class="empty-state-cell">
            <div class="empty-state-container"><p>No rejected orders recorded</p></div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = '';
    userRejects.forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${r.time || '--'}</td>
        <td class="bold">${r.symbol}</td>
        <td style="color: #38a169; font-weight: 600;">${r.side}</td>
        <td>${r.qty}</td>
        <td style="color: #e53e3e; font-weight: 600;">${r.reason}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Watchlist Action Buttons for Overlay opening
  const openOverlay = () => {
    if (!apiConnected) {
      alert("Please connect your Angel One API in the Settings tab first to search and add scripts!");
      return;
    }
    renderOverlayScripts();
    addScriptOverlay.classList.add('open');
    scriptSearchInput.focus();
  };

  document.getElementById('add-script-btn-top').addEventListener('click', openOverlay);
  document.getElementById('add-script-btn-center').addEventListener('click', openOverlay);

  // Close Overlay Modal
  closeOverlayBtn.addEventListener('click', () => {
    addScriptOverlay.classList.remove('open');
    renderWatchlistTable();
    pageSubtitle.textContent = `${addedScripts.length} items`;
  });

  // Category Tab switching in Overlay
  categoryTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      categoryTabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderOverlayScripts();
    });
  });

  // Search input in Overlay
  scriptSearchInput.addEventListener('input', () => {
    renderOverlayScripts();
  });

  // Render list of scripts inside Overlay
  async function renderOverlayScripts() {
    const activeTab = document.querySelector('.overlay-tabs .tab-btn.active');
    const category = activeTab.getAttribute('data-category');
    const searchVal = scriptSearchInput.value.trim().toLowerCase();
    
    scriptListContent.innerHTML = '<div style="padding: 24px; text-align: center; color: #a0aec0; font-size: 13px;">Searching...</div>';

    let list = [];
    
    // Fetch from backend API to query the OpenAPI Scrip Master (returns first 300 by default if empty)
    try {
      const response = await fetch(`/api/search-scripts?query=${searchVal}&category=${category}`);
      const result = await response.json();
      if (result.success && result.data) {
        // Map to match code, name, expiry, exchange, token
        list = result.data.map(item => ({
          code: item.symbol,
          name: item.name,
          expiry: item.expiry ? `Exp: ${item.expiry}` : item.exch_seg,
          exchange: item.exch_seg,
          token: item.token,
          lotsize: item.lotsize || 1
        }));

        // Dynamically update category tab counts to show actual results
        if (result.counts) {
          categoryTabBtns.forEach(btn => {
            const catName = btn.getAttribute('data-category');
            const countSpan = btn.querySelector('.tab-count');
            if (countSpan && result.counts[catName] !== undefined) {
              countSpan.textContent = result.counts[catName];
            }
          });
        }
      }
    } catch (e) {
      console.error("Failed to fetch scripts", e);
      list = [];
    }

    scriptListContent.innerHTML = '';
    
    if (list.length === 0) {
      scriptListContent.innerHTML = '<div style="padding: 24px; text-align: center; color: #a0aec0; font-size: 13px;">No scripts found. Type to search all.</div>';
      return;
    }

    list.forEach(item => {
      const isAdded = addedScripts.some(s => s.code === item.code);
      
      const itemDiv = document.createElement('div');
      itemDiv.className = 'script-item';
      itemDiv.innerHTML = `
        <div class="script-details">
          <span class="script-code">${item.code}</span>
          <span class="script-name">${item.name}</span>
          <span class="script-expiry">${item.expiry}</span>
        </div>
        <button class="btn-add-item ${isAdded ? 'added' : ''}" data-code="${item.code}">
          ${isAdded ? `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width: 14px; height: 14px;">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          ` : `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;">
              <line x1="12" x2="12" y1="5" y2="19"/>
              <line x1="5" x2="19" y1="12" y2="12"/>
            </svg>
          `}
        </button>
      `;

      // Plus Button action
      itemDiv.querySelector('.btn-add-item').addEventListener('click', (e) => {
        const btn = e.currentTarget;
        const code = btn.getAttribute('data-code');
        
        if (addedScripts.some(s => s.code === code)) {
          // Remove if already added
          addedScripts = addedScripts.filter(s => s.code !== code);
          saveWatchlist();
          btn.classList.remove('added');
          btn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;">
              <line x1="12" x2="12" y1="5" y2="19"/>
              <line x1="5" x2="19" y1="12" y2="12"/>
            </svg>
          `;
        } else {
          // Add script to list
          const scriptData = list.find(s => s.code === code);
          if (scriptData) {
            addedScripts.push(scriptData);
            saveWatchlist();
            btn.classList.add('added');
            btn.innerHTML = `
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width: 14px; height: 14px;">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            `;
          }
        }
        
        // Update Counter
        addedCounter.textContent = addedScripts.length;
      });

      scriptListContent.appendChild(itemDiv);
    });
  }

  // Render the Watchlist Table in the dashboard
  function renderWatchlistTable() {
    if (!apiConnected) {
      watchlistTbody.innerHTML = `
        <tr class="empty-state-row">
          <td colspan="10" class="empty-state-cell">
            <div class="empty-state-container">
              <p>Your watchlist is empty</p>
              <span style="font-size: 12px; color: #a0aec0; margin-top: 6px;">Connect your Angel One API in the Settings tab to search and add instruments.</span>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    const searchVal = watchlistSearchInput.value.toLowerCase();
    const filtered = addedScripts.filter(s => 
      s.code.toLowerCase().includes(searchVal) || 
      s.name.toLowerCase().includes(searchVal)
    );

    if (filtered.length === 0) {
      watchlistTbody.innerHTML = `
        <tr class="empty-state-row">
          <td colspan="10" class="empty-state-cell">
            <div class="empty-state-container">
              <p>Your watchlist is empty</p>
              <button class="btn btn-add-first-script" id="add-script-btn-center-new">
                <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
                Add your first script
              </button>
            </div>
          </td>
        </tr>
      `;
      const newCenterBtn = document.getElementById('add-script-btn-center-new');
      if (newCenterBtn) {
        newCenterBtn.addEventListener('click', openOverlay);
      }
      return;
    }

    watchlistTbody.innerHTML = '';
    filtered.forEach(script => {
      // Trigger dynamic quote fetching
      fetchQuoteForScript(script);

      const q = script.quote || {
        ltp: '--',
        netChange: '--',
        percentChange: '--',
        open: '--',
        high: '--',
        low: '--',
        close: '--',
        depth: { buy: [{ price: '--' }], sell: [{ price: '--' }] }
      };

      const isPositive = parseFloat(q.netChange) >= 0 || q.netChange === '--';
      const changeColor = q.netChange === '--' ? '#718096' : (isPositive ? '#38a169' : '#e53e3e');
      const changeSign = q.netChange === '--' || parseFloat(q.netChange) < 0 ? '' : '+';

      const tr = document.createElement('tr');
      tr.style.cursor = 'pointer';
      
      // Highlight row if currently selected
      if (selectedScript && selectedScript.code === script.code) {
        tr.style.backgroundColor = '#edf2f7';
      }

      tr.innerHTML = `
        <td class="scrip-col bold" style="padding-left: 20px;">
          <div>${script.code}</div>
          <div style="font-size: 10px; color: #a0aec0; font-weight: normal; margin-top: 2px;">${script.name}</div>
        </td>
        <td><span class="watchlist-pill" style="font-size: 9px; padding: 2px 6px;">${script.exchange}</span></td>
        <td style="color: #38a169; font-weight: 500;">${q.depth.buy[0].price}</td>
        <td style="color: #e53e3e; font-weight: 500;">${q.depth.sell[0].price}</td>
        <td style="color: ${changeColor}; font-size: 11px; font-weight: 500;">
          <div>${changeSign}${q.netChange}</div>
          <div style="font-size: 9px; margin-top: 2px;">${changeSign}${q.percentChange}%</div>
        </td>
        <td>${q.high}</td>
        <td>${q.low}</td>
        <td>${q.open}</td>
        <td>${q.close}</td>
        <td class="bold" style="color: ${changeColor};">${q.ltp}</td>
        <td style="text-align: center; vertical-align: middle; padding: 0 10px;">
          <button class="btn-delete-watchlist" data-code="${script.code}" style="background: none; border: none; padding: 4px; cursor: pointer; color: #a0aec0; transition: color 0.2s; display: flex; align-items: center; justify-content: center;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
          </button>
        </td>
      `;

      // Select active script row on click (unless delete is clicked)
      tr.addEventListener('click', (e) => {
        if (e.target.closest('.btn-delete-watchlist')) return;
        selectedScript = script;
        renderWatchlistTable();
        renderDetailsPanel();
      });

      // Bind delete button listener
      tr.querySelector('.btn-delete-watchlist').addEventListener('click', (e) => {
        e.stopPropagation();
        const codeToDelete = script.code;
        addedScripts = addedScripts.filter(s => s.code !== codeToDelete);
        saveWatchlist();
        
        if (selectedScript && selectedScript.code === codeToDelete) {
          selectedScript = null;
        }

        // Update top badge count
        addedCounter.textContent = addedScripts.length;
        
        renderWatchlistTable();
        renderDetailsPanel();
      });

      watchlistTbody.appendChild(tr);
    });
  }

  // Fetch live market quotes from Express proxy server
  async function fetchQuoteForScript(script) {
    if (script.quote) return;
    try {
      const response = await fetch(`/api/market-data?exchange=${script.exchange}&token=${script.token}`);
      const result = await response.json();
      if (result.success && result.data) {
        script.quote = result.data;
        renderWatchlistTable();
        if (selectedScript && selectedScript.code === script.code) {
          selectedScript = script;
          renderDetailsPanel();
        }
      }
    } catch (e) {
      console.error("Error fetching market data for " + script.code, e);
    }
  }

  // Render the right-hand Instrument Details Panel with sparkline chart
  function renderDetailsPanel() {
    const detailsPanel = document.querySelector('.watchlist-details-panel');
    if (!detailsPanel) return;

    if (!selectedScript) {
      detailsPanel.innerHTML = `
        <div class="select-instrument-placeholder">
          <p>Select an instrument</p>
        </div>
      `;
      return;
    }

    const q = selectedScript.quote || {
      ltp: '0.00',
      netChange: '0.00',
      percentChange: '0.00',
      open: '0.00',
      high: '0.00',
      low: '0.00',
      close: '0.00',
      depth: { buy: [{ price: '0.00' }], sell: [{ price: '0.00' }] }
    };

    const isPositive = parseFloat(q.netChange) >= 0;
    const colorStyle = isPositive ? 'color: #38a169;' : 'color: #e53e3e;';
    const sign = isPositive ? '+' : '';

    // Calculate a mock SVGs sparkline path based on Open, Low, High, Close
    const open = parseFloat(q.open) || 0;
    const high = parseFloat(q.high) || 0;
    const low = parseFloat(q.low) || 0;
    const close = parseFloat(q.close) || 0;
    const ltp = parseFloat(q.ltp) || 0;

    let points = [];
    if (high > low) {
      const scale = (val) => 70 - ((val - low) / (high - low)) * 60; // scale between 10 and 70
      points = [
        `0,${scale(open)}`,
        `60,${scale(low)}`,
        `120,${scale(ltp * 0.995)}`,
        `180,${scale(high)}`,
        `250,${scale(ltp)}`
      ];
    } else {
      points = ["0,40", "60,45", "120,38", "180,42", "250,40"];
    }

    detailsPanel.innerHTML = `
      <div class="instrument-details-active" style="width: 100%; display: flex; flex-direction: column; gap: 20px;">
        <!-- Header -->
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div>
            <h3 style="font-size: 18px; font-weight: 700; color: #1a202c; margin: 0;">${selectedScript.code}</h3>
            <span style="font-size: 11px; color: #718096; text-transform: uppercase;">${selectedScript.name}</span>
          </div>
          <span class="watchlist-pill" style="font-size: 11px; padding: 3px 8px; font-weight: 600;">${selectedScript.exchange}</span>
        </div>

        <!-- Price Display -->
        <div style="display: flex; justify-content: space-between; align-items: baseline;">
          <div>
            <div style="font-size: 26px; font-weight: 700; ${colorStyle}">${q.ltp}</div>
            <div style="font-size: 12px; font-weight: 600; ${colorStyle} margin-top: 2px;">
              ${sign}${q.netChange} (${sign}${q.percentChange}%)
            </div>
          </div>
          <div style="text-align: right; font-size: 12px;">
            <div style="color: #718096; margin-bottom: 2px;">BID <span style="color: #38a169; font-weight: 600; margin-left: 4px;">${q.depth.buy[0].price}</span></div>
            <div style="color: #718096;">ASK <span style="color: #e53e3e; font-weight: 600; margin-left: 4px;">${q.depth.sell[0].price}</span></div>
          </div>
        </div>

        <!-- OHLC Grid -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; border-top: 1px solid #edf2f7; border-bottom: 1px solid #edf2f7; padding: 12px 0;">
          <div style="text-align: center;">
            <div style="font-size: 10px; color: #a0aec0; font-weight: 600; text-transform: uppercase;">Open</div>
            <div style="font-size: 12px; font-weight: 600; color: #2d3748; margin-top: 4px;">${q.open}</div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 10px; color: #a0aec0; font-weight: 600; text-transform: uppercase;">High</div>
            <div style="font-size: 12px; font-weight: 600; color: #2d3748; margin-top: 4px;">${q.high}</div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 10px; color: #a0aec0; font-weight: 600; text-transform: uppercase;">Low</div>
            <div style="font-size: 12px; font-weight: 600; color: #2d3748; margin-top: 4px;">${q.low}</div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 10px; color: #a0aec0; font-weight: 600; text-transform: uppercase;">Close</div>
            <div style="font-size: 12px; font-weight: 600; color: #2d3748; margin-top: 4px;">${q.close}</div>
          </div>
        </div>

        <!-- Mini Sparkline Graph -->
        <div style="height: 100px; display: flex; align-items: center; justify-content: center; background-color: #f8fafc; border-radius: 8px; position: relative; padding: 10px;">
          <svg style="width: 100%; height: 100%; overflow: visible;">
            <path d="M ${points.join(' L ')}" fill="none" stroke="${isPositive ? '#38a169' : '#e53e3e'}" stroke-width="2.5" stroke-linecap="round"></path>
          </svg>
        </div>

        <!-- Buy / Sell Action buttons -->
        <div style="display: flex; gap: 12px; margin-top: 10px;">
          <button class="btn btn-sell-action" style="flex: 1; height: 42px; background-color: #fff5f5; border: 1px solid #e53e3e; border-radius: 8px; color: #e53e3e; font-weight: 700; cursor: pointer; transition: all 0.2s;">
            SELL <span style="display:block; font-size:11px; font-weight:500; margin-top:2px;">${q.depth.buy[0].price}</span>
          </button>
          <button class="btn btn-buy-action" style="flex: 1; height: 42px; background-color: #e6fffa; border: 1px solid #38a169; border-radius: 8px; color: #38a169; font-weight: 700; cursor: pointer; transition: all 0.2s;">
            BUY <span style="display:block; font-size:11px; font-weight:500; margin-top:2px;">@ ${q.depth.sell[0].price}</span>
          </button>
        </div>
      </div>
    `;

    // Helper: show order dialog and return params, or null if cancelled
    function showOrderDialog(side, price) {
      return new Promise((resolve) => {
        const modal = document.getElementById('order-modal');
        const actionBadge = document.getElementById('order-modal-action-badge');
        const symbolEl = document.getElementById('order-modal-symbol');
        const exchBadge = document.getElementById('order-modal-exchange-badge');
        const priceLabelEl = document.getElementById('order-modal-price-label');
        const priceEl = document.getElementById('order-modal-price');
        const qtyInput = document.getElementById('order-qty-input');
        const lotsizeHelp = document.getElementById('order-modal-lotsize-help');
        const slInput = document.getElementById('order-sl-input');
        const targetInput = document.getElementById('order-target-input');
        const marginEst = document.getElementById('order-modal-margin-est');
        const walletBal = document.getElementById('order-modal-wallet-bal');
        const confirmBtn = document.getElementById('confirm-order-btn');
        const closeBtn = document.getElementById('close-order-modal-btn');

        const defaultQty = parseInt(selectedScript.lotsize) || 1;
        
        // Reset and populate fields
        symbolEl.textContent = selectedScript.code;
        exchBadge.textContent = selectedScript.exchange;
        priceEl.textContent = `₹${price.toFixed(2)}`;
        priceLabelEl.textContent = side === 'BUY' ? 'ASK PRICE' : 'BID PRICE';
        
        actionBadge.textContent = side === 'BUY' ? 'BUY' : 'SELL';
        actionBadge.style.background = side === 'BUY' ? '#e6fffa' : '#fff5f5';
        actionBadge.style.color = side === 'BUY' ? '#38a169' : '#e53e3e';
        
        qtyInput.value = defaultQty;
        lotsizeHelp.textContent = `Min lot size: ${defaultQty}`;
        
        slInput.value = '';
        targetInput.value = '';
        
        walletBal.textContent = `₹${activePlatformUser.walletBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
        
        let currentOrderType = 'MIS'; // Default product type

        // Setup product tabs
        const tabMis = document.getElementById('order-tab-mis');
        const tabNrml = document.getElementById('order-tab-nrml');
        
        tabMis.className = 'order-dialog-tab-btn active';
        tabNrml.className = 'order-dialog-tab-btn';
        
        tabMis.onclick = () => {
          tabMis.className = 'order-dialog-tab-btn active';
          tabNrml.className = 'order-dialog-tab-btn';
          currentOrderType = 'MIS';
          updateCalculations();
        };
        
        tabNrml.onclick = () => {
          tabNrml.className = 'order-dialog-tab-btn active';
          tabMis.className = 'order-dialog-tab-btn';
          currentOrderType = 'NRML';
          updateCalculations();
        };

        // Live calculation updates
        function updateCalculations() {
          const qty = parseInt(qtyInput.value) || 0;
          const fullValue = price * qty;
          const requiredMargin = currentOrderType === 'MIS' ? fullValue * 0.20 : fullValue;
          marginEst.textContent = `₹${requiredMargin.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
        
        qtyInput.oninput = updateCalculations;
        updateCalculations();

        // Style the main action button
        confirmBtn.textContent = `Place ${side === 'BUY' ? 'BUY LONG' : 'SELL SHORT'} Order`;
        confirmBtn.style.background = side === 'BUY' ? '#38a169' : '#e53e3e';
        confirmBtn.style.boxShadow = side === 'BUY' ? '0 4px 12px rgba(56, 161, 105, 0.2)' : '0 4px 12px rgba(229, 62, 62, 0.2)';

        // Open modal
        modal.style.display = 'flex';

        // Close functions
        function cleanup() {
          modal.style.display = 'none';
          confirmBtn.onclick = null;
          closeBtn.onclick = null;
          qtyInput.oninput = null;
          tabMis.onclick = null;
          tabNrml.onclick = null;
        }

        closeBtn.onclick = () => {
          cleanup();
          resolve(null);
        };

        confirmBtn.onclick = () => {
          const qty = parseInt(qtyInput.value);
          const stopLoss = slInput.value ? parseFloat(slInput.value) : null;
          const target = targetInput.value ? parseFloat(targetInput.value) : null;

          if (isNaN(qty) || qty <= 0) {
            showToast('Please enter a valid positive quantity.', 'error');
            return;
          }

          const exch = (selectedScript.exchange || '').toUpperCase();
          if ((exch === 'NFO' || exch === 'MCX' || exch === 'CDS') && qty % defaultQty !== 0) {
            showToast(`Order Rejected: Quantity must be in multiples of the lot size (${defaultQty}) for ${selectedScript.code}.`, 'error');
            return;
          }

          cleanup();
          resolve({ qty, orderType: currentOrderType, stopLoss, target });
        };
      });
    }

    // Helper: log rejection
    function logRejection(side, qty, reason) {
      const rejections = JSON.parse(localStorage.getItem('rejections_db') || '[]');
      rejections.push({
        userEmail: activePlatformUser.email,
        time: new Date().toLocaleString(),
        symbol: selectedScript.code,
        side,
        qty,
        reason
      });
      localStorage.setItem('rejections_db', JSON.stringify(rejections));
    }

    // Action clicks — BUY button
    detailsPanel.querySelector('.btn-buy-action').addEventListener('click', async () => {
      if (!activePlatformUser) { showToast('Please log in to place trades!', 'warning'); return; }

      const ltp = parseFloat(q.ltp);
      const askPrice = q.depth && q.depth.sell && q.depth.sell.length > 0 ? parseFloat(q.depth.sell[0].price) : ltp;
      const bidPrice = q.depth && q.depth.buy && q.depth.buy.length > 0 ? parseFloat(q.depth.buy[0].price) : ltp;

      if (isNaN(askPrice) || askPrice <= 0) { showToast('Wait for live quotes to load before buying!', 'warning'); return; }

      // Check if there's an open SHORT position → close it (Buy to cover)
      const positions = JSON.parse(localStorage.getItem('positions_db') || '[]');
      const openShort = positions.find(p => p.userEmail === activePlatformUser.email && p.symbol === selectedScript.code && p.status === 'OPEN' && (p.side || 'BUY') === 'SELL');
      if (openShort) {
        if (confirm(`You have an open SHORT on ${selectedScript.code}.\nBUY to cover (close short) at Ask ₹${askPrice.toFixed(2)}?`)) {
          closeVirtualPosition(openShort.id, askPrice, 'MANUAL');
        }
        return;
      }

      // Check market hours
      const bypass = localStorage.getItem('bypassMarketHours') === 'true';
      const marketStatus = isMarketOpen(selectedScript.exchange);
      if (!marketStatus.open && !bypass) {
        logRejection('BUY', '?', `Market Closed: ${marketStatus.reason}`);
        showToast(`Order Rejected: ${marketStatus.reason}\n\n(Tip: Enable "Bypass market hours" in Profile settings to test anytime).`, 'error');
        return;
      }

      // Show order dialog
      const params = await showOrderDialog('BUY', askPrice);
      if (!params) return;
      const { qty, orderType, stopLoss, target } = params;

      // Calculate margin (MIS = 20% of full value, NRML = 100%)
      const fullValue = askPrice * qty;
      const marginRequired = orderType === 'MIS' ? fullValue * 0.20 : fullValue;

      if (marginRequired > activePlatformUser.walletBalance) {
        logRejection('BUY', qty, `Insufficient balance (Need ₹${marginRequired.toLocaleString('en-IN', { maximumFractionDigits: 2 })})`);
        showToast(`Insufficient wallet balance!\nRequired margin: ₹${marginRequired.toLocaleString('en-IN', { maximumFractionDigits: 2 })}\nAvailable: ₹${activePlatformUser.walletBalance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, 'error');
        return;
      }

      activePlatformUser.walletBalance -= marginRequired;
      saveUserData();

      const newPos = {
        id: 'POS' + Date.now(),
        userEmail: activePlatformUser.email,
        symbol: selectedScript.code,
        name: selectedScript.name,
        exchange: selectedScript.exchange,
        token: selectedScript.token,
        side: 'BUY',
        orderType,
        entryPrice: askPrice,
        buyPrice: askPrice, // backward compat
        quantity: qty,
        fullTradeValue: fullValue,
        marginPaid: marginRequired,
        stopLoss: stopLoss || null,
        target: target || null,
        status: 'OPEN',
        pnl: 0,
        createdAt: new Date().toLocaleString()
      };
      positions.push(newPos);
      localStorage.setItem('positions_db', JSON.stringify(positions));

      if (!addedScripts.some(s => s.code === selectedScript.code)) {
        addedScripts.push(selectedScript);
        addedCounter.textContent = addedScripts.length;
        saveWatchlist();
      }

      logTransaction('TRADE_BUY', -marginRequired);
      showToast(`BUY order placed!\n${selectedScript.code} LONG ${qty} units @ ₹${askPrice.toFixed(2)}`, 'success');
      
      updateHeaderBalance();
      fetchPositions();
      renderDetailsPanel();
    });

    // Action clicks — SELL button
    detailsPanel.querySelector('.btn-sell-action').addEventListener('click', async () => {
      if (!activePlatformUser) { showToast('Please log in to place trades!', 'warning'); return; }

      const ltp = parseFloat(q.ltp);
      const bidPrice = q.depth && q.depth.buy && q.depth.buy.length > 0 ? parseFloat(q.depth.buy[0].price) : ltp;
      const askPrice = q.depth && q.depth.sell && q.depth.sell.length > 0 ? parseFloat(q.depth.sell[0].price) : ltp;

      if (isNaN(bidPrice) || bidPrice <= 0) { showToast('Wait for live quotes to load before selling!', 'warning'); return; }

      // Check if there's an open LONG position → close it (Squareoff)
      const positions = JSON.parse(localStorage.getItem('positions_db') || '[]');
      const openLong = positions.find(p => p.userEmail === activePlatformUser.email && p.symbol === selectedScript.code && p.status === 'OPEN' && (p.side || 'BUY') === 'BUY');
      if (openLong) {
        if (confirm(`You have an open LONG on ${selectedScript.code}.\nSELL to squareoff at Bid ₹${bidPrice.toFixed(2)}?`)) {
          closeVirtualPosition(openLong.id, bidPrice, 'MANUAL');
        }
        return;
      }

      // No open long → open a SHORT position
      const bypass = localStorage.getItem('bypassMarketHours') === 'true';
      const marketStatus = isMarketOpen(selectedScript.exchange);
      if (!marketStatus.open && !bypass) {
        logRejection('SELL SHORT', '?', `Market Closed: ${marketStatus.reason}`);
        showToast(`Order Rejected: ${marketStatus.reason}`, 'error');
        return;
      }

      // Show order dialog
      const params = await showOrderDialog('SELL', bidPrice);
      if (!params) return;
      const { qty, orderType, stopLoss, target } = params;

      const fullValue = bidPrice * qty;
      const marginRequired = orderType === 'MIS' ? fullValue * 0.20 : fullValue;

      if (marginRequired > activePlatformUser.walletBalance) {
        logRejection('SELL SHORT', qty, `Insufficient balance (Need ₹${marginRequired.toLocaleString('en-IN', { maximumFractionDigits: 2 })})`);
        showToast(`Insufficient wallet balance!\nRequired margin: ₹${marginRequired.toLocaleString('en-IN', { maximumFractionDigits: 2 })}\nAvailable: ₹${activePlatformUser.walletBalance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, 'error');
        return;
      }

      activePlatformUser.walletBalance -= marginRequired;
      saveUserData();

      const newPos = {
        id: 'POS' + Date.now(),
        userEmail: activePlatformUser.email,
        symbol: selectedScript.code,
        name: selectedScript.name,
        exchange: selectedScript.exchange,
        token: selectedScript.token,
        side: 'SELL',
        orderType,
        entryPrice: bidPrice,
        buyPrice: bidPrice, // backward compat
        quantity: qty,
        fullTradeValue: fullValue,
        marginPaid: marginRequired,
        stopLoss: stopLoss || null,
        target: target || null,
        status: 'OPEN',
        pnl: 0,
        createdAt: new Date().toLocaleString()
      };
      positions.push(newPos);
      localStorage.setItem('positions_db', JSON.stringify(positions));

      if (!addedScripts.some(s => s.code === selectedScript.code)) {
        addedScripts.push(selectedScript);
        addedCounter.textContent = addedScripts.length;
        saveWatchlist();
      }

      logTransaction('TRADE_SELL_SHORT', -marginRequired);
      showToast(`SELL SHORT order placed!\n${selectedScript.code} SHORT ${qty} units @ ₹${bidPrice.toFixed(2)}`, 'success');
      
      updateHeaderBalance();
      fetchPositions();
      renderDetailsPanel();
    });
  }

  function isMarketOpen(exchange) {
    try {
      const options = { timeZone: 'Asia/Kolkata', hour12: false, weekday: 'short', hour: '2-digit', minute: '2-digit' };
      const formatter = new Intl.DateTimeFormat('en-US', options);
      const formatted = formatter.format(new Date()); 
      
      const parts = formatted.split(', ');
      const weekday = parts[0];
      const timeParts = parts[1].split(':');
      const hours = parseInt(timeParts[0]);
      const minutes = parseInt(timeParts[1]);
      const totalMinutes = hours * 60 + minutes;

      if (weekday === 'Sat' || weekday === 'Sun') {
        return { open: false, reason: 'Market is closed on weekends (Sat/Sun).' };
      }

      const ex = (exchange || 'NSE').toUpperCase();
      if (ex === 'MCX') {
        const mcxStart = 9 * 60; // 09:00
        const mcxEnd = 23 * 60 + 30; // 23:30
        if (totalMinutes >= mcxStart && totalMinutes <= mcxEnd) {
          return { open: true };
        } else {
          return { open: false, reason: 'MCX Market hours are 9:00 AM to 11:30 PM IST.' };
        }
      } else {
        const nseStart = 9 * 60 + 15; // 09:15
        const nseEnd = 15 * 60 + 30; // 15:30
        if (totalMinutes >= nseStart && totalMinutes <= nseEnd) {
          return { open: true };
        } else {
          return { open: false, reason: 'NSE Market hours are 9:15 AM to 3:30 PM IST.' };
        }
      }
    } catch (e) {
      console.error(e);
      return { open: true }; // Safe fallback
    }
  }

  function updateMarketStatusBadge() {
    const badge = document.getElementById('market-status-badge');
    if (!badge) return;

    const nseStatus = isMarketOpen('NSE');
    if (nseStatus.open) {
      badge.textContent = 'Market: Open';
      badge.style.background = '#e6fffa';
      badge.style.color = '#38a169';
    } else {
      const mcxStatus = isMarketOpen('MCX');
      if (mcxStatus.open) {
        badge.textContent = 'MCX: Open';
        badge.style.background = '#feebc8';
        badge.style.color = '#dd6b20';
      } else {
        badge.textContent = 'Market: Closed';
        badge.style.background = '#fff5f5';
        badge.style.color = '#e53e3e';
      }
    }
  }

  // Check Stop-Loss and Target triggers for all open positions (called every tick)
  function checkSlTargetTriggers() {
    if (!activePlatformUser) return;
    const positions = JSON.parse(localStorage.getItem('positions_db') || '[]');
    const openPositions = positions.filter(p => p.userEmail === activePlatformUser.email && p.status === 'OPEN');

    openPositions.forEach(pos => {
      if (!pos.stopLoss && !pos.target) return;

      const matchingScript = addedScripts.find(s => s.token === pos.token);
      const liveQuote = (matchingScript && matchingScript.quote) ? matchingScript.quote
                      : positionQuoteCache[pos.token] || null;
      if (!liveQuote) return;

      const side = pos.side || 'BUY';
      const bid = liveQuote.depth && liveQuote.depth.buy && liveQuote.depth.buy.length > 0
        ? parseFloat(liveQuote.depth.buy[0].price) : parseFloat(liveQuote.ltp);
      const ask = liveQuote.depth && liveQuote.depth.sell && liveQuote.depth.sell.length > 0
        ? parseFloat(liveQuote.depth.sell[0].price) : parseFloat(liveQuote.ltp);

      if (side === 'BUY') {
        if (pos.stopLoss && bid <= parseFloat(pos.stopLoss)) {
          showToast(`🔴 Stop-Loss Triggered!\n${pos.symbol} BUY position closed at ₹${bid.toFixed(2)}\nSL was set at ₹${parseFloat(pos.stopLoss).toFixed(2)}`, 'error');
          closeVirtualPosition(pos.id, bid, 'SL_HIT');
          return;
        }
        if (pos.target && bid >= parseFloat(pos.target)) {
          showToast(`🟢 Target Hit!\n${pos.symbol} BUY position closed at ₹${bid.toFixed(2)}\nTarget was ₹${parseFloat(pos.target).toFixed(2)}`, 'success');
          closeVirtualPosition(pos.id, bid, 'TARGET_HIT');
        }
      } else {
        if (pos.stopLoss && ask >= parseFloat(pos.stopLoss)) {
          showToast(`🔴 Stop-Loss Triggered!\n${pos.symbol} SHORT position closed at ₹${ask.toFixed(2)}\nSL was set at ₹${parseFloat(pos.stopLoss).toFixed(2)}`, 'error');
          closeVirtualPosition(pos.id, ask, 'SL_HIT');
          return;
        }
        if (pos.target && ask <= parseFloat(pos.target)) {
          showToast(`🟢 Target Hit!\n${pos.symbol} SHORT position closed at ₹${ask.toFixed(2)}\nTarget was ₹${parseFloat(pos.target).toFixed(2)}`, 'success');
          closeVirtualPosition(pos.id, ask, 'TARGET_HIT');
        }
      }
    });
  }

  // Auto squareoff MIS positions past their exchange cutoff (runs every 30s)
  function startAutoSquareOff() {
    setInterval(() => {
      if (!activePlatformUser) return;
      const positions = JSON.parse(localStorage.getItem('positions_db') || '[]');
      const openMIS = positions.filter(p =>
        p.userEmail === activePlatformUser.email &&
        p.status === 'OPEN' &&
        (p.orderType || 'NRML') === 'MIS'
      );
      if (openMIS.length === 0) return;

      const now = new Date();
      const istOffset = 5.5 * 60 * 60 * 1000;
      const ist = new Date(now.getTime() + istOffset);
      const h = ist.getUTCHours();
      const m = ist.getUTCMinutes();
      const totalMin = h * 60 + m;
      const day = ist.getUTCDay(); // 0=Sun, 6=Sat

      if (day === 0 || day === 6) return; // No squareoff on weekends

      openMIS.forEach(pos => {
        let cutoff = null;
        const exch = (pos.exchange || '').toUpperCase();
        if (exch === 'MCX') cutoff = 23 * 60 + 15;       // 11:15 PM
        else if (exch === 'CDS') cutoff = 16 * 60 + 45;  // 4:45 PM
        else cutoff = 15 * 60 + 15;                        // 3:15 PM (NSE/NFO/BSE)

        if (totalMin >= cutoff) {
          const matchingScript = addedScripts.find(s => s.token === pos.token);
          const liveQuote = (matchingScript && matchingScript.quote) ? matchingScript.quote
                          : positionQuoteCache[pos.token] || null;
          const ltp = liveQuote ? parseFloat(liveQuote.ltp) : (pos.entryPrice || pos.buyPrice);
          const side = pos.side || 'BUY';
          let exitPrice = ltp;
          if (liveQuote) {
            if (side === 'BUY' && liveQuote.depth && liveQuote.depth.buy && liveQuote.depth.buy.length > 0)
              exitPrice = parseFloat(liveQuote.depth.buy[0].price);
            else if (side === 'SELL' && liveQuote.depth && liveQuote.depth.sell && liveQuote.depth.sell.length > 0)
              exitPrice = parseFloat(liveQuote.depth.sell[0].price);
          }
          closeVirtualPosition(pos.id, exitPrice, 'AUTO_SQUAREOFF');
        }
      });
    }, 30000); // Check every 30 seconds
  }

  // Automatic live ticker loop (every 500ms)
  function startLiveTicker() {
    setInterval(async () => {
      if (!apiConnected) return;
      updateMarketStatusBadge();
      
      const watchlistTokens = addedScripts.map(s => ({
        exchange: s.exchange,
        token: s.token
      }));

      let openPosTokens = [];
      if (activePlatformUser) {
        const positions = JSON.parse(localStorage.getItem('positions_db') || '[]');
        const openPositions = positions.filter(p => p.userEmail === activePlatformUser.email && p.status === 'OPEN');
        openPosTokens = openPositions.map(p => ({
          exchange: p.exchange,
          token: p.token
        }));
      }

      const merged = [...watchlistTokens];
      openPosTokens.forEach(p => {
        if (!merged.some(m => m.token === p.token)) {
          merged.push(p);
        }
      });

      if (merged.length === 0) return;

      try {
        const response = await fetch('/api/market-data-batch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ scripts: merged })
        });
        const result = await response.json();
        
        if (result.success && result.data) {
          result.data.forEach(qData => {
            const script = addedScripts.find(s => s.token === qData.symbolToken && s.exchange.toUpperCase() === qData.exchange.toUpperCase());
            if (script) {
              script.quote = qData;
            } else {
              positionQuoteCache[qData.symbolToken] = qData;
            }
          });

          // Check SL / Target triggers for all open positions
          checkSlTargetTriggers();
          
          renderWatchlistTable();
          fetchPositions();
          updateTopbarStats();

          if (selectedScript) {
            const updated = addedScripts.find(s => s.code === selectedScript.code);
            if (updated && updated.quote) {
              selectedScript = updated;
              renderDetailsPanel();
            }
          }
        }
      } catch (e) {
        console.error("Live ticker polling exception:", e);
      }
    }, 500);
  }

  function updateTopbarStats() {
    if (!activePlatformUser) return;
    
    const positions = JSON.parse(localStorage.getItem('positions_db') || '[]');
    const userPositions = positions.filter(p => p.userEmail === activePlatformUser.email);
    
    let livePnl = 0;
    const openPositions = userPositions.filter(p => p.status === 'OPEN');
    openPositions.forEach(pos => {
      const matchingScript = addedScripts.find(s => s.token === pos.token);
      const liveQuote = (matchingScript && matchingScript.quote) ? matchingScript.quote
                      : positionQuoteCache[pos.token] || null;
      const ltp = liveQuote ? parseFloat(liveQuote.ltp) : (pos.entryPrice || pos.buyPrice);
      const side = pos.side || 'BUY';

      if (side === 'BUY') {
        const bid = liveQuote && liveQuote.depth && liveQuote.depth.buy && liveQuote.depth.buy.length > 0
          ? parseFloat(liveQuote.depth.buy[0].price) : ltp;
        livePnl += (bid - pos.entryPrice) * pos.quantity;
      } else {
        const ask = liveQuote && liveQuote.depth && liveQuote.depth.sell && liveQuote.depth.sell.length > 0
          ? parseFloat(liveQuote.depth.sell[0].price) : ltp;
        livePnl += (pos.entryPrice - ask) * pos.quantity;
      }
    });

    const closedPositions = userPositions.filter(p => p.status === 'CLOSED');
    const bookedPnl = closedPositions.reduce((acc, p) => acc + (parseFloat(p.pnl) || 0), 0);

    const livePnlSpan = document.querySelector('.header-lower-row .stat-item:nth-child(2) .stat-val');
    const bookedPnlSpan = document.querySelector('.header-lower-row .stat-item:nth-child(3) .stat-val');
    
    if (livePnlSpan) {
      livePnlSpan.textContent = (livePnl >= 0 ? '+' : '') + livePnl.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      livePnlSpan.className = 'stat-val ' + (livePnl >= 0 ? 'green' : 'red');
    }
    
    if (bookedPnlSpan) {
      bookedPnlSpan.textContent = (bookedPnl >= 0 ? '+' : '') + bookedPnl.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      bookedPnlSpan.className = 'stat-val ' + (bookedPnl >= 0 ? 'green' : 'red');
    }
  }

  startLiveTicker();
  startAutoSquareOff();

  // Filter watchlist list on search typing
  watchlistSearchInput.addEventListener('input', renderWatchlistTable);

  // Refresh buttons mock logic
  document.getElementById('watchlist-refresh-btn').addEventListener('click', () => {
    const btn = document.getElementById('watchlist-refresh-btn');
    btn.style.transform = 'rotate(360deg)';
    btn.style.transition = 'transform 0.5s ease';
    setTimeout(() => {
      btn.style.transform = 'none';
      btn.style.transition = 'none';
      renderWatchlistTable();
    }, 500);
  });

  // Deposit & Withdrawal Modal Listeners
  const depositModal = document.getElementById('deposit-modal');
  const withdrawModal = document.getElementById('withdraw-modal');

  document.querySelector('.btn-deposit').addEventListener('click', () => {
    if (!activePlatformUser) {
      alert('Please log in first to deposit funds!');
      return;
    }
    depositModal.style.display = 'flex';
  });

  document.getElementById('close-deposit-btn').addEventListener('click', () => {
    depositModal.style.display = 'none';
    document.getElementById('deposit-amount-input').value = '';
  });

  document.getElementById('confirm-deposit-btn').addEventListener('click', () => {
    const input = document.getElementById('deposit-amount-input');
    const amount = parseFloat(input.value);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid positive amount!');
      return;
    }

    activePlatformUser.walletBalance = (activePlatformUser.walletBalance || 0) + amount;
    saveUserData();
    logTransaction('DEPOSIT', amount);

    depositModal.style.display = 'none';
    input.value = '';
    updateHeaderBalance();
    alert(`Successfully deposited ₹${amount.toLocaleString('en-IN')} to your wallet!`);
  });

  document.querySelector('.btn-withdraw').addEventListener('click', () => {
    if (!activePlatformUser) {
      alert('Please log in first to withdraw funds!');
      return;
    }
    withdrawModal.style.display = 'flex';
  });

  document.getElementById('close-withdraw-btn').addEventListener('click', () => {
    withdrawModal.style.display = 'none';
    document.getElementById('withdraw-amount-input').value = '';
  });

  document.getElementById('confirm-withdraw-btn').addEventListener('click', () => {
    const input = document.getElementById('withdraw-amount-input');
    const amount = parseFloat(input.value);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid positive amount!');
      return;
    }

    if (amount > activePlatformUser.walletBalance) {
      alert('Insufficient wallet balance!');
      return;
    }

    activePlatformUser.walletBalance -= amount;
    saveUserData();
    logTransaction('WITHDRAWAL', amount);

    withdrawModal.style.display = 'none';
    input.value = '';
    updateHeaderBalance();
    alert(`Successfully withdrew ₹${amount.toLocaleString('en-IN')} from your wallet!`);
  });

  document.querySelector('.btn-live-tv').addEventListener('click', () => {
    alert('Live TV feed will open a streaming drawer for market channels.');
  });

  document.getElementById('refresh-btn').addEventListener('click', () => {
    const refreshBtn = document.getElementById('refresh-btn');
    refreshBtn.style.transform = 'rotate(360deg)';
    refreshBtn.style.transition = 'transform 0.5s ease';
    
    setTimeout(() => {
      refreshBtn.style.transform = 'none';
      refreshBtn.style.transition = 'none';
      
      if (apiConnected) {
        fetchPositions();
        alert('Terminal data refreshed from Angel One API.');
      } else {
        alert('Terminal views refreshed (Mock mode).');
      }
    }, 500);
  });
});
