const axios = require('axios');

class AnimeService {
    constructor() {
        this.apiBase = 'https://coloured-georgette-ogcheel-8222b3ae.koyeb.app';
        this.downloadQueue = new Map(); // Track active downloads
        this.userCache = new Map(); // Cache search results for users
        this.animeCache = new Map(); // Cache anime details for callback handling
        this.searchSessions = new Map(); // Track user search sessions
        
        // Start cleanup interval
        this.startCleanupInterval();
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

    getAnimeFromCache(sessionId) {
        return this.animeCache.get(sessionId);
    }

    getSearchSession(sessionId) {
        return this.searchSessions.get(sessionId);
    }

    setSearchSession(sessionId, session) {
        this.searchSessions.set(sessionId, session);
    }

    getUserDownloads(userId) {
        return Array.from(this.downloadQueue.values()).filter(d => d.userId === userId);
    }

    async searchAnime(chatId, query, userId, bot, page = 1) {
        const loadingMessage = `🔍 Searching for "${query}"...`;
        const sentMsg = await bot.sendMessage(chatId, loadingMessage);

        try {
            const response = await axios.get(`${this.apiBase}/anime/search/${encodeURIComponent(query)}?page=${page}`);
            const data = response.data;

            if (!data.results || data.results.length === 0) {
                bot.editMessageText(`❌ No anime found for "${query}"\n\nTry searching with a different name or check the spelling.`, {
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
                hasNextPage: data.hasNextPage || false,
                timestamp: Date.now()
            });

            // Delete loading message and show gallery
            await bot.deleteMessage(chatId, sentMsg.message_id);
            
            // Import AnimeUI to show gallery
            const AnimeUI = require('./animeUI');
            const animeUI = new AnimeUI(bot, this);
            await animeUI.showAnimeGallery(chatId, null, sessionId, userId);

        } catch (error) {
            console.error('❌ Error searching anime:', error);
            bot.editMessageText('❌ Failed to search anime. Please try again later.', {
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

    async handleAnimeSelection(chatId, messageId, sessionId, userId, bot) {
        const session = this.searchSessions.get(sessionId);
        if (!session) {
            throw new Error('Search session not found');
        }

        const selectedAnime = session.results[session.currentIndex];
        
        // Get detailed anime info
        const loadingMessage = '📱 Loading anime details...';
        await bot.editMessageText(loadingMessage, {
            chat_id: chatId,
            message_id: messageId
        });

        try {
            const response = await axios.get(`${this.apiBase}/anime/info/${selectedAnime.id}`);
            const animeInfo = response.data;

            // Store anime info for episode selection
            const animeSessionId = this.createShortHash(`${userId}_${selectedAnime.id}_${Date.now()}`);
            this.animeCache.set(animeSessionId, animeInfo);

            // Import AnimeUI to show selected anime info
            const AnimeUI = require('./animeUI');
            const animeUI = new AnimeUI(bot, this);
            await animeUI.showSelectedAnimeInfo(chatId, messageId, animeInfo, animeSessionId, userId);

        } catch (error) {
            console.error('❌ Error fetching anime info:', error);
            bot.editMessageText('❌ Failed to load anime information. Please try again.', {
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

    async showEpisodeOptions(chatId, messageId, sessionId, userId, bot) {
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
        await bot.editMessageText(loadingMessage, {
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

                bot.editMessageText(message, {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                });
            } else {
                message += `❌ No download sources available for this episode.`;
                
                bot.editMessageText(message, {
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
            bot.editMessageText('❌ Failed to load episode sources. Please try again.', {
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

    async handleDownload(chatId, messageId, sessionId, userId, bot) {
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

        bot.editMessageText(message, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });

        // Simulate download completion after 5 seconds
        setTimeout(() => {
            this.completeDownload(downloadId, chatId, bot);
        }, 5000);
    }

    completeDownload(downloadId, chatId, bot) {
        const download = this.downloadQueue.get(downloadId);
        if (download) {
            download.status = 'completed';
            
            const message = `✅ *Download Completed!*\n\n🎬 Episode: ${download.episodeId}\n🎌 Type: ${download.type.toUpperCase()}\n\n*Note:* In a real implementation, the video file would be sent here.`;
            
            bot.sendMessage(chatId, message, {
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

    async showPopularAnime(chatId, messageId, bot) {
        const loadingMessage = '📊 Loading popular anime...';
        await bot.editMessageText(loadingMessage, {
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

            bot.editMessageText(message, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });

        } catch (error) {
            console.error('❌ Error fetching popular anime:', error);
            bot.editMessageText('❌ Failed to load popular anime. Please try again.', {
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

    async handlePageNavigation(chatId, messageId, sessionId, userId, bot) {
        // Handle pagination for search results
        const session = this.searchSessions.get(sessionId);
        if (!session) {
            throw new Error('Search session not found');
        }

        if (session.hasNextPage) {
            await this.searchAnime(chatId, session.query, userId, bot, session.currentPage + 1);
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

module.exports = AnimeService;