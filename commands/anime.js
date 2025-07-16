const axios = require('axios');
const path = require('path');
const fs = require('fs');

class AnimeCommand {
    constructor(bot, botManager) {
        this.bot = bot;
        this.botManager = botManager;
        this.apiBaseUrl = 'https://coloured-georgette-ogcheel-8222b3ae.koyeb.app';
        this.userSearchResults = new Map(); // Store search results for each user
        this.userAnimeInfo = new Map(); // Store anime info for each user
    }

    init() {
        console.log('🎌 Anime command initialized');
    }

    getMainButton() {
        return {
            text: '🎌 Anime Search & Download',
            callback_data: 'anime_menu'
        };
    }

    handleCallback(callbackQuery, botManager) {
        const data = callbackQuery.data;
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        const userId = callbackQuery.from.id;

        if (data === 'anime_menu') {
            this.showAnimeMenu(chatId, messageId);
            return true;
        }

        if (data === 'anime_search') {
            this.initiateSearch(chatId, messageId, userId);
            return true;
        }

        if (data.startsWith('anime_nav_')) {
            const [, , action, currentIndex] = data.split('_');
            this.handleNavigation(chatId, messageId, userId, action, parseInt(currentIndex));
            return true;
        }

        if (data.startsWith('anime_select_')) {
            const [, , currentIndex] = data.split('_');
            this.selectAnime(chatId, messageId, userId, parseInt(currentIndex));
            return true;
        }

        if (data.startsWith('anime_episodes_')) {
            const [, , type] = data.split('_'); // 'sub' or 'dub'
            this.showEpisodeOptions(chatId, messageId, userId, type);
            return true;
        }

        if (data === 'anime_back_to_search') {
            this.showSearchResults(chatId, messageId, userId, 0);
            return true;
        }

        return false;
    }

    handleTextInput(msg, userState, botManager) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const text = msg.text.trim();

        if (userState.action === 'searching') {
            this.performSearch(chatId, userId, text);
        } else if (userState.action === 'episode_input') {
            this.handleEpisodeInput(chatId, userId, text, userState.episodeType);
        }
    }

    showAnimeMenu(chatId, messageId) {
        const menuMessage = `🎌 *Anime Search & Download*

Search for your favorite anime and download episodes!

Features:
• 🔍 Search anime by title
• 📺 Browse anime details
• 📱 Interactive carousel interface
• 💾 Download episodes (Sub/Dub)
• 🎭 High-quality sources

Click the button below to start searching!`;

        const keyboard = {
            inline_keyboard: [
                [{ text: '🔍 Search Anime', callback_data: 'anime_search' }],
                [{ text: '🏠 Back to Main Menu', callback_data: 'show_commands' }]
            ]
        };

        this.bot.editMessageText(menuMessage, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }

    initiateSearch(chatId, messageId, userId) {
        const searchMessage = `🔍 *Anime Search*

Please enter the name of the anime you want to search for:

Example: "Dandadan", "Naruto", "One Piece"`;

        this.botManager.setUserState(userId, {
            action: 'searching',
            commandName: 'anime'
        });

        this.bot.editMessageText(searchMessage, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '❌ Cancel', callback_data: 'anime_menu' }]
                ]
            }
        });
    }

    async performSearch(chatId, userId, query) {
        const loadingMessage = await this.bot.sendMessage(chatId, '🔍 Searching for anime... Please wait!');

        try {
            const response = await axios.get(`${this.apiBaseUrl}/anime/search/${encodeURIComponent(query)}`, {
                timeout: 10000
            });

            if (response.data && response.data.results && response.data.results.length > 0) {
                this.userSearchResults.set(userId, response.data.results);
                this.showSearchResults(chatId, loadingMessage.message_id, userId, 0);
            } else {
                this.bot.editMessageText(`❌ No anime found for "${query}". Please try a different search term.`, {
                    chat_id: chatId,
                    message_id: loadingMessage.message_id,
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🔍 Search Again', callback_data: 'anime_search' }],
                            [{ text: '🏠 Back to Menu', callback_data: 'anime_menu' }]
                        ]
                    }
                });
            }
        } catch (error) {
            console.error('Error searching anime:', error);
            this.bot.editMessageText('❌ Error occurred while searching. Please try again later.', {
                chat_id: chatId,
                message_id: loadingMessage.message_id,
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔍 Try Again', callback_data: 'anime_search' }],
                        [{ text: '🏠 Back to Menu', callback_data: 'anime_menu' }]
                    ]
                }
            });
        }

        this.botManager.clearUserState(userId);
    }

    showSearchResults(chatId, messageId, userId, currentIndex) {
        const results = this.userSearchResults.get(userId);
        if (!results || results.length === 0) {
            this.showAnimeMenu(chatId, messageId);
            return;
        }

        const anime = results[currentIndex];
        const totalResults = results.length;
        
        // Truncate description for telegram caption limit
        const truncateText = (text, maxLength = 800) => {
            if (text.length <= maxLength) return text;
            return text.substring(0, maxLength - 3) + '...';
        };

        const caption = `🎌 *${anime.title}*
${anime.japaneseTitle ? `🇯🇵 ${anime.japaneseTitle}` : ''}

📊 *Episodes:* ${anime.episodes || 'N/A'}
${anime.sub ? `📺 Sub: ${anime.sub} episodes` : ''}
${anime.dub ? `🎙️ Dub: ${anime.dub} episodes` : ''}

📑 *Result ${currentIndex + 1} of ${totalResults}*`;

        const keyboard = {
            inline_keyboard: []
        };

        // Navigation buttons
        const navButtons = [];
        if (currentIndex > 0) {
            navButtons.push({ text: '⬅️ Previous', callback_data: `anime_nav_prev_${currentIndex}` });
        }
        if (currentIndex < totalResults - 1) {
            navButtons.push({ text: '➡️ Next', callback_data: `anime_nav_next_${currentIndex}` });
        }
        if (navButtons.length > 0) {
            keyboard.inline_keyboard.push(navButtons);
        }

        // Action buttons
        keyboard.inline_keyboard.push([
            { text: '✅ Select This Anime', callback_data: `anime_select_${currentIndex}` }
        ]);

        keyboard.inline_keyboard.push([
            { text: '🔍 New Search', callback_data: 'anime_search' },
            { text: '🏠 Back to Menu', callback_data: 'anime_menu' }
        ]);

        if (anime.image) {
            this.bot.editMessageMedia({
                type: 'photo',
                media: anime.image,
                caption: caption,
                parse_mode: 'Markdown'
            }, {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: keyboard
            }).catch(error => {
                // If image fails, send as text
                this.bot.editMessageText(caption, {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                });
            });
        } else {
            this.bot.editMessageText(caption, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });
        }
    }

    handleNavigation(chatId, messageId, userId, action, currentIndex) {
        const results = this.userSearchResults.get(userId);
        if (!results) return;

        let newIndex = currentIndex;
        if (action === 'next' && currentIndex < results.length - 1) {
            newIndex = currentIndex + 1;
        } else if (action === 'prev' && currentIndex > 0) {
            newIndex = currentIndex - 1;
        }

        this.showSearchResults(chatId, messageId, userId, newIndex);
    }

    async selectAnime(chatId, messageId, userId, currentIndex) {
        const results = this.userSearchResults.get(userId);
        if (!results || !results[currentIndex]) return;

        const selectedAnime = results[currentIndex];
        const loadingMessage = await this.bot.editMessageText('📱 Loading anime details... Please wait!', {
            chat_id: chatId,
            message_id: messageId
        });

        try {
            const response = await axios.get(`${this.apiBaseUrl}/anime/info/${selectedAnime.id}`, {
                timeout: 15000
            });

            if (response.data) {
                this.userAnimeInfo.set(userId, response.data);
                this.showAnimeDetails(chatId, messageId, userId, response.data);
            } else {
                throw new Error('No anime data received');
            }
        } catch (error) {
            console.error('Error fetching anime details:', error);
            this.bot.editMessageText('❌ Error loading anime details. Please try again.', {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔄 Try Again', callback_data: `anime_select_${currentIndex}` }],
                        [{ text: '⬅️ Back to Results', callback_data: 'anime_back_to_search' }]
                    ]
                }
            });
        }
    }

    showAnimeDetails(chatId, messageId, userId, animeInfo) {
        const truncateText = (text, maxLength = 600) => {
            if (!text) return 'No description available.';
            if (text.length <= maxLength) return text;
            return text.substring(0, maxLength - 3) + '...';
        };

        const description = truncateText(animeInfo.description);
        const genres = animeInfo.genres ? animeInfo.genres.join(', ') : 'N/A';

        const caption = `🎌 *${animeInfo.title}*
${animeInfo.japaneseTitle ? `🇯🇵 ${animeInfo.japaneseTitle}` : ''}

📝 *Description:*
${description}

📊 *Details:*
• Type: ${animeInfo.type || 'N/A'}
• Status: ${animeInfo.status || 'N/A'}
• Season: ${animeInfo.season || 'N/A'}
• Episodes: ${animeInfo.totalEpisodes || 'N/A'}
• Genres: ${genres}

🎭 *Available:*
${animeInfo.hasSub ? '✅ Subtitled' : '❌ No Subtitles'}
${animeInfo.hasDub ? '✅ Dubbed' : '❌ No Dub'}`;

        const keyboard = {
            inline_keyboard: []
        };

        // Episode selection buttons
        const episodeButtons = [];
        if (animeInfo.hasSub) {
            episodeButtons.push({ text: '📺 Download Sub Episodes', callback_data: 'anime_episodes_sub' });
        }
        if (animeInfo.hasDub) {
            episodeButtons.push({ text: '🎙️ Download Dub Episodes', callback_data: 'anime_episodes_dub' });
        }

        if (episodeButtons.length > 0) {
            keyboard.inline_keyboard.push(episodeButtons);
        }

        // Navigation buttons
        keyboard.inline_keyboard.push([
            { text: '⬅️ Back to Results', callback_data: 'anime_back_to_search' },
            { text: '🏠 Main Menu', callback_data: 'anime_menu' }
        ]);

        if (animeInfo.image) {
            this.bot.editMessageMedia({
                type: 'photo',
                media: animeInfo.image,
                caption: caption,
                parse_mode: 'Markdown'
            }, {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: keyboard
            }).catch(error => {
                // If image fails, send as text
                this.bot.editMessageText(caption, {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                });
            });
        } else {
            this.bot.editMessageText(caption, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });
        }
    }

    showEpisodeOptions(chatId, messageId, userId, episodeType) {
        const animeInfo = this.userAnimeInfo.get(userId);
        if (!animeInfo) return;

        const totalEpisodes = animeInfo.totalEpisodes || animeInfo.episodes?.length || 0;
        const typeText = episodeType === 'sub' ? 'Subtitled' : 'Dubbed';

        const optionsMessage = `📺 *Episode Download - ${typeText}*

*${animeInfo.title}*
Available Episodes: *${totalEpisodes}*

📝 *How to specify episodes:*
• Single episode: \`5\`
• Episode range: \`2-8\`
• Multiple ranges: \`1-3,5-7\`
• All episodes: \`all\`

Please enter the episode(s) you want to download:`;

        this.botManager.setUserState(userId, {
            action: 'episode_input',
            commandName: 'anime',
            episodeType: episodeType
        });

        this.bot.editMessageText(optionsMessage, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '⬅️ Back to Anime', callback_data: 'anime_back_to_details' }],
                    [{ text: '❌ Cancel', callback_data: 'anime_menu' }]
                ]
            }
        });
    }

    async handleEpisodeInput(chatId, userId, episodeInput, episodeType) {
        const animeInfo = this.userAnimeInfo.get(userId);
        if (!animeInfo) return;

        const totalEpisodes = animeInfo.totalEpisodes || animeInfo.episodes?.length || 0;
        const episodes = this.parseEpisodeInput(episodeInput, totalEpisodes);

        if (episodes.length === 0) {
            this.bot.sendMessage(chatId, '❌ Invalid episode format. Please try again with a valid format like "5", "2-8", or "all".', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔄 Try Again', callback_data: `anime_episodes_${episodeType}` }]
                    ]
                }
            });
            return;
        }

        if (episodes.length > 10) {
            this.bot.sendMessage(chatId, '⚠️ Too many episodes requested. Please limit to 10 episodes at a time.', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔄 Try Again', callback_data: `anime_episodes_${episodeType}` }]
                    ]
                }
            });
            return;
        }

        const processingMessage = await this.bot.sendMessage(chatId, `📥 Starting download of ${episodes.length} episode(s)...\n\nThis may take a while depending on the episode size.`);

        await this.downloadEpisodes(chatId, animeInfo, episodes, episodeType, processingMessage.message_id);
        this.botManager.clearUserState(userId);
    }

    parseEpisodeInput(input, totalEpisodes) {
        const episodes = [];
        
        if (input.toLowerCase() === 'all') {
            for (let i = 1; i <= totalEpisodes; i++) {
                episodes.push(i);
            }
            return episodes;
        }

        const parts = input.split(',');
        
        for (const part of parts) {
            const trimmed = part.trim();
            
            if (trimmed.includes('-')) {
                const [start, end] = trimmed.split('-').map(x => parseInt(x.trim()));
                if (start && end && start <= end && start > 0 && end <= totalEpisodes) {
                    for (let i = start; i <= end; i++) {
                        if (!episodes.includes(i)) {
                            episodes.push(i);
                        }
                    }
                }
            } else {
                const episodeNum = parseInt(trimmed);
                if (episodeNum > 0 && episodeNum <= totalEpisodes && !episodes.includes(episodeNum)) {
                    episodes.push(episodeNum);
                }
            }
        }

        return episodes.sort((a, b) => a - b);
    }

    async downloadEpisodes(chatId, animeInfo, episodes, episodeType, messageId) {
        let successCount = 0;
        let failureCount = 0;

        for (let i = 0; i < episodes.length; i++) {
            const episodeNum = episodes[i];
            const episode = animeInfo.episodes?.find(ep => ep.number === episodeNum);

            if (!episode) {
                failureCount++;
                continue;
            }

            try {
                // Update progress
                this.bot.editMessageText(`📥 Downloading episode ${episodeNum}... (${i + 1}/${episodes.length})`, {
                    chat_id: chatId,
                    message_id: messageId
                });

                const sources = await this.getEpisodeSources(episode.id);
                if (sources && sources.length > 0) {
                    const bestSource = this.selectBestSource(sources);
                    await this.downloadAndSendEpisode(chatId, animeInfo, episodeNum, bestSource, episodeType);
                    successCount++;
                } else {
                    failureCount++;
                }

                // Add delay between downloads to avoid rate limiting
                if (i < episodes.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            } catch (error) {
                console.error(`Error downloading episode ${episodeNum}:`, error);
                failureCount++;
            }
        }

        // Final status update
        const statusMessage = `✅ *Download Complete!*

${successCount} episode(s) downloaded successfully
${failureCount > 0 ? `${failureCount} episode(s) failed` : ''}

*${animeInfo.title}* - ${episodeType === 'sub' ? 'Subtitled' : 'Dubbed'}`;

        this.bot.editMessageText(statusMessage, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔍 Search More', callback_data: 'anime_search' }],
                    [{ text: '🏠 Main Menu', callback_data: 'anime_menu' }]
                ]
            }
        });
    }

    async getEpisodeSources(episodeId) {
        try {
            const response = await axios.get(`${this.apiBaseUrl}/anime/sources/${episodeId}`, {
                timeout: 10000
            });
            return response.data?.sources || [];
        } catch (error) {
            console.error('Error fetching episode sources:', error);
            return [];
        }
    }

    selectBestSource(sources) {
        // Priority order: 720p, 480p, 360p, others
        const qualityPriority = ['720p', '480p', '360p'];
        
        for (const quality of qualityPriority) {
            const source = sources.find(s => s.quality === quality);
            if (source) return source;
        }
        
        return sources[0]; // Return first available if no preferred quality found
    }

    async downloadAndSendEpisode(chatId, animeInfo, episodeNum, source, episodeType) {
        try {
            const response = await axios.get(source.url, {
                responseType: 'stream',
                timeout: 30000,
                headers: {
                    'Referer': 'https://monkey-d-luffy.site/'
                }
            });

            const fileName = `${animeInfo.title.replace(/[^a-zA-Z0-9]/g, '_')}_Episode_${episodeNum}_${episodeType}_${source.quality}.mp4`;
            const caption = `🎌 *${animeInfo.title}*\n📺 Episode ${episodeNum} (${episodeType === 'sub' ? 'Subtitled' : 'Dubbed'})\n📱 Quality: ${source.quality}`;

            await this.bot.sendVideo(chatId, response.data, {
                caption: caption,
                parse_mode: 'Markdown',
                supports_streaming: true
            }, {
                filename: fileName,
                contentType: 'video/mp4'
            });

        } catch (error) {
            console.error(`Error downloading/sending episode ${episodeNum}:`, error);
            
            // Send error message for this specific episode
            this.bot.sendMessage(chatId, `❌ Failed to download Episode ${episodeNum}. Source may be unavailable.`);
        }
    }

    async shutdown() {
        // Clean up any resources if needed
        this.userSearchResults.clear();
        this.userAnimeInfo.clear();
        console.log('🎌 Anime command shutdown complete');
    }
}

module.exports = AnimeCommand;
