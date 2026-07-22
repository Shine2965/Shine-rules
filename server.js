const express = require('express');
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
app.use(cors());
app.use(express.json());

const TOKEN = '8785872128:AAGJApScDjRIjg1VorXB35OvrvtUDCtVr0M'; // Ganti!
const bot = new TelegramBot(TOKEN, { polling: false });

const sessions = new Map();
const messages = new Map();

app.post('/register-session', (req, res) => {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'sessionId wajib' });
    
    // Init session
    if (!messages.has(sessionId)) {
        messages.set(sessionId, []);
    }
    
    res.json({ success: true, message: 'Session registered' });
});

app.post('/send-message', async (req, res) => {
    const { sessionId, message } = req.body;
    if (!sessionId || !message) {
        return res.status(400).json({ error: 'sessionId dan message wajib' });
    }

    const chatId = sessions.get(sessionId);
    if (!chatId) {
        return res.status(404).json({ error: 'Admin belum online' });
    }

    try {
        await bot.sendMessage(chatId, `👤 *Customer:* ${message}`, { 
            parse_mode: 'Markdown' 
        });
        
        if (!messages.has(sessionId)) {
            messages.set(sessionId, []);
        }
        const chatHistory = messages.get(sessionId);
        chatHistory.push({ sender: 'user', text: message, time: new Date() });
        
        res.json({ success: true });
    } catch(e) {
        console.error('Gagal kirim ke Telegram:', e);
        res.status(500).json({ error: 'Gagal kirim pesan' });
    }
});

app.get('/get-messages/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const lastId = parseInt(req.query.lastId) || 0;

    if (!messages.has(sessionId)) {
        return res.json({ messages: [], lastId: 0 });
    }

    const chatHistory = messages.get(sessionId);
    const newMessages = chatHistory.slice(lastId);
    const newLastId = chatHistory.length;

    res.json({ 
        messages: newMessages,
        lastId: newLastId 
    });
});

// Webhook Telegram
app.post('/telegram-webhook', (req, res) => {
    const { message } = req.body;
    if (!message) return res.sendStatus(200);

    const chatId = message.chat.id;
    const text = message.text;

    // Cari session
    let sessionId = null;
    for (let [key, value] of sessions.entries()) {
        if (value === chatId) {
            sessionId = key;
            break;
        }
    }

    if (!sessionId) {
        bot.sendMessage(chatId, '⚠️ Tidak ada sesi aktif. Tunggu customer mulai chat dari web.');
        return res.sendStatus(200);
    }

    // Simpan reply admin
    if (!messages.has(sessionId)) {
        messages.set(sessionId, []);
    }
    const chatHistory = messages.get(sessionId);
    chatHistory.push({ sender: 'cs', text: text, time: new Date() });

    console.log(`[${sessionId}] CS reply: ${text}`);
    res.sendStatus(200);
});

// Command /start
bot.onText(/\/start (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const sessionId = match[1];

    if (sessionId && sessionId.length > 5) {
        sessions.set(sessionId, chatId);
        bot.sendMessage(chatId, 
            `✅ *Sesi terhubung!*\n\n` +
            `🆔 Session ID: \`${sessionId}\`\n` +
            `📩 Customer akan chat di sini.\n` +
            `💬 Balas pesan customer langsung dari chat ini.`,
            { parse_mode: 'Markdown' }
        );
    } else {
        bot.sendMessage(chatId, `⚠️ *Link tidak valid!*`);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🐉 Dragon Bridge running on port ${PORT}`);
});
