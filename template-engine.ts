import { readFileSync } from 'fs';
import { join } from 'path';

const TEMPLATES_DIR = join(import.meta.dirname || __dirname, 'templates');

// ─── LOAD TEMPLATE DATA ─────────────────────────────────────────────────────
function loadJSON(path: string): any {
  return JSON.parse(readFileSync(join(TEMPLATES_DIR, path), 'utf-8'));
}

function loadComponent(name: string): string {
  return readFileSync(join(TEMPLATES_DIR, 'components', `${name}.html`), 'utf-8');
}

const themes = loadJSON('tokens/themes.json');
const icons = loadJSON('tokens/icons.json');
const categories = loadJSON('data/categories.json');
const blueprints = loadJSON('blueprints/screen-types.json');

// ─── CATEGORY DETECTION ─────────────────────────────────────────────────────
export function detectCategory(prompt: string): string {
  const p = prompt.toLowerCase();
  let bestMatch = 'productivity';
  let bestScore = 0;

  for (const [cat, config] of Object.entries(categories) as [string, any][]) {
    const score = config.keywords.filter((k: string) => p.includes(k)).length;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = cat;
    }
  }
  return bestMatch;
}

// ─── THEME SELECTION ────────────────────────────────────────────────────────
// Rotate themes so consecutive apps in same category look different
const themeCounters = new Map<string, number>();

export function selectTheme(category: string): string {
  const catConfig = categories[category];
  const availableThemes = catConfig?.themes || ['indigo'];
  const counter = themeCounters.get(category) || 0;
  const theme = availableThemes[counter % availableThemes.length];
  themeCounters.set(category, counter + 1);
  return theme;
}

// ─── BLUEPRINT SELECTION ────────────────────────────────────────────────────
export function selectBlueprints(category: string, screenNames: string[]): string[] {
  const catConfig = categories[category];
  if (!catConfig) return screenNames.map(() => 'dashboard-a');

  return screenNames.map((name, i) => {
    // Map screen position to type
    const n = name.toLowerCase();
    
    // Priority-based matching: form > detail > profile > list > dashboard
    // Check form-like screens first
    if (n.includes('new') || n.includes('add') || n.includes('create') || n.includes('edit') || n.includes('form')) return 'form-a';
    // Check profile
    if (n.includes('profile') || n.includes('settings') || n.includes('account')) return 'profile-a';
    // Check detail
    if (n.includes('detail') || n.includes('view') || n.includes('info') || n.includes('about')) return 'detail-a';
    // Check dashboard (first screen or explicit)
    if (i === 0 || n.includes('dashboard') || n.includes('home') || n.includes('overview')) {
      const dashboards = ['dashboard-a', 'dashboard-b', 'dashboard-c'];
      return dashboards[i % dashboards.length];
    }
    // Everything else is a list
    const lists = ['list-a', 'list-b'];
    return lists[i % lists.length];
  });
}

// ─── ICON RESOLVER ──────────────────────────────────────────────────────────
export function getIconSVG(iconName: string): string {
  return icons[iconName] || icons['home'];
}

// ─── TEMPLATE ASSEMBLY ──────────────────────────────────────────────────────
export function assembleScreen(
  blueprintId: string,
  themeName: string,
  placeholders: Record<string, string>,
  navItems: string[],
  navIcons: string[],
  activeNavIndex: number
): string {
  const blueprint = blueprints[blueprintId];
  if (!blueprint) throw new Error(`Unknown blueprint: ${blueprintId}`);
  
  const theme = themes[themeName];
  if (!theme) throw new Error(`Unknown theme: ${themeName}`);

  // Load base wrapper
  let html = loadComponent('base-wrapper');

  // Assemble content from blueprint components
  const contentComponents = blueprint.components.filter(
    (c: string) => c !== 'status-bar' && !c.startsWith('nav-')
  );
  const navComponent = blueprint.components.find((c: string) => c.startsWith('nav-'));

  // Load and join content components
  const contentHtml = contentComponents
    .map((compName: string) => {
      try { return loadComponent(compName); }
      catch { return `<!-- Missing component: ${compName} -->`; }
    })
    .join('\n\n');

  // Load status bar and nav
  const statusBarHtml = loadComponent('status-bar');
  const navHtml = navComponent ? loadComponent(navComponent) : loadComponent('nav-bottom-5');

  // Inject into base wrapper
  html = html.replace('{{STATUS_BAR}}', statusBarHtml);
  html = html.replace('{{CONTENT}}', contentHtml);
  html = html.replace('{{BOTTOM_NAV}}', navHtml);

  // Replace theme tokens
  for (const [key, value] of Object.entries(theme)) {
    html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value as string);
  }

  // Replace nav items
  navItems.forEach((item, i) => {
    html = html.replace(new RegExp(`\\{\\{nav${i + 1}\\}\\}`, 'g'), item);
    const iconPath = getIconSVG(navIcons[i] || 'home');
    html = html.replace(new RegExp(`\\{\\{nav${i + 1}Icon\\}\\}`, 'g'), iconPath);
  });

  // Set active nav color
  html = html.replace(/\{\{navActiveColor\}\}/g, theme.navActiveColor || theme.primary1);

  // Replace all custom placeholders
  for (const [key, value] of Object.entries(placeholders)) {
    html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }

  // Clean up any remaining unreplaced tokens (set to empty)
  html = html.replace(/\{\{[^}]+\}\}/g, '');

  return html;
}

// ─── FUNCTIONAL SCREEN ASSEMBLY (Phase 2: apps that actually work) ────────
/**
 * Wraps a screen's HTML with the AppForge runtime + data bindings.
 * This transforms static mockups into functional apps.
 */
export function assembleFullApp(
  screens: { name: string; html: string; blueprint: string }[],
  config: {
    appId: string;
    appName: string;
    apiUrl: string;
    collections: { name: string; fields: { name: string; type: string; required?: boolean }[] }[];
    authEnabled: boolean;
    navItems: string[];
    navIcons: string[];
  }
): string {
  const { appId, appName, apiUrl, authEnabled } = config;

  // Build auth screens if enabled
  let authScreensHtml = '';
  if (authEnabled) {
    try {
      const loginHtml = loadComponent('auth-login');
      const signupHtml = loadComponent('auth-signup');
      const forgotHtml = loadComponent('auth-forgot');
      // Replace primary color tokens
      const replaceColors = (h: string) => h.replace(/\{\{primary1\}\}/g, '#6366f1').replace(/\{\{primary2\}\}/g, '#818cf8').replace(/\{\{appName\}\}/g, appName);
      authScreensHtml = `
  <div data-screen="login" style="display:none;">${replaceColors(loginHtml)}</div>
  <div data-screen="signup" style="display:none;">${replaceColors(signupHtml)}</div>
  <div data-screen="forgot-password" style="display:none;">${replaceColors(forgotHtml)}</div>`;
    } catch {}
  }

  // Extract body content from full HTML screens (strip <html>, <head>, <body> wrappers)
  function extractBody(html: string): string {
    // If it has a <body>, extract just the body content
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) return bodyMatch[1].trim();
    // If it has the base-wrapper structure, extract the main content div
    const mainMatch = html.match(/<div class="max-w-\[430px\][^"]*">([\s\S]*)<\/div>\s*<\/body>/i);
    if (mainMatch) return mainMatch[1].trim();
    return html; // Already content-only
  }

  // Build screen HTML with data-screen attributes
  const screensHtml = screens.map((s, i) => {
    const content = extractBody(s.html);
    return `<div data-screen="${s.name}" style="${i > 0 ? 'display:none;' : ''}">${content}</div>`;
  }).join('\n');

  // Auth guard script
  const authScript = authEnabled ? `
    // Auth guard: protect non-public screens
    AF.on('navigate', function(screen) {
      var publicScreens = ['login', 'signup', 'forgot-password', '${screens[0]?.name || 'home'}'];
      if (!AF.auth.isLoggedIn && publicScreens.indexOf(screen) === -1) {
        AF.navigate('login');
        AF.toast('Please sign in to continue', 'info');
      }
    });
    // Update auth-bound UI elements on login/logout
    AF.on('auth:changed', function(user) {
      document.querySelectorAll('[data-auth-name]').forEach(function(el) { el.textContent = user ? (user.display_name || user.email) : 'Guest'; });
      document.querySelectorAll('[data-auth-email]').forEach(function(el) { el.textContent = user ? user.email : ''; });
      document.querySelectorAll('[data-auth-only]').forEach(function(el) { el.style.display = user ? '' : 'none'; });
      document.querySelectorAll('[data-guest-only]').forEach(function(el) { el.style.display = user ? 'none' : ''; });
      document.querySelectorAll('[data-admin-only]').forEach(function(el) { el.style.display = (user && user.role === 'admin') ? '' : 'none'; });
    });
    // Trigger initial auth state
    if (AF.auth.user) AF.emit('auth:changed', AF.auth.user);` : '';

  // Add AppForge branding for free tier
  const brandingBanner = `
  <div id="af-branding" style="position:fixed;bottom:0;left:0;right:0;z-index:9999;background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:8px 16px;display:flex;align-items:center;justify-content:center;gap:8px;font-family:Inter,sans-serif;">
    <span style="color:white;font-size:12px;opacity:0.9;">Built with</span>
    <a href="https://appforge.dev" target="_blank" style="color:white;font-size:13px;font-weight:600;text-decoration:none;">⚡ AppForge</a>
    <span style="color:white;font-size:11px;opacity:0.6;margin-left:8px;">|</span>
    <a href="https://appforge.dev/pricing" target="_blank" style="color:white;font-size:11px;opacity:0.7;text-decoration:none;">Remove branding →</a>
  </div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${appName}</title>
  <link rel="manifest" href="/manifest.json">
  <meta name="theme-color" content="#050507">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; background: #050507; color: #fff; min-height: 100vh; overflow-x: hidden; }
    :root { --af-primary: #6366f1; --af-primary-light: #818cf8; }
    input, textarea, select { font-family: inherit; color: #fff; }
    button { cursor: pointer; font-family: inherit; }
    .glass-input { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; color: #fff; outline: none; transition: border-color 0.2s; }
    .glass-input:focus { border-color: var(--af-primary); }
    .af-loading { display: flex; align-items: center; justify-content: center; padding: 40px; }
    .af-loading::after { content: ''; width: 24px; height: 24px; border: 2px solid rgba(255,255,255,0.2); border-top-color: var(--af-primary); border-radius: 50%; animation: af-spin 0.6s linear infinite; }
    @keyframes af-spin { to { transform: rotate(360deg); } }
    .space-y-4 > * + * { margin-top: 16px; }
    .space-y-3 > * + * { margin-top: 12px; }
  </style>
</head>
<body>
  ${screensHtml}
  ${authScreensHtml}

  ${brandingBanner}
  <script src="${apiUrl}/runtime/appforge-runtime.js"></script>
  <script>
    // AF.init triggers auto-binding of all data-af-* elements
    AF.init({ apiUrl: '${apiUrl}', appId: '${appId}', debug: false });
    ${authScript}
    // Auto-refresh lists when data changes
    AF.on('data:changed', function() {
      document.querySelectorAll('[data-list][data-collection]').forEach(function(el) {
        AF.lists.bind(el, el.dataset.collection);
      });
    });
  </script>
</body>
</html>`;
}

// ─── GPT-4o PERSONALIZATION PROMPT ──────────────────────────────────────────
export function getPersonalizationPrompt(
  category: string,
  appName: string,
  appDescription: string,
  screenName: string,
  blueprintId: string,
  themeName: string
): { system: string; user: string } {
  const blueprint = blueprints[blueprintId];
  const contentComponents = blueprint?.components?.filter(
    (c: string) => c !== 'status-bar' && !c.startsWith('nav-')
  ) || [];

  // Collect all {{placeholder}} tokens from the components
  const allTokens = new Set<string>();
  for (const compName of contentComponents) {
    try {
      const compHtml = loadComponent(compName);
      const matches = compHtml.match(/\{\{(\w+)\}\}/g) || [];
      matches.forEach(m => {
        const token = m.replace(/\{\{|\}\}/g, '');
        // Skip theme/nav tokens
        if (!token.startsWith('nav') && !token.startsWith('primary') && !token.startsWith('accent') && token !== 'navActiveColor') {
          allTokens.add(token);
        }
      });
    } catch {}
  }

  const tokenList = Array.from(allTokens);

  // Category-specific hints for better content
  const categoryHints: Record<string, string> = {
    fitness: 'Use real exercise names (Push-ups, HIIT, Deadlifts), calories burned, sets/reps, muscle groups, workout durations. Stats: streak days, calories, workouts completed.',
    finance: 'Use real transaction types (Groceries, Netflix, Salary), dollar amounts, bank names, budget categories. Stats: savings rate, monthly spending, net worth.',
    food: 'Use real dish names (Pad Thai, Caesar Salad), cooking times, difficulty levels, ingredients count, cuisine types. Stats: recipes saved, meals cooked, favorites.',
    productivity: 'Use real task names (Design mockups, Review PR, Team standup), priority levels, project names, deadlines. Stats: tasks completed, streak, productivity score.',
    social: 'Use realistic usernames (@sarah_designs), post captions, follower counts, engagement metrics. Stats: posts, followers, following.',
    education: 'Use real course names (Intro to Python, Calculus II), lesson durations, quiz scores, certificates. Stats: courses enrolled, hours learned, certificates.',
    ecommerce: 'Use real product names (Nike Air Max 90, MacBook Pro), prices, ratings, review counts, discount percentages. Stats: orders, wishlist items, rewards points.',
    travel: 'Use real destinations (Bali, Tokyo, Barcelona), flight prices, hotel ratings, trip durations. Stats: trips planned, countries visited, miles traveled.',
    music: 'Use real-sounding song/artist names, album art descriptions, playlist durations, play counts. Stats: songs played, playlists, listening hours.',
    lifestyle: 'Use real habit/activity names (Meditation, Journaling, Reading), streak days, mood ratings. Stats: habits tracked, best streak, wellness score.',
    quiz: 'Use real quiz categories (Science, History, Pop Culture), difficulty levels, scores, time limits. Stats: quizzes taken, correct answers, high scores.',
    portfolio: 'Use real project names (E-commerce Redesign, Brand Identity), client names, tools used. Stats: projects completed, clients, years experience.',
    health: 'Use real medical terms (Blood Pressure, BMI), doctor specialties, appointment types, medication names. Stats: appointments, prescriptions, health score.',
    realestate: 'Use real property types (2BR Apartment, Luxury Villa), prices, square footage, neighborhoods. Stats: listings viewed, saved properties, tours scheduled.',
    news: 'Use realistic headlines, publication names, reading times, topic categories. Stats: articles read, bookmarks, reading streak.',
    dating: 'Use realistic profile descriptions, interests, compatibility percentages, distance. Stats: matches, conversations, profile views.',
  };

  const hint = categoryHints[category] || 'Use realistic, domain-specific data.';

  const system = `You are a mobile app content generator. Given an app concept, generate realistic, contextual sample data for UI placeholders.

RULES:
- Return ONLY valid JSON — no markdown, no explanation
- Every value must be SPECIFIC to this exact app (not generic placeholder text)
- ${hint}
- Names should be real-sounding (not "John Doe" or "User 1")
- Numbers should be realistic for the domain
- Descriptions should be 1-2 sentences max
- For icon tokens, choose from this list ONLY: ${Object.keys(icons).join(', ')}
- For badge/meta values, use short contextual text ("+320 cal", "4.8★", "$24.99", "2h ago")
- ringOffset should be a number 0-264 (264 = empty, 0 = full). Calculate from ringPercent: offset = 264 - (percent/100 * 264)
- Bar chart percentages (bar1-bar7): values between 20-95
- Progress bar percentages (bar1Pct-bar4Pct): values between 15-95
- Donut segments: seg1Dash + seg2Dash + seg3Dash should total ~200 (out of 239 circumference). seg12Dash = seg1Dash + seg2Dash
- Make item titles, subtitles, and badges feel like REAL app data, not lorem ipsum`;

  const user = `App: "${appName}"
Description: ${appDescription}
Category: ${category}
Screen: "${screenName}"
Blueprint: ${blueprintId} (components: ${contentComponents.join(', ')})
Theme: ${themeName}

Generate JSON with ALL these keys (every single one must be present):
${JSON.stringify(tokenList)}

Return ONLY the JSON object.`;

  return { system, user };
}

// ─── FULL SCREEN GENERATION ─────────────────────────────────────────────────
export interface TemplateScreenResult {
  name: string;
  html: string;
  blueprint: string;
}

export {
  themes,
  icons,
  categories,
  blueprints,
  TEMPLATES_DIR,
};
