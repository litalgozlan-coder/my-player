#!/bin/bash
# מפרסם את הנגן: מטביע גרסה, עושה commit ו-push
set -e
cd "$(dirname "$0")"
V=$(date -u +%Y%m%d%H%M%S)
sed -i "s/const VERSION = '[^']*'/const VERSION = '$V'/" index.html
git add index.html publish.sh
git -c user.name="litalgozlan-coder" -c user.email="lital.gozlan@gmail.com" commit -q -m "$1

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01PmMRr1C3eWcZKBV5nhkF6c"
git push -q origin main
echo "published version $V"
