const express = require('express');
const path = require('path');
const { SmartAPI } = require('smartapi-javascript');
const { generateSync } = require('otplib');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Global state to store active session
let activeSession = {
  clientCode: null,
  smartConnectInstance: null,
  profile: null
};

// Load credentials config.json or environment variables
let config = null;
try {
  config = require('./config.json');
  console.log(`[Backend] Credentials config loaded from config.json. Client code: ${config.client_code}`);
} catch (e) {
  if (process.env.API_KEY && process.env.CLIENT_CODE && process.env.PASSWORD && process.env.TOTP_SECRET) {
    config = {
      api_key: process.env.API_KEY,
      client_code: process.env.CLIENT_CODE,
      password: process.env.PASSWORD,
      totp_secret: process.env.TOTP_SECRET
    };
    console.log(`[Backend] Credentials loaded from Environment Variables. Client code: ${config.client_code}`);
  } else {
    console.log('[Backend] Credentials not found in config.json or Environment Variables.');
  }
}

// Function to perform automatic session login on start
async function attemptAutoLogin() {
  if (!config || !config.api_key || !config.client_code || !config.password || !config.totp_secret) {
    console.log('[Backend] config.json is incomplete. Waiting for dynamic credentials via UI settings.');
    return;
  }
  
  if (config.api_key.includes("YOUR_API_KEY") || config.password.includes("YOUR_PASSWORD")) {
    console.log('[Backend] config.json contains placeholder values. Edit config.json with your actual keys.');
    return;
  }

  // Local testing bypass check
  if (config.api_key === 'TEST' || config.api_key === 'MOCK') {
    console.log(`[Backend] Auto-logging in via Test/Mock Mode.`);
    activeSession.clientCode = config.client_code;
    activeSession.profile = {
      name: "Local Test User",
      email: "localtest@sharemarket18.com",
      clientcode: config.client_code
    };
    activeSession.smartConnectInstance = {
      getProfile: () => Promise.resolve({ success: true, data: activeSession.profile }),
      getPosition: () => Promise.resolve({
        success: true,
        data: [
          { tradingsymbol: "SBIN-EQ", producttype: "DELIVERY", transactiontype: "BUY", netqty: 10, avgprice: 645.20, ltp: 651.80, pnl: 66.00 },
          { tradingsymbol: "TATAMOTORS-EQ", producttype: "INTRADAY", transactiontype: "BUY", netqty: 50, avgprice: 920.00, ltp: 928.50, pnl: 425.00 }
        ]
      }),
      getOrderBook: () => Promise.resolve({
        success: true,
        data: [
          { orderupdatetime: "23:55:00", tradingsymbol: "RELIANCE-EQ", producttype: "DELIVERY", transactiontype: "BUY", quantity: 5, price: 2450.00, status: "COMPLETE" }
        ]
      }),
      holding: () => Promise.resolve({ success: true, data: [] }),
      placeOrder: () => Promise.resolve({ success: true, data: { orderid: "MOCKORDER999" } })
    };
    return;
  }

  console.log(`[Backend] Attempting automatic login for Client: ${config.client_code}...`);
  try {
    const totp = generateSync({ secret: config.totp_secret });
    const smartConnect = new SmartAPI({ api_key: config.api_key });
    const sessionData = await smartConnect.generateSession(config.client_code, config.password, totp);

    if (sessionData.status) {
      console.log(`[Backend] Auto-login successful for Client: ${config.client_code}`);
      activeSession.clientCode = config.client_code;
      activeSession.smartConnectInstance = smartConnect;
      const profileInfo = await smartConnect.getProfile();
      activeSession.profile = profileInfo.data;
    } else {
      console.error(`[Backend] Auto-login failed: ${sessionData.message}`);
    }
  } catch (error) {
    console.error("[Backend] Auto-login exception:", error.message);
  }
}

// Run auto-login 1.5 seconds after server start
setTimeout(attemptAutoLogin, 1500);

// ==============================================================================
// secure backend API Proxy Routes wrapping Angel One Node.js SDK
// ==============================================================================

// 1. Login & Establish Session
app.post('/api/login', async (req, res) => {
  const { apiKey, clientCode, password, totpSecret } = req.body;

  if (!apiKey || !clientCode || !password || !totpSecret) {
    return res.status(400).json({ success: false, error: "Missing required fields" });
  }

  // Local Testing Bypass Mode
  if (apiKey === 'TEST' || apiKey === 'MOCK') {
    console.log(`[Backend] Initializing TEST/MOCK connection bypass.`);
    activeSession.clientCode = clientCode || 'GUEST123';
    activeSession.profile = {
      name: "Local Test User",
      email: "localtest@sharemarket18.com",
      clientcode: activeSession.clientCode
    };
    activeSession.smartConnectInstance = {
      getProfile: () => Promise.resolve({ success: true, data: activeSession.profile }),
      getPosition: () => Promise.resolve({
        success: true,
        data: [
          { tradingsymbol: "SBIN-EQ", producttype: "DELIVERY", transactiontype: "BUY", netqty: 10, avgprice: 645.20, ltp: 651.80, pnl: 66.00 },
          { tradingsymbol: "TATAMOTORS-EQ", producttype: "INTRADAY", transactiontype: "BUY", netqty: 50, avgprice: 920.00, ltp: 928.50, pnl: 425.00 }
        ]
      }),
      getOrderBook: () => Promise.resolve({
        success: true,
        data: [
          { orderupdatetime: "23:55:00", tradingsymbol: "RELIANCE-EQ", producttype: "DELIVERY", transactiontype: "BUY", quantity: 5, price: 2450.00, status: "COMPLETE" }
        ]
      }),
      holding: () => Promise.resolve({ success: true, data: [] }),
      placeOrder: () => Promise.resolve({ success: true, data: { orderid: "MOCKORDER999" } })
    };

    return res.json({
      success: true,
      message: "Successfully logged in via Local Test Mode!",
      data: {
        clientCode: activeSession.clientCode,
        userName: activeSession.profile.name,
        email: activeSession.profile.email
      }
    });
  }

  try {
    // Generate TOTP using otplib
    const totp = generateSync({ secret: totpSecret });
    console.log(`[Backend] Generated TOTP for login: ${totp}`);

    // Create instance
    const smartConnect = new SmartAPI({
      api_key: apiKey
    });

    // Authenticate with Angel One
    const sessionData = await smartConnect.generateSession(clientCode, password, totp);

    if (sessionData.status) {
      console.log(`[Backend] Login successful for Client: ${clientCode}`);
      
      // Store in memory
      activeSession.clientCode = clientCode;
      activeSession.smartConnectInstance = smartConnect;
      
      // Fetch profile info to verify and store
      const profileInfo = await smartConnect.getProfile();
      activeSession.profile = profileInfo.data;

      res.json({
        success: true,
        message: "Successfully authenticated with Angel One!",
        data: {
          clientCode: clientCode,
          userName: profileInfo.data.name,
          email: profileInfo.data.email
        }
      });
    } else {
      console.error(`[Backend] Session generation failed: ${sessionData.message}`);
      res.status(401).json({ success: false, error: sessionData.message });
    }
  } catch (error) {
    console.error("[Backend] Authentication Exception:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Helper middleware to check if logged in
const requireAuth = (req, res, next) => {
  if (!activeSession.smartConnectInstance) {
    return res.status(401).json({ success: false, error: "Authentication required. Please connect your API credentials first." });
  }
  next();
};

// 2. Get Profile Info
app.get('/api/profile', requireAuth, async (req, res) => {
  try {
    const profile = await activeSession.smartConnectInstance.getProfile();
    res.json({ success: true, data: profile.data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Get Holdings
app.get('/api/holdings', requireAuth, async (req, res) => {
  try {
    const holdings = await activeSession.smartConnectInstance.holding();
    res.json({ success: true, data: holdings.data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. Get Positions
app.get('/api/positions', requireAuth, async (req, res) => {
  try {
    const positions = await activeSession.smartConnectInstance.getPosition();
    res.json({ success: true, data: positions.data || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4b. Get Quote / Market Data for a specific token
app.get('/api/market-data', requireAuth, async (req, res) => {
  const exchange = (req.query.exchange || 'NSE').toUpperCase();
  const token = req.query.token;

  if (!token) {
    return res.status(400).json({ success: false, error: "Missing token parameter" });
  }

  // Local test mode bypass
  if (activeSession.clientCode === 'GUEST' || !activeSession.smartConnectInstance.generateSession) {
    const seed = parseInt(token) || 5000;
    const ltp = (seed % 900) + 100 + (Math.random() * 5);
    const prevClose = ltp - (Math.random() * 6 - 3);
    const change = ltp - prevClose;
    const pctChange = (change / prevClose) * 100;
    
    return res.json({
      success: true,
      data: {
        exchange: exchange,
        symbolToken: token,
        ltp: ltp.toFixed(2),
        open: (ltp * 0.99).toFixed(2),
        high: (ltp * 1.02).toFixed(2),
        low: (ltp * 0.98).toFixed(2),
        close: prevClose.toFixed(2),
        depth: {
          buy: [{ price: (ltp - 0.5).toFixed(2), quantity: 150 }],
          sell: [{ price: (ltp + 0.5).toFixed(2), quantity: 200 }]
        },
        netChange: change.toFixed(2),
        percentChange: pctChange.toFixed(2)
      }
    });
  }

  try {
    const exchangeTokens = {};
    exchangeTokens[exchange] = [token];

    // Request market quotes from Angel One
    const response = await activeSession.smartConnectInstance.marketData({
      mode: "FULL",
      exchangeTokens: exchangeTokens
    });
    
    if (response.status && response.data && response.data.fetched && response.data.fetched.length > 0) {
      const info = response.data.fetched[0];
      
      const ltp = parseFloat(info.ltp || 0);
      const close = parseFloat(info.close || info.prevClose || 0);
      const change = ltp - close;
      const pctChange = close > 0 ? (change / close) * 100 : 0;

      res.json({
        success: true,
        data: {
          exchange: exchange,
          symbolToken: token,
          ltp: ltp.toFixed(2),
          open: parseFloat(info.open || 0).toFixed(2),
          high: parseFloat(info.high || 0).toFixed(2),
          low: parseFloat(info.low || 0).toFixed(2),
          close: close.toFixed(2),
          depth: info.depth || {
            buy: [{ price: (ltp - 0.2).toFixed(2), quantity: 100 }],
            sell: [{ price: (ltp + 0.2).toFixed(2), quantity: 100 }]
          },
          netChange: change.toFixed(2),
          percentChange: pctChange.toFixed(2)
        }
      });
    } else {
      res.json({ success: false, error: response.message || "Failed to retrieve market data" });
    }
  } catch (error) {
    console.error("[Backend] getMarketData exception:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});


// 4c. Get Batch Quotes / Market Data for a list of tokens
app.post('/api/market-data-batch', requireAuth, async (req, res) => {
  const { scripts } = req.body;

  if (!scripts || !Array.isArray(scripts) || scripts.length === 0) {
    return res.json({ success: true, data: [] });
  }

  try {
    const exchangeTokens = {};
    scripts.forEach(s => {
      const ex = s.exchange.toUpperCase();
      if (!exchangeTokens[ex]) exchangeTokens[ex] = [];
      exchangeTokens[ex].push(s.token);
    });

    const response = await activeSession.smartConnectInstance.marketData({
      mode: "FULL",
      exchangeTokens: exchangeTokens
    });

    if (response.status && response.data && response.data.fetched) {
      const results = scripts.map(s => {
        const info = response.data.fetched.find(item => item.symbolToken === s.token && item.exchange === s.exchange) || {};
        
        const ltp = parseFloat(info.ltp || 0);
        const close = parseFloat(info.close || 0);
        const change = ltp - close;
        const pctChange = close > 0 ? (change / close) * 100 : 0;

        return {
          exchange: s.exchange,
          symbolToken: s.token,
          ltp: ltp.toFixed(2),
          open: parseFloat(info.open || 0).toFixed(2),
          high: parseFloat(info.high || 0).toFixed(2),
          low: parseFloat(info.low || 0).toFixed(2),
          close: close.toFixed(2),
          depth: info.depth || {
            buy: [{ price: (ltp - 0.2).toFixed(2), quantity: 100 }],
            sell: [{ price: (ltp + 0.2).toFixed(2), quantity: 100 }]
          },
          netChange: change.toFixed(2),
          percentChange: pctChange.toFixed(2)
        };
      });
      res.json({ success: true, data: results });
    } else {
      res.json({ success: false, error: response.message || "Failed to retrieve batch market data" });
    }
  } catch (error) {
    console.error("[Backend] batch marketData exception:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 5. Get Order Book
app.get('/api/orders', requireAuth, async (req, res) => {
  try {
    const orders = await activeSession.smartConnectInstance.getOrderBook();
    res.json({ success: true, data: orders.data || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 6. Place New Order
app.post('/api/place-order', requireAuth, async (req, res) => {
  const orderParams = req.body;
  try {
    const response = await activeSession.smartConnectInstance.placeOrder(orderParams);
    res.json({ success: true, data: response });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 7. Get Session Status
app.get('/api/session-status', (req, res) => {
  if (activeSession.smartConnectInstance) {
    res.json({
      loggedIn: true,
      clientCode: activeSession.clientCode,
      userName: activeSession.profile ? activeSession.profile.name : "Guest"
    });
  } else {
    res.json({ loggedIn: false });
  }
});

// 8. Logout / Clear Session
app.post('/api/logout', (req, res) => {
  activeSession.clientCode = null;
  activeSession.smartConnectInstance = null;
  activeSession.profile = null;
  res.json({ success: true, message: "Logged out from terminal" });
});

// 9. Search all listed instruments from Angel One Scrip Master
let scripMaster = [];
const fs = require('fs');
const https = require('https');

function downloadScripMaster() {
  const cachePath = path.join(__dirname, 'scrip_master.json');
  
  if (fs.existsSync(cachePath)) {
    console.log('[Backend] Loading Scrip Master from local cache file...');
    try {
      scripMaster = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      console.log(`[Backend] Loaded ${scripMaster.length} instruments from local cache.`);
      return;
    } catch (e) {
      console.log('[Backend] Error parsing cached Scrip Master. Redownloading...');
    }
  }

  console.log('[Backend] Downloading Scrip Master from Angel One (this may take a few seconds)...');
  const fileUrl = 'https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json';
  
  https.get(fileUrl, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      try {
        scripMaster = JSON.parse(data);
        fs.writeFileSync(cachePath, data, 'utf8');
        console.log(`[Backend] Successfully downloaded and cached ${scripMaster.length} instruments.`);
      } catch (err) {
        console.error('[Backend] Error parsing downloaded Scrip Master:', err.message);
      }
    });
  }).on('error', (err) => {
    console.error('[Backend] Failed to download Scrip Master:', err.message);
  });
}

// Trigger download 1 second after startup
setTimeout(downloadScripMaster, 1000);

// Helper to filter items and keep only the nearest active contract (expiryDate >= today)
function getNearestExpiryOnly(items) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const parsedItems = items.map(item => {
    let expiryDate = null;
    if (item.expiry) {
      const clean = item.expiry.trim().toUpperCase();
      if (clean.length >= 9) {
        const day = parseInt(clean.substring(0, 2));
        const monthStr = clean.substring(2, 5);
        const year = parseInt(clean.substring(5, 9));
        const months = {
          JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
          JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11
        };
        const month = months[monthStr];
        if (month !== undefined && !isNaN(day) && !isNaN(year)) {
          expiryDate = new Date(year, month, day);
        }
      }
    }
    return { item, expiryDate };
  });

  // Group by base name (name field from Scrip Master)
  const groups = {};
  parsedItems.forEach(entry => {
    const name = entry.item.name || entry.item.symbol;
    if (!groups[name]) groups[name] = [];
    groups[name].push(entry);
  });

  const filtered = [];
  Object.keys(groups).forEach(name => {
    const list = groups[name];
    // Filter to keep only those with expiryDate >= today
    const valid = list.filter(entry => entry.expiryDate && entry.expiryDate >= today);
    
    if (valid.length > 0) {
      // Sort ascending by expiryDate to find the nearest
      valid.sort((a, b) => a.expiryDate - b.expiryDate);
      filtered.push(valid[0].item);
    }
  });

  return filtered;
}

app.get('/api/search-scripts', (req, res) => {
  const query = (req.query.query || '').trim().toUpperCase();
  const activeCategory = (req.query.category || 'futures').toLowerCase();

  // Helper matching filter for categories
  const filterFn = (item, cat) => {
    if (!item.symbol || !item.name) return false;
    
    // Filter out dummy/test symbols
    const symbolUpper = item.symbol.toUpperCase();
    if (symbolUpper.includes('TEST') || symbolUpper.startsWith('111') || symbolUpper.includes('TESTING') || symbolUpper.includes('DUMMY')) {
      return false;
    }

    if (cat === 'futures') {
      return item.exch_seg === 'NFO' && (item.symbol.endsWith('FUT') || item.symbol.endsWith('-FUT'));
    } else if (cat === 'options') {
      return item.exch_seg === 'NFO' && (item.symbol.endsWith('CE') || item.symbol.endsWith('PE'));
    } else if (cat === 'mcx') {
      if (item.exch_seg !== 'MCX') return false;
      const symbolUpper = item.symbol.toUpperCase();
      const allowed = ['GOLD', 'CRUDEOIL', 'COPPER', 'LEAD', 'ZINC', 'NATURALGAS', 'SILVER'];
      const isAllowedBase = allowed.some(a => symbolUpper.startsWith(a));
      const isFutures = symbolUpper.endsWith('FUT') || symbolUpper.includes('FUT');
      const isNotMini = !symbolUpper.startsWith('GOLDM') && !symbolUpper.startsWith('SILVERM') && !symbolUpper.startsWith('COPPERM');
      return isAllowedBase && isFutures && isNotMini;
    } else if (cat === 'forex') {
      return item.exch_seg === 'CDS';
    } else if (cat === 'us-stocks' || cat === 'us-index' || cat === 'comex') {
      return false; // Not supported by Angel One API
    } else {
      // Equities (only keep tradeable main-board shares: EQ, BE, or no hyphen suffix)
      if (item.exch_seg !== 'NSE' && item.exch_seg !== 'BSE') return false;
      if (item.instrumenttype !== '') return false;
      
      const symbolUpper = item.symbol.toUpperCase();
      if (symbolUpper.endsWith('FUT') || symbolUpper.endsWith('CE') || symbolUpper.endsWith('PE')) return false;
      if (symbolUpper.includes('INAV')) return false;

      const parts = symbolUpper.split('-');
      const suffix = parts.length > 1 ? parts[parts.length - 1] : 'NONE';
      const allowedSuffixes = ['EQ', 'BE', 'NONE'];
      return allowedSuffixes.includes(suffix);
    }
  };

  // Find all matches for the query first
  let allMatches = scripMaster;
  if (query) {
    allMatches = scripMaster.filter(item => 
      (item.symbol && item.symbol.toUpperCase().includes(query)) || 
      (item.name && item.name.toUpperCase().includes(query))
    );
  }

  // Count matches in each category
  const categoriesList = ['equity', 'futures', 'options', 'mcx', 'forex'];
  const counts = {};
  categoriesList.forEach(cat => {
    if (cat === 'mcx') {
      const allMcx = allMatches.filter(item => filterFn(item, 'mcx'));
      counts[cat] = getNearestExpiryOnly(allMcx).length;
    } else if (cat === 'futures') {
      const allFuts = allMatches.filter(item => filterFn(item, 'futures'));
      counts[cat] = getNearestExpiryOnly(allFuts).length;
    } else {
      counts[cat] = allMatches.filter(item => filterFn(item, cat)).length;
    }
  });

  // Filter actual results to send for the currently active tab
  let categoryResults = allMatches.filter(item => filterFn(item, activeCategory));

  if (activeCategory === 'mcx') {
    categoryResults = getNearestExpiryOnly(categoryResults);
  } else if (activeCategory === 'futures') {
    categoryResults = getNearestExpiryOnly(categoryResults);
  }

  res.json({
    success: true,
    counts: counts,
    data: categoryResults.slice(0, 300)
  });
});

// Catch-all route to serve index.html for any frontend routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`🚀 Share Market 18 terminal is running locally!`);
  console.log(`👉 Access URL: http://localhost:${PORT}`);
  console.log(`==================================================`);
});
