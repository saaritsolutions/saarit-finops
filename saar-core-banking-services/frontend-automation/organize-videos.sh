#!/bin/bash

# SaaR Banking - UI Recording Organizer
# This script organizes the Playwright video recordings with descriptive names

echo "🎬 SaaR Banking - UI Recording Organizer"
echo "========================================"

# Create videos directory if it doesn't exist
mkdir -p videos

# Copy and rename videos with descriptive names
echo "📹 Organizing video recordings..."

# Scenario 1: Credit Score Expression Changes
if [ -f "test-results/advanced-e2e-optimized-Saa-24d7c-hanges-Impact-Loan-Creation-demo-full/video.webm" ]; then
    cp "test-results/advanced-e2e-optimized-Saa-24d7c-hanges-Impact-Loan-Creation-demo-full/video.webm" "videos/01-Credit-Score-Expression-Changes.webm"
    echo "✅ Scenario 1: Credit Score Expression Changes → videos/01-Credit-Score-Expression-Changes.webm"
fi

# Scenario 2: Dynamic Form Configuration  
if [ -f "test-results/advanced-e2e-optimized-Saa-d7535----Add-Modify-Delete-Fields-demo-full/video.webm" ]; then
    cp "test-results/advanced-e2e-optimized-Saa-d7535----Add-Modify-Delete-Fields-demo-full/video.webm" "videos/02-Dynamic-Form-Configuration.webm"
    echo "✅ Scenario 2: Dynamic Form Configuration → videos/02-Dynamic-Form-Configuration.webm"
fi

# Scenario 3: Workflow Configuration
if [ -f "test-results/advanced-e2e-optimized-Saa-3c7d4---Enhanced-Approval-Process-demo-full/video.webm" ]; then
    cp "test-results/advanced-e2e-optimized-Saa-3c7d4---Enhanced-Approval-Process-demo-full/video.webm" "videos/03-Workflow-Configuration.webm"
    echo "✅ Scenario 3: Workflow Configuration → videos/03-Workflow-Configuration.webm"
fi

# Summary
if [ -f "test-results/advanced-e2e-optimized-Saa-b6d93--Advanced-Scenarios-Summary-demo-full/video.webm" ]; then
    cp "test-results/advanced-e2e-optimized-Saa-b6d93--Advanced-Scenarios-Summary-demo-full/video.webm" "videos/04-Advanced-Scenarios-Summary.webm"
    echo "✅ Summary: Advanced Scenarios Summary → videos/04-Advanced-Scenarios-Summary.webm"
fi

echo ""
echo "📊 Video Recording Summary:"
echo "=========================="
ls -lh videos/*.webm 2>/dev/null | while read -r line; do
    filename=$(echo "$line" | awk '{print $9}')
    size=$(echo "$line" | awk '{print $5}')
    echo "📹 $(basename "$filename" .webm): $size"
done

echo ""
echo "🎯 Demo Videos Ready!"
echo "===================="
echo "📁 Location: ./videos/"
echo "🎬 Format: WebM (compatible with all browsers)"
echo "📊 Total Scenarios: 4 videos"
echo "⏱️  Total Duration: ~25 seconds across all scenarios"
echo ""
echo "🚀 Usage:"
echo "--------"
echo "• Open videos in any browser or video player"
echo "• Perfect for investor presentations"
echo "• Shows real-time platform capabilities"
echo "• Demonstrates no-code configuration power"
echo ""
echo "🎭 Video Content:"
echo "=================="
echo "1️⃣ Credit Score Expression Changes - Real-time business rule modification"
echo "2️⃣ Dynamic Form Configuration - Add, modify, delete form fields instantly"  
echo "3️⃣ Workflow Configuration - Enhanced approval process management"
echo "4️⃣ Advanced Scenarios Summary - Complete platform demonstration"
