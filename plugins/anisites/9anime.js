const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

// Try to import Laserr, fallback gracefully if not available
let Laserr;
try {
    Laserr = require('laserr');
} catch (error) {
    console.warn('⚠️ Laserr not found, using fallback scraper only');
    Laserr = null;
}

// Your original Anime class (as fallback)
class FallbackAnime {
    constructor(browser) {
        this.browser = browser;
        this.baseUrl = 'https://9animetv.to';
    }

    async search(query) {
        const page = await this.browser.newPage();
        try {
            const searchUrl = `${this.baseUrl}/search?keyword=${encodeURIComponent(query)}`;
            await page.goto(searchUrl, { waitUntil: 'networkidle2' });
            
            await page.waitForSelector('.film_list-wrap', { timeout: 10000 });
            
            const results = await page.evaluate(() => {
                const animeItems = document.querySelectorAll('.flw-item');
                return Array.from(animeItems).map(item => {
                    const titleElement = item.querySelector('.film-name a');
                    const imageElement = item.querySelector('.film-poster img');
                    const metaElement = item.querySelector('.fd-infor');
                    
                    return {
                        title: titleElement ? titleElement.textContent.trim() : '',
                        url: titleElement ? titleElement.href : '',
                        image: imageElement ? imageElement.src : '',
                        year: metaElement ? metaElement.textContent.match(/\d{4}/) ? metaElement.textContent.match(/\d{4}/)[0] : 'N/A' : 'N/A',
                        type: metaElement ? metaElement.textContent.includes('TV') ? 'TV' : 'Movie' : 'Unknown'
                    };
                }).filter(item => item.title && item.url);
            });
            
            return results;
        } finally {
            await page.close();
        }
    }

    async getEpisodes(animeUrl) {
        const page = await this.browser.newPage();
        try {
            await page.goto(animeUrl, { waitUntil: 'networkidle2' });
            await page.waitForSelector('.ss-list', { timeout: 10000 });
            
            const episodes = await page.evaluate(() => {
                const episodeElements = document.querySelectorAll('.ss-list a');
                return Array.from(episodeElements).map((ep, index) => {
                    return {
                        title: ep.getAttribute('title') || `Episode ${index + 1}`,
                        url: ep.href,
                        number: index + 1,
                        id: ep.href
                    };
                });
            });
            
            return episodes;
        } finally {
            await page.close();
        }
    }

    async getVideo(episodeUrl) {
        const page = await this.browser.newPage();
        try {
            await page.goto(episodeUrl, { waitUntil: 'networkidle2' });
            await page.waitForSelector('#iframe-embed', { timeout: 15000 });
            
            const iframeSrc = await page.evaluate(() => {
                const iframe = document.querySelector('#iframe-embed');
                return iframe ? iframe.src : null;
            });
            
            if (!iframeSrc) {
                throw new Error('No video iframe found');
            }
            
            await page.goto(iframeSrc, { waitUntil: 'networkidle2' });
            
            const videoUrl = await page.evaluate(() => {
                const videoElement = document.querySelector('video source');
                if (videoElement) {
                    return videoElement.src;
                }
                
                const scriptTags = document.querySelectorAll('script');
                for (const script of scriptTags) {
                    const content = script.textContent;
                    if (content) {
                        const m3u8Match = content.match(/https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/);
                        if (m3u8Match) {
                            return m3u8Match[0];
                        }
                        
                        const mp4Match = content.match(/https?:\/\/[^"'\s]+\.mp4[^"'\s]*/);
                        if (mp4Match) {
                            return mp4Match[0];
                        }
                    }
                }
                
                return null;
            });
            
            if (!videoUrl) {
                throw new Error('Could not extract video URL');
            }
            
            return {
                video: videoUrl,
                headers: {
                    'Referer': this.baseUrl,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            };
        } finally {
            await page.close();
        }
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
        }
    }
}

// Helper function to create puppeteer instance
async function createPuppeteerInstance(options = {}) {
    const defaultOptions = {
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding'
        ]
    };
    
    return await puppeteer.launch({ ...defaultOptions, ...options });
}

// Enhanced plugin class with Laserr integration
class EnhancedAnimePlugin {
    constructor() {
        this.name = "enhanced-anime";
        this.displayName = "Enhanced Anime Scraper";
        this.icon = "🚀";
        this.description = "Multi-source anime scraper with Laserr integration and fallback";
        this.baseUrl = "https://9animetv.to";
        
        // Laserr integration
        this.laserr = null;
        this.laserAvailable = false;
        
        // Fallback scraper
        this.browser = null;
        this.fallbackClient = null;
        this.isInitialized = false;
        
        // Supported anime targets for Laserr (these are examples - actual targets depend on Laserr's implementation)
        this.animeTargets = [
            'nyaa',
            'animetosho',
            'horriblesubs',
            'subsplease'
        ];
    }

    async init() {
        try {
            if (!this.isInitialized) {
                console.log("🚀 Initializing Enhanced Anime Plugin...");
                
                // Initialize Laserr if available
                if (Laserr) {
                    try {
                        this.laserr = new Laserr();
                        this.laserAvailable = true;
                        console.log("✅ Laserr initialized successfully");
                    } catch (laserError) {
                        console.warn("⚠️ Laserr initialization failed:", laserError.message);
                        this.laserAvailable = false;
                    }
                }
                
                // Initialize fallback scraper
                console.log("🎌 Initializing fallback Puppeteer scraper...");
                this.browser = await createPuppeteerInstance();
                this.fallbackClient = new FallbackAnime(this.browser);
                
                this.isInitialized = true;
                console.log("✅ Enhanced Anime Plugin initialized successfully");
                console.log(`📊 Status: Laserr=${this.laserAvailable ? 'Available' : 'Not Available'}, Fallback=Available`);
            }
        } catch (error) {
            console.error("❌ Failed to initialize Enhanced Anime Plugin:", error);
            throw error;
        }
    }

    async ensureInitialized() {
        if (!this.isInitialized) {
            await this.init();
        }
    }

    // Laserr search method
    async searchWithLaserr(query, limit = 10) {
        if (!this.laserAvailable) {
            throw new Error('Laserr not available');
        }

        try {
            console.log(`🔍 Searching with Laserr for: ${query}`);
            
            // Try searching across multiple anime targets
            const allResults = [];
            
            for (const target of this.animeTargets.slice(0, 3)) { // Limit to 3 targets to avoid overwhelming
                try {
                    // Note: Actual Laserr API may differ - this is based on Jackett-like functionality
                    const results = await this.laserr.search({
                        query: query,
                        target: target,
                        category: 'anime', // or whatever category Laserr uses
                        limit: Math.ceil(limit / 3)
                    });
                    
                    if (results && results.length > 0) {
                        const formattedResults = results.map(result => ({
                            id: result.guid || result.link || result.url,
                            title: result.title,
                            url: result.link || result.url,
                            image: result.image || null,
                            year: this.extractYear(result.title) || "N/A",
                            status: "Available",
                            type: this.detectType(result.title),
                            episodes: "N/A",
                            size: result.size || "Unknown",
                            seeders: result.seeders || 0,
                            source: target
                        }));
                        
                        allResults.push(...formattedResults);
                    }
                } catch (targetError) {
                    console.warn(`⚠️ Target ${target} failed:`, targetError.message);
                }
            }
            
            return allResults.slice(0, limit);
            
        } catch (error) {
            console.error("❌ Laserr search error:", error);
            throw error;
        }
    }

    // Fallback search method
    async searchWithFallback(query, limit = 10) {
        try {
            console.log(`🔍 Searching with fallback scraper for: ${query}`);
            const searchResults = await this.fallbackClient.search(query);
            
            const formattedResults = searchResults.slice(0, limit).map((show, index) => ({
                id: show.url,
                title: show.title,
                url: show.url,
                image: show.image || null,
                year: show.year || "N/A",
                status: "Available",
                type: show.type || "TV",
                episodes: "N/A",
                source: "9anime-fallback"
            }));

            return formattedResults;
        } catch (error) {
            console.error("❌ Fallback search error:", error);
            throw error;
        }
    }

    // Main search method with intelligent fallback
    async search(query, limit = 10) {
        try {
            await this.ensureInitialized();
            
            let results = [];
            
            // Try Laserr first if available
            if (this.laserAvailable) {
                try {
                    results = await this.searchWithLaserr(query, limit);
                    if (results.length > 0) {
                        console.log(`✅ Found ${results.length} results with Laserr`);
                        return results;
                    }
                } catch (laserError) {
                    console.warn("⚠️ Laserr search failed, falling back to custom scraper");
                }
            }
            
            // Fallback to custom scraper
            results = await this.searchWithFallback(query, limit);
            console.log(`✅ Found ${results.length} results with fallback scraper`);
            return results;

        } catch (error) {
            console.error("❌ Search failed completely:", error);
            throw new Error(`Search failed: ${error.message}`);
        }
    }

    // Enhanced search that combines both sources
    async searchCombined(query, limit = 10) {
        try {
            await this.ensureInitialized();
            
            const results = [];
            const halfLimit = Math.ceil(limit / 2);
            
            // Get results from both sources if possible
            const promises = [];
            
            if (this.laserAvailable) {
                promises.push(
                    this.searchWithLaserr(query, halfLimit)
                        .catch(error => {
                            console.warn("⚠️ Laserr search failed:", error.message);
                            return [];
                        })
                );
            }
            
            promises.push(
                this.searchWithFallback(query, halfLimit)
                    .catch(error => {
                        console.warn("⚠️ Fallback search failed:", error.message);
                        return [];
                    })
            );
            
            const allResults = await Promise.all(promises);
            const combinedResults = allResults.flat();
            
            // Remove duplicates based on title similarity
            const uniqueResults = this.removeDuplicates(combinedResults);
            
            console.log(`✅ Combined search found ${uniqueResults.length} unique results`);
            return uniqueResults.slice(0, limit);
            
        } catch (error) {
            console.error("❌ Combined search error:", error);
            throw new Error(`Combined search failed: ${error.message}`);
        }
    }

    // Fallback methods for episodes and video (using original implementation)
    async getAnimeDetails(animeId) {
        try {
            await this.ensureInitialized();
            
            // For now, use fallback for detailed info
            // In the future, you could enhance this with Laserr data
            const episodes = await this.fallbackClient.getEpisodes(animeId);
            
            return {
                id: animeId,
                url: animeId,
                title: "Anime Details",
                episodes: episodes.length,
                episodesList: episodes.map((ep, index) => ({
                    number: index + 1,
                    title: ep.title || `Episode ${index + 1}`,
                    url: ep.url,
                    id: ep.url
                })),
                totalEpisodes: episodes.length,
                year: "N/A",
                status: episodes.length > 0 ? "Available" : "No Episodes",
                genres: [],
                description: `Anime with ${episodes.length} available episodes`
            };

        } catch (error) {
            console.error("❌ Anime details error:", error);
            throw new Error(`Failed to get anime details: ${error.message}`);
        }
    }

    async getEpisodes(animeId) {
        try {
            await this.ensureInitialized();
            const episodes = await this.fallbackClient.getEpisodes(animeId);
            
            return episodes.map((episode, index) => ({
                number: index + 1,
                title: episode.title || `Episode ${index + 1}`,
                url: episode.url,
                id: episode.url,
                thumbnail: null
            }));

        } catch (error) {
            console.error("❌ Episodes error:", error);
            throw new Error(`Failed to get episodes: ${error.message}`);
        }
    }

    async getVideoUrl(episodeUrl, quality = "1080p") {
        try {
            await this.ensureInitialized();
            const videoData = await this.fallbackClient.getVideo(episodeUrl);
            
            if (!videoData || !videoData.video) {
                throw new Error("No video URL found");
            }

            return {
                url: videoData.video,
                quality: quality,
                type: videoData.video.includes('.m3u8') ? 'm3u8' : 'mp4',
                size: "Unknown",
                headers: videoData.headers || {}
            };

        } catch (error) {
            console.error("❌ Video URL error:", error);
            throw new Error(`Failed to get video URL: ${error.message}`);
        }
    }

    // Utility methods
    extractYear(title) {
        const yearMatch = title.match(/\b(19|20)\d{2}\b/);
        return yearMatch ? yearMatch[0] : null;
    }

    detectType(title) {
        const lowerTitle = title.toLowerCase();
        if (lowerTitle.includes('movie') || lowerTitle.includes('film')) {
            return 'Movie';
        }
        if (lowerTitle.includes('ova') || lowerTitle.includes('special')) {
            return 'OVA';
        }
        return 'TV';
    }

    removeDuplicates(results) {
        const seen = new Set();
        return results.filter(result => {
            const key = result.title.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    async getStatus() {
        return {
            initialized: this.isInitialized,
            laserr: this.laserAvailable,
            fallback: this.browser !== null,
            supportedTargets: this.animeTargets
        };
    }

    async close() {
        try {
            if (this.fallbackClient) {
                await this.fallbackClient.close();
            }
            if (this.laserr && typeof this.laserr.close === 'function') {
                await this.laserr.close();
            }
            this.isInitialized = false;
            console.log("🔒 Enhanced Anime Plugin closed successfully");
        } catch (error) {
            console.error("❌ Error closing Enhanced Anime Plugin:", error);
        }
    }

    async testConnection() {
        try {
            await this.ensureInitialized();
            const testResults = await this.search("test", 1);
            return testResults.length > 0;
        } catch (error) {
            console.error("❌ Connection test failed:", error);
            return false;
        }
    }
}

module.exports = {
    EnhancedAnimePlugin,
    FallbackAnime,
    createPuppeteerInstance
};