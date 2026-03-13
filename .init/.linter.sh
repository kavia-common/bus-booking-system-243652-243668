#!/bin/bash
cd /home/kavia/workspace/code-generation/bus-booking-system-243652-243668/bus_app_frontend
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

