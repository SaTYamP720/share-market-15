const { SmartAPI, WebSocketV2 } = require('smartapi-javascript');
const { generateSync } = require('otplib');
const config = require('./config.json');

const totp = generateSync({ secret: config.totp_secret });
const smartConnect = new SmartAPI({ api_key: config.api_key });

smartConnect.generateSession(config.client_code, config.password, totp)
  .then(async (sessionData) => {
    if (!sessionData.status) {
      console.error('Session generation failed:', sessionData.message);
      process.exit(1);
    }
    console.log('Logged in successfully!');
    const feedToken = sessionData.data.feedToken;
    const clientCode = config.client_code;
    const apiKey = config.api_key;
    const jwtToken = sessionData.data.jwtToken;

    const ws = new WebSocketV2({
      clientcode: clientCode,
      jwttoken: jwtToken,
      apikey: apiKey,
      feedtype: feedToken
    });

    ws.on('tick', (tickData) => {
      console.log('--- RECEIVED TICK ---');
      console.log(JSON.stringify(tickData, null, 2));
      ws.close();
      process.exit(0);
    });

    ws.connect().then(() => {
      console.log('Connected to WebSocket, subscribing...');
      // Subscribe to GOLD (MCX, exchangeType = 5, token = 466583) in SNAP_QUOTE (mode = 3)
      ws.fetchData({
        correlationID: 'test_sub',
        action: 1, // Subscribe
        mode: 3,   // SnapQuote (FULL)
        exchangeType: 5, // MCX
        tokens: ['466583']
      });
    }).catch(err => {
      console.error('WebSocket connection failed:', err);
      process.exit(1);
    });
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
