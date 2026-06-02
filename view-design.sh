#!/usr/bin/env bash
# claude.ai/design 핸드오프 번들을 받아서 압축 풀고 로컬 서버로 띄운다.
# 디자인을 수정한 뒤 이 스크립트만 다시 실행하면 최신본이 브라우저에 뜬다.
#
# 핸드오프 URL은 디자인을 내보낼 때마다 새로 발급된다(핸들이 바뀜).
# 그래서 최신 URL을 인자로 넘기는 것을 권장한다. 안 넘기면 마지막으로 쓴 URL을 재사용한다.
#
# 사용법:
#   ./view-design.sh "https://api.anthropic.com/v1/design/h/<핸들>?open_file=index.html"
#   ./view-design.sh            # 인자 없으면 직전에 쓴 URL 재사용
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
URL_CACHE="$HERE/.design-url"

if [[ "${1:-}" == http* ]]; then
  URL="$1"
  printf '%s\n' "$URL" > "$URL_CACHE"      # 다음 실행을 위해 기억
elif [[ -f "$URL_CACHE" ]]; then
  URL="$(cat "$URL_CACHE")"
  echo "ℹ 저장된 URL 재사용: $URL"
else
  echo "✗ URL이 없습니다. 최신 핸드오프 URL을 인자로 넘기세요:" >&2
  echo "    ./view-design.sh \"https://api.anthropic.com/v1/design/h/<핸들>?open_file=index.html\"" >&2
  exit 1
fi
PORT="${PORT:-8755}"
DEST="$(cd "$(dirname "$0")" && pwd)/.design-live"

echo "▶ 최신 디자인 내려받는 중..."
TMP="$(mktemp -d)"
curl -fsSL "$URL" -o "$TMP/handoff.tar.gz"
tar -xzf "$TMP/handoff.tar.gz" -C "$TMP"

# 번들 구조: <something>/project/ 안에 실제 파일들이 있다
PROJ_DIR="$(dirname "$(find "$TMP" -name index.html -path '*/project/*' | head -1)")"
rm -rf "$DEST"
mkdir -p "$DEST"
cp -r "$PROJ_DIR/." "$DEST/"
rm -rf "$TMP"
echo "▶ 압축 해제 완료 → $DEST"

# 기존 서버가 같은 포트에 떠 있으면 정리
if lsof -ti tcp:"$PORT" >/dev/null 2>&1; then
  kill "$(lsof -ti tcp:"$PORT")" 2>/dev/null || true
  sleep 0.3
fi

echo "▶ http://127.0.0.1:$PORT/index.html 에서 보기 (Ctrl+C 로 종료)"
cd "$DEST"
exec python3 -m http.server "$PORT" --bind 127.0.0.1
