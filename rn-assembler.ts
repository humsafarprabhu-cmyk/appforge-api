/**
 * React Native Assembler
 * Takes generated app metadata + screens → complete Expo project (ZIP)
 * 
 * Uses the rn-template/ as base, replaces {{placeholders}} with app-specific data
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMPLATE_DIR = path.join(__dirname, 'rn-template');

interface AppMeta {
  appName: string;
  appSlug: string;
  description: string;
  category: string;
  theme: {
    primary: [string, string];
    accent1: [string, string];
    accent2: [string, string];
    accent3: [string, string];
  };
  screens: { name: string; type: string }[];  // e.g. [{name: "Dashboard", type: "dashboard-a"}]
  features: {
    auth: boolean;
    database: boolean;
    ads: boolean;
    payments: boolean;
    pushNotifications: boolean;
  };
  dbMode: 'managed' | 'self-managed';
}

/**
 * Read all template files recursively
 */
function readTemplateFiles(dir: string, base: string = ''): Record<string, string> {
  const files: Record<string, string> = {};
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const relPath = base ? `${base}/${entry.name}` : entry.name;
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      Object.assign(files, readTemplateFiles(fullPath, relPath));
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') || entry.name.endsWith('.json')) {
      files[relPath] = fs.readFileSync(fullPath, 'utf-8');
    }
  }
  
  return files;
}

/**
 * Fill all {{placeholder}} values in screen templates with context-appropriate defaults.
 */
function fillScreenPlaceholders(content: string, screenName: string, appName: string, _screenType: string, meta?: AppMeta): string {
  // Find tab names for navigation
  const listTab = meta?.screens.find(s => s.type.includes('list'))?.name || 'List';
  const profileTab = meta?.screens.find(s => s.type.includes('profile'))?.name || 'Profile';
  const formScreen = meta?.screens.find(s => s.type.includes('form'));
  const detailScreen = meta?.screens.find(s => s.type.includes('detail'));
  const formScreenName = formScreen ? formScreen.name.replace(/\s/g, '') + 'Screen' : 'FormScreen';
  const detailScreenName = detailScreen ? detailScreen.name.replace(/\s/g, '') + 'Screen' : 'DetailScreen';
  const defaults: Record<string, string> = {
    appName: appName,
    pageTitle: screenName,
    listTab: listTab,
    profileTab: profileTab,
    formScreenName: formScreenName,
    detailScreenName: detailScreenName,
    greetingSubtext: 'Welcome back', userName: 'User', userInitials: 'U',
    ringPercent: '72', ringLabel: 'Progress',
    metric1Label: 'Total', metric1Value: '24', metric1Target: '30',
    metric2Label: 'Active', metric2Value: '18', metric2Target: '20',
    metric3Label: 'Done', metric3Value: '12', metric3Target: '15',
    stat1Value: '156', stat1Label: 'Items', stat2Value: '89%', stat2Label: 'Rate', stat3Value: '4.8', stat3Label: 'Score',
    chartTitle: 'Weekly Activity',
    bar1: '45', bar2: '62', bar3: '38', bar4: '71', bar5: '85', bar6: '53', bar7: '40',
    listTitle: 'Recent',
    item1Title: screenName, item1Subtitle: 'First item', item1Badge: 'New', item1Meta: 'Today',
    item2Title: 'Second', item2Subtitle: 'Second item', item2Badge: 'Active', item2Meta: 'Yesterday',
    item3Title: 'Third', item3Subtitle: 'Third item', item3Badge: 'Done',
    item4Title: 'Fourth', item4Subtitle: 'Fourth item', item4Badge: 'Pending', item4Meta: '2d ago',
    detailTitle: screenName, detailSubtitle: `Part of ${appName}`, detailBadge: 'Active',
    detailDescTitle: 'Description', detailDescription: `Details for this item.`,
    detailCTA: 'Get Started',
    detailStat1Label: 'Views', detailStat1Value: '1.2K',
    detailStat2Label: 'Likes', detailStat2Value: '342',
    detailStat3Label: 'Shares', detailStat3Value: '89',
    pageTitle: `New ${screenName.replace(/^New\s*/i, '')}`,
    formSubtitle: 'Fill in the details below',
    field1Label: 'Title', field1Placeholder: 'Enter title...',
    field2Label: 'Description', field2Placeholder: 'Enter description...',
    field3Label: 'Category', field3Placeholder: 'Select category...',
    field4Label: 'Notes', submitLabel: 'Save', collection: 'items',
    tag1: 'Important', tag2: 'Personal', tag3: 'Work', tag4: 'Ideas', tag5: 'Other',
    toggleLabel: 'Enable notifications', toggleDescription: 'Get updates about this item',
    searchPlaceholder: `Search ${appName.toLowerCase()}...`,
    filter1: 'All', filter2: 'Active', filter3: 'Done', filter4: 'Archived',
    userEmail: 'user@example.com',
    profileStat1Label: 'Items', profileStat1Value: '47',
    profileStat2Label: 'Streak', profileStat2Value: '12',
    profileStat3Label: 'Points', profileStat3Value: '890',
    setting1: 'Notifications', setting2: 'Dark Mode', setting3: 'Language', setting4: 'Privacy',
  };
  let result = content;
  for (const [key, value] of Object.entries(defaults)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  // Remaining placeholders → 0 (safe fallback for numeric contexts)
  result = result.replace(/\{\{[a-zA-Z0-9_]+\}\}/g, '0');
  return result;
}

/**
 * Replace global theme placeholders in all files
 */
function applyTheme(content: string, meta: AppMeta): string {
  const t = meta.theme;
  return content
    .replace(/\{\{primary1\}\}/g, t.primary[0])
    .replace(/\{\{primary2\}\}/g, t.primary[1])
    .replace(/\{\{accent1a\}\}/g, t.accent1[0])
    .replace(/\{\{accent1b\}\}/g, t.accent1[1])
    .replace(/\{\{accent2a\}\}/g, t.accent2[0])
    .replace(/\{\{accent2b\}\}/g, t.accent2[1])
    .replace(/\{\{accent3a\}\}/g, t.accent3[0])
    .replace(/\{\{accent3b\}\}/g, t.accent3[1])
    .replace(/\{\{appName\}\}/g, meta.appName)
    .replace(/\{\{appSlug\}\}/g, meta.appSlug)
    .replace(/\{\{description\}\}/g, meta.description)
    .replace(/\{\{dbMode\}\}/g, meta.dbMode);
}

/**
 * Generate App.tsx with correct screen imports and tab configuration
 */
function generateAppTsx(meta: AppMeta): string {
  // Separate tab screens (dashboard, list, profile) from stack screens (detail, form)
  const tabScreens = meta.screens.filter(s => !s.type.includes('detail') && !s.type.includes('form'));
  const stackScreens = meta.screens.filter(s => s.type.includes('detail') || s.type.includes('form'));

  const imports = meta.screens
    .map(s => `import ${s.name.replace(/\s/g, '')}Screen from './src/screens/${s.name.replace(/\s/g, '')}Screen';`)
    .join('\n');

  const tabConfig = tabScreens
    .map(s => {
      const componentName = s.name.replace(/\s/g, '') + 'Screen';
      const icon = getTabIcon(s.name, s.type);
      return `          <Tab.Screen 
            name="${s.name}" 
            component={${componentName}}
            options={{
              tabBarIcon: ({ color, focused }) => (
                <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={focused ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
                  ${icon}
                </Svg>
              ),
            }}
          />`;
    })
    .join('\n');

  const stackConfig = stackScreens
    .map(s => {
      const componentName = s.name.replace(/\s/g, '') + 'Screen';
      return `          <Stack.Screen name="${componentName}" component={${componentName}} />`;
    })
    .join('\n');

  return `import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Rect, Polyline, Polygon, Line } from 'react-native-svg';
import { theme } from './src/theme';
import { store } from './src/store';

${imports}

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const DarkTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#050507',
    card: 'rgba(5,5,7,0.95)',
    text: '#fff',
    border: 'rgba(255,255,255,0.06)',
    primary: theme.colors.primary[0],
  },
};

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: 'rgba(5,5,7,0.95)',
          borderTopColor: 'rgba(255,255,255,0.06)',
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
          paddingTop: 4,
        },
        tabBarActiveTintColor: theme.colors.primary[0],
        tabBarInactiveTintColor: 'rgba(255,255,255,0.4)',
        tabBarLabelStyle: { fontSize: 10, fontWeight: '500' },
      }}
    >
${tabConfig}
    </Tab.Navigator>
  );
}

export default function App() {
  useEffect(() => { store.init(); }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={DarkTheme}>
        <StatusBar style="light" />
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Main" component={TabNavigator} />
${stackConfig}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
`;
}

/**
 * Get SVG icon path for a screen based on its name/type
 */
function getTabIcon(name: string, type: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('home') || lower.includes('dashboard')) 
    return '<Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><Polyline points="9 22 9 12 15 12 15 22" />';
  if (lower.includes('profile') || lower.includes('account') || lower.includes('user'))
    return '<Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><Circle cx={12} cy={7} r={4} />';
  if (lower.includes('setting'))
    return '<Circle cx={12} cy={12} r={3} /><Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4" />';
  if (lower.includes('add') || lower.includes('create') || lower.includes('new') || type.includes('form'))
    return '<Circle cx={12} cy={12} r={10} /><Line x1={12} y1={8} x2={12} y2={16} /><Line x1={8} y1={12} x2={16} y2={12} />';
  if (lower.includes('search') || lower.includes('explore') || lower.includes('discover'))
    return '<Circle cx={11} cy={11} r={8} /><Line x1={21} y1={21} x2={16.65} y2={16.65} />';
  if (lower.includes('detail') || lower.includes('view'))
    return '<Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><Polyline points="14 2 14 8 20 8" />';
  if (lower.includes('chat') || lower.includes('message'))
    return '<Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />';
  if (lower.includes('list') || lower.includes('catalog') || lower.includes('browse'))
    return '<Line x1={8} y1={6} x2={21} y2={6} /><Line x1={8} y1={12} x2={21} y2={12} /><Line x1={8} y1={18} x2={21} y2={18} /><Line x1={3} y1={6} x2={3.01} y2={6} /><Line x1={3} y1={12} x2={3.01} y2={12} /><Line x1={3} y1={18} x2={3.01} y2={18} />';
  // Default: grid icon
  return '<Rect x={3} y={3} width={7} height={7} /><Rect x={14} y={3} width={7} height={7} /><Rect x={14} y={14} width={7} height={7} /><Rect x={3} y={14} width={7} height={7} />';
}

/**
 * Generate config.ts with app-specific settings
 */
function generateConfig(meta: AppMeta): string {
  return `export const config = {
  appName: '${meta.appName}',
  appSlug: '${meta.appSlug}',
  appId: '',  // Set after provisioning
  description: '${meta.description.replace(/'/g, "\\'")}',

  // Database mode: 'managed' (AppForge backend) or 'self-managed' (your own Supabase)
  mode: '${meta.dbMode}' as 'managed' | 'self-managed',

  // Managed mode (AppForge handles everything)
  appforgeApiUrl: 'https://api.appforge.dev',

  // Self-managed mode: Supabase
  supabaseUrl: '',
  supabaseAnonKey: '',

  // Monetization
  admobAppId: '',
  admobBannerId: '',
  admobInterstitialId: '',
  admobRewardedId: '',

  // Payments
  stripePublishableKey: '',
  razorpayKeyId: '',

  // Features
  features: {
    auth: ${meta.features.auth},
    database: ${meta.features.database},
    ads: ${meta.features.ads},
    payments: ${meta.features.payments},
    pushNotifications: ${meta.features.pushNotifications},
    analytics: false,
  },
};
`;
}

/**
 * Generate app.json with correct metadata
 */
function generateAppJson(meta: AppMeta): string {
  return JSON.stringify({
    expo: {
      name: meta.appName,
      slug: meta.appSlug,
      version: '1.0.0',
      orientation: 'portrait',
      icon: './assets/icon.png',
      userInterfaceStyle: 'dark',
      splash: {
        backgroundColor: '#050507',
        resizeMode: 'contain',
      },
      assetBundlePatterns: ['**/*'],
      ios: {
        supportsTablet: true,
        bundleIdentifier: `com.appforge.${meta.appSlug}`,
      },
      android: {
        adaptiveIcon: { foregroundImage: './assets/adaptive-icon.png', backgroundColor: '#050507' },
        package: `com.appforge.${meta.appSlug.replace(/-/g, '_')}`,
      },
      plugins: meta.features.ads ? ['expo-ads-admob'] : [],
    },
  }, null, 2);
}

/**
 * Assemble complete Expo project files
 */
export function assembleExpoProject(meta: AppMeta): Record<string, string> {
  const files: Record<string, string> = {};
  
  // Read all template files
  const templateFiles = readTemplateFiles(TEMPLATE_DIR);
  
  // Apply theme to all template files
  for (const [relPath, content] of Object.entries(templateFiles)) {
    // Skip App.tsx, config.ts, app.json — we generate these custom
    if (relPath === 'App.tsx' || relPath === 'src/config.ts' || relPath === 'app.json') continue;
    
    // Skip screen templates — we'll select the right ones
    if (relPath.startsWith('src/screens/') && relPath !== 'src/screens/index.ts') continue;
    
    files[relPath] = applyTheme(content, meta);
  }
  
  // Generate custom files
  files['App.tsx'] = applyTheme(generateAppTsx(meta), meta);
  files['src/config.ts'] = generateConfig(meta);
  files['app.json'] = generateAppJson(meta);
  files['package.json'] = applyTheme(templateFiles['package.json'] || '{}', meta);
  
  // Select correct screen templates based on blueprint types
  const screenIndex: string[] = [];
  for (const screen of meta.screens) {
    const componentName = screen.name.replace(/\s/g, '');
    const screenType = mapBlueprintToTemplate(screen.type);
    
    // Read the template screen
    const templatePath = `src/screens/${screenType}Screen.tsx`;
    const templateContent = templateFiles[templatePath];
    
    if (templateContent) {
      // Rename the component/export
      let customized = templateContent
        .replace(new RegExp(`export default function ${screenType}Screen`, 'g'), `export default function ${componentName}Screen`)
        .replace(new RegExp(`function ${screenType}Screen`, 'g'), `function ${componentName}Screen`);
      
      customized = applyTheme(customized, meta);
      customized = fillScreenPlaceholders(customized, screen.name, meta.appName, screenType, meta);
      files[`src/screens/${componentName}Screen.tsx`] = customized;
    }
    
    screenIndex.push(`export { default as ${componentName}Screen } from './${componentName}Screen';`);
  }
  
  files['src/screens/index.ts'] = screenIndex.join('\n') + '\n';
  
  // EAS config
  files['eas.json'] = JSON.stringify({
    cli: { version: '>= 3.0.0' },
    build: {
      development: { developmentClient: true, distribution: 'internal' },
      preview: { distribution: 'internal' },
      production: {},
    },
    submit: { production: {} },
  }, null, 2);
  
  // tsconfig
  files['tsconfig.json'] = JSON.stringify({
    extends: 'expo/tsconfig.base',
    compilerOptions: {
      strict: true,
      baseUrl: '.',
      paths: { '@/*': ['src/*'] },
    },
  }, null, 2);
  
  return files;
}

function mapBlueprintToTemplate(type: string): string {
  if (type.startsWith('dashboard')) return 'Dashboard';
  if (type.startsWith('list')) return 'List';
  if (type.startsWith('detail')) return 'Detail';
  if (type.startsWith('form')) return 'Form';
  if (type.startsWith('profile')) return 'Profile';
  return 'Dashboard';
}

/**
 * Get file list with sizes (for API response without creating ZIP)
 */
export function getProjectManifest(meta: AppMeta): { path: string; size: number }[] {
  const files = assembleExpoProject(meta);
  return Object.entries(files).map(([p, content]) => ({
    path: p,
    size: Buffer.byteLength(content, 'utf-8'),
  }));
}
