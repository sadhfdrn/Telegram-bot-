const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

class AnipahePlugin {
    constructor() {
        this.name = 'anipahe';
        this.displayName = 'Anipahe';
        this.icon = '🤖';
        this.description = 'Download anime from Anipahe - High quality anime streaming site';
        this.baseUrl = 'https://animepahe.ru';
        this.apiUrl = 'https://animepahe.ru/api';
        this.browser = null;
        this.page = null;
        this.qualities = ['360p', '480p', '720p', '1080p'];
        this.audioTypes = ['sub', 'dub'];
    }

    async initBrowser() {
        try {
            if (!this.browser) {
                console.log('🚀 Launching browser...');
                this.browser = await puppeteer.launch({
                    headless: true,
                    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-accelerated-2d-canvas',
                        '--no-first-run',
                        '--no-zygote',
                        '--disable-gpu',
                        '--disable-web-security',
                        '--disable-features=VizDisplayCompositor',
                        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                    ]
                });
                console.log('✅ Browser launched successfully');
            }
            
            if (!this.page) {
                console.log('📄 Creating new page...');
                this.page = await this.browser.newPage();
                await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
                
                // Set extra headers to avoid detection
                await this.page.setExtraHTTPHeaders({
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
                });
                console.log('✅ Page created and configured');
            }
        } catch (error) {
            console.error('❌ Failed to initialize browser:', error);
            // Clean up any partial initialization
            await this.closeBrowser();
            throw error;
        }
    }

    async closeBrowser() {
        try {
            if (this.page) {
                await this.page.close();
                this.page = null;
                console.log('📄 Page closed');
            }
            if (this.browser) {
                await this.browser.close();
                this.browser = null;
                console.log('🚀 Browser closed');
            }
        } catch (error) {
            console.error('⚠️ Error closing browser:', error);
            // Force reset even if closing failed
            this.browser = null;
            this.page = null;
        }
    }

    async ensureBrowserReady() {
        // Ensure browser and page are ready, reinitialize if needed
        if (!this.browser || !this.page) {
            await this.initBrowser();
        }
        
        // Double check that page is still valid
        try {
            if (this.page.isClosed()) {
                console.log('⚠️ Page was closed, creating new one...');
                this.page = await this.browser.newPage();
                await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
                await this.page.setExtraHTTPHeaders({
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
                });
            }
        } catch (error) {
            console.log('⚠️ Page check failed, reinitializing...');
            await this.initBrowser();
        }
    }

    async search(query) {
        try {
            await this.ensureBrowserReady();
            
            // Navigate to search page
            const searchUrl = `${this.baseUrl}/?m=search&q=${encodeURIComponent(query)}`;
            console.log(`🔍 Searching Anipahe for: ${query}`);
            
            await this.page.goto(searchUrl, { waitUntil: 'networkidle0', timeout: 30000 });

            // Wait for search results to load
            await this.page.waitForSelector('.col-lg-8', { timeout: 15000 });

            // Extract anime list
            const animeList = await this.page.evaluate(() => {
                const results = [];
                const animeItems = document.querySelectorAll('.col-lg-8 .row .col-6.col-sm-4.col-md-3.col-lg-4.col-xl-3');

                animeItems.forEach((item, index) => {
                    try {
                        const linkElement = item.querySelector('a');
                        const imageElement = item.querySelector('img');
                        const titleElement = item.querySelector('.title');
                        const infoElements = item.querySelectorAll('.info span');

                        if (linkElement && titleElement) {
                            const url = linkElement.href;
                            const id = url.split('/anime/')[1]?.split('?')[0] || url.split('/').pop();
                            const title = titleElement.textContent.trim();
                            const image = imageElement ? imageElement.src : '';
                            
                            // Extract year and status from info spans
                            let year = '';
                            let status = '';
                            let type = '';
                            
                            infoElements.forEach(span => {
                                const text = span.textContent.trim();
                                if (/^\d{4}$/.test(text)) {
                                    year = text;
                                } else if (text.includes('Completed') || text.includes('Ongoing') || text.includes('Airing')) {
                                    status = text;
                                } else if (text.includes('TV') || text.includes('Movie') || text.includes('OVA')) {
                                    type = text;
                                }
                            });

                            results.push({
                                id: id,
                                title: title,
                                url: url,
                                image: image,
                                year: year || 'N/A',
                                status: status || 'Unknown',
                                type: type || 'TV',
                                source: 'anipahe'
                            });
                        }
                    } catch (error) {
                        console.error('Error extracting anime item:', error);
                    }
                });

                return results;
            });

            console.log(`✅ Found ${animeList.length} anime results`);
            return animeList;

        } catch (error) {
            console.error('Search error:', error);
            
            // Try to recover by reinitializing browser
            try {
                console.log('🔄 Attempting to recover browser...');
                await this.closeBrowser();
                await this.initBrowser();
                
                // Retry the search once
                const searchUrl = `${this.baseUrl}/?m=search&q=${encodeURIComponent(query)}`;
                await this.page.goto(searchUrl, { waitUntil: 'networkidle0', timeout: 30000 });
                await this.page.waitForSelector('.col-lg-8', { timeout: 15000 });
                
                const animeList = await this.page.evaluate(() => {
                    const results = [];
                    const animeItems = document.querySelectorAll('.col-lg-8 .row .col-6.col-sm-4.col-md-3.col-lg-4.col-xl-3');

                    animeItems.forEach((item, index) => {
                        try {
                            const linkElement = item.querySelector('a');
                            const imageElement = item.querySelector('img');
                            const titleElement = item.querySelector('.title');
                            const infoElements = item.querySelectorAll('.info span');

                            if (linkElement && titleElement) {
                                const url = linkElement.href;
                                const id = url.split('/anime/')[1]?.split('?')[0] || url.split('/').pop();
                                const title = titleElement.textContent.trim();
                                const image = imageElement ? imageElement.src : '';
                                
                                let year = '';
                                let status = '';
                                let type = '';
                                
                                infoElements.forEach(span => {
                                    const text = span.textContent.trim();
                                    if (/^\d{4}$/.test(text)) {
                                        year = text;
                                    } else if (text.includes('Completed') || text.includes('Ongoing') || text.includes('Airing')) {
                                        status = text;
                                    } else if (text.includes('TV') || text.includes('Movie') || text.includes('OVA')) {
                                        type = text;
                                    }
                                });

                                results.push({
                                    id: id,
                                    title: title,
                                    url: url,
                                    image: image,
                                    year: year || 'N/A',
                                    status: status || 'Unknown',
                                    type: type || 'TV',
                                    source: 'anipahe'
                                });
                            }
                        } catch (error) {
                            console.error('Error extracting anime item:', error);
                        }
                    });

                    return results;
                });
                
                console.log(`✅ Recovered! Found ${animeList.length} anime results`);
                return animeList;
                
            } catch (recoveryError) {
                console.error('❌ Recovery failed:', recoveryError);
                throw new Error(`Failed to search Anipahe: ${error.message}`);
            }
        }
    }

    async getAnimeDetails(animeId) {
        try {
            await this.ensureBrowserReady();
            
            const animeUrl = `${this.baseUrl}/anime/${animeId}`;
            console.log(`📋 Getting details for: ${animeId}`);
            
            await this.page.goto(animeUrl, { waitUntil: 'networkidle0', timeout: 30000 });

            // Wait for anime details to load
            await this.page.waitForSelector('.anime-info', { timeout: 15000 });

            const animeDetails = await this.page.evaluate(() => {
                const details = {};
                
                // Get title
                const titleElement = document.querySelector('.anime-info h1');
                details.title = titleElement ? titleElement.textContent.trim() : '';
                
                // Get description
                const descElement = document.querySelector('.anime-synopsis');
                details.description = descElement ? descElement.textContent.trim() : '';
                
                // Get info from the info box
                const infoItems = document.querySelectorAll('.anime-info .row .col-sm-9 p');
                infoItems.forEach(item => {
                    const text = item.textContent;
                    if (text.includes('Type:')) {
                        details.type = text.replace('Type:', '').trim();
                    } else if (text.includes('Episodes:')) {
                        details.episodes = text.replace('Episodes:', '').trim();
                    } else if (text.includes('Status:')) {
                        details.status = text.replace('Status:', '').trim();
                    } else if (text.includes('Aired:')) {
                        details.year = text.replace('Aired:', '').trim().split(' ')[0];
                    } else if (text.includes('Genre:')) {
                        details.genres = text.replace('Genre:', '').trim().split(',').map(g => g.trim());
                    }
                });
                
                // Get episode count from episode list
                const episodeElements = document.querySelectorAll('.episode-list a');
                details.totalEpisodes = episodeElements.length;
                
                return details;
            });

            console.log(`✅ Got anime details for: ${animeDetails.title}`);
            return animeDetails;

        } catch (error) {
            console.error('Get anime details error:', error);
            throw new Error(`Failed to get anime details: ${error.message}`);
        }
    }

    async getEpisodeList(animeId) {
        try {
            await this.ensureBrowserReady();
            
            const animeUrl = `${this.baseUrl}/anime/${animeId}`;
            await this.page.goto(animeUrl, { waitUntil: 'networkidle0', timeout: 30000 });

            // Wait for episode list to load
            await this.page.waitForSelector('.episode-list', { timeout: 15000 });

            const episodes = await this.page.evaluate(() => {
                const episodeList = [];
                const episodeElements = document.querySelectorAll('.episode-list a');
                
                episodeElements.forEach((element, index) => {
                    const episodeUrl = element.href;
                    const episodeId = episodeUrl.split('/').pop();
                    const episodeNumber = index + 1;
                    
                    // Try to extract episode number from text
                    const episodeText = element.textContent.trim();
                    const episodeMatch = episodeText.match(/Episode (\d+)/i);
                    const actualEpisodeNumber = episodeMatch ? parseInt(episodeMatch[1]) : episodeNumber;
                    
                    episodeList.push({
                        id: episodeId,
                        number: actualEpisodeNumber,
                        url: episodeUrl,
                        title: episodeText
                    });
                });
                
                return episodeList.reverse(); // Reverse to get episodes in correct order
            });

            console.log(`✅ Found ${episodes.length} episodes`);
            return episodes;

        } catch (error) {
            console.error('Get episode list error:', error);
            throw new Error(`Failed to get episode list: ${error.message}`);
        }
    }

    async getDownloadLinks(episodeId, quality = '720p', audioType = 'sub') {
        try {
            await this.ensureBrowserReady();
            
            const episodeUrl = `${this.baseUrl}/play/${episodeId}`;
            console.log(`🎬 Getting download links for episode: ${episodeId}`);
            
            await this.page.goto(episodeUrl, { waitUntil: 'networkidle0', timeout: 30000 });

            // Wait for video player to load
            await this.page.waitForSelector('#jwplayer', { timeout: 15000 });

            // Extract download links from the episode page
            const downloadLinks = await this.page.evaluate((quality, audioType) => {
                const links = [];
                
                // Look for download buttons with different patterns
                const downloadSelectors = [
                    'a[href*="pahe.win"]',
                    'a[href*="kwik"]',
                    'a[href*="vault"]',
                    '.download-link',
                    '.btn[href*="download"]',
                    'a[onclick*="download"]'
                ];
                
                downloadSelectors.forEach(selector => {
                    const buttons = document.querySelectorAll(selector);
                    buttons.forEach(button => {
                        const href = button.href || button.getAttribute('onclick');
                        const text = button.textContent.toLowerCase();
                        
                        if (href) {
                            // Check quality preference
                            const qualityMatch = text.includes(quality.toLowerCase()) || 
                                               href.includes(quality) ||
                                               !text.match(/\d+p/); // If no quality specified, assume it matches
                            
                            // Check audio type preference
                            const audioMatch = audioType === 'sub' ? 
                                              !text.includes('dub') : 
                                              text.includes('dub');
                            
                            if (qualityMatch && (audioMatch || !text.includes('dub'))) {
                                // Extract size if available
                                const sizeMatch = text.match(/(\d+(?:\.\d+)?)\s*(mb|gb)/i);
                                const size = sizeMatch ? `${sizeMatch[1]} ${sizeMatch[2].toUpperCase()}` : 'Unknown';
                                
                                links.push({
                                    url: href.includes('onclick') ? href.match(/['"]([^'"]+)['"]/)?.[1] || href : href,
                                    quality: quality,
                                    audioType: audioType,
                                    size: size
                                });
                            }
                        }
                    });
                });
                
                // If no download buttons found, look in scripts for redirect URLs
                if (links.length === 0) {
                    const scripts = document.querySelectorAll('script');
                    for (const script of scripts) {
                        const content = script.textContent;
                        
                        // Look for pahe.win or kwik URLs
                        const paheMatches = content.match(/https:\/\/pahe\.win\/[^"']+/g);
                        const kwikMatches = content.match(/https:\/\/kwik\.[^"']+/g);
                        const allMatches = [...(paheMatches || []), ...(kwikMatches || [])];
                        
                        allMatches.forEach(match => {
                            links.push({
                                url: match,
                                quality: quality,
                                audioType: audioType,
                                size: 'Unknown'
                            });
                        });
                    }
                }
                
                // Remove duplicates
                const uniqueLinks = links.filter((link, index, self) => 
                    index === self.findIndex(l => l.url === link.url)
                );
                
                return uniqueLinks;
            }, quality, audioType);

            // Process each link through the redirect chain
            const finalLinks = [];
            for (const link of downloadLinks) {
                try {
                    // Handle different types of URLs
                    let directLink = null;
                    
                    if (link.url.includes('pahe.win') || link.url.includes('kwik.si') || link.url.includes('kwik.cx')) {
                        console.log(`🔗 Processing redirect URL: ${link.url}`);
                        directLink = await this.extractDirectLink(link.url);
                    } else if (link.url.includes('.mp4')) {
                        // Already a direct link
                        directLink = link.url;
                        console.log(`✅ Direct MP4 link found: ${directLink}`);
                    } else {
                        // Try to process it anyway
                        console.log(`🔗 Processing unknown URL type: ${link.url}`);
                        directLink = await this.extractDirectLink(link.url);
                    }
                    
                    if (directLink) {
                        // Extract additional info from the final URL
                        const filename = directLink.split('/').pop()?.split('?')[0] || '';
                        const sizeMatch = filename.match(/(\d+p)/);
                        const actualQuality = sizeMatch ? sizeMatch[1] : quality;
                        
                        finalLinks.push({
                            ...link,
                            url: directLink,
                            quality: actualQuality,
                            filename: filename
                        });
                        
                        console.log(`✅ Successfully processed: ${directLink}`);
                    } else {
                        console.log(`⚠️ Could not extract direct link from: ${link.url}`);
                        // Keep the original link as fallback
                        finalLinks.push(link);
                    }
                } catch (error) {
                    console.error(`❌ Error processing link ${link.url}:`, error.message);
                    // Keep the original link as fallback
                    finalLinks.push(link);
                }
                
                // Add small delay between requests to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            console.log(`✅ Found ${finalLinks.length} download links`);
            return finalLinks;

        } catch (error) {
            console.error('Get download links error:', error);
            throw new Error(`Failed to get download links: ${error.message}`);
        }
    }

    async extractDirectLink(initialUrl) {
        try {
            console.log(`🔗 Starting redirect chain from: ${initialUrl}`);
            
            // Step 1: Handle pahe.win redirect page
            let currentUrl = initialUrl;
            
            if (currentUrl.includes('pahe.win')) {
                console.log('🔄 Processing pahe.win redirect...');
                await this.page.goto(currentUrl, { waitUntil: 'networkidle0', timeout: 30000 });
                
                // Wait for redirect or find the next URL
                await this.page.waitForTimeout(2000);
                
                // Look for the redirect URL to kwik.si
                const kwikUrl = await this.page.evaluate(() => {
                    // Look for redirect in meta tags
                    const metaRefresh = document.querySelector('meta[http-equiv="refresh"]');
                    if (metaRefresh) {
                        const content = metaRefresh.getAttribute('content');
                        const urlMatch = content.match(/url=(.+)/);
                        if (urlMatch) return urlMatch[1];
                    }
                    
                    // Look for redirect in JavaScript
                    const scripts = document.querySelectorAll('script');
                    for (const script of scripts) {
                        const content = script.textContent;
                        const locationMatch = content.match(/location\.href\s*=\s*['"]([^'"]+)['"]/);
                        if (locationMatch) return locationMatch[1];
                        
                        const windowMatch = content.match(/window\.location\s*=\s*['"]([^'"]+)['"]/);
                        if (windowMatch) return windowMatch[1];
                    }
                    
                    // Look for links to kwik.si
                    const links = document.querySelectorAll('a[href*="kwik.si"]');
                    if (links.length > 0) return links[0].href;
                    
                    return null;
                });
                
                if (kwikUrl) {
                    currentUrl = kwikUrl;
                    console.log(`✅ Found kwik.si URL: ${currentUrl}`);
                } else {
                    console.log('⏳ Waiting for automatic redirect...');
                    await this.page.waitForTimeout(5000);
                    currentUrl = this.page.url();
                }
            }
            
            // Step 2: Handle kwik.si page
            if (currentUrl.includes('kwik.si')) {
                console.log('🔄 Processing kwik.si page...');
                await this.page.goto(currentUrl, { waitUntil: 'networkidle0', timeout: 30000 });
                
                // Wait for the page to fully load
                await this.page.waitForTimeout(3000);
                
                // Try to find download button or direct link
                const directLink = await this.page.evaluate(() => {
                    // Look for download button
                    const downloadBtn = document.querySelector('a.btn[href*=".mp4"], button[onclick*=".mp4"]');
                    if (downloadBtn) {
                        const href = downloadBtn.href || downloadBtn.getAttribute('onclick');
                        if (href && href.includes('.mp4')) {
                            const match = href.match(/https:\/\/[^"']+\.mp4[^"']*/);
                            if (match) return match[0];
                        }
                    }
                    
                    // Look for direct mp4 links
                    const mp4Links = document.querySelectorAll('a[href*=".mp4"]');
                    for (const link of mp4Links) {
                        if (link.href.includes('vault') || link.href.includes('.mp4')) {
                            return link.href;
                        }
                    }
                    
                    // Check in script tags for direct links
                    const scripts = document.querySelectorAll('script');
                    for (const script of scripts) {
                        const content = script.textContent;
                        // Look for vault URLs
                        const vaultMatch = content.match(/https:\/\/vault-\d+\.kwik\.[^"']+\.mp4[^"']*/);
                        if (vaultMatch) return vaultMatch[0];
                        
                        // Look for other direct mp4 links
                        const mp4Match = content.match(/https:\/\/[^"']+\.mp4[^"']*/);
                        if (mp4Match && mp4Match[0].includes('vault')) return mp4Match[0];
                    }
                    
                    return null;
                });
                
                if (directLink) {
                    console.log(`✅ Found direct download link: ${directLink}`);
                    return directLink;
                }
                
                // If no direct link found, try clicking download button
                try {
                    const downloadButton = await this.page.$('a.btn, button[class*="download"], .download-btn');
                    if (downloadButton) {
                        console.log('🖱️ Clicking download button...');
                        await downloadButton.click();
                        await this.page.waitForTimeout(3000);
                        
                        // Check if we got redirected to a direct link
                        const finalUrl = this.page.url();
                        if (finalUrl.includes('.mp4')) {
                            console.log(`✅ Got direct link from button click: ${finalUrl}`);
                            return finalUrl;
                        }
                    }
                } catch (error) {
                    console.log('⚠️ Could not click download button:', error.message);
                }
            }
            
            // Step 3: Handle any other redirect pages
            if (!currentUrl.includes('.mp4')) {
                console.log('🔄 Processing additional redirects...');
                await this.page.goto(currentUrl, { waitUntil: 'networkidle0', timeout: 30000 });
                await this.page.waitForTimeout(3000);
                
                // Check if we ended up at a direct link
                const finalUrl = this.page.url();
                if (finalUrl.includes('.mp4')) {
                    console.log(`✅ Final redirect led to direct link: ${finalUrl}`);
                    return finalUrl;
                }
            }
            
            console.log('❌ Could not extract direct download link');
            return null;
            
        } catch (error) {
            console.error('❌ Extract direct link error:', error);
            return null;
        }
    }

    async downloadEpisodes(animeId, episodeNumbers, quality = '720p', audioType = 'sub') {
        try {
            const episodes = await this.getEpisodeList(animeId);
            const downloadLinks = [];
            
            for (const episodeNumber of episodeNumbers) {
                const episode = episodes.find(ep => ep.number === episodeNumber);
                if (episode) {
                    console.log(`📥 Getting download link for Episode ${episodeNumber}`);
                    const links = await this.getDownloadLinks(episode.id, quality, audioType);
                    
                    if (links.length > 0) {
                        downloadLinks.push({
                            episode: episodeNumber,
                            title: episode.title,
                            url: links[0].url,
                            quality: quality,
                            audioType: audioType,
                            size: links[0].size
                        });
                    }
                }
            }
            
            return downloadLinks;
            
        } catch (error) {
            console.error('Download episodes error:', error);
            throw new Error(`Failed to download episodes: ${error.message}`);
        }
    }

    async downloadSeason(animeId, quality = '720p', audioType = 'sub') {
        try {
            const episodes = await this.getEpisodeList(animeId);
            const episodeNumbers = episodes.map(ep => ep.number);
            
            console.log(`📥 Downloading full season: ${episodeNumbers.length} episodes`);
            return await this.downloadEpisodes(animeId, episodeNumbers, quality, audioType);
            
        } catch (error) {
            console.error('Download season error:', error);
            throw new Error(`Failed to download season: ${error.message}`);
        }
    }

    // Cleanup method
    async cleanup() {
        await this.closeBrowser();
    }

    // Get supported qualities
    getSupportedQualities() {
        return this.qualities;
    }

    // Get supported audio types
    getSupportedAudioTypes() {
        return this.audioTypes;
    }
}

module.exports = AnipahePlugin;