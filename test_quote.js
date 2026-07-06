const http = require('http');

http.get('http://localhost:3000/api/market-data?exchange=NSE&token=3045', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log("Response Status:", res.statusCode);
    console.log("Response Body:", data);
  });
}).on('error', (err) => {
  console.error("Error:", err.message);
});
