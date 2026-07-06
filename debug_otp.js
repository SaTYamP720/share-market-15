const { SmartAPI } = require('smartapi-javascript');
const smart = new SmartAPI({ api_key: 'test' });
console.log("marketData definition:", smart.marketData.toString());
