const puppeteer = require('puppeteer-core');

class NineAnimePlugin {
    constructor() {
        this.name = '9anime';
        this.displayName = '9Anime';
        this.icon = '🎌';
        this.description = 'Stream anime from 9anime.tv';
        this.baseUrl = 'https://9animetv.to';
        this.browserlessToken = process.env.BROWSERLESS_TOKEN || 'your-browserless-token';
        this.browserlessUrl = `wss://chrome.browserless.io?token=${this.browserlessToken}`;
        
        // Validate browserless token
        if (!this.browserlessToken || this.browserlessToken === 'your-browserless-token') {
            console.warn('⚠️  9anime plugin: BROWSERLESS_TOKEN not set or invalid');
        }
    }

    async getBrowser() {
        // Fallback to local Chrome if browserless.io fails
        if (!this.browserlessToken || this.browserlessToken === 'your-browserless-token') {
            console.log('🔄 9anime: Using local Chrome instead of browserless.io');
            return await puppeteer.launch({
                headless: 'new',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor'
                ]
            });
        }
        
        try {
            return await puppeteer.connect({
                browserWSEndpoint: this.browserlessUrl,
                defaultViewport: { width: 1920, height: 1080 }
            });
        } catch (error) {
            console.warn('⚠️  9anime: Browserless.io connection failed, falling back to local Chrome');
            console.warn('Error:', error.message);
            
            // Fallback to local Chrome
            return await puppeteer.launch({
                headless: 'new',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor'
                ]
            });
        }
    }

    async search(query) {
        const browser = await this.getBrowser();
        try {
            const page = await browser.newPage();
            await this.bypassAntiBot(page);
            
            // Navigate to 9anime
            await page.goto(this.baseUrl, { waitUntil: 'networkidle2' });
            
            // Search for anime
            await page.waitForSelector('.search-input, #search-input, input[type="search"]', { timeout: 10000 });
            
            // Try multiple search input selectors
            const searchInput = await page.$('.search-input') || 
                               await page.$('#search-input') || 
                               await page.$('input[type="search"]') ||
                               await page.$('.form-control');
            
            if (!searchInput) {
                throw new Error('Search input not found');
            }
            
            await searchInput.type(query);
            await page.keyboard.press('Enter');
            
            // Wait for search results
            await page.waitForSelector('.flw-item, .film-list-wrap, .anime-list', { timeout: 15000 });
            
            // Extract search results
            const results = await page.evaluate(() => {
                const items = document.querySelectorAll('.flw-item, .film-item, .anime-item');
                return Array.from(items).slice(0, 10).map(item => {
                    const titleElement = item.querySelector('.film-name a, .title a, a[title]');
                    const imgElement = item.querySelector('.film-poster img, .poster img, img');
                    const yearElement = item.querySelector('.fdi-item, .year, .release-year');
                    const statusElement = item.querySelector('.tick-item, .status, .anime-status');
                    
                    return {
                        title: titleElement?.textContent?.trim() || titleElement?.getAttribute('title') || 'Unknown',
                        url: titleElement?.href || '',
                        id: titleElement?.href?.split('/').pop()?.split('-').pop() || titleElement?.href?.split('/').pop() || '',
                        image: imgElement?.src || imgElement?.getAttribute('data-src') || '',
                        year: yearElement?.textContent?.trim() || 'N/A',
                        status: statusElement?.textContent?.trim() || 'Unknown'
                    };
                });
            });
            
            return results.filter(result => result.title !== 'Unknown' && result.url);
        } catch (error) {
            console.error('9anime search error:', error);
            throw new Error(`Search failed: ${error.message}`);
        } finally {
            await browser.close();
        }
    }

    async getPopular() {
        const browser = await this.getBrowser();
        try {
            const page = await browser.newPage();
            await this.bypassAntiBot(page);
            
            // Navigate to 9anime home page
            await page.goto(this.baseUrl, { waitUntil: 'networkidle2' });
            
            // Extract popular anime
            const popularAnime = await page.evaluate(() => {
                const items = document.querySelectorAll('.flw-item');
                return Array.from(items).slice(0, 12).map(item => {
                    const titleElement = item.querySelector('.film-name a');
                    const imgElement = item.querySelector('.film-poster img');
                    const yearElement = item.querySelector('.fdi-item:first-child');
                    const statusElement = item.querySelector('.tick-item');
                    
                    return {
                        title: titleElement?.textContent?.trim() || 'Unknown',
                        url: titleElement?.href || '',
                        id: titleElement?.href?.split('/').pop()?.split('-').pop() || '',
                        image: imgElement?.src || imgElement?.getAttribute('data-src') || '',
                        year: yearElement?.textContent?.trim() || 'N/A',
                        status: statusElement?.textContent?.trim() || 'Unknown'
                    };
                });
            });
            
            return popularAnime.filter(anime => anime.title !== 'Unknown' && anime.url);
        } catch (error) {
            console.error('9anime popular error:', error);
            throw new Error(`Failed to get popular anime: ${error.message}`);
        } finally {
            await browser.close();
        }
    }
        const browser = await this.getBrowser();
        try {
            const page = await browser.newPage();
            
            // Navigate to anime details page
            const animeUrl = `${this.baseUrl}/watch/${animeId}`;
            await page.goto(animeUrl, { waitUntil: 'networkidle2' });
            
            // Extract anime details
            const details = await page.evaluate(() => {
                const titleElement = document.querySelector('.film-name, .heading-name');
                const descElement = document.querySelector('.film-description, .description');
                const yearElement = document.querySelector('.item:contains("Released:")');
                const statusElement = document.querySelector('.item:contains("Status:")');
                const genresElements = document.querySelectorAll('.item a[href*="/genre/"]');
                
                // Get episode count
                const episodeElements = document.querySelectorAll('.ss-list a');
                
                return {
                    title: titleElement?.textContent?.trim() || 'Unknown',
                    description: descElement?.textContent?.trim() || 'No description available',
                    year: yearElement?.textContent?.replace('Released:', '').trim() || 'N/A',
                    status: statusElement?.textContent?.replace('Status:', '').trim() || 'Unknown',
                    genres: Array.from(genresElements).map(el => el.textContent.trim()),
                    episodes: episodeElements.length || 'Unknown'
                };
            });
            
            return details;
        } catch (error) {
            console.error('9anime details error:', error);
            throw new Error(`Failed to get anime details: ${error.message}`);
        } finally {
            await browser.close();
        }
    }

    async getEpisodeList(animeId) {
        const browser = await this.getBrowser();
        try {
            const page = await browser.newPage();
            
            const animeUrl = `${this.baseUrl}/watch/${animeId}`;
            await page.goto(animeUrl, { waitUntil: 'networkidle2' });
            
            // Extract episode list
            const episodes = await page.evaluate(() => {
                const episodeElements = document.querySelectorAll('.ss-list a');
                return Array.from(episodeElements).map((el, index) => {
                    const epId = el.getAttribute('data-id') || el.href.split('ep=')[1];
                    return {
                        number: index + 1,
                        id: epId,
                        title: el.getAttribute('title') || `Episode ${index + 1}`,
                        url: el.href
                    };
                });
            });
            
            return episodes;
        } catch (error) {
            console.error('9anime episode list error:', error);
            throw new Error(`Failed to get episode list: ${error.message}`);
        } finally {
            await browser.close();
        }
    }

    async getStreamingLinks(animeId, episodeId, type = 'sub') {
        const browser = await this.getBrowser();
        try {
            const page = await browser.newPage();
            
            // Navigate to episode page
            const episodeUrl = `${this.baseUrl}/watch/${animeId}?ep=${episodeId}`;
            await page.goto(episodeUrl, { waitUntil: 'networkidle2' });
            
            // Switch to dub if requested
            if (type === 'dub') {
                const dubButton = await page.$('.server-item[data-type="dub"]');
                if (dubButton) {
                    await dubButton.click();
                    await page.waitForTimeout(2000);
                }
            }
            
            // Look for vidstreaming server
            const vidstreamingServer = await page.$('.server-item[data-type="sub"] .server-name:contains("Vidstreaming")');
            if (vidstreamingServer) {
                await vidstreamingServer.click();
                await page.waitForTimeout(3000);
            }
            
            // Extract streaming links
            const streamingData = await page.evaluate(() => {
                const servers = [];
                const serverElements = document.querySelectorAll('.server-item');
                
                serverElements.forEach(server => {
                    const serverName = server.querySelector('.server-name')?.textContent?.trim();
                    const serverId = server.getAttribute('data-id');
                    
                    if (serverName && serverId) {
                        servers.push({
                            name: serverName,
                            id: serverId,
                            type: server.getAttribute('data-type') || 'sub'
                        });
                    }
                });
                
                return servers;
            });
            
            // Get direct video links (this part depends on 9anime's current structure)
            const videoLinks = await this.extractVideoLinks(page);
            
            return {
                servers: streamingData,
                videoLinks: videoLinks
            };
            
        } catch (error) {
            console.error('9anime streaming links error:', error);
            throw new Error(`Failed to get streaming links: ${error.message}`);
        } finally {
            await browser.close();
        }
    }

    async extractVideoLinks(page) {
        try {
            // Wait for video player to load
            await page.waitForSelector('video, iframe', { timeout: 10000 });
            
            // Extract video sources
            const videoSources = await page.evaluate(() => {
                const videos = document.querySelectorAll('video source');
                const iframes = document.querySelectorAll('iframe');
                const sources = [];
                
                // Direct video sources
                videos.forEach(video => {
                    if (video.src) {
                        sources.push({
                            url: video.src,
                            quality: video.getAttribute('data-quality') || 'Unknown',
                            type: 'direct'
                        });
                    }
                });
                
                // Iframe sources (need further processing)
                iframes.forEach(iframe => {
                    if (iframe.src && iframe.src.includes('embed')) {
                        sources.push({
                            url: iframe.src,
                            quality: 'Unknown',
                            type: 'embed'
                        });
                    }
                });
                
                return sources;
            });
            
            return videoSources;
        } catch (error) {
            console.error('Video extraction error:', error);
            return [];
        }
    }

    async downloadEpisodes(animeId, episodes, quality = 'auto', type = 'sub') {
        const downloadLinks = [];
        
        for (const episodeNum of episodes) {
            try {
                const episodeList = await this.getEpisodeList(animeId);
                const episode = episodeList.find(ep => ep.number === episodeNum);
                
                if (!episode) {
                    console.warn(`Episode ${episodeNum} not found`);
                    continue;
                }
                
                const streamingData = await this.getStreamingLinks(animeId, episode.id, type);
                
                // Find the best quality link
                const bestLink = this.selectBestQuality(streamingData.videoLinks, quality);
                
                if (bestLink) {
                    downloadLinks.push({
                        episode: episodeNum,
                        url: bestLink.url,
                        quality: bestLink.quality,
                        type: type,
                        size: 'Unknown'
                    });
                }
                
            } catch (error) {
                console.error(`Failed to get episode ${episodeNum}:`, error);
            }
        }
        
        return downloadLinks;
    }

    async downloadSeason(animeId, quality = 'auto', type = 'sub') {
        try {
            const episodeList = await this.getEpisodeList(animeId);
            const episodeNumbers = episodeList.map(ep => ep.number);
            
            return await this.downloadEpisodes(animeId, episodeNumbers, quality, type);
        } catch (error) {
            console.error('Season download error:', error);
            throw new Error(`Failed to download season: ${error.message}`);
        }
    }

    selectBestQuality(videoLinks, requestedQuality) {
        if (!videoLinks || videoLinks.length === 0) {
            return null;
        }
        
        // Priority order for quality selection
        const qualityPriority = {
            '1080p': 5,
            '720p': 4,
            '480p': 3,
            '360p': 2,
            'auto': 1
        };
        
        // If specific quality requested, try to find it
        if (requestedQuality !== 'auto') {
            const exactMatch = videoLinks.find(link => 
                link.quality.toLowerCase().includes(requestedQuality.toLowerCase())
            );
            if (exactMatch) return exactMatch;
        }
        
        // Otherwise, select highest quality available
        return videoLinks.reduce((best, current) => {
            const currentPriority = qualityPriority[current.quality] || 0;
            const bestPriority = qualityPriority[best.quality] || 0;
            
            return currentPriority > bestPriority ? current : best;
        });
    }

    // Helper method to handle 9anime's anti-bot measures
    async bypassAntiBot(page) {
        try {
            // Set user agent
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            
            // Add extra headers
            await page.setExtraHTTPHeaders({
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Cache-Control': 'max-age=0'
            });
            
            // Set viewport
            await page.setViewport({ width: 1920, height: 1080 });
            
            // Wait for any potential loading screens
            await page.waitForTimeout(2000);
            
            // Handle potential cloudflare challenge
            const title = await page.title();
            if (title.includes('Just a moment') || title.includes('Checking your browser') || title.includes('Please wait')) {
                console.log('🔄 9anime: Detected anti-bot challenge, waiting...');
                await page.waitForTimeout(5000);
                
                // Try to wait for navigation
                try {
                    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
                } catch (navError) {
                    console.warn('⚠️  9anime: Navigation timeout, continuing anyway');
                }
            }
            
        } catch (error) {
            console.warn('⚠️  9anime: Anti-bot bypass warning:', error.message);
        }
    }
}

module.exports = NineAnimePlugin;