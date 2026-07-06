const fs = require('fs');
const path = require('path');

const scripMaster = JSON.parse(fs.readFileSync(path.join(__dirname, 'scrip_master.json'), 'utf8'));
const matches = scripMaster.filter(item => item.symbol === 'RELIANCE29SEP26FUT');
console.log("RELIANCE29SEP26FUT details in scrip master:", matches);
