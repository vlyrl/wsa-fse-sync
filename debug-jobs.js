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

  const res = await axios.get(FSE_CONFIG.baseUrl + '/groupassignments.jsp?groupid=' + FSE_CONFIG.groupId, {
    headers: { 'Cookie': sessionCookies, 'User-Agent': 'Mozilla/5.0' },
    timeout: 15000
  });

  const $ = cheerio.load(res.data);

  $('table').each(function(ti, table) {
    const headerText = $(table).find('th').map(function(i,th){ return $(th).text(); }).get().join(' ');
    if (!headerText.includes('From') || !headerText.includes('Dest')) return;

    console.log('=== FOUND JOB TABLE ===');
    console.log('Headers:', $(table).find('th').map(function(i,th){ return '"' + $(th).text().trim().replace(/\s+/g,' ') + '"'; }).get().join(', '));
    console.log('');

    $(table).find('tr').slice(1, 4).each(function(ri, row) {
      const cells = $(row).find('td');
      console.log('Row ' + ri + ' (' + cells.length + ' cells):');
      cells.each(function(ci, cell) {
        console.log('  col[' + ci + ']: "' + $(cell).text().trim().replace(/\s+/g,' ').substring(0,40) + '"');
      });
      console.log('');
    });
  });
}

run().catch(console.error);
