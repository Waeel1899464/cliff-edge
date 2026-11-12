#!/bin/sh
# Runs every V3 test, one after another, and prints one line per test file at the end.
# Usage: sh tests/run-all.sh            (builds the pages first, then tests them)
cd "$(dirname "$0")/.."
./build.sh crazygames-v3 >/dev/null && ./build.sh web-v3 >/dev/null || exit 1
FAIL=0; SUMMARY=""
for t in precision game worlds v3 web-v3 art qa-full v5; do
  OUT=$(node "tests/$t.test.js" 2>&1); CODE=$?
  LINE=$(printf '%s\n' "$OUT" | grep -E '^[0-9]+/[0-9]+ passed' | tail -1)
  [ -z "$LINE" ] && LINE="did not finish"
  if [ $CODE -ne 0 ]; then FAIL=1; SUMMARY="$SUMMARY\nFAIL  $t: $LINE"; printf '%s\n' "$OUT" | grep '^FAIL' | sed 's/^/      /';
  else SUMMARY="$SUMMARY\nPASS  $t: $LINE"; fi
done
node tools/sim/sim.js --worlds >/dev/null 2>&1 && SUMMARY="$SUMMARY\nPASS  simulator: all 50 cliffs computed" || { FAIL=1; SUMMARY="$SUMMARY\nFAIL  simulator"; }
sh tools/check-protected.sh >/dev/null 2>&1 && SUMMARY="$SUMMARY\nPASS  protected files unchanged" || { FAIL=1; SUMMARY="$SUMMARY\nFAIL  protected files: run sh tools/check-protected.sh"; }
printf "$SUMMARY\n"
[ $FAIL -eq 0 ] && echo "ALL PASSED" || echo "SOME TESTS FAILED"
exit $FAIL
