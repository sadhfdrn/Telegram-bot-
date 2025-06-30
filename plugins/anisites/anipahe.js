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
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://animepahe.ru/'
        };
    }

    /**
     * Search for anime on AnimePahe
     * @param {string} query - Search query
     * @returns {Array} Array of search results
     */
    async search(query) {
        try {
            const searchUrl = `${this.apiUrl}?m=search&q=${encodeURIComponent(query)}`;
            const response = await axios.get(searchUrl, { headers: this.headers });
            
            if (!response.data || !response.data.data) {
                return [];
            }

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
            const response = await axios.get(animeUrl, { headers: this.headers });
            const $ = cheerio.load(response.data);

            // Extract anime details from the page
            const title = $('.title-wrapper h1').text().trim();
            const poster = $('.anime-poster img').attr('src');
            const synopsis = $('.anime-synopsis p').text().trim();
            
            // Extract metadata
            const year = $('.anime-year').text().trim();
            const status = $('.anime-status').text().trim();
            const episodes = $('.anime-episodes').text().trim();
            const type = $('.anime-type').text().trim();
            
            // Extract genres
            const genres = [];
            $('.anime-genre a').each((i, el) => {
                genres.push($(el).text().trim());
            });

            return {
                id: animeId,
                title,
                poster,
                description: synopsis,
                year,
                status,
                episodes,
                type,
                genres,
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
            const episodesUrl = `${this.apiUrl}?m=release&id=${animeId}&sort=episode_asc&page=${page}`;
            const response = await axios.get(episodesUrl, { headers: this.headers });
            
            if (!response.data || !response.data.data) {
                return [];
            }

            return response.data.data.map(episode => ({
                id: episode.session,
                episode: episode.episode,
                title: episode.title || `Episode ${episode.episode}`,
                snapshot: episode.snapshot,
                duration: episode.duration,
                created_at: episode.created_at,
                anime_id: animeId
            }));
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

            while (hasMorePages) {
                const episodes = await this.getEpisodes(animeId, page);
                if (episodes.length === 0) {
                    hasMorePages = false;
                } else {
                    allEpisodes = [...allEpisodes, ...episodes];
                    page++;
                }
            }

            return allEpisodes.sort((a, b) => a.episode - b.episode);
        } catch (error) {
            console.error('AnimePahe all episodes error:', error.message);
            throw new Error(`Failed to get all episodes: ${error.message}`);
        }
    }

    /**
     * Get available qualities for an episode
     * @param {string} animeId - Anime session ID
     * @param {string} episodeId - Episode session ID
     * @returns {Array} Array of available qualities
     */
    async getEpisodeQualities(animeId, episodeId) {
        try {
            const playUrl = `${this.baseUrl}/play/${animeId}/${episodeId}`;
            const response = await axios.get(playUrl, { headers: this.headers });
            const $ = cheerio.load(response.data);

            const qualities = [];
            
            // Extract qualities from the page
            $('.dropup .dropdown-menu a').each((i, el) => {
                const $el = $(el);
                const text = $el.text().trim();
                const href = $el.attr('href');
                
                if (text && href) {
                    const qualityMatch = text.match(/(\d+p)/);
                    const audioMatch = text.match(/(eng|jpn)/i);
                    
                    if (qualityMatch) {
                        qualities.push({
                            quality: qualityMatch[1],
                            audio: audioMatch ? audioMatch[1].toLowerCase() : 'jpn',
                            url: href.startsWith('http') ? href : `${this.baseUrl}${href}`,
                            text: text
                        });
                    }
                }
            });

            return qualities;
        } catch (error) {
            console.error('AnimePahe qualities error:', error.message);
            throw new Error(`Failed to get episode qualities: ${error.message}`);
        }
    }

    /**
     * Extract direct download link using Puppeteer
     * @param {string} qualityUrl - Quality-specific URL
     * @returns {string} Direct download URL
     */
    async extractDownloadLink(qualityUrl) {
        let browser;
        try {
            // Launch Puppeteer with appropriate configuration
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
                    '--disable-gpu'
                ]
            });

            const page = await browser.newPage();
            
            // Set user agent and viewport
            await page.setUserAgent(this.headers['User-Agent']);
            await page.setViewport({ width: 1366, height: 768 });

            // Navigate to the quality URL
            await page.goto(qualityUrl, { waitUntil: 'networkidle2', timeout: 30000 });

            // Wait for and click continue button on pahe.win
            try {
                await page.waitForSelector('a[href*="kwik"]', { timeout: 10000 });
                const kwikLink = await page.$eval('a[href*="kwik"]', el => el.href);
                
                // Navigate to kwik.si page
                await page.goto(kwikLink, { waitUntil: 'networkidle2', timeout: 30000 });
                
                // Wait for download button and extract direct link
                await page.waitForSelector('.download-btn, #download, a[download]', { timeout: 10000 });
                
                // Try different selectors for download link
                let downloadLink = null;
                
                // Method 1: Look for download button
                try {
                    downloadLink = await page.$eval('.download-btn', el => el.href);
                } catch (e) {
                    // Method 2: Look for download attribute
                    try {
                        downloadLink = await page.$eval('a[download]', el => el.href);
                    } catch (e2) {
                        // Method 3: Look for any link containing vault or download
                        try {
                            downloadLink = await page.$eval('a[href*="vault"], a[href*="download"]', el => el.href);
                        } catch (e3) {
                            throw new Error('Could not find download link');
                        }
                    }
                }

                if (!downloadLink) {
                    throw new Error('No download link found');
                }

                return downloadLink;
            } catch (error) {
                throw new Error(`Failed to extract download link: ${error.message}`);
            }
        } catch (error) {
            console.error('AnimePahe download extraction error:', error.message);
            throw new Error(`Download link extraction failed: ${error.message}`);
        } finally {
            if (browser) {
                await browser.close();
            }
        }
    }

    /**
     * Download specific episodes
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
                    const qualities = await this.getEpisodeQualities(animeId, episode.id);
                    
                    // Find matching quality and audio type
                    const audioKey = audioType === 'dub' ? 'eng' : 'jpn';
                    let selectedQuality = qualities.find(q => 
                        q.quality === quality && q.audio === audioKey
                    );

                    // Fallback to any quality if exact match not found
                    if (!selectedQuality) {
                        selectedQuality = qualities.find(q => q.quality === quality) || qualities[0];
                    }

                    if (!selectedQuality) {
                        console.warn(`No suitable quality found for episode ${episodeNum}`);
                        continue;
                    }

                    // Extract direct download link
                    const downloadUrl = await this.extractDownloadLink(selectedQuality.url);
                    
                    downloadInfo.push({
                        episode: episodeNum,
                        title: episode.title,
                        quality: selectedQuality.quality,
                        audio: selectedQuality.audio,
                        url: downloadUrl,
                        size: 'Unknown' // AnimePahe doesn't provide file size info
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
            const response = await axios.get(`${this.baseUrl}`, { headers: this.headers });
            const $ = cheerio.load(response.data);
            
            const popular = [];
            $('.latest-update .col-6').each((i, el) => {
                const $el = $(el);
                const title = $el.find('.title a').text().trim();
                const url = $el.find('.title a').attr('href');
                const poster = $el.find('img').attr('src');
                const episode = $el.find('.episode').text().trim();
                
                if (title && url) {
                    const sessionMatch = url.match(/\/anime\/([a-f0-9-]+)/);
                    if (sessionMatch) {
                        popular.push({
                            id: sessionMatch[1],
                            title,
                            url: `${this.baseUrl}${url}`,
                            poster,
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