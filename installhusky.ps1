# installhusky.ps1
# Run this from the root of your project

# Step 1: Ensure .husky folder exists
if (-not (Test-Path ".husky")) {
    New-Item -ItemType Directory -Path ".husky"
}

# Step 2: Create .husky/pre-commit script with correct shell content
@'
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

npx lint-staged
'@ | Out-File -FilePath ".husky/pre-commit" -Encoding ASCII -Force

# Step 3: Mark it executable so Git recognizes it
git update-index --add --chmod=+x .husky/pre-commit

Write-Host "✅ Husky pre-commit hook installed successfully."
