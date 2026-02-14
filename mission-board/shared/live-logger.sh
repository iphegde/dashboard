#!/bin/bash
#
# Live Mission Board Logger - Integration Script
# 
# This script logs conversations between the user and Nexar/agents
# to the Mission Board in real-time.
#
# Usage: source ./live-logger.sh
#

# Configuration
export MISSION_BOARD_API_URL="${MISSION_BOARD_API_URL:-http://localhost:3001}"
export LIVE_LOGGER_DIR="${LIVE_LOGGER_DIR:-$(dirname "$0")}"

# Current conversation tracking
_CURRENT_CONVERSATION_ID=""
_CURRENT_SESSION_ID=""

# Start a new conversation
start_live_conversation() {
    local initiator="${1:-nexar}"
    local participants="${2:-user}"
    local title="${3:-Live Conversation}"
    local session_id="${4:-session-$(date +%s)}"
    
    _CURRENT_SESSION_ID="$session_id"
    
    local result=$(node "$LIVE_LOGGER_DIR/log-conversation.js" \
        --action=start \
        --initiator="$initiator" \
        --participants="$participants" \
        --session-id="$session_id" \
        --title="$title" 2>&1)
    
    # Extract conversation ID
    _CURRENT_CONVERSATION_ID=$(echo "$result" | grep "CONVERSATION_ID:" | cut -d' ' -f2)
    
    if [ -n "$_CURRENT_CONVERSATION_ID" ]; then
        echo "✅ Live logging started: $_CURRENT_CONVERSATION_ID"
        return 0
    else
        echo "❌ Failed to start conversation logging"
        echo "$result"
        return 1
    fi
}

# Log a message to the current conversation
log_live_message() {
    local agent="${1:-nexar}"
    local role="${2:-assistant}"
    local content="$3"
    local input_tokens="${4:-0}"
    local output_tokens="${5:-0}"
    local model="${6:-moonshot/kimi-k2.5}"
    
    if [ -z "$_CURRENT_CONVERSATION_ID" ]; then
        echo "⚠️  No active conversation. Call start_live_conversation first."
        return 1
    fi
    
    # Escape content for JSON
    local escaped_content=$(echo "$content" | sed 's/"/\\"/g' | tr '\n' ' ')
    
    local result=$(node "$LIVE_LOGGER_DIR/log-conversation.js" \
        --action=message \
        --conversation-id="$_CURRENT_CONVERSATION_ID" \
        --agent="$agent" \
        --role="$role" \
        --content="$escaped_content" \
        --input-tokens="$input_tokens" \
        --output-tokens="$output_tokens" \
        --model="$model" 2>&1)
    
    if echo "$result" | grep -q "MESSAGE_LOGGED"; then
        return 0
    else
        echo "⚠️  Failed to log message: $result"
        return 1
    fi
}

# Log user message
log_user_message() {
    local content="$1"
    local input_tokens="${2:-0}"
    
    log_live_message "user" "user" "$content" "$input_tokens" 0 "user"
}

# Log agent response
log_agent_response() {
    local agent="${1:-nexar}"
    local content="$2"
    local input_tokens="${3:-0}"
    local output_tokens="${4:-0}"
    local model="${5:-moonshot/kimi-k2.5}"
    
    log_live_message "$agent" "assistant" "$content" "$input_tokens" "$output_tokens" "$model"
}

# Get current conversation ID
get_conversation_id() {
    echo "$_CURRENT_CONVERSATION_ID"
}

# End current conversation
end_live_conversation() {
    _CURRENT_CONVERSATION_ID=""
    _CURRENT_SESSION_ID=""
    echo "✅ Live logging ended"
}

# Check backend health
check_backend() {
    node "$LIVE_LOGGER_DIR/log-conversation.js" --action=health
}

# Export functions
export -f start_live_conversation
export -f log_live_message
export -f log_user_message
export -f log_agent_response
export -f get_conversation_id
export -f end_live_conversation
export -f check_backend

echo "🔴 Live Mission Board Logger loaded"
echo "Available commands:"
echo "  start_live_conversation [initiator] [participants] [title] [session_id]"
echo "  log_user_message <content> [input_tokens]"
echo "  log_agent_response <agent> <content> [input_tokens] [output_tokens] [model]"
echo "  get_conversation_id"
echo "  end_live_conversation"
echo "  check_backend"
