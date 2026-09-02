#!/usr/bin/env bash
# scripts/push-pending-docs-commits.sh
#
# 목적: 로컬 main 브랜치가 origin/main보다 앞서 있는 미푸시 커밋을 안전하게 origin에 반영한다.
# 배경(2026-09-01): 로컬 main이 origin/main 대비 7커밋 앞서 있었음
#       (소개서 v2/v3 반영, AX 체크 질문지 v1 확정 등 docs 커밋).
#       이 스크립트는 Claude Code 로컬 세션(사용자 PC의 일반 git 환경)에서
#       실행하는 것을 전제로 한다 — Cowork 원격 device-bash/FUSE 마운트 환경에서는
#       실행하지 말 것 (.git/index.lock 잔류, post-commit 훅 미동작 등 알려진 문제).
#
# 사용법:
#   ./scripts/push-pending-docs-commits.sh              # 기본: 검증 + 확인 후 push
#   ./scripts/push-pending-docs-commits.sh --dry-run     # push 없이 점검만
#   ./scripts/push-pending-docs-commits.sh --skip-checks # lint/typecheck/test 건너뛰기

set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

SKIP_CHECKS=false
DRY_RUN=false
for arg in "$@"; do
  case "$arg" in
    --skip-checks) SKIP_CHECKS=true ;;
    --dry-run) DRY_RUN=true ;;
    *) echo "알 수 없는 옵션: $arg" >&2; exit 1 ;;
  esac
done

echo "==> 현재 브랜치 확인"
current_branch="$(git rev-parse --abbrev-ref HEAD)"
if [ "$current_branch" != "main" ]; then
  echo "!! main 브랜치가 아닙니다 (현재: $current_branch). main으로 전환 후 다시 실행하세요." >&2
  exit 1
fi

echo "==> origin 최신 정보 가져오기"
git fetch origin

ahead_count="$(git rev-list --count origin/main..HEAD)"
behind_count="$(git rev-list --count HEAD..origin/main)"

if [ "$behind_count" -gt 0 ]; then
  echo "!! origin/main이 로컬보다 ${behind_count}커밋 앞서 있습니다. 먼저 'git pull --rebase origin main'으로 동기화하세요." >&2
  exit 1
fi

if [ "$ahead_count" -eq 0 ]; then
  echo "==> push할 커밋이 없습니다 (로컬 main == origin/main). 종료합니다."
  exit 0
fi

echo "==> push 예정 커밋 (${ahead_count}건)"
git log origin/main..HEAD --oneline

echo
echo "==> 작업 트리 상태 확인"
if [ -n "$(git status --porcelain)" ]; then
  echo "!! 커밋되지 않은 변경사항이 있습니다. 의도한 변경이 아니면 중단하세요:" >&2
  git status --short
  read -r -p "그래도 계속 진행하시겠습니까? (y/N) " confirm
  if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "중단했습니다."
    exit 1
  fi
fi

if [ "$SKIP_CHECKS" = false ]; then
  echo
  echo "==> 배포 전 검증 (lint / typecheck / test) — CLAUDE.md 5번 규칙"
  pnpm lint
  npx tsc --noEmit
  pnpm test
else
  echo "==> --skip-checks 지정됨: lint/typecheck/test 건너뜀"
fi

echo
echo "==> push 대상 변경 요약"
git diff --stat origin/main..HEAD

if [ "$DRY_RUN" = true ]; then
  echo
  echo "==> --dry-run 모드: 실제 push는 실행하지 않았습니다."
  exit 0
fi

echo
read -r -p "위 ${ahead_count}개 커밋을 origin/main에 push 하시겠습니까? (y/N) " final_confirm
if [[ ! "$final_confirm" =~ ^[Yy]$ ]]; then
  echo "취소했습니다."
  exit 1
fi

git push origin main

echo
echo "==> push 완료."
echo "    참고: 이 커밋들은 Cowork 원격(device-bash/FUSE) 환경에서 생성되어"
echo "    post-commit 훅(Notion Tasks 자동 기록)이 동작하지 않았을 수 있습니다."
echo "    Notion 작업 로그 DB 반영이 필요하면 fifty-ledger Skill로 수동 기록하세요."
