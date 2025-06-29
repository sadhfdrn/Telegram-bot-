const axios = require('axios');
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
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        };
    }

    async search(query, page = 1) {
        try {
            const searchUrl = `${this.baseUrl}/search?keyword=${encodeURIComponent(query)}&page=${page}`;
            
            const response = await axios.get(searchUrl, {
                headers: this.headers,
                timeout: 10000
            });

            const $ = cheerio.load(response.data);
            const results = [];

            $('.film_list-wrap .flw-item').each((index, element) => {
                const $el = $(element);
                const titleElement = $el.find('.film-name a');
                const imageElement = $el.find('.film-poster img');
                const metaElement = $el.find('.film-detail .fd-infor');
                
                const title = titleElement.attr('title') || titleElement.text().trim();
                const url = titleElement.attr('href');
                const image = imageElement.attr('data-src') || imageElement.attr('src');
                
                // Extract metadata
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
        } catch (error) {
            console.error(`9anime search error:`, error.message);
            throw new Error(`Search failed: ${error.message}`);
        }
    }

    async getAnimeDetails(animeId) {
        try {
            let detailUrl;
            if (animeId.startsWith('http')) {
                detailUrl = animeId;
            } else {
                // Construct URL from ID if needed
                detailUrl = `${this.baseUrl}/watch/${animeId}`;
            }

            const response = await axios.get(detailUrl, {
                headers: this.headers,
                timeout: 10000
            });

            const $ = cheerio.load(response.data);
            
            const title = $('.anisc-detail h2.film-name').text().trim() || 
                         $('.anis-content h2.film-name').text().trim();
            
            const description = $('.film-description .text').text().trim() ||
                              $('.anisc-info .item:contains("Overview") .text').text().trim();
            
            const image = $('.film-poster img').attr('src') || 
                         $('.anisc-poster img').attr('src');

            // Extract additional metadata
            const genres = [];
            $('.item:contains("Genres") .name, .anisc-info .item:contains("Genre") a').each((i, el) => {
                genres.push($(el).text().trim());
            });

            const year = $('.item:contains("Aired") .name').text().match(/(\d{4})/)?.[1] ||
                        $('.anisc-info .item:contains("Aired") .name').text().match(/(\d{4})/)?.[1];

            const status = $('.item:contains("Status") .name').text().trim() ||
                          $('.anisc-info .item:contains("Status") .name').text().trim();

            const episodes = $('.item:contains("Episodes") .name').text().match(/(\d+)/)?.[1] ||
                           $('.anisc-info .item:contains("Episodes") .name').text().match(/(\d+)/)?.[1];

            const rating = $('.item:contains("MAL Score") .name').text().match(/([\d.]+)/)?.[1] ||
                          $('.anisc-info .item:contains("Score") .name').text().match(/([\d.]+)/)?.[1];

            return {
                id: animeId,
                title: title,
                description: description,
                image: image ? (image.startsWith('http') ? image : this.baseUrl + image) : null,
                genres: genres,
                year: year,
                status: status,
                episodes: episodes ? parseInt(episodes) : null,
                rating: rating
            };
        } catch (error) {
            console.error(`9anime details error:`, error.message);
            throw new Error(`Failed to get anime details: ${error.message}`);
        }
    }

    async getPopular(page = 1) {
        try {
            const popularUrl = `${this.baseUrl}/most-popular?page=${page}`;
            
            const response = await axios.get(popularUrl, {
                headers: this.headers,
                timeout: 10000
            });

            return await this.parseAnimeList(response.data);
        } catch (error) {
            console.error(`9anime popular error:`, error.message);
            throw new Error(`Failed to get popular anime: ${error.message}`);
        }
    }

    async getLatest(page = 1) {
        try {
            const latestUrl = `${this.baseUrl}/recently-updated?page=${page}`;
            
            const response = await axios.get(latestUrl, {
                headers: this.headers,
                timeout: 10000
            });

            return await this.parseAnimeList(response.data);
        } catch (error) {
            console.error(`9anime latest error:`, error.message);
            throw new Error(`Failed to get latest anime: ${error.message}`);
        }
    }

    async downloadSeason(animeId, quality = '1080p', type = 'sub') {
        try {
            const episodes = await this.getEpisodeList(animeId);
            const episodeNumbers = episodes.map((_, index) => index + 1);
            
            return await this.downloadEpisodes(animeId, episodeNumbers, quality, type);
        } catch (error) {
            console.error(`9anime season download error:`, error.message);
            throw new Error(`Failed to download season: ${error.message}`);
        }
    }

    async downloadEpisodes(animeId, episodeNumbers, quality = '1080p', type = 'sub') {
        try {
            const downloadLinks = [];
            const episodes = await this.getEpisodeList(animeId);

            for (const episodeNum of episodeNumbers) {
                const episode = episodes[episodeNum - 1];
                if (!episode) continue;

                try {
                    const streamData = await this.getStreamData(episode.id, type);
                    const directLink = await this.extractDirectLink(streamData, quality);

                    if (directLink) {
                        downloadLinks.push({
                            episode: episodeNum,
                            title: episode.title,
                            url: directLink,
                            quality: quality,
                            type: type,
                            size: await this.getFileSize(directLink)
                        });
                    }
                } catch (episodeError) {
                    console.error(`Error processing episode ${episodeNum}:`, episodeError.message);
                    // Continue with other episodes
                }
            }

            return downloadLinks;
        } catch (error) {
            console.error(`9anime episodes download error:`, error.message);
            throw new Error(`Failed to download episodes: ${error.message}`);
        }
    }

    async getEpisodeList(animeId) {
        try {
            let animeUrl;
            if (animeId.startsWith('http')) {
                animeUrl = animeId;
            } else {
                animeUrl = `${this.baseUrl}/watch/${animeId}`;
            }

            const response = await axios.get(animeUrl, {
                headers: this.headers,
                timeout: 10000
            });

            const $ = cheerio.load(response.data);
            const episodes = [];

            // Parse episode list
            $('.ss-list a, .episode-item a, .eps-item a').each((index, element) => {
                const $el = $(element);
                const title = $el.attr('title') || $el.text().trim();
                const href = $el.attr('href');
                const episodeNum = $el.attr('data-number') || 
                                 title.match(/Episode (\d+)/i)?.[1] || 
                                 (index + 1);

                if (href) {
                    episodes.push({
                        id: this.extractEpisodeId(href),
                        number: parseInt(episodeNum),
                        title: title,
                        url: this.baseUrl + href
                    });
                }
            });

            return episodes.sort((a, b) => a.number - b.number);
        } catch (error) {
            console.error(`9anime episode list error:`, error.message);
            throw new Error(`Failed to get episode list: ${error.message}`);
        }
    }

    async getStreamData(episodeId, type = 'sub') {
        try {
            // This would typically involve making requests to get streaming data
            // Implementation depends on the site's specific API structure
            const streamUrl = `${this.baseUrl}/ajax/v2/episode/sources?id=${episodeId}`;
            
            const response = await axios.get(streamUrl, {
                headers: {
                    ...this.headers,
                    'X-Requested-With': 'XMLHttpRequest',
                    'Referer': this.baseUrl
                },
                timeout: 10000
            });

            return response.data;
        } catch (error) {
            console.error(`9anime stream data error:`, error.message);
            throw new Error(`Failed to get stream data: ${error.message}`);
        }
    }

    async extractDirectLink(streamData, quality) {
        try {
            // This is a simplified implementation
            // Real implementation would need to handle the site's specific streaming logic
            
            if (streamData && streamData.link) {
                // Extract and process the streaming link
                const link = streamData.link;
                
                // Additional processing might be needed here based on the site's structure
                return link;
            }

            throw new Error('No valid stream link found');
        } catch (error) {
            console.error(`9anime direct link error:`, error.message);
            throw new Error(`Failed to extract direct link: ${error.message}`);
        }
    }

    async getFileSize(url) {
        try {
            const response = await axios.head(url, {
                headers: this.headers,
                timeout: 5000
            });
            
            const contentLength = response.headers['content-length'];
            if (contentLength) {
                const sizeInMB = (parseInt(contentLength) / (1024 * 1024)).toFixed(2);
                return `${sizeInMB} MB`;
            }
            
            return 'Unknown';
        } catch (error) {
            return 'Unknown';
        }
    }

    async parseAnimeList(html) {
        const $ = cheerio.load(html);
        const results = [];

        $('.film_list-wrap .flw-item, .ani.poster.tip').each((index, element) => {
            const $el = $(element);
            const titleElement = $el.find('.film-name a, .title a');
            const imageElement = $el.find('.film-poster img, .poster img');
            const metaElement = $el.find('.film-detail .fd-infor, .meta');
            
            const title = titleElement.attr('title') || titleElement.text().trim();
            const url = titleElement.attr('href');
            const image = imageElement.attr('data-src') || imageElement.attr('src');
            
            // Extract metadata
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

    extractAnimeId(url) {
        // Extract anime ID from URL
        const matches = url.match(/\/watch\/([^\/\?]+)/);
        return matches ? matches[1] : url.split('/').pop().split('?')[0];
    }

    extractEpisodeId(url) {
        // Extract episode ID from URL
        const matches = url.match(/\/watch\/[^\/]+\/ep-(\d+)/);
        return matches ? matches[1] : url.split('/').pop().split('?')[0];
    }

    // Utility method to check if site is accessible
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

    // Get supported qualities
    getSupportedQualities() {
        return ['1080p', '720p', '480p', '360p'];
    }

    // Get supported types
    getSupportedTypes() {
        return ['sub', 'dub'];
    }
}

module.exports = NineAnimePlugin;