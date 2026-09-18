# Troubleshooting

## Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| Backend won't start | Port 10987 in use | `just serve` clears zombies automatically |
| Frontend can't reach backend | Vite proxy misconfigured | Check `web_sota/vite.config.ts` proxy target |
| "MCP server not found" | FastMCP not mounted yet | Wait ~5s for lazy mount in lifespan |
| AI engine not responding | Engine server not started | Start with `just docker-up` or manually |
| Tauri build fails | Rust/MSVC not installed | `winget install Rustlang.Rustup` |
| TypeScript errors | Outdated node_modules | `npm --prefix web_sota install` |
| Ruff errors | Outdated deps | `uv sync --all-extras` |
| Docker compose fails | Windows container mode | Use `docker-compose.yml` (Linux containers) |

## Port Conflicts

Clear all ai-games-collection ports:

```powershell
Get-NetTCPConnection -LocalPort 10986,10987,11211,11212,11213 -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

## Debugging

### Backend Logs

Start backend in foreground to see logs:

```powershell
uv run uvicorn web_sota.server:app --host 127.0.0.1 --port 10987 --reload --log-level debug
```

### Frontend

Open browser DevTools (F12) and check Console + Network tabs. The Vite proxy logs proxied requests.

### Tauri

```powershell
just build-native-debug
# Or run in dev mode:
npx --prefix native tauri dev
```

## Getting Help

- [GitHub Issues](https://github.com/sandraschi/ai-games-collection/issues)
- [docs/README.md](README.md) — Full documentation index
- [docs/troubleshooting/README.md](troubleshooting/README.md) — Extended troubleshooting
