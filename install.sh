#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Stefco Claims Dashboard — One-Click Install
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/Soft-Dynamix/stefco-claims-dashboards/main/install.sh | bash
#
# Or download first:
#   wget https://raw.githubusercontent.com/Soft-Dynamix/stefco-claims-dashboards/main/install.sh
#   chmod +x install.sh
#   ./install.sh
#
# Or run from the cloned repo:
#   ./install.sh
# ─────────────────────────────────────────────────────────────────────────────

# ── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m' # No Color

# ── Config ───────────────────────────────────────────────────────────────────
REPO_URL="https://github.com/Soft-Dynamix/stefco-claims-dashboards.git"
INSTALL_DIR="${STEFCO_INSTALL_DIR:-$HOME/stefco-claims-dashboard}"
CONTAINER_NAME="stefco-claims-dashboard"
DEFAULT_PORT=3000

# ── Helpers ──────────────────────────────────────────────────────────────────
info()  { echo -e "${BLUE}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; }
header() {
  echo ""
  echo -e "${CYAN}${BOLD}╔══════════════════════════════════════════════════╗${NC}"
  echo -e "${CYAN}${BOLD}║     STEFCO CLAIMS DASHBOARD — INSTALLER         ║${NC}"
  echo -e "${CYAN}${BOLD}╚══════════════════════════════════════════════════╝${NC}"
  echo ""
}

step_header() {
  echo ""
  echo -e "${BOLD}━━━ Step $1: $2 ━━━${NC}"
  echo ""
}

pause() {
  echo ""
  read -rp "$(echo -e "${YELLOW}[⏸ PAUSED]${NC}  Press Enter to continue to the next step...")" _
  echo ""
}

pause_on_error() {
  local step_name="$1"
  local error_msg="$2"
  echo ""
  echo -e "${RED}${BOLD}╔══════════════════════════════════════════════════╗${NC}"
  echo -e "${RED}${BOLD}  ERROR IN: ${step_name}${NC}"
  echo -e "${RED}${BOLD}╚══════════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "  ${RED}${error_msg}${NC}"
  echo ""
  echo -e "  ${DIM}Possible fixes:${NC}"
  echo -e "    1. Review the error output above"
  echo -e "    2. Check that Docker Desktop is running"
  echo -e "    3. Make sure you have enough disk space"
  echo -e "    4. Try running: docker compose build 2>&1 | tail -20"
  echo ""
  read -rp "$(echo -e "${YELLOW}[?]${NC}  Continue anyway? [y/N]: ")" choice
  echo ""
  if [[ ! "$choice" =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}[ABORTED]${NC}  Installation stopped. Fix the error above and run ./install.sh again."
    exit 1
  fi
  warn "Continuing despite error in: ${step_name}"
  echo ""
}

# ── Pre-flight Checks ───────────────────────────────────────────────────────
check_prerequisites() {
  step_header "1/6" "Prerequisites Check"

  local has_error=false

  # Docker
  if command -v docker &>/dev/null; then
    ok "Docker found: $(docker --version)"
  else
    error "Docker is not installed."
    echo ""
    echo -e "${BOLD}Install Docker:${NC}"
    echo "  • macOS:   https://docs.docker.com/desktop/setup/install/mac-install/"
    echo "  • Windows: https://docs.docker.com/desktop/setup/install/windows-install/"
    echo "  • Linux:   https://docs.docker.com/engine/install/"
    echo ""
    pause_on_error "Docker Install" "Docker is required. Install it using the links above."
    return
  fi

  # Docker running
  if docker info &>/dev/null; then
    ok "Docker daemon is running"
  else
    error "Docker daemon is not running."
    echo -e "  ${DIM}Fix: Start Docker Desktop, then run this script again.${NC}"
    pause_on_error "Docker Daemon" "Docker Desktop is installed but the daemon is not responding."
    return
  fi

  # Docker Compose (v2 plugin or standalone)
  if docker compose version &>/dev/null; then
    ok "Docker Compose found: $(docker compose version --short 2>/dev/null)"
  elif command -v docker-compose &>/dev/null; then
    ok "Docker Compose (standalone) found: $(docker-compose --version)"
  else
    error "Docker Compose is not available."
    pause_on_error "Docker Compose" "Docker Compose v2 is required. Update Docker Desktop."
    return
  fi

  # Git
  if command -v git &>/dev/null; then
    ok "Git found: $(git --version | head -1)"
  else
    error "Git is not installed."
    pause_on_error "Git" "Git is required to clone the repository."
    return
  fi

  # Port check
  if ss -tlnp 2>/dev/null | grep -q ":${DEFAULT_PORT} " || netstat -tlnp 2>/dev/null | grep -q ":${DEFAULT_PORT} "; then
    warn "Port ${DEFAULT_PORT} is already in use. You can change it later in .env (APP_PORT=...)"
  else
    ok "Port ${DEFAULT_PORT} is available"
  fi

  pause
}

# ── Clone or Update Repo ────────────────────────────────────────────────────
get_source() {
  step_header "2/6" "Download Source Code"

  if [ -d "$INSTALL_DIR/.git" ]; then
    info "Repository already exists at ${INSTALL_DIR}"
    info "Updating to latest version..."
    cd "$INSTALL_DIR"
    if git pull --ff-only 2>&1; then
      ok "Repository updated"
    else
      warn "Could not update (may be on a custom branch) — using existing code"
    fi
  else
    if [ -d "$INSTALL_DIR" ]; then
      warn "Directory ${INSTALL_DIR} exists but is not a git repo."
      read -rp "$(echo -e "${YELLOW}[?]${NC} Delete and re-clone? [y/N]: ")" choice
      if [[ "$choice" =~ ^[Yy]$ ]]; then
        rm -rf "$INSTALL_DIR"
      else
        error "Cannot proceed."
        echo -e "  Set STEFCO_INSTALL_DIR to a different path, e.g.:"
        echo -e "  ${CYAN}STEFCO_INSTALL_DIR=~/my-stefco ./install.sh${NC}"
        pause_on_error "Source Directory" "Directory conflict at ${INSTALL_DIR}"
        return
      fi
    fi
    info "Cloning repository to ${INSTALL_DIR}..."
    if git clone "$REPO_URL" "$INSTALL_DIR" 2>&1; then
      ok "Repository cloned"
    else
      pause_on_error "Git Clone" "Failed to clone ${REPO_URL}. Check your internet connection."
      return
    fi
  fi

  pause
}

# ── Interactive Configuration ───────────────────────────────────────────────
configure_env() {
  step_header "3/6" "Configuration"

  cd "$INSTALL_DIR"

  if [ -f .env ]; then
    info ".env already exists. Skipping configuration."
    echo -e "  ${BOLD}Edit manually:${NC}  nano $INSTALL_DIR/.env"
    pause
    return
  fi

  info "Setting up configuration..."

  # Copy template
  if ! cp .env.example .env 2>/dev/null; then
    pause_on_error "Config Template" "Could not find .env.example in ${INSTALL_DIR}"
    return
  fi

  echo ""
  echo -e "${BOLD}── Quick Configuration ──${NC}"
  echo -e "  You can press ${BOLD}Enter${NC} to skip any optional setting."
  echo -e "  All settings can be changed later in: ${CYAN}${INSTALL_DIR}/.env${NC}"
  echo ""

  # Port
  read -rp "  Dashboard port [${DEFAULT_PORT}]: " port_input
  port_input="${port_input:-$DEFAULT_PORT}"
  sed -i.bak "s/^# APP_PORT=.*/APP_PORT=${port_input}/" .env 2>/dev/null
  sed -i.bak "/^APP_PORT=/! s|^# APP_PORT=.*|APP_PORT=${port_input}|" .env 2>/dev/null
  if ! grep -q "^APP_PORT=" .env; then
    echo "APP_PORT=${port_input}" >> .env
  fi
  ok "Port set to ${port_input}"

  # AI Provider
  echo ""
  echo -e "  ${BOLD}AI Provider${NC} (used for email classification & data extraction)"
  read -rp "  Choose provider [gemini] (gemini / groq / openrouter): " ai_input
  ai_input="${ai_input:-gemini}"
  sed -i.bak "s/^AI_PROVIDER=.*/AI_PROVIDER=${ai_input}/" .env 2>/dev/null
  ok "AI provider: ${ai_input}"

  # AI API Key
  case "$ai_input" in
    gemini)
      read -rp "  Gemini API Key (leave empty to configure later): " key_input
      sed -i.bak "s/^GEMINI_API_KEY=.*/GEMINI_API_KEY=${key_input}/" .env 2>/dev/null
      [ -n "$key_input" ] && ok "Gemini API key set" || warn "No API key — AI features will be limited"
      ;;
    groq)
      read -rp "  Groq API Key (leave empty to configure later): " key_input
      sed -i.bak "s/^GROQ_API_KEY=.*/GROQ_API_KEY=${key_input}/" .env 2>/dev/null
      [ -n "$key_input" ] && ok "Groq API key set" || warn "No API key — AI features will be limited"
      ;;
    openrouter)
      read -rp "  OpenRouter API Key (leave empty to configure later): " key_input
      sed -i.bak "s/^OPENROUTER_API_KEY=.*/OPENROUTER_API_KEY=${key_input}/" .env 2>/dev/null
      [ -n "$key_input" ] && ok "OpenRouter API key set" || warn "No API key — AI features will be limited"
      ;;
  esac

  # Email (IMAP)
  echo ""
  echo -e "  ${BOLD}Email Settings${NC} (optional — used for auto-importing claim emails)"
  echo -e "  Leave empty to skip. You can configure later via the in-app Setup Wizard."
  read -rp "  IMAP Host (e.g. imap.gmail.com): " imap_host
  if [ -n "$imap_host" ]; then
    read -rp "  IMAP Port [993]: " imap_port
    read -rp "  IMAP Username (email): " imap_user
    read -rp "  IMAP Password: " -s imap_pass
    echo ""
    sed -i.bak "s|^IMAP_HOST=.*|IMAP_HOST=${imap_host}|" .env 2>/dev/null
    sed -i.bak "s|^IMAP_PORT=.*|IMAP_PORT=${imap_port:-993}|" .env 2>/dev/null
    sed -i.bak "s|^IMAP_USER=.*|IMAP_USER=${imap_user}|" .env 2>/dev/null
    sed -i.bak "s|^IMAP_PASSWORD=.*|IMAP_PASSWORD=${imap_pass}|" .env 2>/dev/null
    ok "IMAP configured: ${imap_host}"
  else
    warn "IMAP not configured — email polling disabled"
  fi

  # Email (SMTP)
  echo ""
  read -rp "  SMTP Host (e.g. smtp.gmail.com, leave empty to skip): " smtp_host
  if [ -n "$smtp_host" ]; then
    read -rp "  SMTP Port [587]: " smtp_port
    read -rp "  SMTP Username (email): " smtp_user
    read -rp "  SMTP Password: " -s smtp_pass
    echo ""
    sed -i.bak "s|^SMTP_HOST=.*|SMTP_HOST=${smtp_host}|" .env 2>/dev/null
    sed -i.bak "s|^SMTP_PORT=.*|SMTP_PORT=${smtp_port:-587}|" .env 2>/dev/null
    sed -i.bak "s|^SMTP_USER=.*|SMTP_USER=${smtp_user}|" .env 2>/dev/null
    sed -i.bak "s|^SMTP_PASSWORD=.*|SMTP_PASSWORD=${smtp_pass}|" .env 2>/dev/null
    ok "SMTP configured: ${smtp_host}"
  else
    warn "SMTP not configured — auto-reply emails disabled"
  fi

  # Clean up backup files
  rm -f .env.bak

  ok "Configuration saved to .env"

  pause
}

# ── Build and Start ─────────────────────────────────────────────────────────
build_and_start() {
  step_header "4/6" "Build Docker Image"

  cd "$INSTALL_DIR"

  info "Building Docker image (this may take a few minutes on first run)..."
  echo -e "${DIM}  ───────────────────────────────────────────────────────${NC}"
  echo ""

  local build_exit_code=0
  docker compose build --no-cache 2>&1 | while IFS= read -r line; do
    echo "  $line"
  done || build_exit_code=$?

  echo ""
  echo -e "${DIM}  ───────────────────────────────────────────────────────${NC}"
  echo ""

  if [ $build_exit_code -ne 0 ]; then
    pause_on_error "Docker Build" "Build exited with code ${build_exit_code}. Check the error output above."
  else
    ok "Docker image built successfully"
  fi

  pause

  step_header "5/6" "Start Containers"

  info "Starting containers..."
  echo -e "${DIM}  ───────────────────────────────────────────────────────${NC}"
  echo ""

  local start_exit_code=0
  docker compose up -d 2>&1 | while IFS= read -r line; do
    echo "  $line"
  done || start_exit_code=$?

  echo ""
  echo -e "${DIM}  ───────────────────────────────────────────────────────${NC}"
  echo ""

  if [ $start_exit_code -ne 0 ]; then
    pause_on_error "Container Start" "docker compose up exited with code ${start_exit_code}. Check the output above."
  else
    ok "Containers started"
  fi

  pause
}

# ── Wait for Healthy ────────────────────────────────────────────────────────
wait_for_healthy() {
  step_header "6/6" "Health Check"

  info "Waiting for dashboard to become healthy..."
  echo -e "${DIM}  (this checks the /api/health endpoint every 3 seconds)${NC}"
  echo ""

  local max_attempts=30
  local attempt=1

  while [ $attempt -le $max_attempts ]; do
    local status
    status=$(docker inspect --format='{{.State.Health.Status}}' "$CONTAINER_NAME" 2>/dev/null || echo "not found")

    case "$status" in
      healthy)
        ok "Dashboard is healthy!"
        return 0
        ;;
      unhealthy)
        error "Dashboard health check FAILED!"
        echo ""
        info "Showing recent container logs:"
        echo -e "${DIM}  ───────────────────────────────────────────────────────${NC}"
        docker logs --tail 30 "$CONTAINER_NAME" 2>&1 | while IFS= read -r line; do echo "  $line"; done
        echo -e "${DIM}  ───────────────────────────────────────────────────────${NC}"
        echo ""
        pause_on_error "Health Check" "Container is unhealthy. See logs above for details."
        return 0
        ;;
      *)
        printf "\r  Waiting... (%d/%d) status=%-10s" "$attempt" "$max_attempts" "$status"
        sleep 3
        attempt=$((attempt + 1))
        ;;
    esac
  done

  echo ""
  warn "Health check timed out after 90 seconds."
  echo ""
  info "The container may still be starting. Checking logs..."
  echo -e "${DIM}  ───────────────────────────────────────────────────────${NC}"
  docker logs --tail 15 "$CONTAINER_NAME" 2>&1 | while IFS= read -r line; do echo "  $line"; done
  echo -e "${DIM}  ───────────────────────────────────────────────────────${NC}"
  echo ""
  pause_on_error "Health Check Timeout" "Container did not become healthy within 90 seconds."
}

# ── Show Summary ────────────────────────────────────────────────────────────
show_summary() {
  cd "$INSTALL_DIR"
  local port
  port=$(grep '^APP_PORT=' .env 2>/dev/null | cut -d= -f2 || echo "$DEFAULT_PORT")

  echo ""
  echo -e "${GREEN}${BOLD}═══════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}${BOLD}  INSTALLATION COMPLETE!                            ${NC}"
  echo -e "${GREEN}${BOLD}═══════════════════════════════════════════════════${NC}"
  echo ""
  echo -e "  ${BOLD}Dashboard URL:${NC}    ${CYAN}http://localhost:${port}${NC}"
  echo -e "  ${BOLD}Config file:${NC}      ${INSTALL_DIR}/.env"
  echo -e "  ${BOLD}Install directory:${NC} ${INSTALL_DIR}"
  echo -e "  ${BOLD}Container name:${NC}   ${CONTAINER_NAME}"
  echo ""
  echo -e "  ${BOLD}Useful Commands:${NC}"
  echo -e "    ./start.sh              Start the dashboard"
  echo -e "    ./stop.sh               Stop the dashboard"
  echo -e "    ./uninstall.sh          Remove everything"
  echo -e "    docker logs -f ${CONTAINER_NAME}   View live logs"
  echo -e "    docker compose restart               Restart after config change"
  echo ""
  echo -e "  ${BOLD}First-time setup:${NC}"
  echo -e "    Open the dashboard in your browser and use the"
  echo -e "    in-app ${CYAN}Installation Manager${NC} (wrench icon) to complete configuration."
  echo ""
  echo -e "${GREEN}${BOLD}═══════════════════════════════════════════════════${NC}"
  echo ""
}

# ── Main ─────────────────────────────────────────────────────────────────────
main() {
  header

  # Check if we're running inside the repo already
  if [ -f "docker-compose.yml" ] && [ -f "Dockerfile" ]; then
    info "Detected running from within the repository."
    INSTALL_DIR="$(pwd)"
    info "Install directory: ${INSTALL_DIR}"
  fi

  check_prerequisites

  if [ "$(pwd)" != "$INSTALL_DIR" ]; then
    get_source
  fi

  configure_env
  build_and_start

  wait_for_healthy
  show_summary
}

main "$@"
