const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const axios = require("axios");
const tiktokdl = require("@tobyg74/tiktok-api-dl");
const { promisify } = require("util");
const { exec } = require("child_process");

class TikTokWatermarkPlugin {
    constructor() {
        this.watermarkSettings = new Map();
        this.tiktokCookie = null;
        this.defaultWatermark = {
            text: "Samuel",
            font: "Arial",
            fontSize: 24,
            color: "white",
            opacity: 0.48,
            position: "bottom-right",
            rotation: -6,
            effect: "glow",
            tilt: "single"
        };
        
        this.userAgents = [
            "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Android 13; Mobile; rv:109.0) Gecko/117.0 Firefox/117.0",
            "TikTok 26.2.0 rv:262018 (iPhone; iOS 16.5; en_US) Cronet"
        ];

        // Removed built-in styles - only load from styles directory
        this.styleModules = new Map();
        this.dynamicStyles = new Map();
        
        this.loadStyleModules();
        this.checkFFmpeg();
    }

    loadStyleModules() {
        try {
            const stylesDir = path.join(__dirname, "../plugins/styles");
            if (!fs.existsSync(stylesDir)) {
                console.warn("⚠️ Styles directory not found:", stylesDir);
                console.log("💡 Please create the styles directory and add style modules");
                return;
            }

            const styleFiles = fs.readdirSync(stylesDir)
                .filter(file => file.endsWith(".js"))
                .map(file => file.replace(".js", ""));

            console.log("🎨 Loading style modules:", styleFiles);

            for (const styleName of styleFiles) {
                try {
                    const stylePath = path.join(stylesDir, `${styleName}.js`);
                    const StyleClass = require(stylePath);
                    const styleInstance = new StyleClass();
                    
                    this.styleModules.set(styleName, styleInstance);

                    // Load preset styles from the module
                    if (typeof styleInstance.getPresetStyles === 'function') {
                        const presets = styleInstance.getPresetStyles();
                        for (const [presetName, presetConfig] of Object.entries(presets)) {
                            const fullStyleName = `${styleName}_${presetName}`;
                            this.dynamicStyles.set(fullStyleName, {
                                ...presetConfig,
                                module: styleName,
                                styleClass: styleInstance,
                                originalName: presetName
                            });
                        }
                    }

                    console.log(`✅ Loaded style module: ${styleName}`);
                } catch (error) {
                    console.error(`❌ Failed to load style module ${styleName}:`, error.message);
                }
            }

            console.log(`🎨 Total dynamic styles loaded: ${this.dynamicStyles.size}`);
        } catch (error) {
            console.error("❌ Error loading style modules:", error.message);
            console.log("💡 Make sure the styles directory exists and contains valid style modules");
        }
    }

    getAllStyles() {
        const allStyles = new Map();
        
        // Only return styles from the styles directory
        for (const [styleName, styleConfig] of this.dynamicStyles) {
            allStyles.set(styleName, styleConfig);
        }
        
        return allStyles;
    }

    getStyleByName(styleName) {
        return this.dynamicStyles.get(styleName) || null;
    }

    async checkFFmpeg() {
        try {
            await promisify(exec)("ffmpeg -version");
            console.log("✅ FFmpeg is installed and working");
        } catch (error) {
            console.error("❌ FFmpeg not found! Please install FFmpeg:");
            console.error("Ubuntu/Debian: sudo apt install ffmpeg");
            console.error("macOS: brew install ffmpeg");
            console.error("Windows: Download from https://ffmpeg.org/");
        }
    }

    getRandomUserAgent() {
        return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
    }

    setTikTokCookie(cookie) {
        this.tiktokCookie = cookie;
        console.log("✅ TikTok cookie set successfully");
    }

    getCookieStatus() {
        return this.tiktokCookie ? "Cookie is set" : "No cookie set";
    }

    async downloadTikTokVideo(url, useAuth = false) {
        const methods = [
            () => this.downloadWithTobyAPI(url, useAuth),
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

    async downloadWithTobyAPI(url, useAuth = false) {
        try {
            console.log("📥 Using Toby API...");
            const options = { version: "v3" };
            let result;

            if (this.tiktokCookie && useAuth) {
                options.cookie = this.tiktokCookie;
                console.log("🍪 Using TikTok cookie");
            }

            try {
                result = await tiktokdl.Downloader(url, options);
            } catch (error) {
                console.log("🔄 Retrying with v1 API...");
                options.version = "v1";
                result = await tiktokdl.Downloader(url, options);
            }

            if (!result.status || result.status !== "success") {
                throw new Error(result.message || "API returned unsuccessful status");
            }

            let videoUrl = this.extractVideoUrl(result.result);
            if (!videoUrl) {
                throw new Error("No video URL found in API response");
            }

            console.log("📱 Video info:", {
                title: result.result.desc || result.result.title || "No title",
                author: result.result.author?.nickname || result.result.author?.username || "Unknown"
            });

            return await this.downloadVideoFile(videoUrl, "toby_api");
        } catch (error) {
            throw new Error(`Toby API failed: ${error.message}`);
        }
    }

    async downloadWithAlternativeAPI(url) {
        try {
            console.log("📥 Using alternative API...");
            const videoId = this.extractVideoId(url);
            if (!videoId) {
                throw new Error("Could not extract video ID from URL");
            }

            const apiUrls = [
                `https://tikwm.com/api/?url=${encodeURIComponent(url)}`,
                `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`
            ];

            for (const apiUrl of apiUrls) {
                try {
                    const response = await axios.get(apiUrl, {
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
                            console.log("✅ Alternative API successful");
                            return await this.downloadVideoFile(videoUrl, "alternative_api");
                        }
                    }
                } catch (error) {
                    console.log(`Alternative API endpoint failed: ${error.message}`);
                    continue;
                }
            }

            throw new Error("All alternative API endpoints failed");
        } catch (error) {
            throw new Error(`Alternative API failed: ${error.message}`);
        }
    }

    async downloadWithDirectMethod(url) {
        throw new Error("Direct method not implemented yet");
    }

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

    async downloadVideoFile(url, method = "unknown") {
        try {
            console.log(`⬇️ Downloading video file using ${method}...`);
            
            const response = await axios.get(url, {
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
                validateStatus: status => status < 400
            });

            if (response.status === 403) {
                throw new Error("Access forbidden (403) - TikTok blocked the request");
            }

            if (response.status >= 400) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const outputPath = path.join(__dirname, "temp", `tiktok_${Date.now()}_${method}.mp4`);
            
            if (!fs.existsSync(path.dirname(outputPath))) {
                fs.mkdirSync(path.dirname(outputPath), { recursive: true });
            }

            const writer = fs.createWriteStream(outputPath);
            response.data.pipe(writer);

            return new Promise((resolve, reject) => {
                writer.on('finish', () => {
                    try {
                        const stats = fs.statSync(outputPath);
                        if (stats.size === 0) {
                            fs.unlinkSync(outputPath);
                            return reject(new Error("Downloaded file is empty"));
                        }
                        console.log(`✅ Video downloaded successfully (${stats.size} bytes)`);
                        resolve(outputPath);
                    } catch (error) {
                        reject(new Error(`Failed to verify downloaded file: ${error.message}`));
                    }
                });

                writer.on('error', (error) => {
                    try {
                        fs.unlinkSync(outputPath);
                    } catch (e) {}
                    reject(new Error(`Download failed: ${error.message}`));
                });

                response.data.on('error', (error) => {
                    writer.destroy();
                    try {
                        fs.unlinkSync(outputPath);
                    } catch (e) {}
                    reject(new Error(`Stream error: ${error.message}`));
                });
            });
        } catch (error) {
            if (error.code === 'ECONNABORTED') {
                throw new Error("Download timeout - TikTok server is slow");
            } else if (error.code === 'ENOTFOUND') {
                throw new Error("Network error - check your internet connection");
            } else if (error.response?.status === 403) {
                throw new Error("Access forbidden - TikTok blocked the request. Try using a cookie.");
            } else {
                throw new Error(`Download failed: ${error.message}`);
            }
        }
    }

    generateWatermarkFilter(settings) {
        const {
            text,
            fontSize = 24,
            font = "Arial",
            fontFamily,
            size,
            color = "white",
            textColor,
            opacity = 0.48,
            position = "bottom-right",
            rotation = 0,
            effect = "none",
            glassColor,
            module,
            styleClass,
            isBuiltIn = false
        } = settings;

        // Use style module's custom filter generation if available
        if (!isBuiltIn && styleClass && typeof styleClass.generateFilter === 'function') {
            try {
                console.log(`🎨 Using ${module} module filter generation`);
                return styleClass.generateFilter(settings);
            } catch (error) {
                console.warn(`⚠️ ${module} filter generation failed, falling back to default:`, error.message);
            }
        }

        // Default filter generation
        const positions = {
            "top-left": "x=50:y=50",
            "top-right": "x=W-tw-50:y=50",
            "bottom-left": "x=50:y=H-th-50",
            "bottom-right": "x=W-tw-50:y=H-th-50",
            "center": "x=(W-tw)/2:y=(H-th)/2"
        };

        let filter = `drawtext=text='${text}':fontsize=${fontSize || size || 24}:fontcolor=${color || textColor || 'white'}@${opacity}:${positions[position] || positions['bottom-right']}`;
        
        // Add shadow for better visibility
        filter += ":shadowcolor=black@0.5:shadowx=2:shadowy=2";
        
        // Add rotation if specified
        if (rotation && rotation !== 0) {
            filter += ":angle=" + (rotation * Math.PI / 180);
        }

        console.log(`🎨 Generated filter:`, filter);
        return filter;
    }

    async addWatermarkToVideo(inputPath, outputPath, settings) {
        return new Promise((resolve, reject) => {
            if (!fs.existsSync(inputPath)) {
                return reject(new Error("Input video file not found"));
            }

            const filter = this.generateWatermarkFilter(settings);
            console.log("🎨 Applying watermark filter:", filter);

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
                .on('error', (error) => {
                    console.error('❌ Error adding watermark:', error.message);
                    reject(new Error(`FFmpeg error: ${error.message}`));
                })
                .run();
        });
    }

    async handleWmTikTok(message, args) {
        try {
            if (!args[0]) {
                const allStyles = this.getAllStyles();
                const totalStyles = allStyles.size;
                const moduleCount = this.styleModules.size;
                
                return message.reply(`Please provide a TikTok URL\nUsage: wmtiktok <tiktok_url>\n\n📊 Available styles: ${totalStyles} total from ${moduleCount} modules\n\n💡 Use the inline menu for easier access to styles and settings.`);
            }

            const tiktokUrl = args[0];
            const userId = message.from || message.chat?.id || "default";
            let watermarkSettings = this.watermarkSettings.get(userId) || this.defaultWatermark;

            // Apply style from styles directory if set
            let finalSettings = { ...watermarkSettings };
            if (watermarkSettings.fullStyleName) {
                const styleConfig = this.dynamicStyles.get(watermarkSettings.fullStyleName);
                if (styleConfig) {
                    Object.assign(finalSettings, styleConfig);
                }
            }

            await message.reply("⏳ Downloading TikTok video...");

            try {
                const downloadedPath = await this.downloadTikTokVideo(tiktokUrl, Boolean(this.tiktokCookie));
                
                const styleName = finalSettings.module ? 
                    `${finalSettings.originalName || 'custom'} (${finalSettings.module})` : 
                    finalSettings.effect || 'default';
                
                await message.reply(`🎨 Adding ${styleName} watermark...`);

                const outputPath = path.join(__dirname, "temp", `watermarked_${Date.now()}.mp4`);
                await this.addWatermarkToVideo(downloadedPath, outputPath, finalSettings);

                const videoBuffer = fs.readFileSync(outputPath);
                await message.reply(videoBuffer, {
                    mimetype: 'video/mp4',
                    caption: `✅ Watermarked with: ${styleName}\n🎨 Styles available: ${this.getAllStyles().size} total from ${this.styleModules.size} modules\n🍪 Cookie status: ${this.getCookieStatus()}`
                });

                // Cleanup
                if (fs.existsSync(downloadedPath)) fs.unlinkSync(downloadedPath);
                if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

            } catch (error) {
                let errorMessage = "❌ Download failed: ";
                
                if (error.message.includes("403")) {
                    errorMessage += 'TikTok blocked the request. Try:\n• Using a different video URL\n• Setting a TikTok cookie with "setcookie" command\n• Waiting a few minutes before trying again';
                } else if (error.message.includes("timeout")) {
                    errorMessage += "Download timed out. The video might be too large or TikTok servers are slow. Try again later.";
                } else if (error.message.includes("No video URL")) {
                    errorMessage += "Could not find video in TikTok response. The video might be private or deleted.";
                } else if (error.message.includes("ffmpeg") || error.message.includes("FFmpeg")) {
                    errorMessage += "FFmpeg is not installed. Please install FFmpeg:\n• Ubuntu/Debian: sudo apt install ffmpeg\n• macOS: brew install ffmpeg";
                } else {
                    errorMessage += error.message;
                }
                
                await message.reply(errorMessage);
            }
        } catch (error) {
            console.error("Error in wmtiktok command:", error);
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

            const cookie = args.join(" ");
            this.setTikTokCookie(cookie);
            await message.reply("✅ TikTok cookie set successfully!\n🔓 Enhanced download features enabled.");
        } catch (error) {
            console.error("Error in setcookie command:", error);
            await message.reply(`❌ Error: ${error.message}`);
        }
    }

    async handleCookieStatus(message, args) {
        try {
            const status = this.getCookieStatus();
            const features = this.tiktokCookie ? 
                "✅ Enhanced downloads enabled\n✅ Better 403 error bypass\n✅ Higher success rate" :
                "❌ Basic downloads only\n❌ May encounter 403 errors\n❌ Limited success rate";
            
            await message.reply(`🍪 **Cookie Status:** ${status}\n\n${features}`);
        } catch (error) {
            console.error("Error in cookiestatus command:", error);
            await message.reply(`❌ Error: ${error.message}`);
        }
    }

    async handleSetWatermark(message, args) {
        try {
            const userId = message.from || message.chat?.id || "default";
            
            if (!args[0]) {
                const allStyles = this.getAllStyles();
                const styleNames = Array.from(allStyles.keys());
                
                let response = `🎨 Available watermark styles (${allStyles.size} total from ${this.styleModules.size} modules):\n\n`;
                
                // Group by module
                const moduleStyles = {};
                for (const [styleName, styleConfig] of allStyles) {
                    if (!moduleStyles[styleConfig.module]) {
                        moduleStyles[styleConfig.module] = [];
                    }
                    moduleStyles[styleConfig.module].push(styleName);
                }
                
                for (const [module, styles] of Object.entries(moduleStyles)) {
                    response += `**${module.toUpperCase()} Module:**\n`;
                    response += styles.map(style => `• ${style}`).join('\n') + '\n\n';
                }
                
                response += 'Usage: setwatermark <style> [text]\nExample: setwatermark neon_glow MyName';
                
                return message.reply(response);
            }

            const styleName = args[0].toLowerCase();
            const customText = args.slice(1).join(" ");
            
            let selectedStyle = null;
            
            // Look for the style in dynamic styles only
            if (this.dynamicStyles.has(styleName)) {
                selectedStyle = { ...this.dynamicStyles.get(styleName) };
            }

            if (!selectedStyle) {
                return message.reply("❌ Invalid style. Use setwatermark without arguments to see available styles.");
            }

            // Set custom text if provided
            if (customText) {
                selectedStyle.text = customText;
            }

            selectedStyle.fullStyleName = styleName;
            this.watermarkSettings.set(userId, selectedStyle);

            const moduleInfo = `${selectedStyle.module} module`;
            await message.reply(`✅ Watermark set to "${selectedStyle.originalName || styleName}" style from ${moduleInfo}${customText ? ` with text: "${customText}"` : ""}`);
        } catch (error) {
            console.error("Error in setwatermark command:", error);
            await message.reply(`❌ Error: ${error.message}`);
        }
    }

    init(bot) {
        bot.command("wmtiktok", (message, args) => this.handleWmTikTok(message, args));
        bot.command("setwatermark", (message, args) => this.handleSetWatermark(message, args));
        bot.command("setcookie", (message, args) => this.handleSetCookie(message, args));
        bot.command("cookiestatus", (message, args) => this.handleCookieStatus(message, args));

        const totalStyles = this.getAllStyles().size;
        const moduleCount = this.styleModules.size;

        console.log("🔧 TikTok Plugin initialized with styles directory support only");
        console.log(`📊 Style stats: ${totalStyles} total from ${moduleCount} modules`);
        
        if (this.styleModules.size > 0) {
            console.log(`📦 Loaded modules: ${Array.from(this.styleModules.keys()).join(", ")}`);
        } else {
            console.log("⚠️ No style modules found. Please add style modules to the styles directory.");
        }
        
        console.log(`🍪 Cookie status: ${this.getCookieStatus()}`);
    }

    async handleNrmTikTok(message, args) {
        try {
            if (!args[0]) {
                return message.reply(`Please provide a TikTok URL
Usage: nrmtiktok <tiktok_url>

This downloads the video without any watermark (clean video).`);
            }

            const tiktokUrl = args[0];
            await message.reply("⏳ Downloading clean TikTok video...");

            try {
                const downloadedPath = await this.downloadTikTokVideo(tiktokUrl, Boolean(this.tiktokCookie));
                const videoBuffer = fs.readFileSync(downloadedPath);
                
                await message.reply(videoBuffer, {
                    mimetype: 'video/mp4',
                    caption: `✅ Clean video downloaded (no watermark)\n🍪 Cookie status: ${this.getCookieStatus()}`
                });

                // Cleanup
                if (fs.existsSync(downloadedPath)) fs.unlinkSync(downloadedPath);

            } catch (error) {
                let errorMessage = "❌ Download failed: ";
                
                if (error.message.includes("403")) {
                    errorMessage += 'TikTok blocked the request. Try:\n• Using a different video URL\n• Setting a TikTok cookie with "setcookie" command\n• Waiting a few minutes before trying again';
                } else if (error.message.includes("timeout")) {
                    errorMessage += "Download timed out. The video might be too large or TikTok servers are slow. Try again later.";
                } else if (error.message.includes("No video URL")) {
                    errorMessage += "Could not find video in TikTok response. The video might be private or deleted.";
                } else {
                    errorMessage += error.message;
                }
                
                await message.reply(errorMessage);
            }
        } catch (error) {
            console.error("Error in nrmtiktok command:", error);
            await message.reply(`❌ Unexpected error: ${error.message}`);
        }
    }
    
    cleanTempFiles() {
        try {
            const tempDir = path.join(__dirname, "temp");
            if (fs.existsSync(tempDir)) {
                const files = fs.readdirSync(tempDir);
                const now = Date.now();
                const oneHour = 60 * 60 * 1000;
                
                for (const file of files) {
                    const filePath = path.join(tempDir, file);
                    const stats = fs.statSync(filePath);
                    
                    if (now - stats.mtime.getTime() > oneHour) {
                        fs.unlinkSync(filePath);
                        console.log(`🗑️ Cleaned old temp file: ${file}`);
                    }
                }
            }
        } catch (error) {
            console.warn("⚠️ Error cleaning temp files:", error.message);
        }
    }

    async handleNetworkError(error, retryCount = 0, maxRetries = 2) {
        if (retryCount < maxRetries) {
            console.log(`🔄 Retrying after network error (attempt ${retryCount + 1}/${maxRetries + 1}): ${error.message}`);
            await new Promise(resolve => setTimeout(resolve, 2000 * (retryCount + 1)));
            return true;
        }
        return false;
    }
}

module.exports = TikTokWatermarkPlugin;