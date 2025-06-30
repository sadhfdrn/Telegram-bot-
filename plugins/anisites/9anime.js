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
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Linux"',
            'sec-fetch-dest': 'document',
            'sec-fetch-mode': 'navigate',
            'sec-fetch-site': 'none',
            'sec-fetch-user': '?1'
        };
        this.cloudscraperOptions = {
            uri: '',
            headers: this.headers,
            timeout: 30000,
            followRedirect: true
        };
        
        // Docker-optimized Puppeteer configuration
        this.puppeteerConfig = {
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
            headless: true,
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
                '--disable-features=TranslateUI',
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
                '--single-process',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor',
                '--memory-pressure-off',
                '--max_old_space_size=4096'
            ],
            timeout: 30000
        };
    }

    // Method 1: Using cloudscraper for Cloudflare bypass
    async searchWithCloudscraper(query, page = 1) {
        try {
            const searchUrl = `${this.baseUrl}/search?keyword=${encodeURIComponent(query)}&page=${page}`;
            
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
            throw new Error(`Search failed: ${error.message}`);
        }
    }

    // Method 2: Using Puppeteer for full browser simulation (Docker optimized)
    async searchWithPuppeteer(query, page = 1) {
        let browser;
        try {
            console.log('Launching Puppeteer with Docker configuration...');
            browser = await puppeteer.launch(this.puppeteerConfig);

            const browserPage = await browser.newPage();
            
            // Set realistic viewport and user agent for Linux
            await browserPage.setViewport({ width: 1366, height: 768 });
            await browserPage.setUserAgent(this.headers['User-Agent']);
            
            // Set extra HTTP headers
            await browserPage.setExtraHTTPHeaders(this.headers);
            
            // Block images, stylesheets, and fonts for faster loading in Docker
            await browserPage.setRequestInterception(true);
            browserPage.on('request', (req) => {
                const resourceType = req.resourceType();
                if (['stylesheet', 'image', 'font', 'media'].includes(resourceType)) {
                    req.abort();
                } else {
                    req.continue();
                }
            });

            const searchUrl = `${this.baseUrl}/search?keyword=${encodeURIComponent(query)}&page=${page}`;
            console.log(`Navigating to: ${searchUrl}`);
            
            await browserPage.goto(searchUrl, { 
                waitUntil: 'networkidle2',
                timeout: 30000
            });

            // Wait for content to load with timeout
            try {
                await browserPage.waitForSelector('.film_list-wrap .flw-item', { timeout: 15000 });
            } catch (selectorError) {
                console.warn('Search results selector not found, trying alternative selectors...');
                // Try alternative selectors
                const alternativeSelectors = ['.flw-item', '.item', '.anime-item', '.film-item'];
                let found = false;
                for (const selector of alternativeSelectors) {
                    try {
                        await browserPage.waitForSelector(selector, { timeout: 5000 });
                        found = true;
                        break;
                    } catch (e) {
                        continue;
                    }
                }
                if (!found) {
                    console.warn('No search results found with any selector');
                }
            }

            const content = await browserPage.content();
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

    // Get popular anime
    async getPopular(page = 1) {
        try {
            const popularUrl = `${this.baseUrl}/trending?page=${page}`;
            
            const options = {
                ...this.cloudscraperOptions,
                uri: popularUrl
            };

            console.log(`Fetching popular anime: ${popularUrl}`);
            const response = await cloudscraper(options);
            const $ = cheerio.load(response);
            
            return this.parseSearchResults($);
        } catch (error) {
            console.error(`Popular anime fetch error:`, error.message);
            // Fallback to main page
            try {
                const options = {
                    ...this.cloudscraperOptions,
                    uri: this.baseUrl
                };
                const response = await cloudscraper(options);
                const $ = cheerio.load(response);
                return this.parseSearchResults($);
            } catch (fallbackError) {
                throw new Error(`Failed to get popular anime: ${error.message}`);
            }
        }
    }

    // Get anime details
    async getAnimeDetails(animeId) {
        try {
            const animeUrl = animeId.startsWith('http') ? animeId : `${this.baseUrl}/watch/${animeId}`;
            
            const options = {
                ...this.cloudscraperOptions,
                uri: animeUrl
            };

            console.log(`Fetching anime details: ${animeUrl}`);
            const response = await cloudscraper(options);
            const $ = cheerio.load(response);
            
            return this.parseAnimeDetails($);
        } catch (error) {
            console.error(`Anime details fetch error:`, error.message);
            throw new Error(`Failed to get anime details: ${error.message}`);
        }
    }

    // Parse anime details from page
    parseAnimeDetails($) {
        const title = $('.film-name, .anime-info h1, h1').first().text().trim();
        const description = $('.film-description .text, .description, .summary').first().text().trim();
        const image = $('.film-poster img, .poster img').first().attr('src') || $('.film-poster img, .poster img').first().attr('data-src');
        
        // Extract metadata
        const metaItems = $('.film-stats .item, .info-item, .meta-item');
        const details = {
            title: title,
            description: description,
            image: image ? (image.startsWith('http') ? image : this.baseUrl + image) : null,
            year: null,
            status: null,
            episodes: null,
            genres: [],
            rating: null,
            type: 'TV'
        };

        metaItems.each((i, el) => {
            const $el = $(el);
            const label = $el.find('.item-head, .label').text().toLowerCase();
            const value = $el.find('.item-tail, .value').text().trim();
            
            if (label.includes('year') || label.includes('released')) {
                const yearMatch = value.match(/(\d{4})/);
                if (yearMatch) details.year = yearMatch[1];
            } else if (label.includes('status')) {
                details.status = value;
            } else if (label.includes('episode')) {
                const episodeMatch = value.match(/(\d+)/);
                if (episodeMatch) details.episodes = parseInt(episodeMatch[1]);
            } else if (label.includes('genre')) {
                details.genres = value.split(',').map(g => g.trim());
            } else if (label.includes('rating') || label.includes('score')) {
                details.rating = value;
            } else if (label.includes('type')) {
                details.type = value;
            }
        });

        // Try alternative selectors if main ones failed
        if (!details.year) {
            const yearText = $('.film-detail, .anime-detail').text();
            const yearMatch = yearText.match(/(\d{4})/);
            if (yearMatch) details.year = yearMatch[1];
        }

        if (!details.genres.length) {
            $('.genre a, .genres a').each((i, el) => {
                details.genres.push($(el).text().trim());
            });
        }

        return details;
    }

    // Download full season
    async downloadSeason(animeId, quality = '1080p', type = 'sub') {
        try {
            console.log(`Downloading season for ${animeId}`);
            
            // First get the episode list
            const episodes = await this.getEpisodeList(animeId);
            
            if (!episodes || episodes.length === 0) {
                throw new Error('No episodes found for this anime');
            }

            const episodeNumbers = episodes.map((_, index) => index + 1);
            return await this.downloadEpisodes(animeId, episodeNumbers, quality, type);
        } catch (error) {
            console.error(`Season download error:`, error.message);
            throw new Error(`Failed to download season: ${error.message}`);
        }
    }

    // Enhanced episode stream extraction (Docker optimized)
    async getStreamDataWithPuppeteer(episodeUrl) {
        let browser;
        try {
            console.log('Launching Puppeteer for stream extraction...');
            browser = await puppeteer.launch(this.puppeteerConfig);

            const page = await browser.newPage();
            await page.setUserAgent(this.headers['User-Agent']);
            await page.setExtraHTTPHeaders(this.headers);
            
            // Intercept network requests to capture streaming URLs
            const streamingUrls = [];
            await page.setRequestInterception(true);
            
            page.on('request', (req) => {
                const resourceType = req.resourceType();
                if (['stylesheet', 'image', 'font'].includes(resourceType)) {
                    req.abort();
                } else {
                    req.continue();
                }
            });
            
            page.on('response', async (response) => {
                const url = response.url();
                const contentType = response.headers()['content-type'] || '';
                
                // Look for video streaming URLs
                if (url.includes('.m3u8') || 
                    url.includes('.mp4') || 
                    contentType.includes('video/') ||
                    url.includes('streaming') ||
                    url.includes('embed')) {
                    streamingUrls.push({
                        url: url,
                        status: response.status(),
                        contentType: contentType
                    });
                }
            });

            await page.goto(episodeUrl, { 
                waitUntil: 'networkidle2',
                timeout: 30000
            });
            
            // Wait for video player to load
            await page.waitForTimeout(5000);
            
            // Try to find video elements
            const videoSources = await page.evaluate(() => {
                const videos = document.querySelectorAll('video, iframe');
                const sources = [];
                
                videos.forEach(video => {
                    if (video.src) sources.push(video.src);
                    if (video.tagName === 'VIDEO') {
                        const sourceTags = video.querySelectorAll('source');
                        sourceTags.forEach(source => {
                            if (source.src) sources.push(source.src);
                        });
                    }
                });
                
                return sources;
            });

            return {
                streamingUrls: streamingUrls,
                videoSources: videoSources,
                pageUrl: episodeUrl
            };
        } catch (error) {
            console.error(`Puppeteer stream extraction error:`, error.message);
            throw new Error(`Failed to extract stream data: ${error.message}`);
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

    // Alternative API approach - reverse engineered endpoints
    async getStreamDataViaAPI(episodeId) {
        try {
            // Common 9anime API patterns (these might need updating)
            const apiEndpoints = [
                `/ajax/v2/episode/sources?id=${episodeId}`,
                `/ajax/episode/list/${episodeId}`,
                `/ajax/load-list-episode?ep=${episodeId}`,
                `/ajax/film/servers?episodeId=${episodeId}`
            ];

            for (const endpoint of apiEndpoints) {
                try {
                    const options = {
                        ...this.cloudscraperOptions,
                        uri: `${this.baseUrl}${endpoint}`,
                        headers: {
                            ...this.headers,
                            'X-Requested-With': 'XMLHttpRequest',
                            'Referer': this.baseUrl
                        },
                        json: true
                    };

                    console.log(`Trying API endpoint: ${endpoint}`);
                    const response = await cloudscraper(options);
                    
                    if (response && (response.link || response.sources || response.data)) {
                        return response;
                    }
                } catch (endpointError) {
                    console.log(`Endpoint ${endpoint} failed:`, endpointError.message);
                    continue;
                }
            }

            throw new Error('No working API endpoints found');
        } catch (error) {
            console.error(`API stream data error:`, error.message);
            throw new Error(`Failed to get stream data via API: ${error.message}`);
        }
    }

    // Enhanced download function with multiple methods
    async downloadEpisodes(animeId, episodeNumbers, quality = '1080p', type = 'sub') {
        const downloadLinks = [];
        const episodes = await this.getEpisodeList(animeId);

        for (const episodeNum of episodeNumbers) {
            const episode = episodes[episodeNum - 1];
            if (!episode) continue;

            console.log(`Processing episode ${episodeNum}...`);

            // Try multiple methods to extract download links
            const methods = [
                () => this.getStreamDataViaAPI(episode.id),
                () => this.getStreamDataWithPuppeteer(episode.url),
                () => this.getStreamDataWithCloudscraper(episode.url)
            ];

            let streamData = null;
            for (let i = 0; i < methods.length; i++) {
                try {
                    console.log(`Trying method ${i + 1} for episode ${episodeNum}...`);
                    streamData = await methods[i]();
                    if (streamData) break;
                } catch (methodError) {
                    console.log(`Method ${i + 1} failed:`, methodError.message);
                    continue;
                }
            }

            if (streamData) {
                const directLink = await this.extractBestQualityLink(streamData, quality);
                if (directLink) {
                    downloadLinks.push({
                        episode: episodeNum,
                        title: episode.title || `Episode ${episodeNum}`,
                        url: directLink,
                        quality: quality,
                        type: type,
                        method: 'extracted',
                        size: 'Unknown'
                    });
                }
            }
        }

        return downloadLinks;
    }

    async getStreamDataWithCloudscraper(episodeUrl) {
        try {
            const options = {
                ...this.cloudscraperOptions,
                uri: episodeUrl
            };

            console.log(`Extracting stream data from: ${episodeUrl}`);
            const response = await cloudscraper(options);
            const $ = cheerio.load(response);
            
            // Look for embedded players and streaming URLs
            const iframes = [];
            $('iframe').each((i, el) => {
                const src = $(el).attr('src');
                if (src && (src.includes('embed') || src.includes('player'))) {
                    iframes.push(src);
                }
            });

            return { iframes, html: response };
        } catch (error) {
            throw new Error(`Cloudscraper extraction failed: ${error.message}`);
        }
    }

    extractBestQualityLink(streamData, preferredQuality) {
        // Logic to extract the best quality link from various stream data formats
        if (streamData.streamingUrls && streamData.streamingUrls.length > 0) {
            // Filter for direct video links
            const videoLinks = streamData.streamingUrls.filter(item => 
                item.url.includes('.mp4') || 
                item.url.includes('.m3u8') ||
                item.contentType?.includes('video/')
            );
            
            if (videoLinks.length > 0) {
                return videoLinks[0].url;
            }
        }

        if (streamData.videoSources && streamData.videoSources.length > 0) {
            return streamData.videoSources[0];
        }

        if (streamData.link) {
            return streamData.link;
        }

        return null;
    }

    parseSearchResults($) {
        const results = [];

        $('.film_list-wrap .flw-item, .flw-item, .item, .anime-item, .film-item').each((index, element) => {
            const $el = $(element);
            const titleElement = $el.find('.film-name a, .title a, .name a, a[title]').first();
            const imageElement = $el.find('.film-poster img, .poster img, .image img, img').first();
            const metaElement = $el.find('.film-detail .fd-infor, .info, .meta, .details').first();
            
            const title = titleElement.attr('title') || titleElement.text().trim();
            const url = titleElement.attr('href');
            const image = imageElement.attr('data-src') || imageElement.attr('src');
            
            const metaText = metaElement.text();
            const yearMatch = metaText.match(/(\d{4})/);
            const episodeMatch = metaText.match(/(\d+)\s*(?:eps?|episodes?)/i);
            const typeMatch = metaText.match(/(TV|Movie|OVA|ONA|Special)/i);
            const statusMatch = metaText.match(/(Completed|Ongoing|Upcoming)/i);

            if (title && url) {
                results.push({
                    id: this.extractAnimeId(url),
                    title: title,
                    url: this.baseUrl + url,
                    image: image ? (image.startsWith('http') ? image : this.baseUrl + image) : null,
                    year: yearMatch ? yearMatch[1] : null,
                    episodes: episodeMatch ? parseInt(episodeMatch[1]) : null,
                    type: typeMatch ? typeMatch[1] : 'TV',
                    status: statusMatch ? statusMatch[1] : 'Unknown'
                });
            }
        });

        return results;
    }

    // Main search method that tries multiple approaches
    async search(query, page = 1) {
        const methods = [
            () => this.searchWithCloudscraper(query, page),
            () => this.searchWithPuppeteer(query, page)
        ];

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
                if (i === methods.length - 1) {
                    throw error;
                }
            }
        }

        return [];
    }

    // Get episode list for an anime
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
            
            // Try different episode list selectors
            const episodeSelectors = [
                '.ss-list a',
                '.episode-list a',
                '.ep-item a',
                '.episodes a',
                '.episode a'
            ];

            for (const selector of episodeSelectors) {
                $(selector).each((index, element) => {
                    const $el = $(element);
                    const title = $el.attr('title') || $el.text().trim();
                    const url = $el.attr('href');
                    const episodeNum = $el.attr('data-number') || 
                                     title.match(/episode\s*(\d+)/i)?.[1] || 
                                     (index + 1);

                    if (url) {
                        episodes.push({
                            id: this.extractEpisodeId(url),
                            title: title,
                            url: this.baseUrl + url,
                            episode: parseInt(episodeNum) || (index + 1)
                        });
                    }
                });

                if (episodes.length > 0) break;
            }

            // If no episodes found, create a placeholder list
            if (episodes.length === 0) {
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

    // Helper methods
    extractAnimeId(url) {
        const matches = url.match(/\/watch\/([^\/\?]+)/);
        return matches ? matches[1] : url.split('/').pop().split('?')[0];
    }

    extractEpisodeId(url) {
        const matches = url.match(/\/watch\/[^\/]+\/ep-(\d+)/);
        return matches ? matches[1] : url.split('/').pop().split('?')[0];
    }

    async checkAvailability() {
        try {
            console.log('Checking site availability...');
            const options = {
                ...this.cloudscraperOptions,
                uri: this.baseUrl
            };
            await cloudscraper(options);
            console.log('Site is available');
            return true;
        } catch (error) {
            console.error('Site availability check failed:', error.message);
            return false;
        }
    }

    getSupportedQualities() {
        return ['1080p', '720p', '480p', '360p'];
    }

    getSupportedTypes() {
        return ['sub', 'dub'];
    }
}

module.exports = NineAnimePlugin;