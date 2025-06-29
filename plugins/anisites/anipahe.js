const puppeteer = require('puppeteer');
const axios = require('axios');
const { URL } = require('url');

class AnipahePlugin {
    constructor() {
        this.name = 'anipahe';
        this.displayName = 'Anipahe';
        this.icon = '🌸';
        this.baseUrl = 'https://animepahe.ru';
        this.apiUrl = 'https://animepahe.ru/api';
        this.description = 'High-quality anime downloads with minimal ads';
        
        this.browser = null;
        this.page = null;
        this.isInitialized = false;
        
        // Puppeteer configuration
        this.puppeteerConfig = {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-gpu',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor',
                '--disable-extensions',
                '--disable-plugins',
                '--disable-images', // Speed up loading
                '--disable-javascript', // We'll enable when needed
                '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            ],
            ignoreDefaultArgs: ['--enable-automation'],
            ignoreHTTPSErrors: true,
            timeout: 30000
        };
    }

    async initializeBrowser() {
        if (this.isInitialized && this.browser && this.page) {
            return;
        }

        try {
            console.log('Initializing Puppeteer browser...');
            this.browser = await puppeteer.launch(this.puppeteerConfig);
            this.page = await this.browser.newPage();

            // Set viewport
            await this.page.setViewport({
                width: 1920,
                height: 1080,
                deviceScaleFactor: 1,
                hasTouch: false,
                isLandscape: true,
                isMobile: false,
            });

            // Set additional headers
            await this.page.setExtraHTTPHeaders({
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Cache-Control': 'max-age=0',
                'DNT': '1',
                'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
                'Sec-Ch-Ua-Mobile': '?0',
                'Sec-Ch-Ua-Platform': '"Windows"',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Upgrade-Insecure-Requests': '1'
            });

            // Block unnecessary resources to speed up
            await this.page.setRequestInterception(true);
            this.page.on('request', (request) => {
                const resourceType = request.resourceType();
                const url = request.url();
                
                // Block ads, trackers, and unnecessary resources
                if (resourceType === 'image' || 
                    resourceType === 'stylesheet' || 
                    resourceType === 'font' ||
                    url.includes('google-analytics') ||
                    url.includes('googletagmanager') ||
                    url.includes('facebook') ||
                    url.includes('twitter') ||
                    url.includes('ads') ||
                    url.includes('doubleclick')) {
                    request.abort();
                } else {
                    request.continue();
                }
            });

            // Handle console logs and errors
            this.page.on('console', msg => {
                if (msg.type() === 'error') {
                    console.log('Browser console error:', msg.text());
                }
            });

            // Test connection
            await this.page.goto(this.baseUrl, { 
                waitUntil: 'domcontentloaded',
                timeout: 30000 
            });

            // Wait for potential Cloudflare challenge
            await this.waitForCloudflare();

            this.isInitialized = true;
            console.log('Puppeteer browser initialized successfully');
        } catch (error) {
            console.error('Failed to initialize Puppeteer:', error.message);
            await this.closeBrowser();
            throw new Error(`Browser initialization failed: ${error.message}`);
        }
    }

    async waitForCloudflare() {
        try {
            // Wait for Cloudflare challenge to complete
            await this.page.waitForSelector('body', { timeout: 10000 });
            
            // Check if we're on a Cloudflare challenge page
            const isCloudflare = await this.page.evaluate(() => {
                return document.title.includes('Cloudflare') || 
                       document.body.textContent.includes('Checking your browser') ||
                       document.body.textContent.includes('DDoS protection');
            });

            if (isCloudflare) {
                console.log('Cloudflare challenge detected, waiting...');
                // Wait for the challenge to complete (usually takes 5-10 seconds)
                await this.page.waitForNavigation({ 
                    waitUntil: 'domcontentloaded', 
                    timeout: 15000 
                });
                console.log('Cloudflare challenge completed');
            }
        } catch (error) {
            console.log('Cloudflare check completed or timed out:', error.message);
        }
    }

    async search(query, page = 1) {
        try {
            await this.initializeBrowser();
            console.log(`Searching Anipahe for: ${query}`);

            // Navigate to search page
            const searchUrl = `${this.baseUrl}/?s=${encodeURIComponent(query)}`;
            await this.page.goto(searchUrl, { 
                waitUntil: 'domcontentloaded',
                timeout: 30000 
            });

            // Wait for search results to load
            await this.page.waitForSelector('.anime-item, .search-result, .item', { timeout: 10000 });

            // Extract search results
            const results = await this.page.evaluate(() => {
                const items = [];
                const selectors = [
                    '.anime-item',
                    '.search-result',
                    '.item',
                    '.anime-list-item'
                ];

                for (const selector of selectors) {
                    const elements = document.querySelectorAll(selector);
                    if (elements.length > 0) {
                        elements.forEach(element => {
                            const titleElement = element.querySelector('.title a, .anime-title a, a[title]');
                            const imageElement = element.querySelector('.poster img, .anime-poster img, img');
                            
                            if (titleElement) {
                                const title = titleElement.textContent.trim();
                                const url = titleElement.href;
                                const image = imageElement ? (imageElement.dataset.src || imageElement.src) : null;
                                
                                // Extract additional info
                                const episodeElement = element.querySelector('.episode, .latest-episode');
                                const typeElement = element.querySelector('.type, .anime-type');
                                const yearElement = element.querySelector('.year, .anime-year');
                                const statusElement = element.querySelector('.status, .anime-status');

                                if (title && url) {
                                    items.push({
                                        title: title,
                                        url: url,
                                        image: image,
                                        episodes: episodeElement ? parseInt(episodeElement.textContent.match(/\d+/)?.[0]) : null,
                                        type: typeElement ? typeElement.textContent.trim() : 'TV',
                                        year: yearElement ? parseInt(yearElement.textContent.match(/\d{4}/)?.[0]) : null,
                                        status: statusElement ? statusElement.textContent.trim() : 'Unknown'
                                    });
                                }
                            }
                        });
                        break; // Found results with this selector
                    }
                }
                return items;
            });

            // Process results
            const processedResults = results.map(item => ({
                id: this.extractAnimeId(item.url),
                title: item.title,
                url: item.url,
                image: item.image,
                year: item.year,
                episodes: item.episodes,
                type: item.type,
                status: item.status
            }));

            console.log(`Found ${processedResults.length} results for "${query}"`);
            return processedResults;

        } catch (error) {
            console.error(`Anipahe search error:`, error.message);
            throw new Error(`Search failed: ${error.message}`);
        }
    }

    async getAnimeDetails(animeId) {
        try {
            await this.initializeBrowser();
            
            let detailUrl;
            if (animeId.startsWith('http')) {
                detailUrl = animeId;
                animeId = this.extractAnimeId(animeId);
            } else {
                detailUrl = `${this.baseUrl}/anime/${animeId}`;
            }

            console.log(`Getting details for: ${detailUrl}`);
            
            await this.page.goto(detailUrl, { 
                waitUntil: 'domcontentloaded',
                timeout: 30000 
            });

            // Wait for content to load
            await this.page.waitForSelector('.anime-title, .title-wrapper h1, h1', { timeout: 10000 });

            // Extract anime details
            const details = await this.page.evaluate(() => {
                // Try multiple selectors for each field
                const getTextContent = (selectors) => {
                    for (const selector of selectors) {
                        const element = document.querySelector(selector);
                        if (element) return element.textContent.trim();
                    }
                    return '';
                };

                const getImageSrc = (selectors) => {
                    for (const selector of selectors) {
                        const element = document.querySelector(selector);
                        if (element) return element.src || element.dataset.src;
                    }
                    return '';
                };

                const title = getTextContent([
                    '.title-wrapper h1',
                    '.anime-title',
                    '.anime-info h1',
                    'h1'
                ]);

                const description = getTextContent([
                    '.anime-summary',
                    '.synopsis p',
                    '.description',
                    '.anime-desc'
                ]);

                const image = getImageSrc([
                    '.anime-poster img',
                    '.poster img',
                    '.anime-cover img',
                    '.cover img'
                ]);

                // Extract genres
                const genres = [];
                const genreElements = document.querySelectorAll('.anime-genre a, .genre a, .genres a');
                genreElements.forEach(el => {
                    genres.push(el.textContent.trim());
                });

                const year = getTextContent([
                    '.anime-year',
                    '.year',
                    '.release-year'
                ]);

                const status = getTextContent([
                    '.anime-status',
                    '.status',
                    '.anime-info .status'
                ]);

                const type = getTextContent([
                    '.anime-type',
                    '.type',
                    '.anime-info .type'
                ]);

                const score = getTextContent([
                    '.anime-score',
                    '.score',
                    '.rating'
                ]);

                return {
                    title,
                    description,
                    image,
                    genres,
                    year: year ? parseInt(year.match(/\d{4}/)?.[0]) : null,
                    status,
                    type: type || 'TV',
                    rating: score
                };
            });

            return {
                id: animeId,
                ...details
            };

        } catch (error) {
            console.error(`Anipahe details error:`, error.message);
            throw new Error(`Failed to get anime details: ${error.message}`);
        }
    }

    async getPopular(page = 1) {
        try {
            await this.initializeBrowser();
            
            await this.page.goto(this.baseUrl, { 
                waitUntil: 'domcontentloaded',
                timeout: 30000 
            });

            // Wait for popular section to load
            await this.page.waitForSelector('.anime-item, .popular .item', { timeout: 10000 });

            return await this.extractAnimeList();
        } catch (error) {
            console.error(`Anipahe popular error:`, error.message);
            throw new Error(`Failed to get popular anime: ${error.message}`);
        }
    }

    async getLatest(page = 1) {
        try {
            await this.initializeBrowser();
            
            await this.page.goto(this.baseUrl, { 
                waitUntil: 'domcontentloaded',
                timeout: 30000 
            });

            // Wait for latest section to load
            await this.page.waitForSelector('.anime-item, .latest .item', { timeout: 10000 });

            return await this.extractAnimeList();
        } catch (error) {
            console.error(`Anipahe latest error:`, error.message);
            throw new Error(`Failed to get latest anime: ${error.message}`);
        }
    }

    async extractAnimeList() {
        return await this.page.evaluate(() => {
            const items = [];
            const selectors = [
                '.anime-item',
                '.item',
                '.anime-list-item'
            ];

            for (const selector of selectors) {
                const elements = document.querySelectorAll(selector);
                if (elements.length > 0) {
                    elements.forEach(element => {
                        const titleElement = element.querySelector('.title a, .anime-title a, a[title]');
                        const imageElement = element.querySelector('.poster img, .anime-poster img, img');
                        
                        if (titleElement) {
                            const title = titleElement.textContent.trim();
                            const url = titleElement.href;
                            const image = imageElement ? (imageElement.dataset.src || imageElement.src) : null;
                            
                            // Extract additional info
                            const episodeElement = element.querySelector('.episode, .latest-episode');
                            const typeElement = element.querySelector('.type, .anime-type');

                            if (title && url) {
                                items.push({
                                    title: title,
                                    url: url,
                                    image: image,
                                    episodes: episodeElement ? parseInt(episodeElement.textContent.match(/\d+/)?.[0]) : null,
                                    type: typeElement ? typeElement.textContent.trim() : 'TV',
                                    status: 'Unknown'
                                });
                            }
                        }
                    });
                    break; // Found results with this selector
                }
            }
            return items;
        }).then(results => {
            return results.map(item => ({
                id: this.extractAnimeId(item.url),
                title: item.title,
                url: item.url,
                image: item.image,
                episodes: item.episodes,
                type: item.type,
                status: item.status
            }));
        });
    }

    async getEpisodeList(animeId) {
        try {
            await this.initializeBrowser();
            
            const animeUrl = animeId.startsWith('http') ? animeId : `${this.baseUrl}/anime/${animeId}`;
            
            await this.page.goto(animeUrl, { 
                waitUntil: 'domcontentloaded',
                timeout: 30000 
            });

            // Wait for episode list to load
            await this.page.waitForSelector('.episode-list, .episodes', { timeout: 10000 });

            const episodes = await this.page.evaluate(() => {
                const episodeElements = document.querySelectorAll('.episode-item, .episode, .ep-item');
                const episodes = [];
                
                episodeElements.forEach((element, index) => {
                    const episodeLink = element.querySelector('a');
                    const episodeNumber = element.textContent.match(/\d+/)?.[0] || (index + 1).toString();
                    
                    if (episodeLink) {
                        episodes.push({
                            number: parseInt(episodeNumber),
                            title: `Episode ${episodeNumber}`,
                            url: episodeLink.href
                        });
                    }
                });
                
                return episodes.sort((a, b) => a.number - b.number);
            });

            return episodes;
        } catch (error) {
            console.error(`Anipahe episode list error:`, error.message);
            throw new Error(`Failed to get episode list: ${error.message}`);
        }
    }

    extractAnimeId(url) {
        const matches = url.match(/\/anime\/([^\/\?]+)/);
        return matches ? matches[1] : url.split('/').pop().split('?')[0];
    }

    async checkAvailability() {
        try {
            await this.initializeBrowser();
            return true;
        } catch (error) {
            return false;
        }
    }

    async closeBrowser() {
        try {
            if (this.page) {
                await this.page.close();
                this.page = null;
            }
            if (this.browser) {
                await this.browser.close();
                this.browser = null;
            }
            this.isInitialized = false;
            console.log('Browser closed successfully');
        } catch (error) {
            console.error('Error closing browser:', error.message);
        }
    }

    // Cleanup method to be called when the plugin is destroyed
    async cleanup() {
        await this.closeBrowser();
    }

    getSupportedQualities() {
        return ['1080p', '720p', '480p', '360p'];
    }

    getSupportedTypes() {
        return ['sub'];
    }

    // Helper methods for download functionality
    async downloadSeason(animeId, quality = '1080p', type = 'sub') {
        try {
            const episodes = await this.getEpisodeList(animeId);
            const episodeNumbers = episodes.map(ep => ep.number);
            
            return await this.downloadEpisodes(animeId, episodeNumbers, quality, type);
        } catch (error) {
            console.error(`Anipahe season download error:`, error.message);
            throw new Error(`Failed to download season: ${error.message}`);
        }
    }

    async downloadEpisodes(animeId, episodeNumbers, quality = '1080p', type = 'sub') {
        try {
            const downloadLinks = [];
            const episodes = await this.getEpisodeList(animeId);

            for (const episodeNum of episodeNumbers) {
                const episode = episodes.find(ep => ep.number === episodeNum);
                if (!episode) continue;

                try {
                    const downloadLink = await this.getDownloadLink(episode.url, quality);

                    if (downloadLink) {
                        downloadLinks.push({
                            episode: episodeNum,
                            title: episode.title,
                            url: downloadLink,
                            quality: quality,
                            type: type
                        });
                    }
                } catch (episodeError) {
                    console.error(`Error processing episode ${episodeNum}:`, episodeError.message);
                }
            }

            return downloadLinks;
        } catch (error) {
            console.error(`Anipahe episodes download error:`, error.message);
            throw new Error(`Failed to download episodes: ${error.message}`);
        }
    }

    async getDownloadLink(episodeUrl, quality = '1080p') {
        try {
            await this.initializeBrowser();
            
            await this.page.goto(episodeUrl, { 
                waitUntil: 'domcontentloaded',
                timeout: 30000 
            });

            // Wait for download section to load
            await this.page.waitForSelector('.download-links, .resolutions', { timeout: 10000 });

            const downloadLinks = await this.page.evaluate((requestedQuality) => {
                const links = {};
                const downloadElements = document.querySelectorAll('.download-links a, .resolutions a');
                
                downloadElements.forEach(element => {
                    const text = element.textContent.toLowerCase();
                    const href = element.href;
                    
                    if (text.includes('1080') && href) {
                        links['1080p'] = href;
                    } else if (text.includes('720') && href) {
                        links['720p'] = href;
                    } else if (text.includes('480') && href) {
                        links['480p'] = href;
                    } else if (text.includes('360') && href) {
                        links['360p'] = href;
                    }
                });
                
                return links;
            }, quality);

            // Return requested quality or best available
            if (downloadLinks[quality]) {
                return downloadLinks[quality];
            }

            const priorities = ['1080p', '720p', '480p', '360p'];
            for (const q of priorities) {
                if (downloadLinks[q]) {
                    return downloadLinks[q];
                }
            }

            throw new Error('No download links found');
        } catch (error) {
            console.error(`Anipahe download link error:`, error.message);
            throw new Error(`Failed to get download link: ${error.message}`);
        }
    }
}

module.exports = AnipahePlugin;