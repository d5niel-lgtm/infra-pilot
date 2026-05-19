#!/bin/bash

set -euo pipefail

# Configuration
readonly CPU_THRESHOLD="${CPU_THRESHOLD:-45}"
readonly LOG_FILE="${LOG_FILE:-/var/log/anti-mining.log}"
readonly LOG_ENDPOINT="${LOG_ENDPOINT:-http://localhost:8000/logs}"
readonly CHECK_INTERVAL="${CHECK_INTERVAL:-3}"

# Harmful processes to monitor and kill
SUSPICIOUS_PROCESSES=(
    xmrig ccminer minerd cgminer bfgminer claymore ethminer
    t-rex phoenixminer teamredminer nbminer
    stress-ng stress hping3 hping
)

# System processes that should never be killed
SYSTEM_WHITELIST=(
    systemd bash sshd docker dockerd containerd
    apt apt-get dpkg python3 python
)

# Check if process is in whitelist
is_whitelisted() {
    local process="$1"
    for item in "${SYSTEM_WHITELIST[@]}"; do
        [[ "$process" == "$item" ]] && return 0
    done
    return 1
}

# Log an action locally
log_action() {
    local message="$1"
    printf '[%s] %s\n' "$(date +'%Y-%m-%d %H:%M:%S')" "$message" >> "$LOG_FILE"
}

# Send log to remote endpoint
send_log_to_endpoint() {
    local pid="$1"
    local process="$2"
    local cpu_usage="$3"

    local payload
    payload=$(jq -n \
        --arg timestamp "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
        --arg process "$process" \
        --arg pid "$pid" \
        --arg cpu "$cpu_usage" \
        '{timestamp: $timestamp, process: $process, pid: $pid, cpu_usage: $cpu}')

    curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "$payload" \
        "$LOG_ENDPOINT" || true
}

# Kill high CPU processes
kill_high_cpu_processes() {
    while IFS= read -r line; do
        local pid cpu_usage process
        read -r pid cpu_usage process <<< "$line"

        [[ -n "$pid" && -n "$cpu_usage" && -n "$process" ]] || continue

        awk -v cpu="$cpu_usage" -v thr="$CPU_THRESHOLD" 'BEGIN {exit !(cpu > thr)}' || continue
        is_whitelisted "$process" && continue

        log_action "Killing process $process (PID: $pid, CPU: ${cpu_usage}%)"
        kill -15 "$pid" 2>/dev/null || kill -9 "$pid" 2>/dev/null || true
        send_log_to_endpoint "$pid" "$process" "$cpu_usage"
    done < <(ps -eo pid,pcpu,comm --sort=-pcpu | tail -n +2)
}

# Main loop
main() {
    while true; do
        kill_high_cpu_processes
        sleep "$CHECK_INTERVAL"
    done
}

main
