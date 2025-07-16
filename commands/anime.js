const axios = require('axios');
const fs = require('fs');
const path = require('path');

class AnimeCommand {
    constructor(bot, botManager) {
        this.bot = bot;
        this.botManager = botManager;
        this.apiBase = 'https://coloured-georgette-ogcheel-8222b3ae.koyeb.app';
        this.commandName = 'anime';
        this.downloadQueue = new Map(); // Track active downloads
        this.userCache = new Map(); // Cache search results for users
        this.animeCache = new Map(); // Cache anime details for callback handling
        
        // Initialize command
        this.init();
    }

    init() {
        // Set up command handler
        this.bot.onText(/\/anime(.*)/, (msg, match) => {
            this.handleAnimeCommand(msg, match[1].trim());
        });

        console.log('🎌 Anime command initialized');
    }

    getMainButton() {
        return {
            text: '🎌 Anime Search & Download',
            callback_data: 'anime_main'
        };
    }

    // Helper function to generate safe callback data
    generateSafeCallback(action, data) {
        // Create a hash for long IDs to avoid button errors
        const hash = this.createHash(data);
        this.animeCache.set(hash, data);
        return `anime_${action}_${hash}`;
    }

    createHash(str) {
        let hash = 0;
        if (str.length === 0) return hash.toString();
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(36);
    }

    async handleAnimeCommand(msg, query) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;

        if (!query) {
            this.showMainMenu(chatId);
            return;
        }

        // If user provided a query directly, search for it
        await this.searchAnime(chatId, query, userId);
    }

    showMainMenu(chatId, messageId = null) {
        const menuMessage = `🎌 *Anime Search & Download*

Welcome to the anime world! Here's what you can do:

🔍 Search for anime by name
📺 Get detailed anime information with images
⬇️ Download episodes with sub/dub options
📋 Browse episode lists

*How to use:*
• Use the search button below
• Or type: \`/anime [anime name]\`

*Example:* \`/anime dandadan\``;

        const keyboard = {
            inline_keyboard: [
                [{ text: '🔍 Search Anime', callback_data: 'anime_search' }],
                [{ text: '📊 Popular Anime', callback_data: 'anime_popular' }],
                [{ text: '📥 Download Queue', callback_data: 'anime_queue' }],
                [{ text: '🏠 Back to Main Menu', callback_data: 'show_commands' }]
            ]
        };

        const options = {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        };

        if (messageId) {
            this.bot.editMessageText(menuMessage, {
                chat_id: chatId,
                message_id: messageId,
                ...options
            });
        } else {
            this.bot.sendMessage(chatId, menuMessage, options);
        }
    }

    async handleCallback(callbackQuery) {
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        const data = callbackQuery.data;
        const userId = callbackQuery.from.id;

        if (!data.startsWith('anime_')) {
            return false;
        }

        const parts = data.split('_');
        const action = parts[1];

        try {
            switch (action) {
                case 'main':
                    this.showMainMenu(chatId, messageId);
                    break;
                    
                case 'search':
                    this.promptSearch(chatId, messageId, userId);
                    break;
                    
                case 'popular':
                    await this.showPopularAnime(chatId, messageId);
                    break;
                    
                case 'queue':
                    this.showDownloadQueue(chatId, messageId, userId);
                    break;
                    
                case 'result':
                    const animeHash = parts[2];
                    const animeId = this.animeCache.get(animeHash);
                    if (animeId) {
                        await this.showAnimeInfo(chatId, messageId, animeId, userId);
                    } else {
                        throw new Error('Anime data not found');
                    }
                    break;
                    
                case 'episode':
                    const episodeHash = parts[2];
                    const episodeId = this.animeCache.get(episodeHash);
                    if (episodeId) {
                        await this.showEpisodeOptions(chatId, messageId, episodeId, userId);
                    } else {
                        throw new Error('Episode data not found');
                    }
                    break;
                    
                case 'download':
                    const downloadHash = parts[2];
                    const downloadData = this.animeCache.get(downloadHash);
                    if (downloadData) {
                        await this.handleDownload(chatId, messageId, downloadData.split('_'), userId);
                    } else {
                        throw new Error('Download data not found');
                    }
                    break;
                    
                case 'page':
                    const pageNum = parseInt(parts[2]);
                    const queryHash = parts[3];
                    const query = this.animeCache.get(queryHash);
                    if (query) {
                        await this.searchAnime(chatId, query, userId, pageNum, messageId);
                    } else {
                        throw new Error('Search query not found');
                    }
                    break;
                    
                case 'back':
                    const backTo = parts[2];
                    await this.handleBackNavigation(chatId, messageId, backTo, userId);
                    break;
                    
                default:
                    return false;
            }
            return true;
        } catch (error) {
            console.error('❌ Error in anime callback:', error);
            this.bot.editMessageText('❌ An error occurred. Please try again.', {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: {
                    inline_keyboard: [[
                        { text: '🏠 Back to Main Menu', callback_data: 'anime_main' }
                    ]]
                }
            });
            return true;
        }
    }

    promptSearch(chatId, messageId, userId) {
        const searchMessage = `🔍 *Search for Anime*

Please enter the name of the anime you want to search for:

*Examples:*
• Dandadan
• Demon Slayer
• Attack on Titan
• One Piece

Just type the anime name and I'll find it for you!`;

        this.botManager.setUserState(userId, {
            commandName: 'anime',
            action: 'search',
            step: 'waiting_query'
        });

        this.bot.editMessageText(searchMessage, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[
                    { text: '❌ Cancel', callback_data: 'anime_main' }
                ]]
            }
        });
    }

    async handleTextInput(msg, userState) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const text = msg.text;

        if (userState.action === 'search' && userState.step === 'waiting_query') {
            this.botManager.clearUserState(userId);
            await this.searchAnime(chatId, text, userId);
        }
    }

    async searchAnime(chatId, query, userId, page = 1, messageId = null) {
        const loadingMessage = `🔍 Searching for "${query}"...`;
        
        let loadingMsgId;
        if (messageId) {
            this.bot.editMessageText(loadingMessage, {
                chat_id: chatId,
                message_id: messageId
            });
            loadingMsgId = messageId;
        } else {
            const sentMsg = await this.bot.sendMessage(chatId, loadingMessage);
            loadingMsgId = sentMsg.message_id;
        }

        try {
            const response = await axios.get(`${this.apiBase}/anime/search/${encodeURIComponent(query)}?page=${page}`);
            const data = response.data;

            if (!data.results || data.results.length === 0) {
                this.bot.editMessageText(`❌ No anime found for "${query}"\n\nTry searching with a different name or check the spelling.`, {
                    chat_id: chatId,
                    message_id: loadingMsgId,
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '🔍 Search Again', callback_data: 'anime_search' },
                            { text: '🏠 Main Menu', callback_data: 'anime_main' }
                        ]]
                    }
                });
                return;
            }

            // Cache results for this user
            this.userCache.set(userId, {
                query,
                results: data.results,
                currentPage: page,
                totalPages: data.totalPages || 1,
                hasNextPage: data.hasNextPage || false
            });

            await this.showSearchResults(chatId, loadingMsgId, data, query, page);

        } catch (error) {
            console.error('❌ Error searching anime:', error);
            this.bot.editMessageText('❌ Failed to search anime. Please try again later.', {
                chat_id: chatId,
                message_id: loadingMsgId,
                reply_markup: {
                    inline_keyboard: [[
                        { text: '🔍 Try Again', callback_data: 'anime_search' },
                        { text: '🏠 Main Menu', callback_data: 'anime_main' }
                    ]]
                }
            });
        }
    }

    async showSearchResults(chatId, messageId, data, query, page = 1) {
        const results = data.results.slice(0, 5); // Show fewer results to accommodate images
        
        try {
            // Delete the loading message first
            await this.bot.deleteMessage(chatId, messageId);
        } catch (error) {
            console.log('Could not delete loading message');
        }

        // Send results with images
        for (let i = 0; i < results.length; i++) {
            const anime = results[i];
            await this.sendAnimeResult(chatId, anime, i + 1, query, page);
        }

        // Send navigation menu
        await this.sendSearchNavigation(chatId, data, query, page);
    }

    async sendAnimeResult(chatId, anime, index, query, page) {
        const title = anime.title || 'Unknown Title';
        const japaneseTitle = anime.japaneseTitle || '';
        const episodes = anime.episodes ? `📺 ${anime.episodes} episodes` : '';
        const subDub = [];
        if (anime.sub) subDub.push(`🎌 SUB (${anime.sub})`);
        if (anime.dub) subDub.push(`🎤 DUB (${anime.dub})`);

        let caption = `${index}. *${title}*\n`;
        if (japaneseTitle) caption += `🈲 ${japaneseTitle}\n`;
        if (episodes) caption += `${episodes}\n`;
        if (subDub.length > 0) caption += `${subDub.join(' • ')}\n`;

        const keyboard = {
            inline_keyboard: [[
                { 
                    text: '📖 View Details', 
                    callback_data: this.generateSafeCallback('result', anime.id) 
                }
            ]]
        };

        try {
            if (anime.image) {
                await this.bot.sendPhoto(chatId, anime.image, {
                    caption: caption,
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                });
            } else {
                await this.bot.sendMessage(chatId, caption, {
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                });
            }
        } catch (error) {
            console.error('Error sending anime result:', error);
            // Fallback to text message if image fails
            await this.bot.sendMessage(chatId, caption, {
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });
        }
    }

    async sendSearchNavigation(chatId, data, query, page) {
        let message = `🔍 *Search Results for "${query}"*\n\n`;
        message += `📄 Page ${page}${data.totalPages > 1 ? ` of ${data.totalPages}` : ''}\n`;
        message += `📊 Found ${data.results.length} anime${data.hasNextPage ? ' (showing first 5 per page)' : ''}`;

        const keyboard = { inline_keyboard: [] };

        // Navigation buttons
        const navButtons = [];
        if (page > 1) {
            const prevPageHash = this.createHash(query);
            this.animeCache.set(prevPageHash, query);
            navButtons.push({ text: '⬅️ Previous', callback_data: `anime_page_${page - 1}_${prevPageHash}` });
        }
        if (data.hasNextPage) {
            const nextPageHash = this.createHash(query);
            this.animeCache.set(nextPageHash, query);
            navButtons.push({ text: 'Next ➡️', callback_data: `anime_page_${page + 1}_${nextPageHash}` });
        }
        if (navButtons.length > 0) {
            keyboard.inline_keyboard.push(navButtons);
        }

        // Bottom buttons
        keyboard.inline_keyboard.push([
            { text: '🔍 New Search', callback_data: 'anime_search' },
            { text: '🏠 Main Menu', callback_data: 'anime_main' }
        ]);

        await this.bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }

    async showAnimeInfo(chatId, messageId, animeId, userId) {
        const loadingMessage = '📱 Loading anime information...';
        
        await this.bot.editMessageText(loadingMessage, {
            chat_id: chatId,
            message_id: messageId
        });

        try {
            const response = await axios.get(`${this.apiBase}/anime/info/${animeId}`);
            const anime = response.data;

            // Delete the loading message
            try {
                await this.bot.deleteMessage(chatId, messageId);
            } catch (error) {
                console.log('Could not delete loading message');
            }

            // Send anime info with image
            await this.sendAnimeInfo(chatId, anime, userId);

        } catch (error) {
            console.error('❌ Error fetching anime info:', error);
            this.bot.editMessageText('❌ Failed to load anime information. Please try again.', {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: {
                    inline_keyboard: [[
                        { text: '⬅️ Back to Search', callback_data: 'anime_back_search' },
                        { text: '🏠 Main Menu', callback_data: 'anime_main' }
                    ]]
                }
            });
        }
    }

    async sendAnimeInfo(chatId, anime, userId) {
        let caption = `🎌 *${anime.title}*\n`;
        if (anime.japaneseTitle) {
            caption += `🈲 *Japanese:* ${anime.japaneseTitle}\n`;
        }
        caption += `\n📖 *Description:*\n${anime.description ? anime.description.substring(0, 300) + '...' : 'No description available'}\n\n`;
        
        caption += `📊 *Details:*\n`;
        if (anime.type) caption += `🎭 Type: ${anime.type}\n`;
        if (anime.status) caption += `📡 Status: ${anime.status}\n`;
        if (anime.season) caption += `🗓 Season: ${anime.season}\n`;
        if (anime.totalEpisodes) caption += `📺 Episodes: ${anime.totalEpisodes}\n`;
        
        const availability = [];
        if (anime.hasSub) availability.push('🎌 Subtitled');
        if (anime.hasDub) availability.push('🎤 Dubbed');
        if (availability.length > 0) {
            caption += `🌐 Available: ${availability.join(', ')}\n`;
        }
        
        if (anime.genres && anime.genres.length > 0) {
            caption += `🏷 Genres: ${anime.genres.join(', ')}\n`;
        }

        const keyboard = { inline_keyboard: [] };

        // Episode buttons (show first 6 episodes)
        if (anime.episodes && anime.episodes.length > 0) {
            const episodesToShow = anime.episodes.slice(0, 6);
            
            for (let i = 0; i < episodesToShow.length; i += 2) {
                const row = [];
                const episode1 = episodesToShow[i];
                const episode2 = episodesToShow[i + 1];
                
                row.push({
                    text: `EP ${episode1.number}`,
                    callback_data: this.generateSafeCallback('episode', episode1.id)
                });
                
                if (episode2) {
                    row.push({
                        text: `EP ${episode2.number}`,
                        callback_data: this.generateSafeCallback('episode', episode2.id)
                    });
                }
                
                keyboard.inline_keyboard.push(row);
            }

            if (anime.episodes.length > 6) {
                keyboard.inline_keyboard.push([{
                    text: `📋 View All ${anime.episodes.length} Episodes`,
                    callback_data: this.generateSafeCallback('episodes', `all_${anime.id}`)
                }]);
            }
        }

        // Navigation buttons
        keyboard.inline_keyboard.push([
            { text: '⬅️ Back to Search', callback_data: 'anime_back_search' },
            { text: '🏠 Main Menu', callback_data: 'anime_main' }
        ]);

        try {
            if (anime.image) {
                await this.bot.sendPhoto(chatId, anime.image, {
                    caption: caption,
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                });
            } else {
                await this.bot.sendMessage(chatId, caption, {
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                });
            }
        } catch (error) {
            console.error('Error sending anime info:', error);
            // Fallback to text message if image fails
            await this.bot.sendMessage(chatId, caption, {
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });
        }
    }

    async showEpisodeOptions(chatId, messageId, episodeId, userId) {
        const loadingMessage = '⚙️ Loading episode options...';
        
        await this.bot.editMessageText(loadingMessage, {
            chat_id: chatId,
            message_id: messageId
        });

        try {
            const response = await axios.get(`${this.apiBase}/anime/sources/${episodeId}`);
            const sources = response.data;

            let message = `📺 *Episode Download Options*\n\n`;
            message += `🎬 Episode ID: ${episodeId}\n`;
            message += `🔗 Available Sources: ${sources.sources ? sources.sources.length : 0}\n\n`;

            message += `📊 *Available Qualities:*\n`;
            if (sources.sources && sources.sources.length > 0) {
                sources.sources.forEach((source, index) => {
                    message += `${index + 1}. ${source.quality || 'Unknown Quality'}\n`;
                });
            }

            const keyboard = { inline_keyboard: [] };

            // Download options
            if (sources.sources && sources.sources.length > 0) {
                message += `\n🎌 *Language Options:*\n`;
                
                // Sub/Dub options
                const subDubButtons = [];
                subDubButtons.push({
                    text: '🎌 Download SUB',
                    callback_data: this.generateSafeCallback('download', `sub_${episodeId}`)
                });
                subDubButtons.push({
                    text: '🎤 Download DUB',
                    callback_data: this.generateSafeCallback('download', `dub_${episodeId}`)
                });
                
                keyboard.inline_keyboard.push(subDubButtons);

                // Quality selection
                const qualityButtons = [];
                sources.sources.slice(0, 3).forEach((source, index) => {
                    qualityButtons.push({
                        text: `📹 ${source.quality}`,
                        callback_data: this.generateSafeCallback('download', `quality_${source.quality}_${episodeId}`)
                    });
                });
                
                if (qualityButtons.length > 0) {
                    keyboard.inline_keyboard.push(qualityButtons);
                }

                // Direct download button
                keyboard.inline_keyboard.push([{
                    text: '⬇️ Quick Download (Best Quality)',
                    callback_data: this.generateSafeCallback('download', `best_${episodeId}`)
                }]);
            }

            keyboard.inline_keyboard.push([
                { text: '⬅️ Back to Anime', callback_data: 'anime_back_info' },
                { text: '🏠 Main Menu', callback_data: 'anime_main' }
            ]);

            this.bot.editMessageText(message, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });

        } catch (error) {
            console.error('❌ Error fetching episode sources:', error);
            this.bot.editMessageText('❌ Failed to load episode sources. Please try again.', {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: {
                    inline_keyboard: [[
                        { text: '⬅️ Back to Anime', callback_data: 'anime_back_info' },
                        { text: '🏠 Main Menu', callback_data: 'anime_main' }
                    ]]
                }
            });
        }
    }

    async handleDownload(chatId, messageId, downloadData, userId) {
        const [type, episodeId] = downloadData;
        
        // Add to download queue
        const downloadId = `${userId}_${Date.now()}`;
        this.downloadQueue.set(downloadId, {
            userId,
            episodeId,
            type,
            status: 'queued',
            timestamp: Date.now()
        });

        let message = `⬇️ *Download Started*\n\n`;
        message += `🎬 Episode ID: ${episodeId}\n`;
        message += `🎌 Type: ${type.toUpperCase()}\n`;
        message += `📊 Status: Added to queue\n\n`;
        message += `*Note:* This is a demo implementation. In a real bot, this would:\n`;
        message += `• Download the episode file\n`;
        message += `• Send it to your chat\n`;
        message += `• Track download progress\n`;
        message += `• Handle different qualities\n\n`;
        message += `💡 *Download ID:* \`${downloadId}\``;

        const keyboard = {
            inline_keyboard: [
                [
                    { text: '📥 View Queue', callback_data: 'anime_queue' },
                    { text: '⬇️ Download Another', callback_data: 'anime_search' }
                ],
                [
                    { text: '🏠 Main Menu', callback_data: 'anime_main' }
                ]
            ]
        };

        this.bot.editMessageText(message, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });

        // Simulate download completion after 5 seconds
        setTimeout(() => {
            this.completeDownload(downloadId, chatId);
        }, 5000);
    }

    completeDownload(downloadId, chatId) {
        const download = this.downloadQueue.get(downloadId);
        if (download) {
            download.status = 'completed';
            
            const message = `✅ *Download Completed!*\n\n🎬 Episode: ${download.episodeId}\n🎌 Type: ${download.type.toUpperCase()}\n\n*Note:* In a real implementation, the video file would be sent here.`;
            
            this.bot.sendMessage(chatId, message, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[
                        { text: '⬇️ Download More', callback_data: 'anime_search' },
                        { text: '🏠 Main Menu', callback_data: 'anime_main' }
                    ]]
                }
            });
        }
    }

    showDownloadQueue(chatId, messageId, userId) {
        const userDownloads = Array.from(this.downloadQueue.values()).filter(d => d.userId === userId);
        
        let message = `📥 *Your Download Queue*\n\n`;
        
        if (userDownloads.length === 0) {
            message += `📭 No downloads in queue\n\n`;
            message += `Start downloading anime episodes using the search function!`;
        } else {
            userDownloads.forEach((download, index) => {
                const status = download.status === 'completed' ? '✅' : '⏳';
                message += `${index + 1}. ${status} ${download.episodeId}\n`;
                message += `   Type: ${download.type.toUpperCase()} | Status: ${download.status}\n\n`;
            });
        }

        const keyboard = {
            inline_keyboard: [
                [
                    { text: '🔍 Search Anime', callback_data: 'anime_search' },
                    { text: '🏠 Main Menu', callback_data: 'anime_main' }
                ]
            ]
        };

        this.bot.editMessageText(message, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }

    async showPopularAnime(chatId, messageId) {
        // Simulate popular anime (in real implementation, this would come from API)
        const popularAnime = [
            { name: 'Dandadan', id: 'dandadan' },
            { name: 'Demon Slayer', id: 'demon-slayer' },
            { name: 'Attack on Titan', id: 'attack-on-titan' },
            { name: 'One Piece', id: 'one-piece' },
            { name: 'Naruto', id: 'naruto' },
            { name: 'Jujutsu Kaisen', id: 'jujutsu-kaisen' }
        ];

        let message = `🔥 *Popular Anime*\n\n`;
        message += `Here are some popular anime you can search for:\n\n`;

        const keyboard = { inline_keyboard: [] };

        popularAnime.forEach((anime, index) => {
            const searchHash = this.createHash(anime.name);
            this.animeCache.set(searchHash, anime.name);
            keyboard.inline_keyboard.push([{
                text: `${index + 1}. ${anime.name}`,
                callback_data: `anime_search_${searchHash}`
            }]);
        });

        keyboard.inline_keyboard.push([
            { text: '🔍 Custom Search', callback_data: 'anime_search' },
            { text: '🏠 Main Menu', callback_data: 'anime_main' }
        ]);

        this.bot.editMessageText(message, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }

    async handleBackNavigation(chatId, messageId, backTo, userId) {
        const userCache = this.userCache.get(userId);
        
        switch (backTo) {
            case 'search':
                if (userCache && userCache.query) {
                    await this.showSearchResults(chatId, messageId, {
                        results: userCache.results,
                        hasNextPage: userCache.hasNextPage,
                        totalPages: userCache.totalPages
                    }, userCache.query, userCache.currentPage);
                } else {
                    this.promptSearch(chatId, messageId, userId);
                }
                break;
            case 'info':
                // Would need to store anime info in cache to go back
                this.showMainMenu(chatId, messageId);
                break;
            default:
                this.showMainMenu(chatId, messageId);
        }
    }

    // Method to show command menu (called by bot manager)
    showCommandMenu(chatId, messageId) {
        this.showMainMenu(chatId, messageId);
    }

    // Get command info
    getInfo() {
        return {
            name: 'anime',
            description: 'Search and download anime episodes with images',
            usage: '/anime [anime name]',
            features: [
                'Search anime by name with preview images',
                'View anime details and cover images',
                'Download with sub/dub options',
                'Quality selection',
                'Download queue management'
            ]
        };
    }

    // Cleanup method
    async shutdown() {
        console.log('🎌 Shutting down anime command...');
        this.userCache.clear();
        this.downloadQueue.clear();
        this.animeCache.clear();
    }
}

module.exports = AnimeCommand;