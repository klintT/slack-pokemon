#!/bin/sh
pkExist="`pm2 id \"Slack Pokemon\"`"
if [ "$pkExist" = "[]" ]; then
    pm2 start index.js --name="Slack Pokemon"
else 
    # Remove the old one first
    pm2 delete "Slack Pokemon"
    pm2 start index.js --name="Slack Pokemon"
fi