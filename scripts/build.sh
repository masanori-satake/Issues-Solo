#!/bin/bash
set -e

# Extract version from package.json using python3 (safe and zero additional dependency in most CI/dev environments)
VERSION=$(python3 -c "import json; print(json.load(open('package.json'))['version'])")

echo "Building Issues-Solo version $VERSION..."

# Ensure we are in the root directory (where package.json is)
if [ ! -f "package.json" ]; then
    echo "Error: package.json not found. Please run this script from the project root."
    exit 1
fi

# Create releases directory if it doesn't exist
mkdir -p releases

# Zip the extension files using glob patterns for better maintainability.
# Includes manifest.json, all root-level JS, HTML, CSS files, and the LICENSE.
zip -r "releases/issues-solo-v${VERSION}.zip" manifest.json *.js *.html *.css LICENSE

echo "Successfully built releases/issues-solo-v${VERSION}.zip"
