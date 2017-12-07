#!/bin/sh
pkExist="`pm2 id \"Slack Pokemon\"`"
if [ "$pkExist" == "[]" ]; then 
    pm2 start index.js --name="Slack Pokemon"
else 
    pm2 restart --update-env "Slack Pokemon"
fi