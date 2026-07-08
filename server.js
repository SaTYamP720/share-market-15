const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { SmartAPI } = require('smartapi-javascript');
const { generateSync } = require('otplib');

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});
const PORT = process.env.PORT || 3000;

// Track which tokens each connected socket is watching
// Map<socketId, Set<tokenKey>> where tokenKey = "EXCHANGETYPE:TOKEN"
const socketSubscriptions = new Map();

// =============================================
// STEP 2: Shared Price Cache
// Stores the latest price for every subscribed token.
// Key: "EXCHANGETYPE:TOKEN"  e.g. "5:234230"
// Value: { ltp, token, exchangeType, ts }
// =============================================
const priceCache = new Map();

// Angel One WebSocket state
let angelWSState = {
  instance: null,      // WebSocketV2 instance
  isConnected: false,
  subscribedKeys: new Set()  // Set of "EXCHANGETYPE:TOKEN" currently subscribed
};

app.use(express.json());
// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Global state to store active session
let activeSession = {
  clientCode: null,
  smartConnectInstance: null,
  profile: null,
  feedToken: null   // Needed for Angel One WebSocket authentication
};

// Protect the real session from being overwritten by guest logins
let realSmartConnectSession = {
  clientCode: null,
  smartConnectInstance: null,
  profile: null,
  feedToken: null
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
      // Store feedToken from session response for WebSocket auth
      activeSession.feedToken = sessionData.data?.feedToken || null;
      const profileInfo = await smartConnect.getProfile();
      activeSession.profile = profileInfo.data;

      // Keep real session copy
      realSmartConnectSession = {
        clientCode: activeSession.clientCode,
        smartConnectInstance: activeSession.smartConnectInstance,
        profile: activeSession.profile,
        feedToken: activeSession.feedToken
      };
    } else {
      console.error(`[Backend] Auto-login failed: ${sessionData.message}`);
    }
  } catch (error) {
    console.error("[Backend] Auto-login exception:", error.message);
  }
}

// =============================================
// STEP 2: Angel One WebSocket feed connection
// =============================================
function getExchangeTypeInt(exchangeStr) {
  const clean = (exchangeStr || '').toLowerCase().trim();
  const segMap = {
    'nse_cm': 1,
    'nse_fo': 2,
    'bse_cm': 3,
    'bse_fo': 4,
    'mcx_fo': 5,
    'ncx_fo': 7,
    'cde_fo': 13
  };
  if (segMap[clean] !== undefined) return segMap[clean];

  if (clean.startsWith('nse')) return 1;
  if (clean.startsWith('nfo')) return 2;
  if (clean.startsWith('bse')) return 3;
  if (clean.startsWith('bfo')) return 4;
  if (clean.startsWith('mcx')) return 5;
  if (clean.startsWith('ncdex') || clean.startsWith('ncx')) return 7;
  if (clean.startsWith('cds') || clean.startsWith('cde')) return 13;

  return 1;
}
function getWsPriceDivisor(exchangeType) {
  const exchType = parseInt(exchangeType, 10);
  if (exchType === 13) return 10000; // CDS currency ticks
  return 100;
}

function scaleRestPriceForDisplay(exchange, value) {
  const parsed = parseFloat(value || 0);
  if (!Number.isFinite(parsed)) return 0;
  return parsed;
}

function scaleRestDepthForDisplay(exchange, depth) {
  if (!depth) return depth;
  const scaleSide = (side) => Array.isArray(side)
    ? side.map(level => ({ ...level, price: scaleRestPriceForDisplay(exchange, level.price) }))
    : side;
  return {
    ...depth,
    buy: scaleSide(depth.buy),
    sell: scaleSide(depth.sell)
  };
}

async function initAngelOneWebSocket() {
  if (!activeSession.smartConnectInstance || !activeSession.smartConnectInstance.generateSession) {
    console.log('[AngelWS] No real session available, skipping WebSocket init.');
    return;
  }
  try {
    const { WebSocketV2 } = require('smartapi-javascript');

    const sc = activeSession.smartConnectInstance;
    const jwttoken = sc.access_token || '';          // set by setAccessToken() after login
    const feedtoken = activeSession.feedToken || '';
    const clientcode = activeSession.clientCode;
    const apikey = config ? config.api_key : '';

    if (!jwttoken || !feedtoken) {
      console.warn('[AngelWS] JWT or Feed token missing. Cannot start WebSocket.');
      return;
    }

    const wsInstance = new WebSocketV2({
      clientcode,
      jwttoken,
      apikey,
      feedtype: feedtoken
    });

    let _firstTick = true;
    wsInstance.on('tick', (tickData) => {
      if (!tickData || !tickData.token) return;
      if (_firstTick) {
        console.log('[AngelWS] === RAW FIRST TICK ===');
        console.log(JSON.stringify(tickData, null, 2));
        _firstTick = false;
      }
      
      // Clean token string (smartapi-javascript parser leaves double quotes and null characters)
      const cleanToken = (tickData.token || '').replace(/["'\s\u0000]/g, '').trim();
      const tokenKey = `${tickData.exchange_type}:${cleanToken}`;
      
      const exchType = parseInt(tickData.exchange_type);
      // Angel One WebSocket sends prices as scaled integers; keep SmartAPI scale direct.
      const divisor = getWsPriceDivisor(exchType);

      const scale = (raw) => raw ? parseFloat(raw) / divisor : null;

      const ltp   = scale(tickData.last_traded_price) || 0;
      // FULL mode field names from smartapi-javascript library (websocket2.0.js):
      const open  = scale(tickData.open_price_day);
      const high  = scale(tickData.high_price_day);
      const low   = scale(tickData.low_price_day);
      const close = scale(tickData.close_price);

      // Extract top bid and ask from market depth (only in FULL mode = 3)
      const buyDepth  = tickData.best_5_buy_data  || [];
      const sellDepth = tickData.best_5_sell_data || [];
      const bid = buyDepth[0]  ? scale(buyDepth[0].price)  : null;
      const ask = sellDepth[0] ? scale(sellDepth[0].price) : null;

      // Net change vs previous close
      const netChange = (close && close > 0) ? parseFloat((ltp - close).toFixed(2)) : null;
      const pctChange = (close && close > 0) ? parseFloat(((ltp - close) / close * 100).toFixed(2)) : null;

      console.log(`[AngelWS] Tick | Token: ${cleanToken} | LTP: ${ltp} | Bid: ${bid} | Ask: ${ask} | Open: ${open} | Close: ${close}`);

      priceCache.set(tokenKey, {
        ltp, bid, ask, open, high, low, close, netChange, pctChange,
        token: cleanToken,
        exchangeType: tickData.exchange_type,
        ts: Date.now()
      });

      // Broadcast ALL fields to all browser clients in one event
      io.emit('price_tick', { key: tokenKey, ltp, bid, ask, open, high, low, close, netChange, pctChange, token: cleanToken });
    });


    await wsInstance.connect();
    angelWSState.instance = wsInstance;
    angelWSState.isConnected = true;
    console.log('[AngelWS] Connected to Angel One SmartAPI WebSocket feed.');
  } catch (err) {
    console.error('[AngelWS] Failed to connect:', err.message);
  }
}

// Helper: subscribe a list of { exchangeType (int), token (string) } objects
function wsSubscribeTokens(tokenList) {
  if (!angelWSState.isConnected || !angelWSState.instance) return;
  // Group by exchangeType
  const grouped = {};
  for (const { exchangeType, token } of tokenList) {
    const key = `${exchangeType}:${token}`;
    if (angelWSState.subscribedKeys.has(key)) continue;
    angelWSState.subscribedKeys.add(key);
    if (!grouped[exchangeType]) grouped[exchangeType] = [];
    grouped[exchangeType].push(token);
  }
  for (const [exchType, tokens] of Object.entries(grouped)) {
    if (tokens.length === 0) continue;
    angelWSState.instance.fetchData({
      correlationID: `sub_${Date.now()}`,
      action: 1,  // 1 = Subscribe
      mode: 3,    // 3 = FULL (LTP + Bid/Ask depth + OHLC). Mode 1 = LTP only.
      exchangeType: parseInt(exchType),
      tokens
    });
    console.log(`[AngelWS] Subscribed ${tokens.length} tokens on exchange ${exchType}`);
  }
}

// Helper: unsubscribe tokens no longer watched by anyone
function wsUnsubscribeTokens(tokenList) {
  if (!angelWSState.isConnected || !angelWSState.instance) return;
  const grouped = {};
  for (const { exchangeType, token } of tokenList) {
    const key = `${exchangeType}:${token}`;
    // Only unsubscribe if nobody else is watching this key
    const stillWatched = [...socketSubscriptions.values()].some(s => s.has(key));
    if (stillWatched) continue;
    angelWSState.subscribedKeys.delete(key);
    if (!grouped[exchangeType]) grouped[exchangeType] = [];
    grouped[exchangeType].push(token);
  }
  for (const [exchType, tokens] of Object.entries(grouped)) {
    if (tokens.length === 0) continue;
    angelWSState.instance.fetchData({
      correlationID: `unsub_${Date.now()}`,
      action: 0,  // 0 = Unsubscribe
      mode: 3,    // Must match subscribe mode
      exchangeType: parseInt(exchType),
      tokens
    });
    console.log(`[AngelWS] Unsubscribed ${tokens.length} tokens on exchange ${exchType}`);
  }
}

// Run auto-login 1.5 seconds after server start, then start WebSocket
setTimeout(async () => {
  await attemptAutoLogin();
  // Give session a moment to settle before WS init
  setTimeout(initAngelOneWebSocket, 2000);
}, 1500);

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
      activeSession.feedToken = sessionData.data?.feedToken || null;
      
      // Fetch profile info to verify and store
      const profileInfo = await smartConnect.getProfile();
      activeSession.profile = profileInfo.data;
      
      // Keep real session copy
      realSmartConnectSession = {
        clientCode: activeSession.clientCode,
        smartConnectInstance: activeSession.smartConnectInstance,
        profile: activeSession.profile,
        feedToken: activeSession.feedToken
      };

      // Start Angel One WebSocket feed now that we have a real session
      setTimeout(initAngelOneWebSocket, 500);

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

  // Try to use the real session if available, otherwise fallback to the active session
  const sessionToUse = (realSmartConnectSession.smartConnectInstance && realSmartConnectSession.smartConnectInstance.generateSession)
                      ? realSmartConnectSession
                      : activeSession;

  // Local test mode bypass — only if there is absolutely no real session available
  if (!sessionToUse.smartConnectInstance || !sessionToUse.smartConnectInstance.generateSession) {
    return res.status(503).json({ success: false, message: 'Angel One session unavailable. Live prices cannot be fetched.' });
  }

  try {
    const exchangeTokens = {};
    exchangeTokens[exchange] = [token];

    // Request market quotes from Angel One
    const response = await sessionToUse.smartConnectInstance.marketData({
      mode: "FULL",
      exchangeTokens: exchangeTokens
    });
    
    if (response.status && response.data && response.data.fetched && response.data.fetched.length > 0) {
      const info = response.data.fetched[0];
      
      const ltp = scaleRestPriceForDisplay(exchange, info.ltp);
      const close = scaleRestPriceForDisplay(exchange, info.close || info.prevClose);
      const change = ltp - close;
      const pctChange = close > 0 ? (change / close) * 100 : 0;

      res.json({
        success: true,
        data: {
          exchange: exchange,
          symbolToken: token,
          ltp: ltp.toFixed(2),
          open: scaleRestPriceForDisplay(exchange, info.open).toFixed(2),
          high: scaleRestPriceForDisplay(exchange, info.high).toFixed(2),
          low: scaleRestPriceForDisplay(exchange, info.low).toFixed(2),
          close: close.toFixed(2),
          depth: scaleRestDepthForDisplay(exchange, info.depth) || { buy: [], sell: [] },
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

  // Try to use the real session if available, otherwise fallback to the active session
  const sessionToUse = (realSmartConnectSession.smartConnectInstance && realSmartConnectSession.smartConnectInstance.generateSession)
                      ? realSmartConnectSession
                      : activeSession;

  if (!sessionToUse.smartConnectInstance || !sessionToUse.smartConnectInstance.generateSession) {
    return res.status(503).json({ success: false, message: 'Angel One session unavailable. Live prices cannot be fetched.' });
  }

  try {
    const exchangeTokens = {};
    scripts.forEach(s => {
      const ex = s.exchange.toUpperCase();
      if (!exchangeTokens[ex]) exchangeTokens[ex] = [];
      exchangeTokens[ex].push(s.token);
    });

    const response = await sessionToUse.smartConnectInstance.marketData({
      mode: "FULL",
      exchangeTokens: exchangeTokens
    });

    if (response.status && response.data && response.data.fetched) {
      const results = scripts.map(s => {
        const info = response.data.fetched.find(item => item.symbolToken === s.token && item.exchange === s.exchange) || {};
        
        const ltp = scaleRestPriceForDisplay(s.exchange, info.ltp);
        const close = scaleRestPriceForDisplay(s.exchange, info.close);
        const change = ltp - close;
        const pctChange = close > 0 ? (change / close) * 100 : 0;

        return {
          exchange: s.exchange,
          symbolToken: s.token,
          ltp: ltp.toFixed(2),
          open: scaleRestPriceForDisplay(s.exchange, info.open).toFixed(2),
          high: scaleRestPriceForDisplay(s.exchange, info.high).toFixed(2),
          low: scaleRestPriceForDisplay(s.exchange, info.low).toFixed(2),
          close: close.toFixed(2),
          depth: scaleRestDepthForDisplay(s.exchange, info.depth) || { buy: [], sell: [] },
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

// REST endpoint — browser can query current cache if needed as fallback
app.get('/api/ws-cache', (req, res) => {
  const result = {};
  priceCache.forEach((val, key) => { result[key] = val; });
  res.json({ success: true, count: priceCache.size, data: result });
});
// Catch-all route to serve index.html for any frontend routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// =============================================
// STEP 1 + 2 + 3: socket.io connection + dynamic subscribe
// =============================================
io.on('connection', (socket) => {
  console.log(`[WS] Client connected: ${socket.id} | Total: ${io.engine.clientsCount}`);
  socketSubscriptions.set(socket.id, new Set());

  // Send current cache snapshot so the new user sees prices immediately
  if (priceCache.size > 0) {
    const snapshot = {};
    priceCache.forEach((val, key) => { snapshot[key] = val; });
    socket.emit('price_snapshot', snapshot);
  }

  // STEP 3: Browser tells server which tokens to subscribe to
  // payload: { tokens: [ { exchange: 'NSE', token: '1234' }, ... ] }
  socket.on('ws_subscribe', ({ tokens }) => {
    if (!Array.isArray(tokens) || tokens.length === 0) return;
    console.log(`[WS] ws_subscribe from ${socket.id}: ${tokens.length} tokens — ${JSON.stringify(tokens.slice(0, 3))}`);
    const mySubscriptions = socketSubscriptions.get(socket.id);
    const toSubscribe = [];
    for (const { exchange, token } of tokens) {
      const exchType = getExchangeTypeInt(exchange);
      const key = `${exchType}:${token}`;
      console.log(`[WS] Resolved: exchange="${exchange}" => exchType=${exchType} => key="${key}"`);
      if (!mySubscriptions.has(key)) {
        mySubscriptions.add(key);
        toSubscribe.push({ exchangeType: exchType, token: String(token) });
        // If already in cache, send full tick immediately to this socket
        if (priceCache.has(key)) {
          const cached = priceCache.get(key);
          socket.emit('price_tick', { key, ...cached });
        }
      }
    }
    if (toSubscribe.length > 0) {
      console.log(`[WS] Subscribing ${toSubscribe.length} NEW tokens on Angel One WS`);
      wsSubscribeTokens(toSubscribe);
    } else {
      console.log(`[WS] All tokens already subscribed`);
    }
  });


  // STEP 3: Browser tells server which tokens to unsubscribe
  socket.on('ws_unsubscribe', ({ tokens }) => {
    if (!Array.isArray(tokens) || tokens.length === 0) return;
    const mySubscriptions = socketSubscriptions.get(socket.id);
    const toUnsub = [];
    for (const { exchange, token } of tokens) {
      const exchType = getExchangeTypeInt(exchange);
      const key = `${exchType}:${token}`;
      if (mySubscriptions.has(key)) {
        mySubscriptions.delete(key);
        toUnsub.push({ exchangeType: exchType, token: String(token) });
      }
    }
    if (toUnsub.length > 0) wsUnsubscribeTokens(toUnsub);
  });

  socket.on('disconnect', () => {
    console.log(`[WS] Client disconnected: ${socket.id} | Total: ${io.engine.clientsCount}`);
    // Auto-unsubscribe all tokens this socket was watching
    const mySubscriptions = socketSubscriptions.get(socket.id);
    if (mySubscriptions && mySubscriptions.size > 0) {
      const toUnsub = [];
      mySubscriptions.forEach(key => {
        const [exchType, token] = key.split(':');
        toUnsub.push({ exchangeType: parseInt(exchType), token });
      });
      wsUnsubscribeTokens(toUnsub);
    }
    socketSubscriptions.delete(socket.id);
  });
});


httpServer.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`🚀 Share Market 18 terminal is running locally!`);
  console.log(`👉 Access URL: http://localhost:${PORT}`);
  console.log(`==================================================`);
});
