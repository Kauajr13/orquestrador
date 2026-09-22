#!/usr/bin/env bash

# Script to schedule the weekly retrospective routine via cron.
# It ensures the cron entry exists and is idempotent.

# Command to run the retrospective routine
CMD="node -r ts-node/register lib/rotinas/retrospectiva-semanal.ts"

# Desired schedule: every Monday at 08:00
SCHEDULE="0 8 * * 1"

# Full cron line
CRON_LINE="${SCHEDULE} ${CMD}"

# Log file (placed alongside this script)
LOG_FILE="$(dirname "${BASH_SOURCE[0]}")/cron.log"

# Function to add cron entry if missing
add_cron() {
  # Append the new line to existing crontab (or create new one)
  (crontab -l 2>/dev/null; echo "${CRON_LINE}") | crontab -
  echo "$(date '+%Y-%m-%d %H:%M:%S') - Added cron job for retrospective" >> "${LOG_FILE}"
  echo "Cron job added."
}

# Check if the cron entry already exists
if crontab -l 2>/dev/null | grep -F "${CMD}" >/dev/null; then
  echo "Cron job already exists."
else
  add_cron
fi
