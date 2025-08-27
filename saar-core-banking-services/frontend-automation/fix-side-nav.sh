#!/bin/bash

# Quick fix to add side navigation closing after every page.goto in the production test file

sed -i '' 's/await page\.goto(\(.*\));$/await page.goto(\1);\
      await page.waitForLoadState('\''networkidle'\'');\
      await page.waitForTimeout(2000);\
      \
      \/\/ Close side navigation that might be blocking the interface\
      await closeSideNavigation(page);/g' tests/production-ready-e2e.spec.js

echo "✅ Added side navigation closing after all page.goto statements"
