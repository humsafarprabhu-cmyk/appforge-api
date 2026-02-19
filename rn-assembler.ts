/**
 * React Native Assembler
 * Takes generated app metadata + screens → complete Expo project (ZIP)
 * 
 * Uses the rn-template/ as base, replaces {{placeholders}} with app-specific data
 */

import * as fs from 'fs';
import * as path from 'path';

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
  const imports = meta.screens
    .map((s, i) => `import ${s.name.replace(/\s/g, '')}Screen from './src/screens/${s.name.replace(/\s/g, '')}Screen';`)
    .join('\n');
  
  const tabScreens = meta.screens
    .map((s, i) => {
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

  return `import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Rect, Polyline, Polygon, Line } from 'react-native-svg';
import { theme } from './src/theme';
import { auth, ads, notifications } from './src/services';
import { config } from './src/config';

${imports}

const Tab = createBottomTabNavigator();

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

export default function App() {
  useEffect(() => {
    (async () => {
      if (config.features.auth) await auth.restoreSession();
      if (config.features.ads) await ads.initialize();
      if (config.features.pushNotifications) await notifications.register();
    })();
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={DarkTheme}>
        <StatusBar style="light" />
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
${tabScreens}
        </Tab.Navigator>
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
  description: '${meta.description.replace(/'/g, "\\'")}',
  
  // Database mode: 'managed' (AppForge backend) or 'self-managed' (your own Supabase)
  dbMode: '${meta.dbMode}' as const,
  
  // Managed mode config (AppForge handles everything)
  managed: {
    apiUrl: 'https://api.appforge.dev',
    appId: '{{APP_ID}}',  // Set after provisioning
  },
  
  // Self-managed mode (bring your own Supabase)
  supabase: {
    url: '{{SUPABASE_URL}}',
    anonKey: '{{SUPABASE_ANON_KEY}}',
  },
  
  features: {
    auth: ${meta.features.auth},
    database: ${meta.features.database},
    ads: ${meta.features.ads},
    payments: ${meta.features.payments},
    pushNotifications: ${meta.features.pushNotifications},
  },
  
  ads: {
    bannerId: '{{ADMOB_BANNER_ID}}',
    interstitialId: '{{ADMOB_INTERSTITIAL_ID}}',
    rewardedId: '{{ADMOB_REWARDED_ID}}',
  },
  
  payments: {
    stripePublishableKey: '{{STRIPE_PK}}',
    razorpayKeyId: '{{RAZORPAY_KEY}}',
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
