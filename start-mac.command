#!/bin/bash
cd "$(dirname "$0")"
echo "The player is running at http://127.0.0.1:8080  (close this window to stop it)"
( sleep 1; open "http://127.0.0.1:8080/" ) &
python3 -m http.server 8080 --bind 127.0.0.1
