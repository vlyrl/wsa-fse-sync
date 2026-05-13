require('dotenv').config();
const axios = require('axios');
const cheerio = require('cheerio');

async function debug() {
  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  
  const res = await axios.get('https://server.fseconomy.net/index.jsp', {
    headers: { 'User-Agent': UA },
    validateStatus: () => true
  });

  const $ = cheerio.load(res.data);
  
  console.log('\n=== ALL HIDDEN INPUTS ===');
  $('input[type="hidden"]').each((i, el) => {
    console.log(`  name="${$(el).attr('name')}" value="${$(el).attr('value')}"`);
  });
  
  console.log('\n=== ALL FORM ACTIONS ===');
  $('form').each((i, el) => {
    console.log(`  form action="${$(el).attr('action')}" method="${$(el).attr('method')}"`);
    $(el).find('input').each((j, inp) => {
      console.log(`    input name="${$(inp).attr('name')}" type="${$(inp).attr('type')}" value="${$(inp).attr('value')}"`);
    });
  });

  console.log('\n=== BASIL IN RAW HTML ===');
  const basilIdx = res.data.indexOf('basil');
  if (basilIdx >= 0) {
    console.log(res.data.substring(basilIdx - 50, basilIdx + 200));
  } else {
    console.log('  basil NOT found in raw HTML');
  }

  console.log('\n=== JSESSIONID cookie ===');
  console.log(res.headers['set-cookie']);
}

debug().catch(console.error);
