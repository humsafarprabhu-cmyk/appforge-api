#!/bin/bash
# Load API keys
export ANTHROPIC_API_KEY=$(cat ~/.config/anthropic/api_key)
export OPENAI_API_KEY=$(grep OPENAI_API_KEY /home/a/.openclaw/workspace/appforge/.env.local 2>/dev/null | cut -d= -f2)

# Supabase (service role for multi-tenant backend)
export SUPABASE_URL=https://irpffsxkzmtpbmuremyp.supabase.co
# Load SUPABASE_SERVICE_ROLE_KEY from .env
export SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"

# JWT secret for end-user auth
export APPFORGE_JWT_SECRET=${APPFORGE_JWT_SECRET:-"appforge-dev-secret-$(hostname)"}

cd /home/a/.openclaw/workspace/appforge-api
npx tsx server.ts
