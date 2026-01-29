#!/bin/bash

# Setup script for Auto repository
# This script configures the git repository with proper settings

echo "Setting up Auto repository..."

# Configure git user
git config user.name "Auto Setup"
git config user.email "auto@example.com"

# Set up git hooks
echo "Creating git hooks..."

# Create pre-commit hook
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
echo "Running pre-commit checks..."

# Basic checks
if git diff --cached --name-only | grep -E '\.(js|json|md)$'; then
    echo "Checking JavaScript files..."
    # Add any JS linting here if needed
fi

echo "Pre-commit checks completed."
EOF

chmod +x .git/hooks/pre-commit

# Create post-commit hook
cat > .git/hooks/post-commit << 'EOF'
#!/bin/bash
echo "Post-commit hook executed."
echo "Repository updated at $(date)"
EOF

chmod +x .git/hooks/post-commit

# Configure git ignore
cat > .gitignore << 'EOF'
# Dependencies
/node_modules
/.npm
*.log

# Environment variables
.env

# OS generated files
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/

# Build artifacts
/build
/dist

# Local storage
*.localstorage
EOF

echo "Git repository setup complete!"
echo "Remember to create a .env file with your environment variables:"
echo ""
echo "JWT_SECRET=your-super-secret-jwt-key-change-this-in-production"
echo "OLLAMA_URL=http://localhost:11434"
echo "PORT=3000"
echo "ALLOWED_ORIGINS=http://localhost:8080,https://sohaltweil.github.io"