const http = require('http');

http.get('http://localhost:3000/api/search-scripts?query=ABB&category=futures', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    const json = JSON.parse(data);
    console.log("Search Results for ABB:", json.data.slice(0, 5));
  });
});
