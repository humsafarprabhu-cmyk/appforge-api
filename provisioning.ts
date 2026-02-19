/**
 * App Provisioning Service
 * When AI generates a blueprint, this sets up the backend infrastructure:
 * - Creates collections in DB
 * - Configures auth settings  
 * - Sets up storage
 * - Creates app_settings record
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder',
);

interface BlueprintCollection {
  name: string;
  fields: { name: string; type: string; required?: boolean; default?: unknown }[];
}

interface Blueprint {
  dataModel?: {
    collections?: BlueprintCollection[];
  };
  auth?: {
    enabled?: boolean;
    providers?: string[];
    requireAuth?: boolean;
    profileFields?: string[];
  };
  notifications?: {
    enabled?: boolean;
    triggers?: string[];
  };
}

export async function provisionApp(appId: string, blueprint: Blueprint): Promise<void> {
  console.log(`[Provision] Setting up backend for app ${appId}...`);

  // 1. Create collections
  if (blueprint.dataModel?.collections) {
    for (const col of blueprint.dataModel.collections) {
      const { error } = await supabase
        .from('app_collections')
        .upsert({
          app_id: appId,
          name: col.name,
          schema: col.fields,
          description: `Auto-created: ${col.name}`,
        }, { onConflict: 'app_id,name' });

      if (error) {
        console.error(`[Provision] Failed to create collection "${col.name}":`, error.message);
      } else {
        console.log(`[Provision] ✅ Collection: ${col.name} (${col.fields.length} fields)`);
      }
    }
  }

  // 2. Create app settings
  const { error: settingsError } = await supabase
    .from('app_settings')
    .upsert({
      app_id: appId,
      auth_config: {
        enabled: blueprint.auth?.enabled ?? true,
        providers: blueprint.auth?.providers || ['email'],
        require_auth: blueprint.auth?.requireAuth ?? false,
        allow_signup: true,
        profile_fields: blueprint.auth?.profileFields || ['display_name'],
      },
      notification_config: {
        enabled: blueprint.notifications?.enabled ?? false,
        triggers: blueprint.notifications?.triggers || [],
      },
    }, { onConflict: 'app_id' });

  if (settingsError) {
    console.error(`[Provision] Failed to create settings:`, settingsError.message);
  } else {
    console.log(`[Provision] ✅ App settings configured`);
  }

  // 3. Store blueprint on the app
  const { error: appError } = await supabase
    .from('apps')
    .update({ blueprint })
    .eq('id', appId);

  if (appError) {
    console.error(`[Provision] Failed to store blueprint:`, appError.message);
  }

  console.log(`[Provision] 🎉 App ${appId} fully provisioned`);
}

export async function deprovisionApp(appId: string): Promise<void> {
  console.log(`[Provision] Cleaning up app ${appId}...`);
  
  // Cascade deletes handle most cleanup via FK constraints
  // But we should clean up storage bucket files
  const { data: files } = await supabase
    .from('app_files')
    .select('file_path')
    .eq('app_id', appId);

  if (files?.length) {
    const paths = files.map(f => f.file_path);
    await supabase.storage.from('app-uploads').remove(paths);
    console.log(`[Provision] Cleaned ${paths.length} files from storage`);
  }

  console.log(`[Provision] ✅ App ${appId} deprovisioned`);
}
