import express from 'express';
import { handleWhatsAppMessage } from './whatsapp-bot.ts';

const router = express.Router();

const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || 'appforge_verify_2026';
const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN || '';
const PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID || '';
const GRAPH_API = 'https://graph.facebook.com/v21.0';

// Webhook verification (Meta sends GET to verify)
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[Meta] Webhook verified');
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// Incoming messages from Meta
router.post('/webhook', async (req, res) => {
  // Always return 200 immediately (Meta requires fast response)
  res.sendStatus(200);
  
  try {
    const body = req.body;
    if (!body.object || body.object !== 'whatsapp_business_account') return;
    
    const entries = body.entry || [];
    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        if (change.field !== 'messages') continue;
        const value = change.value;
        if (!value.messages) continue;
        
        for (const message of value.messages) {
          const phone = message.from; // sender's phone number
          const msgType = message.type;
          
          let text = '';
          if (msgType === 'text') {
            text = message.text?.body || '';
          } else if (msgType === 'interactive') {
            text = message.interactive?.button_reply?.title || 
                   message.interactive?.list_reply?.title || '';
          } else {
            text = `[${msgType} message]`;
          }
          
          if (!text) continue;
          
          // Process through our bot
          const response = await handleWhatsAppMessage(phone, text);
          
          // Send replies
          for (const reply of response.replies) {
            await sendTextMessage(phone, reply);
          }
          
          // Send media if any
          if (response.media) {
            for (const media of response.media) {
              await sendMediaMessage(phone, media);
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('[Meta Webhook] Error:', err);
  }
});

// Send text message via Meta API
async function sendTextMessage(to: string, text: string) {
  if (!ACCESS_TOKEN || !PHONE_NUMBER_ID) {
    console.warn('[Meta] Missing ACCESS_TOKEN or PHONE_NUMBER_ID');
    return;
  }
  
  try {
    const res = await fetch(`${GRAPH_API}/${PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text },
      }),
    });
    
    if (!res.ok) {
      const err = await res.json();
      console.error('[Meta] Send failed:', err);
    }
  } catch (err) {
    console.error('[Meta] Send error:', err);
  }
}

// Send media (document/image) via Meta API
async function sendMediaMessage(to: string, media: { url: string; type: string; filename?: string }) {
  if (!ACCESS_TOKEN || !PHONE_NUMBER_ID) return;
  
  try {
    const mediaType = media.type === 'apk' ? 'document' : media.type;
    const res = await fetch(`${GRAPH_API}/${PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: mediaType,
        [mediaType]: {
          link: media.url,
          ...(media.filename ? { filename: media.filename } : {}),
        },
      }),
    });
    
    if (!res.ok) {
      const err = await res.json();
      console.error('[Meta] Media send failed:', err);
    }
  } catch (err) {
    console.error('[Meta] Media send error:', err);
  }
}

export default router;
export { sendTextMessage, sendMediaMessage };
