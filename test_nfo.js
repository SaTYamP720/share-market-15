const http = require('http');

http.get('http://localhost:3000/api/market-data?exchange=NFO&token=61096', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log("NFO Quote Response:", data);
  });
});
