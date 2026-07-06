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

    pane.innerHTML = `
      <div style="background: white; padding: 24px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; max-width: 500px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px;">
        <h3 style="margin: 0; font-size: 16px; font-weight: 700; color: #1a202c;">Active Account Settings</h3>
        <p style="font-size: 13px; color: #718096; margin: 0;">You are currently logged in as: <strong>${activePlatformUser.name}</strong> (${activePlatformUser.email})</p>
        <button class="btn" id="btn-logout-submit" style="height: 40px; background-color: #e53e3e; color: white; border: none; border-radius: 6px; font-weight: 700; cursor: pointer;">Logout Account</button>
      </div>
    `;

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
          <td colspan="8" class="empty-state-cell">
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
          <td colspan="8" class="empty-state-cell">
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
      // Find matching quote from cached results in addedScripts or load placeholder
      const matchingScript = addedScripts.find(s => s.token === pos.token);
      const ltp = matchingScript && matchingScript.quote ? parseFloat(matchingScript.quote.ltp) : pos.buyPrice;
      
      const pl = (ltp - pos.buyPrice) * pos.quantity;
      const plClass = pl >= 0 ? 'green' : 'red';
      const plSign = pl >= 0 ? '+' : '';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="bold">${pos.symbol}</td>
        <td><span class="watchlist-pill" style="font-size: 9px; padding: 2px 6px;">${pos.exchange}</span></td>
        <td style="color: #38a169; font-weight: 600;">BUY</td>
        <td>${pos.quantity}</td>
        <td>${pos.buyPrice.toFixed(2)}</td>
        <td>${ltp.toFixed(2)}</td>
        <td class="${plClass}" style="font-weight: 600;">${plSign}${pl.toFixed(2)}</td>
        <td>
          <button class="btn btn-withdraw btn-squareoff-pos" data-id="${pos.id}" style="height: 24px; padding: 2px 8px; font-size: 11px; background-color: #fff5f5; border-color: #e53e3e; color: #e53e3e;">
            Squareoff
          </button>
        </td>
      `;

      // Squareoff / Close position event listener
      tr.querySelector('.btn-squareoff-pos').addEventListener('click', () => {
        closeVirtualPosition(pos.id, ltp);
      });

      tbody.appendChild(tr);
    });
  }

  function closeVirtualPosition(posId, currentLtp) {
    if (!activePlatformUser) return;
    const positions = JSON.parse(localStorage.getItem('positions_db') || '[]');
    const idx = positions.findIndex(p => p.id === posId && p.status === 'OPEN');
    
    if (idx === -1) return;
    
    const pos = positions[idx];
    const closeValue = currentLtp * pos.quantity;
    const pnl = (currentLtp - pos.buyPrice) * pos.quantity;

    // Close position
    pos.status = 'CLOSED';
    pos.closePrice = currentLtp;
    pos.pnl = pnl;
    
    // Save positions_db
    localStorage.setItem('positions_db', JSON.stringify(positions));

    // Credit user's wallet with the closing value (returning their initial margin + profit/loss)
    activePlatformUser.walletBalance = (activePlatformUser.walletBalance || 0) + closeValue;
    saveUserData();
    
    // Log transaction
    logTransaction('TRADE_CLOSE', pnl);

    alert(`Position squared off successfully!\nClosed ${pos.symbol} at ₹${currentLtp.toFixed(2)}.\nPayout of ₹${closeValue.toFixed(2)} credited to your wallet.`);
    
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
      tr.innerHTML = `
        <td>${pos.createdAt || '--'}</td>
        <td class="bold">${pos.symbol}</td>
        <td><span class="watchlist-pill" style="font-size: 9px; padding: 2px 6px;">${pos.exchange}</span></td>
        <td style="color: #38a169; font-weight: 600;">BUY</td>
        <td>${pos.quantity}</td>
        <td>${pos.buyPrice.toFixed(2)}</td>
        <td>${pos.closePrice ? pos.closePrice.toFixed(2) : '--'}</td>
        <td class="${plClass}" style="font-weight: 600;">${plSign}${pl.toFixed(2)}</td>
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
          token: item.token
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
            BUY <span style="display:block; font-size:11px; font-weight:500; margin-top:2px;">${q.ltp}</span>
          </button>
        </div>
      </div>
    `;

    // Action clicks
    detailsPanel.querySelector('.btn-buy-action').addEventListener('click', () => {
      if (!activePlatformUser) {
        alert("Please log in to place trades!");
        return;
      }

      const ltp = parseFloat(q.ltp);
      if (isNaN(ltp) || ltp <= 0) {
        alert("Wait for live quotes to load before buying!");
        return;
      }

      const defaultQty = parseInt(selectedScript.lotsize) || 50;
      const qtyStr = prompt(`Enter quantity to BUY (Default Lot Size: ${defaultQty}):`, defaultQty);
      if (qtyStr === null) return;

      const quantity = parseInt(qtyStr);
      if (isNaN(quantity) || quantity <= 0) {
        alert("Please enter a valid positive quantity!");
        return;
      }

      const value = ltp * quantity;
      const commission = value * 0.10; // 10% Platform fee
      const totalCost = value + commission;

      if (totalCost > activePlatformUser.walletBalance) {
        alert(`Insufficient wallet balance!\nTotal cost (Trade Value + 10% Platform Fee) is ₹${totalCost.toLocaleString('en-IN', { maximumFractionDigits: 2 })}, but you only have ₹${activePlatformUser.walletBalance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}.`);
        return;
      }

      const confirmMsg = `Confirm BUY Order:\n\n` +
                         `Symbol: ${selectedScript.code}\n` +
                         `Quantity: ${quantity}\n` +
                         `Price: ₹${ltp.toFixed(2)}\n` +
                         `Trade Value: ₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}\n` +
                         `10% Platform Fee: ₹${commission.toLocaleString('en-IN', { maximumFractionDigits: 2 })}\n` +
                         `Total Cost: ₹${totalCost.toLocaleString('en-IN', { maximumFractionDigits: 2 })}\n\n` +
                         `Proceed?`;
      if (!confirm(confirmMsg)) return;

      // Deduct wallet balance
      activePlatformUser.walletBalance -= totalCost;
      saveUserData();

      // Add virtual position
      const positions = JSON.parse(localStorage.getItem('positions_db') || '[]');
      const newPos = {
        id: 'POS' + Date.now(),
        userEmail: activePlatformUser.email,
        symbol: selectedScript.code,
        name: selectedScript.name,
        exchange: selectedScript.exchange,
        token: selectedScript.token,
        buyPrice: ltp,
        quantity: quantity,
        tradeValue: value,
        commissionPaid: commission,
        status: 'OPEN',
        pnl: 0,
        createdAt: new Date().toLocaleString()
      };
      positions.push(newPos);
      localStorage.setItem('positions_db', JSON.stringify(positions));

      // Log transaction
      logTransaction('TRADE_BUY', -totalCost);

      alert(`BUY order placed successfully!\nDeducted ₹${totalCost.toLocaleString('en-IN', { maximumFractionDigits: 2 })} (including 10% fee) from your wallet.`);
      
      updateHeaderBalance();
      fetchPositions();
      renderDetailsPanel();
    });

    detailsPanel.querySelector('.btn-sell-action').addEventListener('click', () => {
      if (!activePlatformUser) {
        alert("Please log in to place trades!");
        return;
      }

      const positions = JSON.parse(localStorage.getItem('positions_db') || '[]');
      const openPos = positions.find(p => p.userEmail === activePlatformUser.email && p.symbol === selectedScript.code && p.status === 'OPEN');

      if (!openPos) {
        alert(`You do not have any open positions to sell for ${selectedScript.code}.\nTo place a trade, please BUY first, then close it.`);
        return;
      }

      const ltp = parseFloat(q.ltp);
      if (isNaN(ltp) || ltp <= 0) {
        alert("Wait for live quotes to load before selling!");
        return;
      }

      // Square off the open position
      closeVirtualPosition(openPos.id, ltp);
    });
  }

  // Automatic live ticker loop (every 500ms)
  function startLiveTicker() {
    setInterval(async () => {
      if (!apiConnected) return;
      
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
            }
          });
          
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
      const ltp = matchingScript && matchingScript.quote ? parseFloat(matchingScript.quote.ltp) : pos.buyPrice;
      livePnl += (ltp - pos.buyPrice) * pos.quantity;
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
