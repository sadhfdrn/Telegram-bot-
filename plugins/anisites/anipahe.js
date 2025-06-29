const axios = require('axios');
const cheerio = require('cheerio');
const { URL } = require('url');

class AnipahePlugin {
    constructor() {
        this.name = 'anipahe';
        this.displayName = 'Anipahe';
        this.icon = '🌸';
        this.baseUrl = 'https://animepahe.ru';
        this.apiUrl = 'https://animepahe.ru/api';
        this.description = 'High-quality anime downloads with minimal ads';
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-origin',
            'X-Requested-With': 'XMLHttpRequest'
        };
    }

    async search(query, page = 1) {
        try {
            // Anipahe uses an API endpoint for search
            const searchUrl = `${this.apiUrl}?m=search&q=${encodeURIComponent(query)}`;
            
            const response = await axios.get(searchUrl, {
                headers: this.headers,
                timeout: 10000
            });

            const data = response.data;
            const results = [];

            if (data && data.data && Array.isArray(data.data)) {
                data.data.forEach(anime => {
                    results.push({
                        id: anime.session,
                        title: anime.title,
                        url: `${this.baseUrl}/anime/${anime.session}`,
                        image: anime.poster,
                        year: anime.year,
                        episodes: anime.episodes,
                        type: anime.type || 'TV',
                        status: anime.status || 'Unknown',
                        score: anime.score
                    });
                });
            }

            return results;
        } catch (error) {
            console.error(`Anipahe search error:`, error.message);
            throw new Error(`Search failed: ${error.message}`);
        }
    }

    async getAnimeDetails(animeId) {
        try {
            let detailUrl;
            if (animeId.startsWith('http')) {
                detailUrl = animeId;
                animeId = this.extractAnimeId(animeId);
            } else {
                detailUrl = `${this.baseUrl}/anime/${animeId}`;
            }

            // Get anime info from API
            const apiUrl = `${this.apiUrl}?m=release&id=${animeId}&sort=episode_asc&page=1`;
            
            const [pageResponse, apiResponse] = await Promise.all([
                axios.get(detailUrl, { headers: this.headers, timeout: 10000 }),
                axios.get(apiUrl, { headers: this.headers, timeout: 10000 })
            ]);

            const $ = cheerio.load(pageResponse.data);
            const apiData = apiResponse.data;

            // Extract details from page
            const title = $('.title-wrapper h1').text().trim() || 
                         $('.anime-title').text().trim();
            
            const description = $('.anime-summary').text().trim() || 
                              $('.synopsis p').text().trim();
            
            const image = $('.anime-poster img').attr('src') || 
                         $('.poster img').attr('data-src');

            // Extract additional metadata
            const genres = [];
            $('.anime-genre a, .genre a').each((i, el) => {
                genres.push($(el).text().trim());
            });

            const year = $('.anime-year').text().trim() || 
                        $('.year').text().trim();

            const status = $('.anime-status').text().trim() || 
                          $('.status').text().trim();

            const type = $('.anime-type').text().trim() || 
                        $('.type').text().trim();

            const score = $('.anime-score').text().trim() || 
                         $('.score').text().trim();

            // Get episode count from API data
            let episodeCount = 0;
            if (apiData && apiData.total) {
                episodeCount = apiData.total;
            }

            return {
                id: animeId,
                title: title,
                description: description,
                image: image,
                genres: genres,
                year: year,
                status: status,
                type: type,
                episodes: episodeCount,
                rating: score
            };
        } catch (error) {
            console.error(`Anipahe details error:`, error.message);
            throw new Error(`Failed to get anime details: ${error.message}`);
        }
    }

    async getPopular(page = 1) {
        try {
            const popularUrl = `${this.baseUrl}`;
            
            const response = await axios.get(popularUrl, {
                headers: this.headers,
                timeout: 10000
            });

            const $ = cheerio.load(response.data);
            const results = [];

            $('.latest-update .anime-item, .popular .anime-item').each((index, element) => {
                const $el = $(element);
                const titleElement = $el.find('.title a');
                const imageElement = $el.find('.poster img');
                
                const title = titleElement.text().trim();
                const url = titleElement.attr('href');
                const image = imageElement.attr('data-src') || imageElement.attr('src');
                
                // Extract metadata
                const episode = $el.find('.episode').text().trim();
                const type = $el.find('.type').text().trim();

                if (title && url) {
                    results.push({
                        id: this.extractAnimeId(url),
                        title: title,
                        url: url.startsWith('http') ? url : this.baseUrl + url,
                        image: image,
                        episodes: episode ? parseInt(episode.match(/\d+/)?.[0]) : null,
                        type: type || 'TV',
                        status: 'Unknown'
                    });
                }
            });

            return results;
        } catch (error) {
            console.error(`Anipahe popular error:`, error.message);
            throw new Error(`Failed to get popular anime: ${error.message}`);
        }
    }

    async getLatest(page = 1) {
        try {
            const latestUrl = `${this.baseUrl}`;
            
            const response = await axios.get(latestUrl, {
                headers: this.headers,
                timeout: 10000
            });

            const $ = cheerio.load(response.data);
            const results = [];

            $('.latest-update .anime-item').each((index, element) => {
                const $el = $(element);
                const titleElement = $el.find('.title a');
                const imageElement = $el.find('.poster img');
                
                const title = titleElement.text().trim();
                const url = titleElement.attr('href');
                const image = imageElement.attr('data-src') || imageElement.attr('src');
                
                // Extract metadata
                const episode = $el.find('.episode').text().trim();
                const type = $el.find('.type').text().trim();

                if (title && url) {
                    results.push({
                        id: this.extractAnimeId(url),
                        title: title,
                        url: url.startsWith('http') ? url : this.baseUrl + url,
                        image: image,
                        episodes: episode ? parseInt(episode.match(/\d+/)?.[0]) : null,
                        type: type || 'TV',
                        status: 'Ongoing'
                    });
                }
            });

            return results;
        } catch (error) {
            console.error(`Anipahe latest error:`, error.message);
            throw new Error(`Failed to get latest anime: ${error.message}`);
        }
    }

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
                    const downloadLink = await this.getDownloadLink(episode.session, quality);

                    if (downloadLink) {
                        downloadLinks.push({
                            episode: episodeNum,
                            title: episode.title,
                            url: downloadLink,
                            quality: quality,
                            type: type,
                            size: episode.filesize || 'Unknown'
                        });
                    }
                } catch (episodeError) {
                    console.error(`Error processing episode ${episodeNum}:`, episodeError.message);
                    // Continue with other episodes
                }
            }

            return downloadLinks;
        } catch (error) {
            console.error(`Anipahe episodes download error:`, error.message);
            throw new Error(`Failed to download episodes: ${error.message}`);
        }
    }

    async getEpisodeList(animeId) {
        try {
            const episodes = [];
            let page = 1;
            let hasMore = true;

            while (hasMore) {
                const apiUrl = `${this.apiUrl}?m=release&id=${animeId}&sort=episode_asc&page=${page}`;
                
                const response = await axios.get(apiUrl, {
                    headers: this.headers,
                    timeout: 10000
                });

                const data = response.data;

                if (data && data.data && Array.isArray(data.data)) {
                    data.data.forEach(episode => {
                        episodes.push({
                            session: episode.session,
                            number: episode.episode,
                            title: `Episode ${episode.episode}`,
                            snapshot: episode.snapshot,
                            filesize: episode.filesize,
                            duration: episode.duration
                        });
                    });

                    // Check if there are more pages
                    hasMore = data.current_page < data.last_page;
                    page++;
                } else {
                    hasMore = false;
                }
            }

            return episodes.sort((a, b) => a.number - b.number);
        } catch (error) {
            console.error(`Anipahe episode list error:`, error.message);
            throw new Error(`Failed to get episode list: ${error.message}`);
        }
    }

    async getDownloadLink(episodeSession, quality = '1080p') {
        try {
            // Get episode page
            const episodeUrl = `${this.baseUrl}/play/${episodeSession}`;
            
            const response = await axios.get(episodeUrl, {
                headers: this.headers,
                timeout: 10000
            });

            const $ = cheerio.load(response.data);
            
            // Extract download links from the page
            const downloadLinks = {};
            
            $('.download-links a, .resolutions a').each((i, el) => {
                const $link = $(el);
                const qualityText = $link.text().toLowerCase();
                const href = $link.attr('href');
                
                if (href && qualityText.includes('1080')) {
                    downloadLinks['1080p'] = href;
                } else if (href && qualityText.includes('720')) {
                    downloadLinks['720p'] = href;
                } else if (href && qualityText.includes('480')) {
                    downloadLinks['480p'] = href;
                } else if (href && qualityText.includes('360')) {
                    downloadLinks['360p'] = href;
                }
            });

            // Return requested quality or best available
            if (downloadLinks[quality]) {
                return await this.resolveDownloadLink(downloadLinks[quality]);
            }

            // Fallback to best available quality
            const priorities = ['1080p', '720p', '480p', '360p'];
            for (const q of priorities) {
                if (downloadLinks[q]) {
                    return await this.resolveDownloadLink(downloadLinks[q]);
                }
            }

            throw new Error('No download links found');
        } catch (error) {
            console.error(`Anipahe download link error:`, error.message);
            throw new Error(`Failed to get download link: ${error.message}`);
        }
    }

    async resolveDownloadLink(intermediateUrl) {
        try {
            // Some download links might redirect through intermediate pages
            if (intermediateUrl.includes('kwik') || intermediateUrl.includes('redirect')) {
                const response = await axios.get(intermediateUrl, {
                    headers: this.headers,
                    timeout: 10000,
                    maxRedirects: 0,
                    validateStatus: (status) => status === 302 || status === 301 || status === 200
                });

                if (response.status === 302 || response.status === 301) {
                    return response.headers.location;
                }

                // Parse page for direct link if needed
                const $ = cheerio.load(response.data);
                const directLink = $('a[href*=".mp4"], a[href*=".mkv"]').attr('href');
                
                if (directLink) {
                    return directLink;
                }
            }

            return intermediateUrl;
        } catch (error) {
            console.error(`Link resolution error:`, error.message);
            return intermediateUrl; // Return original if resolution fails
        }
    }

    extractAnimeId(url) {
        // Extract anime ID from URL
        const matches = url.match(/\/anime\/([^\/\?]+)/);
        return matches ? matches[1] : url.split('/').pop().split('?')[0];
    }

    // Utility methods
    async checkAvailability() {
        try {
            const response = await axios.get(this.baseUrl, {
                headers: this.headers,
                timeout: 5000
            });
            return response.status === 200;
        } catch (error) {
            return false;
        }
    }

    getSupportedQualities() {
        return ['1080p', '720p', '480p', '360p'];
    }

    getSupportedTypes() {
        return ['sub']; // Anipahe primarily focuses on subbed content
    }

    // Helper method to format file sizes
    formatFileSize(bytes) {
        if (!bytes || bytes === 0) return 'Unknown';
        
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    // Helper method to parse duration
    parseDuration(duration) {
        if (!duration) return 'Unknown';
        
        // Convert seconds to MM:SS format
        if (typeof duration === 'number') {
            const minutes = Math.floor(duration / 60);
            const seconds = duration % 60;
            return `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
        
        return duration;
    }

    // Get anime by genre
    async getByGenre(genre, page = 1) {
        try {
            const genreUrl = `${this.baseUrl}/genre/${genre}?page=${page}`;
            
            const response = await axios.get(genreUrl, {
                headers: this.headers,
                timeout: 10000
            });

            return await this.parseAnimeList(response.data);
        } catch (error) {
            console.error(`Anipahe genre error:`, error.message);
            throw new Error(`Failed to get anime by genre: ${error.message}`);
        }
    }

    // Parse anime list from HTML
    async parseAnimeList(html) {
        const $ = cheerio.load(html);
        const results = [];

        $('.anime-item, .item').each((index, element) => {
            const $el = $(element);
            const titleElement = $el.find('.title a, .anime-title a');
            const imageElement = $el.find('.poster img, .anime-poster img');
            
            const title = titleElement.text().trim();
            const url = titleElement.attr('href');
            const image = imageElement.attr('data-src') || imageElement.attr('src');
            
            // Extract metadata
            const episode = $el.find('.episode, .latest-episode').text().trim();
            const type = $el.find('.type, .anime-type').text().trim();
            const year = $el.find('.year, .anime-year').text().trim();
            const status = $el.find('.status, .anime-status').text().trim();

            if (title && url) {
                results.push({
                    id: this.extractAnimeId(url),
                    title: title,
                    url: url.startsWith('http') ? url : this.baseUrl + url,
                    image: image,
                    episodes: episode ? parseInt(episode.match(/\d+/)?.[0]) : null,
                    type: type || 'TV',
                    year: year ? parseInt(year.match(/\d{4}/)?.[0]) : null,
                    status: status || 'Unknown'
                });
            }
        });

        return results;
    }

    // Get available genres
    async getGenres() {
        try {
            const response = await axios.get(this.baseUrl, {
                headers: this.headers,
                timeout: 10000
            });

            const $ = cheerio.load(response.data);
            const genres = [];

            $('.genre-list a, .genres a').each((i, el) => {
                const $el = $(el);
                const name = $el.text().trim();
                const slug = $el.attr('href')?.split('/').pop();
                
                if (name && slug) {
                    genres.push({
                        name: name,
                        slug: slug
                    });
                }
            });

            return genres;
        } catch (error) {
            console.error(`Anipahe genres error:`, error.message);
            return [];
        }
    }

    // Advanced search with filters
    async advancedSearch(options = {}) {
        try {
            const {
                query = '',
                genre = '',
                year = '',
                status = '',
                type = '',
                page = 1
            } = options;

            let searchUrl = `${this.apiUrl}?m=search`;
            
            if (query) searchUrl += `&q=${encodeURIComponent(query)}`;
            if (genre) searchUrl += `&genre=${genre}`;
            if (year) searchUrl += `&year=${year}`;
            if (status) searchUrl += `&status=${status}`;
            if (type) searchUrl += `&type=${type}`;
            if (page > 1) searchUrl += `&page=${page}`;

            const response = await axios.get(searchUrl, {
                headers: this.headers,
                timeout: 10000
            });

            const data = response.data;
            const results = [];

            if (data && data.data && Array.isArray(data.data)) {
                data.data.forEach(anime => {
                    results.push({
                        id: anime.session,
                        title: anime.title,
                        url: `${this.baseUrl}/anime/${anime.session}`,
                        image: anime.poster,
                        year: anime.year,
                        episodes: anime.episodes,
                        type: anime.type || 'TV',
                        status: anime.status || 'Unknown',
                        score: anime.score,
                        genres: anime.genres || []
                    });
                });
            }

            return {
                results: results,
                pagination: {
                    current_page: data.current_page || 1,
                    last_page: data.last_page || 1,
                    total: data.total || results.length
                }
            };
        } catch (error) {
            console.error(`Anipahe advanced search error:`, error.message);
            throw new Error(`Advanced search failed: ${error.message}`);
        }
    }

    // Get random anime
    async getRandomAnime() {
        try {
            const randomUrl = `${this.baseUrl}/random`;
            
            const response = await axios.get(randomUrl, {
                headers: this.headers,
                timeout: 10000,
                maxRedirects: 5
            });

            // Extract anime info from the redirected page
            const $ = cheerio.load(response.data);
            const animeUrl = response.request.res.responseUrl || response.config.url;
            const animeId = this.extractAnimeId(animeUrl);
            
            if (animeId) {
                return await this.getAnimeDetails(animeId);
            }

            throw new Error('Failed to get random anime');
        } catch (error) {
            console.error(`Anipahe random anime error:`, error.message);
            throw new Error(`Failed to get random anime: ${error.message}`);
        }
    }
}

module.exports = AnipahePlugin;