#!/bin/bash

echo "================================================"
echo "NoSQLite Labs - Build Status Checker"
echo "================================================"
echo ""

# Check if build is running
if pgrep -f "tauri build" > /dev/null; then
    echo "✓ Build is currently running..."
    echo ""
    
    # Show recent log output
    if [ -f build.log ]; then
        echo "Recent build output:"
        echo "-------------------"
        tail -20 build.log
    fi
else
    echo "✗ Build is not running"
fi

echo ""
echo "================================================"
echo "Checking for build artifacts..."
echo "================================================"
echo ""

# Check for the executable
BUNDLE_DIR="src-tauri/target/release/bundle"

if [ -d "$BUNDLE_DIR" ]; then
    echo "✓ Build artifacts found!"
    echo ""
    
    # List all build outputs
    echo "Available builds:"
    find "$BUNDLE_DIR" -type f -name "*.exe" -o -name "*.deb" -o -name "*.AppImage" -o -name "*.dmg" 2>/dev/null
    
    echo ""
    echo "Full bundle directory structure:"
    ls -lah "$BUNDLE_DIR"
else
    echo "✗ No build artifacts found yet"
    echo "  The executable will be located at:"
    echo "  - Windows: src-tauri/target/release/bundle/msi/NoSQLite Labs_0.1.0_x64_en-US.msi"
    echo "  - Linux: src-tauri/target/release/bundle/deb/nosqlite-labs_0.1.0_amd64.deb"
    echo "  - Linux: src-tauri/target/release/bundle/appimage/nosqlite-labs_0.1.0_amd64.AppImage"
fi

echo ""
echo "================================================"
echo "Direct executable (if built):"
echo "================================================"

if [ -f "src-tauri/target/release/nosqlite-labs" ]; then
    echo "✓ Linux executable: src-tauri/target/release/nosqlite-labs"
    ls -lh src-tauri/target/release/nosqlite-labs
elif [ -f "src-tauri/target/release/nosqlite-labs.exe" ]; then
    echo "✓ Windows executable: src-tauri/target/release/nosqlite-labs.exe"
    ls -lh src-tauri/target/release/nosqlite-labs.exe
else
    echo "✗ Direct executable not found yet (still building)"
fi

echo ""
echo "================================================"
echo "To monitor the build progress, run:"
echo "  tail -f build.log"
echo "================================================"
