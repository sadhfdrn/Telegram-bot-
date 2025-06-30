const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const { HttpsProxyAgent } = require('https-proxy-agent');

class AnimePahePlugin {
    constructor() {
        this.name = 'animepahe';
        this.displayName = 'AnimePahe';
        this.icon = '🎌';
        this.description = 'Download anime from AnimePahe';
        this.baseUrl = 'https://animepahe.ru';
        this.apiUrl = 'https://animepahe.ru/api';
        
        // Rotating User-Agent pool
        this.userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/120.0',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ];
        
        // Current user agent index
        this.currentUAIndex = 0;
        
        // Enhanced headers with rotation
        this.getHeaders = () => ({
            'User-Agent': this.userAgents[this.currentUAIndex % this.userAgents.length],
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'cross-site',
            'Sec-Fetch-User': '?1',
            'Cache-Control': 'max-age=0',
            'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"'
        });

        // Enhanced rate limiting with exponential backoff
        this.lastRequestTime = 0;
        this.minRequestInterval = 3000; // 3 seconds between requests
        this.maxRetries = 3;
        this.retryDelay = 5000; // Start with 5 seconds
        
        // Session management
        this.cookies = new Map();
        this.sessionInitialized = false;
        this.sessionRetries = 0;
        this.maxSessionRetries = 3;
        
        // Proxy support (if available)
        this.proxyAgent = null;
        if (process.env.HTTP_PROXY || process.env.HTTPS_PROXY) {
            this.proxyAgent = new HttpsProxyAgent(process.env.HTTPS_PROXY || process.env.HTTP_PROXY);
        }
    }

    /**
     * Rotate user agent and reset session if needed
     */
    rotateUA() {
        this.currentUAIndex = (this.currentUAIndex + 1) % this.userAgents.length;
        console.log(`Rotated to User-Agent ${this.currentUAIndex + 1}`);
    }

    /**
     * Enhanced session initialization with multiple fallbacks
     */
    async initSession() {
        if (this.sessionInitialized && this.sessionRetries < this.maxSessionRetries) {
            return;
        }
        
        this.sessionRetries++;
        console.log(`Initializing AnimePahe session (attempt ${this.sessionRetries})`);
        
        try {
            // Try direct connection first
            await this.tryInitSession();
        } catch (error) {
            console.warn(`Session init attempt ${this.sessionRetries} failed:`, error.message);
            
            if (this.sessionRetries < this.maxSessionRetries) {
                // Rotate user agent and try again
                this.rotateUA();
                await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                return this.initSession();
            } else {
                console.warn('Max session retries reached, proceeding without session');
                this.sessionInitialized = true; // Mark as initialized to prevent infinite retries
            }
        }
    }

    async tryInitSession() {
        const config = {
            headers: this.getHeaders(),
            timeout: 20000,
            maxRedirects: 5,
            validateStatus: (status) => status < 500,
            httpsAgent: this.proxyAgent
        };

        const response = await axios.get(this.baseUrl, config);
        
        if (response.status === 403 || response.status === 429) {
            throw new Error(`HTTP ${response.status}: Access denied`);
        }

        // Extract and store cookies
        if (response.headers['set-cookie']) {
            const cookieStrings = response.headers['set-cookie'];
            cookieStrings.forEach(cookieString => {
                const [cookiePart] = cookieString.split(';');
                const [name, value] = cookiePart.split('=');
                if (name && value) {
                    this.cookies.set(name.trim(), value.trim());
                }
            });
        }

        this.sessionInitialized = true;
        console.log(`AnimePahe session initialized successfully with ${this.cookies.size} cookies`);
    }

    /**
     * Get cookie string for requests
     */
    getCookieString() {
        return Array.from(this.cookies.entries())
            .map(([name, value]) => `${name}=${value}`)
            .join('; ');
    }

    /**
     * Enhanced request wrapper with multiple fallback strategies
     */
    async makeRequest(url, options = {}) {
        let lastError;
        
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                // Ensure minimum time between requests
                const now = Date.now();
                const timeSinceLastRequest = now - this.lastRequestTime;
                if (timeSinceLastRequest < this.minRequestInterval) {
                    await new Promise(resolve => 
                        setTimeout(resolve, this.minRequestInterval - timeSinceLastRequest)
                    );
                }

                await this.initSession();

                const headers = this.getHeaders();
                const cookieString = this.getCookieString();
                if (cookieString) {
                    headers['Cookie'] = cookieString;
                }

                const defaultOptions = {
                    headers,
                    timeout: 20000,
                    maxRedirects: 5,
                    validateStatus: (status) => status < 500,
                    httpsAgent: this.proxyAgent
                };

                const mergedOptions = { ...defaultOptions, ...options };
                this.lastRequestTime = Date.now();
                
                console.log(`Making request to ${url} (attempt ${attempt})`);
                const response = await axios.get(url, mergedOptions);

                // Handle different response codes
                if (response.status === 200) {
                    return response;
                } else if (response.status === 403 || response.status === 429) {
                    throw new Error(`HTTP ${response.status}: Rate limited or blocked`);
                } else if (response.status >= 400) {
                    throw new Error(`HTTP ${response.status}: Client error`);
                }

                return response;
                
            } catch (error) {
                lastError = error;
                console.warn(`Request attempt ${attempt} failed:`, error.message);
                
                if (attempt < this.maxRetries) {
                    // Exponential backoff with jitter
                    const backoffTime = this.retryDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
                    console.log(`Waiting ${Math.round(backoffTime)}ms before retry...`);
                    await new Promise(resolve => setTimeout(resolve, backoffTime));
                    
                    // Try rotating user agent for next attempt
                    this.rotateUA();
                    this.sessionInitialized = false; // Force session re-init
                }
            }
        }

        // If all regular attempts failed, try Puppeteer as last resort
        console.log('All direct requests failed, attempting Puppeteer fallback...');
        try {
            return await this.makeRequestWithPuppeteer(url);
        } catch (puppeteerError) {
            console.error('Puppeteer fallback also failed:', puppeteerError.message);
            throw lastError || puppeteerError;
        }
    }

    /**
     * Enhanced Puppeteer fallback with better stealth
     */
    async makeRequestWithPuppeteer(url) {
        let browser;
        try {
            console.log('Launching Puppeteer browser...');
            browser = await puppeteer.launch({
                headless: 'new',
                executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--single-process',
                    '--disable-gpu',
                    '--disable-blink-features=AutomationControlled',
                    '--disable-features=VizDisplayCompositor',
                    '--disable-ipc-flooding-protection',
                    '--disable-renderer-backgrounding',
                    '--disable-backgrounding-occluded-windows',
                    '--disable-component-extensions-with-background-pages',
                    '--disable-default-apps',
                    '--disable-extensions',
                    '--disable-features=TranslateUI',
                    '--disable-hang-monitor',
                    '--disable-popup-blocking',
                    '--disable-prompt-on-repost',
                    '--disable-sync',
                    '--disable-web-security',
                    '--metrics-recording-only',
                    '--no-default-browser-check',
                    '--safebrowsing-disable-auto-update',
                    '--enable-automation',
                    '--password-store=basic',
                    '--use-mock-keychain'
                ]
            });

            const page = await browser.newPage();
            
            // Enhanced stealth configuration
            await page.setUserAgent(this.userAgents[this.currentUAIndex % this.userAgents.length]);
            await page.setViewport({ width: 1920, height: 1080 });
            
            // Remove webdriver traces
            await page.evaluateOnNewDocument(() => {
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => undefined,
                });
                
                // Mock plugins
                Object.defineProperty(navigator, 'plugins', {
                    get: () => [1, 2, 3, 4, 5],
                });
                
                // Mock languages
                Object.defineProperty(navigator, 'languages', {
                    get: () => ['en-US', 'en'],
                });
                
                // Remove Chrome runtime
                delete window.chrome;
            });

            // Set additional headers
            await page.setExtraHTTPHeaders({
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            });

            console.log(`Navigating to ${url} with Puppeteer...`);
            await page.goto(url, { 
                waitUntil: 'networkidle2', 
                timeout: 60000 
            });

            // Wait a bit for any dynamic content
            await page.waitForTimeout(2000);

            const content = await page.content();
            console.log('Puppeteer request successful');
            return { data: content, status: 200 };
            
        } catch (error) {
            console.error('Puppeteer request failed:', error.message);
            throw error;
        } finally {
            if (browser) {
                await browser.close();
            }
        }
    }

    /**
     * Enhanced search with better error handling
     */
    async search(query) {
        try {
            console.log(`Searching for: ${query}`);
            
            // Try API search first
            try {
                const searchUrl = `${this.apiUrl}?m=search&q=${encodeURIComponent(query)}`;
                const response = await this.makeRequest(searchUrl);
                
                if (response.data && typeof response.data === 'object' && response.data.data) {
                    console.log(`API search returned ${response.data.data.length} results`);
                    return response.data.data.map(anime => ({
                        id: anime.session,
                        title: anime.title,
                        url: `${this.baseUrl}/anime/${anime.session}`,
                        poster: anime.poster,
                        type: anime.type,
                        episodes: anime.episodes,
                        status: anime.status,
                        year: anime.year,
                        score: anime.score
                    }));
                }
            } catch (error) {
                console.log('API search failed, trying HTML scraping:', error.message);
            }

            // Fallback to HTML scraping
            const searchUrl = `${this.baseUrl}/?s=${encodeURIComponent(query)}`;
            const response = await this.makeRequest(searchUrl);
            const $ = cheerio.load(response.data);

            const results = [];
            
            // Try multiple selectors for search results
            const selectors = [
                '.col-6',
                '.anime-card',
                '.search-result',
                '.anime-item',
                '[class*="col"]'
            ];

            for (const selector of selectors) {
                const elements = $(selector);
                if (elements.length > 0) {
                    console.log(`Found ${elements.length} elements with selector: ${selector}`);
                    
                    elements.each((i, el) => {
                        const $el = $(el);
                        const titleEl = $el.find('a[title], .title a, .anime-title a, a').first();
                        const title = titleEl.attr('title') || titleEl.text().trim();
                        const url = titleEl.attr('href');
                        const poster = $el.find('img').first().attr('src') || $el.find('img').first().attr('data-src');
                        
                        if (title && url && title.length > 2) {
                            const sessionMatch = url.match(/\/anime\/([a-f0-9-]+)/);
                            if (sessionMatch) {
                                results.push({
                                    id: sessionMatch[1],
                                    title: title,
                                    url: url.startsWith('http') ? url : `${this.baseUrl}${url}`,
                                    poster: poster && poster.startsWith('http') ? poster : `${this.baseUrl}${poster}`,
                                    type: 'TV',
                                    episodes: 'Unknown',
                                    status: 'Unknown',
                                    year: 'Unknown'
                                });
                            }
                        }
                    });
                    
                    if (results.length > 0) break;
                }
            }

            console.log(`HTML scraping returned ${results.length} results`);
            return results;
            
        } catch (error) {
            console.error('AnimePahe search error:', error.message);
            throw new Error(`Search failed: ${error.message}`);
        }
    }

    /**
     * Enhanced anime details with better parsing
     */
    async getAnimeDetails(animeId) {
        try {
            console.log(`Getting details for anime ID: ${animeId}`);
            const animeUrl = `${this.baseUrl}/anime/${animeId}`;
            const response = await this.makeRequest(animeUrl);
            const $ = cheerio.load(response.data);

            // Try multiple selectors for title
            const titleSelectors = ['.title-wrapper h1', '.anime-title', 'h1', '.title h1', '[class*="title"]'];
            let title = '';
            for (const selector of titleSelectors) {
                title = $(selector).first().text().trim();
                if (title) break;
            }

            // Try multiple selectors for poster
            const posterSelectors = ['.anime-poster img', '.cover img', '.poster img', 'img[src*="poster"]'];
            let poster = '';
            for (const selector of posterSelectors) {
                poster = $(selector).first().attr('src') || $(selector).first().attr('data-src');
                if (poster) break;
            }

            // Try multiple selectors for synopsis
            const synopsisSelectors = ['.anime-synopsis p', '.description p', '.synopsis', '.summary'];
            let synopsis = '';
            for (const selector of synopsisSelectors) {
                synopsis = $(selector).first().text().trim();
                if (synopsis) break;
            }

            // Extract metadata
            const year = $('.anime-year, .year, [class*="year"]').first().text().trim();
            const status = $('.anime-status, .status, [class*="status"]').first().text().trim();
            const episodes = $('.anime-episodes, .episodes, [class*="episode"]').first().text().trim();
            const type = $('.anime-type, .type, [class*="type"]').first().text().trim();
            
            // Extract genres
            const genres = [];
            $('.anime-genre a, .genre a, .genres a').each((i, el) => {
                const genre = $(el).text().trim();
                if (genre) genres.push(genre);
            });

            const details = {
                id: animeId,
                title: title || 'Unknown Title',
                poster: poster && poster.startsWith('http') ? poster : `${this.baseUrl}${poster}`,
                description: synopsis || 'No description available',
                year: year || 'Unknown',
                status: status || 'Unknown',
                episodes: episodes || 'Unknown',
                type: type || 'TV',
                genres: genres.length > 0 ? genres : ['Unknown'],
                url: animeUrl
            };

            console.log(`Retrieved details for: ${details.title}`);
            return details;
            
        } catch (error) {
            console.error('AnimePahe details error:', error.message);
            throw new Error(`Failed to get anime details: ${error.message}`);
        }
    }

    /**
     * Enhanced episodes retrieval
     */
    async getEpisodes(animeId, page = 1) {
        try {
            console.log(`Getting episodes for anime ID: ${animeId}, page: ${page}`);
            
            // Try API first
            try {
                const episodesUrl = `${this.apiUrl}?m=release&id=${animeId}&sort=episode_asc&page=${page}`;
                const response = await this.makeRequest(episodesUrl);
                
                if (response.data && typeof response.data === 'object' && response.data.data) {
                    console.log(`API returned ${response.data.data.length} episodes for page ${page}`);
                    return response.data.data.map(episode => ({
                        id: episode.session,
                        episode: episode.episode,
                        title: episode.title || `Episode ${episode.episode}`,
                        snapshot: episode.snapshot,
                        duration: episode.duration,
                        created_at: episode.created_at,
                        anime_id: animeId
                    }));
                }
            } catch (error) {
                console.log('API episodes failed, trying HTML scraping:', error.message);
            }

            // Fallback to HTML scraping
            const animeUrl = `${this.baseUrl}/anime/${animeId}`;
            const response = await this.makeRequest(animeUrl);
            const $ = cheerio.load(response.data);

            const episodes = [];
            const episodeSelectors = [
                '.episode-list .episode',
                '.episodes .episode',
                '.episode-item',
                '[class*="episode"]'
            ];

            for (const selector of episodeSelectors) {
                const elements = $(selector);
                if (elements.length > 0) {
                    console.log(`Found ${elements.length} episodes with selector: ${selector}`);
                    
                    elements.each((i, el) => {
                        const $el = $(el);
                        const episodeNum = $el.find('.episode-number').text().trim() || 
                                         $el.attr('data-episode') || 
                                         (i + 1);
                        const title = $el.find('.episode-title').text().trim() || 
                                     $el.attr('title') || 
                                     `Episode ${episodeNum}`;
                        const url = $el.find('a').attr('href') || $el.attr('href');
                        
                        if (url) {
                            const sessionMatch = url.match(/\/play\/[^\/]+\/([a-f0-9-]+)/);
                            episodes.push({
                                id: sessionMatch ? sessionMatch[1] : `ep${episodeNum}`,
                                episode: parseInt(episodeNum) || (i + 1),
                                title,
                                anime_id: animeId,
                                url: url.startsWith('http') ? url : `${this.baseUrl}${url}`
                            });
                        }
                    });
                    
                    if (episodes.length > 0) break;
                }
            }

            console.log(`HTML scraping returned ${episodes.length} episodes`);
            return episodes;
            
        } catch (error) {
            console.error('AnimePahe episodes error:', error.message);
            throw new Error(`Failed to get episodes: ${error.message}`);
        }
    }

    /**
     * Get all episodes with enhanced pagination handling
     */
    async getAllEpisodes(animeId) {
        try {
            console.log(`Getting all episodes for anime ID: ${animeId}`);
            
            let allEpisodes = [];
            let page = 1;
            let hasMorePages = true;
            let consecutiveEmptyPages = 0;
            const maxPages = 100; // Increased safety limit
            const maxConsecutiveEmpty = 3;

            while (hasMorePages && page <= maxPages && consecutiveEmptyPages < maxConsecutiveEmpty) {
                console.log(`Fetching page ${page}...`);
                
                try {
                    const episodes = await this.getEpisodes(animeId, page);
                    
                    if (episodes.length === 0) {
                        consecutiveEmptyPages++;
                        console.log(`Page ${page} is empty (${consecutiveEmptyPages}/${maxConsecutiveEmpty})`);
                        
                        if (consecutiveEmptyPages >= maxConsecutiveEmpty) {
                            hasMorePages = false;
                        }
                    } else {
                        consecutiveEmptyPages = 0;
                        allEpisodes = [...allEpisodes, ...episodes];
                        console.log(`Page ${page} added ${episodes.length} episodes`);
                    }
                    
                    page++;
                    
                    // Add delay between page requests
                    if (hasMorePages) {
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                    
                } catch (error) {
                    console.warn(`Failed to get page ${page}:`, error.message);
                    consecutiveEmptyPages++;
                    
                    if (consecutiveEmptyPages >= maxConsecutiveEmpty) {
                        break;
                    }
                    
                    page++;
                    await new Promise(resolve => setTimeout(resolve, 3000));
                }
            }

            // Remove duplicates and sort
            const uniqueEpisodes = allEpisodes.filter((episode, index, self) => 
                index === self.findIndex(e => e.episode === episode.episode)
            );
            
            const sortedEpisodes = uniqueEpisodes.sort((a, b) => a.episode - b.episode);
            
            console.log(`Retrieved ${sortedEpisodes.length} unique episodes total`);
            return sortedEpisodes;
            
        } catch (error) {
            console.error('AnimePahe all episodes error:', error.message);
            throw new Error(`Failed to get all episodes: ${error.message}`);
        }
    }

    /**
     * Enhanced download episodes with better error handling
     */
    async downloadEpisodes(animeId, episodeNumbers, quality = '720p', audioType = 'sub') {
        try {
            console.log(`Preparing download for anime ${animeId}, episodes: ${episodeNumbers.join(', ')}`);
            
            const allEpisodes = await this.getAllEpisodes(animeId);
            const downloadInfo = [];

            for (const episodeNum of episodeNumbers) {
                const episode = allEpisodes.find(ep => ep.episode == episodeNum);
                if (!episode) {
                    console.warn(`Episode ${episodeNum} not found`);
                    downloadInfo.push({
                        episode: episodeNum,
                        error: 'Episode not found',
                        status: 'failed'
                    });
                    continue;
                }

                try {
                    downloadInfo.push({
                        episode: episodeNum,
                        title: episode.title,
                        quality: quality,
                        audio: audioType === 'dub' ? 'eng' : 'jpn',
                        url: episode.url || `${this.baseUrl}/play/${animeId}/${episode.id}`,
                        size: 'Unknown',
                        status: 'ready',
                        note: 'Visit the URL to access the episode. Direct download extraction requires additional setup.'
                    });
                } catch (error) {
                    console.error(`Failed to process episode ${episodeNum}:`, error.message);
                    downloadInfo.push({
                        episode: episodeNum,
                        error: error.message,
                        status: 'failed'
                    });
                }
            }

            console.log(`Prepared ${downloadInfo.length} download entries`);
            return downloadInfo;
            
        } catch (error) {
            console.error('AnimePahe download episodes error:', error.message);
            throw new Error(`Failed to download episodes: ${error.message}`);
        }
    }

    /**
     * Enhanced popular anime retrieval
     */
    async getPopular() {
        try {
            console.log('Getting popular anime...');
            
            const response = await this.makeRequest(this.baseUrl);
            const $ = cheerio.load(response.data);
            
            const popular = [];
            const selectors = [
                '.latest-update .col-6',
                '.popular .col-6',
                '.anime-list .col-6',
                '.grid .col-6',
                '[class*="col-6"]'
            ];

            for (const selector of selectors) {
                const elements = $(selector);
                if (elements.length > 0) {
                    console.log(`Found ${elements.length} popular anime with selector: ${selector}`);
                    
                    elements.each((i, el) => {
                        const $el = $(el);
                        const titleEl = $el.find('.title a, a[title], .anime-title a, a').first();
                        const title = titleEl.attr('title') || titleEl.text().trim();
                        const url = titleEl.attr('href');
                        const poster = $el.find('img').first().attr('src') || $el.find('img').first().attr('data-src');
                        const episode = $el.find('.episode, .latest-episode, [class*="episode"]').text().trim();
                        
                        if (title && url && title.length > 2) {
                            const sessionMatch = url.match(/\/anime\/([a-f0-9-]+)/);
                            if (sessionMatch) {
                                popular.push({
                                    id: sessionMatch[1],
                                    title: title,
                                    url: url.startsWith('http') ? url : `${this.baseUrl}${url}`,
                                    poster: poster && poster.startsWith('http') ? poster : `${this.baseUrl}${poster}`,
                                    latestEpisode: episode || 'Unknown'
                                });
                            }
                        }
                    });
                    
                    if (popular.length > 0) break;
                }
            }
            
            console.log(`Retrieved ${popular.length} popular anime`);
            return popular;
            
        } catch (error) {
            console.error('AnimePahe popular error:', error.message);
            throw new Error(`Failed to get popular anime: ${error.message}`);
        }
    }

    /**
     * Download entire season
     */
    async downloadSeason(animeId, quality = '720p', audioType = 'sub') {
        try {
            console.log(`Downloading entire season for anime ${animeId}`);
            
            const allEpisodes = await this.getAllEpisodes(animeId);
            const episodeNumbers = allEpisodes.map(ep => ep.episode);
            
            return await this.downloadEpisodes(animeId, episodeNumbers, quality, audioType);
        } catch (error) {
            console.error('AnimePahe download season error:', error.message);
            throw new Error(`Failed to download season: ${error.message}`);
        }
    }

    /**
     * Health check method
     */
    async healthCheck() {
        try {
            console.log('Performing health check...');
            const response = await this.makeRequest(this.baseUrl);
            return {
                status: 'healthy',
                responseTime: Date.now() - this.lastRequestTime,
                userAgent: this.userAgents[this.currentUAIndex],
                cookies: this.cookies.size,
                sessionInitialized: this.sessionInitialized
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                userAgent: this.userAgents[this.currentUAIndex],
                cookies: this.cookies.size,
                sessionInitialized: this.sessionInitialized
            };
        }
    }

    /**
     * Reset session and clear cookies
     */
    resetSession() {
        console.log('Resetting session...');
        this.sessionInitialized = false;
        this.sessionRetries = 0;
        this.cookies.clear();
        this.rotateUA();
    }

    /**
     * Get trending/airing anime
     */
    async getTrending() {
        try {
            console.log('Getting trending anime...');
            
            // Try to get from trending page if it exists
            try {
                const trendingUrl = `${this.baseUrl}/trending`;
                const response = await this.makeRequest(trendingUrl);
                const $ = cheerio.load(response.data);
                
                const trending = [];
                $('.col-6, .anime-card').each((i, el) => {
                    const $el = $(el);
                    const titleEl = $el.find('a[title], .title a, .anime-title a, a').first();
                    const title = titleEl.attr('title') || titleEl.text().trim();
                    const url = titleEl.attr('href');
                    const poster = $el.find('img').first().attr('src') || $el.find('img').first().attr('data-src');
                    
                    if (title && url && title.length > 2) {
                        const sessionMatch = url.match(/\/anime\/([a-f0-9-]+)/);
                        if (sessionMatch) {
                            trending.push({
                                id: sessionMatch[1],
                                title: title,
                                url: url.startsWith('http') ? url : `${this.baseUrl}${url}`,
                                poster: poster && poster.startsWith('http') ? poster : `${this.baseUrl}${poster}`,
                                type: 'Trending'
                            });
                        }
                    }
                });
                
                if (trending.length > 0) {
                    return trending;
                }
            } catch (error) {
                console.log('Trending page not found, falling back to popular');
            }
            
            // Fallback to popular
            return await this.getPopular();
            
        } catch (error) {
            console.error('AnimePahe trending error:', error.message);
            throw new Error(`Failed to get trending anime: ${error.message}`);
        }
    }

    /**
     * Search by genre
     */
    async searchByGenre(genre, page = 1) {
        try {
            console.log(`Searching by genre: ${genre}, page: ${page}`);
            
            const genreUrl = `${this.baseUrl}/genre/${encodeURIComponent(genre.toLowerCase())}?page=${page}`;
            const response = await this.makeRequest(genreUrl);
            const $ = cheerio.load(response.data);
            
            const results = [];
            $('.col-6, .anime-card').each((i, el) => {
                const $el = $(el);
                const titleEl = $el.find('a[title], .title a, .anime-title a, a').first();
                const title = titleEl.attr('title') || titleEl.text().trim();
                const url = titleEl.attr('href');
                const poster = $el.find('img').first().attr('src') || $el.find('img').first().attr('data-src');
                
                if (title && url && title.length > 2) {
                    const sessionMatch = url.match(/\/anime\/([a-f0-9-]+)/);
                    if (sessionMatch) {
                        results.push({
                            id: sessionMatch[1],
                            title: title,
                            url: url.startsWith('http') ? url : `${this.baseUrl}${url}`,
                            poster: poster && poster.startsWith('http') ? poster : `${this.baseUrl}${poster}`,
                            type: 'TV',
                            genre: genre
                        });
                    }
                }
            });
            
            console.log(`Found ${results.length} anime in genre: ${genre}`);
            return results;
            
        } catch (error) {
            console.error('AnimePahe genre search error:', error.message);
            throw new Error(`Failed to search by genre: ${error.message}`);
        }
    }

    /**
     * Get available genres
     */
    async getGenres() {
        try {
            console.log('Getting available genres...');
            
            const response = await this.makeRequest(this.baseUrl);
            const $ = cheerio.load(response.data);
            
            const genres = [];
            $('.genre-list a, .genres a, a[href*="/genre/"]').each((i, el) => {
                const $el = $(el);
                const genre = $el.text().trim();
                const url = $el.attr('href');
                
                if (genre && url && genre.length > 1) {
                    const genreMatch = url.match(/\/genre\/([^\/\?]+)/);
                    if (genreMatch) {
                        genres.push({
                            name: genre,
                            slug: genreMatch[1],
                            url: url.startsWith('http') ? url : `${this.baseUrl}${url}`
                        });
                    }
                }
            });
            
            // Remove duplicates
            const uniqueGenres = genres.filter((genre, index, self) => 
                index === self.findIndex(g => g.slug === genre.slug)
            );
            
            console.log(`Found ${uniqueGenres.length} genres`);
            return uniqueGenres;
            
        } catch (error) {
            console.error('AnimePahe genres error:', error.message);
            return []; // Return empty array instead of throwing
        }
    }

    /**
     * Advanced search with filters
     */
    async advancedSearch(options = {}) {
        try {
            const {
                query = '',
                genre = '',
                year = '',
                type = '',
                status = '',
                sort = 'title',
                order = 'asc',
                page = 1
            } = options;
            
            console.log('Performing advanced search with options:', options);
            
            // Build search URL with parameters
            const params = new URLSearchParams();
            if (query) params.append('q', query);
            if (genre) params.append('genre', genre);
            if (year) params.append('year', year);
            if (type) params.append('type', type);
            if (status) params.append('status', status);
            if (sort) params.append('sort', sort);
            if (order) params.append('order', order);
            if (page) params.append('page', page);
            
            const searchUrl = `${this.baseUrl}/search?${params.toString()}`;
            const response = await this.makeRequest(searchUrl);
            const $ = cheerio.load(response.data);
            
            const results = [];
            $('.col-6, .anime-card, .search-result').each((i, el) => {
                const $el = $(el);
                const titleEl = $el.find('a[title], .title a, .anime-title a, a').first();
                const title = titleEl.attr('title') || titleEl.text().trim();
                const url = titleEl.attr('href');
                const poster = $el.find('img').first().attr('src') || $el.find('img').first().attr('data-src');
                
                // Extract additional info
                const typeEl = $el.find('.type, .anime-type, [class*="type"]').text().trim();
                const yearEl = $el.find('.year, .anime-year, [class*="year"]').text().trim();
                const statusEl = $el.find('.status, .anime-status, [class*="status"]').text().trim();
                const episodesEl = $el.find('.episodes, .anime-episodes, [class*="episode"]').text().trim();
                
                if (title && url && title.length > 2) {
                    const sessionMatch = url.match(/\/anime\/([a-f0-9-]+)/);
                    if (sessionMatch) {
                        results.push({
                            id: sessionMatch[1],
                            title: title,
                            url: url.startsWith('http') ? url : `${this.baseUrl}${url}`,
                            poster: poster && poster.startsWith('http') ? poster : `${this.baseUrl}${poster}`,
                            type: typeEl || type || 'TV',
                            year: yearEl || year || 'Unknown',
                            status: statusEl || status || 'Unknown',
                            episodes: episodesEl || 'Unknown'
                        });
                    }
                }
            });
            
            console.log(`Advanced search returned ${results.length} results`);
            return results;
            
        } catch (error) {
            console.error('AnimePahe advanced search error:', error.message);
            throw new Error(`Advanced search failed: ${error.message}`);
        }
    }

    /**
     * Get recent releases/updates
     */
    async getRecentReleases() {
        try {
            console.log('Getting recent releases...');
            
            const response = await this.makeRequest(this.baseUrl);
            const $ = cheerio.load(response.data);
            
            const releases = [];
            $('.latest-update .col-6, .recent .col-6, .updates .col-6').each((i, el) => {
                const $el = $(el);
                const titleEl = $el.find('a[title], .title a, .anime-title a, a').first();
                const title = titleEl.attr('title') || titleEl.text().trim();
                const url = titleEl.attr('href');
                const poster = $el.find('img').first().attr('src') || $el.find('img').first().attr('data-src');
                const episode = $el.find('.episode, .latest-episode, [class*="episode"]').text().trim();
                const time = $el.find('.time, .date, .updated, [class*="time"]').text().trim();
                
                if (title && url && title.length > 2) {
                    const sessionMatch = url.match(/\/anime\/([a-f0-9-]+)/);
                    if (sessionMatch) {
                        releases.push({
                            id: sessionMatch[1],
                            title: title,
                            url: url.startsWith('http') ? url : `${this.baseUrl}${url}`,
                            poster: poster && poster.startsWith('http') ? poster : `${this.baseUrl}${poster}`,
                            latestEpisode: episode || 'Unknown',
                            updateTime: time || 'Unknown'
                        });
                    }
                }
            });
            
            console.log(`Found ${releases.length} recent releases`);
            return releases;
            
        } catch (error) {
            console.error('AnimePahe recent releases error:', error.message);
            throw new Error(`Failed to get recent releases: ${error.message}`);
        }
    }
}

module.exports = AnimePahePlugin;
