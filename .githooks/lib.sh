# Shared checks for the git hooks and CI. POSIX sh; works with macOS and GNU grep.

# Names and addresses AI agents commit or sign off as.
AGENT_RE='claude|anthropic|copilot|cursor[ -]?agent|cursoragent|openai|codex|chatgpt|gpt-?[0-9]|devin-ai|devin\.ai|aider|gemini|codeium|windsurf|amazon q|\[bot\]'

# Things that must never be committed in an open-source finance app.
SECRET_RE='-----BEGIN [A-Z ]*PRIVATE KEY-----|eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.|sb_secret_[A-Za-z0-9_-]{10,}|(ghp|gho|ghu|ghs|github_pat)_[A-Za-z0-9_]{20,}|sk-(ant-)?[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ya29\.[A-Za-z0-9_-]{20,}|1//[A-Za-z0-9_-]{30,}|AIza[0-9A-Za-z_-]{35}|"scriptId": *"[A-Za-z0-9_-]{20,}"'

# Singapore NRIC/FIN and mobile numbers. Fixtures must use fake values.
PII_RE='[STFGM][0-9]{7}[A-Z]|\+65 ?[89][0-9]{3} ?[0-9]{4}'

BAD_FILE_RE='(^|/)\.env($|\.)|\.(pem|key|p12|pfx|csv|eml|mbox|ofx|qif|pdf)$'
ALLOWED_FILE_RE='(^|/)\.env\.example$'

fail() {
  printf 'git hook: %s\n' "$1" >&2
  FAILED=1
}

# check_message <file>: reject agent attribution in a commit message or PR body.
check_message() {
  if grep -Eiq "^[a-z-]+-by:.*($AGENT_RE)" "$1"; then
    fail "commit message credits an AI agent (Co-Authored-By / Signed-off-by etc). Remove it."
    grep -Ein "^[a-z-]+-by:.*($AGENT_RE)" "$1" >&2
  fi
  if grep -Eiq "(generated|written|created|made|authored|committed) (with|by|using).*($AGENT_RE)" "$1" || grep -q '🤖' "$1"; then
    fail "commit message advertises an AI agent ('Generated with ...'). Remove it."
  fi
}

# check_ident <"Name <email>"> <role>
check_ident() {
  if printf '%s' "$1" | grep -Eiq "$AGENT_RE"; then
    fail "$2 is an AI agent: $1. Commit as a human."
  fi
}

# check_files <file with one path per line>
check_files() {
  while IFS= read -r path; do
    [ -z "$path" ] && continue
    printf '%s' "$path" | grep -Eq "$ALLOWED_FILE_RE" && continue
    if printf '%s' "$path" | grep -Eiq "$BAD_FILE_RE"; then
      fail "refusing to commit $path (env, key or bank data file)."
    fi
  done < "$1"
}

# check_added_lines <unified diff file>: scan only added lines.
check_added_lines() {
  added=$(grep -E '^\+' "$1" | grep -Ev '^\+\+\+ ')
  hits=$(printf '%s\n' "$added" | grep -En -e "$SECRET_RE" | head -5)
  [ -n "$hits" ] && { fail "diff contains what looks like a secret:"; printf '%s\n' "$hits" >&2; }
  hits=$(printf '%s\n' "$added" | grep -En -e "$PII_RE" | head -5)
  [ -n "$hits" ] && { fail "diff contains what looks like an NRIC or phone number:"; printf '%s\n' "$hits" >&2; }
  return 0
}

# check_commits <rev-list args...>: author, committer and message of each commit.
check_commits() {
  tmp=$(mktemp)
  for c in $(git rev-list "$@"); do
    check_ident "$(git log -1 --format='%an <%ae>' "$c")" "author of $c"
    check_ident "$(git log -1 --format='%cn <%ce>' "$c")" "committer of $c"
    git log -1 --format=%B "$c" > "$tmp"
    check_message "$tmp"
  done
  rm -f "$tmp"
}

# Paths whose contents are the patterns themselves.
SCAN_EXCLUDE=':(exclude).githooks/*'
