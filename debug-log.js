require('dotenv').config();
const puppeteer = require('puppeteer');
const axios = require('axios');
const cheerio = require('cheerio');

const FSE_CONFIG = {
  baseUrl: 'https://server.fseconomy.net',
  username: process.env.FSE_USERNAME,
  password: process.env.FSE_PASSWORD,
  groupId: '109630'
};

async function run() {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto(FSE_CONFIG.baseUrl + '/index.jsp', { waitUntil: 'networkidle2', timeout: 30000 });
  await page.type('input[name="user"]', FSE_CONFIG.username, { delay: 30 });
  await page.type('input[name="password"]', FSE_CONFIG.password, { delay: 30 });
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
    page.click('input[type="submit"], button[type="submit"], input[value*="Log"]')
  ]);
  const cookies = await page.cookies();
  const sessionCookies = cookies.map(c => c.name + '=' + c.value).join('; ');
  await browser.close();
  console.log('✅ Logged in\n');

  const res = await axios.get(FSE_CONFIG.baseUrl + '/log.jsp?groupid=' + FSE_CONFIG.groupId, {
    headers: { 'Cookie': sessionCookies, 'User-Agent': 'Mozilla/5.0' },
    timeout: 15000
  });

  const $ = cheerio.load(res.data);
  console.log('=== TABLE HEADERS ===');
  $('table').each(function(ti, table) {
    const ths = $(table).find('th').map(function(i, th) { return '"' + $(th).text().trim() + '"'; }).get();
    console.log('Table ' + ti + ' headers: [' + ths.join(', ') + ']');
    // Print first 3 data rows
    $(table).find('tr').slice(1, 4).each(function(ri, row) {
      const cells = $(row).find('td').map(function(i, td) { return '"' + $(td).text().trim().substring(0, 25) + '"'; }).get();
      console.log('  Row ' + ri + ': [' + cells.join(', ') + ']');
    });
    console.log('');
  });
}

run().catch(console.error);
