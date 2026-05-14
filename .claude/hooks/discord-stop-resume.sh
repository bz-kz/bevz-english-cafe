#!/usr/bin/env bash
# Discord stop-resume hook — fired by the Stop hook event.
#
# At the moment Claude finishes a response, poll Discord one more time and
# if there are new messages, return JSON `{"decision":"block","reason":<msgs>}`
# so Claude immediately resumes the next turn instead of waiting for the user
# to type something into the CLI. This closes the gap that the
# UserPromptSubmit-only polling cannot cover (a Discord message that arrives
# AFTER Claude's previous response and BEFORE the user types anything will
# otherwise sit in the queue indefinitely).
#
# Failure modes are deliberately silent (exit 0 with no JSON) — the existing
# Stop hook reminder still fires regardless.

set -u

readonly POLL_SCRIPT="${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/discord-poll.sh"

[ -x "${POLL_SCRIPT}" ] || exit 0
command -v jq >/dev/null 2>&1 || exit 0

output="$(bash "${POLL_SCRIPT}" 2>/dev/null)"

if [ -n "${output}" ]; then
    jq -nc --arg reason "${output}" '{decision:"block", reason:$reason}'
fi

exit 0
