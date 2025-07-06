const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

class NineAnimePlugin {
    constructor() {
        this.name = '9anime';
        this.displayName = '9Anime';
        this.icon = '🇯🇵';
        this.description = 'Stream anime with subtitles and dubs';
        this.baseUrl = 'https://9animetv.to';
        this.browser = null;
        this.userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ];
        this.requestDelay = 2000; // 2 seconds between requests
        this.maxRetries = 3;
        this.sessionTimeout = 300000; // 5 minutes
        this.lastRequestTime = 0;
    }

    async initBrowser() {
        if (this.browser) {
            return this.browser;
        }

        try {
            this.browser = await puppeteer.launch({
                headless: 'new'
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--disable-gpu',
                    '--disable-features=VizDisplayCompositor',
                    '--disable-blink-features=AutomationControlled',
                    '--disable-web-security',
                    '--disable-features=site-per-process',
                    '--window-size=1920,1080',
                    '--disable-extensions',
                    '--no-first-run',
                    '--disable-default-apps',
                    '--disable-sync',
                    '--disable-translate',
                    '--disable-notifications',
                    '--disable-permissions-api',
                    '--disable-background-timer-throttling',
                    '--disable-backgrounding-occluded-windows',
                    '--disable-renderer-backgrounding',
                    '--disable-ipc-flooding-protection'
                ],
                ignoreHTTPSErrors: true,
                timeout: 30000,
                protocolTimeout: 30000
            });

            // Set browser timeout
            setTimeout(() => {
                if (this.browser) {
                    this.closeBrowser();
                }
            }, this.sessionTimeout);

            return this.browser;
        } catch (error) {
            console.error('Failed to initialize browser:', error);
            throw error;
        }
    }

    async closeBrowser() {
        if (this.browser) {
            try {
                await this.browser.close();
            } catch (error) {
                console.error('Error closing browser:', error);
            }
            this.browser = null;
        }
    }

    async createStealthPage() {
        const browser = await this.initBrowser();
        const page = await browser.newPage();

        // Set random user agent
        const userAgent = this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
        await page.setUserAgent(userAgent);

        // Set viewport with random variations
        const viewports = [
            { width: 1920, height: 1080 },
            { width: 1366, height: 768 },
            { width: 1536, height: 864 },
            { width: 1440, height: 900 }
        ];
        const viewport = viewports[Math.floor(Math.random() * viewports.length)];
        await page.setViewport({ ...viewport, deviceScaleFactor: 1 });

        // Enable request interception to block unnecessary resources
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            const resourceType = req.resourceType();
            const url = req.url();
            
            // Block ads and tracking
            if (url.includes('google-analytics') || 
                url.includes('googletagmanager') || 
                url.includes('facebook.com') ||
                url.includes('doubleclick') ||
                url.includes('googlesyndication')) {
                req.abort();
                return;
            }
            
            // Block unnecessary resources but allow some for stealth
            if (['font', 'media'].includes(resourceType)) {
                req.abort();
            } else if (resourceType === 'image' && Math.random() > 0.3) {
                req.abort(); // Block 70% of images
            } else if (resourceType === 'stylesheet' && Math.random() > 0.5) {
                req.abort(); // Block 50% of stylesheets
            } else {
                req.continue();
            }
        });

        // Enhanced stealth techniques
        await page.evaluateOnNewDocument(() => {
            // Override webdriver property
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
            });

            // Override automation indicators
            delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
            delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
            delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;

            // Override plugins with realistic data
            Object.defineProperty(navigator, 'plugins', {
                get: () => ({
                    length: 3,
                    0: { name: 'Chrome PDF Plugin', length: 1 },
                    1: { name: 'Chromium PDF Plugin', length: 1 },
                    2: { name: 'Microsoft Edge PDF Plugin', length: 1 }
                }),
            });

            // Override languages
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en'],
            });

            // Override hardwareConcurrency
            Object.defineProperty(navigator, 'hardwareConcurrency', {
                get: () => 4,
            });

            // Override deviceMemory
            Object.defineProperty(navigator, 'deviceMemory', {
                get: () => 8,
            });

            // Override platform
            Object.defineProperty(navigator, 'platform', {
                get: () => 'Win32',
            });

            // Override permissions
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ?
                    Promise.resolve({ state: Notification.permission }) :
                    originalQuery(parameters)
            );

            // Override chrome runtime
            if (window.chrome) {
                Object.defineProperty(window.chrome, 'runtime', {
                    get: () => ({
                        onConnect: undefined,
                        onMessage: undefined,
                        connect: undefined,
                        sendMessage: undefined,
                    }),
                });
            }

            // Randomize timing
            const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
            
            const originalSetTimeout = window.setTimeout;
            window.setTimeout = function(fn, delay) {
                const randomDelay = delay + getRandomInt(-50, 50);
                return originalSetTimeout(fn, Math.max(0, randomDelay));
            };
        });

        // Add extra headers with random variations
        const acceptEncodings = ['gzip, deflate, br', 'gzip, deflate', 'gzip'];
        const acceptLanguages = ['en-US,en;q=0.9', 'en-US,en;q=0.8', 'en-US,en;q=0.5'];
        
        await page.setExtraHTTPHeaders({
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': acceptLanguages[Math.floor(Math.random() * acceptLanguages.length)],
            'Accept-Encoding': acceptEncodings[Math.floor(Math.random() * acceptEncodings.length)],
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Cache-Control': 'max-age=0',
            'sec-ch-ua': '"Not A;Brand";v="99", "Chromium";v="120", "Google Chrome";v="120"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"'
        });

        // Add mouse movement simulation
        await page.evaluateOnNewDocument(() => {
            const originalAddEventListener = EventTarget.prototype.addEventListener;
            EventTarget.prototype.addEventListener = function(type, listener, options) {
                if (type === 'mousemove') {
                    const wrappedListener = function(event) {
                        // Add slight random delay to mouse events
                        setTimeout(() => listener.call(this, event), Math.random() * 10);
                    };
                    return originalAddEventListener.call(this, type, wrappedListener, options);
                }
                return originalAddEventListener.call(this, type, listener, options);
            };
        });

        return page;
    }

    async withRetry(operation, maxRetries = this.maxRetries) {
        for (let i = 0; i < maxRetries; i++) {
            try {
                // Rate limiting with jitter
                const now = Date.now();
                const timeSinceLastRequest = now - this.lastRequestTime;
                const jitter = Math.random() * 1000; // Add up to 1 second jitter
                const delayNeeded = this.requestDelay + jitter - timeSinceLastRequest;
                
                if (delayNeeded > 0) {
                    await new Promise(resolve => setTimeout(resolve, delayNeeded));
                }
                this.lastRequestTime = Date.now();

                const result = await operation();
                return result;
            } catch (error) {
                console.error(`Attempt ${i + 1} failed:`, error.message);
                
                // Check for specific error types
                if (error.message.includes('CloudFlare') || 
                    error.message.includes('blocked') ||
                    error.message.includes('403') ||
                    error.message.includes('rate limit')) {
                    console.log('Detected anti-bot protection, increasing delay...');
                    this.requestDelay = Math.min(this.requestDelay * 2, 10000);
                }
                
                if (i === maxRetries - 1) throw error;
                
                // Exponential backoff with jitter
                const delay = Math.min(1000 * Math.pow(2, i), 10000) + Math.random() * 2000;
                await new Promise(resolve => setTimeout(resolve, delay));
                
                // Recreate browser session if needed
                if (error.message.includes('Target closed') || error.message.includes('Session closed')) {
                    await this.closeBrowser();
                }
            }
        }
    }

    async checkCloudflareChallenge(page) {
        try {
            // Wait a bit for potential Cloudflare challenge
            await page.waitForTimeout(3000);
            
            // Check for Cloudflare challenge indicators
            const challengeDetected = await page.evaluate(() => {
                const title = document.title.toLowerCase();
                const body = document.body ? document.body.innerText.toLowerCase() : '';
                
                return title.includes('cloudflare') || 
                       title.includes('just a moment') ||
                       body.includes('checking your browser') ||
                       body.includes('cloudflare') ||
                       body.includes('ddos protection') ||
                       document.querySelector('#cf-wrapper') !== null ||
                       document.querySelector('.cf-browser-verification') !== null;
            });
            
            if (challengeDetected) {
                console.log('Cloudflare challenge detected, waiting...');
                
                // Wait for challenge to complete (up to 30 seconds)
                await page.waitForFunction(() => {
                    const title = document.title.toLowerCase();
                    const body = document.body ? document.body.innerText.toLowerCase() : '';
                    return !title.includes('cloudflare') && 
                           !title.includes('just a moment') &&
                           !body.includes('checking your browser');
                }, { timeout: 30000 });
                
                console.log('Cloudflare challenge completed');
                await page.waitForTimeout(2000); // Additional wait after challenge
            }
            
            return true;
        } catch (error) {
            console.error('Error handling Cloudflare challenge:', error);
            return false;
        }
    }

    async search(query) {
        return await this.withRetry(async () => {
            const page = await this.createStealthPage();
            
            try {
                console.log(`Searching for: ${query}`);
                
                // Navigate to search page
                await page.goto(`${this.baseUrl}/search?keyword=${encodeURIComponent(query)}`, {
                    waitUntil: 'networkidle2',
                    timeout: 30000
                });

                // Handle potential Cloudflare challenge
                await this.checkCloudflareChallenge(page);

                // Wait for search results with multiple selectors
                try {
                    await page.waitForSelector('.film_list-wrap, .flw-item, .ani-item', { timeout: 15000 });
                } catch (error) {
                    // Check if we're on the correct page
                    const currentUrl = page.url();
                    const pageTitle = await page.title();
                    console.log(`Page URL: ${currentUrl}, Title: ${pageTitle}`);
                    
                    if (currentUrl.includes('search') || pageTitle.toLowerCase().includes('search')) {
                        console.log('Search page loaded but no results selector found, trying alternative extraction...');
                    } else {
                        throw new Error('Search page not loaded correctly');
                    }
                }

                // Extract search results with multiple fallback selectors
                const results = await page.evaluate(() => {
                    const selectors = [
                        '.flw-item',
                        '.ani-item',
                        '.film-item',
                        '.item',
                        '[class*="item"]'
                    ];
                    
                    let items = [];
                    for (const selector of selectors) {
                        items = document.querySelectorAll(selector);
                        if (items.length > 0) break;
                    }
                    
                    if (items.length === 0) {
                        console.log('No items found with any selector');
                        return [];
                    }
                    
                    return Array.from(items).map(item => {
                        // Try multiple selector patterns for title
                        const titleSelectors = [
                            '.film-name a',
                            '.anime-name a',
                            '.title a',
                            'a[title]',
                            'h3 a',
                            '.name a'
                        ];
                        
                        let titleElement = null;
                        for (const selector of titleSelectors) {
                            titleElement = item.querySelector(selector);
                            if (titleElement) break;
                        }
                        
                        // Try multiple selector patterns for link
                        const linkSelectors = [
                            '.film-poster a',
                            '.anime-poster a',
                            '.poster a',
                            'a[href*="watch"]',
                            'a[href*="anime"]'
                        ];
                        
                        let linkElement = null;
                        for (const selector of linkSelectors) {
                            linkElement = item.querySelector(selector);
                            if (linkElement) break;
                        }
                        
                        // Use title element as link if no separate link found
                        if (!linkElement && titleElement) {
                            linkElement = titleElement;
                        }
                        
                        if (!titleElement || !linkElement) {
                            console.log('Could not find title or link element');
                            return null;
                        }
                        
                        // Extract metadata
                        const metaSelectors = [
                            '.fd-infor',
                            '.anime-info',
                            '.meta-info',
                            '.info'
                        ];
                        
                        let metaElement = null;
                        for (const selector of metaSelectors) {
                            metaElement = item.querySelector(selector);
                            if (metaElement) break;
                        }
                        
                        // Extract year and status
                        let year = 'N/A';
                        let status = 'Unknown';
                        
                        if (metaElement) {
                            const metaText = metaElement.textContent || '';
                            const yearMatch = metaText.match(/\b(19|20)\d{2}\b/);
                            if (yearMatch) year = yearMatch[0];
                            
                            if (metaText.toLowerCase().includes('completed')) status = 'Completed';
                            else if (metaText.toLowerCase().includes('ongoing')) status = 'Ongoing';
                            else if (metaText.toLowerCase().includes('airing')) status = 'Airing';
                        }
                        
                        // Extract poster image
                        const posterSelectors = [
                            '.film-poster img',
                            '.anime-poster img',
                            '.poster img',
                            'img'
                        ];
                        
                        let poster = '';
                        for (const selector of posterSelectors) {
                            const img = item.querySelector(selector);
                            if (img && img.src) {
                                poster = img.src;
                                break;
                            }
                        }
                        
                        const url = linkElement.href || '';
                        const title = titleElement.textContent?.trim() || 'Unknown';
                        
                        // Extract ID from URL
                        let id = '';
                        const urlParts = url.split('/');
                        if (urlParts.length > 0) {
                            const lastPart = urlParts[urlParts.length - 1];
                            // Handle URLs like /watch/anime-name-12345
                            const idMatch = lastPart.match(/-(\d+)$/);
                            if (idMatch) {
                                id = lastPart;
                            } else {
                                id = lastPart;
                            }
                        }
                        
                        return {
                            title,
                            url,
                            id,
                            year,
                            status,
                            poster
                        };
                    }).filter(item => item !== null && item.title !== 'Unknown');
                });

                console.log(`Found ${results.length} results for "${query}"`);
                
                // If no results found, try to get more info about the page
                if (results.length === 0) {
                    const pageInfo = await page.evaluate(() => ({
                        url: window.location.href,
                        title: document.title,
                        bodyText: document.body ? document.body.innerText.substring(0, 500) : 'No body'
                    }));
                    console.log('No results found. Page info:', pageInfo);
                }
                
                return results;
            } finally {
                await page.close();
            }
        });
    }

    async getAnimeDetails(animeId) {
        return await this.withRetry(async () => {
            const page = await this.createStealthPage();
            
            try {
                console.log(`Getting details for anime ID: ${animeId}`);
                
                // Navigate to anime page
                const animeUrl = animeId.startsWith('http') ? animeId : `${this.baseUrl}/watch/${animeId}`;
                await page.goto(animeUrl, {
                    waitUntil: 'networkidle2',
                    timeout: 30000
                });

                // Handle potential Cloudflare challenge
                await this.checkCloudflareChallenge(page);

                // Wait for anime details with multiple selectors
                try {
                    await page.waitForSelector('.anis-content, .anime-detail, .detail-content', { timeout: 15000 });
                } catch (error) {
                    console.log('Primary selectors not found, trying alternative approach...');
                    // Continue anyway, we might still be able to extract some data
                }

                // Extract anime details with fallback selectors
                const details = await page.evaluate(() => {
                    // Try multiple selector patterns for different page layouts
                    const titleSelectors = [
                        '.anis-content h2.film-name',
                        '.anime-detail h1',
                        '.detail-content h1',
                        'h1.title',
                        '.anime-title',
                        'h1'
                    ];
                    
                    let title = 'Unknown';
                    for (const selector of titleSelectors) {
                        const element = document.querySelector(selector);
                        if (element && element.textContent?.trim()) {
                            title = element.textContent.trim();
                            break;
                        }
                    }
                    
                    // Try multiple selector patterns for description
                    const descriptionSelectors = [
                        '.anis-content .film-description',
                        '.anime-detail .description',
                        '.detail-content .description',
                        '.synopsis',
                        '.summary',
                        '.plot'
                    ];
                    
                    let description = 'No description available';
                    for (const selector of descriptionSelectors) {
                        const element = document.querySelector(selector);
                        if (element && element.textContent?.trim()) {
                            description = element.textContent.trim();
                            break;
                        }
                    }
                    
                    // Extract year from various places
                    let year = 'N/A';
                    const pageText = document.body ? document.body.textContent : '';
                    const yearMatch = pageText.match(/\b(19|20)\d{2}\b/);
                    if (yearMatch) year = yearMatch[0];
                    
                    // Extract status
                    let status = 'Unknown';
                    const statusIndicators = [
                        '.anis-content .tick-sub',
                        '.anis-content .tick-dub',
                        '.status',
                        '.anime-status'
                    ];
                    
                    for (const selector of statusIndicators) {
                        const element = document.querySelector(selector);
                        if (element && element.textContent?.trim()) {
                            const statusText = element.textContent.trim().toLowerCase();
                            if (statusText.includes('completed')) status = 'Completed';
                            else if (statusText.includes('ongoing')) status = 'Ongoing';
                            else if (statusText.includes('airing')) status = 'Airing';
                            break;
                        }
                    }
                    
                    // Extract genres
                    const genreSelectors = [
                        '.anis-content .item-list a',
                        '.anime-detail .genres a',
                        '.detail-content .genres a',
                        '.genre-list a',
                        '.genres a'
                    ];
                    
                    let genres = [];
                    for (const selector of genreSelectors) {
                        const elements = document.querySelectorAll(selector);
                        if (elements.length > 0) {
                            genres = Array.from(elements).map(el => el.textContent?.trim()).filter(Boolean);
                            break;
                        }
                    }
                    
                    // Get episode count
                    const episodeSelectors = [
                        '.ss-list a',
                        '.episode-list a',
                        '.ep-list a',
                        '.episodes a',
                        '[class*="episode"] a'
                    ];
                    
                    let episodes = '0';
                    for (const selector of episodeSelectors) {
                        const elements = document.querySelectorAll(selector);
                        if (elements.length > 0) {
                            episodes = elements.length.toString();
                            break;
                        }
                    }
                    
                    // Extract poster
                    const posterSelectors = [
                        '.anis-content .film-poster img',
                        '.anime-detail .poster img',
                        '.detail-content .poster img',
                        '.poster img',
                        '.anime-poster img'
                    ];
                    
                    let poster = '';
                    for (const selector of posterSelectors) {
                        const element = document.querySelector(selector);
                        if (element && element.src) {
                            poster = element.src;
                            break;
                        }
                    }
                    
                    return {
                        title,
                        description,
                        year,
                        status,
                        genres,
                        episodes,
                        poster
                    };
                });

                console.log(`Retrieved details for: ${details.title}`);
                
                // Validate that we got meaningful data
                if (details.title === 'Unknown' || details.title === '') {
                    const pageInfo = await page.evaluate(() => ({
                        url: window.location.href,
                        title: document.title,
                        hasContent: document.body ? document.body.innerText.length > 100 : false
                    }));
                    console.log('Warning: Could not extract anime details properly. Page info:', pageInfo);
                }
                
                return details;
            } finally {
                await page.close();
            }
        });
    }

    async getEpisodeUrl(animeId, episodeNumber, quality = '1080p', type = 'sub') {
        return await this.withRetry(async () => {
            const page = await this.createStealthPage();
            
            try {
                console.log(`Getting episode ${episodeNumber} URL for anime ${animeId}`);
                
                // Navigate to anime page
                await page.goto(`${this.baseUrl}/watch/${animeId}`, {
                    waitUntil: 'networkidle2',
                    timeout: 30000
                });

                // Wait for episode list
                await page.waitForSelector('.ss-list', { timeout: 15000 });

                // Find and click the episode
                const episodeClicked = await page.evaluate((epNum) => {
                    const episodes = document.querySelectorAll('.ss-list a');
                    for (let ep of episodes) {
                        const epText = ep.textContent?.trim() || '';
                        if (epText.includes(epNum.toString())) {
                            ep.click();
                            return true;
                        }
                    }
                    return false;
                }, episodeNumber);

                if (!episodeClicked) {
                    throw new Error(`Episode ${episodeNumber} not found`);
                }

                // Wait for video player to load
                await page.waitForTimeout(3000);
                await page.waitForSelector('.player-frame', { timeout: 15000 });

                // Get the video iframe source
                const videoData = await page.evaluate(() => {
                    const iframe = document.querySelector('.player-frame iframe');
                    return {
                        src: iframe?.src || '',
                        dataId: iframe?.getAttribute('data-id') || ''
                    };
                });

                if (!videoData.src) {
                    throw new Error('Video source not found');
                }

                // Extract direct video URL from iframe
                const videoUrl = await this.extractVideoUrl(videoData.src);
                
                return {
                    url: videoUrl,
                    quality: quality,
                    type: type,
                    episode: episodeNumber
                };
            } finally {
                await page.close();
            }
        });
    }

    async extractVideoUrl(iframeSrc) {
        return await this.withRetry(async () => {
            const page = await this.createStealthPage();
            
            try {
                console.log(`Extracting video URL from: ${iframeSrc}`);
                
                // Navigate to video iframe
                await page.goto(iframeSrc, {
                    waitUntil: 'networkidle2',
                    timeout: 30000
                });

                // Wait for video element or m3u8 links
                await page.waitForTimeout(5000);

                // Try to find video sources
                const videoSources = await page.evaluate(() => {
                    const sources = [];
                    
                    // Check for video elements
                    const videoElements = document.querySelectorAll('video source');
                    videoElements.forEach(source => {
                        if (source.src) {
                            sources.push(source.src);
                        }
                    });
                    
                    // Check for m3u8 links in scripts
                    const scripts = document.querySelectorAll('script');
                    scripts.forEach(script => {
                        const content = script.textContent || '';
                        const m3u8Match = content.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/g);
                        if (m3u8Match) {
                            sources.push(...m3u8Match);
                        }
                    });
                    
                    return sources;
                });

                if (videoSources.length > 0) {
                    return videoSources[0];
                }

                throw new Error('No video sources found');
            } finally {
                await page.close();
            }
        });
    }

    async downloadEpisodes(animeId, episodeNumbers, quality = '1080p', type = 'sub') {
        const downloadLinks = [];
        
        for (const episodeNumber of episodeNumbers) {
            try {
                const episodeData = await this.getEpisodeUrl(animeId, episodeNumber, quality, type);
                downloadLinks.push({
                    episode: episodeNumber,
                    url: episodeData.url,
                    quality: quality,
                    type: type,
                    size: 'Unknown'
                });
            } catch (error) {
                console.error(`Failed to get episode ${episodeNumber}:`, error);
                downloadLinks.push({
                    episode: episodeNumber,
                    url: null,
                    quality: quality,
                    type: type,
                    error: error.message
                });
            }
        }
        
        return downloadLinks;
    }

    async downloadSeason(animeId, quality = '1080p', type = 'sub') {
        // First get anime details to know episode count
        const details = await this.getAnimeDetails(animeId);
        const episodeCount = parseInt(details.episodes) || 12;
        
        // Generate episode numbers array
        const episodeNumbers = Array.from({ length: episodeCount }, (_, i) => i + 1);
        
        return await this.downloadEpisodes(animeId, episodeNumbers, quality, type);
    }

    // Cleanup method
    async cleanup() {
        await this.closeBrowser();
    }
}

module.exports = NineAnimePlugin;
