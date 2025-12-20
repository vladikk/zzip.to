#!/usr/bin/env bash
# automate-with-claude.sh - Automate task execution using Claude API

set -euo pipefail

# Configuration
ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-}"
MODEL="claude-sonnet-4-20250514"  # Latest Claude Sonnet
MAX_TOKENS=8192
TASKS_FILE="TASKS.md"
REQUIREMENTS_FILE="requirements.md"
TEMPLATE_FILE="TASK_PROMPT_TEMPLATE.md"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${BLUE}[STEP]${NC} $1"; }

# Check prerequisites
if [ -z "$ANTHROPIC_API_KEY" ]; then
    log_error "ANTHROPIC_API_KEY environment variable not set"
    echo "Get your API key from: https://console.anthropic.com/settings/keys"
    echo "Then run: export ANTHROPIC_API_KEY='your-key-here'"
    exit 1
fi

if ! command -v jq &> /dev/null; then
    log_error "jq is required but not installed"
    echo "Install with: brew install jq (macOS) or apt-get install jq (Linux)"
    exit 1
fi

if [ ! -f "$TEMPLATE_FILE" ]; then
    log_error "Template file not found: $TEMPLATE_FILE"
    exit 1
fi

if [ ! -f "$TASKS_FILE" ]; then
    log_error "Tasks file not found: $TASKS_FILE"
    exit 1
fi
``
# Function to read file and escape for JSON
read_file_for_json() {
    local file="$1"
    if [ -f "$file" ]; then
        jq -Rs . < "$file"
    else
        echo '""'
    fi  
}

# Function to execute a task using Claude API
execute_task() {
    local task_num="$1"

    log_step "Implementing Task $task_num"

    # Generate prompt by replacing {TASK_NUMBER}
    local prompt=$(sed "s/{TASK_NUMBER}/$task_num/g" "$TEMPLATE_FILE")

    # Read supporting files
    local tasks_content=$(read_file_for_json "$TASKS_FILE")
    local requirements_content=$(read_file_for_json "$REQUIREMENTS_FILE")

    # Create request payload with expanded beta format for prompt caching
    local request_payload=$(cat <<EOF
{
  "model": "$MODEL",
  "max_tokens": $MAX_TOKENS,
  "system": [
    {
      "type": "text",
      "text": "You are an expert software engineer implementing infrastructure-as-code tasks. Follow instructions exactly as specified."
    },
    {
      "type": "text",
      "text": "# TASKS.MD CONTENT\n\n$(echo $tasks_content | jq -r .)",
      "cache_control": {"type": "ephemeral"}
    },
    {
      "type": "text",
      "text": "# REQUIREMENTS.MD CONTENT\n\n$(echo $requirements_content | jq -r .)",
      "cache_control": {"type": "ephemeral"}
    }
  ],
  "messages": [
    {
      "role": "user",
      "content": $(echo "$prompt" | jq -Rs .)
    }
  ]
}
EOF
)

    # Call Claude API
    log_info "Calling Claude API..."
    local response=$(curl -s https://api.anthropic.com/v1/messages \
        -H "x-api-key: $ANTHROPIC_API_KEY" \
        -H "anthropic-version: 2023-06-01" \
        -H "anthropic-beta: prompt-caching-2024-07-31" \
        -H "content-type: application/json" \
        -d "$request_payload")

    # Check for API errors
    if echo "$response" | jq -e '.error' > /dev/null 2>&1; then
        log_error "API Error:"
        echo "$response" | jq -r '.error.message'
        return 1
    fi

    # Extract response text
    local response_text=$(echo "$response" | jq -r '.content[0].text')

    # Save response to file
    local output_file="task-${task_num}-output.md"
    echo "$response_text" > "$output_file"
    log_info "Response saved to: $output_file"

    # Display response
    echo ""
    echo "=================================================="
    echo "TASK $task_num IMPLEMENTATION"
    echo "=================================================="
    echo "$response_text"
    echo "=================================================="
    echo ""

    # Show token usage
    local input_tokens=$(echo "$response" | jq -r '.usage.input_tokens // 0')
    local cache_read_tokens=$(echo "$response" | jq -r '.usage.cache_read_input_tokens // 0')
    local cache_create_tokens=$(echo "$response" | jq -r '.usage.cache_creation_input_tokens // 0')
    local output_tokens=$(echo "$response" | jq -r '.usage.output_tokens // 0')

    log_info "Token usage:"
    echo "  Input tokens: $input_tokens"
    echo "  Cache read tokens: $cache_read_tokens (cheaper)"
    echo "  Cache creation tokens: $cache_create_tokens"
    echo "  Output tokens: $output_tokens"

    return 0
}

# Main execution
main() {
    local start_task="${1:-1}"
    local end_task="${2:-11}"

    log_info "=== Claude Task Automation ==="
    log_info "Model: $MODEL"
    log_info "Tasks: $start_task to $end_task"
    echo ""

    for task_num in $(seq "$start_task" "$end_task"); do
        log_step "Starting Task $task_num"

        if execute_task "$task_num"; then
            log_info "Task $task_num completed"
            echo ""

            # Prompt for verification
            read -p "Review the output above. Continue to next task? (yes/no): " CONTINUE
            if [ "$CONTINUE" != "yes" ]; then
                log_warn "Stopped at user request after Task $task_num"
                exit 0
            fi
        else
            log_error "Task $task_num failed"
            read -p "Retry this task? (yes/no): " RETRY
            if [ "$RETRY" = "yes" ]; then
                execute_task "$task_num"
            else
                log_warn "Stopped after Task $task_num failure"
                exit 1
            fi
        fi
    done

    log_info "All tasks completed successfully!"
}

# Usage information
usage() {
    echo "Usage: $0 [start_task] [end_task]"
    echo ""
    echo "Examples:"
    echo "  $0           # Run all tasks (1-11)"
    echo "  $0 1 3       # Run tasks 1-3"
    echo "  $0 5 5       # Run only task 5"
    echo ""
    echo "Prerequisites:"
    echo "  - Set ANTHROPIC_API_KEY environment variable"
    echo "  - Install jq (brew install jq)"
}

# Parse arguments
if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
    usage
    exit 0
fi

main "${@}"
