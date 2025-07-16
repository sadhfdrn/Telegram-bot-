const https = require('https');
const axios = require('axios');

class AnimeCommand {
    constructor(bot, manager) {
        this.bot = bot;
        this.manager = manager;
        this.name = 'anime';
        this.baseUrl = 'https://coloured-georgette-ogcheel-8222b3ae.koyeb.app';
        this.userAnimeData = new Map(); // Store user search results and selections
    }

    init() {
        console.log('🎌 Anime command initialized');
    }

    getMainButton() {
        return {
            text: '🎌 Anime Search & Download',
            callback_data: 'anime_start'
        };
    }

    showCommandMenu(chatId, messageId) {
        const message = `🎌 *Anime Search & Download*

Search for your favorite anime and download episodes directly to Telegram!

🔍 Just type the anime name to start searching
📺 Browse through results with navigation buttons
⬇️ Download individual episodes or ranges

Type any anime name to begin your search:`;

        const keyboard = {
            inline_keyboard: [
                [{ text: '🏠 Back to Main Menu', callback_data: 'show_commands' }]
            ]
        };

        this.bot.editMessageText(message, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });

        // Set user state to expect anime search
        this.manager.setUserState(chatId, {
            commandName: 'anime',
            step: 'awaiting_search'
        });
    }

    async handleCallback(callbackQuery) {
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        const data = callbackQuery.data;
        const userId = callbackQuery.from.id;

        if (data === 'anime_start') {
            this.showCommandMenu(chatId, messageId);
            return true;
        }

        if (data.startsWith('anime_')) {
            const [, action, ...params] = data.split('_');
            
            switch (action) {
                case 'next':
                    await this.handleNavigation(chatId, messageId, userId, 'next');
                    break;
                case 'prev':
                    await this.handleNavigation(chatId, messageId, userId, 'prev');
                    break;
                case 'select':
                    await this.selectAnime(chatId, messageId, userId);
                    break;
                case 'episodes':
                    await this.showEpisodeOptions(chatId, messageId, userId);
                    break;
                case 'sub':
                    await this.handleSubDubSelection(chatId, messageId, userId, 'sub');
                    break;
                case 'dub':
                    await this.handleSubDubSelection(chatId, messageId, userId, 'dub');
                    break;
                case 'cancel':
                    this.showCommandMenu(chatId, messageId);
                    break;
            }
            return true;
        }

        return false;
    }

    async handleTextInput(msg, userState, manager) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const text = msg.text.trim();

        if (userState.step === 'awaiting_search') {
            await this.searchAnime(chatId, text, userId);
        } else if (userState.step === 'awaiting_episode_range') {
            await this.handleEpisodeRangeInput(chatId, userId, text);
        }

        manager.clearUserState(userId);
    }

    async searchAnime(chatId, query, userId) {
        const loadingMsg = await this.bot.sendMessage(chatId, '🔍 Searching for anime...', {
            reply_markup: {
                inline_keyboard: [[
                    { text: '❌ Cancel', callback_data: 'anime_cancel' }
                ]]
            }
        });

        try {
            const response = await this.makeRequest(`/anime/search/${encodeURIComponent(query)}`);
            
            if (!response.results || response.results.length === 0) {
                await this.bot.editMessageText('❌ No anime found for your search. Please try a different name.', {
                    chat_id: chatId,
                    message_id: loadingMsg.message_id,
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '🔍 Search Again', callback_data: 'anime_start' },
                            { text: '🏠 Main Menu', callback_data: 'show_commands' }
                        ]]
                    }
                });
                return;
            }

            // Store search results for user
            this.userAnimeData.set(userId, {
                searchResults: response.results,
                currentIndex: 0,
                query: query
            });

            await this.bot.deleteMessage(chatId, loadingMsg.message_id);
            await this.displayAnimeCarousel(chatId, userId);

        } catch (error) {
            console.error('❌ Anime search error:', error.message);
            await this.bot.editMessageText('❌ Failed to search anime. Please try again later.', {
                chat_id: chatId,
                message_id: loadingMsg.message_id,
                reply_markup: {
                    inline_keyboard: [[
                        { text: '🔍 Try Again', callback_data: 'anime_start' },
                        { text: '🏠 Main Menu', callback_data: 'show_commands' }
                    ]]
                }
            });
        }
    }

    async displayAnimeCarousel(chatId, userId) {
        const userData = this.userAnimeData.get(userId);
        if (!userData || !userData.searchResults) return;

        const anime = userData.searchResults[userData.currentIndex];
        const currentIndex = userData.currentIndex;
        const totalResults = userData.searchResults.length;

        // Prepare description (limit for Telegram caption)
        let description = anime.description || 'No description available.';
        if (description.length > 800) {
            description = description.substring(0, 800) + '...';
        }

        const caption = `🎌 *${anime.title}*
${anime.japaneseTitle ? `🇯🇵 ${anime.japaneseTitle}` : ''}

📝 ${description}

📊 *Details:*
${anime.type ? `• Type: ${anime.type}` : ''}
${anime.status ? `• Status: ${anime.status}` : ''}
${anime.season ? `• Season: ${anime.season}` : ''}
${anime.totalEpisodes ? `• Episodes: ${anime.totalEpisodes}` : ''}
${anime.sub ? `• Sub: ${anime.sub} episodes` : ''}
${anime.dub ? `• Dub: ${anime.dub} episodes` : ''}
${anime.genres ? `• Genres: ${anime.genres.join(', ')}` : ''}

📍 Result ${currentIndex + 1} of ${totalResults}`;

        // Create navigation buttons
        const keyboard = {
            inline_keyboard: []
        };

        // Navigation row
        const navRow = [];
        if (currentIndex > 0) {
            navRow.push({ text: '⬅️ Previous', callback_data: 'anime_prev' });
        }
        if (currentIndex < totalResults - 1) {
            navRow.push({ text: 'Next ➡️', callback_data: 'anime_next' });
        }
        if (navRow.length > 0) {
            keyboard.inline_keyboard.push(navRow);
        }

        // Action buttons
        keyboard.inline_keyboard.push([
            { text: '✅ Select This Anime', callback_data: 'anime_select' }
        ]);

        keyboard.inline_keyboard.push([
            { text: '🔍 New Search', callback_data: 'anime_start' },
            { text: '❌ Cancel', callback_data: 'anime_cancel' }
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
            console.error('❌ Error displaying anime carousel:', error.message);
            await this.bot.sendMessage(chatId, caption, {
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });
        }
    }

    async handleNavigation(chatId, messageId, userId, direction) {
        const userData = this.userAnimeData.get(userId);
        if (!userData || !userData.searchResults) return;

        if (direction === 'next' && userData.currentIndex < userData.searchResults.length - 1) {
            userData.currentIndex++;
        } else if (direction === 'prev' && userData.currentIndex > 0) {
            userData.currentIndex--;
        }

        // Delete the current message and show new one
        await this.bot.deleteMessage(chatId, messageId);
        await this.displayAnimeCarousel(chatId, userId);
    }

    async selectAnime(chatId, messageId, userId) {
        const userData = this.userAnimeData.get(userId);
        if (!userData || !userData.searchResults) return;

        const selectedAnime = userData.searchResults[userData.currentIndex];
        
        // Store selected anime
        userData.selectedAnime = selectedAnime;

        const message = `✅ *Selected: ${selectedAnime.title}*

📺 Choose what you want to do:`;

        const keyboard = {
            inline_keyboard: [
                [{ text: '📺 View Episodes', callback_data: 'anime_episodes' }],
                [
                    { text: '⬅️ Back to Results', callback_data: 'anime_cancel' },
                    { text: '🏠 Main Menu', callback_data: 'show_commands' }
                ]
            ]
        };

        await this.bot.editMessageText(message, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }

    async showEpisodeOptions(chatId, messageId, userId) {
        const userData = this.userAnimeData.get(userId);
        if (!userData || !userData.selectedAnime) return;

        const loadingMsg = await this.bot.editMessageText('📺 Loading episode information...', {
            chat_id: chatId,
            message_id: messageId
        });

        try {
            const animeInfo = await this.makeRequest(`/anime/info/${userData.selectedAnime.id}`);
            
            userData.animeInfo = animeInfo;

            const message = `📺 *${animeInfo.title}*

📊 *Available Episodes:* ${animeInfo.totalEpisodes || animeInfo.episodes.length}

🎧 *Available Formats:*
${animeInfo.hasSub ? '• ✅ Subtitled (SUB)' : '• ❌ Subtitled (SUB)'}
${animeInfo.hasDub ? '• ✅ Dubbed (DUB)' : '• ❌ Dubbed (DUB)'}

Choose your preferred format:`;

            const keyboard = {
                inline_keyboard: []
            };

            const formatRow = [];
            if (animeInfo.hasSub) {
                formatRow.push({ text: '🎧 SUB', callback_data: 'anime_sub' });
            }
            if (animeInfo.hasDub) {
                formatRow.push({ text: '🎤 DUB', callback_data: 'anime_dub' });
            }
            
            if (formatRow.length > 0) {
                keyboard.inline_keyboard.push(formatRow);
            }

            keyboard.inline_keyboard.push([
                { text: '⬅️ Back', callback_data: 'anime_select' },
                { text: '❌ Cancel', callback_data: 'anime_cancel' }
            ]);

            await this.bot.editMessageText(message, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });

        } catch (error) {
            console.error('❌ Error loading episode info:', error.message);
            await this.bot.editMessageText('❌ Failed to load episode information. Please try again.', {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: {
                    inline_keyboard: [[
                        { text: '🔄 Try Again', callback_data: 'anime_episodes' },
                        { text: '⬅️ Back', callback_data: 'anime_select' }
                    ]]
                }
            });
        }
    }

    async handleSubDubSelection(chatId, messageId, userId, format) {
        const userData = this.userAnimeData.get(userId);
        if (!userData || !userData.animeInfo) return;

        userData.selectedFormat = format;
        
        const totalEpisodes = userData.animeInfo.totalEpisodes || userData.animeInfo.episodes.length;
        
        const message = `🎯 *Download ${format.toUpperCase()} Episodes*

📺 *Anime:* ${userData.animeInfo.title}
📊 *Available Episodes:* ${totalEpisodes}
🎧 *Format:* ${format.toUpperCase()}

📝 *How to specify episodes:*
• Single episode: \`5\`
• Episode range: \`1-12\` or \`5-10\`
• Multiple episodes: \`1,3,5\` or \`1-3,8-10\`

Please type the episodes you want to download:`;

        const keyboard = {
            inline_keyboard: [
                [
                    { text: '⬅️ Back', callback_data: 'anime_episodes' },
                    { text: '❌ Cancel', callback_data: 'anime_cancel' }
                ]
            ]
        };

        await this.bot.editMessageText(message, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });

        // Set user state to expect episode range input
        this.manager.setUserState(userId, {
            commandName: 'anime',
            step: 'awaiting_episode_range'
        });
    }

    async handleEpisodeRangeInput(chatId, userId, input) {
        const userData = this.userAnimeData.get(userId);
        if (!userData || !userData.animeInfo) return;

        const totalEpisodes = userData.animeInfo.totalEpisodes || userData.animeInfo.episodes.length;
        
        try {
            const episodeNumbers = this.parseEpisodeRange(input, totalEpisodes);
            
            if (episodeNumbers.length === 0) {
                throw new Error('No valid episodes specified');
            }

            const confirmMessage = `✅ *Download Confirmation*

📺 *Anime:* ${userData.animeInfo.title}
🎧 *Format:* ${userData.selectedFormat.toUpperCase()}
📊 *Episodes to download:* ${episodeNumbers.length} episodes
📝 *Episodes:* ${episodeNumbers.join(', ')}

⚠️ *Note:* Large downloads may take time. Episodes will be sent individually.

Proceed with download?`;

            const keyboard = {
                inline_keyboard: [
                    [
                        { text: '✅ Start Download', callback_data: `anime_download_${episodeNumbers.join(',')}` },
                        { text: '❌ Cancel', callback_data: 'anime_cancel' }
                    ]
                ]
            };

            await this.bot.sendMessage(chatId, confirmMessage, {
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });

            // Store episode numbers for download
            userData.episodeNumbers = episodeNumbers;

        } catch (error) {
            await this.bot.sendMessage(chatId, `❌ *Invalid episode range:* ${error.message}

Please try again with a valid format:
• Single episode: \`5\`
• Episode range: \`1-12\`
• Multiple episodes: \`1,3,5\``, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[
                        { text: '🔄 Try Again', callback_data: `anime_${userData.selectedFormat}` },
                        { text: '❌ Cancel', callback_data: 'anime_cancel' }
                    ]]
                }
            });
        }
    }

    parseEpisodeRange(input, maxEpisodes) {
        const episodes = new Set();
        const parts = input.split(',');

        for (const part of parts) {
            const trimmed = part.trim();
            
            if (trimmed.includes('-')) {
                const [start, end] = trimmed.split('-').map(x => parseInt(x.trim()));
                
                if (isNaN(start) || isNaN(end) || start < 1 || end > maxEpisodes || start > end) {
                    throw new Error(`Invalid range: ${trimmed}`);
                }
                
                for (let i = start; i <= end; i++) {
                    episodes.add(i);
                }
            } else {
                const episode = parseInt(trimmed);
                
                if (isNaN(episode) || episode < 1 || episode > maxEpisodes) {
                    throw new Error(`Invalid episode: ${trimmed}`);
                }
                
                episodes.add(episode);
            }
        }

        return Array.from(episodes).sort((a, b) => a - b);
    }

    async downloadEpisodes(chatId, userId, episodeNumbers) {
        const userData = this.userAnimeData.get(userId);
        if (!userData || !userData.animeInfo) return;

        const statusMsg = await this.bot.sendMessage(chatId, `🎬 *Starting Download*

📺 ${userData.animeInfo.title}
🎧 Format: ${userData.selectedFormat.toUpperCase()}
📊 Episodes: ${episodeNumbers.length}

⏳ Preparing downloads...`, {
            parse_mode: 'Markdown'
        });

        let successCount = 0;
        let failureCount = 0;

        for (let i = 0; i < episodeNumbers.length; i++) {
            const episodeNum = episodeNumbers[i];
            
            try {
                await this.bot.editMessageText(`🎬 *Downloading...*

📺 ${userData.animeInfo.title}
🎧 Format: ${userData.selectedFormat.toUpperCase()}
📊 Progress: ${i + 1}/${episodeNumbers.length}

⏳ Downloading Episode ${episodeNum}...`, {
                    chat_id: chatId,
                    message_id: statusMsg.message_id,
                    parse_mode: 'Markdown'
                });

                const episode = userData.animeInfo.episodes.find(ep => ep.number === episodeNum);
                if (!episode) {
                    throw new Error(`Episode ${episodeNum} not found`);
                }

                const sources = await this.makeRequest(`/anime/sources/${episode.id}`);
                
                if (!sources.sources || sources.sources.length === 0) {
                    throw new Error(`No sources available for episode ${episodeNum}`);
                }

                // Get the best quality source
                const bestSource = sources.sources.reduce((best, current) => {
                    const qualityOrder = ['1080p', '720p', '480p', '360p'];
                    const bestIndex = qualityOrder.indexOf(best.quality);
                    const currentIndex = qualityOrder.indexOf(current.quality);
                    return currentIndex < bestIndex ? current : best;
                });

                // Send video to user
                await this.bot.sendVideo(chatId, bestSource.url, {
                    caption: `🎬 *${userData.animeInfo.title}*\n📺 Episode ${episodeNum} (${userData.selectedFormat.toUpperCase()})`,
                    parse_mode: 'Markdown',
                    supports_streaming: true
                });

                successCount++;

            } catch (error) {
                console.error(`❌ Error downloading episode ${episodeNum}:`, error.message);
                
                await this.bot.sendMessage(chatId, `❌ *Download Failed*

Episode ${episodeNum} could not be downloaded.
Error: ${error.message}`, {
                    parse_mode: 'Markdown'
                });

                failureCount++;
            }

            // Small delay between downloads
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Final status message
        await this.bot.editMessageText(`✅ *Download Complete!*

📺 ${userData.animeInfo.title}
🎧 Format: ${userData.selectedFormat.toUpperCase()}

📊 *Results:*
• ✅ Successful: ${successCount}
• ❌ Failed: ${failureCount}
• 📱 Total: ${episodeNumbers.length}

${successCount > 0 ? '🎉 Enjoy your anime!' : ''}`, {
            chat_id: chatId,
            message_id: statusMsg.message_id,
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[
                    { text: '🔍 Search More', callback_data: 'anime_start' },
                    { text: '🏠 Main Menu', callback_data: 'show_commands' }
                ]]
            }
        });

        // Clear user data
        this.userAnimeData.delete(userId);
    }

    async makeRequest(endpoint) {
        const url = `${this.baseUrl}${endpoint}`;
        
        const response = await axios.get(url, {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        return response.data;
    }

    getInfo() {
        return {
            name: 'anime',
            description: 'Search and download anime episodes',
            version: '1.0.0'
        };
    }

    async shutdown() {
        // Clean up any ongoing operations
        this.userAnimeData.clear();
        console.log('✅ Anime command shutdown complete');
    }
}

module.exports = AnimeCommand;
