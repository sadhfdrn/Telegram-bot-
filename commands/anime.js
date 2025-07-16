const axios = require('axios');
const fs = require('fs');
const path = require('path');

class AnimeCommand {
    constructor(bot, botManager) {
        this.bot = bot;
        this.botManager = botManager;
        this.apiBaseUrl = 'https://coloured-georgette-ogcheel-8222b3ae.koyeb.app';
        this.maxCaptionLength = 1024; // Telegram caption limit
        this.downloadDir = path.join(__dirname, '..', 'downloads');
        
        // Ensure download directory exists
        if (!fs.existsSync(this.downloadDir)) {
            fs.mkdirSync(this.downloadDir, { recursive: true });
        }
    }

    init() {
        // Set up command handler
        this.bot.onText(/\/anime/, (msg) => {
            this.handleAnimeCommand(msg);
        });
    }

    getMainButton() {
        return { text: '🎬 Anime Search', callback_data: 'anime_start' };
    }

    async handleAnimeCommand(msg) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;

        // Clear any existing state
        this.botManager.clearUserState(userId);

        await this.showSearchPrompt(chatId);
    }

    async showSearchPrompt(chatId, messageId = null) {
        const message = `🎬 *Anime Search*

Please enter the name of the anime you want to search for:

Example: "Dandadan", "Naruto", "One Piece"`;

        const keyboard = {
            inline_keyboard: [[
                { text: '❌ Cancel', callback_data: 'anime_cancel' }
            ]]
        };

        if (messageId) {
            try {
                await this.bot.editMessageText(message, {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                });
            } catch (error) {
                console.error('Error editing message:', error.message);
            }
        } else {
            await this.bot.sendMessage(chatId, message, {
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });
        }
    }

    async handleCallback(callbackQuery, botManager) {
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        const data = callbackQuery.data;
        const userId = callbackQuery.from.id;

        if (data === 'anime_start') {
            await this.showSearchPrompt(chatId, messageId);
            // Set user state to expect anime search input
            botManager.setUserState(userId, {
                commandName: 'anime',
                step: 'waiting_for_search',
                chatId: chatId,
                messageId: messageId
            });
            return true;
        }

        if (data === 'anime_cancel') {
            botManager.clearUserState(userId);
            return false; // Let main handler deal with this
        }

        if (data.startsWith('anime_')) {
            const userState = botManager.getUserState(userId);
            
            if (data.startsWith('anime_select_')) {
                const animeId = data.replace('anime_select_', '');
                await this.handleAnimeSelection(chatId, messageId, animeId, userId, botManager);
                return true;
            }

            if (data.startsWith('anime_episodes_')) {
                const animeId = data.replace('anime_episodes_', '');
                await this.showEpisodeList(chatId, messageId, animeId, userId, botManager);
                return true;
            }

            if (data.startsWith('anime_episode_')) {
                const episodeData = data.replace('anime_episode_', '');
                await this.handleEpisodeSelection(chatId, messageId, episodeData, userId, botManager);
                return true;
            }

            if (data.startsWith('anime_download_')) {
                const downloadData = data.replace('anime_download_', '');
                await this.downloadEpisode(chatId, messageId, downloadData, userId, botManager);
                return true;
            }

            if (data.startsWith('anime_page_')) {
                const pageData = data.replace('anime_page_', '');
                const [direction, currentPage] = pageData.split('_');
                await this.handlePageNavigation(chatId, messageId, direction, parseInt(currentPage), userId, botManager);
                return true;
            }

            if (data.startsWith('anime_ep_page_')) {
                const pageData = data.replace('anime_ep_page_', '');
                const [animeId, direction, currentPage] = pageData.split('_');
                await this.handleEpisodePageNavigation(chatId, messageId, animeId, direction, parseInt(currentPage), userId, botManager);
                return true;
            }
        }

        return false;
    }

    async handleTextInput(msg, userState, botManager) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const text = msg.text.trim();

        if (userState.step === 'waiting_for_search') {
            if (text.length < 2) {
                await this.bot.sendMessage(chatId, '❌ Please enter at least 2 characters for the search.');
                return;
            }

            await this.searchAnime(chatId, text, userId, botManager);
        }
    }

    async searchAnime(chatId, query, userId, botManager) {
        const loadingMsg = await this.bot.sendMessage(chatId, '🔍 Searching for anime...');

        try {
            const response = await axios.get(`${this.apiBaseUrl}/anime/search/${encodeURIComponent(query)}`);
            const searchResults = response.data;

            if (!searchResults.results || searchResults.results.length === 0) {
                await this.bot.editMessageText('❌ No anime found with that name. Please try a different search term.', {
                    chat_id: chatId,
                    message_id: loadingMsg.message_id,
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '🔍 Search Again', callback_data: 'anime_start' },
                            { text: '❌ Cancel', callback_data: 'anime_cancel' }
                        ]]
                    }
                });
                return;
            }

            // Update user state with search results
            botManager.setUserState(userId, {
                commandName: 'anime',
                step: 'viewing_results',
                chatId: chatId,
                searchResults: searchResults,
                currentPage: 1,
                query: query
            });

            await this.showSearchResults(chatId, loadingMsg.message_id, searchResults, 1, userId, botManager);

        } catch (error) {
            console.error('Error searching anime:', error.message);
            await this.bot.editMessageText('❌ Error searching for anime. Please try again later.', {
                chat_id: chatId,
                message_id: loadingMsg.message_id,
                reply_markup: {
                    inline_keyboard: [[
                        { text: '🔍 Search Again', callback_data: 'anime_start' },
                        { text: '❌ Cancel', callback_data: 'anime_cancel' }
                    ]]
                }
            });
        }
    }

    async showSearchResults(chatId, messageId, searchResults, currentPage, userId, botManager) {
        const resultsPerPage = 5;
        const startIndex = (currentPage - 1) * resultsPerPage;
        const endIndex = startIndex + resultsPerPage;
        const pageResults = searchResults.results.slice(startIndex, endIndex);

        let message = `🎬 *Search Results* (Page ${currentPage}/${Math.ceil(searchResults.results.length / resultsPerPage)})\n\n`;

        pageResults.forEach((anime, index) => {
            const globalIndex = startIndex + index + 1;
            message += `${globalIndex}. *${anime.title}*\n`;
            if (anime.japaneseTitle) {
                message += `   📝 ${anime.japaneseTitle}\n`;
            }
            message += `   📺 Episodes: ${anime.episodes || 'N/A'}\n`;
            message += `   🎭 Sub: ${anime.sub || 0} | Dub: ${anime.dub || 0}\n\n`;
        });

        const keyboard = {
            inline_keyboard: []
        };

        // Add anime selection buttons
        pageResults.forEach((anime, index) => {
            const globalIndex = startIndex + index + 1;
            keyboard.inline_keyboard.push([{
                text: `${globalIndex}. ${anime.title}`,
                callback_data: `anime_select_${anime.id}`
            }]);
        });

        // Add navigation buttons
        const navButtons = [];
        if (currentPage > 1) {
            navButtons.push({ text: '◀️ Previous', callback_data: `anime_page_prev_${currentPage}` });
        }
        if (endIndex < searchResults.results.length) {
            navButtons.push({ text: '▶️ Next', callback_data: `anime_page_next_${currentPage}` });
        }
        if (navButtons.length > 0) {
            keyboard.inline_keyboard.push(navButtons);
        }

        // Add control buttons
        keyboard.inline_keyboard.push([
            { text: '🔍 New Search', callback_data: 'anime_start' },
            { text: '❌ Cancel', callback_data: 'anime_cancel' }
        ]);

        await this.bot.editMessageText(message, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }

    async handlePageNavigation(chatId, messageId, direction, currentPage, userId, botManager) {
        const userState = botManager.getUserState(userId);
        if (!userState || !userState.searchResults) return;

        const newPage = direction === 'next' ? currentPage + 1 : currentPage - 1;
        
        // Update user state
        userState.currentPage = newPage;
        botManager.setUserState(userId, userState);

        await this.showSearchResults(chatId, messageId, userState.searchResults, newPage, userId, botManager);
    }

    async handleAnimeSelection(chatId, messageId, animeId, userId, botManager) {
        const loadingMsg = await this.bot.editMessageText('📥 Loading anime information...', {
            chat_id: chatId,
            message_id: messageId
        });

        try {
            const response = await axios.get(`${this.apiBaseUrl}/anime/info/${animeId}`);
            const animeInfo = response.data;

            // Update user state
            botManager.setUserState(userId, {
                commandName: 'anime',
                step: 'viewing_anime',
                chatId: chatId,
                animeInfo: animeInfo,
                animeId: animeId
            });

            await this.showAnimeInfo(chatId, messageId, animeInfo, userId, botManager);

        } catch (error) {
            console.error('Error fetching anime info:', error.message);
            await this.bot.editMessageText('❌ Error loading anime information. Please try again.', {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: {
                    inline_keyboard: [[
                        { text: '🔙 Back to Results', callback_data: 'anime_start' },
                        { text: '❌ Cancel', callback_data: 'anime_cancel' }
                    ]]
                }
            });
        }
    }

    async showAnimeInfo(chatId, messageId, animeInfo, userId, botManager) {
        // Prepare description with length limit
        let description = animeInfo.description || 'No description available.';
        
        // Create a summary for caption limit
        const infoText = `*${animeInfo.title}*\n${animeInfo.japaneseTitle || ''}\n\n`;
        const availableLength = this.maxCaptionLength - infoText.length - 100; // Leave some buffer
        
        if (description.length > availableLength) {
            description = description.substring(0, availableLength - 3) + '...';
        }

        const caption = `${infoText}${description}\n\n📺 Episodes: ${animeInfo.totalEpisodes || 'N/A'}\n🎭 Sub: ${animeInfo.hasSub ? '✅' : '❌'} | Dub: ${animeInfo.hasDub ? '✅' : '❌'}\n📅 Status: ${animeInfo.status || 'N/A'}\n🌟 Season: ${animeInfo.season || 'N/A'}`;

        const keyboard = {
            inline_keyboard: [
                [{ text: '📺 View Episodes', callback_data: `anime_episodes_${animeInfo.id}` }],
                [
                    { text: '🔙 Back', callback_data: 'anime_start' },
                    { text: '❌ Cancel', callback_data: 'anime_cancel' }
                ]
            ]
        };

        if (animeInfo.image) {
            try {
                await this.bot.editMessageMedia({
                    type: 'photo',
                    media: animeInfo.image,
                    caption: caption,
                    parse_mode: 'Markdown'
                }, {
                    chat_id: chatId,
                    message_id: messageId,
                    reply_markup: keyboard
                });
            } catch (error) {
                // If image fails, send as text
                await this.bot.editMessageText(caption, {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                });
            }
        } else {
            await this.bot.editMessageText(caption, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });
        }
    }

    async showEpisodeList(chatId, messageId, animeId, userId, botManager) {
        const userState = botManager.getUserState(userId);
        if (!userState || !userState.animeInfo) return;

        const animeInfo = userState.animeInfo;
        const episodes = animeInfo.episodes || [];
        
        if (episodes.length === 0) {
            await this.bot.editMessageText('❌ No episodes available for this anime.', {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: {
                    inline_keyboard: [[
                        { text: '🔙 Back', callback_data: `anime_select_${animeId}` },
                        { text: '❌ Cancel', callback_data: 'anime_cancel' }
                    ]]
                }
            });
            return;
        }

        await this.showEpisodePage(chatId, messageId, animeInfo, episodes, 1, userId, botManager);
    }

    async showEpisodePage(chatId, messageId, animeInfo, episodes, currentPage, userId, botManager) {
        const episodesPerPage = 10;
        const startIndex = (currentPage - 1) * episodesPerPage;
        const endIndex = startIndex + episodesPerPage;
        const pageEpisodes = episodes.slice(startIndex, endIndex);
        const totalPages = Math.ceil(episodes.length / episodesPerPage);

        let message = `📺 *${animeInfo.title}* - Episodes\n`;
        message += `Page ${currentPage}/${totalPages}\n\n`;

        const keyboard = {
            inline_keyboard: []
        };

        pageEpisodes.forEach((episode) => {
            const episodeText = `Episode ${episode.number}${episode.title && episode.title !== `Ep ${episode.number}` ? ` - ${episode.title}` : ''}`;
            const availableOptions = [];
            
            if (episode.isSubbed) availableOptions.push('SUB');
            if (episode.isDubbed) availableOptions.push('DUB');
            
            const optionsText = availableOptions.length > 0 ? ` (${availableOptions.join('/')})` : '';
            
            keyboard.inline_keyboard.push([{
                text: `${episodeText}${optionsText}`,
                callback_data: `anime_episode_${episode.id}`
            }]);
        });

        // Add navigation buttons
        const navButtons = [];
        if (currentPage > 1) {
            navButtons.push({ text: '◀️ Previous', callback_data: `anime_ep_page_${animeInfo.id}_prev_${currentPage}` });
        }
        if (endIndex < episodes.length) {
            navButtons.push({ text: '▶️ Next', callback_data: `anime_ep_page_${animeInfo.id}_next_${currentPage}` });
        }
        if (navButtons.length > 0) {
            keyboard.inline_keyboard.push(navButtons);
        }

        // Add control buttons
        keyboard.inline_keyboard.push([
            { text: '🔙 Back to Info', callback_data: `anime_select_${animeInfo.id}` },
            { text: '❌ Cancel', callback_data: 'anime_cancel' }
        ]);

        await this.bot.editMessageText(message, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }

    async handleEpisodePageNavigation(chatId, messageId, animeId, direction, currentPage, userId, botManager) {
        const userState = botManager.getUserState(userId);
        if (!userState || !userState.animeInfo) return;

        const newPage = direction === 'next' ? currentPage + 1 : currentPage - 1;
        await this.showEpisodePage(chatId, messageId, userState.animeInfo, userState.animeInfo.episodes, newPage, userId, botManager);
    }

    async handleEpisodeSelection(chatId, messageId, episodeId, userId, botManager) {
        const userState = botManager.getUserState(userId);
        if (!userState || !userState.animeInfo) return;

        const episode = userState.animeInfo.episodes.find(ep => ep.id === episodeId);
        if (!episode) return;

        const message = `📺 *Episode ${episode.number}*\n${userState.animeInfo.title}\n\nSelect download option:`;
        
        const keyboard = {
            inline_keyboard: []
        };

        if (episode.isSubbed) {
            keyboard.inline_keyboard.push([{
                text: '🎭 Download SUB',
                callback_data: `anime_download_${episodeId}_sub`
            }]);
        }

        if (episode.isDubbed) {
            keyboard.inline_keyboard.push([{
                text: '🎭 Download DUB',
                callback_data: `anime_download_${episodeId}_dub`
            }]);
        }

        keyboard.inline_keyboard.push([
            { text: '🔙 Back to Episodes', callback_data: `anime_episodes_${userState.animeInfo.id}` },
            { text: '❌ Cancel', callback_data: 'anime_cancel' }
        ]);

        await this.bot.editMessageText(message, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }

    async downloadEpisode(chatId, messageId, downloadData, userId, botManager) {
        const [episodeId, type] = downloadData.split('_');
        const userState = botManager.getUserState(userId);
        
        if (!userState || !userState.animeInfo) return;

        const episode = userState.animeInfo.episodes.find(ep => ep.id === episodeId);
        if (!episode) return;

        const loadingMsg = await this.bot.editMessageText('⏳ Preparing download...', {
            chat_id: chatId,
            message_id: messageId
        });

        try {
            // Get episode sources
            const response = await axios.get(`${this.apiBaseUrl}/anime/sources/${episodeId}`);
            const sourceData = response.data;

            if (!sourceData.sources || sourceData.sources.length === 0) {
                await this.bot.editMessageText('❌ No download sources available for this episode.', {
                    chat_id: chatId,
                    message_id: messageId,
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '🔙 Back', callback_data: `anime_episode_${episodeId}` },
                            { text: '❌ Cancel', callback_data: 'anime_cancel' }
                        ]]
                    }
                });
                return;
            }

            // Find best quality source
            const source = sourceData.sources.find(s => s.quality === '720p') || 
                          sourceData.sources.find(s => s.quality === '480p') || 
                          sourceData.sources[0];

            await this.bot.editMessageText('📥 Downloading episode...', {
                chat_id: chatId,
                message_id: messageId
            });

            // Download the video
            const videoResponse = await axios({
                method: 'GET',
                url: source.url,
                responseType: 'stream',
                headers: sourceData.headers || {}
            });

            const filename = `${userState.animeInfo.title}_Episode_${episode.number}_${type.toUpperCase()}.mp4`;
            const filepath = path.join(this.downloadDir, filename);

            // Save to file
            const writer = fs.createWriteStream(filepath);
            videoResponse.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            // Send the video file
            await this.bot.editMessageText('📤 Uploading episode...', {
                chat_id: chatId,
                message_id: messageId
            });

            const caption = `📺 *${userState.animeInfo.title}*\nEpisode ${episode.number} (${type.toUpperCase()})\nQuality: ${source.quality}`;

            await this.bot.sendVideo(chatId, filepath, {
                caption: caption,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[
                        { text: '🔙 Back to Episodes', callback_data: `anime_episodes_${userState.animeInfo.id}` },
                        { text: '❌ Close', callback_data: 'anime_cancel' }
                    ]]
                }
            });

            // Clean up the downloaded file
            fs.unlink(filepath, (err) => {
                if (err) console.error('Error deleting file:', err);
            });

            // Delete the loading message
            await this.bot.deleteMessage(chatId, messageId);

        } catch (error) {
            console.error('Error downloading episode:', error.message);
            await this.bot.editMessageText('❌ Error downloading episode. Please try again later.', {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: {
                    inline_keyboard: [[
                        { text: '🔙 Back', callback_data: `anime_episode_${episodeId}` },
                        { text: '❌ Cancel', callback_data: 'anime_cancel' }
                    ]]
                }
            });
        }
    }

    showCommandMenu(chatId, messageId) {
        return this.showSearchPrompt(chatId, messageId);
    }

    getInfo() {
        return {
            name: 'anime',
            description: 'Search and download anime episodes',
            version: '1.0.0'
        };
    }
}

module.exports = AnimeCommand;
