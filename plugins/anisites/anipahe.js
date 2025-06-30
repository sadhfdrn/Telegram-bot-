const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');

class AnimePahePlugin {
    constructor() {
        this.name = 'animepahe';
        this.displayName = 'AnimePahe';
        this.icon = '🎌';
        this.description = 'Download anime from AnimePahe';
        this.baseUrl = 'https://animepahe.ru';
        this.apiUrl = 'https://animepahe.ru/api';
        
        // Enhanced headers to avoid detection
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'en-US,en;q=0.9',
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

        // Rate limiting
        this.lastRequestTime = 0;
        this.minRequestInterval = 2000; // 2 seconds between requests
        
        // Session management
        this.cookies = '';
        this.sessionInitialized = false;
    }

    /**
     * Initialize session by visiting the main page first
     */
    async initSession() {
        if (this.sessionInitialized) return;
        
        try {
            const response = await axios.get(this.baseUrl, { 
                headers: this.headers,
                timeout: 15000,
                maxRedirects: 5
            });
            
            // Extract cookies from response
            if (response.headers['set-cookie']) {
                this.cookies = response.headers['set-cookie']
                    .map(cookie => cookie.split(';')[0])
                    .join('; ');
                this.headers['Cookie'] = this.cookies;
            }
            
            this.sessionInitialized = true;
            console.log('AnimePahe session initialized');
        } catch (error) {
            console.warn('Failed to initialize session:', error.message);
            // Continue anyway, might still work
        }
    }

    /**
     * Rate limited request wrapper
     */
    async makeRequest(url, options = {}) {
        // Ensure minimum time between requests
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        if (timeSinceLastRequest < this.minRequestInterval) {
            await new Promise(resolve => 
                setTimeout(resolve, this.minRequestInterval - timeSinceLastRequest)
            );
        }
        
        await this.initSession();
        
        const defaultOptions = {
            headers: { ...this.headers },
            timeout: 15000,
            maxRedirects: 5,
            validateStatus: (status) => status < 500 // Accept 4xx errors to handle them manually
        };
        
        const mergedOptions = { ...defaultOptions, ...options };
        
        try {
            this.lastRequestTime = Date.now();
            const response = await axios.get(url, mergedOptions);
            
            // Handle 403/429 errors with retry
            if (response.status === 403 || response.status === 429) {
                console.log(`Received ${response.status}, waiting before retry...`);
                await new Promise(resolve => setTimeout(resolve, 5000));
                
                // Try with Puppeteer as fallback
                return await this.makeRequestWithPuppeteer(url);
            }
            
            return response;
        } catch (error) {
            if (error.response?.status === 403 || error.response?.status === 429) {
                console.log('Fallback to Puppeteer due to blocking');
                return await this.makeRequestWithPuppeteer(url);
            }
            throw error;
        }
    }

    /**
     * Fallback request using Puppeteer
     */
    async makeRequestWithPuppeteer(url) {
        let browser;
        try {
            browser = await puppeteer.launch({
                headless: true,
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
                    '--disable-blink-features=AutomationControlled'
                ]
            });

            const page = await browser.newPage();
            
            // Enhanced stealth mode
            await page.setUserAgent(this.headers['User-Agent']);
            await page.setViewport({ width: 1366, height: 768 });
            
            // Remove webdriver property
            await page.evaluateOnNewDocument(() => {
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => undefined,
                });
            });

            await page.goto(url, { 
                waitUntil: 'networkidle2', 
                timeout: 30000 
            });

            const content = await page.content();
            return { data: content, status: 200 };
        } finally {
            if (browser) {
                await browser.close();
            }
        }
    }

    /**
     * Search for anime on AnimePahe
     * @param {string} query - Search query
     * @returns {Array} Array of search results
     */
    async search(query) {
        try {
            // Try API search first
            try {
                const searchUrl = `${this.apiUrl}?m=search&q=${encodeURIComponent(query)}`;
                const response = await this.makeRequest(searchUrl);
                
                if (response.data && typeof response.data === 'object' && response.data.data) {
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
            $('.col-6').each((i, el) => {
                const $el = $(el);
                const titleEl = $el.find('a[title]');
                const title = titleEl.attr('title') || titleEl.text().trim();
                const url = titleEl.attr('href');
                const poster = $el.find('img').attr('src');
                
                if (title && url) {
                    const sessionMatch = url.match(/\/anime\/([a-f0-9-]+)/);
                    if (sessionMatch) {
                        results.push({
                            id: sessionMatch[1],
                            title,
                            url: url.startsWith('http') ? url : `${this.baseUrl}${url}`,
                            poster: poster && poster.startsWith('http') ? poster : `${this.baseUrl}${poster}`,
                            type: 'TV', // Default type
                            episodes: 'Unknown',
                            status: 'Unknown',
                            year: 'Unknown'
                        });
                    }
                }
            });

            return results;
        } catch (error) {
            console.error('AnimePahe search error:', error.message);
            throw new Error(`Search failed: ${error.message}`);
        }
    }

    /**
     * Get detailed information about an anime
     * @param {string} animeId - Anime session ID
     * @returns {Object} Detailed anime information
     */
    async getAnimeDetails(animeId) {
        try {
            const animeUrl = `${this.baseUrl}/anime/${animeId}`;
            const response = await this.makeRequest(animeUrl);
            const $ = cheerio.load(response.data);

            // Extract anime details from the page
            const title = $('.title-wrapper h1, .anime-title, h1').first().text().trim();
            const poster = $('.anime-poster img, .cover img').first().attr('src');
            const synopsis = $('.anime-synopsis p, .description p, .synopsis').first().text().trim();
            
            // Extract metadata with multiple selectors
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

            return {
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
        } catch (error) {
            console.error('AnimePahe details error:', error.message);
            throw new Error(`Failed to get anime details: ${error.message}`);
        }
    }

    /**
     * Get episodes list for an anime
     * @param {string} animeId - Anime session ID
     * @param {number} page - Page number (default: 1)
     * @returns {Array} Array of episodes
     */
    async getEpisodes(animeId, page = 1) {
        try {
            // Try API first
            try {
                const episodesUrl = `${this.apiUrl}?m=release&id=${animeId}&sort=episode_asc&page=${page}`;
                const response = await this.makeRequest(episodesUrl);
                
                if (response.data && typeof response.data === 'object' && response.data.data) {
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
                console.log('API episodes failed, trying HTML scraping');
            }

            // Fallback to HTML scraping
            const animeUrl = `${this.baseUrl}/anime/${animeId}`;
            const response = await this.makeRequest(animeUrl);
            const $ = cheerio.load(response.data);

            const episodes = [];
            $('.episode-list .episode, .episodes .episode').each((i, el) => {
                const $el = $(el);
                const episodeNum = $el.find('.episode-number').text().trim() || (i + 1);
                const title = $el.find('.episode-title').text().trim() || `Episode ${episodeNum}`;
                const url = $el.find('a').attr('href');
                
                if (url) {
                    const sessionMatch = url.match(/\/play\/[^\/]+\/([a-f0-9-]+)/);
                    episodes.push({
                        id: sessionMatch ? sessionMatch[1] : `ep${episodeNum}`,
                        episode: parseInt(episodeNum) || (i + 1),
                        title,
                        anime_id: animeId
                    });
                }
            });

            return episodes;
        } catch (error) {
            console.error('AnimePahe episodes error:', error.message);
            throw new Error(`Failed to get episodes: ${error.message}`);
        }
    }

    /**
     * Get all episodes for an anime (handles pagination)
     * @param {string} animeId - Anime session ID
     * @returns {Array} Array of all episodes
     */
    async getAllEpisodes(animeId) {
        try {
            let allEpisodes = [];
            let page = 1;
            let hasMorePages = true;
            const maxPages = 50; // Safety limit

            while (hasMorePages && page <= maxPages) {
                const episodes = await this.getEpisodes(animeId, page);
                if (episodes.length === 0) {
                    hasMorePages = false;
                } else {
                    allEpisodes = [...allEpisodes, ...episodes];
                    page++;
                    
                    // Add delay between page requests
                    if (hasMorePages) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
            }

            return allEpisodes.sort((a, b) => a.episode - b.episode);
        } catch (error) {
            console.error('AnimePahe all episodes error:', error.message);
            throw new Error(`Failed to get all episodes: ${error.message}`);
        }
    }

    /**
     * Download specific episodes with enhanced error handling
     * @param {string} animeId - Anime session ID
     * @param {Array} episodeNumbers - Array of episode numbers to download
     * @param {string} quality - Preferred quality (e.g., '720p')
     * @param {string} audioType - Audio type ('sub' or 'dub')
     * @returns {Array} Array of download information
     */
    async downloadEpisodes(animeId, episodeNumbers, quality = '720p', audioType = 'sub') {
        try {
            const allEpisodes = await this.getAllEpisodes(animeId);
            const downloadInfo = [];

            for (const episodeNum of episodeNumbers) {
                const episode = allEpisodes.find(ep => ep.episode == episodeNum);
                if (!episode) {
                    console.warn(`Episode ${episodeNum} not found`);
                    continue;
                }

                try {
                    // For now, return placeholder download info since extracting actual download links
                    // requires more complex handling of the streaming site's protection mechanisms
                    downloadInfo.push({
                        episode: episodeNum,
                        title: episode.title,
                        quality: quality,
                        audio: audioType === 'dub' ? 'eng' : 'jpn',
                        url: `${this.baseUrl}/play/${animeId}/${episode.id}`,
                        size: 'Unknown',
                        note: 'Visit the URL to access the episode. Direct download extraction requires additional setup.'
                    });
                } catch (error) {
                    console.error(`Failed to process episode ${episodeNum}:`, error.message);
                }
            }

            return downloadInfo;
        } catch (error) {
            console.error('AnimePahe download episodes error:', error.message);
            throw new Error(`Failed to download episodes: ${error.message}`);
        }
    }

    /**
     * Download entire season
     * @param {string} animeId - Anime session ID
     * @param {string} quality - Preferred quality
     * @param {string} audioType - Audio type ('sub' or 'dub')
     * @returns {Array} Array of download information
     */
    async downloadSeason(animeId, quality = '720p', audioType = 'sub') {
        try {
            const allEpisodes = await this.getAllEpisodes(animeId);
            const episodeNumbers = allEpisodes.map(ep => ep.episode);
            
            return await this.downloadEpisodes(animeId, episodeNumbers, quality, audioType);
        } catch (error) {
            console.error('AnimePahe download season error:', error.message);
            throw new Error(`Failed to download season: ${error.message}`);
        }
    }

    /**
     * Get popular/latest anime
     * @returns {Array} Array of popular anime
     */
    async getPopular() {
        try {
            const response = await this.makeRequest(this.baseUrl);
            const $ = cheerio.load(response.data);
            
            const popular = [];
            $('.latest-update .col-6, .popular .col-6').each((i, el) => {
                const $el = $(el);
                const titleEl = $el.find('.title a, a[title]');
                const title = titleEl.attr('title') || titleEl.text().trim();
                const url = titleEl.attr('href');
                const poster = $el.find('img').attr('src');
                const episode = $el.find('.episode').text().trim();
                
                if (title && url) {
                    const sessionMatch = url.match(/\/anime\/([a-f0-9-]+)/);
                    if (sessionMatch) {
                        popular.push({
                            id: sessionMatch[1],
                            title,
                            url: url.startsWith('http') ? url : `${this.baseUrl}${url}`,
                            poster: poster && poster.startsWith('http') ? poster : `${this.baseUrl}${poster}`,
                            latestEpisode: episode
                        });
                    }
                }
            });
            
            return popular;
        } catch (error) {
            console.error('AnimePahe popular error:', error.message);
            throw new Error(`Failed to get popular anime: ${error.message}`);
        }
    }
}

module.exports = AnimePahePlugin;