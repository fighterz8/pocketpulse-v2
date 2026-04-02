#!/bin/bash
set -e

WORKTREE=".worktrees/phase-1-auth-account-setup"

if [ -d "$WORKTREE" ]; then
  cd "$WORKTREE"
  npm install --prefer-offline
else
  npm install --prefer-offline
fi
