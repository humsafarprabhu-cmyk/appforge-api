/**
 * AppForge WhatsApp Bot — State machine for building apps via chat
 */

// ─── TYPES ───────────────────────────────────────────────────────────────────
export interface UserSession {
  phone: string;
  state: 'idle' | 'awaiting_prompt' | 'confirming' | 'building' | 'delivering' | 'editing';
  appName?: string;
  category?: string;
  prompt?: string;
  jobId?: string;
  screens?: { name: string; html: string }[];
  lastActivity: number;
  appsBuilt: number;
}

export interface WhatsAppResponse {
  replies: string[];
  media?: { url: string; type: string; filename?: string }[];
}

// ─── SESSION STORE ───────────────────────────────────────────────────────────
const sessions = new Map<string, UserSession>();

// Clean stale sessions every 30 min
setInterval(() => {
  const cutoff = Date.now() - 60 * 60 * 1000; // 1 hour
  for (const [phone, s] of sessions) {
    if (s.lastActivity < cutoff && s.state !== 'building') sessions.delete(phone);
  }
}, 30 * 60 * 1000);

export function getOrCreateSession(phone: string): UserSession {
  let s = sessions.get(phone);
  if (!s) {
    s = { phone, state: 'idle', lastActivity: Date.now(), appsBuilt: 0 };
    sessions.set(phone, s);
  }
  s.lastActivity = Date.now();
  return s;
}

export function getSession(phone: string): UserSession | undefined {
  return sessions.get(phone);
}

// ─── CATEGORY DETECTION ──────────────────────────────────────────────────────
function detectCategory(prompt: string): string {
  const p = prompt.toLowerCase();
  const map: [string, string[]][] = [
    ['fitness', ['fitness', 'workout', 'exercise', 'gym', 'training', 'health tracker']],
    ['finance', ['finance', 'budget', 'expense', 'money', 'banking', 'investment', 'crypto']],
    ['food', ['food', 'recipe', 'restaurant', 'cooking', 'meal', 'delivery', 'kitchen']],
    ['education', ['education', 'learning', 'course', 'study', 'quiz', 'tutor', 'school']],
    ['social', ['social', 'chat', 'messaging', 'community', 'forum', 'network']],
    ['ecommerce', ['shop', 'store', 'ecommerce', 'marketplace', 'product', 'cart', 'sell']],
    ['travel', ['travel', 'trip', 'booking', 'hotel', 'flight', 'vacation', 'tourism']],
    ['music', ['music', 'playlist', 'song', 'audio', 'podcast', 'streaming']],
    ['health', ['health', 'medical', 'doctor', 'patient', 'pharmacy', 'wellness']],
    ['news', ['news', 'article', 'blog', 'magazine', 'journal']],
    ['dating', ['dating', 'match', 'love', 'relationship']],
    ['realestate', ['real estate', 'property', 'house', 'apartment', 'rent']],
  ];
  for (const [cat, keywords] of map) {
    if (keywords.some(k => p.includes(k))) return cat;
  }
  return 'productivity';
}

// ─── INTERNAL API CALLS (call the existing server endpoints) ─────────────────
let BASE_URL = process.env.TUNNEL_URL || 'http://localhost:3001';

export function setBaseUrl(url: string) { BASE_URL = url; console.log('[WhatsApp] Base URL set to:', url); }

async function callOnboarding(prompt: string): Promise<{ appName: string }> {
  try {
    const res = await fetch(`${BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, appId: 'whatsapp-onboard', mode: 'onboarding' }),
    });
    const data = await res.json() as any;
    return { appName: data.appName || 'MyApp' };
  } catch {
    // Fallback: extract name from prompt
    const words = prompt.split(/\s+/).slice(0, 3);
    return { appName: words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('') };
  }
}

async function startGeneration(prompt: string, appName: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, appId: `wa-${Date.now()}`, appName }),
  });
  const data = await res.json() as any;
  if (!data.success) throw new Error(data.message || 'Generation failed');
  return data.jobId;
}

async function getJobStatus(jobId: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/job/${jobId}`);
  return await res.json();
}

async function editScreen(session: UserSession, instruction: string): Promise<{ success: boolean }> {
  try {
    const res = await fetch(`${BASE_URL}/api/edit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobId: session.jobId,
        screenIndex: 0,
        instruction,
        currentHtml: session.screens?.[0]?.html,
      }),
    });
    const data = await res.json() as any;
    if (data.success && session.screens?.[0]) {
      session.screens[0].html = data.html;
    }
    return { success: data.success };
  } catch {
    return { success: false };
  }
}

// ─── OUTBOUND MESSAGE QUEUE (for background polling) ─────────────────────────
type OutboundCallback = (phone: string, message: string, media?: WhatsAppResponse['media']) => void;
let outboundCallback: OutboundCallback | null = null;

// Pending messages for phones (used when no callback is set)
const pendingMessages = new Map<string, { message: string; media?: WhatsAppResponse['media'] }[]>();

export function setOutboundCallback(cb: OutboundCallback) { outboundCallback = cb; }

function sendOutbound(phone: string, message: string, media?: WhatsAppResponse['media']) {
  if (outboundCallback) {
    outboundCallback(phone, message, media);
  } else {
    const q = pendingMessages.get(phone) || [];
    q.push({ message, media });
    pendingMessages.set(phone, q);
  }
}

export function drainPending(phone: string): { message: string; media?: WhatsAppResponse['media'] }[] {
  const msgs = pendingMessages.get(phone) || [];
  pendingMessages.delete(phone);
  return msgs;
}

// ─── BACKGROUND POLL & DELIVER ───────────────────────────────────────────────
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function pollAndDeliver(phone: string, jobId: string) {
  let lastCount = 0;
  const maxWait = 120_000; // 2 min timeout
  const start = Date.now();

  while (Date.now() - start < maxWait) {
    await sleep(5000);
    try {
      const job = await getJobStatus(jobId);
      if (!job.success) continue;

      // Progress updates
      if (job.completedScreens > lastCount) {
        for (let i = lastCount; i < job.completedScreens; i++) {
          sendOutbound(phone, `✅ Screen ${i + 1}/${job.totalScreens}: ${job.screenNames?.[i] || 'Screen'}`);
        }
        lastCount = job.completedScreens;
      }

      if (job.status === 'complete') {
        const session = getOrCreateSession(phone);
        session.screens = job.screens;
        session.state = 'editing';
        session.appsBuilt++;

        const pwaUrl = `${BASE_URL}/app/${jobId}`;
        sendOutbound(phone,
          `🎉 *${session.appName}* is ready!\n\n` +
          `🌐 Live Preview: ${pwaUrl}\n\n` +
          `Want changes? Just tell me (e.g. "make it blue")\n` +
          `Say *new app* to start fresh.\n\n` +
          `💎 Love it? Upgrade to Pro for unlimited apps & APK export!`
        );
        return;
      }

      if (job.status === 'error') {
        const session = getOrCreateSession(phone);
        session.state = 'confirming'; // let them retry
        sendOutbound(phone, `❌ Build failed: ${job.error || 'Unknown error'}\n\nSay *build* to retry.`);
        return;
      }
    } catch (err) {
      // Network error, keep polling
    }
  }

  // Timeout
  const session = getOrCreateSession(phone);
  session.state = 'confirming';
  sendOutbound(phone, '⏰ Build timed out. Say *build* to retry.');
}

// ─── MAIN MESSAGE HANDLER ────────────────────────────────────────────────────
export async function handleWhatsAppMessage(phone: string, message: string): Promise<WhatsAppResponse> {
  const session = getOrCreateSession(phone);
  const msg = message.trim().toLowerCase();

  // Global commands
  if (msg === 'reset' || msg === 'restart') {
    sessions.delete(phone);
    return { replies: ['🔄 Reset! Send me a message to start fresh.'] };
  }
  if (msg === 'status') {
    return { replies: [`📊 State: ${session.state}\n📱 App: ${session.appName || 'none'}\n🔢 Apps built: ${session.appsBuilt}`] };
  }

  // Drain any pending background messages
  const pending = drainPending(phone);
  const extraReplies = pending.map(p => p.message);

  let response: WhatsAppResponse;

  switch (session.state) {
    case 'idle': {
      session.state = 'awaiting_prompt';
      response = {
        replies: [
          "👋 Hey! I'm *AppForge* — I build mobile apps from a text description.\n\n" +
          "Just tell me your app idea and I'll create it!\n\n" +
          "Example: _A fitness tracker with workout logging and progress charts_"
        ]
      };
      break;
    }

    case 'awaiting_prompt': {
      if (msg.length < 5) {
        response = { replies: ["Tell me more! Describe your app idea in a sentence or two. 🤔"] };
        break;
      }
      session.prompt = message;
      try {
        const { appName } = await callOnboarding(message);
        session.appName = appName;
      } catch {
        session.appName = 'MyApp';
      }
      session.category = detectCategory(message);
      session.state = 'confirming';
      response = {
        replies: [
          `Great idea! Here's what I'll build:\n\n` +
          `📱 *${session.appName}*\n` +
          `📂 Category: ${session.category}\n\n` +
          `✅ Reply *build* to start\n` +
          `✏️ Or tell me changes (e.g. "call it FitPro instead")`
        ]
      };
      break;
    }

    case 'confirming': {
      if (['build', 'yes', 'start', 'go', 'ok', 'let\'s go', 'do it'].includes(msg)) {
        if (session.appsBuilt >= 3) {
          response = {
            replies: ["You've hit the free limit! 💎 Upgrade to Pro for unlimited apps:\nhttps://appforge.dev/pricing"]
          };
          break;
        }
        session.state = 'building';
        try {
          const jobId = await startGeneration(session.prompt!, session.appName!);
          session.jobId = jobId;
          // Fire background polling
          pollAndDeliver(phone, jobId);
          response = {
            replies: ["🔨 Building your app now!\n\n⏳ This takes about 45-60 seconds. I'll send updates as each screen is ready..."]
          };
        } catch (err: any) {
          session.state = 'confirming';
          response = { replies: [`❌ Failed to start build: ${err.message}\n\nSay *build* to retry.`] };
        }
        break;
      }

      if (msg === 'retry') {
        // Re-trigger same as build
        session.state = 'confirming';
        response = { replies: [`Ready to build *${session.appName}*.\n\nReply *build* to start!`] };
        break;
      }

      // Name changes
      if (msg.includes('call it') || msg.includes('name it') || msg.includes('rename')) {
        const newName = message.replace(/call it|name it|rename to|rename/gi, '').trim();
        if (newName) session.appName = newName;
        response = { replies: [`Got it! Renamed to *${session.appName}*.\n\nReply *build* when ready!`] };
        break;
      }

      // Treat as prompt update
      session.prompt = message;
      const { appName } = await callOnboarding(message);
      session.appName = appName;
      session.category = detectCategory(message);
      response = {
        replies: [
          `Updated! I'll build:\n\n📱 *${session.appName}*\n📂 ${session.category}\n\nReply *build* to start.`
        ]
      };
      break;
    }

    case 'building': {
      if (msg === 'cancel') {
        session.state = 'confirming';
        response = { replies: ['Cancelled. Say *build* to try again or describe a new idea.'] };
        break;
      }
      response = { replies: ["⏳ Still building! I'll message you when it's ready."] };
      break;
    }

    case 'editing': {
      if (msg === 'new' || msg === 'new app' || msg === 'start over') {
        session.state = 'awaiting_prompt';
        session.screens = undefined;
        session.jobId = undefined;
        session.appName = undefined;
        session.prompt = undefined;
        response = { replies: ["Starting fresh! 🆕\n\nDescribe your new app idea:"] };
        break;
      }

      if (msg === 'link' || msg === 'preview') {
        const url = `${BASE_URL}/app/${session.jobId}`;
        response = { replies: [`🌐 Your app: ${url}`] };
        break;
      }

      if (msg === 'apk') {
        response = { replies: ["💎 APK export is a Pro feature!\nhttps://appforge.dev/pricing"] };
        break;
      }

      // Edit flow
      session.state = 'building';
      const editResult = await editScreen(session, message);
      session.state = 'editing';

      if (editResult.success) {
        const url = `${BASE_URL}/app/${session.jobId}`;
        response = {
          replies: [
            "✅ Updated! Check it out:\n" +
            `🌐 ${url}\n\n` +
            "Want more changes? Just tell me, or say *new app* to start fresh."
          ]
        };
      } else {
        response = { replies: ["❌ Edit failed. Try a different request, or say *new app* to start over."] };
      }
      break;
    }

    default:
      session.state = 'idle';
      response = { replies: ["Something went wrong. Let's start over — send me your app idea!"] };
  }

  // Prepend any pending background messages
  if (extraReplies.length > 0) {
    response.replies = [...extraReplies, ...response.replies];
  }

  return response;
}

// ─── EXPRESS ROUTE SETUP ─────────────────────────────────────────────────────
import { Router } from 'express';

export function createWhatsAppRoutes(): Router {
  const router = Router();

  // Webhook: receive messages
  router.post('/webhook', async (req, res) => {
    try {
      const { phone, message, messageId } = req.body;
      if (!phone || !message) {
        return res.status(400).json({ success: false, message: 'Missing phone or message' });
      }
      const result = await handleWhatsAppMessage(phone, message);
      res.json({ success: true, ...result });
    } catch (err: any) {
      console.error('[WhatsApp Webhook Error]', err.message);
      res.status(500).json({ success: false, message: err.message, replies: ['Something went wrong. Try again!'] });
    }
  });

  // Debug: get session
  router.get('/session/:phone', (req, res) => {
    const session = getSession(req.params.phone);
    if (!session) return res.status(404).json({ success: false, message: 'No session found' });
    res.json({ success: true, session });
  });

  // List all sessions (admin/debug)
  router.get('/sessions', (_req, res) => {
    const all = Array.from(sessions.values()).map(s => ({
      phone: s.phone,
      state: s.state,
      appName: s.appName,
      appsBuilt: s.appsBuilt,
      lastActivity: s.lastActivity,
    }));
    res.json({ success: true, sessions: all, total: all.length });
  });

  return router;
}
