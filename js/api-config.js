/**
 * API Configuration for Remote Access with Connection Pooling
 * Dynamically detects if running locally or remotely
 * **Timestamp**: 2025-12-17
 */

class ApiConfig {
    constructor() {
        this.currentHost = window.location.hostname;
        this.currentPort = window.location.port;
        this.protocol = window.location.protocol;

        // Detect environment and connectivity
        this.isLocal = this._detectLocalEnvironment();
        // REMOVED: No longer using Docker
        this.aiServerHost = this._determineAiServerHost();

        // Connection pooling and caching
        this.connectionPool = new Map();
        this.requestCache = new Map();
        this.cacheTimeout = 30000; // 30 seconds

        // Request deduplication
        this.pendingRequests = new Map();

        // Enhanced connectivity checking
        this.connectivityStatus = new Map();

        // Authentication: API key support for public access
        this.apiKey = this._loadApiKey();

        console.log(`🌐 API Config: ${this.isLocal ? 'LOCAL' : 'REMOTE'} mode`);
        console.log(`   Web Host: ${this.currentHost}:${this.currentPort}`);
        console.log(`   AI Host: ${this.aiServerHost}`);
        console.log(`   User Agent: ${navigator.userAgent}`);
        console.log(`   Is Mobile: ${/Mobi|Android/i.test(navigator.userAgent)}`);
        if (this.apiKey) {
            console.log("   API Key: configured");
        }

        // Fetch server configuration for AI server host
        this._loadServerConfig();

        // Start connectivity monitoring
        this._startConnectivityMonitoring();
    }

    _loadApiKey() {
        // Try to load API key from localStorage or URL parameter
        // Priority: URL parameter > localStorage > window.API_KEY
        
        // Check URL parameter (accept once then scrub from URL)
        const urlParams = new URLSearchParams(window.location.search);
        const urlApiKey = urlParams.get('api_key');
        if (urlApiKey) {
            localStorage.setItem('games_api_key', urlApiKey);
            const cleanUrl = window.location.pathname + window.location.hash;
            history.replaceState(null, '', cleanUrl);
            return urlApiKey;
        }
        
        // Check localStorage
        const storedKey = localStorage.getItem('games_api_key');
        if (storedKey) {
            return storedKey;
        }
        
        // Check window global (for programmatic setting)
        if (window.API_KEY) {
            localStorage.setItem('games_api_key', window.API_KEY);
            return window.API_KEY;
        }
        
        return null;
    }

    setApiKey(apiKey) {
        // Set API key programmatically
        this.apiKey = apiKey;
        if (apiKey) {
            localStorage.setItem('games_api_key', apiKey);
        } else {
            localStorage.removeItem('games_api_key');
        }
    }

    async _loadServerConfig() {
        try {
            const configUrl = `${this.protocol}//${this.currentHost}:${this.currentPort || 80}/api/config`;
            const response = await fetch(configUrl);
            const config = await response.json();

            console.log('📡 Server config loaded:', config);

            // Update AI server host if provided by server
            if (config.ai_server_host) {
                this.aiServerHost = config.ai_server_host;
                console.log(`🔄 Updated AI server host to: ${this.aiServerHost}`);
            }

            // Store port information
            this.serverPorts = config.ports || {};
            this.isRemoteAccess = config.is_remote || false;

        } catch (error) {
            console.warn('⚠️ Could not load server config, using defaults:', error.message);
        }
    }

    _detectLocalEnvironment() {
        return this.currentHost === 'localhost' ||
            this.currentHost === '127.0.0.1' ||
            this.currentHost.startsWith('192.168.') ||
            this.currentHost.startsWith('10.') ||
            this.currentHost.startsWith('172.');
    }

    // REMOVED: _detectDockerRemote - No longer using Docker

    _determineAiServerHost() {
        // First priority: Server-provided configuration
        if (window.AI_SERVER_HOST) {
            return window.AI_SERVER_HOST;
        }

        // Second priority: Cloudflare tunnel - use proxy approach (same host)
        if (this.currentHost.includes('trycloudflare.com') || this.currentHost.includes('cloudflare')) {
            return this.currentHost;
        }

        // For local access, use localhost
        if (this.isLocal) {
            return 'localhost';
        }

        // For remote access, use same host (direct execution, no Docker)
        return this.currentHost;
    }

    _findAiServerHost() {
        // Try multiple strategies to find the AI server host

        // Strategy 1: Check URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const aiHost = urlParams.get('ai_host');
        if (aiHost) return aiHost;

        // Strategy 2: Try the current host (works if ports are forwarded correctly)
        return this.currentHost;

        // Strategy 3: Could implement auto-discovery here if needed
        // For now, we'll rely on proper port forwarding or URL parameters
    }

    _startConnectivityMonitoring() {
        // Monitor connectivity to AI servers
        setInterval(() => {
            this._checkAiConnectivity();
        }, 60000); // Check every minute
    }

    async _checkAiConnectivity() {
        // Port connectivity check — reads configured ports from /api/config, legacy fallback
        const services = [
            { name: 'stockfish',  port: (this.serverPorts && this.serverPorts.stockfish) || 11211, path: '/api/status' },
            { name: 'katago',    port: (this.serverPorts && this.serverPorts.katago) || 11213, path: '/api/status' },
            { name: 'yaneuraou', port: (this.serverPorts && this.serverPorts.yaneuraou) || 11212, path: '/api/status' }
        ];

        for (const service of services) {
            let connected = false;

            try {
                // Direct connection to AI servers (must work remotely)
                const url = `${this.protocol}//${this.aiServerHost}:${service.port}${service.path}`;
                const response = await fetch(url, {
                    method: 'GET',
                    signal: AbortSignal.timeout(5000)
                });

                if (response.ok) {
                    connected = true;
                }
            } catch (error) {
                // Connection failed - critical for remote competitive play
                console.warn(`⚠️ ${service.name} unreachable from ${this.aiServerHost}:${service.port}`);
            }

            this.connectivityStatus.set(service.port, connected);
        }

        const status = Object.fromEntries(this.connectivityStatus);
        console.log('🔗 AI Connectivity (direct ports for remote play):', status);
        
        // Warn if any service is down (critical for competitive play)
        const allUp = Object.values(status).every(v => v === true);
        if (!allUp) {
            console.error('❌ Some AI services unavailable - remote competitive play will fail!');
        }
    }

    /**
     * Get the base URL for API calls
     * Web server and AI servers may be on different hosts
     */
    getApiBaseUrl(port) {
        // For AI servers, use the determined AI server host
        return `${this.protocol}//${this.aiServerHost}:${port}`;
    }

    // Convenience methods for each service
    // Remote play: cloudflare proxy /api/stockfish -> engine container
    // Local dev: read from serverPorts (fetched from /api/config); registry ports as fallback
    _useProxy() {
        return this.currentHost.includes('trycloudflare.com') || this.currentHost.includes('cloudflare');
    }
    get stockfishUrl() {
        if (this._useProxy()) {
            return `${this.protocol}//${this.currentHost}${this.currentPort ? ':' + this.currentPort : ''}/api/stockfish`;
        }
        const port = (this.serverPorts && this.serverPorts.stockfish) || 11211;
        return this.getApiBaseUrl(port);
    }
    get shogiUrl() {
        if (this._useProxy()) {
            return `${this.protocol}//${this.currentHost}${this.currentPort ? ':' + this.currentPort : ''}/api/shogi`;
        }
        const port = (this.serverPorts && this.serverPorts.yaneuraou) || 11212;
        return this.getApiBaseUrl(port);
    }
    get goUrl() {
        if (this._useProxy()) {
            return `${this.protocol}//${this.currentHost}${this.currentPort ? ':' + this.currentPort : ''}/api/go`;
        }
        const port = (this.serverPorts && this.serverPorts.katago) || 11213;
        return this.getApiBaseUrl(port);
    }

    /**
     * Optimized fetch with connection pooling and caching
     * @param {string} url - API endpoint URL
     * @param {object} options - Fetch options
     * @param {boolean} useCache - Whether to use response caching
     */
    async optimizedFetch(url, options = {}, useCache = true) {
        const cacheKey = `${url}_${JSON.stringify(options)}`;

        // Check cache first
        if (useCache && this.requestCache.has(cacheKey)) {
            const cached = this.requestCache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.response.clone();
            } else {
                this.requestCache.delete(cacheKey);
            }
        }

        // Check for pending identical request (deduplication — clone to avoid body-reuse)
        if (this.pendingRequests.has(cacheKey)) {
            const sharedResponse = await this.pendingRequests.get(cacheKey);
            return sharedResponse.clone();
        }

        // Create optimized request
        const requestPromise = this._performFetch(url, options);

        // Store pending request for deduplication
        this.pendingRequests.set(cacheKey, requestPromise);

        try {
            const response = await requestPromise;

            // Cache successful GET responses
            if (useCache && options.method === 'GET' && response.ok) {
                this.requestCache.set(cacheKey, {
                    response: response.clone(),
                    timestamp: Date.now()
                });
            }

            return response;
        } finally {
            this.pendingRequests.delete(cacheKey);
        }
    }

    /**
     * Perform the actual fetch with optimized settings
     */
    async _performFetch(url, options = {}) {
        const defaultOptions = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            // Connection keep-alive for better performance
            keepalive: true,
            // Timeout for requests (longer than server-side 10s engine read loop)
            signal: AbortSignal.timeout(15000),
        };

        // Add API key to headers if configured (for authentication)
        if (this.apiKey) {
            defaultOptions.headers['X-API-Key'] = this.apiKey;
        }

        const finalOptions = { ...defaultOptions, ...options };
        
        // Ensure API key is in final headers (user-provided headers take precedence, but we merge)
        if (this.apiKey && !finalOptions.headers['X-API-Key']) {
            finalOptions.headers['X-API-Key'] = this.apiKey;
        }

        try {
            const response = await fetch(url, finalOptions);

            // Handle common HTTP errors
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return response;
        } catch (error) {
            // Enhanced error handling with AI server troubleshooting
            if (error.name === 'AbortError') {
                throw new Error(`Request timed out. AI server may not be running or accessible. Check: connectivity-test.html`);
            }
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                throw new Error(`Network connection failed. AI server unreachable from ${this.aiServerHost}. Try: connectivity-test.html`);
            }
            throw error;
        }
    }

    /**
     * Make API call with automatic retry logic
     */
    async apiCall(endpoint, options = {}, maxRetries = 2) {
        let lastError;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const response = await this.optimizedFetch(endpoint, options);
                return await response.json();
            } catch (error) {
                lastError = error;

                // Don't retry on client errors (4xx)
                if (error.message.includes('HTTP 4')) {
                    break;
                }

                // Exponential backoff
                if (attempt < maxRetries) {
                    const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s...
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        throw lastError;
    }

    /**
     * Clean up old cache entries
     */
    cleanupCache() {
        const now = Date.now();
        for (const [key, value] of this.requestCache.entries()) {
            if (now - value.timestamp > this.cacheTimeout) {
                this.requestCache.delete(key);
            }
        }
    }
}

// Global instance
const apiConfig = new ApiConfig();

// Make it available globally
window.apiConfig = apiConfig;
