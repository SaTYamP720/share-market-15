// =============================================
// STEP 1: Connect browser to server via WebSocket
// =============================================
const socket = io();

// STEP 3: Live quote maps - token key "EXCHANGETYPE:TOKEN" => latest price / full tick
const wsLivePrices = {};
const wsLiveQuotes = {};

function normaliseWsQuote(value) {
  if (value && typeof value === 'object') return value;
  return value !== undefined && value !== null ? { ltp: value } : null;
}

function mergeWsQuote(key, quote) {
  const next = normaliseWsQuote(quote);
  if (!next) return null;
  const prev = wsLiveQuotes[key] || {};
  
  // Merge only non-null and non-undefined values
  const merged = { ...prev };
  Object.keys(next).forEach(k => {
    if (next[k] !== null && next[k] !== undefined) {
      merged[k] = next[k];
    }
  });

  wsLiveQuotes[key] = merged;
  if (wsLiveQuotes[key].ltp !== undefined && wsLiveQuotes[key].ltp !== null) {
    wsLivePrices[key] = wsLiveQuotes[key].ltp;
  }
  return wsLiveQuotes[key];
}


function formatPricePlain(value) {
  if (value === undefined || value === null || value === '--') return '--';
  const text = String(value).trim().replace(/,/g, '');
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) return '--';
  return parsed.toFixed(2);
}

function createQuoteFromWs(liveQuote) {
  const quote = {
    ltp: liveQuote?.ltp ?? '--',
    netChange: liveQuote?.netChange ?? '--',
    percentChange: liveQuote?.pctChange ?? '--',
    open: liveQuote?.open ?? '--',
    high: liveQuote?.high ?? '--',
    low: liveQuote?.low ?? '--',
    close: liveQuote?.close ?? '--',
    depth: { buy: [{ price: '--' }], sell: [{ price: '--' }] }
  };
  patchQuoteFromWs(quote, liveQuote);
  return quote;
}

function patchQuoteFromWs(scriptQuote, liveQuote) {
  if (!scriptQuote || !liveQuote) return false;
  if (liveQuote.ltp !== undefined && liveQuote.ltp !== null) scriptQuote.ltp = liveQuote.ltp;
  if (liveQuote.open !== undefined && liveQuote.open !== null) scriptQuote.open = liveQuote.open;
  if (liveQuote.high !== undefined && liveQuote.high !== null) scriptQuote.high = liveQuote.high;
  if (liveQuote.low !== undefined && liveQuote.low !== null) scriptQuote.low = liveQuote.low;
  if (liveQuote.close !== undefined && liveQuote.close !== null) scriptQuote.close = liveQuote.close;
  if (liveQuote.netChange !== undefined && liveQuote.netChange !== null) scriptQuote.netChange = liveQuote.netChange;
  if (liveQuote.pctChange !== undefined && liveQuote.pctChange !== null) scriptQuote.percentChange = liveQuote.pctChange;
  scriptQuote.depth = scriptQuote.depth || { buy: [], sell: [] };
  scriptQuote.depth.buy = scriptQuote.depth.buy || [];
  scriptQuote.depth.sell = scriptQuote.depth.sell || [];
  if (liveQuote.bid !== undefined && liveQuote.bid !== null) scriptQuote.depth.buy[0] = { price: liveQuote.bid, quantity: 0, orders: 0 };
  if (liveQuote.ask !== undefined && liveQuote.ask !== null) scriptQuote.depth.sell[0] = { price: liveQuote.ask, quantity: 0, orders: 0 };
  return true;
}

socket.on('connect', () => {
  console.log('[WS] Connected to server. Socket ID:', socket.id);
  // Re-subscribe to all watchlist tokens on (re)connect
  wsSubscribeAll();
});

socket.on('disconnect', () => {
  console.log('[WS] Disconnected from server.');
});

// Incoming: full snapshot when first connecting
socket.on('price_snapshot', (snapshot) => {
  Object.entries(snapshot || {}).forEach(([key, quote]) => mergeWsQuote(key, quote));
  console.log(`[WS] Received price snapshot: ${Object.keys(snapshot).length} tokens`);
});

// Incoming: live price tick - immediately update ALL price cells (LTP, Bid, Ask, Change)
socket.on('price_tick', ({ key, ltp, bid, ask, open, high, low, close, netChange, pctChange }) => {
  // Store the full live tick locally so bid/ask do not stay stuck at the first REST quote.
  const liveQuote = mergeWsQuote(key, { ltp, bid, ask, open, high, low, close, netChange, pctChange });

  const fmt = (v) => v != null ? formatPricePlain(v) : null;

  // Update script.quote first, then update visible cells from the accepted quote.
  // This avoids flicker between raw WS values and normalized/rendered values.
  if (window._addedScriptsRef) {
    window._addedScriptsRef.forEach(script => {
      const exchMap = { 'nse_cm': 1, 'nse': 1, 'nse_fo': 2, 'nfo': 2, 'bse_cm': 3, 'bse': 3, 'bse_fo': 4, 'bfo': 4, 'mcx_fo': 5, 'mcx': 5, 'ncx_fo': 7, 'ncdex': 7, 'cde_fo': 13, 'cds': 13 };
      const exchType = exchMap[(script.exchange || '').toLowerCase()] || 1;
      if (`${exchType}:${script.token}` === key) {
        if (!script.quote) script.quote = createQuoteFromWs(liveQuote);
        else patchQuoteFromWs(script.quote, liveQuote);

        const q = script.quote;
        document.querySelectorAll(`[data-ltp-key="${key}"]`).forEach(el => {
          if (fmt(q.ltp)) el.textContent = fmt(q.ltp);
        });
        const acceptedBid = q.depth && q.depth.buy && q.depth.buy[0] ? q.depth.buy[0].price : null;
        const acceptedAsk = q.depth && q.depth.sell && q.depth.sell[0] ? q.depth.sell[0].price : null;
        if (acceptedBid != null && acceptedBid !== '--') {
          document.querySelectorAll(`[data-bid-key="${key}"]`).forEach(el => { el.textContent = fmt(acceptedBid); });
        }
        if (acceptedAsk != null && acceptedAsk !== '--') {
          document.querySelectorAll(`[data-ask-key="${key}"]`).forEach(el => { el.textContent = fmt(acceptedAsk); });
        }
      }
    });
  }

  if (typeof window._refreshSelectedDetailsFromTick === 'function') {
    window._refreshSelectedDetailsFromTick(key, liveQuote);
  }
});


// Subscribe ALL current watchlist tokens to the server
function wsSubscribeAll() {
  if (!window._addedScriptsRef || window._addedScriptsRef.length === 0) return;
  const tokens = window._addedScriptsRef.map(s => ({ exchange: s.exchange, token: s.token }));
  socket.emit('ws_subscribe', { tokens });
}

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

  function stripRuntimeQuote(script) {
    if (!script || typeof script !== 'object') return script;
    const { quote, ...savedScript } = script;
    return savedScript;
  }

  function loadSavedWatchlist(email) {
    try {
      const cleaned = JSON.parse(localStorage.getItem('watchlist_' + email) || '[]').map(stripRuntimeQuote);
      localStorage.setItem('watchlist_' + email, JSON.stringify(cleaned));
      return cleaned;
    } catch (err) {
      console.warn('[Watchlist] Failed to load saved watchlist', err);
      return [];
    }
  }
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

  // Custom Confirmation Dialog helper
  function showConfirm(message, okText = 'Confirm', okColor = '#e53e3e') {
    return new Promise((resolve) => {
      const modal = document.getElementById('confirm-modal');
      const msgEl = document.getElementById('confirm-modal-message');
      const okBtn = document.getElementById('confirm-ok-btn');
      const cancelBtn = document.getElementById('confirm-cancel-btn');

      msgEl.innerHTML = message.replace(/\n/g, '<br>');
      okBtn.textContent = okText;
      okBtn.style.background = okColor;

      modal.style.display = 'flex';

      okBtn.onclick = () => {
        modal.style.display = 'none';
        resolve(true);
      };

      cancelBtn.onclick = () => {
        modal.style.display = 'none';
        resolve(false);
      };
    });
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
      
      showToast("Logged out successfully from your platform account.", "info");
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
      showToast("All fields are required for sign up!", "warning");
      return;
    }

    const users = JSON.parse(localStorage.getItem('users_db') || '[]');
    if (users.some(u => u.email === email)) {
      showToast("This email is already registered!", "error");
      return;
    }

    // Create user with ₹0 starting balance
    const newUser = { name, email, password, walletBalance: 0 };
    users.push(newUser);
    localStorage.setItem('users_db', JSON.stringify(users));

    showToast("Registration successful! You can now log in.", "success");
    document.getElementById('register-name').value = '';
    document.getElementById('register-email').value = '';
    document.getElementById('register-password').value = '';
  }

  function handleLogin() {
    const email = document.getElementById('login-email').value.trim().toLowerCase();
    const password = document.getElementById('login-password').value.trim();

    if (!email || !password) {
      showToast("Please enter both email and password!", "warning");
      return;
    }

    const users = JSON.parse(localStorage.getItem('users_db') || '[]');
    const user = users.find(u => u.email === email && u.password === password);

    if (!user) {
      showToast("Invalid email or password!", "error");
      return;
    }

    activePlatformUser = user;
    localStorage.setItem('activePlatformUser', JSON.stringify(user));

    addedScripts = loadSavedWatchlist(activePlatformUser.email);

    showToast(`Welcome back, ${user.name}!`, "success");
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

  function getWsKey(exchange, token) {
    const clean = (exchange || '').toLowerCase();
    let exchType = 1;
    if (clean === 'nse_cm' || clean === 'nse') exchType = 1;
    else if (clean === 'nse_fo' || clean === 'nfo') exchType = 2;
    else if (clean === 'bse_cm' || clean === 'bse') exchType = 3;
    else if (clean === 'bse_fo' || clean === 'bfo') exchType = 4;
    else if (clean === 'mcx_fo' || clean === 'mcx') exchType = 5;
    else if (clean === 'ncx_fo' || clean === 'ncdex') exchType = 7;
    else if (clean === 'cde_fo' || clean === 'cds') exchType = 13;
    return `${exchType}:${token}`;
  }

  function getLiveQuoteFromWS(exchange, token) {
    return wsLiveQuotes[getWsKey(exchange, token)] || null;
  }

  function syncScriptQuoteFromLive(script) {
    if (!script) return null;

    const liveQuote = getLiveQuoteFromWS(script.exchange, script.token);
    const watchlistScript = addedScripts.find(s => getWsKey(s.exchange, s.token) === getWsKey(script.exchange, script.token));
    const targetScript = watchlistScript || script;

    if (liveQuote) {
      if (!targetScript.quote) targetScript.quote = createQuoteFromWs(liveQuote);
      else patchQuoteFromWs(targetScript.quote, liveQuote);
    }

    if (watchlistScript && script !== watchlistScript) {
      script.quote = watchlistScript.quote || script.quote || null;
    }

    return targetScript.quote || script.quote || null;
  }

  function getLatestQuoteForSelectedScript() {
    if (!selectedScript) return null;
    const watchlistScript = addedScripts.find(s => getWsKey(s.exchange, s.token) === getWsKey(selectedScript.exchange, selectedScript.token));
    if (watchlistScript) selectedScript = watchlistScript;
    return syncScriptQuoteFromLive(selectedScript);
  }

  function getQuoteSidePrices(quote) {
    const ltp = parseFloat(quote && quote.ltp);
    const bidPrice = quote && quote.depth && quote.depth.buy && quote.depth.buy.length > 0
      ? parseFloat(quote.depth.buy[0].price)
      : ltp;
    const askPrice = quote && quote.depth && quote.depth.sell && quote.depth.sell.length > 0
      ? parseFloat(quote.depth.sell[0].price)
      : ltp;
    return { ltp, bidPrice, askPrice };
  }

  function getQuoteTradePrice(quote) {
    const { ltp, bidPrice, askPrice } = getQuoteSidePrices(quote);
    if (Number.isFinite(ltp) && ltp > 0) return ltp;
    if (Number.isFinite(askPrice) && askPrice > 0) return askPrice;
    if (Number.isFinite(bidPrice) && bidPrice > 0) return bidPrice;
    return NaN;
  }

  function updateDetailsPanelLive(q) {
    if (!selectedScript) return;
    const container = document.querySelector('.instrument-details-active');
    if (!container) return;

    const isPositive = parseFloat(q.netChange) >= 0;
    const color = isPositive ? '#38a169' : '#e53e3e';
    const sign = isPositive ? '+' : '';

    const fmtVal = (v) => v === undefined || v === null || v === '--' ? '--' : formatPricePlain(v);

    // 1. Update LTP
    const ltpEl = container.querySelector('div[style*="font-size: 26px"]');
    if (ltpEl) {
      ltpEl.textContent = fmtVal(q.ltp);
      ltpEl.style.color = color;
    }

    // 2. Update Net Change / Pct Change
    if (ltpEl) {
      const changeEl = ltpEl.nextElementSibling;
      if (changeEl) {
        changeEl.textContent = `${sign}${fmtVal(q.netChange)} (${sign}${fmtVal(q.percentChange)}%)`;
        changeEl.style.color = color;
      }
    }

    // 3. Update Bid / Ask values
    const rawBid = q.depth && q.depth.buy && q.depth.buy[0] ? parseFloat(q.depth.buy[0].price) : 0;
    const rawAsk = q.depth && q.depth.sell && q.depth.sell[0] ? parseFloat(q.depth.sell[0].price) : 0;
    const bidVal = rawBid > 0 ? rawBid : (parseFloat(q.ltp) || 0);
    const askVal = rawAsk > 0 ? rawAsk : (parseFloat(q.ltp) || 0);

    const bidSpan = container.querySelector('.details-bid-val');
    if (bidSpan) bidSpan.textContent = `₹${bidVal.toFixed(2)}`;

    const askSpan = container.querySelector('.details-ask-val');
    if (askSpan) askSpan.textContent = `₹${askVal.toFixed(2)}`;

    // 4. Update BUY / SELL button labels
    const sellBtnSpan = container.querySelector('.btn-sell-action span');
    if (sellBtnSpan) sellBtnSpan.textContent = `₹${bidVal.toFixed(2)}`;

    const buyBtnSpan = container.querySelector('.btn-buy-action span');
    if (buyBtnSpan) buyBtnSpan.textContent = `@ ₹${askVal.toFixed(2)}`;

    // 5. Update OHLC Grid
    const ohlcDivs = container.querySelectorAll('div[style*="display: grid"] > div > div:last-child');
    if (ohlcDivs.length === 4) {
      ohlcDivs[0].textContent = fmtVal(q.open);
      ohlcDivs[1].textContent = fmtVal(q.high);
      ohlcDivs[2].textContent = fmtVal(q.low);
      ohlcDivs[3].textContent = fmtVal(q.close);
    }
  }

  let selectedDetailsFrame = null;
  window._refreshSelectedDetailsFromTick = (key, liveQuote) => {
    if (!selectedScript) return;
    if (getWsKey(selectedScript.exchange, selectedScript.token) !== key) return;

    if (liveQuote) {
      if (!selectedScript.quote) selectedScript.quote = createQuoteFromWs(liveQuote);
      else patchQuoteFromWs(selectedScript.quote, liveQuote);
    }

    if (selectedDetailsFrame) return;
    selectedDetailsFrame = requestAnimationFrame(() => {
      selectedDetailsFrame = null;
      const latestQuote = getLatestQuoteForSelectedScript();
      if (!latestQuote) return;
      updateDetailsPanelLive(latestQuote);
      updateOrderModalLiveQuote(latestQuote);
    });
  };

  // Helper: get LTP for a script from wsLivePrices (accessible from any function in scope)
  // Supports both short exchange names (NSE, MCX) and exch_seg names (nse_cm, mcx_fo)
  function getLtpFromWS(exchange, token) {
    const key = getWsKey(exchange, token);
    const quote = wsLiveQuotes[key];
    const ltp = quote && quote.ltp !== undefined ? quote.ltp : wsLivePrices[key];
    return ltp !== undefined && ltp !== null ? parseFloat(ltp) : null;
  }



  function saveWatchlist() {
    if (activePlatformUser) {
      localStorage.setItem('watchlist_' + activePlatformUser.email, JSON.stringify(addedScripts.map(stripRuntimeQuote)));
    }
    // Keep global ref so wsSubscribeAll can access it outside DOMContentLoaded scope
    window._addedScriptsRef = addedScripts;
  }

  function logTransaction(type, amount, pnl = null) {
    const txs = JSON.parse(localStorage.getItem('transactions_db') || '[]');
    txs.push({
      id: 'TX' + Date.now(),
      userEmail: activePlatformUser.email,
      type: type,
      amount: amount,
      pnl: pnl,
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
      addedScripts = loadSavedWatchlist(activePlatformUser.email);
      window._addedScriptsRef = addedScripts;
      // STEP 3: Subscribe all watchlist tokens on startup
      wsSubscribeAll();
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
    // Always re-render watchlist after session check so prices & stocks show correctly
    renderWatchlistTable();
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
          <div style="display:flex;gap:4px;">
            <button class="btn btn-withdraw btn-squareoff-pos" data-id="${pos.id}" style="height:24px;padding:2px 8px;font-size:11px;background-color:#fff5f5;border-color:#e53e3e;color:#e53e3e;">
              Squareoff
            </button>
            <button class="btn btn-modify-sl-tgt" data-id="${pos.id}" style="height:24px;padding:2px 8px;font-size:11px;background-color:#ebf8ff;border:1px solid #3182ce;color:#3182ce;border-radius:4px;cursor:pointer;font-weight:600;display:inline-flex;align-items:center;justify-content:center;transition:all 0.2s;">
              SL/Tgt
            </button>
          </div>
        </td>
      `;

      tr.querySelector('.btn-squareoff-pos').addEventListener('click', () => {
        closeVirtualPosition(pos.id, exitPrice, 'MANUAL');
      });

      tr.querySelector('.btn-modify-sl-tgt').addEventListener('click', async () => {
        const result = await showModifySlTgtDialog(pos);
        if (result) {
          const allPositions = JSON.parse(localStorage.getItem('positions_db') || '[]');
          const idx = allPositions.findIndex(p => p.id === pos.id);
          if (idx !== -1) {
            allPositions[idx].stopLoss = result.stopLoss;
            allPositions[idx].target = result.target;
            localStorage.setItem('positions_db', JSON.stringify(allPositions));
            showToast(`SL & Target modified for ${pos.symbol}!`, 'success');
            fetchPositions();
          }
        }
      });
      
      tbody.appendChild(tr);
    });
  }

  function showModifySlTgtDialog(pos) {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.style.position = 'fixed';
      modal.style.top = '0';
      modal.style.left = '0';
      modal.style.width = '100%';
      modal.style.height = '100%';
      modal.style.background = 'rgba(0,0,0,0.4)';
      modal.style.zIndex = '3000';
      modal.style.display = 'flex';
      modal.style.alignItems = 'center';
      modal.style.justifyContent = 'center';

      modal.innerHTML = `
        <div style="background: white; border-radius: 12px; width: 340px; padding: 24px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.15); display: flex; flex-direction: column; gap: 16px; border: 1px solid #e2e8f0; animation: modalFadeIn 0.2s ease;">
          <h3 style="margin: 0; font-size: 15px; font-weight: 700; color: #1a202c;">Modify SL & Target</h3>
          <p style="margin: 0; font-size: 12px; color: #718096; font-weight: 600; text-transform: uppercase;">${pos.symbol} (${pos.side || 'BUY'} • Qty: ${pos.quantity})</p>
          <div style="font-size: 11px; color: #e53e3e; font-weight: 600; background: #fff5f5; border: 1px solid #fed7d7; padding: 6px 10px; border-radius: 6px; line-height: 1.3;">
            ⚠️ Note: You can set either Stop-Loss OR Target, not both together.
          </div>
          
          <div style="display: flex; flex-direction: column; gap: 12px;">
             <div style="display: flex; flex-direction: column; gap: 6px;">
               <label style="font-size: 11px; font-weight: 700; color: #4a5568;">STOP-LOSS PRICE (Clear to disable)</label>
               <input type="number" step="any" id="modify-sl-input" value="${pos.stopLoss ? parseFloat(pos.stopLoss).toFixed(2) : ''}" placeholder="e.g. ₹245.00" style="padding: 10px; border: 1px solid #cbd5e0; border-radius: 6px; outline: none; background: #f8fafc; color: #1a202c; width: 100%;">
             </div>
             <div style="display: flex; flex-direction: column; gap: 6px;">
               <label style="font-size: 11px; font-weight: 700; color: #4a5568;">TARGET PRICE (Clear to disable)</label>
               <input type="number" step="any" id="modify-tgt-input" value="${pos.target ? parseFloat(pos.target).toFixed(2) : ''}" placeholder="e.g. ₹265.00" style="padding: 10px; border: 1px solid #cbd5e0; border-radius: 6px; outline: none; background: #f8fafc; color: #1a202c; width: 100%;">
             </div>
          </div>

          <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 8px;">
            <button id="modify-cancel-btn" style="background: #edf2f7; color: #4a5568; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 700; font-size: 12px;">Cancel</button>
            <button id="modify-save-btn" style="background: #0b57d0; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 700; font-size: 12px;">Save Changes</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      const cancelBtn = modal.querySelector('#modify-cancel-btn');
      const saveBtn = modal.querySelector('#modify-save-btn');
      const slInput = modal.querySelector('#modify-sl-input');
      const tgtInput = modal.querySelector('#modify-tgt-input');

      // Initial lock if one is already set
      if (slInput.value) {
        tgtInput.disabled = true;
        tgtInput.style.opacity = '0.5';
        tgtInput.style.cursor = 'not-allowed';
      }
      if (tgtInput.value) {
        slInput.disabled = true;
        slInput.style.opacity = '0.5';
        slInput.style.cursor = 'not-allowed';
      }

      slInput.oninput = () => {
        if (slInput.value) {
          tgtInput.value = '';
          tgtInput.disabled = true;
          tgtInput.style.opacity = '0.5';
          tgtInput.style.cursor = 'not-allowed';
        } else {
          tgtInput.disabled = false;
          tgtInput.style.opacity = '1';
          tgtInput.style.cursor = 'auto';
        }
      };

      tgtInput.oninput = () => {
        if (tgtInput.value) {
          slInput.value = '';
          slInput.disabled = true;
          slInput.style.opacity = '0.5';
          slInput.style.cursor = 'not-allowed';
        } else {
          slInput.disabled = false;
          slInput.style.opacity = '1';
          slInput.style.cursor = 'auto';
        }
      };

      cancelBtn.onclick = () => {
        modal.remove();
        resolve(null);
      };

      saveBtn.onclick = () => {
        const slValue = slInput.value ? parseFloat(slInput.value) : null;
        const tgtValue = tgtInput.value ? parseFloat(tgtInput.value) : null;

        if (slValue !== null && tgtValue !== null) {
          showToast('Please set either Stop-Loss or Target, not both together.', 'warning');
          return;
        }

        modal.remove();
        resolve({ stopLoss: slValue, target: tgtValue });
      };
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
    
    logTransaction('TRADE_CLOSE', payout, pnl);

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
    const closedPositions = positions.filter(p => p.userEmail === activePlatformUser.email && p.status === 'CLOSED').reverse();

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
      const entrySide = pos.side || 'BUY';
      const entryPrice = pos.entryPrice || pos.buyPrice || 0;
      const entryVal = entryPrice * pos.quantity;
      const entrySideColor = entrySide === 'BUY' ? '#38a169' : '#e53e3e';

      // Entry transaction row
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${pos.createdAt || '--'}</td>
        <td class="bold">${pos.symbol}</td>
        <td><span class="watchlist-pill" style="font-size: 9px; padding: 2px 6px;">${pos.exchange}</span></td>
        <td style="color: ${entrySideColor}; font-weight: 600;">${entrySide}</td>
        <td>${pos.quantity}</td>
        <td>₹${entryPrice.toFixed(2)}</td>
        <td>₹${entryVal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
      `;
      tbody.appendChild(tr);

      // Exit transaction row (if closed)
      if (pos.status === 'CLOSED') {
        const exitSide = entrySide === 'BUY' ? 'SELL' : 'BUY';
        const exitSideColor = exitSide === 'BUY' ? '#38a169' : '#e53e3e';
        const exitPrice = pos.closePrice || 0;
        const exitVal = exitPrice * pos.quantity;
        
        const trClose = document.createElement('tr');
        trClose.innerHTML = `
          <td>${pos.createdAt || '--'}</td>
          <td class="bold">${pos.symbol}</td>
          <td><span class="watchlist-pill" style="font-size: 9px; padding: 2px 6px;">${pos.exchange}</span></td>
          <td style="color: ${exitSideColor}; font-weight: 600;">${exitSide}</td>
          <td>${pos.quantity}</td>
          <td>₹${exitPrice.toFixed(2)}</td>
          <td>₹${exitVal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
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

    let runningBalance = 0;
    const rowsData = [];
    
    userTxs.forEach(t => {
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
      } else if (t.type === 'TRADE_BUY' || t.type === 'TRADE_SELL_SHORT') {
        particulars = t.type === 'TRADE_BUY' ? 'Virtual Trade BUY margin debit' : 'Virtual Trade SELL SHORT margin debit';
        debit = `₹${Math.abs(t.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
        runningBalance += t.amount;
      } else if (t.type === 'TRADE_CLOSE') {
        const pnlNum = parseFloat(t.pnl);
        const pnlText = !isNaN(pnlNum) ? ` (P&L: ${pnlNum >= 0 ? '+' : ''}₹${pnlNum.toFixed(2)})` : '';
        particulars = `Virtual Trade Close payout${pnlText}`;
        if (t.amount >= 0) {
          credit = `₹${t.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
        } else {
          debit = `₹${Math.abs(t.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
        }
        runningBalance += t.amount;
      }

      rowsData.push({
        createdAt: t.createdAt || '--',
        particulars,
        debit,
        credit,
        balance: runningBalance
      });
    });

    // Reverse list so that latest transaction appears at the top
    rowsData.reverse();

    tbody.innerHTML = '';
    rowsData.forEach(row => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${row.createdAt}</td>
        <td>${row.particulars}</td>
        <td style="color: #e53e3e;">${row.debit}</td>
        <td style="color: #38a169;">${row.credit}</td>
        <td class="bold" style="color: #0b57d0;">₹${row.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
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
    if (!activePlatformUser) {
      showToast("Please log in to your platform account first to add scripts!", "warning");
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
          const removedScript = addedScripts.find(s => s.code === code);
          addedScripts = addedScripts.filter(s => s.code !== code);
          saveWatchlist();
          // STEP 3: Unsubscribe this token from Angel One WebSocket feed
          if (removedScript) {
            socket.emit('ws_unsubscribe', { tokens: [{ exchange: removedScript.exchange, token: removedScript.token }] });
          }
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
            // STEP 3: Subscribe this token to Angel One WebSocket feed
            socket.emit('ws_subscribe', { tokens: [{ exchange: scriptData.exchange, token: scriptData.token }] });
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

  const quoteFetchState = new Map();
  const QUOTE_FETCH_COOLDOWN_MS = 15000;

  // Render the Watchlist Table in the dashboard
  function renderWatchlistTable() {
    // NOTE: We show the watchlist even when API is not connected,
    // so users can see their added stocks. Prices just show '--' until connected.

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
      const liveQuote = getLiveQuoteFromWS(script.exchange, script.token);
      if (liveQuote) {
        if (!script.quote) script.quote = createQuoteFromWs(liveQuote);
        else patchQuoteFromWs(script.quote, liveQuote);
      }

      // Trigger REST only until we have a quote; WebSocket becomes primary once ticks arrive.
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

      // Display the accepted quote only; raw WS ticks are normalized before reaching script.quote.
      const displayLtp = q.ltp !== '--' ? parseFloat(q.ltp) : null;
      const formattedLtp = displayLtp !== null
        ? formatPricePlain(displayLtp)
        : '--';

      // Safe depth access
      const bidPrice = q.depth && q.depth.buy && q.depth.buy[0] ? q.depth.buy[0].price : '--';
      const askPrice = q.depth && q.depth.sell && q.depth.sell[0] ? q.depth.sell[0].price : '--';
      const formattedBid = formatPricePlain(bidPrice);
      const formattedAsk = formatPricePlain(askPrice);
      const formattedHigh = formatPricePlain(q.high);
      const formattedLow = formatPricePlain(q.low);
      const formattedOpen = formatPricePlain(q.open);
      const formattedClose = formatPricePlain(q.close);

      const tr = document.createElement('tr');
      tr.style.cursor = 'pointer';
      
      // Highlight row if currently selected
      if (selectedScript && selectedScript.code === script.code) {
        tr.style.backgroundColor = '#edf2f7';
      }

      // Build the ws key for this script (same format as server: "exchType:token")
      const exchTypeMap = { 'nse_cm': 1, 'nse': 1, 'nse_fo': 2, 'nfo': 2, 'bse_cm': 3, 'bse': 3, 'bse_fo': 4, 'bfo': 4, 'mcx_fo': 5, 'mcx': 5, 'ncx_fo': 7, 'ncdex': 7, 'cde_fo': 13, 'cds': 13 };
      const wsKeyForRow = `${exchTypeMap[(script.exchange || '').toLowerCase()] || 1}:${script.token}`;

      tr.innerHTML = `
        <td class="scrip-col bold" style="padding-left: 20px;">
          <div>${script.code}</div>
          <div style="font-size: 10px; color: #a0aec0; font-weight: normal; margin-top: 2px;">${script.name}</div>
        </td>
        <td><span class="watchlist-pill" style="font-size: 9px; padding: 2px 6px;">${script.exchange}</span></td>
        <td style="color: #38a169; font-weight: 500;" data-bid-key="${wsKeyForRow}">${formattedBid}</td>
        <td style="color: #e53e3e; font-weight: 500;" data-ask-key="${wsKeyForRow}">${formattedAsk}</td>
        <td style="color: ${changeColor}; font-size: 11px; font-weight: 500;">
          <div>${changeSign}${formatPricePlain(q.netChange)}</div>
          <div style="font-size: 9px; margin-top: 2px;">${changeSign}${formatPricePlain(q.percentChange)}%</div>
        </td>
        <td>${formattedHigh}</td>
        <td>${formattedLow}</td>
        <td>${formattedOpen}</td>
        <td>${formattedClose}</td>
        <td class="bold" style="color: ${changeColor};" data-ltp-key="${wsKeyForRow}">${formattedLtp}</td>
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
        syncScriptQuoteFromLive(selectedScript);
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
    // Only skip if we have a FULL quote (one with open/high/low, not just a WS LTP stub)
    if (script.quote && script.quote.open !== undefined && script.quote.open !== '--') return;
    const key = getWsKey(script.exchange, script.token);
    const state = quoteFetchState.get(key) || {};
    const now = Date.now();
    if (state.inFlight || (state.lastAttempt && now - state.lastAttempt < QUOTE_FETCH_COOLDOWN_MS)) return;
    if (!apiConnected) {
      console.warn('[Quote] Skipping fetch for', script.code, '- apiConnected is false');
      return;
    }
    quoteFetchState.set(key, { ...state, inFlight: true, lastAttempt: now });
    try {
      const url = `/api/market-data?exchange=${script.exchange}&token=${script.token}`;
      console.log('[Quote] Fetching:', url);
      const response = await fetch(url);
      const result = await response.json();
      console.log('[Quote] Response for', script.code, ':', JSON.stringify(result).substring(0, 200));
      if (result.success && result.data) {
        const liveQuote = getLiveQuoteFromWS(script.exchange, script.token);
        if (liveQuote) {
          patchQuoteFromWs(result.data, liveQuote);
        } else {
          const wsLtp = getLtpFromWS(script.exchange, script.token);
          result.data.ltp = wsLtp !== null ? wsLtp : result.data.ltp;
        }
        script.quote = result.data;
        quoteFetchState.set(key, { inFlight: false, lastAttempt: 0 });
        console.log('[Quote] Set quote for', script.code, '| LTP:', result.data.ltp, '| Bid:', result.data.depth?.buy?.[0]?.price, '| Ask:', result.data.depth?.sell?.[0]?.price);
        renderWatchlistTable();
        if (selectedScript && selectedScript.code === script.code) {
          selectedScript = script;
          renderDetailsPanel();
        }
      } else {
        console.error('[Quote] Failed for', script.code, ':', result.error || result.message);
        quoteFetchState.set(key, { inFlight: false, lastAttempt: Date.now() });
      }
    } catch (e) {
      console.error('[Quote] Exception for ' + script.code + ':', e.message);
      quoteFetchState.set(key, { inFlight: false, lastAttempt: Date.now() });
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

    const latestQuote = getLatestQuoteForSelectedScript();
    const q = latestQuote || selectedScript.quote || {
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

    const rawBid = q.depth && q.depth.buy && q.depth.buy[0] ? parseFloat(q.depth.buy[0].price) : 0;
    const rawAsk = q.depth && q.depth.sell && q.depth.sell[0] ? parseFloat(q.depth.sell[0].price) : 0;
    const bidVal = rawBid > 0 ? rawBid : (parseFloat(q.ltp) || 0);
    const askVal = rawAsk > 0 ? rawAsk : (parseFloat(q.ltp) || 0);
    const actionPrice = getQuoteTradePrice(q);
    const displayActionPrice = Number.isFinite(actionPrice) && actionPrice > 0 ? actionPrice : (parseFloat(q.ltp) || 0);

    const exch = (selectedScript.exchange || '').toUpperCase();
    const now = new Date();
    const day = now.getDay();
    const hr = now.getHours();
    const min = now.getMinutes();
    const timeVal = hr * 60 + min;
    
    let isClosed = false;
    if (day === 0 || day === 6) {
      isClosed = true;
    } else {
      if (exch === 'MCX') {
        isClosed = (timeVal < 540 || timeVal >= 1410);
      } else {
        isClosed = (timeVal < 555 || timeVal >= 930);
      }
    }

    const marketStatusBadge = isClosed 
      ? `<span style="font-size: 10px; padding: 2px 6px; font-weight: 700; border-radius: 4px; background-color: #fff5f5; color: #e53e3e; border: 1px solid #fed7d7; margin-left: 6px; display: inline-flex; align-items: center;">CLOSED</span>`
      : `<span style="font-size: 10px; padding: 2px 6px; font-weight: 700; border-radius: 4px; background-color: #f0fff4; color: #38a169; border: 1px solid #c6f6d5; margin-left: 6px; display: inline-flex; align-items: center;">LIVE</span>`;

    // Calculate mock coordinates for a smooth Bezier sparkline path
    const open = parseFloat(q.open) || 0;
    const high = parseFloat(q.high) || 0;
    const low = parseFloat(q.low) || 0;
    const ltp = parseFloat(q.ltp) || 0;

    let y0, y1, y2, y3, y4;
    if (high > low) {
      const scale = (val) => 80 - ((val - low) / (high - low)) * 60; // scale between 20 and 80 to fit grid
      y0 = scale(open);
      y1 = scale(low);
      y2 = scale(ltp * 0.998); // mid variation
      y3 = scale(high);
      y4 = scale(ltp);
    } else {
      y0 = 50; y1 = 65; y2 = 40; y3 = 55; y4 = 45;
    }

    detailsPanel.innerHTML = `
      <div class="instrument-details-active" style="width: 100%; display: flex; flex-direction: column; gap: 20px;">
        <!-- Header -->
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div>
            <h3 style="font-size: 18px; font-weight: 700; color: #1a202c; margin: 0;">${selectedScript.code}</h3>
            <span style="font-size: 11px; color: #718096; text-transform: uppercase;">${selectedScript.name}</span>
          </div>
          <div style="display: flex; align-items: center;">
            <span class="watchlist-pill" style="font-size: 11px; padding: 3px 8px; font-weight: 600;">${selectedScript.exchange}</span>
            ${marketStatusBadge}
          </div>
        </div>

        <!-- Price Display -->
        <div style="display: flex; justify-content: space-between; align-items: baseline;">
          <div>
            <div style="font-size: 26px; font-weight: 700; ${colorStyle}">${formatPricePlain(q.ltp)}</div>
            <div style="font-size: 12px; font-weight: 600; ${colorStyle} margin-top: 2px;">
              ${sign}${formatPricePlain(q.netChange)} (${sign}${formatPricePlain(q.percentChange)}%)
            </div>
          </div>
          <div style="text-align: right; font-size: 12px;">
            <div style="color: #718096; margin-bottom: 2px;">BID <span class="details-bid-val" style="color: #38a169; font-weight: 600; margin-left: 4px;">₹${bidVal.toFixed(2)}</span></div>
            <div style="color: #718096;">ASK <span class="details-ask-val" style="color: #e53e3e; font-weight: 600; margin-left: 4px;">₹${askVal.toFixed(2)}</span></div>
          </div>
        </div>

        <!-- OHLC Grid -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; border-top: 1px solid #edf2f7; border-bottom: 1px solid #edf2f7; padding: 12px 0;">
          <div style="text-align: center;">
            <div style="font-size: 10px; color: #a0aec0; font-weight: 600; text-transform: uppercase;">Open</div>
            <div style="font-size: 12px; font-weight: 600; color: #2d3748; margin-top: 4px;">${formatPricePlain(q.open)}</div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 10px; color: #a0aec0; font-weight: 600; text-transform: uppercase;">High</div>
            <div style="font-size: 12px; font-weight: 600; color: #2d3748; margin-top: 4px;">${formatPricePlain(q.high)}</div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 10px; color: #a0aec0; font-weight: 600; text-transform: uppercase;">Low</div>
            <div style="font-size: 12px; font-weight: 600; color: #2d3748; margin-top: 4px;">${formatPricePlain(q.low)}</div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 10px; color: #a0aec0; font-weight: 600; text-transform: uppercase;">Close</div>
            <div style="font-size: 12px; font-weight: 600; color: #2d3748; margin-top: 4px;">${formatPricePlain(q.close)}</div>
          </div>
        </div>

        <!-- Mini Sparkline Graph -->
        <div style="height: 100px; display: flex; align-items: center; justify-content: center; background-color: #f8fafc; border: 1px solid #edf2f7; border-radius: 8px; position: relative; padding: 12px; overflow: hidden;">
          <svg style="width: 100%; height: 100%; overflow: visible;">
            <defs>
              <linearGradient id="chart-grad-${isPositive ? 'up' : 'down'}" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="${isPositive ? '#38a169' : '#e53e3e'}" stop-opacity="0.18"></stop>
                <stop offset="100%" stop-color="${isPositive ? '#38a169' : '#e53e3e'}" stop-opacity="0.00"></stop>
              </linearGradient>
            </defs>
            <!-- Grid Lines -->
            <line x1="0" y1="15" x2="250" y2="15" stroke="#edf2f7" stroke-width="1" stroke-dasharray="3,3"></line>
            <line x1="0" y1="40" x2="250" y2="40" stroke="#edf2f7" stroke-width="1" stroke-dasharray="3,3"></line>
            <line x1="0" y1="65" x2="250" y2="65" stroke="#edf2f7" stroke-width="1" stroke-dasharray="3,3"></line>
            
            <!-- Area Fill Under Curve -->
            <path d="M 0,${y0} C 30,${y0} 30,${y1} 60,${y1} C 90,${y1} 90,${y2} 120,${y2} C 150,${y2} 150,${y3} 180,${y3} C 215,${y3} 215,${y4} 250,${y4} L 250,90 L 0,90 Z" fill="url(#chart-grad-${isPositive ? 'up' : 'down'})" stroke="none"></path>
            
            <!-- Smooth Bezier Line -->
            <path d="M 0,${y0} C 30,${y0} 30,${y1} 60,${y1} C 90,${y1} 90,${y2} 120,${y2} C 150,${y2} 150,${y3} 180,${y3} C 215,${y3} 215,${y4} 250,${y4}" fill="none" stroke="${isPositive ? '#38a169' : '#e53e3e'}" stroke-width="3" stroke-linecap="round"></path>
            
            <!-- Pulsing Price Dot -->
            <circle cx="250" cy="${y4}" r="4" fill="${isPositive ? '#38a169' : '#e53e3e'}"></circle>
            <circle cx="250" cy="${y4}" r="10" fill="none" stroke="${isPositive ? '#38a169' : '#e53e3e'}" stroke-width="2" opacity="0.6">
              <animate attributeName="r" values="4;13" dur="2s" repeatCount="indefinite"></animate>
              <animate attributeName="opacity" values="0.8;0" dur="2s" repeatCount="indefinite"></animate>
            </circle>
          </svg>
        </div>

        <!-- Buy / Sell Action buttons -->
        <div style="display: flex; gap: 12px; margin-top: 10px;">
          <button class="btn btn-sell-action" style="flex: 1; height: 42px; background-color: #fff5f5; border: 1px solid #e53e3e; border-radius: 8px; color: #e53e3e; font-weight: 700; cursor: pointer; transition: all 0.2s;">
            SELL <span style="display:block; font-size:11px; font-weight:500; margin-top:2px;">₹${bidVal.toFixed(2)}</span>
          </button>
          <button class="btn btn-buy-action" style="flex: 1; height: 42px; background-color: #e6fffa; border: 1px solid #38a169; border-radius: 8px; color: #38a169; font-weight: 700; cursor: pointer; transition: all 0.2s;">
            BUY <span style="display:block; font-size:11px; font-weight:500; margin-top:2px;">@ ₹${askVal.toFixed(2)}</span>
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
        const marginEst = document.getElementById('order-modal-margin-est');
        const walletBal = document.getElementById('order-modal-wallet-bal');
        const confirmBtn = document.getElementById('confirm-order-btn');
        const closeBtn = document.getElementById('close-order-modal-btn');

        const defaultQty = parseInt(selectedScript.lotsize) || 1;
        
        // Reset and populate fields
        symbolEl.textContent = selectedScript.code;
        exchBadge.textContent = selectedScript.exchange;
        priceEl.textContent = `₹${price.toFixed(2)}`;
        priceLabelEl.textContent = 'LIVE PRICE';
        
        actionBadge.textContent = side === 'BUY' ? 'BUY' : 'SELL';
        actionBadge.style.background = side === 'BUY' ? '#e6fffa' : '#fff5f5';
        actionBadge.style.color = side === 'BUY' ? '#38a169' : '#e53e3e';
        
        qtyInput.value = defaultQty;
        lotsizeHelp.textContent = `Min lot size: ${defaultQty}`;
        
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
          const currentPrice = window.currentOrderModalPrice || price;
          const fullValue = currentPrice * qty;
          const requiredMargin = currentOrderType === 'MIS' ? fullValue * 0.20 : fullValue;
          marginEst.textContent = `₹${requiredMargin.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
        
        qtyInput.oninput = updateCalculations;

        // Initialize global reference
        window.currentOrderModalPrice = price;
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
          window.currentOrderModalPrice = null;
        }

        closeBtn.onclick = () => {
          cleanup();
          resolve(null);
        };

        confirmBtn.onclick = () => {
          const qty = parseInt(qtyInput.value);
          const stopLoss = null; // No SL when placing order from watchlist
          const target = null;   // No Target when placing order from watchlist
          const finalPrice = window.currentOrderModalPrice || price;

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
          resolve({ qty, orderType: currentOrderType, stopLoss, target, price: finalPrice });
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

      const latestClickQuote = getLatestQuoteForSelectedScript() || q;
      const rawAsk = latestClickQuote.depth && latestClickQuote.depth.sell && latestClickQuote.depth.sell[0] ? parseFloat(latestClickQuote.depth.sell[0].price) : 0;
      const buyPrice = rawAsk > 0 ? rawAsk : getQuoteTradePrice(latestClickQuote);

      if (isNaN(buyPrice) || buyPrice <= 0) { showToast('Wait for live quotes to load before buying!', 'warning'); return; }

      // Check if there's an open SHORT position → close it (Buy to cover)
      const positions = JSON.parse(localStorage.getItem('positions_db') || '[]');
      const openShort = positions.find(p => p.userEmail === activePlatformUser.email && p.symbol === selectedScript.code && p.status === 'OPEN' && (p.side || 'BUY') === 'SELL');
      if (openShort) {
        const proceed = await showConfirm(`You have an open SHORT on ${selectedScript.code}.\nBUY to cover (close short) at live price ₹${buyPrice.toFixed(2)}?`, 'Cover Short', '#38a169');
        if (proceed) {
          closeVirtualPosition(openShort.id, buyPrice, 'MANUAL');
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
      const params = await showOrderDialog('BUY', buyPrice);
      if (!params) return;
      const { qty, orderType, stopLoss, target } = params;
      const executionPrice = Number.isFinite(parseFloat(params.price)) && parseFloat(params.price) > 0 ? parseFloat(params.price) : buyPrice;

      // Calculate margin (MIS = 20% of full value, NRML = 100%)
      const fullValue = executionPrice * qty;
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
        entryPrice: executionPrice,
        buyPrice: executionPrice, // backward compat
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
      showToast(`BUY order placed!\n${selectedScript.code} LONG ${qty} units @ ₹${executionPrice.toFixed(2)}`, 'success');
      
      updateHeaderBalance();
      fetchPositions();
      renderDetailsPanel();
    });

    // Action clicks — SELL button
    detailsPanel.querySelector('.btn-sell-action').addEventListener('click', async () => {
      if (!activePlatformUser) { showToast('Please log in to place trades!', 'warning'); return; }

      const latestClickQuote = getLatestQuoteForSelectedScript() || q;
      const rawBid = latestClickQuote.depth && latestClickQuote.depth.buy && latestClickQuote.depth.buy[0] ? parseFloat(latestClickQuote.depth.buy[0].price) : 0;
      const sellPrice = rawBid > 0 ? rawBid : getQuoteTradePrice(latestClickQuote);

      if (isNaN(sellPrice) || sellPrice <= 0) { showToast('Wait for live quotes to load before selling!', 'warning'); return; }

      // Check if there's an open LONG position → close it (Squareoff)
      const positions = JSON.parse(localStorage.getItem('positions_db') || '[]');
      const openLong = positions.find(p => p.userEmail === activePlatformUser.email && p.symbol === selectedScript.code && p.status === 'OPEN' && (p.side || 'BUY') === 'BUY');
      if (openLong) {
        const proceed = await showConfirm(`You have an open LONG on ${selectedScript.code}.\nSELL to squareoff at live price ₹${sellPrice.toFixed(2)}?`, 'Squareoff Long', '#e53e3e');
        if (proceed) {
          closeVirtualPosition(openLong.id, sellPrice, 'MANUAL');
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
      const params = await showOrderDialog('SELL', sellPrice);
      if (!params) return;
      const { qty, orderType, stopLoss, target } = params;
      const executionPrice = Number.isFinite(parseFloat(params.price)) && parseFloat(params.price) > 0 ? parseFloat(params.price) : sellPrice;

      const fullValue = executionPrice * qty;
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
        entryPrice: executionPrice,
        buyPrice: executionPrice, // backward compat
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
      showToast(`SELL SHORT order placed!\n${selectedScript.code} SHORT ${qty} units @ ₹${executionPrice.toFixed(2)}`, 'success');
      
      updateHeaderBalance();
      fetchPositions();
      renderDetailsPanel();
    });
  }

  function isMarketOpen(exchange) {
    try {
      // Use formatToParts() for reliable field access regardless of locale/browser
      const now = new Date();
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        hour12: false,
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit'
      }).formatToParts(now);

      const get = (type) => (parts.find(p => p.type === type) || {}).value || '';
      const weekday = get('weekday');
      const hours = parseInt(get('hour'), 10);
      const minutes = parseInt(get('minute'), 10);
      const totalMinutes = hours * 60 + minutes;

      if (weekday === 'Sat' || weekday === 'Sun') {
        return { open: false, reason: 'Market is closed on weekends (Sat/Sun).' };
      }

      const ex = (exchange || 'NSE').toUpperCase();
      if (ex === 'MCX') {
        const mcxStart = 9 * 60;       // 09:00 AM
        const mcxEnd   = 23 * 60 + 30; // 11:30 PM
        return (totalMinutes >= mcxStart && totalMinutes <= mcxEnd)
          ? { open: true }
          : { open: false, reason: 'MCX Market hours are 9:00 AM to 11:30 PM IST.' };
      } else {
        const nseStart = 9 * 60 + 15;  // 09:15 AM
        const nseEnd   = 15 * 60 + 30; // 03:30 PM
        return (totalMinutes >= nseStart && totalMinutes <= nseEnd)
          ? { open: true }
          : { open: false, reason: 'NSE Market hours are 9:15 AM to 3:30 PM IST.' };
      }
    } catch (e) {
      console.error('[isMarketOpen] Error:', e.message);
      return { open: true }; // Safe fallback — assume open
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
          return;
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
          return;
        }
      }
    });
  }

  // Update order modal price and margin dynamically if it is open
  function updateOrderModalLiveQuote(quote) {
    const modal = document.getElementById('order-modal');
    if (!modal || modal.style.display !== 'flex') return;

    const priceEl = document.getElementById('order-modal-price');
    const qtyInput = document.getElementById('order-qty-input');
    const marginEst = document.getElementById('order-modal-margin-est');
    
    // Check if the open modal is for BUY or SELL
    const actionBadge = document.getElementById('order-modal-action-badge');
    const side = actionBadge ? actionBadge.textContent.trim().toUpperCase() : 'BUY';

    const { ltp, bidPrice, askPrice } = getQuoteSidePrices(quote);
    let price;
    if (side === 'BUY') {
      price = Number.isFinite(askPrice) && askPrice > 0 ? askPrice : ltp;
    } else {
      price = Number.isFinite(bidPrice) && bidPrice > 0 ? bidPrice : ltp;
    }

    if (isNaN(price) || price <= 0) return;

    priceEl.textContent = `₹${price.toFixed(2)}`;

    window.currentOrderModalPrice = price;

    // Recalculate margin
    const qty = parseInt(qtyInput.value) || 0;
    const fullValue = price * qty;
    const tabMis = document.getElementById('order-tab-mis');
    const isMIS = tabMis.classList.contains('active');
    const requiredMargin = isMIS ? fullValue * 0.20 : fullValue;
    marginEst.textContent = `₹${requiredMargin.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

  // =============================================
  // STEP 4: WebSocket-driven live ticker (replaces HTTP polling)
  // Prices come from wsLivePrices (filled by price_tick events).
  // HTTP fallback only for open position tokens NOT in watchlist.
  // =============================================
  function startLiveTicker() {

    // UI refresh loop — runs every 500ms but reads from LOCAL wsLivePrices cache, no HTTP
    setInterval(() => {
      if (!apiConnected) return;
      updateMarketStatusBadge();

      // Update every watchlist script using the latest full WS tick.
      addedScripts.forEach(script => {
        const liveQuote = getLiveQuoteFromWS(script.exchange, script.token);
        if (liveQuote) {
          if (!script.quote) script.quote = createQuoteFromWs(liveQuote);
          else patchQuoteFromWs(script.quote, liveQuote);
        }
        // If no full quote yet, fetchQuoteForScript will be called by renderWatchlistTable
      });

      // Update positionQuoteCache for open positions from WS prices
      if (activePlatformUser) {
        const positions = JSON.parse(localStorage.getItem('positions_db') || '[]');
        positions.filter(p => p.userEmail === activePlatformUser.email && p.status === 'OPEN')
          .forEach(pos => {
            const liveQuote = getLiveQuoteFromWS(pos.exchange, pos.token);
            if (liveQuote) {
              if (!positionQuoteCache[pos.token]) positionQuoteCache[pos.token] = {};
              patchQuoteFromWs(positionQuoteCache[pos.token], liveQuote);
            }
          });
      }

      // Trigger UI re-renders with latest data
      checkSlTargetTriggers();
      renderWatchlistTable();
      fetchPositions();
      updateTopbarStats();

      if (selectedScript) {
        const latestQuote = getLatestQuoteForSelectedScript();
        if (latestQuote) {
          renderDetailsPanel();
          updateOrderModalLiveQuote(latestQuote);
        }
      }
    }, 500);

    // HTTP fallback — only for open position tokens NOT already in watchlist
    // Runs every 2 seconds (much less frequent than before)
    setInterval(async () => {
      if (!apiConnected || !activePlatformUser) return;
      const positions = JSON.parse(localStorage.getItem('positions_db') || '[]');
      const openPositions = positions.filter(p => p.userEmail === activePlatformUser.email && p.status === 'OPEN');

      // Only fetch tokens that are NOT already covered by WebSocket subscription
      const needsHTTP = openPositions.filter(pos => {
        const ltp = getLtpFromWS(pos.exchange, pos.token);
        return ltp === null; // Not in WS cache yet
      });

      if (needsHTTP.length === 0) return;

      // Also subscribe these position tokens to WS so next time they come via WS
      const missingTokens = needsHTTP.map(p => ({ exchange: p.exchange, token: p.token }));
      socket.emit('ws_subscribe', { tokens: missingTokens });

      try {
        const response = await fetch('/api/market-data-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scripts: needsHTTP.map(p => ({ exchange: p.exchange, token: p.token })) })
        });
        const result = await response.json();
        if (result.success && result.data) {
          result.data.forEach(qData => {
            positionQuoteCache[qData.symbolToken] = qData;
          });
        }
      } catch (e) {
        console.error('[Ticker] HTTP fallback error:', e);
      }
    }, 2000);
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
      showToast('Please log in first to deposit funds!', 'warning');
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
      showToast('Please enter a valid positive amount!', 'warning');
      return;
    }

    activePlatformUser.walletBalance = (activePlatformUser.walletBalance || 0) + amount;
    saveUserData();
    logTransaction('DEPOSIT', amount);

    depositModal.style.display = 'none';
    input.value = '';
    updateHeaderBalance();
    showToast(`Successfully deposited ₹${amount.toLocaleString('en-IN')} to your wallet!`, 'success');
  });

  document.querySelector('.btn-withdraw').addEventListener('click', () => {
    if (!activePlatformUser) {
      showToast('Please log in first to withdraw funds!', 'warning');
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
      showToast('Please enter a valid positive amount!', 'warning');
      return;
    }

    if (amount > activePlatformUser.walletBalance) {
      showToast('Insufficient wallet balance!', 'error');
      return;
    }

    activePlatformUser.walletBalance -= amount;
    saveUserData();
    logTransaction('WITHDRAWAL', amount);

    withdrawModal.style.display = 'none';
    input.value = '';
    updateHeaderBalance();
    showToast(`Successfully withdrew ₹${amount.toLocaleString('en-IN')} from your wallet!`, 'success');
  });

  document.querySelector('.btn-live-tv').addEventListener('click', () => {
    showToast('Live TV feed will open a streaming drawer for market channels.', 'info');
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
        showToast('Terminal data refreshed from Angel One API.', 'success');
      } else {
        showToast('Terminal views refreshed (Mock mode).', 'info');
      }
    }, 500);
  });
});
