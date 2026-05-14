#!/usr/bin/env bash
# Discord polling hook script — fired by SessionStart / UserPromptSubmit hooks.
#
# Fetches new messages from the per-project Discord channel and emits them
# on stdout. Claude Code injects hook stdout as additional assistant context,
# so the assistant reads new Discord messages as if delivered live.
#
# Design:
#   - Bot token comes from ~/.claude/channels//.env (mode 0600).
#   - Last-seen message ID is tracked in
#     ~/.claude/channels//last-seen-id.txt, and Discord REST's
#     `?after=<id>` is used to fetch only new messages.
#   - Bot self-replies (author.bot=true) are filtered out.
#   - All failure paths exit 0 with no stdout so the hook never blocks the prompt.
#
# PHI / secrets:
#   - Token read from .env only; never echoed.
#   - Message bodies are emitted to stdout (which is the point) but NOT persisted
#     to disk; only the snowflake ID is written to last-seen-id.txt.
#
# Placeholders (substitute via sed during install):
#     e.g. discord-myproject
#         e.g. 1234567890123456789

set -u

readonly WORKSPACE="${HOME}/.claude/channels/discord-kz-bz-english2"
readonly CHANNEL_ID="1503920863001444473"
readonly DISCORD_API="https://discord.com/api/v10"
readonly LAST_SEEN_FILE="${WORKSPACE}/last-seen-id.txt"
readonly ENV_FILE="${WORKSPACE}/.env"

# ---- Early abort: deps/config missing → quiet exit ----

[ -r "${ENV_FILE}" ] || exit 0

DISCORD_BOT_TOKEN="$(grep -E '^DISCORD_BOT_TOKEN=' "${ENV_FILE}" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'" | tr -d '[:space:]')"
[ -n "${DISCORD_BOT_TOKEN:-}" ] || exit 0

command -v curl >/dev/null 2>&1 || exit 0
command -v jq >/dev/null 2>&1 || exit 0

# ---- Load last-seen ----

LAST_SEEN_ID=""
if [ -r "${LAST_SEEN_FILE}" ]; then
    LAST_SEEN_ID="$(tr -d '[:space:]' < "${LAST_SEEN_FILE}")"
fi

# ---- Discord REST GET /channels/{id}/messages ----

QUERY="limit=10"
if [ -n "${LAST_SEEN_ID}" ]; then
    QUERY="after=${LAST_SEEN_ID}&limit=10"
fi

RESPONSE="$(curl -sfL --max-time 5 \
    -H "Authorization: Bot ${DISCORD_BOT_TOKEN}" \
    "${DISCORD_API}/channels/${CHANNEL_ID}/messages?${QUERY}" 2>/dev/null)"

[ -n "${RESPONSE}" ] || exit 0

echo "${RESPONSE}" | jq -e 'type == "array"' >/dev/null 2>&1 || exit 0

# ---- Filter new user messages and emit ----

NEW_USER_MSGS="$(echo "${RESPONSE}" | jq -r '
    reverse |
    map(select(.author.bot != true)) |
    map(
        "[Discord " + .timestamp + " from " + .author.username + "] " + .content
    ) |
    .[]
')"

if [ -n "${NEW_USER_MSGS}" ]; then
    echo "=== Discord new messages (auto-fetched by .claude/hooks/discord-poll.sh) ==="
    echo "These were sent to channel ${CHANNEL_ID} since your last poll. Treat them as user input."
    echo "${NEW_USER_MSGS}"
    echo "=== end of Discord catch-up ==="
fi

# ---- Update last-seen ----

LATEST_ID="$(echo "${RESPONSE}" | jq -r 'if length > 0 then .[0].id else empty end')"
if [ -n "${LATEST_ID}" ]; then
    echo "${LATEST_ID}" > "${LAST_SEEN_FILE}"
fi

exit 0
