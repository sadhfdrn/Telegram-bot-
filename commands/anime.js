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
        this.searchSessions = new Map(); // Track user search sessions
        
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

    // Helper function to generate safe callback data (max 64 chars)
    generateSafeCallback(action, data = '') {
        const sessionId = this.createShortHash(data);
        if (data) {
            this.animeCache.set(sessionId, data);
        }
        return `a_${action}_${sessionId}`.substring(0, 64);
    }

    createShortHash(str) {
        if (!str) return Math.random().toString(36).substr(2, 8);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(36).substring(0, 8);
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
📋 Browse episode lists with image gallery

*How to use:*
• Use the search button below
• Or type: \`/anime [anime name]\`

*Example:* \`/anime dandadan\``;

        const keyboard = {
            inline_keyboard: [
                [{ text: '🔍 Search Anime', callback_data: 'a_search' }],
                [{ text: '📊 Popular Anime', callback_data: 'a_popular' }],
                [{ text: '📥 Download Queue', callback_data: 'a_queue' }],
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

        if (!data.startsWith('a_')) {
            return false;
        }

        const parts = data.split('_');
        const action = parts[1];
        const sessionId = parts[2];

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
                    const animeData = this.animeCache.get(sessionId);
                    if (animeData) {
                        await this.showAnimeGallery(chatId, messageId, animeData, userId);
                    } else {
                        throw new Error('Search session expired');
                    }
                    break;
                    
                case 'gallery':
                    await this.handleGalleryNavigation(chatId, messageId, sessionId, userId);
                    break;
                    
                case 'select':
                    await this.handleAnimeSelection(chatId, messageId, sessionId, userId);
                    break;
                    
                case 'episodes':
                    await this.showEpisodeList(chatId, messageId, sessionId, userId);
                    break;
                    
                case 'episode':
                    await this.showEpisodeOptions(chatId, messageId, sessionId, userId);
                    break;
                    
                case 'download':
                    await this.handleDownload(chatId, messageId, sessionId, userId);
                    break;
                    
                case 'page':
                    await this.handlePageNavigation(chatId, messageId, sessionId, userId);
                    break;
                    
                case 'back':
                    await this.handleBackNavigation(chatId, messageId, sessionId, userId);
                    break;
                    
                case 'cancel':
                    this.showMainMenu(chatId, messageId);
                    break;
                    
                default:
                    return false;
            }
            return true;
        } catch (error) {
            console.error('❌ Error in anime callback:', error);
            this.bot.editMessageText('❌ Session expired or error occurred. Please try again.', {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: {
                    inline_keyboard: [[
                        { text: '🏠 Back to Main Menu', callback_data: 'a_main' }
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
                    { text: '❌ Cancel', callback_data: 'a_cancel' }
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

    async searchAnime(chatId, query, userId, page = 1) {
        const loadingMessage = `🔍 Searching for "${query}"...`;
        const sentMsg = await this.bot.sendMessage(chatId, loadingMessage);

        try {
            const response = await axios.get(`${this.apiBase}/anime/search/${encodeURIComponent(query)}?page=${page}`);
            const data = response.data;

            if (!data.results || data.results.length === 0) {
                this.bot.editMessageText(`❌ No anime found for "${query}"\n\nTry searching with a different name or check the spelling.`, {
                    chat_id: chatId,
                    message_id: sentMsg.message_id,
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '🔍 Search Again', callback_data: 'a_search' },
                            { text: '🏠 Main Menu', callback_data: 'a_main' }
                        ]]
                    }
                });
                return;
            }

            // Store search session
            const sessionId = this.createShortHash(`${userId}_${query}_${Date.now()}`);
            this.searchSessions.set(sessionId, {
                userId,
                query,
                results: data.results,
                currentIndex: 0,
                currentPage: page,
                totalPages: data.totalPages || 1,
                hasNextPage: data.hasNextPage || false
            });

            // Delete loading message and show gallery
            await this.bot.deleteMessage(chatId, sentMsg.message_id);
            await this.showAnimeGallery(chatId, null, sessionId, userId);

        } catch (error) {
            console.error('❌ Error searching anime:', error);
            this.bot.editMessageText('❌ Failed to search anime. Please try again later.', {
                chat_id: chatId,
                message_id: sentMsg.message_id,
                reply_markup: {
                    inline_keyboard: [[
                        { text: '🔍 Try Again', callback_data: 'a_search' },
                        { text: '🏠 Main Menu', callback_data: 'a_main' }
                    ]]
                }
            });
        }
    }

    async showAnimeGallery(chatId, messageId, sessionId, userId) {
        const session = this.searchSessions.get(sessionId);
        if (!session) {
            throw new Error('Search session not found');
        }

        const anime = session.results[session.currentIndex];
        const currentIndex = session.currentIndex;
        const totalResults = session.results.length;

        // Create comprehensive anime info
        let caption = `🎌 *${anime.title}*\n`;
        if (anime.japaneseTitle) {
            caption += `🈲 *Japanese:* ${anime.japaneseTitle}\n`;
        }
        
        caption += `\n📊 *Information:*\n`;
        if (anime.type) caption += `🎭 Type: ${anime.type}\n`;
        if (anime.status) caption += `📡 Status: ${anime.status}\n`;
        if (anime.totalEpisodes) caption += `📺 Episodes: ${anime.totalEpisodes}\n`;
        if (anime.season) caption += `🗓 Season: ${anime.season}\n`;
        
        const availability = [];
        if (anime.sub) availability.push(`🎌 SUB (${anime.sub})`);
        if (anime.dub) availability.push(`🎤 DUB (${anime.dub})`);
        if (availability.length > 0) {
            caption += `🌐 Available: ${availability.join(', ')}\n`;
        }
        
        if (anime.genres && anime.genres.length > 0) {
            caption += `🏷 Genres: ${anime.genres.join(', ')}\n`;
        }

        // Add description if available
        if (anime.description) {
            caption += `\n📖 *Description:*\n${anime.description.length > 200 ? anime.description.substring(0, 200) + '...' : anime.description}\n`;
        }

        caption += `\n📋 *Gallery:* ${currentIndex + 1} of ${totalResults}`;
        if (session.query) {
            caption += `\n🔍 *Search:* "${session.query}"`;
        }

        // Navigation buttons
        const keyboard = { inline_keyboard: [] };

        // Main navigation row
        const navRow = [];
        if (currentIndex > 0) {
            navRow.push({ text: '⬅️ Back', callback_data: this.generateSafeCallback('gallery', `prev_${sessionId}`) });
        }
        if (currentIndex < totalResults - 1) {
            navRow.push({ text: 'Next ➡️', callback_data: this.generateSafeCallback('gallery', `next_${sessionId}`) });
        }
        if (navRow.length > 0) {
            keyboard.inline_keyboard.push(navRow);
        }

        // Action buttons
        keyboard.inline_keyboard.push([
            { text: '✅ Select', callback_data: this.generateSafeCallback('select', sessionId) },
            { text: '❌ Cancel', callback_data: 'a_cancel' }
        ]);

        try {
            if (anime.image) {
                if (messageId) {
                    // Edit existing message
                    await this.bot.editMessageMedia({
                        type: 'photo',
                        media: anime.image,
                        caption: caption,
                        parse_mode: 'Markdown'
                    }, {
                        chat_id: chatId,
                        message_id: messageId,
                        reply_markup: keyboard
                    });
                } else {
                    // Send new message
                    await this.bot.sendPhoto(chatId, anime.image, {
                        caption: caption,
                        parse_mode: 'Markdown',
                        reply_markup: keyboard
                    });
                }
            } else {
                // Fallback to text message
                const options = {
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                };

                if (messageId) {
                    this.bot.editMessageText(caption, {
                        chat_id: chatId,
                        message_id: messageId,
                        ...options
                    });
                } else {
                    this.bot.sendMessage(chatId, caption, options);
                }
            }
        } catch (error) {
            console.error('Error showing anime gallery:', error);
            // Fallback to text message
            const options = {
                parse_mode: 'Markdown',
                reply_markup: keyboard
            };

            if (messageId) {
                this.bot.editMessageText(caption, {
                    chat_id: chatId,
                    message_id: messageId,
                    ...options
                });
            } else {
                this.bot.sendMessage(chatId, caption, options);
            }
        }
    }

    async handleGalleryNavigation(chatId, messageId, sessionId, userId) {
        const [direction, actualSessionId] = sessionId.split('_');
        const session = this.searchSessions.get(actualSessionId);
        
        if (!session) {
            throw new Error('Search session not found');
        }

        if (direction === 'prev' && session.currentIndex > 0) {
            session.currentIndex--;
        } else if (direction === 'next' && session.currentIndex < session.results.length - 1) {
            session.currentIndex++;
        }

        await this.showAnimeGallery(chatId, messageId, actualSessionId, userId);
    }

    async handleAnimeSelection(chatId, messageId, sessionId, userId) {
        const session = this.searchSessions.get(sessionId);
        if (!session) {
            throw new Error('Search session not found');
        }

        const selectedAnime = session.results[session.currentIndex];
        
        // Get detailed anime info
        const loadingMessage = '📱 Loading anime details...';
        await this.bot.editMessageText(loadingMessage, {
            chat_id: chatId,
            message_id: messageId
        });

        try {
            const response = await axios.get(`${this.apiBase}/anime/info/${selectedAnime.id}`);
            const animeInfo = response.data;

            // Store anime info for episode selection
            const animeSessionId = this.createShortHash(`${userId}_${selectedAnime.id}_${Date.now()}`);
            this.animeCache.set(animeSessionId, animeInfo);

            await this.showSelectedAnimeInfo(chatId, messageId, animeInfo, animeSessionId, userId);

        } catch (error) {
            console.error('❌ Error fetching anime info:', error);
            this.bot.editMessageText('❌ Failed to load anime information. Please try again.', {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: {
                    inline_keyboard: [[
                        { text: '⬅️ Back to Gallery', callback_data: this.generateSafeCallback('back', sessionId) },
                        { text: '🏠 Main Menu', callback_data: 'a_main' }
                    ]]
                }
            });
        }
    }

    async showSelectedAnimeInfo(chatId, messageId, anime, sessionId, userId) {
        let caption = `✅ *Selected Anime*\n\n`;
        caption += `🎌 *${anime.title}*\n`;
        if (anime.japaneseTitle) {
            caption += `🈲 *Japanese:* ${anime.japaneseTitle}\n`;
        }
        
        caption += `\n📊 *Details:*\n`;
        if (anime.type) caption += `🎭 Type: ${anime.type}\n`;
        if (anime.status) caption += `📡 Status: ${anime.status}\n`;
        if (anime.totalEpisodes) caption += `📺 Total Episodes: ${anime.totalEpisodes}\n`;
        if (anime.season) caption += `🗓 Season: ${anime.season}\n`;
        
        const availability = [];
        if (anime.hasSub) availability.push('🎌 Subtitled');
        if (anime.hasDub) availability.push('🎤 Dubbed');
        if (availability.length > 0) {
            caption += `🌐 Available: ${availability.join(', ')}\n`;
        }
        
        if (anime.genres && anime.genres.length > 0) {
            caption += `🏷 Genres: ${anime.genres.join(', ')}\n`;
        }

        if (anime.description) {
            caption += `\n📖 *Description:*\n${anime.description.length > 300 ? anime.description.substring(0, 300) + '...' : anime.description}\n`;
        }

        caption += `\n🎬 *Available Episodes:* ${anime.episodes ? anime.episodes.length : 0}`;

        const keyboard = { inline_keyboard: [] };

        // Episode options
        if (anime.episodes && anime.episodes.length > 0) {
            keyboard.inline_keyboard.push([
                { text: '📺 View Episodes', callback_data: this.generateSafeCallback('episodes', sessionId) }
            ]);

            // Quick access to first few episodes
            const quickEpisodes = anime.episodes.slice(0, 3);
            quickEpisodes.forEach(episode => {
                keyboard.inline_keyboard.push([{
                    text: `▶️ Episode ${episode.number}`,
                    callback_data: this.generateSafeCallback('episode', `${sessionId}_${episode.id}`)
                }]);
            });
        }

        // Navigation buttons
        keyboard.inline_keyboard.push([
            { text: '⬅️ Back to Search', callback_data: 'a_search' },
            { text: '🏠 Main Menu', callback_data: 'a_main' }
        ]);

        try {
            if (anime.image) {
                await this.bot.editMessageMedia({
                    type: 'photo',
                    media: anime.image,
                    caption: caption,
                    parse_mode: 'Markdown'
                }, {
                    chat_id: chatId,
                    message_id: messageId,
                    reply_markup: keyboard
                });
            } else {
                this.bot.editMessageText(caption, {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                });
            }
        } catch (error) {
            console.error('Error showing selected anime info:', error);
            this.bot.editMessageText(caption, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });
        }
    }

    async showEpisodeList(chatId, messageId, sessionId, userId) {
        const anime = this.animeCache.get(sessionId);
        if (!anime) {
            throw new Error('Anime data not found');
        }

        let message = `📺 *Episode List - ${anime.title}*\n\n`;
        message += `📊 Total Episodes: ${anime.episodes ? anime.episodes.length : 0}\n\n`;

        const keyboard = { inline_keyboard: [] };

        if (anime.episodes && anime.episodes.length > 0) {
            // Show episodes in groups of 5
            const episodesPerPage = 5;
            const episodes = anime.episodes.slice(0, episodesPerPage * 3); // Show first 15 episodes

            episodes.forEach((episode, index) => {
                if (index % 2 === 0) {
                    const row = [];
                    row.push({
                        text: `EP ${episode.number}`,
                        callback_data: this.generateSafeCallback('episode', `${sessionId}_${episode.id}`)
                    });
                    
                    if (episodes[index + 1]) {
                        row.push({
                            text: `EP ${episodes[index + 1].number}`,
                            callback_data: this.generateSafeCallback('episode', `${sessionId}_${episodes[index + 1].id}`)
                        });
                    }
                    
                    keyboard.inline_keyboard.push(row);
                }
            });

            if (anime.episodes.length > 15) {
                keyboard.inline_keyboard.push([{
                    text: `📋 Show All ${anime.episodes.length} Episodes`,
                    callback_data: this.generateSafeCallback('episodes', `all_${sessionId}`)
                }]);
            }
        } else {
            message += `❌ No episodes available for this anime.`;
        }

        keyboard.inline_keyboard.push([
            { text: '⬅️ Back to Anime', callback_data: this.generateSafeCallback('back', sessionId) },
            { text: '🏠 Main Menu', callback_data: 'a_main' }
        ]);

        this.bot.editMessageText(message, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }

    async showEpisodeOptions(chatId, messageId, sessionId, userId) {
        const [animeSessionId, episodeId] = sessionId.split('_');
        const anime = this.animeCache.get(animeSessionId);
        
        if (!anime) {
            throw new Error('Anime data not found');
        }

        const episode = anime.episodes.find(ep => ep.id === episodeId);
        if (!episode) {
            throw new Error('Episode not found');
        }

        const loadingMessage = '⚙️ Loading episode options...';
        await this.bot.editMessageText(loadingMessage, {
            chat_id: chatId,
            message_id: messageId
        });

        try {
            const response = await axios.get(`${this.apiBase}/anime/sources/${episodeId}`);
            const sources = response.data;

            let message = `📺 *Episode ${episode.number} - ${anime.title}*\n\n`;
            message += `🎬 Episode ID: ${episodeId}\n`;
            message += `🔗 Available Sources: ${sources.sources ? sources.sources.length : 0}\n\n`;

            if (sources.sources && sources.sources.length > 0) {
                message += `📊 *Available Options:*\n`;
                
                const keyboard = { inline_keyboard: [] };

                // Sub/Dub options
                if (anime.hasSub) {
                    keyboard.inline_keyboard.push([{
                        text: '🎌 Download SUB',
                        callback_data: this.generateSafeCallback('download', `sub_${episodeId}`)
                    }]);
                }
                
                if (anime.hasDub) {
                    keyboard.inline_keyboard.push([{
                        text: '🎤 Download DUB',
                        callback_data: this.generateSafeCallback('download', `dub_${episodeId}`)
                    }]);
                }

                // Quality options
                const qualities = [...new Set(sources.sources.map(s => s.quality))].slice(0, 3);
                qualities.forEach(quality => {
                    keyboard.inline_keyboard.push([{
                        text: `📹 ${quality}`,
                        callback_data: this.generateSafeCallback('download', `${quality}_${episodeId}`)
                    }]);
                });

                // Quick download
                keyboard.inline_keyboard.push([{
                    text: '⬇️ Quick Download (Best Quality)',
                    callback_data: this.generateSafeCallback('download', `best_${episodeId}`)
                }]);

                // Navigation
                keyboard.inline_keyboard.push([
                    { text: '⬅️ Back to Episodes', callback_data: this.generateSafeCallback('episodes', animeSessionId) },
                    { text: '🏠 Main Menu', callback_data: 'a_main' }
                ]);

                this.bot.editMessageText(message, {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                });
            } else {
                message += `❌ No download sources available for this episode.`;
                
                this.bot.editMessageText(message, {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '⬅️ Back to Episodes', callback_data: this.generateSafeCallback('episodes', animeSessionId) },
                            { text: '🏠 Main Menu', callback_data: 'a_main' }
                        ]]
                    }
                });
            }

        } catch (error) {
            console.error('❌ Error fetching episode sources:', error);
            this.bot.editMessageText('❌ Failed to load episode sources. Please try again.', {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: {
                    inline_keyboard: [[
                        { text: '⬅️ Back to Episodes', callback_data: this.generateSafeCallback('episodes', animeSessionId) },
                        { text: '🏠 Main Menu', callback_data: 'a_main' }
                    ]]
                }
            });
        }
    }

    async handleDownload(chatId, messageId, sessionId, userId) {
        const [type, episodeId] = sessionId.split('_');
        
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
                    { text: '📥 View Queue', callback_data: 'a_queue' },
                    { text: '⬇️ Download Another', callback_data: 'a_search' }
                ],
                [
                    { text: '🏠 Main Menu', callback_data: 'a_main' }
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
                        { text: '⬇️ Download More', callback_data: 'a_search' },
                        { text: '🏠 Main Menu', callback_data: 'a_main' }
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
                const statusIcon = download.status === 'completed' ? '✅' : '⏳';
                const timeAgo = Math.floor((Date.now() - download.timestamp) / 1000 / 60);
                message += `${statusIcon} *Download ${index + 1}*\n`;
                message += `🎬 Episode: ${download.episodeId}\n`;
                message += `🎌 Type: ${download.type.toUpperCase()}\n`;
                message += `📊 Status: ${download.status}\n`;
                message += `⏰ ${timeAgo} minutes ago\n\n`;
            });
        }

        const keyboard = {
            inline_keyboard: [
                [
                    { text: '🔄 Refresh Queue', callback_data: 'a_queue' },
                    { text: '⬇️ Download More', callback_data: 'a_search' }
                ],
                [
                    { text: '🏠 Main Menu', callback_data: 'a_main' }
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
        const loadingMessage = '📊 Loading popular anime...';
        await this.bot.editMessageText(loadingMessage, {
            chat_id: chatId,
            message_id: messageId
        });

        try {
            const response = await axios.get(`${this.apiBase}/anime/popular`);
            const popularAnime = response.data.results || [];

            let message = `📊 *Popular Anime*\n\n`;
            message += `🔥 Top trending anime right now:\n\n`;

            const keyboard = { inline_keyboard: [] };

            if (popularAnime.length > 0) {
                popularAnime.slice(0, 10).forEach((anime, index) => {
                    const rank = index + 1;
                    const button = {
                        text: `${rank}. ${anime.title}`,
                        callback_data: this.generateSafeCallback('result', anime.id)
                    };
                    keyboard.inline_keyboard.push([button]);
                });
            } else {
                message += `❌ No popular anime data available.`;
            }

            keyboard.inline_keyboard.push([
                { text: '🔍 Search Anime', callback_data: 'a_search' },
                { text: '🏠 Main Menu', callback_data: 'a_main' }
            ]);

            this.bot.editMessageText(message, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });

        } catch (error) {
            console.error('❌ Error fetching popular anime:', error);
            this.bot.editMessageText('❌ Failed to load popular anime. Please try again.', {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: {
                    inline_keyboard: [[
                        { text: '🔍 Search Instead', callback_data: 'a_search' },
                        { text: '🏠 Main Menu', callback_data: 'a_main' }
                    ]]
                }
            });
        }
    }

    async handlePageNavigation(chatId, messageId, sessionId, userId) {
        // Handle pagination for search results
        const session = this.searchSessions.get(sessionId);
        if (!session) {
            throw new Error('Search session not found');
        }

        if (session.hasNextPage) {
            await this.searchAnime(chatId, session.query, userId, session.currentPage + 1);
        }
    }

    async handleBackNavigation(chatId, messageId, sessionId, userId) {
        // Handle back navigation based on context
        const session = this.searchSessions.get(sessionId);
        if (session) {
            await this.showAnimeGallery(chatId, messageId, sessionId, userId);
        } else {
            this.showMainMenu(chatId, messageId);
        }
    }

    // Clean up expired sessions and downloads
    cleanupExpiredSessions() {
        const now = Date.now();
        const expireTime = 30 * 60 * 1000; // 30 minutes

        // Clean up search sessions
        for (const [sessionId, session] of this.searchSessions.entries()) {
            if (now - session.timestamp > expireTime) {
                this.searchSessions.delete(sessionId);
            }
        }

        // Clean up anime cache
        for (const [cacheId, data] of this.animeCache.entries()) {
            if (now - (data.timestamp || 0) > expireTime) {
                this.animeCache.delete(cacheId);
            }
        }

        // Clean up completed downloads older than 1 hour
        for (const [downloadId, download] of this.downloadQueue.entries()) {
            if (download.status === 'completed' && now - download.timestamp > 60 * 60 * 1000) {
                this.downloadQueue.delete(downloadId);
            }
        }
    }

    // Initialize cleanup interval
    startCleanupInterval() {
        setInterval(() => {
            this.cleanupExpiredSessions();
        }, 5 * 60 * 1000); // Clean every 5 minutes
    }
}

module.exports = AnimeCommand; 