# Per-repo fleet start config for ai-games-collection
# Edit ports/backend target here - start.ps1 is fleet-standard.
@{
    Name         = 'ai-games-collection'
    BackendPort  = 10987
    FrontendPort = 10986
    HealthPath   = '/health'
    WebRoot      = 'web_sota'
    Backend = @{
        Kind          = 'uvicorn'
        UvicornTarget = 'web_sota.server:app'
        Env           = @{ WEB_PORT = '10987' }
    }
    Frontend = @{
        Kind           = 'vite-npm'
        PackageManager = 'npm'
        PortEnvVar     = 'VITE_PORT'
        ApiTargetEnv   = 'VITE_API_TARGET'
    }
}
