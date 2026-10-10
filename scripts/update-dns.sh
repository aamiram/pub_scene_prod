#!/bin/bash
# -------------------------------------------------------------
# Namecheap Dynamic DNS / API Sync Script
# -------------------------------------------------------------

# Configuration (Fill your domain details below)
DOMAIN="yourdomain.com"
SUBDOMAIN="@"
# Get password from: Namecheap -> Manage Domain -> Advanced DNS -> Dynamic DNS -> Password
DDNS_PASSWORD="YOUR_NAMECHEAP_DYNAMIC_DNS_PASSWORD_HERE"

# 1. Fetch current public server IP
CURRENT_IP=$(curl -s https://api.ipify.org)

echo "[$(date)] Updating DNS for ${DOMAIN} to IP: ${CURRENT_IP}..."

# 2. Trigger Namecheap Dynamic DNS Update API
RESPONSE=$(curl -s "https://dynamicdns.park-your-domain.com/update?host=${SUBDOMAIN}&domain=${DOMAIN}&password=${DDNS_PASSWORD}&ip=${CURRENT_IP}")

echo "Response from Namecheap: ${RESPONSE}"