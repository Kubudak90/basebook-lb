# Claude Workflow - Basebook-LB DeFi Project

This project uses the [claude-workflow](https://github.com/CloudAI-X/claude-workflow) plugin for enhanced Claude Code capabilities.

## 🚀 Available Features

### 7 Specialized Agents

Use these agents for complex tasks:

- **orchestrator** - Coordinates multi-step complex tasks
- **code-reviewer** - Code quality and best practice checks
- **debugger** - Systematic bug investigation and fixes
- **docs-writer** - Technical documentation generation
- **security-auditor** - Security vulnerability detection (CRITICAL for DeFi)
- **refactorer** - Code structure improvements
- **test-architect** - Test strategy design

### 17 Slash Commands

Quick access commands:

**Project Modes:**
- `/architect` - Architecture-first development mode
- `/rapid` - Fast development mode
- `/mentor` - Teaching mode with explanations
- `/review` - Strict code review mode

**Security & Quality:**
- `/security-scan` - Full security scan (secrets, vulnerabilities, OWASP Top 10)
- `/lint-check` - Run linters without fixing
- `/lint-fix` - Run linters and auto-fix
- `/validate-build` - Verify project builds successfully

**Testing:**
- `/run-tests` - Execute test suite
- `/add-tests` - Generate tests for specific code

**Git Operations:**
- `/commit` - Create commit with smart message
- `/commit-push-pr` - Full flow: commit → push → PR
- `/sync-branch` - Sync branch with main
- `/summarize-changes` - Summarize uncommitted changes

**Code Quality:**
- `/code-simplifier` - Simplify complex code
- `/quick-fix` - Fast bug fixes
- `/verify-changes` - Verify recent changes work correctly

### 8 Automation Hooks

Hooks run automatically:

**PreToolUse (Before Edit/Write):**
- Security check - Blocks secrets (API keys, private keys, passwords)
- File protection - Prevents editing critical files
- Command logging - Tracks all bash commands

**PostToolUse (After Edit/Write):**
- Auto-format - Runs prettier/black/gofmt automatically

**SessionStart:**
- Environment validation - Checks dependencies

**UserPromptSubmit:**
- Prompt validation - Ensures quality inputs

### 6 Knowledge Skills

Domain knowledge modules:
- project-analysis
- testing-strategy
- architecture-patterns
- performance-optimization
- git-workflow
- api-design

## 📋 Usage Examples

### Security Audit (Recommended for DeFi!)

```bash
# Run full security scan before commits
/security-scan

# Or use the agent directly
"Hey, use the security-auditor agent to audit add-liquidity.tsx for vulnerabilities"
```

### Code Review

```bash
# Review specific file
/review components/swap/swap-card.tsx

# Or use agent
"Use code-reviewer agent to review my latest changes"
```

### Quick Development

```bash
# Enter rapid development mode
/rapid

# Architecture mode for planning
/architect
```

### Full Workflow

```bash
# 1. Make changes
# 2. Run security scan
/security-scan

# 3. Run tests
/run-tests

# 4. Verify build
/validate-build

# 5. Commit, push, and create PR
/commit-push-pr
```

## 🔐 Security Features

The security hooks automatically:

✅ Block commits containing:
- API keys (OpenAI, Anthropic, GitHub, AWS)
- Private keys (.pem, .key files)
- Passwords and secrets in code
- Bearer tokens

✅ Scan for OWASP Top 10:
- SQL Injection
- XSS vulnerabilities
- Command injection
- Path traversal
- Broken access control
- Cryptographic failures
- And more...

✅ Protect critical files:
- .env files
- package.json
- Critical configuration files

## 🛠️ Configuration

Settings are in `.claude/settings.local.json`:

```json
{
  "permissions": {
    "allow": [
      "Bash(npm install:*)",
      "Bash(npm test:*)",
      "Bash(npm run:*)",
      "Bash(npx:*)",
      "Bash(git:*)"
    ]
  }
}
```

## 📚 Resources

- [Claude Workflow GitHub](https://github.com/CloudAI-X/claude-workflow)
- [Claude Code Documentation](https://code.claude.com)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)

## 🎯 Recommended for This Project

Since basebook-lb is a DeFi project with smart contracts:

1. **Always run `/security-scan` before commits**
2. **Use `security-auditor` agent for contract reviews**
3. **Enable all hooks (already configured)**
4. **Run `/validate-build` before PRs**
5. **Use `/architect` mode for new features**

---

**Plugin Version:** 1.0.0
**Installed:** $(date)
