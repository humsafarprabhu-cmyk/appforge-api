import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'crypto';
import sdkRoutesV2 from './sdk-routes-v2.ts';
import sdkAdminRoutes from './sdk-admin-routes.ts';
import { provisionApp } from './provisioning.ts';
import {
  detectCategory as detectCat,
  selectTheme,
  selectBlueprints,
  assembleScreen,
  getPersonalizationPrompt,
  categories,
} from './template-engine.ts';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// SDK routes v2 (hardened: validation, rate limiting, roles, proper errors)
app.use('/sdk', sdkRoutesV2);
// Admin SDK routes (admin-only: stats, user management, data management, export)
app.use('/sdk/admin', sdkAdminRoutes);

// Serve the runtime JS for generated apps
import { readFileSync } from 'fs';
import { join } from 'path';
const runtimePath = join(import.meta.dirname || __dirname, 'runtime/appforge-runtime.js');
app.get('/runtime/appforge-runtime.js', (_req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.send(readFileSync(runtimePath, 'utf-8'));
});

// ─── AI PROVIDERS ────────────────────────────────────────────────────────────
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Provider selection: OpenAI primary (Anthropic credits exhausted)
type Provider = 'openai' | 'anthropic';
let activeProvider: Provider = process.env.OPENAI_API_KEY ? 'openai' : 'anthropic';
const OPENAI_MODEL = 'gpt-4o';
const ANTHROPIC_MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 8000;

// Unified AI call with automatic fallback
async function aiChat(system: string, userMessage: string, maxTokens: number = MAX_TOKENS): Promise<string> {
  const providers: Provider[] = activeProvider === 'openai' ? ['openai', 'anthropic'] : ['anthropic', 'openai'];
  
  for (const provider of providers) {
    try {
      if (provider === 'openai') {
        const res = await openai.chat.completions.create({
          model: OPENAI_MODEL,
          max_tokens: maxTokens,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: userMessage },
          ],
        });
        return res.choices[0]?.message?.content?.trim() || '';
      } else {
        const res = await anthropic.messages.create({
          model: ANTHROPIC_MODEL,
          max_tokens: maxTokens,
          system,
          messages: [{ role: 'user', content: userMessage }],
        });
        const content = res.content[0];
        if (content.type !== 'text') throw new Error('Unexpected response type');
        return content.text.trim();
      }
    } catch (err: any) {
      console.error(`[AppForge] ❌ ${provider} failed: ${err.message?.substring(0, 100)}`);
      if (provider === providers[providers.length - 1]) throw err; // last provider, rethrow
      console.log(`[AppForge] 🔄 Falling back to ${providers[1]}...`);
    }
  }
  throw new Error('All AI providers failed');
}

const MODEL = activeProvider === 'openai' ? OPENAI_MODEL : ANTHROPIC_MODEL;

// ─── JOB STORE (in-memory, swap for Redis/DB in production) ──────────────────
interface Job {
  id: string;
  status: 'planning' | 'generating' | 'complete' | 'error';
  appName: string;
  description: string;
  plan: { name: string; purpose: string }[];
  screens: { name: string; html: string }[];
  currentScreen: number;
  totalScreens: number;
  error?: string;
  createdAt: number;
}

const jobs = new Map<string, Job>();

// Clean old jobs every 10 min
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000; // 30 min
  for (const [id, job] of jobs) {
    if (job.createdAt < cutoff) jobs.delete(id);
  }
}, 10 * 60 * 1000);

// ─── PROMPTS ─────────────────────────────────────────────────────────────────
const ONBOARDING_PROMPT = `You are AppForge AI, an expert mobile app architect. The user just described an app idea. Your job is to ask 3-4 smart, specific questions to understand their vision before building.

Rules:
- Acknowledge their idea enthusiastically in 1-2 sentences
- Ask exactly 3-4 questions that will dramatically improve the generated app
- Questions should cover: key features, target audience, data needs, and visual style
- Keep questions concise and specific to their app idea
- Do NOT ask generic questions — tailor them to the specific app type
- For checkbox/radio types, provide 4-6 relevant options specific to the app idea

Respond ONLY with valid JSON:
{
  "type": "questions",
  "appName": "Suggested App Name",
  "description": "Brief exciting description",
  "acknowledgment": "Your enthusiastic 1-2 sentence acknowledgment",
  "questions": [
    { "id": "q1", "text": "What features are most important?", "type": "checkbox", "options": ["Option1", "Option2", "Option3", "Option4", "Option5"] },
    { "id": "q2", "text": "Who is your target audience?", "type": "radio", "options": ["Audience1", "Audience2", "Audience3", "Audience4"] },
    { "id": "q3", "text": "What visual style?", "type": "radio", "options": ["Minimal & clean", "Colorful & playful", "Dark & professional", "Glassmorphism"] },
    { "id": "q4", "text": "Any specific requirements?", "type": "text", "placeholder": "E.g., offline support, specific integrations..." }
  ]
}`;

// Old getGenerationPrompt and detectCategory removed — using template-engine.ts

// ─── BACKGROUND GENERATION (Template-based) ─────────────────────────────────
async function generateInBackground(job: Job, prompt: string, appId: string, appName?: string, currentScreens?: { name: string; html: string }[]) {
  try {
    // STEP 1: Plan (still use AI for planning — it's cheap and needs to be contextual)
    job.status = 'planning';
    const category = detectCat(prompt);
    const catConfig = (categories as any)[category];

    let planJson = await aiChat(
      'You are AppForge AI. Generate a comprehensive app blueprint. Return ONLY valid JSON, no markdown.',
      `Plan a mobile app: ${prompt}\nCategory: ${category}\n\nReturn JSON:\n{
  "appName": "Name",
  "description": "Brief desc",
  "dataModel": {
    "collections": [
      {
        "name": "collection_name",
        "fields": [
          { "name": "field_name", "type": "text|number|boolean|date|json", "required": true }
        ]
      }
    ]
  },
  "auth": {
    "enabled": true,
    "providers": ["email"],
    "requireAuth": false,
    "profileFields": ["display_name", "avatar"]
  },
  "screens": [
    { "name": "ScreenName", "purpose": "What this screen shows/does" }
  ]
}\n\nRules:\n- Exactly 5 screens\n- Use these screen names as reference: ${catConfig?.defaultScreens?.join(', ') || 'Dashboard, List, Detail, Create, Profile'}\n- Context-aware names specific to this app idea\n- Data model: 2-5 collections relevant to the app`,
      2000
    );
    const planMatch = planJson.match(/\{[\s\S]*\}/);
    if (planMatch) planJson = planMatch[0];
    const plan = JSON.parse(planJson);

    job.appName = plan.appName || appName || 'MyApp';
    job.description = plan.description || '';
    job.plan = plan.screens;
    job.totalScreens = plan.screens.length;
    job.status = 'generating';

    (job as any).blueprint = {
      dataModel: plan.dataModel || { collections: [] },
      auth: plan.auth || { enabled: false, providers: ['email'] },
    };

    // STEP 2: Select theme + blueprints
    const themeName = selectTheme(category);
    const screenNames = plan.screens.map((s: any) => s.name);
    const screenBlueprints = selectBlueprints(category, screenNames);
    const navItems = catConfig?.navItems || screenNames;
    const navIcons = catConfig?.navIcons || ['home', 'search', 'plus', 'bar-chart', 'user'];

    (job as any).screenBlueprints = screenBlueprints;
    (job as any).appId = appId;

    console.log(`[AppForge] 📋 Plan: ${screenNames.join(', ')}`);
    console.log(`[AppForge] 🎨 Theme: ${themeName} | Category: ${category}`);
    console.log(`[AppForge] 📐 Blueprints: ${screenBlueprints.join(', ')}`);

    // STEP 3: Generate each screen using templates + GPT-4o personalization
    for (let i = 0; i < plan.screens.length; i++) {
      const screen = plan.screens[i];
      const bpId = screenBlueprints[i];
      job.currentScreen = i + 1;

      console.log(`[AppForge] 🔨 Building ${screen.name} (${bpId})...`);

      // Get personalization prompt
      const { system, user } = getPersonalizationPrompt(
        category, job.appName, job.description, screen.name, bpId, themeName
      );

      // Ask GPT-4o to fill placeholders (cheap, fast, ~500 tokens)
      let placeholders: Record<string, string> = {};
      try {
        let jsonStr = await aiChat(system, user, 2000);
        // Clean markdown wrapping
        if (jsonStr.startsWith('```')) {
          jsonStr = jsonStr.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
        }
        const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (jsonMatch) jsonStr = jsonMatch[0];
        placeholders = JSON.parse(jsonStr);
      } catch (err: any) {
        console.error(`[AppForge] ⚠️ Personalization failed for ${screen.name}: ${err.message}`);
        // Use fallback generic data
        placeholders = getGenericPlaceholders(category, screen.name, job.appName);
      }

      // Assemble screen from template
      let screenHtml = assembleScreen(
        bpId, themeName, placeholders, navItems, navIcons, i
      );

      // Post-process: inject data-binding attributes for functional screens
      const blueprint = (job as any).blueprint;
      if (blueprint?.dataModel?.collections?.length > 0) {
        const collections = blueprint.dataModel.collections;
        // For form screens: add data-af-form and data-collection
        if (bpId.startsWith('form')) {
          const col = collections.find((c: any) => 
            screen.name.toLowerCase().includes(c.name.toLowerCase()) ||
            c.name.toLowerCase().includes(screen.name.toLowerCase().replace(/new|add|create|edit/gi, '').trim())
          ) || collections[0];
          if (col) {
            screenHtml = screenHtml.replace(/<form/i, `<form data-af-form data-collection="${col.name}"`);
            // Add name attributes to inputs if missing
            col.fields?.forEach((f: any, fi: number) => {
              const fieldNum = fi + 1;
              screenHtml = screenHtml.replace(
                new RegExp(`(placeholder="${placeholders['field' + fieldNum + 'Placeholder'] || ''}"[^>]*)(?!name=)`, 'i'),
                `$1 name="${f.name}"`
              );
            });
          }
        }
        // For list screens: add data-list and data-collection to the list container
        if (bpId.startsWith('list')) {
          const col = collections.find((c: any) =>
            screen.name.toLowerCase().includes(c.name.toLowerCase()) ||
            c.name.toLowerCase().includes(screen.name.toLowerCase())
          ) || collections[0];
          if (col) {
            // Add data-list to the first space-y-3 div (the list items container)
            screenHtml = screenHtml.replace(
              /(<div class="space-y-3">)/i,
              `<div class="space-y-3" data-list data-collection="${col.name}">`
            ).replace('<div class="space-y-3" data-list', '<div data-list');
          }
        }
      }

      job.screens.push({ name: screen.name, html: screenHtml });
      console.log(`[AppForge] ✅ Screen ${i + 1}/${plan.screens.length}: ${screen.name} (${screenHtml.length} chars)`);

      // Small delay between screens
      if (i < plan.screens.length - 1) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    // STEP 4: Provision backend
    if ((job as any).blueprint && appId && appId !== 'new-app') {
      try {
        await provisionApp(appId, (job as any).blueprint);
      } catch (provErr: any) {
        console.error(`[AppForge] ⚠️ Provisioning failed (non-fatal):`, provErr.message);
      }
    }

    job.status = 'complete';
    console.log(`[AppForge] 🎉 Job ${job.id}: All ${job.screens.length} screens generated!`);
  } catch (error: any) {
    job.status = 'error';
    job.error = error.message;
    console.error(`[AppForge] ❌ Job ${job.id} failed:`, error.message);
  }
}

// ─── FALLBACK GENERIC PLACEHOLDERS ──────────────────────────────────────────
function getGenericPlaceholders(category: string, screenName: string, appName: string): Record<string, string> {
  return {
    appName, screenName,
    greetingSubtext: 'Good morning',
    userName: 'Alex Johnson',
    userInitials: 'AJ',
    userEmail: 'alex@example.com',
    pageTitle: screenName,
    searchPlaceholder: `Search ${screenName.toLowerCase()}...`,
    heroTitle: appName,
    heroSubtext: 'Welcome back',
    heroDescription: `Your personal ${category} companion`,
    filter1: 'All', filter2: 'Recent', filter3: 'Popular', filter4: 'Favorites',
    ringPercent: '72', ringLabel: 'complete', ringOffset: '74',
    metric1Label: 'Total', metric1Value: '248', metric1Target: '300',
    metric2Label: 'Active', metric2Value: '186', metric2Target: '250',
    metric3Label: 'Streak', metric3Value: '12', metric3Target: '30',
    stat1Value: '248', stat1Label: 'Total', stat1Icon: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/>',
    stat2Value: '1.2k', stat2Label: 'Points', stat2Icon: '<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>',
    stat3Value: '4.8', stat3Label: 'Rating', stat3Icon: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    chartTitle: 'Weekly Overview', chartPeriod: 'This Week',
    bar1: '35', bar2: '55', bar3: '80', bar4: '65', bar5: '95', bar6: '70', bar7: '20',
    listTitle: 'Recent Activity',
    item1Title: 'Morning Session', item1Subtitle: '8:00 AM · 45 min', item1Badge: '+120', item1Meta: 'pts', item1Icon: '<path d="M18 20V10M12 20V4M6 20v-6"/>',
    item2Title: 'Afternoon Task', item2Subtitle: '2:30 PM · 30 min', item2Badge: '+85', item2Meta: 'pts', item2Icon: '<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>',
    item3Title: 'Evening Review', item3Subtitle: '7:00 PM · 20 min', item3Badge: 'Done', item3Icon: '<polyline points="20 6 9 17 4 12"/>',
    item4Title: 'Night Planning', item4Subtitle: '9:00 PM · 15 min', item4Badge: '+50', item4Meta: 'pts', item4Icon: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    detailBadge: 'Featured', detailTitle: screenName, detailSubtitle: `Part of ${appName}`,
    detailStat1Value: '4.8', detailStat1Label: 'Rating',
    detailStat2Value: '2.4k', detailStat2Label: 'Users',
    detailStat3Value: '45m', detailStat3Label: 'Avg Time',
    detailDescTitle: 'About', detailDescription: `This is a detailed view within ${appName}. Here you can find comprehensive information, statistics, and actions related to this item.`,
    detailCTA: 'Get Started',
    field1Label: 'Title', field1Placeholder: 'Enter a title...', field1Value: '',
    field2Label: 'Category', field2Placeholder: 'Select category...', field2Value: '',
    field3Label: 'Description', field3Placeholder: 'Add a description...', field3Value: '',
    field4Label: 'Tags',
    tag1: 'Important', tag2: 'Work', tag3: 'Personal', tag4: 'Urgent', tag5: 'Later',
    toggleLabel: 'Enable notifications', toggleDescription: 'Get reminded about this item',
    submitLabel: 'Save',
    profileStat1Value: '248', profileStat1Label: 'Items',
    profileStat2Value: '12', profileStat2Label: 'Streak',
    profileStat3Value: '4.8', profileStat3Label: 'Rating',
    setting1: 'Account Settings', setting2: 'Notifications', setting3: 'Privacy & Security', setting4: 'Help & Support',
    // Scroll pills
    pill1Label: 'Total', pill1Value: '2,481', pill1Change: '+12%', pill1Icon: '<path d="M18 20V10M12 20V4M6 20v-6"/>',
    pill2Label: 'Active', pill2Value: '186', pill2Change: '+8%', pill2Icon: '<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>',
    pill3Label: 'Pending', pill3Value: '24', pill3Change: '-3%', pill3Icon: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    // Progress bars
    bar1Label: 'Category A', bar1Value: '78%', bar1Pct: '78',
    bar2Label: 'Category B', bar2Value: '62%', bar2Pct: '62',
    bar3Label: 'Category C', bar3Value: '45%', bar3Pct: '45',
    bar4Label: 'Category D', bar4Value: '31%', bar4Pct: '31',
    // Donut
    donutCenter: '$2.4k', donutCenterLabel: 'total',
    seg1Dash: '95', seg2Dash: '60', seg3Dash: '45', seg12Dash: '155',
    legend1Label: 'Primary', legend1Value: '40%',
    legend2Label: 'Secondary', legend2Value: '25%',
    legend3Label: 'Tertiary', legend3Value: '19%',
    legend4Label: 'Other', legend4Value: '16%',
    // Horizontal cards
    card1Title: 'Featured Item', card1Subtitle: '12 activities', card1Badge: 'Popular', card1Icon: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    card2Title: 'Trending Now', card2Subtitle: '8 activities', card2Badge: 'New', card2Icon: '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
    card3Title: 'Top Rated', card3Subtitle: '15 activities', card3Badge: '4.9★', card3Icon: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/>',
  };
}

// ─── ROUTES ──────────────────────────────────────────────────────────────────

app.get('/api/generate', (_req, res) => {
  res.json({ message: 'AppForge AI API v4.0 — Job Queue', model: MODEL, activeJobs: jobs.size });
});

// Start generation or onboarding
app.post('/api/generate', async (req, res) => {
  try {
    const { prompt, appId, messages, currentScreens, appName, mode } = req.body;
    if (!prompt || !appId) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // ─── ONBOARDING (synchronous, fast) ────────────────────────────
    if (mode === 'onboarding') {
      let jsonStr = await aiChat(ONBOARDING_PROMPT, `App idea: ${prompt}`, 1500);
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) jsonStr = jsonMatch[0];
      const result = JSON.parse(jsonStr);

      const questions = (result.questions || []).map((q: any, i: number) => {
        if (typeof q === 'string') return { id: `q${i + 1}`, text: q, type: 'text', placeholder: 'Type your answer...' };
        return q;
      });

      return res.json({
        success: true,
        type: 'questions',
        appName: result.appName || 'MyApp',
        description: result.description || '',
        acknowledgment: result.acknowledgment || '',
        questions,
      });
    }

    // ─── GENERATION (async job) ────────────────────────────────────
    const jobId = randomUUID();
    const job: Job = {
      id: jobId,
      status: 'planning',
      appName: appName || 'MyApp',
      description: '',
      plan: [],
      screens: [],
      currentScreen: 0,
      totalScreens: 5,
      createdAt: Date.now(),
    };
    jobs.set(jobId, job);

    // Start generation in background
    generateInBackground(job, prompt, appId, appName, currentScreens);

    // Return immediately
    return res.json({
      success: true,
      type: 'job',
      jobId,
      message: 'Generation started',
    });
  } catch (error: any) {
    console.error('[AppForge] Error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Poll job status
app.get('/api/job/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ success: false, message: 'Job not found' });
  }

  res.json({
    success: true,
    jobId: job.id,
    status: job.status,
    appName: job.appName,
    description: job.description,
    currentScreen: job.currentScreen,
    totalScreens: job.totalScreens,
    screenNames: job.plan.map(s => s.name),
    completedScreens: job.screens.length,
    screens: job.screens, // Send screens as they complete (incrementally)
    blueprint: (job as any).blueprint || null,
    error: job.error,
  });
});

// ─── ADMIN PANEL ─────────────────────────────────────────────────────────────
const adminPanelPath = join(import.meta.dirname || __dirname, 'runtime/admin-panel.html');

app.get('/admin/:appId', (req, res) => {
  const { appId } = req.params;
  const apiUrl = `${req.protocol}://${req.get('host')}`;
  let html = readFileSync(adminPanelPath, 'utf-8')
    .replace(/\{\{appId\}\}/g, appId)
    .replace(/\{\{appName\}\}/g, req.query.name as string || 'My App')
    .replace(/\{\{apiUrl\}\}/g, apiUrl);
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

// ─── FULL FUNCTIONAL APP EXPORT ──────────────────────────────────────────────
import { assembleFullApp } from './template-engine.ts';

app.post('/api/export/functional-app', (req, res) => {
  try {
    const { appId, appName, screens, collections, authEnabled } = req.body;
    if (!appId || !screens) {
      return res.status(400).json({ success: false, message: 'Missing appId or screens' });
    }
    const apiUrl = `${req.protocol}://${req.get('host')}`;
    const html = assembleFullApp(
      screens.map((s: any) => ({ name: s.name, html: s.html, blueprint: s.blueprint || 'dashboard-a' })),
      {
        appId,
        appName: appName || 'My App',
        apiUrl,
        collections: collections || [],
        authEnabled: authEnabled !== false,
        navItems: screens.map((s: any) => s.name),
        navIcons: screens.map((_: any, i: number) => ['home', 'search', 'plus', 'bar-chart', 'user'][i] || 'home'),
      }
    );
    res.json({ success: true, html, adminUrl: `/admin/${appId}?name=${encodeURIComponent(appName || 'My App')}` });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── FULL APP ENDPOINT (generates + assembles functional app) ────────────
app.get('/app/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job || job.status !== 'complete') {
    return res.status(404).send('App not found or still generating');
  }
  const apiUrl = `${req.protocol}://${req.get('host')}`;
  const blueprint = (job as any).blueprint;
  const collections = blueprint?.dataModel?.collections || [];
  const html = assembleFullApp(
    job.screens.map((s, i) => ({
      name: s.name,
      html: s.html,
      blueprint: (job as any).screenBlueprints?.[i] || 'dashboard-a',
    })),
    {
      appId: (job as any).appId || 'demo',
      appName: job.appName,
      apiUrl,
      collections,
      authEnabled: blueprint?.auth?.enabled !== false,
      navItems: job.plan.map(s => s.name),
      navIcons: ['home', 'list', 'eye', 'plus', 'user'].slice(0, job.plan.length),
    }
  );
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

// ─── REACT NATIVE EXPORT ─────────────────────────────────────────────────────
import { assembleExpoProject, getProjectManifest } from './rn-assembler.ts';

app.post('/api/export/react-native', async (req, res) => {
  try {
    const { appName, description, category, screens, blueprint } = req.body;
    if (!appName || !screens || screens.length === 0) {
      return res.status(400).json({ success: false, message: 'Missing appName or screens' });
    }

    const slug = appName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const cat = category || 'productivity';
    
    // Detect features from blueprint
    const features = {
      auth: blueprint?.auth?.enabled ?? true,
      database: true,
      ads: false,
      payments: false,
      pushNotifications: false,
    };

    // Map theme from category
    const themeMap: Record<string, any> = {
      fitness: { primary: ['#6366f1', '#818cf8'], accent1: ['#22d3ee', '#06b6d4'], accent2: ['#34d399', '#10b981'], accent3: ['#f472b6', '#ec4899'] },
      finance: { primary: ['#3b82f6', '#60a5fa'], accent1: ['#34d399', '#10b981'], accent2: ['#fbbf24', '#f59e0b'], accent3: ['#f472b6', '#ec4899'] },
      food: { primary: ['#f97316', '#fb923c'], accent1: ['#ef4444', '#f87171'], accent2: ['#22c55e', '#4ade80'], accent3: ['#eab308', '#facc15'] },
      education: { primary: ['#8b5cf6', '#a78bfa'], accent1: ['#3b82f6', '#60a5fa'], accent2: ['#22d3ee', '#06b6d4'], accent3: ['#f472b6', '#ec4899'] },
      productivity: { primary: ['#6366f1', '#818cf8'], accent1: ['#22d3ee', '#06b6d4'], accent2: ['#34d399', '#10b981'], accent3: ['#f97316', '#fb923c'] },
      social: { primary: ['#ec4899', '#f472b6'], accent1: ['#8b5cf6', '#a78bfa'], accent2: ['#3b82f6', '#60a5fa'], accent3: ['#22d3ee', '#06b6d4'] },
      ecommerce: { primary: ['#f59e0b', '#fbbf24'], accent1: ['#ef4444', '#f87171'], accent2: ['#22c55e', '#4ade80'], accent3: ['#6366f1', '#818cf8'] },
    };

    const meta = {
      appName,
      appSlug: slug,
      description: description || '',
      category: cat,
      theme: themeMap[cat] || themeMap.productivity,
      screens: screens.map((s: any, i: number) => ({
        name: s.name || `Screen${i + 1}`,
        type: s.blueprint || (i === 0 ? 'dashboard-a' : i === screens.length - 1 ? 'profile-a' : 'list-b'),
      })),
      features,
      dbMode: 'managed' as const,
    };

    const files = assembleExpoProject(meta);
    
    res.json({
      success: true,
      files,
      manifest: Object.entries(files).map(([p, c]) => ({ path: p, size: c.length })),
      totalFiles: Object.keys(files).length,
    });
  } catch (err: any) {
    console.error('[RN Export]', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── START ───────────────────────────────────────────────────────────────────
const PORT = 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🦁 AppForge API v4.0 running on http://0.0.0.0:${PORT}`);
  console.log(`   Model: ${MODEL} | Max tokens: ${MAX_TOKENS}/screen`);
  console.log(`   Mode: Job Queue (poll-based, no streaming)`);
});
