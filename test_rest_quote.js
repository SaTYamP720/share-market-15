const { SmartAPI } = require('smartapi-javascript');
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

    // Request market quote for NSE SBIN token 3045
    const response = await smartConnect.marketData({
      mode: "FULL",
      exchangeTokens: {
        "NSE": ["3045"]
      }
    });

    console.log('--- REST API RESPONSE ---');
    console.log(JSON.stringify(response, null, 2));
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
