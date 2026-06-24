#!/usr/bin/env bash
set -euo pipefail

# One-command fresh-server recovery and deployment.
#
# Usage:
#   ./deploy_and_restart.sh --host root@153.75.247.188 --domain extracash.mkopaji.com --email admin@extracash.mkopaji.com
#
# Optional:
#   --repo https://github.com/<owner>/<repo>.git
#   --branch main
#   --project-dir /var/www/talaextra
#   --skip-env-sync

HOST=""
DOMAIN=""
EMAIL=""
REPO_URL=""
BRANCH="main"
PROJECT_DIR="/var/www/talaextra"
SYNC_ENV="1"

while [[ $# -gt 0 ]]; do
	case "$1" in
		--host)
			HOST="$2"
			shift 2
			;;
		--domain)
			DOMAIN="$2"
			shift 2
			;;
		--email)
			EMAIL="$2"
			shift 2
			;;
		--repo)
			REPO_URL="$2"
			shift 2
			;;
		--branch)
			BRANCH="$2"
			shift 2
			;;
		--project-dir)
			PROJECT_DIR="$2"
			shift 2
			;;
		--skip-env-sync)
			SYNC_ENV="0"
			shift
			;;
		-h|--help)
			sed -n '1,60p' "$0"
			exit 0
			;;
		*)
			echo "Unknown argument: $1"
			exit 1
			;;
	esac
done

if [[ -z "$HOST" || -z "$DOMAIN" || -z "$EMAIL" ]]; then
	echo "Missing required args. Use --host, --domain, --email."
	exit 1
fi

if [[ -z "$REPO_URL" ]]; then
	REPO_URL="$(git config --get remote.origin.url || true)"
fi

if [[ -z "$REPO_URL" ]]; then
	echo "Could not detect repository URL. Pass --repo explicitly."
	exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_BACKEND_ENV="${SCRIPT_DIR}/backend/.env"
LOCAL_FRONTEND_ENV="${SCRIPT_DIR}/frontend/.env"

SSH_BASE_OPTS=(-o StrictHostKeyChecking=accept-new)
if [[ -n "${SSH_PASSWORD:-}" ]]; then
	if ! command -v sshpass >/dev/null 2>&1; then
		echo "SSH_PASSWORD is set but sshpass is not installed."
		exit 1
	fi
	SSH_CMD=(sshpass -p "$SSH_PASSWORD" ssh "${SSH_BASE_OPTS[@]}")
	SCP_CMD=(sshpass -p "$SSH_PASSWORD" scp "${SSH_BASE_OPTS[@]}")
else
	SSH_CMD=(ssh "${SSH_BASE_OPTS[@]}")
	SCP_CMD=(scp "${SSH_BASE_OPTS[@]}")
fi

echo "Starting remote recovery on ${HOST} for ${DOMAIN}"

if [[ "$SYNC_ENV" == "1" ]]; then
	echo "Syncing local env files to remote temporary location"
	"${SSH_CMD[@]}" "$HOST" "mkdir -p /tmp/talaextra-recovery-env"
	if [[ -f "$LOCAL_BACKEND_ENV" ]]; then
		"${SCP_CMD[@]}" "$LOCAL_BACKEND_ENV" "$HOST:/tmp/talaextra-recovery-env/backend.env"
	else
		echo "Local backend/.env not found. Remote will fallback to .env.example"
	fi
	if [[ -f "$LOCAL_FRONTEND_ENV" ]]; then
		"${SCP_CMD[@]}" "$LOCAL_FRONTEND_ENV" "$HOST:/tmp/talaextra-recovery-env/frontend.env"
	else
		echo "Local frontend/.env not found. Remote will fallback to .env.example"
	fi
fi

"${SSH_CMD[@]}" "$HOST" bash -s -- "$DOMAIN" "$EMAIL" "$REPO_URL" "$BRANCH" "$PROJECT_DIR" <<'REMOTE_SCRIPT'
set -euo pipefail

DOMAIN="$1"
EMAIL="$2"
REPO_URL="$3"
BRANCH="$4"
PROJECT_DIR="$5"

WWW_DOMAIN="www.${DOMAIN}"
NGINX_CONF="/etc/nginx/sites-available/${DOMAIN}.conf"

upsert_env() {
	local key="$1"
	local value="$2"
	local file="$3"
	local escaped
	escaped="$(printf '%s' "$value" | sed 's/[&|]/\\&/g')"

	if grep -q "^${key}=" "$file"; then
		sed -i "s|^${key}=.*|${key}=${escaped}|" "$file"
	else
		echo "${key}=${value}" >> "$file"
	fi
}

echo "[1/8] Installing system dependencies"
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl git nginx certbot python3-certbot-nginx

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
	echo "Installing Node.js 20 + npm"
	curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
	apt-get install -y nodejs
fi

if ! command -v pm2 >/dev/null 2>&1; then
	npm install -g pm2
fi

echo "[2/8] Cloning or updating project"
mkdir -p "$(dirname "$PROJECT_DIR")"
if [[ ! -d "$PROJECT_DIR/.git" ]]; then
	git clone "$REPO_URL" "$PROJECT_DIR"
fi

cd "$PROJECT_DIR"
git fetch --all --prune
git checkout "$BRANCH"
git pull origin "$BRANCH"

echo "[3/8] Preparing environment files"
if [[ -f /tmp/talaextra-recovery-env/backend.env ]]; then
	cp /tmp/talaextra-recovery-env/backend.env backend/.env
	chmod 600 backend/.env
	echo "Applied backend/.env from local machine"
elif [[ ! -f backend/.env ]]; then
	cp backend/.env.example backend/.env
	echo "Created backend/.env from template"
fi

if [[ -f /tmp/talaextra-recovery-env/frontend.env ]]; then
	cp /tmp/talaextra-recovery-env/frontend.env frontend/.env
	chmod 600 frontend/.env
	echo "Applied frontend/.env from local machine"
elif [[ ! -f frontend/.env ]]; then
	cp frontend/.env.example frontend/.env
fi

upsert_env "NODE_ENV" "production" "backend/.env"
upsert_env "ALLOWED_ORIGINS" "https://${DOMAIN},https://www.${DOMAIN}" "backend/.env"
upsert_env "ALLOWED_BASE_DOMAIN" "${DOMAIN}" "backend/.env"
upsert_env "APP_PUBLIC_URL" "https://${DOMAIN}" "backend/.env"
upsert_env "MPESA_CALLBACK_URL" "https://${DOMAIN}/api/mpesa/callback" "backend/.env"

upsert_env "REACT_APP_API_URL" "https://${DOMAIN}/api" "frontend/.env"

echo "[4/8] Installing backend dependencies"
cd "$PROJECT_DIR/backend"
npm ci

echo "[5/8] Installing and building frontend"
cd "$PROJECT_DIR/frontend"
npm ci
npm run build

echo "[6/8] Starting backend with PM2"
cd "$PROJECT_DIR/backend"
if pm2 describe talaextra-backend >/dev/null 2>&1; then
	pm2 restart talaextra-backend --update-env
else
	pm2 start npm --name talaextra-backend -- start
fi
pm2 save
pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true

echo "[7/8] Configuring Nginx"
cat > "$NGINX_CONF" <<NGINX
server {
	listen 80;
	server_name ${DOMAIN} ${WWW_DOMAIN};

	root ${PROJECT_DIR}/frontend/build;
	index index.html;

	location /api/ {
		proxy_pass http://127.0.0.1:5000/api/;
		proxy_http_version 1.1;
		proxy_set_header Host \$host;
		proxy_set_header X-Real-IP \$remote_addr;
		proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
		proxy_set_header X-Forwarded-Proto \$scheme;
	}

	location / {
		try_files \$uri /index.html;
	}
}
NGINX

ln -sf "$NGINX_CONF" "/etc/nginx/sites-enabled/${DOMAIN}.conf"
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable nginx
systemctl restart nginx

echo "[8/8] Issuing SSL certificate"
if certbot certificates 2>/dev/null | grep -q "Domains:.*${DOMAIN}"; then
	certbot renew --quiet || true
else
	certbot --nginx -d "$DOMAIN" -d "$WWW_DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect || \
	certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect
fi

echo
echo "Recovery complete."
echo "Health check: https://${DOMAIN}/api/health"
echo "Removing temporary env sync files"
rm -rf /tmp/talaextra-recovery-env
REMOTE_SCRIPT

echo "Done."
