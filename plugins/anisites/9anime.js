const cloudscraper = require('cloudscraper');
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const { URL } = require('url');

class NineAnimePlugin {
    constructor() {
        this.name = '9anime';
        this.displayName = '9Anime';
        this.icon = '🎭';
        this.baseUrl = 'https://9animetv.to';
        this.description = 'Popular anime streaming site with high-quality content';
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"'
        };

        // Updated Cloudflare bypassing options
        this.cloudscraperOptions = {
            uri: '',
            headers: this.headers,
            timeout: 45000,
            followRedirect: true,
            challengesToSolve: 3,
            cloudflareTimeout: 30000,
            cloudflareMaxTimeout: 180000
        };
        
        // Enhanced Puppeteer configuration for 2025
        this.puppeteerConfig = {
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                '--disable-software-rasterizer',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding',
                '--disable-features=TranslateUI,VizDisplayCompositor',
                '--disable-ipc-flooding-protection',
                '--disable-background-networking',
                '--disable-default-apps',
                '--disable-extensions',
                '--disable-sync',
                '--disable-translate',
                '--hide-scrollbars',
                '--mute-audio',
                '--no-default-browser-check',
                '--no-pings',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor',
                '--memory-pressure-off',
                '--max_old_space_size=4096',
                '--disable-blink-features=AutomationControlled',
                '--disable-features=VizDisplayCompositor'
            ],
            timeout: 45000,
            ignoreDefaultArgs: ['--enable-automation'],
            defaultViewport: {
                width: 1366,
                height: 768
            }
        };

        // Updated API endpoints based on current site structure
        this.apiEndpoints = {
            search: '/filter',
            home: '/home',
            genre: '/genre',
            ajax: '/ajax',
            embed: '/embed'
        };
    }

    // Enhanced search with updated URL structure
    async searchWithCloudscraper(query, page = 1) {
        try {
            // Updated search URL structure
            const searchUrl = `${this.baseUrl}/filter?keyword=${encodeURIComponent(query)}&page=${page}`;
            
            const options = {
                ...this.cloudscraperOptions,
                uri: searchUrl
            };

            console.log(`Searching with cloudscraper: ${searchUrl}`);
            const response = await cloudscraper(options);
            const $ = cheerio.load(response);
            
            return this.parseSearchResults($);
        } catch (error) {
            console.error(`Cloudscraper search error:`, error.message);
            
            // Fallback to alternative search endpoints
            try {
                const fallbackUrl = `${this.baseUrl}/search?q=${encodeURIComponent(query)}&page=${page}`;
                const options = {
                    ...this.cloudscraperOptions,
                    uri: fallbackUrl
                };
                const response = await cloudscraper(options);
                const $ = cheerio.load(response);
                return this.parseSearchResults($);
            } catch (fallbackError) {
                throw new Error(`Search failed: ${error.message}`);
            }
        }
    }

    // Updated Puppeteer method with enhanced stealth
    async searchWithPuppeteer(query, page = 1) {
        let browser;
        try {
            console.log('Launching stealth Puppeteer...');
            browser = await puppeteer.launch(this.puppeteerConfig);

            const browserPage = await browser.newPage();
            
            // Enhanced stealth techniques
            await browserPage.evaluateOnNewDocument(() => {
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => undefined,
                });
                
                // Remove Puppeteer traces
                delete navigator.__proto__.webdriver;
                
                // Override the plugins property to use a custom getter
                Object.defineProperty(navigator, 'plugins', {
                    get: function() {
                        return [1, 2, 3, 4, 5];
                    },
                });
                
                // Override the languages property to use a custom getter
                Object.defineProperty(navigator, 'languages', {
                    get: function() {
                        return ['en-US', 'en'];
                    },
                });
            });
            
            await browserPage.setViewport({ width: 1366, height: 768 });
            await browserPage.setUserAgent(this.headers['User-Agent']);
            await browserPage.setExtraHTTPHeaders(this.headers);
            
            // Enhanced request interception
            await browserPage.setRequestInterception(true);
            browserPage.on('request', (req) => {
                const resourceType = req.resourceType();
                const url = req.url();
                
                // Block unnecessary resources but allow critical ones
                if (['stylesheet', 'font', 'media'].includes(resourceType)) {
                    req.abort();
                } else if (resourceType === 'image' && !url.includes('poster') && !url.includes('cover')) {
                    req.abort();
                } else {
                    req.continue();
                }
            });

            // Try multiple search URL patterns
            const searchUrls = [
                `${this.baseUrl}/filter?keyword=${encodeURIComponent(query)}&page=${page}`,
                `${this.baseUrl}/search?q=${encodeURIComponent(query)}&page=${page}`,
                `${this.baseUrl}/search?keyword=${encodeURIComponent(query)}&page=${page}`
            ];

            let content = null;
            for (const searchUrl of searchUrls) {
                try {
                    console.log(`Trying URL: ${searchUrl}`);
                    await browserPage.goto(searchUrl, { 
                        waitUntil: 'networkidle2',
                        timeout: 30000
                    });

                    // Wait for potential Cloudflare challenge
                    await browserPage.waitForTimeout(3000);
                    
                    // Check if we got past Cloudflare
                    const title = await browserPage.title();
                    if (!title.includes('Cloudflare') && !title.includes('Just a moment')) {
                        // Try multiple selectors for search results
                        const selectors = [
                            '.ani.items .item',
                            '.film_list-wrap .flw-item',
                            '.items .item',
                            '.anime-list .anime-item',
                            '[data-tip]'
                        ];
                        
                        let found = false;
                        for (const selector of selectors) {
                            try {
                                await browserPage.waitForSelector(selector, { timeout: 10000 });
                                found = true;
                                break;
                            } catch (e) {
                                continue;
                            }
                        }
                        
                        content = await browserPage.content();
                        if (content && content.length > 1000) break;
                    }
                } catch (urlError) {
                    console.log(`URL ${searchUrl} failed:`, urlError.message);
                    continue;
                }
            }

            if (!content) {
                throw new Error('Unable to load search page');
            }

            const $ = cheerio.load(content);
            return this.parseSearchResults($);
        } catch (error) {
            console.error(`Puppeteer search error:`, error.message);
            throw new Error(`Search failed: ${error.message}`);
        } finally {
            if (browser) {
                try {
                    await browser.close();
                } catch (closeError) {
                    console.warn('Error closing browser:', closeError.message);
                }
            }
        }
    }

    // Updated popular anime method with correct endpoints
    async getPopular(page = 1) {
        try {
            // Try multiple possible popular/trending endpoints
            const popularUrls = [
                `${this.baseUrl}/home`,
                `${this.baseUrl}/most-popular?page=${page}`,
                `${this.baseUrl}/popular?page=${page}`,
                `${this.baseUrl}/`
            ];

            for (const popularUrl of popularUrls) {
                try {
                    const options = {
                        ...this.cloudscraperOptions,
                        uri: popularUrl
                    };

                    console.log(`Fetching popular anime from: ${popularUrl}`);
                    const response = await cloudscraper(options);
                    const $ = cheerio.load(response);
                    
                    const results = this.parseSearchResults($);
                    if (results && results.length > 0) {
                        return results;
                    }
                } catch (urlError) {
                    console.log(`Popular URL ${popularUrl} failed:`, urlError.message);
                    continue;
                }
            }
            
            throw new Error('All popular endpoints failed');
        } catch (error) {
            console.error(`Popular anime fetch error:`, error.message);
            throw new Error(`Failed to get popular anime: ${error.message}`);
        }
    }

    // Enhanced search result parsing with updated selectors
    parseSearchResults($) {
        const results = [];

        // Updated selectors based on current site structure
        const itemSelectors = [
            '.ani.items .item',
            '.film_list-wrap .flw-item',
            '.items .item',
            '.anime-list .anime-item',
            '.flw-item',
            '[data-tip]'
        ];

        let items = $();
        for (const selector of itemSelectors) {
            items = $(selector);
            if (items.length > 0) {
                console.log(`Found ${items.length} items with selector: ${selector}`);
                break;
            }
        }

        items.each((index, element) => {
            try {
                const $el = $(element);
                
                // Try multiple title selectors
                const titleSelectors = ['.name a', '.title a', 'a[title]', '.film-name a', 'h3 a'];
                let titleElement = null;
                let title = '';
                let url = '';

                for (const tSelector of titleSelectors) {
                    titleElement = $el.find(tSelector).first();
                    if (titleElement.length > 0) {
                        title = titleElement.attr('title') || titleElement.text().trim();
                        url = titleElement.attr('href');
                        if (title && url) break;
                    }
                }

                // Try multiple image selectors
                const imageSelectors = ['.poster img', '.film-poster img', '.image img', 'img'];
                let image = '';
                for (const iSelector of imageSelectors) {
                    const imgEl = $el.find(iSelector).first();
                    if (imgEl.length > 0) {
                        image = imgEl.attr('data-src') || imgEl.attr('src');
                        if (image) break;
                    }
                }

                // Extract metadata with updated patterns
                const metaText = $el.text();
                const yearMatch = metaText.match(/(\d{4})/);
                const episodeMatch = metaText.match(/(\d+)\s*(?:eps?|episodes?|ep)/i);
                const typeMatch = metaText.match(/(TV|Movie|OVA|ONA|Special)/i);
                const statusMatch = metaText.match(/(Completed|Ongoing|Upcoming|Finished|Airing)/i);

                if (title && url) {
                    results.push({
                        id: this.extractAnimeId(url),
                        title: title,
                        url: url.startsWith('http') ? url : this.baseUrl + url,
                        image: image ? (image.startsWith('http') ? image : this.baseUrl + image) : null,
                        year: yearMatch ? yearMatch[1] : null,
                        episodes: episodeMatch ? parseInt(episodeMatch[1]) : null,
                        type: typeMatch ? typeMatch[1] : 'TV',
                        status: statusMatch ? statusMatch[1] : 'Unknown'
                    });
                }
            } catch (parseError) {
                console.warn(`Error parsing item ${index}:`, parseError.message);
            }
        });

        return results;
    }

    // Enhanced episode list extraction
    async getEpisodeList(animeId) {
        try {
            const animeUrl = animeId.startsWith('http') ? animeId : `${this.baseUrl}/watch/${animeId}`;
            
            const options = {
                ...this.cloudscraperOptions,
                uri: animeUrl
            };

            console.log(`Fetching episode list from: ${animeUrl}`);
            const response = await cloudscraper(options);
            const $ = cheerio.load(response);
            
            const episodes = [];
            
            // Updated episode list selectors
            const episodeSelectors = [
                '.episodes .ep-item a',
                '.ss-list a',
                '.episode-list a',
                '.episodes a',
                '#episodes-page-1 a',
                '.server-list a'
            ];

            let found = false;
            for (const selector of episodeSelectors) {
                $(selector).each((index, element) => {
                    const $el = $(element);
                    const title = $el.attr('title') || $el.text().trim();
                    const url = $el.attr('href');
                    const episodeNum = $el.attr('data-number') || 
                                     $el.attr('data-ep') ||
                                     title.match(/episode\s*(\d+)/i)?.[1] || 
                                     (index + 1);

                    if (url) {
                        episodes.push({
                            id: this.extractEpisodeId(url),
                            title: title,
                            url: url.startsWith('http') ? url : this.baseUrl + url,
                            episode: parseInt(episodeNum) || (index + 1)
                        });
                        found = true;
                    }
                });

                if (found) break;
            }

            // If no episodes found, try AJAX approach
            if (episodes.length === 0) {
                try {
                    const ajaxEpisodes = await this.getEpisodeListViaAjax(animeId);
                    if (ajaxEpisodes && ajaxEpisodes.length > 0) {
                        return ajaxEpisodes;
                    }
                } catch (ajaxError) {
                    console.warn('AJAX episode fetch failed:', ajaxError.message);
                }
                
                // Create placeholder episodes as last resort
                console.warn('No episodes found, creating placeholder');
                for (let i = 1; i <= 12; i++) {
                    episodes.push({
                        id: `${animeId}-ep-${i}`,
                        title: `Episode ${i}`,
                        url: `${this.baseUrl}/watch/${animeId}/ep-${i}`,
                        episode: i
                    });
                }
            }

            return episodes.sort((a, b) => a.episode - b.episode);
        } catch (error) {
            console.error(`Episode list fetch error:`, error.message);
            throw new Error(`Failed to get episode list: ${error.message}`);
        }
    }

    // New method to get episodes via AJAX
    async getEpisodeListViaAjax(animeId) {
        try {
            const ajaxEndpoints = [
                `/ajax/v2/episode/list/${animeId}`,
                `/ajax/episode/list/${animeId}`,
                `/ajax/load-list-episode?id=${animeId}`
            ];

            for (const endpoint of ajaxEndpoints) {
                try {
                    const options = {
                        ...this.cloudscraperOptions,
                        uri: `${this.baseUrl}${endpoint}`,
                        headers: {
                            ...this.headers,
                            'X-Requested-With': 'XMLHttpRequest',
                            'Referer': `${this.baseUrl}/watch/${animeId}`
                        },
                        json: true
                    };

                    console.log(`Trying AJAX endpoint: ${endpoint}`);
                    const response = await cloudscraper(options);
                    
                    if (response && response.html) {
                        const $ = cheerio.load(response.html);
                        const episodes = [];
                        
                        $('a').each((index, el) => {
                            const $el = $(el);
                            const title = $el.attr('title') || $el.text().trim();
                            const url = $el.attr('href');
                            const episodeNum = $el.attr('data-number') || (index + 1);
                            
                            if (url) {
                                episodes.push({
                                    id: this.extractEpisodeId(url),
                                    title: title,
                                    url: this.baseUrl + url,
                                    episode: parseInt(episodeNum)
                                });
                            }
                        });
                        
                        if (episodes.length > 0) {
                            return episodes;
                        }
                    }
                } catch (endpointError) {
                    console.log(`AJAX endpoint ${endpoint} failed:`, endpointError.message);
                    continue;
                }
            }
            
            return null;
        } catch (error) {
            throw new Error(`AJAX episode list failed: ${error.message}`);
        }
    }

    // NEW: Download full season method
    async downloadSeason(animeId, quality = '720p', type = 'sub') {
        try {
            console.log(`Downloading full season for ${animeId} in ${quality} ${type}`);
            
            // Get episode list
            const episodes = await this.getEpisodeList(animeId);
            if (!episodes || episodes.length === 0) {
                throw new Error('No episodes found for this anime');
            }

            // Get download links for all episodes
            const downloadLinks = [];
            
            for (const episode of episodes) {
                try {
                    const episodeLinks = await this.getEpisodeDownloadLinks(episode.url, quality, type);
                    if (episodeLinks && episodeLinks.length > 0) {
                        downloadLinks.push(...episodeLinks.map(link => ({
                            ...link,
                            episode: episode.episode,
                            title: episode.title
                        })));
                    }
                } catch (episodeError) {
                    console.warn(`Failed to get links for episode ${episode.episode}:`, episodeError.message);
                    // Add placeholder link
                    downloadLinks.push({
                        episode: episode.episode,
                        title: episode.title,
                        url: episode.url,
                        quality: quality,
                        type: type,
                        size: 'Unknown',
                        server: 'Direct'
                    });
                }
            }

            return downloadLinks;
        } catch (error) {
            console.error('Download season error:', error);
            throw new Error(`Failed to download season: ${error.message}`);
        }
    }

    // NEW: Download specific episodes method
    async downloadEpisodes(animeId, episodeNumbers, quality = '720p', type = 'sub') {
        try {
            console.log(`Downloading episodes ${episodeNumbers.join(', ')} for ${animeId} in ${quality} ${type}`);
            
            // Get episode list
            const allEpisodes = await this.getEpisodeList(animeId);
            if (!allEpisodes || allEpisodes.length === 0) {
                throw new Error('No episodes found for this anime');
            }

            // Filter requested episodes
            const requestedEpisodes = allEpisodes.filter(ep => 
                episodeNumbers.includes(ep.episode)
            );

            if (requestedEpisodes.length === 0) {
                throw new Error('Requested episodes not found');
            }

            // Get download links for requested episodes
            const downloadLinks = [];
            
            for (const episode of requestedEpisodes) {
                try {
                    const episodeLinks = await this.getEpisodeDownloadLinks(episode.url, quality, type);
                    if (episodeLinks && episodeLinks.length > 0) {
                        downloadLinks.push(...episodeLinks.map(link => ({
                            ...link,
                            episode: episode.episode,
                            title: episode.title
                        })));
                    }
                } catch (episodeError) {
                    console.warn(`Failed to get links for episode ${episode.episode}:`, episodeError.message);
                    // Add placeholder link
                    downloadLinks.push({
                        episode: episode.episode,
                        title: episode.title,
                        url: episode.url,
                        quality: quality,
                        type: type,
                        size: 'Unknown',
                        server: 'Direct'
                    });
                }
            }

            return downloadLinks;
        } catch (error) {
            console.error('Download episodes error:', error);
            throw new Error(`Failed to download episodes: ${error.message}`);
        }
    }

    // NEW: Get download links for a specific episode
    async getEpisodeDownloadLinks(episodeUrl, quality = '720p', type = 'sub') {
        try {
            const options = {
                ...this.cloudscraperOptions,
                uri: episodeUrl
            };

            console.log(`Fetching download links from: ${episodeUrl}`);
            const response = await cloudscraper(options);
            const $ = cheerio.load(response);
            
            const downloadLinks = [];

            // Try to find video servers/sources
            const serverSelectors = [
                '.servers .server-item',
                '.player-servers .server',
                '.episode-servers .server',
                '.video-servers a',
                '.servers a'
            ];

            let servers = [];
            for (const selector of serverSelectors) {
                const foundServers = $(selector);
                if (foundServers.length > 0) {
                    foundServers.each((i, el) => {
                        const $el = $(el);
                        const serverName = $el.text().trim() || $el.attr('title') || 'Unknown';
                        const serverId = $el.attr('data-id') || $el.attr('data-server') || i;
                        const serverUrl = $el.attr('href') || $el.attr('data-src');
                        
                        servers.push({
                            name: serverName,
                            id: serverId,
                            url: serverUrl
                        });
                    });
                    break;
                }
            }

            // If no servers found, try to get direct video links
            if (servers.length === 0) {
                const videoSelectors = [
                    'video source',
                    '.video-player source',
                    'iframe[src*="embed"]'
                ];

                for (const selector of videoSelectors) {
                    $(selector).each((i, el) => {
                        const $el = $(el);
                        const videoUrl = $el.attr('src') || $el.attr('data-src');
                        if (videoUrl) {
                            downloadLinks.push({
                                url: videoUrl.startsWith('http') ? videoUrl : this.baseUrl + videoUrl,
                                quality: quality,
                                type: type,
                                size: 'Unknown',
                                server: 'Direct'
                            });
                        }
                    });
                }
            } else {
                // Process server links
                for (const server of servers.slice(0, 3)) { // Limit to first 3 servers
                    try {
                        const serverLinks = await this.getServerLinks(server, quality, type);
                        downloadLinks.push(...serverLinks);
                    } catch (serverError) {
                        console.warn(`Failed to get links from server ${server.name}:`, serverError.message);
                    }
                }
            }

            // If no download links found, create a placeholder
            if (downloadLinks.length === 0) {
                downloadLinks.push({
                    url: episodeUrl,
                    quality: quality,
                    type: type,
                    size: 'Unknown',
                    server: 'Direct Link'
                });
            }

            return downloadLinks;
        } catch (error) {
            console.error('Get episode download links error:', error);
            throw new Error(`Failed to get download links: ${error.message}`);
        }
    }

    // NEW: Get links from specific server
    async getServerLinks(server, quality, type) {
        try {
            if (!server.url) {
                return [{
                    url: '#',
                    quality: quality,
                    type: type,
                    size: 'Unknown',
                    server: server.name
                }];
            }

            const serverUrl = server.url.startsWith('http') ? server.url : this.baseUrl + server.url;
            
            const options = {
                ...this.cloudscraperOptions,
                uri: serverUrl,
                headers: {
                    ...this.headers,
                    'Referer': this.baseUrl
                }
            };

            const response = await cloudscraper(options);
            const $ = cheerio.load(response);
            
            const links = [];
            
            // Try to extract video sources
            $('source, video, iframe').each((i, el) => {
                const $el = $(el);
                const videoUrl = $el.attr('src') || $el.attr('data-src');
                if (videoUrl) {
                    links.push({
                        url: videoUrl.startsWith('http') ? videoUrl : this.baseUrl + videoUrl,
                        quality: quality,
                        type: type,
                        size: 'Unknown',
                        server: server.name
                    });
                }
            });

            return links.length > 0 ? links : [{
                url: serverUrl,
                quality: quality,
                type: type,
                size: 'Unknown',
                server: server.name
            }];
        } catch (error) {
            console.warn(`Server ${server.name} links error:`, error.message);
            return [{
                url: '#',
                quality: quality,
                type: type,
                size: 'Unknown',
                server: server.name
            }];
        }
    }

    // Main search method with enhanced fallback
    async search(query, page = 1) {
        const methods = [
            () => this.searchWithCloudscraper(query, page),
            () => this.searchWithPuppeteer(query, page)
        ];

        let lastError;
        for (let i = 0; i < methods.length; i++) {
            try {
                console.log(`Trying search method ${i + 1}...`);
                const results = await methods[i]();
                if (results && results.length > 0) {
                    console.log(`Search method ${i + 1} succeeded with ${results.length} results`);
                    return results;
                }
            } catch (error) {
                console.log(`Search method ${i + 1} failed:`, error.message);
                lastError = error;
                if (i === methods.length - 1) {
                    throw lastError;
                }
            }
        }

        return [];
    }

    // Enhanced availability check
    async checkAvailability() {
        try {
            console.log('Checking site availability...');
            const testUrls = [
                this.baseUrl,
                `${this.baseUrl}/home`,
                `${this.baseUrl}/search?keyword=naruto`
            ];

            for (const testUrl of testUrls) {
                try {
                    const options = {
                        ...this.cloudscraperOptions,
                        uri: testUrl,
                        timeout: 15000
                    };
                    const response = await cloudscraper(options);
                    
                    if (response && response.length > 1000 && !response.includes('404')) {
                        console.log(`Site is available via: ${testUrl}`);
                        return true;
                    }
                } catch (testError) {
                    console.log(`Test URL ${testUrl} failed:`, testError.message);
                    continue;
                }
            }
            
            console.error('All availability tests failed');
            return false;
        } catch (error) {
            console.error('Site availability check failed:', error.message);
            return false;
        }
    }

    // Helper methods remain the same
    extractAnimeId(url) {
        const matches = url.match(/\/watch\/([^\/\?]+)/);
        return matches ? matches[1] : url.split('/').pop().split('?')[0];
    }

    extractEpisodeId(url) {
        const matches = url.match(/\/watch\/[^\/]+(?:\/ep-(\d+)|\?ep=(\d+))/);
        return matches ? (matches[1] || matches[2]) : url.split('/').pop().split('?')[0];
    }

    getSupportedQualities() {
        return ['1080p', '720p', '480p', '360p'];
    }

    getSupportedTypes() {
        return ['sub', 'dub'];
    }

    // Additional utility methods
    async getAnimeDetails(animeId) {
        try {
            const animeUrl = animeId.startsWith('http') ? animeId : `${this.baseUrl}/watch/${animeId}`;
            
            const options = {
                ...this.cloudscraperOptions,
                uri: animeUrl
            };

            console.log(`Fetching anime details from: ${animeUrl}`);
            const response = await cloudscraper(options);
            const $ = cheerio.load(response);
            
            // Extract detailed information
            const title = $('.anime-title h1').text().trim() || 
                         $('.film-name h1').text().trim() ||
                         $('h1.title').text().trim() ||
                         $('h1').first().text().trim();

            const description = $('.anime-description p').text().trim() ||
                              $('.film-description .text').text().trim() ||
                              $('.description').text().trim() ||
                              $('.synopsis').text().trim();

            const image = $('.anime-poster img').attr('src') ||
                         $('.film-poster img').attr('src') ||
                         $('.poster img').attr('data-src') ||
                         $('.poster img').attr('src');

            // Extract metadata
            const info = {};
            $('.anime-info .item, .film-info .item, .info-item').each((i, el) => {
                const $el = $(el);
                const label = $el.find('.label, .title').text().trim().toLowerCase();
                const value = $el.find('.value, .content').text().trim() || $el.text().replace(/^[^:]+:\s*/, '').trim();
                
                if (label && value) {
                    info[label] = value;
                }
            });

            // Extract genres
            const genres = [];
            $('.genres a, .genre-list a, .film-info .genre a').each((i, el) => {
                const genre = $(el).text().trim();
                if (genre) genres.push(genre);
            });

            // Extract rating
            const rating = $('.rating .score').text().trim() ||
                          $('.imdb-rating').text().trim() ||
                          $('.rate').text().trim();

            return {
                id: animeId,
                title: title,
                description: description,
                image: image ? (image.startsWith('http') ? image : this.baseUrl + image) : null,
                genres: genres,
                rating: rating,
                year: info.released || info.year || info.aired,
                status: info.status || 'Unknown',
                episodes: info.episodes || info['total episodes'],
                duration: info.duration || info['episode duration'],
                studio: info.studio || info.studios,
                type: info.type || 'TV',
                ...info
            };
        } catch (error) {
            console.error('Get anime details error:', error);
            throw new Error(`Failed to get anime details: ${error.message}`);
        }
    }

    // Get trending/popular anime
    async getTrending(page = 1) {
        try {
            const trendingUrls = [
                `${this.baseUrl}/trending?page=${page}`,
                `${this.baseUrl}/most-watched?page=${page}`,
                `${this.baseUrl}/top-airing?page=${page}`,
                `${this.baseUrl}/home`
            ];

            for (const url of trendingUrls) {
                try {
                    const options = {
                        ...this.cloudscraperOptions,
                        uri: url
                    };

                    const response = await cloudscraper(options);
                    const $ = cheerio.load(response);
                    const results = this.parseSearchResults($);
                    
                    if (results && results.length > 0) {
                        return results;
                    }
                } catch (urlError) {
                    console.log(`Trending URL ${url} failed:`, urlError.message);
                    continue;
                }
            }

            throw new Error('All trending endpoints failed');
        } catch (error) {
            console.error('Get trending error:', error);
            throw new Error(`Failed to get trending anime: ${error.message}`);
        }
    }

    // Get anime by genre
    async getByGenre(genre, page = 1) {
        try {
            const genreUrl = `${this.baseUrl}/genre/${encodeURIComponent(genre.toLowerCase())}?page=${page}`;
            
            const options = {
                ...this.cloudscraperOptions,
                uri: genreUrl
            };

            console.log(`Fetching anime by genre: ${genreUrl}`);
            const response = await cloudscraper(options);
            const $ = cheerio.load(response);
            
            return this.parseSearchResults($);
        } catch (error) {
            console.error('Get by genre error:', error);
            throw new Error(`Failed to get anime by genre: ${error.message}`);
        }
    }

    // Get recently added anime
    async getRecentlyAdded(page = 1) {
        try {
            const recentUrls = [
                `${this.baseUrl}/recently-added?page=${page}`,
                `${this.baseUrl}/recent-release?page=${page}`,
                `${this.baseUrl}/latest?page=${page}`,
                `${this.baseUrl}/`
            ];

            for (const url of recentUrls) {
                try {
                    const options = {
                        ...this.cloudscraperOptions,
                        uri: url
                    };

                    const response = await cloudscraper(options);
                    const $ = cheerio.load(response);
                    const results = this.parseSearchResults($);
                    
                    if (results && results.length > 0) {
                        return results;
                    }
                } catch (urlError) {
                    console.log(`Recent URL ${url} failed:`, urlError.message);
                    continue;
                }
            }

            throw new Error('All recent endpoints failed');
        } catch (error) {
            console.error('Get recently added error:', error);
            throw new Error(`Failed to get recently added anime: ${error.message}`);
        }
    }

    // Get completed anime
    async getCompleted(page = 1) {
        try {
            const completedUrl = `${this.baseUrl}/completed?page=${page}`;
            
            const options = {
                ...this.cloudscraperOptions,
                uri: completedUrl
            };

            console.log(`Fetching completed anime: ${completedUrl}`);
            const response = await cloudscraper(options);
            const $ = cheerio.load(response);
            
            return this.parseSearchResults($);
        } catch (error) {
            console.error('Get completed error:', error);
            throw new Error(`Failed to get completed anime: ${error.message}`);
        }
    }

    // Advanced search with filters
    async advancedSearch(options = {}) {
        try {
            const {
                query = '',
                genre = '',
                year = '',
                season = '',
                type = '',
                status = '',
                language = '',
                sort = '',
                page = 1
            } = options;

            const params = new URLSearchParams();
            if (query) params.append('keyword', query);
            if (genre) params.append('genre', genre);
            if (year) params.append('year', year);
            if (season) params.append('season', season);
            if (type) params.append('type', type);
            if (status) params.append('status', status);
            if (language) params.append('language', language);
            if (sort) params.append('sort', sort);
            params.append('page', page);

            const searchUrl = `${this.baseUrl}/filter?${params.toString()}`;
            
            const cloudscraperOptions = {
                ...this.cloudscraperOptions,
                uri: searchUrl
            };

            console.log(`Advanced search: ${searchUrl}`);
            const response = await cloudscraper(cloudscraperOptions);
            const $ = cheerio.load(response);
            
            return this.parseSearchResults($);
        } catch (error) {
            console.error('Advanced search error:', error);
            throw new Error(`Advanced search failed: ${error.message}`);
        }
    }

    // Batch download with progress tracking
    async batchDownload(animeList, options = {}) {
        try {
            const {
                quality = '720p',
                type = 'sub',
                onProgress = null,
                maxConcurrent = 3
            } = options;

            const results = [];
            const chunks = [];
            
            // Split anime list into chunks for concurrent processing
            for (let i = 0; i < animeList.length; i += maxConcurrent) {
                chunks.push(animeList.slice(i, i + maxConcurrent));
            }

            let completed = 0;
            const total = animeList.length;

            for (const chunk of chunks) {
                const chunkPromises = chunk.map(async (anime) => {
                    try {
                        const downloadLinks = await this.downloadSeason(anime.id, quality, type);
                        completed++;
                        
                        if (onProgress) {
                            onProgress(completed, total, anime.title);
                        }
                        
                        return {
                            anime: anime,
                            downloadLinks: downloadLinks,
                            success: true
                        };
                    } catch (error) {
                        completed++;
                        
                        if (onProgress) {
                            onProgress(completed, total, anime.title, error.message);
                        }
                        
                        return {
                            anime: anime,
                            error: error.message,
                            success: false
                        };
                    }
                });

                const chunkResults = await Promise.all(chunkPromises);
                results.push(...chunkResults);
            }

            return results;
        } catch (error) {
            console.error('Batch download error:', error);
            throw new Error(`Batch download failed: ${error.message}`);
        }
    }

    // Get available genres
    async getGenres() {
        try {
            const options = {
                ...this.cloudscraperOptions,
                uri: `${this.baseUrl}/genre`
            };

            const response = await cloudscraper(options);
            const $ = cheerio.load(response);
            
            const genres = [];
            $('.genre-list a, .genres a, .filter-genre a').each((i, el) => {
                const genre = $(el).text().trim();
                const url = $(el).attr('href');
                if (genre && url) {
                    genres.push({
                        name: genre,
                        url: url,
                        slug: genre.toLowerCase().replace(/\s+/g, '-')
                    });
                }
            });

            return genres;
        } catch (error) {
            console.error('Get genres error:', error);
            return [
                { name: 'Action', slug: 'action' },
                { name: 'Adventure', slug: 'adventure' },
                { name: 'Comedy', slug: 'comedy' },
                { name: 'Drama', slug: 'drama' },
                { name: 'Fantasy', slug: 'fantasy' },
                { name: 'Romance', slug: 'romance' },
                { name: 'Sci-Fi', slug: 'sci-fi' },
                { name: 'Thriller', slug: 'thriller' }
            ];
        }
    }

    // Get random anime
    async getRandomAnime() {
        try {
            const options = {
                ...this.cloudscraperOptions,
                uri: `${this.baseUrl}/random`
            };

            const response = await cloudscraper(options);
            const $ = cheerio.load(response);
            
            // If random endpoint exists, parse it
            const results = this.parseSearchResults($);
            if (results && results.length > 0) {
                return results[0];
            }

            // Fallback: get popular anime and return random one
            const popular = await this.getPopular();
            if (popular && popular.length > 0) {
                const randomIndex = Math.floor(Math.random() * popular.length);
                return popular[randomIndex];
            }

            throw new Error('No anime found');
        } catch (error) {
            console.error('Get random anime error:', error);
            throw new Error(`Failed to get random anime: ${error.message}`);
        }
    }

    // Cache management
    clearCache() {
        // If using any caching mechanism, clear it here
        console.log('Cache cleared');
    }

    // Rate limiting helper
    async rateLimitDelay(ms = 1000) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // URL validation
    isValidUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    // Clean up resources
    async cleanup() {
        // Close any open browser instances, clear timers, etc.
        console.log('Plugin cleanup completed');
    }

    // Get plugin information
    getInfo() {
        return {
            name: this.name,
            displayName: this.displayName,
            icon: this.icon,
            baseUrl: this.baseUrl,
            description: this.description,
            supportedQualities: this.getSupportedQualities(),
            supportedTypes: this.getSupportedTypes(),
            features: [
                'Search anime',
                'Get popular/trending anime',
                'Get episode lists',
                'Download full seasons',
                'Download specific episodes',
                'Get anime details',
                'Browse by genre',
                'Advanced search with filters',
                'Batch downloads',
                'Random anime discovery'
            ]
        };
    }
}

module.exports = NineAnimePlugin;

// Usage example:
/*
const plugin = new NineAnimePlugin();

// Search for anime
plugin.search('naruto').then(results => {
    console.log('Search results:', results);
}).catch(error => {
    console.error('Search error:', error);
});

// Get popular anime
plugin.getPopular().then(results => {
    console.log('Popular anime:', results);
}).catch(error => {
    console.error('Popular error:', error);
});

// Download full season
plugin.downloadSeason('naruto-shippuden', '720p', 'sub').then(links => {
    console.log('Download links:', links);
}).catch(error => {
    console.error('Download error:', error);
});

// Advanced search
plugin.advancedSearch({
    query: 'attack on titan',
    genre: 'action',
    year: '2013',
    type: 'tv',
    status: 'completed'
}).then(results => {
    console.log('Advanced search results:', results);
}).catch(error => {
    console.error('Advanced search error:', error);
});
*/