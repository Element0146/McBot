const express = require('express');
const mineflayer = require('mineflayer');
const fs = require('fs');
const app = express();
app.use(express.json());

const API_KEYS_FILE = './apikeys.json';

let bots = {}; // Oluşturulan botları tutacağız

// API key doğrulama middleware
function verifyApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) return res.status(401).json({ error: 'API key gerekli.' });

  if (!fs.existsSync(API_KEYS_FILE)) return res.status(500).json({ error: 'API key listesi bulunamadı.' });

  const keys = JSON.parse(fs.readFileSync(API_KEYS_FILE));
  const key = keys.find(k => k.apikey === apiKey);

  if (!key) return res.status(403).json({ error: 'Geçersiz API key.' });

  if (key.used >= key.limit) {
    return res.status(429).json({ error: 'API key günlük kullanım limiti aşıldı.' });
  }

  key.used++;
  fs.writeFileSync(API_KEYS_FILE, JSON.stringify(keys, null, 2));
  next();
}

// /create-bot endpoint
app.post('/create-bot', verifyApiKey, (req, res) => {
  const { host, port, username, version } = req.body;

  if (!host || !port || !username) {
    return res.status(400).json({ error: 'host, port ve username zorunlu.' });
  }

  if (bots[username]) {
    return res.status(400).json({ error: 'Bu kullanıcı adı ile bot zaten mevcut.' });
  }

  try {
    const bot = mineflayer.createBot({
      host,
      port,
      username,
      version: version || false
    });

    bots[username] = bot;

    bot.once('login', () => {
      console.log(`${username} adlı bot sunucuya bağlandı.`);
      res.json({ success: true, message: 'Bot başarıyla oluşturuldu ve bağlandı.', bot: { username, host, port, version } });
    });

    bot.once('error', err => {
      console.log(`${username} bot hata:`, err.message);
      delete bots[username];
      res.status(500).json({ error: 'Bot oluşturulurken hata oluştu.', details: err.message });
    });

    bot.once('end', () => {
      console.log(`${username} bot bağlantısı kesildi.`);
      delete bots[username];
    });

  } catch (error) {
    res.status(500).json({ error: 'Bot oluşturma sırasında beklenmedik hata oluştu.', details: error.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Sunucu ${PORT} portunda çalışıyor.`);
});
