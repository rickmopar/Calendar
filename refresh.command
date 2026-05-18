#!/bin/zsh
cd "$(dirname "$0")"
node scripts/refresh-events.js
echo
echo "Dashboard data refreshed. You can reload index.html now."
