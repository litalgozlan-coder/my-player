#!/bin/bash
# מפרסם את הנגן: מטביע גרסה, בודק תקינות, עושה commit ו-push
set -e
cd "$(dirname "$0")"
V=$(date -u +%Y%m%d%H%M%S)
sed -i -E "s/^const VERSION = '[0-9_A-Z]*';$/const VERSION = '$V';/" index.html
grep -q "^const VERSION = '$V';$" index.html
node -e "const h=require('fs').readFileSync('index.html','utf8');const s=h.split('<script>')[1].split('</script>')[0];new Function(s);"
git add -A
git -c user.name="litalgozlan-coder" -c user.email="lital.gozlan@gmail.com" commit -q -m "$1

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Xj7ALZWMoteuB6isLEF76g"
git push -q origin main
echo "published version $V"
