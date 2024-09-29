const WebSocket = require('ws');
const config = require('./config.json');
const fetch = require('node-fetch');
let socket = null;
let heartbeatInterval = null;
const guilds = {};
const sendWebhookLog = async (message) => {
    try {
        await fetch(config.WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                content: message
            })
        });
        console.log(`Webhook log sent: ${message}`);
    } catch (error) {
        console.error('Error sending webhook log:', error.message);
    }
};
const claimVanityURL = async (vanityURL) => {
    const url = `https://canary.discord.com/api/v9/guilds/${config.GUILD_ID}/vanity-url`;
    try {
        const response = await fetch(url, {
            method: 'PATCH',
            headers: {
                Authorization: `${config.CLAIMMERS}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ code: vanityURL })
        });
        if (response.ok) {
            console.log(`Successfully claimed vanity URL: ${vanityURL}`);
            await sendWebhookLog(`Successfully claimed vanity URL: ${vanityURL}`);
        } else {
            console.log(`Failed to claim vanity URL: ${response.status}`);
        }
    } catch (error) {
        console.error('Error claiming vanity URL:', error.message);
    }
};
const handleGuildUpdate = (guildData) => {
    const oldVanity = guilds[guildData.id] ? guilds[guildData.id].vanity_url_code : null;
    const newVanity = guildData.vanity_url_code;
    if (!newVanity && oldVanity) {
        console.log(`Vanity URL ${oldVanity} is now free! Attempting to claim...`);
        claimVanityURL(oldVanity);
    }
    guilds[guildData.id] = { vanity_url_code: newVanity };
};
const onMessage = async (message) => {
    const data = JSON.parse(message);
    switch (data.op) {
        case 10: 
            startHeartbeat(data.d.heartbeat_interval);
            identifyConnection();
            break;
        case 0: 
            if (data.t === 'GUILD_UPDATE') {
                handleGuildUpdate(data.d);
            }
            break;
        default:
            console.log(`Unknown WebSocket message received: ${data.op}`);
    }
};
const startHeartbeat = (interval) => {
    heartbeatInterval = setInterval(() => {
        socket.send(JSON.stringify({ op: 1, d: null }));
    }, interval);
};
const identifyConnection = () => {
    socket.send(JSON.stringify({
        op: 2,
        d: {
            token: config.LISTENING,
            properties: {
                $os: 'linux',
                $browser: 'chrome',
                $device: 'desktop',
            },
            intents: 513
        }
    }));
};
const initWebSocketConnection = () => {
    socket = new WebSocket('wss://gateway.discord.gg/?v=9&encoding=json');
    socket.on('open', () => {
        console.log('WebSocket connection established.');
    });
    socket.on('message', onMessage);
    socket.on('close', () => {
        console.log('WebSocket connection closed. Reconnecting...');
        clearInterval(heartbeatInterval);
        setTimeout(initWebSocketConnection, 1000);
    });
    socket.on('error', (error) => {
        console.error('WebSocket encountered an error:', error.message);
        clearInterval(heartbeatInterval);
    });
};
initWebSocketConnection();
