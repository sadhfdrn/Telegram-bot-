const puppeteer = require('puppeteer-core');

class NineAnimeScraper {
    constructor() {
        this.name = '9anime';
        this.displayName = '9Anime.tv';
        this.icon = '🇯🇵';
        this.description = 'Popular anime streaming site with SUB/DUB options';
        this.baseUrl = 'https://9animetv.to';
        this.browserlessToken = process.env.BROWSERLESS_TOKEN; // Set in environment
        this.maxRetries = 3;
        this.retryDelay = 2000;
        
        // Browser stealth settings
        this.stealthConfig = {
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: { width: 1920, height: 1080 },
            locale: 'en-US,en;q=0.9',
            timezone: 'America/New_York'
        };
    }

    /**
     * Create a stealth browser instance using browserless.io
     */
    async createBrowser() {
        const browserWSEndpoint = `wss://chrome.browserless.io?token=${this.browserlessToken}&stealth=true&blockAds=true`;
        
        const browser = await puppeteer.connect({
            browserWSEndpoint,
            ignoreHTTPSErrors: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                '--disable-extensions',
                '--disable-default-apps',
                '--disable-sync',
                '--disable-translate',
                '--hide-scrollbars',
                '--metrics-recording-only',
                '--mute-audio',
                '--no-default-browser-check',
                '--safebrowsing-disable-auto-update',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding',
                '--disable-features=TranslateUI',
                '--disable-ipc-flooding-protection',
                '--disable-blink-features=AutomationControlled',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor'
            ]
        });

        return browser;
    }

    /**
     * Setup page with stealth configurations
     */
    async setupPage(browser) {
        const page = await browser.newPage();
        
        // Set viewport and user agent
        await page.setViewport(this.stealthConfig.viewport);
        await page.setUserAgent(this.stealthConfig.userAgent);

        // Set language and timezone
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'language', {
                get: () => 'en-US',
            });
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en'],
            });
        });

        // Remove automation indicators
        await page.evaluateOnNewDocument(() => {
            window.navigator.chrome = {
                runtime: {},
            };
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
            });
        });

        // Set extra headers
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'max-age=0',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1'
        });

        // Block unnecessary resources to speed up loading
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            const resourceType = req.resourceType();
            if (resourceType === 'stylesheet' || resourceType === 'font' || resourceType === 'image') {
                req.abort();
            } else {
                req.continue();
            }
        });

        return page;
    }

    /**
     * Handle retry logic with exponential backoff
     */
    async withRetry(operation, maxRetries = this.maxRetries) {
        for (let i = 0; i < maxRetries; i++) {
            try {
                return await operation();
            } catch (error) {
                if (i === maxRetries - 1) throw error;
                
                const delay = this.retryDelay * Math.pow(2, i);
                console.log(`Retry ${i + 1}/${maxRetries} after ${delay}ms delay:`, error.message);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    /**
     * Search for anime on 9anime
     */
    async search(query) {
        return await this.withRetry(async () => {
            const browser = await this.createBrowser();
            let page;
            
            try {
                page = await this.setupPage(browser);
                
                // Navigate to search page
                const searchUrl = `${this.baseUrl}/search?keyword=${encodeURIComponent(query)}`;
                await page.goto(searchUrl, { 
                    waitUntil: 'networkidle0',
                    timeout: 30000 
                });

                // Wait for search results to load
                await page.waitForSelector('.film_list-wrap', { timeout: 15000 });
                
                // Extract search results
                const results = await page.evaluate(() => {
                    const items = document.querySelectorAll('.flw-item');
                    return Array.from(items).slice(0, 10).map(item => {
                        const titleElement = item.querySelector('.film-name a');
                        const linkElement = item.querySelector('.film-poster a');
                        const yearElement = item.querySelector('.fdi-item:first-child');
                        const statusElement = item.querySelector('.fdi-item:last-child');
                        const posterElement = item.querySelector('.film-poster img');
                        
                        return {
                            title: titleElement?.textContent?.trim() || '',
                            url: linkElement?.href || '',
                            id: linkElement?.href?.match(/\/([^\/]+)$/)?.[1] || '',
                            year: yearElement?.textContent?.trim() || '',
                            status: statusElement?.textContent?.trim() || '',
                            poster: posterElement?.src || ''
                        };
                    }).filter(item => item.title && item.url);
                });

                return results;
            } finally {
                if (page) await page.close();
                await browser.disconnect();
            }
        });
    }

    /**
     * Get detailed anime information
     */
    async getAnimeDetails(animeId) {
        return await this.withRetry(async () => {
            const browser = await this.createBrowser();
            let page;
            
            try {
                page = await this.setupPage(browser);
                
                const animeUrl = `${this.baseUrl}/watch/${animeId}`;
                await page.goto(animeUrl, { 
                    waitUntil: 'networkidle0',
                    timeout: 30000 
                });

                // Wait for anime details to load
                await page.waitForSelector('.anis-content', { timeout: 15000 });
                
                // Extract anime details
                const details = await page.evaluate(() => {
                    const title = document.querySelector('.anis-content h1')?.textContent?.trim() || '';
                    const description = document.querySelector('.anis-content .text')?.textContent?.trim() || '';
                    const genres = Array.from(document.querySelectorAll('.anis-content .item-list a')).map(a => a.textContent.trim());
                    const year = document.querySelector('.anis-content .item-list .dot')?.nextSibling?.textContent?.trim() || '';
                    const status = document.querySelector('.anis-content .tick-item')?.textContent?.trim() || '';
                    const poster = document.querySelector('.anis-content .film-poster img')?.src || '';
                    
                    // Get episode count
                    const episodeElements = document.querySelectorAll('.ss-list .ssl-item');
                    const episodes = episodeElements.length;

                    return {
                        title,
                        description,
                        genres,
                        year,
                        status,
                        poster,
                        episodes
                    };
                });

                return details;
            } finally {
                if (page) await page.close();
                await browser.disconnect();
            }
        });
    }

    /**
     * Get episode list for an anime
     */
    async getEpisodeList(animeId) {
        return await this.withRetry(async () => {
            const browser = await this.createBrowser();
            let page;
            
            try {
                page = await this.setupPage(browser);
                
                const animeUrl = `${this.baseUrl}/watch/${animeId}`;
                await page.goto(animeUrl, { 
                    waitUntil: 'networkidle0',
                    timeout: 30000 
                });

                // Wait for episode list to load
                await page.waitForSelector('.ss-list', { timeout: 15000 });
                
                // Extract episode information
                const episodes = await page.evaluate(() => {
                    return Array.from(document.querySelectorAll('.ss-list .ssl-item')).map(item => {
                        const title = item.querySelector('.ssli-title')?.textContent?.trim() || '';
                        const number = item.querySelector('.ssli-order')?.textContent?.trim() || '';
                        const id = item.getAttribute('data-id') || '';
                        const href = item.querySelector('a')?.href || '';
                        
                        return {
                            title,
                            number: parseInt(number) || 0,
                            id,
                            href
                        };
                    }).filter(ep => ep.id);
                });

                return episodes;
            } finally {
                if (page) await page.close();
                await browser.disconnect();
            }
        });
    }

    /**
     * Get streaming servers for a specific episode
     */
    async getStreamingServers(animeId, episodeId, type = 'sub') {
        return await this.withRetry(async () => {
            const browser = await this.createBrowser();
            let page;
            
            try {
                page = await this.setupPage(browser);
                
                const episodeUrl = `${this.baseUrl}/watch/${animeId}?ep=${episodeId}`;
                await page.goto(episodeUrl, { 
                    waitUntil: 'networkidle0',
                    timeout: 30000 
                });

                // Switch to DUB if requested
                if (type === 'dub') {
                    const dubButton = await page.$('.dub-tab');
                    if (dubButton) {
                        await dubButton.click();
                        await page.waitForTimeout(2000);
                    }
                }

                // Wait for servers to load
                await page.waitForSelector('.ps_-list', { timeout: 15000 });
                
                // Extract server information
                const servers = await page.evaluate(() => {
                    return Array.from(document.querySelectorAll('.ps_-list .ps__-item')).map(item => {
                        const name = item.querySelector('.ps__-name')?.textContent?.trim() || '';
                        const serverId = item.getAttribute('data-id') || '';
                        const type = item.getAttribute('data-type') || '';
                        
                        return {
                            name,
                            serverId,
                            type
                        };
                    }).filter(server => server.name && server.serverId);
                });

                return servers;
            } finally {
                if (page) await page.close();
                await browser.disconnect();
            }
        });
    }

    /**
     * Get direct download/stream link
     */
    async getStreamLink(animeId, episodeId, serverId, type = 'sub') {
        return await this.withRetry(async () => {
            const browser = await this.createBrowser();
            let page;
            
            try {
                page = await this.setupPage(browser);
                
                const episodeUrl = `${this.baseUrl}/watch/${animeId}?ep=${episodeId}`;
                await page.goto(episodeUrl, { 
                    waitUntil: 'networkidle0',
                    timeout: 30000 
                });

                // Switch to DUB if requested
                if (type === 'dub') {
                    const dubButton = await page.$('.dub-tab');
                    if (dubButton) {
                        await dubButton.click();
                        await page.waitForTimeout(2000);
                    }
                }

                // Click on the specific server
                const serverSelector = `.ps__-item[data-id="${serverId}"]`;
                await page.waitForSelector(serverSelector, { timeout: 15000 });
                await page.click(serverSelector);
                await page.waitForTimeout(3000);

                // Wait for iframe to load
                await page.waitForSelector('#iframe-embed', { timeout: 15000 });
                
                // Get iframe source
                const iframeSrc = await page.evaluate(() => {
                    const iframe = document.querySelector('#iframe-embed');
                    return iframe?.src || '';
                });

                if (!iframeSrc) {
                    throw new Error('No iframe source found');
                }

                // Navigate to iframe source to extract video URL
                await page.goto(iframeSrc, { 
                    waitUntil: 'networkidle0',
                    timeout: 30000 
                });

                // Extract video source (this may vary based on the streaming server)
                const videoUrl = await page.evaluate(() => {
                    // Try different selectors based on common video players
                    const videoElement = document.querySelector('video source, video');
                    if (videoElement) {
                        return videoElement.src || videoElement.getAttribute('src');
                    }
                    
                    // Check for m3u8 links in page source
                    const m3u8Match = document.body.innerHTML.match(/(https?:\/\/[^\s"']+\.m3u8[^\s"']*)/);
                    if (m3u8Match) {
                        return m3u8Match[1];
                    }
                    
                    // Check for mp4 links
                    const mp4Match = document.body.innerHTML.match(/(https?:\/\/[^\s"']+\.mp4[^\s"']*)/);
                    if (mp4Match) {
                        return mp4Match[1];
                    }
                    
                    return null;
                });

                return videoUrl;
            } finally {
                if (page) await page.close();
                await browser.disconnect();
            }
        });
    }

    /**
     * Download episodes (returns download links)
     */
    async downloadEpisodes(animeId, episodeNumbers, quality = '720p', type = 'sub') {
        const downloadLinks = [];
        
        try {
            const episodeList = await this.getEpisodeList(animeId);
            
            for (const episodeNumber of episodeNumbers) {
                const episode = episodeList.find(ep => ep.number === episodeNumber);
                if (!episode) {
                    console.warn(`Episode ${episodeNumber} not found`);
                    continue;
                }

                try {
                    const servers = await this.getStreamingServers(animeId, episode.id, type);
                    const preferredServer = servers.find(s => s.name.toLowerCase().includes('vidstreaming')) || servers[0];
                    
                    if (preferredServer) {
                        const streamLink = await this.getStreamLink(animeId, episode.id, preferredServer.serverId, type);
                        
                        if (streamLink) {
                            downloadLinks.push({
                                episode: episodeNumber,
                                title: episode.title,
                                url: streamLink,
                                quality: quality,
                                type: type,
                                server: preferredServer.name,
                                size: 'Unknown'
                            });
                        }
                    }
                } catch (error) {
                    console.error(`Error getting episode ${episodeNumber}:`, error.message);
                }
            }
        } catch (error) {
            console.error('Error downloading episodes:', error.message);
            throw error;
        }

        return downloadLinks;
    }

    /**
     * Download full season
     */
    async downloadSeason(animeId, quality = '720p', type = 'sub') {
        const episodeList = await this.getEpisodeList(animeId);
        const episodeNumbers = episodeList.map(ep => ep.number);
        
        return await this.downloadEpisodes(animeId, episodeNumbers, quality, type);
    }

    /**
     * Test connectivity to the site
     */
    async testConnection() {
        try {
            const browser = await this.createBrowser();
            let page;
            
            try {
                page = await this.setupPage(browser);
                await page.goto(this.baseUrl, { 
                    waitUntil: 'networkidle0',
                    timeout: 30000 
                });
                
                const title = await page.title();
                return title.includes('9anime') || title.includes('9Anime');
            } finally {
                if (page) await page.close();
                await browser.disconnect();
            }
        } catch (error) {
            console.error('Connection test failed:', error.message);
            return false;
        }
    }
}

module.exports = NineAnimeScraper;