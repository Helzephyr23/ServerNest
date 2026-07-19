#!/bin/sh
set -e

# Start API and frontend, wait for either to exit
node src/dist/index.js &
API_PID=$!

node web-standalone/server.js &
WEB_PID=$!

trap "kill $API_PID $WEB_PID 2>/dev/null; exit" SIGTERM SIGINT

wait $API_PID $WEB_PID
