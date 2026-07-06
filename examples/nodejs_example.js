const { SmartConnect } = require('smartapi-javascript');
const otplib = require('otplib');

// ==============================================================================
// Angel One Smart API Node.js Example
// Dependencies: npm install smartapi-javascript otplib
// ==============================================================================

const API_KEY = "YOUR_API_KEY";
const CLIENT_ID = "YOUR_CLIENT_ID";
const PASSWORD = "YOUR_PASSWORD";
const TOTP_SECRET = "YOUR_TOTP_SECRET_KEY"; // Secret key provided by Angel One for TOTP

const smartConnect = new SmartConnect({
  api_key: API_KEY
});

async function run() {
  try {
    // 1. Generate TOTP
    const totp = otplib.authenticator.generate(TOTP_SECRET);
    console.log(`Generated current TOTP: ${totp}`);

    // 2. Generate Session
    const sessionData = await smartConnect.generateSession(CLIENT_ID, PASSWORD, totp);
    
    if (sessionData.status) {
      console.log("Authentication Successful!");
      const jwtToken = sessionData.data.jwtToken;
      const refreshToken = sessionData.data.refreshToken;
      const feedToken = sessionData.data.feedToken;

      console.log(`JWT Token: ${jwtToken}`);

      // 3. Get Profile Details
      const profile = await smartConnect.getProfile();
      console.log("Profile Name:", profile.data.name);

      // 4. Place a Limit Buy Order
      const orderParams = {
        variety: "NORMAL",
        tradingsymbol: "SBIN-EQ",
        symboltoken: "3045",
        transactiontype: "BUY",
        exchange: "NSE",
        ordertype: "LIMIT",
        producttype: "DELIVERY",
        duration: "DAY",
        price: "650.00",
        quantity: "5"
      };

      const orderResponse = await smartConnect.placeOrder(orderParams);
      console.log("Order Response:", orderResponse);
    } else {
      console.error("Session Generation Failed:", sessionData.message);
    }
  } catch (error) {
    console.error("An error occurred:", error);
  }
}

run();
