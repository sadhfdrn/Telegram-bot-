const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const axios = require('axios');
const tiktokdl = require('@tobyg74/tiktok-api-dl');
const { promisify } = require('util');
const { exec } = require('child_process');
const sharp = require('sharp'); // For image processing

class TikTokWatermarkPlugin {
    constructor() {
        this.watermarkSettings = new Map();
        this.tiktokCookie = null;
        this.defaultWatermark = {
            text: 'Samuel',
            font: 'Arial',
            fontSize: 24,
            color: 'white',
            opacity: 0.48,
            position: 'bottom-right',
            rotation: -6,
            effect: 'glow',
            tilt: 'single'
        };
        
        // Multiple user agents for rotation
        this.userAgents = [
            'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Android 13; Mobile; rv:109.0) Gecko/117.0 Firefox/117.0',
            'TikTok 26.2.0 rv:262018 (iPhone; iOS 16.5; en_US) Cronet'
        ];
        
        this.styles = {
            classic: {
                text: 'Samuel',
                font: 'Arial',
                fontSize: 24,
                color: 'white',
                opacity: 0.48,
                position: 'bottom-right',
                rotation: -6,
                effect: 'glow',
                tilt: 'single'
            },
            neon: {
                text: 'Samuel',
                font: 'Arial',
                fontSize: 28,
                color: '#00FFFF',
                opacity: 0.7,
                position: 'bottom-right',
                rotation: 0,
                effect: 'neon',
                tilt: 'single'
            },
            shadow: {
                text: 'Samuel',
                font: 'Arial',
                fontSize: 26,
                color: 'white',
                opacity: 0.8,
                position: 'bottom-right',
                rotation: -3,
                effect: 'shadow',
                tilt: 'quad'
            },
            gradient: {
                text: 'Samuel',
                font: 'Arial',
                fontSize: 30,
                color: '#FF6B6B',
                opacity: 0.6,
                position: 'center',
                rotation: 0,
                effect: 'gradient',
                tilt: 'cluster'
            },
            retro: {
                text: 'Samuel',
                font: 'Arial',
                fontSize: 22,
                color: '#FF1493',
                opacity: 0.55,
                position: 'top-left',
                rotation: 15,
                effect: 'retro',
                tilt: 'single'
            },
            minimal: {
                text: 'Samuel',
                font: 'Arial',
                fontSize: 20,
                color: 'white',
                opacity: 0.3,
                position: 'bottom-left',
                rotation: 0,
                effect: 'none',
                tilt: 'single'
            }
        };

        // Check dependencies on initialization
        this.checkDependencies();
    }

    // Check if all dependencies are installed
    async checkDependencies() {
        try {
            await promisify(exec)('ffmpeg -version');
            console.log('✅ FFmpeg is installed and working');
        } catch (error) {
            console.error('❌ FFmpeg not found! Please install FFmpeg:');
            console.error('Ubuntu/Debian: sudo apt install ffmpeg');
            console.error('macOS: brew install ffmpeg');
            console.error('Windows: Download from https://ffmpeg.org/');
        }

        try {
            require('sharp');
            console.log('✅ Sharp is installed and working');
        } catch (error) {
            console.error('❌ Sharp not found! Please install: npm install sharp');
        }
    }

    // Get random user agent
    getRandomUserAgent() {
        return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
    }

    // Set TikTok cookie
    setTikTokCookie(cookie) {
        this.tiktokCookie = cookie;
        console.log('✅ TikTok cookie set successfully');
    }

    // Get current cookie status
    getCookieStatus() {
        return this.tiktokCookie ? 'Cookie is set' : 'No cookie set';
    }

    // Enhanced download with support for multiple media types
    async downloadTikTokMedia(url, useAdvancedFeatures = false) {
        const methods = [
            () => this.downloadWithTobyAPI(url, useAdvancedFeatures),
            () => this.downloadWithAlternativeAPI(url),
            () => this.downloadWithDirectMethod(url)
        ];

        for (let i = 0; i < methods.length; i++) {
            try {
                console.log(`📥 Attempting download method ${i + 1}...`);
                const result = await methods[i]();
                console.log(`✅ Download successful with method ${i + 1}`);
                return result;
            } catch (error) {
                console.log(`❌ Method ${i + 1} failed: ${error.message}`);
                if (i === methods.length - 1) {
                    throw new Error(`All download methods failed. Last error: ${error.message}`);
                }
            }
        }
    }

    // Enhanced Toby API with multi-media support
    async downloadWithTobyAPI(url, useAdvancedFeatures = false) {
        try {
            console.log('📥 Using Toby API...');
            
            const options = {
                version: "v3"
            };

            if (this.tiktokCookie && useAdvancedFeatures) {
                options.cookie = this.tiktokCookie;
                console.log('🍪 Using TikTok cookie');
            }

            let result;
            try {
                result = await tiktokdl.Downloader(url, options);
            } catch (error) {
                console.log('🔄 Retrying with v1 API...');
                options.version = "v1";
                result = await tiktokdl.Downloader(url, options);
            }
            
            if (!result.status || result.status !== 'success') {
                throw new Error(result.message || 'API returned unsuccessful status');
            }
            
            const mediaData = await this.extractMediaData(result.result);
            
            if (!mediaData || mediaData.length === 0) {
                throw new Error('No media found in API response');
            }
            
            console.log('📱 Media info:', {
                title: result.result.desc || result.result.title || 'No title',
                author: result.result.author?.nickname || result.result.author?.username || 'Unknown',
                mediaCount: mediaData.length,
                types: mediaData.map(m => m.type).join(', ')
            });
            
            return await this.downloadMediaFiles(mediaData, 'toby_api');
            
        } catch (error) {
            throw new Error(`Toby API failed: ${error.message}`);
        }
    }

    // Extract media data supporting videos, images, and carousels
    async extractMediaData(result) {
        const mediaData = [];

        // Check for single video
        const videoUrl = this.extractVideoUrl(result);
        if (videoUrl) {
            mediaData.push({
                type: 'video',
                url: videoUrl,
                index: 0
            });
        }

        // Check for image carousel/slideshow
        if (result.images && Array.isArray(result.images)) {
            result.images.forEach((imageUrl, index) => {
                if (imageUrl) {
                    mediaData.push({
                        type: 'image',
                        url: imageUrl,
                        index: index
                    });
                }
            });
        }

        // Check for alternative image formats
        if (result.image_post_info && result.image_post_info.images) {
            result.image_post_info.images.forEach((imageData, index) => {
                const imageUrl = imageData.display_image?.url_list?.[0] || 
                               imageData.owner_watermark_image?.url_list?.[0];
                if (imageUrl) {
                    mediaData.push({
                        type: 'image',
                        url: imageUrl,
                        index: index
                    });
                }
            });
        }

        // Check for carousel videos (multiple video parts)
        if (result.video_list && Array.isArray(result.video_list)) {
            result.video_list.forEach((videoData, index) => {
                const videoUrl = videoData.play_addr?.url_list?.[0] || videoData;
                if (videoUrl) {
                    mediaData.push({
                        type: 'video',
                        url: videoUrl,
                        index: index
                    });
                }
            });
        }

        return mediaData;
    }

    // Alternative API with multi-media support
    async downloadWithAlternativeAPI(url) {
        try {
            console.log('📥 Using alternative API...');
            
            const videoId = this.extractVideoId(url);
            if (!videoId) {
                throw new Error('Could not extract video ID from URL');
            }

            const apiEndpoints = [
                `https://tikwm.com/api/?url=${encodeURIComponent(url)}`,
                `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`
            ];

            for (const endpoint of apiEndpoints) {
                try {
                    const response = await axios.get(endpoint, {
                        timeout: 15000,
                        headers: {
                            'User-Agent': this.getRandomUserAgent(),
                            'Accept': 'application/json',
                            'Referer': 'https://tikwm.com/'
                        }
                    });

                    if (response.data && response.data.code === 0 && response.data.data) {
                        const mediaData = [];
                        const data = response.data.data;

                        // Check for video
                        const videoUrl = data.play || data.wmplay;
                        if (videoUrl) {
                            mediaData.push({
                                type: 'video',
                                url: videoUrl,
                                index: 0
                            });
                        }

                        // Check for images
                        if (data.images && Array.isArray(data.images)) {
                            data.images.forEach((imageUrl, index) => {
                                mediaData.push({
                                    type: 'image',
                                    url: imageUrl,
                                    index: index
                                });
                            });
                        }

                        if (mediaData.length > 0) {
                            console.log('✅ Alternative API successful');
                            return await this.downloadMediaFiles(mediaData, 'alternative_api');
                        }
                    }
                } catch (error) {
                    console.log(`Alternative API endpoint failed: ${error.message}`);
                    continue;
                }
            }

            throw new Error('All alternative API endpoints failed');
            
        } catch (error) {
            throw new Error(`Alternative API failed: ${error.message}`);
        }
    }

    // Placeholder for direct method
    async downloadWithDirectMethod(url) {
        throw new Error('Direct method not implemented yet');
    }

    // Extract video URL from API result
    extractVideoUrl(result) {
        const possibleUrls = [
            result.video?.playAddr?.[0],
            result.video?.downloadAddr?.[0],
            result.video1,
            result.video2,
            result.play,
            result.wmplay,
            result.video?.play,
            result.video?.wmplay
        ];

        for (const url of possibleUrls) {
            if (url && typeof url === 'string') {
                return url;
            }
        }

        return null;
    }

    // Extract video ID from TikTok URL
    extractVideoId(url) {
        const patterns = [
            /\/video\/(\d+)/,
            /\/v\/(\d+)/,
            /tiktok\.com\/.*\/video\/(\d+)/,
            /vm\.tiktok\.com\/(\w+)/,
            /vt\.tiktok\.com\/(\w+)/
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) {
                return match[1];
            }
        }

        return null;
    }

    // Download multiple media files
    async downloadMediaFiles(mediaData, method = 'unknown') {
        const downloadedFiles = [];

        for (const media of mediaData) {
            try {
                console.log(`⬇️ Downloading ${media.type} ${media.index + 1}/${mediaData.length}...`);
                
                const extension = media.type === 'video' ? 'mp4' : 'jpg';
                const filePath = await this.downloadSingleFile(
                    media.url, 
                    `${method}_${media.type}_${media.index}.${extension}`
                );

                downloadedFiles.push({
                    path: filePath,
                    type: media.type,
                    index: media.index
                });

            } catch (error) {
                console.error(`Failed to download ${media.type} ${media.index}: ${error.message}`);
            }
        }

        if (downloadedFiles.length === 0) {
            throw new Error('No media files were downloaded successfully');
        }

        return downloadedFiles;
    }

    // Download single file (video or image)
    async downloadSingleFile(url, filename) {
        try {
            const response = await axios.get(url, {
                responseType: 'stream',
                timeout: 60000,
                maxRedirects: 5,
                headers: {
                    'User-Agent': this.getRandomUserAgent(),
                    'Referer': 'https://www.tiktok.com/',
                    'Accept': '*/*',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Connection': 'keep-alive'
                }
            });

            if (response.status >= 400) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const tempPath = path.join(__dirname, 'temp', filename);
            
            // Ensure temp directory exists
            if (!fs.existsSync(path.dirname(tempPath))) {
                fs.mkdirSync(path.dirname(tempPath), { recursive: true });
            }

            const writer = fs.createWriteStream(tempPath);
            response.data.pipe(writer);

            return new Promise((resolve, reject) => {
                writer.on('finish', () => {
                    try {
                        const stats = fs.statSync(tempPath);
                        if (stats.size === 0) {
                            fs.unlinkSync(tempPath);
                            reject(new Error('Downloaded file is empty'));
                            return;
                        }
                        console.log(`✅ File downloaded: ${filename} (${stats.size} bytes)`);
                        resolve(tempPath);
                    } catch (error) {
                        reject(new Error(`Failed to verify downloaded file: ${error.message}`));
                    }
                });

                writer.on('error', (error) => {
                    try {
                        fs.unlinkSync(tempPath);
                    } catch (e) {}
                    reject(new Error(`Download failed: ${error.message}`));
                });
            });

        } catch (error) {
            throw new Error(`Download failed: ${error.message}`);
        }
    }

    // Generate watermark filter for videos
    generateWatermarkFilter(settings) {
        const { text, fontSize = 24, color = 'white', opacity = 0.48, position = 'bottom-right' } = settings;
        
        const positions = {
            'top-left': 'x=50:y=50',
            'top-right': 'x=W-tw-50:y=50',
            'bottom-left': 'x=50:y=H-th-50',
            'bottom-right': 'x=W-tw-50:y=H-th-50',
            'center': 'x=(W-tw)/2:y=(H-th)/2'
        };
        
        const pos = positions[position] || positions['bottom-right'];
        
        return `drawtext=text='${text}':fontsize=${fontSize}:fontcolor=${color}@${opacity}:${pos}:shadowcolor=black@0.5:shadowx=2:shadowy=2`;
    }

    // Add watermark to video
    async addWatermarkToVideo(inputPath, outputPath, watermarkSettings) {
        return new Promise((resolve, reject) => {
            if (!fs.existsSync(inputPath)) {
                reject(new Error('Input video file not found'));
                return;
            }

            const filter = this.generateWatermarkFilter(watermarkSettings);
            
            ffmpeg(inputPath)
                .videoFilter(filter)
                .outputOptions([
                    '-c:v libx264',
                    '-preset fast',
                    '-crf 23',
                    '-c:a copy',
                    '-avoid_negative_ts make_zero'
                ])
                .output(outputPath)
                .on('progress', (progress) => {
                    if (progress.percent) {
                        console.log(`📊 Video processing: ${Math.round(progress.percent)}%`);
                    }
                })
                .on('end', () => {
                    resolve(outputPath);
                })
                .on('error', (err) => {
                    reject(new Error(`FFmpeg error: ${err.message}`));
                })
                .run();
        });
    }

    // Add watermark to image using Sharp
    async addWatermarkToImage(inputPath, outputPath, watermarkSettings) {
        try {
            const { text, fontSize = 24, color = 'white', opacity = 0.48, position = 'bottom-right' } = watermarkSettings;
            
            const image = sharp(inputPath);
            const metadata = await image.metadata();
            
            // Calculate watermark position
            const textWidth = text.length * (fontSize * 0.6);
            const textHeight = fontSize * 1.2;
            
            let x, y;
            switch (position) {
                case 'top-left':
                    x = 50;
                    y = 50;
                    break;
                case 'top-right':
                    x = metadata.width - textWidth - 50;
                    y = 50;
                    break;
                case 'bottom-left':
                    x = 50;
                    y = metadata.height - textHeight - 50;
                    break;
                case 'center':
                    x = (metadata.width - textWidth) / 2;
                    y = (metadata.height - textHeight) / 2;
                    break;
                default: // bottom-right
                    x = metadata.width - textWidth - 50;
                    y = metadata.height - textHeight - 50;
            }

            // Create watermark SVG
            const watermarkSvg = `
                <svg width="${metadata.width}" height="${metadata.height}">
                    <text x="${x}" y="${y}" 
                          font-family="Arial" 
                          font-size="${fontSize}" 
                          fill="${color}" 
                          fill-opacity="${opacity}"
                          stroke="black" 
                          stroke-width="1" 
                          stroke-opacity="0.5">
                        ${text}
                    </text>
                </svg>
            `;

            await image
                .composite([{
                    input: Buffer.from(watermarkSvg),
                    blend: 'over'
                }])
                .jpeg({ quality: 90 })
                .toFile(outputPath);

            return outputPath;

        } catch (error) {
            throw new Error(`Image watermark error: ${error.message}`);
        }
    }

    // Process all downloaded media files
    async processMediaFiles(mediaFiles, watermarkSettings) {
        const processedFiles = [];

        for (const mediaFile of mediaFiles) {
            try {
                const outputPath = path.join(
                    path.dirname(mediaFile.path), 
                    `watermarked_${path.basename(mediaFile.path)}`
                );

                console.log(`🎨 Processing ${mediaFile.type} ${mediaFile.index + 1}...`);

                if (mediaFile.type === 'video') {
                    await this.addWatermarkToVideo(mediaFile.path, outputPath, watermarkSettings);
                } else if (mediaFile.type === 'image') {
                    await this.addWatermarkToImage(mediaFile.path, outputPath, watermarkSettings);
                }

                processedFiles.push({
                    path: outputPath,
                    type: mediaFile.type,
                    index: mediaFile.index,
                    originalPath: mediaFile.path
                });

            } catch (error) {
                console.error(`Failed to process ${mediaFile.type} ${mediaFile.index}: ${error.message}`);
            }
        }

        return processedFiles;
    }

    // Enhanced wmtiktok handler with multi-media support
    async handleWmTikTok(message, args) {
        try {
            if (!args[0]) {
                return message.reply('Please provide a TikTok URL\nUsage: wmtiktok <tiktok_url>\n\n✨ Supports:\n• Single videos\n• Image carousels\n• Multiple media posts');
            }

            const url = args[0];
            const userId = message.from || message.chat?.id || 'default';
            const userSettings = this.watermarkSettings.get(userId) || this.defaultWatermark;

            await message.reply('⏳ Downloading TikTok media...');

            try {
                // Download all media files
                const mediaFiles = await this.downloadTikTokMedia(url, Boolean(this.tiktokCookie));
                
                await message.reply(`🎨 Processing ${mediaFiles.length} media file(s)...`);
                
                // Process all files with watermarks
                const processedFiles = await this.processMediaFiles(mediaFiles, userSettings);

                if (processedFiles.length === 0) {
                    throw new Error('No files were processed successfully');
                }

                // Send all processed files
                for (const file of processedFiles) {
                    try {
                        const fileBuffer = fs.readFileSync(file.path);
                        const mimetype = file.type === 'video' ? 'video/mp4' : 'image/jpeg';
                        const caption = processedFiles.length > 1 ? 
                            `${file.type.toUpperCase()} ${file.index + 1}/${processedFiles.length}` : 
                            `✅ Watermarked ${file.type}`;

                        await message.reply(fileBuffer, { 
                            mimetype: mimetype,
                            caption: caption
                        });
                    } catch (sendError) {
                        console.error(`Failed to send ${file.type} ${file.index}:`, sendError.message);
                    }
                }

                // Send summary
                const summary = `✅ Processed ${processedFiles.length} file(s)\n` +
                              `🎨 Style: ${userSettings.effect || 'default'}\n` +
                              `🍪 Cookie status: ${this.getCookieStatus()}`;
                await message.reply(summary);

                // Clean up temp files
                [...mediaFiles, ...processedFiles].forEach(file => {
                    try {
                        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
                        if (file.originalPath && fs.existsSync(file.originalPath)) {
                            fs.unlinkSync(file.originalPath);
                        }
                    } catch (e) {}
                });

            } catch (downloadError) {
                let errorMessage = '❌ Processing failed: ';
                
                if (downloadError.message.includes('403')) {
                    errorMessage += 'TikTok blocked the request. Try:\n• Using a different URL\n• Setting a TikTok cookie\n• Waiting before trying again';
                } else if (downloadError.message.includes('timeout')) {
                    errorMessage += 'Download timed out. Try again later.';
                } else if (downloadError.message.includes('No media')) {
                    errorMessage += 'Could not find media in TikTok post. The content might be private or deleted.';
                } else if (downloadError.message.includes('ffmpeg') || downloadError.message.includes('FFmpeg')) {
                    errorMessage += 'FFmpeg is not installed. Please install FFmpeg.';
                } else if (downloadError.message.includes('sharp') || downloadError.message.includes('Sharp')) {
                    errorMessage += 'Sharp is not installed. Please install: npm install sharp';
                } else {
                    errorMessage += downloadError.message;
                }
                
                await message.reply(errorMessage);
            }

        } catch (error) {
            console.error('Error in wmtiktok command:', error);
            await message.reply(`❌ Unexpected error: ${error.message}`);
        }
    }

    async handleSetCookie(message, args) {
        try {
            if (!args[0]) {
                return message.reply(`🍪 Set TikTok Cookie for Enhanced Download Success:

**How to get your TikTok cookie:**
1. Install Cookie-Editor browser extension
2. Login to TikTok.com
3. Open Cookie-Editor on TikTok
4. Copy all cookies
5. Use: setcookie <your_cookie_string>

**Benefits:**
• Bypasses 403 errors
• Access to higher quality media
• Better download success rate
• Support for private/restricted content`);
            }

            const cookie = args.join(' ');
            this.setTikTokCookie(cookie);
            
            await message.reply('✅ TikTok cookie set successfully!\n🔓 Enhanced download features enabled for all media types.');

        } catch (error) {
            console.error('Error in setcookie command:', error);
            await message.reply(`❌ Error: ${error.message}`);
        }
    }

    async handleCookieStatus(message, args) {
        try {
            const status = this.getCookieStatus();
            const features = this.tiktokCookie ? 
                '✅ Enhanced downloads enabled\n✅ Multi-media support active\n✅ Better 403 error bypass\n✅ Higher success rate' : 
                '❌ Basic downloads only\n❌ May encounter 403 errors\n❌ Limited success rate';
            
            await message.reply(`🍪 **Cookie Status:** ${status}\n\n${features}`);

        } catch (error) {
            console.error('Error in cookiestatus command:', error);
            await message.reply(`❌ Error: ${error.message}`);
        }
    }

    async handleSetWatermark(message, args) {
        try {
            const userId = message.from || message.chat?.id || 'default';
            
            if (!args[0]) {
                const stylesList = Object.keys(this.styles).map(style => `• ${style}`).join('\n');
                return message.reply(`🎨 Available watermark styles:\n${stylesList}\n\nUsage: setwatermark <style> [text]\nExample: setwatermark neon MyName\n\n✨ Works on both videos and images!`);
            }

            const styleName = args[0].toLowerCase();
            const customText = args.slice(1).join(' ');

            if (!this.styles[styleName]) {
                return message.reply('❌ Invalid style. Use setwatermark without arguments to see available styles.');
            }

            const newSettings = { ...this.styles[styleName] };
            if (customText) {
                newSettings.text = customText;
            }

            this.watermarkSettings.set(userId, newSettings);
            
            await message.reply(`✅ Watermark set to "${styleName}" style${customText ? ` with text: "${customText}"` : ''}\n🎨 Will be applied to all media types (videos & images)`);

        } catch (error) {
            console.error('Error in setwatermark command:', error);
            await message.reply(`❌ Error: ${error.message}`);
        }
    }

    // Initialize plugin
    init(bot) {
        bot.command('wmtiktok', (message, args) => this.handleWmTikTok(message, args));
        bot.command('setwatermark', (message, args) => this.handleSetWatermark(message, args));
        bot.command('setcookie', (message, args) => this.handleSetCookie(message, args));
        bot.command('cookiestatus', (message, args) => this.handleCookieStatus(message, args));
        
        console.log('🔧 Enhanced TikTok Plugin initialized with multi-media support');
        console.log('🎬 Supports: Videos, Images, Carousels, Multi-media posts');
        console.log('🛡️ Multiple download fallback methods enabled');
        console.log('🍪 Cookie support available for better success rates');
        console.log('🎨 Watermarking works on all media types');
    }
}

module.exports = TikTokWatermarkPlugin;