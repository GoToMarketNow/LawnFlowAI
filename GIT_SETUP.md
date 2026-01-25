# Git Repository Setup - LawnFlowAI

## ✅ Repository Configuration Complete

**Primary Repository**: https://github.com/GoToMarketNow/LawnFlowAI.git

**Local Path**: `C:\Users\James\LawnFlowAI-main`

**Branch**: `main`

---

## Current Configuration

### Git User
- **Name**: GoToMarketNOW
- **Email**: james@gotomarketnow.com

### Remote
- **Origin**: https://github.com/GoToMarketNow/LawnFlowAI.git
- **Authentication**: Windows Credential Manager (automatic)

### Recent Commits
1. `8d48cfb` - Update deployment configuration for Vercel compatibility
2. `0905a59` - Add Vercel deployment configuration and documentation
3. `8f85767` - Initial deployment: Sync LawnFlowAI codebase for production deployment

---

## Important Notes

### ⚠️ Always Work in the Correct Directory
**ALWAYS** ensure you're working in: `C:\Users\James\LawnFlowAI-main`

**DO NOT** work from `C:\Users\James` (your Windows user directory)

### ✅ Changes Successfully Merged
The following issues were resolved:
- Removed incorrect git repository from `C:\Users\James`
- Committed pending changes (package.json, vercel.json) to main repo
- Successfully pushed all changes to GitHub
- Verified GitHub connection and authentication

---

## How to Commit Changes (For Agents & Future Work)

### 1. Check Status
```bash
cd C:\Users\James\LawnFlowAI-main
git status
```

### 2. Review Changes
```bash
git diff                    # See unstaged changes
git diff --staged          # See staged changes
```

### 3. Stage Files
```bash
git add <file1> <file2>    # Add specific files
git add .                  # Add all changes
```

### 4. Commit with Message
```bash
git commit -m "Brief description" -m "Detailed explanation"
```

### 5. Push to GitHub
```bash
git push origin main
```

### 6. Verify Success
```bash
git status                 # Should show "up to date with origin/main"
```

---

## Authentication

**Credential Manager**: `manager` (Windows Credential Manager)

Your GitHub credentials are stored securely in Windows Credential Manager. Git will automatically use these credentials when pushing/pulling.

### If Authentication Fails

If you get authentication errors, you may need to set up a Personal Access Token:

1. Go to: https://github.com/settings/tokens
2. Generate new token (classic) with `repo` scope
3. When prompted for password during push, use the token instead

To store the token permanently:
```bash
git config --global credential.helper manager
```

---

## Quick Reference Commands

### Check Current Location
```bash
pwd                        # Show current directory
```

### View Commit History
```bash
git log --oneline -10     # Last 10 commits
git log --graph           # Visual commit history
```

### Sync with GitHub
```bash
git pull origin main      # Get latest changes from GitHub
git push origin main      # Push your changes to GitHub
```

### Create New Branch
```bash
git checkout -b feature/new-feature
git push -u origin feature/new-feature
```

---

## For Cursor AI Agents

When working on this project:

1. **Always verify working directory**: `C:\Users\James\LawnFlowAI-main`
2. **Read git status before making changes**: `git status`
3. **Stage only relevant files**: Don't commit temp files, node_modules, etc.
4. **Write meaningful commit messages**: Explain WHY, not just WHAT
5. **Push after committing**: Ensure changes reach GitHub
6. **Check for conflicts**: Pull before pushing if working across sessions

---

## Security Notes

✅ `.gitignore` is properly configured to exclude:
- `node_modules/`
- `.env` and `.env.local` files
- Build outputs (`dist/`, `build/`)
- IDE configs (`.vscode/`, `.idea/`)
- OS files (`.DS_Store`, `Thumbs.db`)

⚠️ **NEVER commit**:
- API keys or secrets
- `.env` files with credentials
- Personal access tokens
- Database credentials

---

## Troubleshooting

### "Not a git repository" error
You're in the wrong directory. Navigate to:
```bash
cd C:\Users\James\LawnFlowAI-main
```

### "Push rejected" error
Pull the latest changes first:
```bash
git pull origin main
git push origin main
```

### "Authentication failed" error
Update credentials in Windows Credential Manager or use Personal Access Token.

---

**Last Updated**: January 25, 2026  
**Status**: ✅ Fully Configured and Tested
