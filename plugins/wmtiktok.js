const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const axios = require('axios');
const tiktokdl = require('@tobyg74/tiktok-api-dl');
const { promisify } = require('util');
const { exec } = require('child_process');

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

        // Check FFmpeg installation on initialization
        this.checkFFmpeg();
    }

    // Check if FFmpeg is installed
    async checkFFmpeg() {
        try {
            await promisify(exec)('ffmpeg -version');
            console.log('✅ FFmpeg is installed and working');
        } catch (error) {
            console.error('❌ FFmpeg not found! Please install FFmpeg:');
            console.error('Ubuntu/Debian: sudo apt install ffmpeg');
            console.error('macOS: brew install ffmpeg');
            console.error('Windows: Download from https://ffmpeg.org/');
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

    // Enhanced download with multiple fallback methods
    async downloadTikTokVideo(url, useAdvancedFeatures = false) {
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

    // Method 1: Enhanced Toby API with better error handling
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
            
            let videoUrl = this.extractVideoUrl(result.result);
            
            if (!videoUrl) {
                throw new Error('No video URL found in API response');
            }
            
            console.log('📱 Video info:', {
                title: result.result.desc || result.result.title || 'No title',
                author: result.result.author?.nickname || result.result.author?.username || 'Unknown'
            });
            
            return await this.downloadVideoFile(videoUrl, 'toby_api');
            
        } catch (error) {
            throw new Error(`Toby API failed: ${error.message}`);
        }
    }

    // Method 2: Alternative API approach
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
                        const videoUrl = response.data.data.play || response.data.data.wmplay;
                        if (videoUrl) {
                            console.log('✅ Alternative API successful');
                            return await this.downloadVideoFile(videoUrl, 'alternative_api');
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

    // Method 3: Direct download method (placeholder)
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

    // Enhanced video file download with better error handling
    async downloadVideoFile(videoUrl, method = 'unknown') {
        try {
            console.log(`⬇️ Downloading video file using ${method}...`);
            
            const response = await axios.get(videoUrl, {
                responseType: 'stream',
                timeout: 60000,
                maxRedirects: 5,
                headers: {
                    'User-Agent': this.getRandomUserAgent(),
                    'Referer': 'https://www.tiktok.com/',
                    'Accept': 'video/webm,video/ogg,video/*;q=0.9,application/ogg;q=0.7,audio/*;q=0.6,*/*;q=0.5',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1'
                },
                validateStatus: (status) => {
                    return status < 400;
                }
            });

            if (response.status === 403) {
                throw new Error('Access forbidden (403) - TikTok blocked the request');
            }

            if (response.status >= 400) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const tempPath = path.join(__dirname, 'temp', `tiktok_${Date.now()}_${method}.mp4`);
            
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
                        console.log(`✅ Video downloaded successfully (${stats.size} bytes)`);
                        resolve(tempPath);
                    } catch (error) {
                        reject(new Error(`Failed to verify downloaded file: ${error.message}`));
                    }
                });

                writer.on('error', (error) => {
                    try {
                        fs.unlinkSync(tempPath);
                    } catch (e) {
                        // Ignore cleanup errors
                    }
                    reject(new Error(`Download failed: ${error.message}`));
                });

                response.data.on('error', (error) => {
                    writer.destroy();
                    try {
                        fs.unlinkSync(tempPath);
                    } catch (e) {
                        // Ignore cleanup errors
                    }
                    reject(new Error(`Stream error: ${error.message}`));
                });
            });

        } catch (error) {
            if (error.code === 'ECONNABORTED') {
                throw new Error('Download timeout - TikTok server is slow');
            } else if (error.code === 'ENOTFOUND') {
                throw new Error('Network error - check your internet connection');
            } else if (error.response?.status === 403) {
                throw new Error('Access forbidden - TikTok blocked the request. Try using a cookie.');
            } else {
                throw new Error(`Download failed: ${error.message}`);
            }
        }
    }

    // Simplified watermark filter for Linux compatibility
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
        
        // Simplified filter that works across platforms
        return `drawtext=text='${text}':fontsize=${fontSize}:fontcolor=${color}@${opacity}:${pos}:shadowcolor=black@0.5:shadowx=2:shadowy=2`;
    }

    // Add watermark to video with better error handling
    async addWatermarkToVideo(inputPath, outputPath, watermarkSettings) {
        return new Promise((resolve, reject) => {
            // Check if input file exists
            if (!fs.existsSync(inputPath)) {
                reject(new Error('Input video file not found'));
                return;
            }

            const filter = this.generateWatermarkFilter(watermarkSettings);
            
            console.log('🎨 Applying watermark filter:', filter);
            
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
                .on('start', (commandLine) => {
                    console.log('🎬 FFmpeg command:', commandLine);
                })
                .on('progress', (progress) => {
                    if (progress.percent) {
                        console.log(`📊 Processing: ${Math.round(progress.percent)}%`);
                    }
                })
                .on('end', () => {
                    console.log('✅ Watermark added successfully');
                    resolve(outputPath);
                })
                .on('error', (err) => {
                    console.error('❌ Error adding watermark:', err.message);
                    reject(new Error(`FFmpeg error: ${err.message}`));
                })
                .run();
        });
    }

    // Enhanced wmtiktok handler with better error messages
    async handleWmTikTok(message, args) {
        try {
            if (!args[0]) {
                return message.reply('Please provide a TikTok URL\nUsage: wmtiktok <tiktok_url>');
            }

            const url = args[0];
            const userId = message.from || message.chat?.id || 'default';
            const userSettings = this.watermarkSettings.get(userId) || this.defaultWatermark;

            await message.reply('⏳ Downloading TikTok video...');

            try {
                // Download video with enhanced error handling
                const videoPath = await this.downloadTikTokVideo(url, Boolean(this.tiktokCookie));
                
                await message.reply('🎨 Adding watermark...');
                
                // Add watermark
                const outputPath = path.join(__dirname, 'temp', `watermarked_${Date.now()}.mp4`);
                await this.addWatermarkToVideo(videoPath, outputPath, userSettings);

                // Send the watermarked video
                const videoBuffer = fs.readFileSync(outputPath);
                await message.reply(videoBuffer, { 
                    mimetype: 'video/mp4',
                    caption: `✅ Watermarked with style: ${userSettings.effect || 'default'}\n🍪 Cookie status: ${this.getCookieStatus()}`
                });

                // Clean up temp files
                if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
                if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

            } catch (downloadError) {
                let errorMessage = '❌ Download failed: ';
                
                if (downloadError.message.includes('403')) {
                    errorMessage += 'TikTok blocked the request. Try:\n• Using a different video URL\n• Setting a TikTok cookie with "setcookie" command\n• Waiting a few minutes before trying again';
                } else if (downloadError.message.includes('timeout')) {
                    errorMessage += 'Download timed out. The video might be too large or TikTok servers are slow. Try again later.';
                } else if (downloadError.message.includes('No video URL')) {
                    errorMessage += 'Could not find video in TikTok response. The video might be private or deleted.';
                } else if (downloadError.message.includes('ffmpeg') || downloadError.message.includes('FFmpeg')) {
                    errorMessage += 'FFmpeg is not installed. Please install FFmpeg:\n• Ubuntu/Debian: sudo apt install ffmpeg\n• macOS: brew install ffmpeg';
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
• Access to higher quality videos
• Better download success rate`);
            }

            const cookie = args.join(' ');
            this.setTikTokCookie(cookie);
            
            await message.reply('✅ TikTok cookie set successfully!\n🔓 Enhanced download features enabled.');

        } catch (error) {
            console.error('Error in setcookie command:', error);
            await message.reply(`❌ Error: ${error.message}`);
        }
    }

    async handleCookieStatus(message, args) {
        try {
            const status = this.getCookieStatus();
            const features = this.tiktokCookie ? 
                '✅ Enhanced downloads enabled\n✅ Better 403 error bypass\n✅ Higher success rate' : 
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
                return message.reply(`🎨 Available watermark styles:\n${stylesList}\n\nUsage: setwatermark <style> [text]\nExample: setwatermark neon MyName`);
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
            
            await message.reply(`✅ Watermark set to "${styleName}" style${customText ? ` with text: "${customText}"` : ''}`);

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
        
        console.log('🔧 Enhanced TikTok Plugin initialized with fixes');
        console.log('🛡️ Multiple download fallback methods enabled');
        console.log('🍪 Cookie support available for better success rates');
        console.log('🎬 FFmpeg compatibility improved');
    }
}

module.exports = TikTokWatermarkPlugin;