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
  // Login with puppeteer
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

  // Fetch jobs page
  const res = await axios.get(FSE_CONFIG.baseUrl + '/groupassignments.jsp?groupid=' + FSE_CONFIG.groupId, {
    headers: { 'Cookie': sessionCookies, 'User-Agent': 'Mozilla/5.0' },
    timeout: 15000
  });

  const $ = cheerio.load(res.data);
  console.log('=== ALL TABLES AND THEIR HEADERS ===');
  $('table').each(function(ti, table) {
    const ths = $(table).find('th').map(function(i, th) { return '"' + $(th).text().trim() + '"'; }).get();
    const firstRow = $(table).find('tr').eq(1).find('td').map(function(i, td) { return '"' + $(td).text().trim().substring(0,30) + '"'; }).get();
    console.log('Table ' + ti + ' headers: [' + ths.join(', ') + ']');
    console.log('Table ' + ti + ' first data row: [' + firstRow.join(', ') + ']');
    console.log('');
  });
}

run().catch(console.error);
