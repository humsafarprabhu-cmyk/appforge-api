#!/bin/bash
# Updates the Vercel env var with the current Cloudflare Tunnel URL
# Run this whenever the tunnel restarts

TUNNEL_URL=$(tmux capture-pane -t cloudflared -p -S -50 2>/dev/null | grep -o "https://[^ ]*\.trycloudflare\.com" | head -1)

if [ -z "$TUNNEL_URL" ]; then
  echo "❌ No tunnel URL found. Is cloudflared running in tmux session 'cloudflared'?"
  exit 1
fi

echo "🔗 Tunnel URL: $TUNNEL_URL"

cd /home/a/.openclaw/workspace/appforge
# Remove old and add new
npx vercel env rm APPFORGE_BACKEND_URL production -y 2>/dev/null
echo "$TUNNEL_URL" | npx vercel env add APPFORGE_BACKEND_URL production

echo "✅ Updated! Now redeploy: cd /home/a/.openclaw/workspace/appforge && npx vercel --prod --yes"
