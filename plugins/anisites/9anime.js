const puppeteer = require('puppeteer');
const UserAgent = require('user-agents');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class Enhanced9AnimePlugin {
    constructor() {
        this.name = '9anime';
        this.displayName = '9Anime TV';
        this.icon = '🎬';
        this.description = 'Advanced anime streaming from 9anime.to with multiple server support';
        this.baseUrl = 'https://9animetv.to';
        this.searchEndpoint = '/search';
        this.browserlessUrl = 'https://browserless-rj4p.onrender.com';
        this.maxRetries = 3;
        this.retryDelay = 2000;
        
        // Cache for storing session data
        this.sessionCache = new Map();
        
        // Enhanced user agent rotation
        this.userAgentGenerator = new UserAgent({
            deviceCategory: 'desktop',
            platform: ['Win32', 'MacIntel', 'Linux x86_64']
        });
        
        // Proxy rotation (if available)
        this.proxyList = process.env.PROXY_LIST ? process.env.PROXY_LIST.split(',') : [];
        
        // Server priorities
        this.serverPriorities = {
            'vidstreaming': 1,
            'mycloud': 2,
            'mp4upload': 3,
            'streamtape': 4,
            'doodstream': 5
        };
        
        // Quality priorities
        this.qualityPriorities = {
            '1080p': 1,
            '720p': 2,
            '480p': 3,
            '360p': 4
        };
    }

    // Generate session ID for caching
    generateSessionId() {
        return crypto.randomBytes(16).toString('hex');
    }

    // Get random proxy
    getRandomProxy() {
        if (this.proxyList.length === 0) return null;
        return this.proxyList[Math.floor(Math.random() * this.proxyList.length)];
    }

    // Enhanced browser creation with stealth mode
    async createStealthBrowser(retryCount = 0) {
        const userAgent = this.userAgentGenerator.toString();
        const proxy = this.getRandomProxy();
        
        const browserOptions = {
            browserWSEndpoint: `${this.browserlessUrl}?stealth&blockAds&token=${process.env.BROWSERLESS_TOKEN || ''}`,
            defaultViewport: null,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-gpu',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding',
                '--disable-features=TranslateUI',
                '--disable-ipc-flooding-protection',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor',
            ]
        };
        
        // Add proxy if available
        if (proxy) {
            browserOptions.args.push(`--proxy-server=${proxy}`);
        }
        
        try {
            const browser = await puppeteer.connect(browserOptions);
            const page = await browser.newPage();
            
            // Set user agent
            await page.setUserAgent(userAgent);
            
            // Set random viewport
            const viewports = [
                { width: 1920, height: 1080 },
                { width: 1366, height: 768 },
                { width: 1536, height: 864 },
                { width: 1440, height: 900 },
                { width: 1280, height: 720 }
            ];
            const viewport = viewports[Math.floor(Math.random() * viewports.length)];
            await page.setViewport(viewport);
            
            // Enhanced stealth measures
            await page.evaluateOnNewDocument(() => {
                // Remove webdriver traces
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => undefined,
                });
                
                // Mock plugins
                Object.defineProperty(navigator, 'plugins', {
                    get: () => [
                        { name: 'Chrome PDF Plugin', description: 'Portable Document Format' },
                        { name: 'Chrome PDF Viewer', description: 'PDF Viewer' },
                        { name: 'Native Client', description: 'Native Client' }
                    ]
                });
                
                // Mock languages
                Object.defineProperty(navigator, 'languages', {
                    get: () => ['en-US', 'en', 'fr']
                });
                
                // Mock permissions
                const originalQuery = window.navigator.permissions.query;
                window.navigator.permissions.query = (parameters) => (
                    parameters.name === 'notifications' ?
                        Promise.resolve({ state: Notification.permission }) :
                        originalQuery(parameters)
                );
                
                // Mock screen properties
                Object.defineProperty(screen, 'colorDepth', {
                    get: () => 24
                });
                
                // Mock canvas fingerprinting
                const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
                HTMLCanvasElement.prototype.toDataURL = function(type) {
                    if (type === 'image/png') {
                        return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
                    }
                    return originalToDataURL.apply(this, arguments);
                };
            });
            
            // Enhanced request interception
            await page.setRequestInterception(true);
            page.on('request', (request) => {
                const resourceType = request.resourceType();
                const url = request.url();
                
                // Block unnecessary resources
                if (['stylesheet', 'font', 'image', 'media'].includes(resourceType)) {
                    request.abort();
                } else if (url.includes('google-analytics') || url.includes('googletagmanager')) {
                    request.abort();
                } else {
                    // Add realistic headers
                    const headers = {
                        ...request.headers(),
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.5',
                        'Accept-Encoding': 'gzip, deflate, br',
                        'DNT': '1',
                        'Connection': 'keep-alive',
                        'Upgrade-Insecure-Requests': '1',
                        'Sec-Fetch-Dest': 'document',
                        'Sec-Fetch-Mode': 'navigate',
                        'Sec-Fetch-Site': 'none',
                        'Sec-Fetch-User': '?1',
                        'Cache-Control': 'max-age=0'
                    };
                    request.continue({ headers });
                }
            });
            
            // Add extra headers
            await page.setExtraHTTPHeaders({
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            });
            
            return { browser, page };
            
        } catch (error) {
            console.error(`Browser creation failed (attempt ${retryCount + 1}):`, error);
            
            if (retryCount < this.maxRetries) {
                await this.delay(this.retryDelay * (retryCount + 1));
                return await this.createStealthBrowser(retryCount + 1);
            }
            
            throw error;
        }
    }

    // Enhanced Cloudflare bypass
    async bypassCloudflare(page) {
        let attempts = 0;
        const maxAttempts = 5;
        
        while (attempts < maxAttempts) {
            try {
                // Check if we're on Cloudflare challenge page
                const isCloudflare = await page.evaluate(() => {
                    return document.querySelector('.cf-browser-verification') !== null ||
                           document.querySelector('#cf-please-wait') !== null ||
                           document.querySelector('.cf-checking-browser') !== null ||
                           document.title.includes('Just a moment') ||
                           document.body.innerHTML.includes('Cloudflare');
                });
                
                if (!isCloudflare) {
                    return true;
                }
                
                console.log(`Cloudflare detected, attempt ${attempts + 1}`);
                
                // Wait for challenge completion
                await page.waitForFunction(() => {
                    return !document.querySelector('.cf-browser-verification') &&
                           !document.querySelector('#cf-please-wait') &&
                           !document.querySelector('.cf-checking-browser') &&
                           !document.title.includes('Just a moment');
                }, { timeout: 30000 });
                
                // Additional stability wait
                await this.delay(2000);
                
                // Verify we're past Cloudflare
                const stillOnCloudflare = await page.evaluate(() => {
                    return document.body.innerHTML.includes('Cloudflare') &&
                           !document.querySelector('.film_list-wrap') &&
                           !document.querySelector('.anisc-detail');
                });
                
                if (!stillOnCloudflare) {
                    console.log('Cloudflare bypass successful');
                    return true;
                }
                
                attempts++;
                await this.delay(3000);
                
            } catch (error) {
                console.error(`Cloudflare bypass attempt ${attempts + 1} failed:`, error);
                attempts++;
                
                if (attempts < maxAttempts) {
                    await this.delay(5000);
                }
            }
        }
        
        throw new Error('Failed to bypass Cloudflare after multiple attempts');
    }

    // Enhanced search with retry logic
    async search(query, retryCount = 0) {
        let browser, page;
        
        try {
            ({ browser, page } = await this.createStealthBrowser());
            
            // Navigate to search page
            const searchUrl = `${this.baseUrl}${this.searchEndpoint}?keyword=${encodeURIComponent(query)}`;
            console.log(`Searching for: ${query}`);
            
            await page.goto(searchUrl, { 
                waitUntil: 'networkidle2', 
                timeout: 30000 
            });
            
            // Bypass Cloudflare
            await this.bypassCloudflare(page);
            
            // Wait for search results
            await page.waitForSelector('.film_list-wrap, .film-list', { timeout: 15000 });
            
            // Extract search results
            const results = await page.evaluate(() => {
                const items = document.querySelectorAll('.flw-item, .film-item');
                return Array.from(items).slice(0, 15).map(item => {
                    const titleElement = item.querySelector('.film-name a, .title a');
                    const posterElement = item.querySelector('.film-poster img, .poster img');
                    const metaElement = item.querySelector('.fd-infor, .meta');
                    const typeElement = item.querySelector('.fdi-type, .type');
                    
                    const title = titleElement?.textContent?.trim() || 'Unknown';
                    const url = titleElement?.href || '';
                    const id = url.split('/').pop()?.split('?')[0] || '';
                    const poster = posterElement?.src || posterElement?.getAttribute('data-src') || '';
                    const year = metaElement?.textContent?.match(/\d{4}/)?.[0] || 'N/A';
                    const type = typeElement?.textContent?.trim() || 'TV';
                    
                    // Extract status
                    let status = 'Unknown';
                    if (metaElement?.textContent?.includes('Completed')) {
                        status = 'Completed';
                    } else if (metaElement?.textContent?.includes('Ongoing')) {
                        status = 'Ongoing';
                    } else if (metaElement?.textContent?.includes('Upcoming')) {
                        status = 'Upcoming';
                    }
                    
                    return {
                        title,
                        url,
                        id,
                        poster,
                        year,
                        status,
                        type
                    };
                });
            });
            
            console.log(`Found ${results.length} search results`);
            return results.filter(r => r.id); // Filter out invalid results
            
        } catch (error) {
            console.error(`Search failed (attempt ${retryCount + 1}):`, error);
            
            if (retryCount < this.maxRetries) {
                await this.delay(this.retryDelay * (retryCount + 1));
                return await this.search(query, retryCount + 1);
            }
            
            throw new Error(`Search failed after ${this.maxRetries + 1} attempts: ${error.message}`);
        } finally {
            if (browser) {
                try {
                    await browser.close();
                } catch (e) {
                    console.error('Error closing browser:', e);
                }
            }
        }
    }

    // Enhanced popular anime fetching
    async getPopular(retryCount = 0) {
        let browser, page;
        
        try {
            ({ browser, page } = await this.createStealthBrowser());
            
            console.log('Fetching popular anime...');
            await page.goto(this.baseUrl, { 
                waitUntil: 'networkidle2', 
                timeout: 30000 
            });
            
            // Bypass Cloudflare
            await this.bypassCloudflare(page);
            
            // Wait for popular section
            await page.waitForSelector('.film_list-wrap, .anif-block', { timeout: 15000 });
            
            // Extract popular anime
            const popular = await page.evaluate(() => {
                const items = document.querySelectorAll('.flw-item, .film-item');
                return Array.from(items).slice(0, 20).map(item => {
                    const titleElement = item.querySelector('.film-name a, .title a');
                    const posterElement = item.querySelector('.film-poster img, .poster img');
                    const metaElement = item.querySelector('.fd-infor, .meta');
                    const episodeElement = item.querySelector('.fdi-item, .episode');
                    
                    const title = titleElement?.textContent?.trim() || 'Unknown';
                    const url = titleElement?.href || '';
                    const id = url.split('/').pop()?.split('?')[0] || '';
                    const poster = posterElement?.src || posterElement?.getAttribute('data-src') || '';
                    const year = metaElement?.textContent?.match(/\d{4}/)?.[0] || 'N/A';
                    const episodes = episodeElement?.textContent?.match(/\d+/)?.[0] || 'N/A';
                    
                    let status = 'Unknown';
                    if (metaElement?.textContent?.includes('Completed')) {
                        status = 'Completed';
                    } else if (metaElement?.textContent?.includes('Ongoing')) {
                        status = 'Ongoing';
                    }
                    
                    return {
                        title,
                        url,
                        id,
                        poster,
                        year,
                        status,
                        episodes
                    };
                });
            });
            
            console.log(`Found ${popular.length} popular anime`);
            return popular.filter(p => p.id);
            
        } catch (error) {
            console.error(`Get popular failed (attempt ${retryCount + 1}):`, error);
            
            if (retryCount < this.maxRetries) {
                await this.delay(this.retryDelay * (retryCount + 1));
                return await this.getPopular(retryCount + 1);
            }
            
            throw new Error(`Get popular failed after ${this.maxRetries + 1} attempts: ${error.message}`);
        } finally {
            if (browser) {
                try {
                    await browser.close();
                } catch (e) {
                    console.error('Error closing browser:', e);
                }
            }
        }
    }

    // Enhanced anime details fetching
    async getAnimeDetails(animeId, retryCount = 0) {
        let browser, page;
        
        try {
            ({ browser, page } = await this.createStealthBrowser());
            
            const animeUrl = `${this.baseUrl}/watch/${animeId}`;
            console.log(`Fetching details for: ${animeId}`);
            
            await page.goto(animeUrl, { 
                waitUntil: 'networkidle2', 
                timeout: 30000 
            });
            
            // Bypass Cloudflare
            await this.bypassCloudflare(page);
            
            // Wait for anime details
            await page.waitForSelector('.anisc-detail, .anime-detail', { timeout: 15000 });
            
            // Extract anime details
            const details = await page.evaluate(() => {
                const titleElement = document.querySelector('.anisc-detail .film-name, .anime-detail .title');
                const descElement = document.querySelector('.anisc-detail .film-description, .anime-detail .description');
                const posterElement = document.querySelector('.anisc-poster img, .anime-poster img');
                const infoElements = document.querySelectorAll('.anisc-info .item, .anime-info .item');
                
                let year = 'N/A';
                let status = 'Unknown';
                let genres = [];
                let episodes = 'N/A';
                let duration = 'N/A';
                let studio = 'N/A';
                let score = 'N/A';
                
                // Extract information from info elements
                infoElements.forEach(item => {
                    const label = item.querySelector('.item-head, .label')?.textContent?.trim().toLowerCase();
                    const valueElement = item.querySelector('.name, .value');
                    const value = valueElement?.textContent?.trim();
                    
                    if (label?.includes('premiered') || label?.includes('aired')) {
                        year = value?.match(/\d{4}/)?.[0] || 'N/A';
                    } else if (label?.includes('status')) {
                        status = value || 'Unknown';
                    } else if (label?.includes('genres')) {
                        genres = Array.from(item.querySelectorAll('.name, .genre')).map(g => g.textContent.trim());
                    } else if (label?.includes('episodes')) {
                        episodes = value || 'N/A';
                    } else if (label?.includes('duration')) {
                        duration = value || 'N/A';
                    } else if (label?.includes('studio')) {
                        studio = value || 'N/A';
                    } else if (label?.includes('score') || label?.includes('rating')) {
                        score = value || 'N/A';
                    }
                });
                
                return {
                    title: titleElement?.textContent?.trim() || 'Unknown',
                    description: descElement?.textContent?.trim() || 'No description available',
                    poster: posterElement?.src || posterElement?.getAttribute('data-src') || '',
                    year,
                    status,
                    genres,
                    episodes,
                    duration,
                    studio,
                    score
                };
            });
            
            console.log(`Successfully fetched details for: ${details.title}`);
            return details;
            
        } catch (error) {
            console.error(`Get anime details failed (attempt ${retryCount + 1}):`, error);
            
            if (retryCount < this.maxRetries) {
                await this.delay(this.retryDelay * (retryCount + 1));
                return await this.getAnimeDetails(animeId, retryCount + 1);
            }
            
            throw new Error(`Get anime details failed after ${this.maxRetries + 1} attempts: ${error.message}`);
        } finally {
            if (browser) {
                try {
                    await browser.close();
                } catch (e) {
                    console.error('Error closing browser:', e);
                }
            }
        }
    }

    // Enhanced streaming link extraction
    async getStreamingLinks(animeId, episodeNumber, type = 'sub', retryCount = 0) {
        let browser, page;
        
        try {
            ({ browser, page } = await this.createStealthBrowser());
            
            const animeUrl = `${this.baseUrl}/watch/${animeId}`;
            console.log(`Getting streaming links for: ${animeId} Episode ${episodeNumber} (${type})`);
            
            await page.goto(animeUrl, { 
                waitUntil: 'networkidle2', 
                timeout: 30000 
            });
            
            // Bypass Cloudflare
            await this.bypassCloudflare(page);
            
            // Wait for episode list
            await page.waitForSelector('.ss-list, .episode-list', { timeout: 15000 });
            
            // Select the correct episode
            const episodeFound = await page.evaluate((epNum) => {
                const episodes = document.querySelectorAll('.ss-list .ssl-item, .episode-list .episode-item');
                for (let ep of episodes) {
                    const epNumber = ep.querySelector('.ssli-order, .episode-number')?.textContent?.trim();
                    const epTitle = ep.querySelector('.ssli-title, .episode-title')?.textContent?.trim();
                    
                    if (epNumber === epNum.toString() || epTitle?.includes(`Episode ${epNum}`)) {
                        ep.click();
                        return true;
                    }
                }
                return false;
            }, episodeNumber);
            
            if (!episodeFound) {
                throw new Error(`Episode ${episodeNumber} not found`);
            }
            
            // Wait for episode to load
            await this.delay(3000);
            
            // Select SUB/DUB if available
            if (type === 'dub') {
                await page.evaluate(() => {
                    const dubButton = document.querySelector('.ps_-btn[data-type="dub"], .dub-button');
                    if (dubButton && !dubButton.classList.contains('active')) {
                        dubButton.click();
                    }
                });
                await this.delay(2000);
            }
            
            // Extract all available servers
            const servers = await page.evaluate(() => {
                const serverElements = document.querySelectorAll('.ps_-list .item, .server-list .server-item');
                return Array.from(serverElements).map(server => {
                    const name = server.querySelector('.ps_-name, .server-name')?.textContent?.trim();
                    const serverId = server.getAttribute('data-id') || server.getAttribute('data-server');
                    const isActive = server.classList.contains('active');
                    
                    return { name, serverId, isActive };
                });
            });
            
            console.log(`Found ${servers.length} servers:`, servers.map(s => s.name));
            
            // Sort servers by priority
            const sortedServers = servers.sort((a, b) => {
                const priorityA = this.getServerPriority(a.name);
                const priorityB = this.getServerPriority(b.name);
                return priorityA - priorityB;
            });
            
            const streamingLinks = [];
            
            // Try each server in order of priority
            for (const server of sortedServers) {
                try {
                    console.log(`Trying server: ${server.name}`);
                    
                    // Click on server if not active
                    if (!server.isActive) {
                        await page.evaluate((serverId) => {
                            const serverButton = document.querySelector(`[data-id="${serverId}"], [data-server="${serverId}"]`);
                            if (serverButton) {
                                serverButton.click();
                            }
                        }, server.serverId);
                        
                        await this.delay(3000);
                    }
                    
                    // Extract streaming URL
                    const streamingData = await page.evaluate(() => {
                        const iframe = document.querySelector('iframe[src*="embed"], iframe[src*="vidstream"], iframe[src*="mp4upload"]');
                        if (iframe) {
                            return {
                                url: iframe.src,
                                quality: '1080p', // Default quality
                                server: iframe.src.includes('vidstream') ? 'Vidstreaming' : 'Unknown'
                            };
                        }
                        return null;
                    });
                    
                    if (streamingData) {
                        streamingLinks.push({
                            server: server.name || streamingData.server,
                            url: streamingData.url,
                            quality: streamingData.quality,
                            type: type,
                            episode: episodeNumber,
                            priority: this.getServerPriority(server.name)
                        });
                        
                        console.log(`Successfully extracted link from: ${server.name}`);
                    }
                    
                } catch (serverError) {
                    console.error(`Failed to extract from server ${server.name}:`, serverError);
                }
            }
            
            if (streamingLinks.length === 0) {
                throw new Error('No streaming links found from any server');
            }
            
            // Return links sorted by priority
            return streamingLinks.sort((a, b) => a.priority - b.priority);
            
        } catch (error) {
            console.error(`Get streaming links failed (attempt ${retryCount + 1}):`, error);
            
            if (retryCount < this.maxRetries) {
                await this.delay(this.retryDelay * (retryCount + 1));
                return await this.getStreamingLinks(animeId, episodeNumber, type, retryCount + 1);
            }
            
            throw new Error(`Get streaming links failed after ${this.maxRetries + 1} attempts: ${error.message}`);
        } finally {
            if (browser) {
                try {
                    await browser.close();
                } catch (e) {
                    console.error('Error closing browser:', e);
                }
            }
        }
    }

    // Get server priority based on name
    getServerPriority(serverName) {
        const name = serverName?.toLowerCase() || '';
        for (const [key, priority] of Object.entries(this.serverPriorities)) {
            if (name.includes(key)) {
                return priority;
            }
        }
        return 999; // Default low priority
    }

    // Batch download episodes with concurrency control
    async downloadEpisodes(animeId, episodes, quality = '1080p', type = 'sub') {
        const downloadLinks = [];
        const batchSize = 3; // Process 3 episodes at a time to avoid rate limiting
        
        console.log(`Starting batch download for ${episodes.length} episodes`);
        
        for (let i = 0; i < episodes.length; i += batchSize) {
            const batch = episodes.slice(i, i + batchSize);
            
            const batchPromises = batch.map(async (episode) => {
                try {
                    const links = await this.getStreamingLinks(animeId, episode, type);
                    return links;
                } catch (error) {
                    console.error(`Failed to get links for episode ${episode}:`, error);
                    return [];
                }
            });
            
            const batchResults = await Promise.all(batchPromises);
            batchResults.forEach(links => {
                if (links.length > 0) {
                    downloadLinks.push(...links);
                }
            });
            
            // Delay between batches to avoid rate limiting
            if (i + batchSize < episodes.length) {
                await this.delay(5000);
            }
        }
        
        console.log(`Successfully extracted ${downloadLinks.length} download links`);
        return downloadLinks;
    }

    // Enhanced season download with episode detection
    async downloadSeason(animeId, quality = '1080p', type = 'sub') {
        try {
            console.log(`Starting season download for: ${animeId}`);
            
            // Get anime details to determine episode count
            const details = await this.getAnimeDetails(animeId);
            let totalEpisodes = parseInt(details.episodes) || 12;
            
            // If episodes is unknown, try to detect from the page
            if (totalEpisodes === 12 && details.episodes === 'N/A') {
                totalEpisodes = await this.detectEpisodeCount(animeId);
            }
            
            console.log(`Detected ${totalEpisodes} episodes for season download`);
            
            const episodes = Array.from({ length: totalEpisodes }, (_, i) => i + 1);
            return await this.downloadEpisodes(animeId, episodes, quality, type);
            
        } catch (error) {
            console.error('Download season failed:', error);
            throw new Error(`Download season failed: ${error.message}`);
        }
    }

    // Detect episode count from anime page
    async detectEpisodeCount(animeId) {
        let browser, page;
        
        try {
            ({ browser, page } = await this.createStealthBrowser());
            
            const animeUrl = `${this.baseUrl}/watch/${animeId}`;
            await page.goto(animeUrl, { waitUntil: 'networkidle2', timeout: 30000 });
            
            await this.bypassCloudflare(page);
            
            // Wait for episode list
            await page.waitForSelector('.ss-list, .episode-list', { timeout: 15000 });
            
            // Count episodes
            const episodeCount = await page.evaluate(() => {
                const episodes = document.querySelectorAll('.ss-list .ssl-item, .episode-list .episode-item');
                return episodes.length;
            });
            
            return episodeCount || 12; // Default fallback
            
        } catch (error) {
            console.error('Episode count detection failed:', error);
            return 12; // Default fallback
        } finally {
            if (browser) {
                try {
                    await browser.close();
                } catch (e) {
                    console.error('Error closing browser:', e);
                }
            }
        }
    }

    // Utility method for delays
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Generate random delay
    randomDelay(min = 1000, max = 5000) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // Health check method
    async healthCheck() {
        try {
            const testSearch = await this.search('test');
            return {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                searchWorking: testSearch.length > 0
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                timestamp: new Date().toISOString(),
                error: error.message
            };
        }
    }

    // Get plugin info
    getInfo() {
        return {
            name: this.name,
            displayName: this.displayName,
            description: this.description,
            version: '2.0.0',
            features: [
                'Advanced Cloudflare bypass',
                'Multiple server support',
                'Batch episode downloading',
                'SUB/DUB support',
                'Automatic episode detection',
                'Retry mechanism',
                'Proxy rotation'
            ]
        };
    }
}

module.exports = Enhanced9AnimePlugin;