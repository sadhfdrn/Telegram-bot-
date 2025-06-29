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

                    // Load preset styles if available
                    if (typeof styleInstance.getPresetStyles === 'function') {
                        const presetStyles = styleInstance.getPresetStyles();
                        for (const [presetName, presetConfig] of Object.entries(presetStyles)) {
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

    async downloadTikTokVideo(url, useCookie = false) {
        const methods = [
            () => this.downloadWithTobyAPI(url, useCookie),
            () => this.downloadWithAlternativeAPI(url),
            () => this.downloadWithDirectMethod(url)
        ];

        let lastError;
        for (let i = 0; i < methods.length; i++) {
            try {
                console.log(`📥 Attempting download method ${i + 1}...`);
                const result = await methods[i]();
                console.log(`✅ Download successful with method ${i + 1}`);
                return result;
            } catch (error) {
                console.log(`❌ Method ${i + 1} failed: ${error.message}`);
                lastError = error;
                if (i === methods.length - 1) {
                    throw new Error(`All download methods failed. Last error: ${error.message}`);
                }
            }
        }
    }

    async downloadWithTobyAPI(url, useCookie = false) {
        try {
            console.log("📥 Using Toby API...");
            const options = { version: "v3" };
            let result;

            if (this.tiktokCookie && useCookie) {
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

            // More thorough result validation
            if (!result || !result.status || result.status !== "success") {
                console.error("API Response:", JSON.stringify(result, null, 2));
                throw new Error(result?.message || "API returned unsuccessful status");
            }

            if (!result.result) {
                throw new Error("No result data in API response");
            }

            let videoUrl = this.extractVideoUrl(result.result);
            if (!videoUrl) {
                console.error("Result structure:", JSON.stringify(result.result, null, 2));
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

            const endpoints = [
                `https://tikwm.com/api/?url=${encodeURIComponent(url)}`,
                `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`
            ];

            for (const endpoint of endpoints) {
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
        // Try multiple possible video URL locations
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
            
            // Ensure temp directory exists
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

    generateWatermarkFilter(config) {
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
        } = config;

        // Try to use custom module filter generation first
        if (!isBuiltIn && styleClass && typeof styleClass.generateFilter === 'function') {
            try {
                console.log(`🎨 Using ${module} module filter generation`);
                return styleClass.generateFilter(config);
            } catch (error) {
                console.warn(`⚠️ ${module} filter generation failed, falling back to default:`, error.message);
            }
        }

        // Default filter generation
        const positions = {
            'top-left': 'x=50:y=50',
            'top-right': 'x=W-tw-50:y=50',
            'bottom-left': 'x=50:y=H-th-50',
            'bottom-right': 'x=W-tw-50:y=H-th-50',
            'center': 'x=(W-tw)/2:y=(H-th)/2'
        };

        let filter = `drawtext=text='${text}':fontsize=${fontSize || size || 24}:fontcolor=${color || textColor || 'white'}@${opacity}:${positions[position] || positions['bottom-right']}`;
        
        // Add shadow
        filter += ':shadowcolor=black@0.5:shadowx=2:shadowy=2';
        
        // Add rotation if specified
        if (rotation && rotation !== 0) {
            filter += ':angle=' + (rotation * Math.PI / 180);
        }

        console.log("🎨 Generated filter:", filter);
        return filter;
    }

    async addWatermarkToVideo(inputPath, outputPath, watermarkConfig) {
        return new Promise((resolve, reject) => {
            if (!fs.existsSync(inputPath)) {
                return reject(new Error("Input video file not found"));
            }

            const filter = this.generateWatermarkFilter(watermarkConfig);
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

    async handleWmTikTok(ctx, args) {
        try {
            if (!args[0]) {
                const stylesCount = this.getAllStyles().size;
                const modulesCount = this.styleModules.size;
                return ctx.reply(`Please provide a TikTok URL\nUsage: wmtiktok <tiktok_url>\n\n📊 Available styles: ${stylesCount} total from ${modulesCount} modules\n\n💡 Use the inline menu for easier access to styles and settings.`);
            }

            const url = args[0];
            const userId = ctx.from || ctx.chat?.id || "default";
            let userWatermark = this.watermarkSettings.get(userId) || this.defaultWatermark;
            
            // Apply dynamic style if set
            let finalWatermark = { ...userWatermark };
            if (userWatermark.fullStyleName) {
                const dynamicStyle = this.dynamicStyles.get(userWatermark.fullStyleName);
                if (dynamicStyle) {
                    Object.assign(finalWatermark, dynamicStyle);
                }
            }

            await ctx.reply("⏳ Downloading TikTok video...");

            try {
                const videoPath = await this.downloadTikTokVideo(url, Boolean(this.tiktokCookie));
                
                const styleName = finalWatermark.module ? 
                    `${finalWatermark.originalName || 'custom'} (${finalWatermark.module})` : 
                    finalWatermark.effect || 'default';
                
                await ctx.reply(`🎨 Adding ${styleName} watermark...`);

                const outputPath = path.join(__dirname, "temp", `watermarked_${Date.now()}.mp4`);
                await this.addWatermarkToVideo(videoPath, outputPath, finalWatermark);

                const videoBuffer = fs.readFileSync(outputPath);
                await ctx.reply(videoBuffer, {
                    mimetype: 'video/mp4',
                    caption: `✅ Watermarked with: ${styleName}\n🎨 Styles available: ${this.getAllStyles().size} total from ${this.styleModules.size} modules\n🍪 Cookie status: ${this.getCookieStatus()}`
                });

                // Cleanup
                if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
                if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

            } catch (error) {
                let errorMsg = "❌ Download failed: ";
                
                if (error.message.includes("403")) {
                    errorMsg += 'TikTok blocked the request. Try:\n• Using a different video URL\n• Setting a TikTok cookie with "setcookie" command\n• Waiting a few minutes before trying again';
                } else if (error.message.includes("timeout")) {
                    errorMsg += "Download timed out. The video might be too large or TikTok servers are slow. Try again later.";
                } else if (error.message.includes("No video URL")) {
                    errorMsg += "Could not find video in TikTok response. The video might be private or deleted.";
                } else if (error.message.includes("ffmpeg") || error.message.includes("FFmpeg")) {
                    errorMsg += "FFmpeg is not installed. Please install FFmpeg:\n• Ubuntu/Debian: sudo apt install ffmpeg\n• macOS: brew install ffmpeg";
                } else {
                    errorMsg += error.message;
                }
                
                await ctx.reply(errorMsg);
            }

        } catch (error) {
            console.error("Error in wmtiktok command:", error);
            await ctx.reply(`❌ Unexpected error: ${error.message}`);
        }
    }

    async handleSetCookie(ctx, args) {
        try {
            if (!args[0]) {
                return ctx.reply("🍪 Set TikTok Cookie for Enhanced Download Success:\n\n**How to get your TikTok cookie:**\n1. Install Cookie-Editor browser extension\n2. Login to TikTok.com\n3. Open Cookie-Editor on TikTok\n4. Copy all cookies\n5. Use: setcookie <your_cookie_string>\n\n**Benefits:**\n• Bypasses 403 errors\n• Access to higher quality videos\n• Better download success rate");
            }

            const cookie = args.join(" ");
            this.setTikTokCookie(cookie);
            await ctx.reply("✅ TikTok cookie set successfully!\n🔓 Enhanced download features enabled.");

        } catch (error) {
            console.error("Error in setcookie command:", error);
            await ctx.reply(`❌ Error: ${error.message}`);
        }
    }

    async handleCookieStatus(ctx, args) {
        try {
            const status = this.getCookieStatus();
            const details = this.tiktokCookie ? 
                "✅ Enhanced downloads enabled\n✅ Better 403 error bypass\n✅ Higher success rate" :
                "❌ Basic downloads only\n❌ May encounter 403 errors\n❌ Limited success rate";

            await ctx.reply(`🍪 **Cookie Status:** ${status}\n\n${details}`);

        } catch (error) {
            console.error("Error in cookiestatus command:", error);
            await ctx.reply(`❌ Error: ${error.message}`);
        }
    }

    async handleSetWatermark(ctx, args) {
        try {
            const userId = ctx.from || ctx.chat?.id || "default";

            if (!args[0]) {
                const allStyles = this.getAllStyles();
                const styleNames = Array.from(allStyles.keys());
                
                let message = `🎨 Available watermark styles (${allStyles.size} total from ${this.styleModules.size} modules):\n\n`;
                
                // Group by module
                const groupedStyles = {};
                for (const [styleName, styleConfig] of allStyles) {
                    if (!groupedStyles[styleConfig.module]) {
                        groupedStyles[styleConfig.module] = [];
                    }
                    groupedStyles[styleConfig.module].push(styleName);
                }

                for (const [module, styles] of Object.entries(groupedStyles)) {
                    message += `**${module.toUpperCase()} Module:**\n`;
                    message += styles.map(style => `• ${style}`).join('\n') + '\n\n';
                }

                message += "Usage: setwatermark <style> [text]\nExample: setwatermark neon_glow MyName";
                return ctx.reply(message);
            }

            const styleName = args[0].toLowerCase();
            const customText = args.slice(1).join(" ");

            let selectedStyle = null;
            if (this.dynamicStyles.has(styleName)) {
                selectedStyle = { ...this.dynamicStyles.get(styleName) };
            }

            if (!selectedStyle) {
                return ctx.reply("❌ Invalid style. Use setwatermark without arguments to see available styles.");
            }

            if (customText) {
                selectedStyle.text = customText;
            }

            selectedStyle.fullStyleName = styleName;
            this.watermarkSettings.set(userId, selectedStyle);

            const moduleInfo = `${selectedStyle.module} module`;
            await ctx.reply(`✅ Watermark set to "${selectedStyle.originalName || styleName}" style from ${moduleInfo}${customText ? ` with text: "${customText}"` : ''}`);

        } catch (error) {
            console.error("Error in setwatermark command:", error);
            await ctx.reply(`❌ Error: ${error.message}`);
        }
    }

    // Add the missing nrmtiktok handler
    async handleNrmTikTok(ctx, args) {
        try {
            if (!args[0]) {
                return ctx.reply("Please provide a TikTok URL\nUsage: nrmtiktok <tiktok_url>\n\nThis downloads the video without any watermark (clean video).");
            }

            const url = args[0];
            await ctx.reply("⏳ Downloading clean TikTok video...");

            try {
                const videoPath = await this.downloadTikTokVideo(url, Boolean(this.tiktokCookie));
                const videoBuffer = fs.readFileSync(videoPath);
                await ctx.reply(videoBuffer, {
                    mimetype: 'video/mp4',
                    caption: `✅ Clean video downloaded (no watermark)\n🍪 Cookie status: ${this.getCookieStatus()}`
                });

                // Cleanup
                if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);

            } catch (error) {
                let errorMsg = "❌ Download failed: ";
                
                if (error.message.includes("403")) {
                    errorMsg += 'TikTok blocked the request. Try:\n• Using a different video URL\n• Setting a TikTok cookie with "setcookie" command\n• Waiting a few minutes before trying again';
                } else if (error.message.includes("timeout")) {
                    errorMsg += "Download timed out. The video might be too large or TikTok servers are slow. Try again later.";
                } else if (error.message.includes("No video URL")) {
                    errorMsg += "Could not find video in TikTok response. The video might be private or deleted.";
                } else {
                    errorMsg += error.message;
                }
                
                await ctx.reply(errorMsg);
            }

        } catch (error) {
            console.error("Error in nrmtiktok command:", error);
            await ctx.reply(`❌ Unexpected error: ${error.message}`);
        }
    }

    init(bot) {
        bot.command("wmtiktok", (ctx, args) => this.handleWmTikTok(ctx, args));
        bot.command("setwatermark", (ctx, args) => this.handleSetWatermark(ctx, args));
        bot.command("setcookie", (ctx, args) => this.handleSetCookie(ctx, args));
        bot.command("cookiestatus", (ctx, args) => this.handleCookieStatus(ctx, args));
        bot.command("nrmtiktok", (ctx, args) => this.handleNrmTikTok(ctx, args)); // Added missing command

        const stylesCount = this.getAllStyles().size;
        const modulesCount = this.styleModules.size;

        console.log("🔧 TikTok Plugin initialized with styles directory support only");
        console.log(`📊 Style stats: ${stylesCount} total from ${modulesCount} modules`);
        
        if (this.styleModules.size > 0) {
            console.log(`📦 Loaded modules: ${Array.from(this.styleModules.keys()).join(", ")}`);
        } else {
            console.log("⚠️ No style modules found. Please add style modules to the styles directory.");
        }
        
        console.log(`🍪 Cookie status: ${this.getCookieStatus()}`);
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
                    if (now - fs.statSync(filePath).mtime.getTime() > oneHour) {
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