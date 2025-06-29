const path = require('path');
const fs = require('fs');

class AnimeCommand {
    constructor(bot, botManager) {
        this.bot = bot;
        this.botManager = botManager;
        this.commandName = 'anime';
        this.plugins = new Map();
        this.searchResults = new Map();
        this.downloadQueue = new Map();
        this.loadPlugins();
    }

    init() {
        console.log('🎬 Anime Scraper Command initialized');
    }

    loadPlugins() {
        const pluginsDir = path.join(__dirname, '../plugins/anisites');
        
        if (!fs.existsSync(pluginsDir)) {
            fs.mkdirSync(pluginsDir, { recursive: true });
            console.log('📁 Created anisites plugins directory');
        }

        const pluginFiles = fs.readdirSync(pluginsDir).filter(file => file.endsWith('.js'));
        
        for (const file of pluginFiles) {
            try {
                const pluginPath = path.join(pluginsDir, file);
                const PluginClass = require(pluginPath);
                const plugin = new PluginClass();
                
                this.plugins.set(plugin.name, plugin);
                console.log(`✅ Loaded anime plugin: ${plugin.name}`);
            } catch (error) {
                console.error(`❌ Failed to load plugin ${file}:`, error.message);
            }
        }
    }

    getMainButton() {
        return {
            text: '🎬 Anime Downloader',
            callback_data: 'anime_main'
        };
    }

    handleCallback(callbackQuery, botManager) {
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        const data = callbackQuery.data;
        const userId = callbackQuery.from.id;

        // Main menu
        if (data === 'anime_main') {
            this.showMainMenu(chatId, messageId);
            return true;
        }

        // Site selection
        if (data === 'anime_sites') {
            this.showSiteSelection(chatId, messageId);
            return true;
        }

        // Site selection
        if (data.startsWith('anime_site_')) {
            const siteName = data.replace('anime_site_', '');
            this.selectSite(chatId, messageId, userId, siteName);
            return true;
        }

        // Search initiation
        if (data.startsWith('anime_search_')) {
            const siteName = data.replace('anime_search_', '');
            this.startSearch(chatId, messageId, userId, siteName);
            return true;
        }

        // Search result selection
        if (data.startsWith('anime_result_')) {
            const [, siteName, resultIndex] = data.split('_').slice(1);
            this.selectSearchResult(chatId, messageId, userId, siteName, parseInt(resultIndex));
            return true;
        }

        // Quality selection
        if (data.startsWith('anime_quality_')) {
            const [, siteName, animeId] = data.split('_').slice(1);
            this.showQualityOptions(chatId, messageId, siteName, animeId);
            return true;
        }

        // Type selection (SUB/DUB)
        if (data.startsWith('anime_type_')) {
            const [, siteName, animeId, quality, type] = data.split('_').slice(1);
            this.showDownloadOptions(chatId, messageId, siteName, animeId, quality, type);
            return true;
        }

        // Season/Episode selection
        if (data.startsWith('anime_season_')) {
            const [, siteName, animeId, quality, type, option] = data.split('_').slice(1);
            this.handleSeasonSelection(chatId, messageId, userId, siteName, animeId, quality, type, option);
            return true;
        }

        // Download initiation
        if (data.startsWith('anime_download_')) {
            const [, siteName, animeId, quality, type, episodes] = data.split('_').slice(1);
            this.initiateDownload(chatId, messageId, userId, siteName, animeId, quality, type, episodes);
            return true;
        }

        // Download status
        if (data === 'anime_status') {
            this.showDownloadStatus(chatId, messageId, userId);
            return true;
        }

        // Popular/Latest
        if (data.startsWith('anime_popular_')) {
            const siteName = data.replace('anime_popular_', '');
            this.showPopular(chatId, messageId, siteName);
            return true;
        }

        // Back navigation
        if (data === 'anime_back') {
            this.showMainMenu(chatId, messageId);
            return true;
        }

        return false;
    }

    handleTextInput(message, userState, botManager) {
        const chatId = message.chat.id;
        const userId = message.from.id;
        const text = message.text;

        if (userState.stage === 'searching') {
            this.performSearch(chatId, userId, userState.siteName, text);
        } else if (userState.stage === 'episode_selection') {
            this.handleEpisodeInput(chatId, userId, userState, text);
        }
    }

    showMainMenu(chatId, messageId) {
        const keyboard = {
            inline_keyboard: [
                [{ text: '🌐 Browse Sites', callback_data: 'anime_sites' }],
                [{ text: '📊 Download Status', callback_data: 'anime_status' }],
                [{ text: '🏠 Back to Main Menu', callback_data: 'show_commands' }]
            ]
        };

        const text = `🎬 *Anime Downloader*

Welcome to the ultimate anime downloader! 

🌐 **Browse Sites** - Choose from available anime sites
📊 **Download Status** - Check your download progress
⚙️ **Features:**
   • High-quality downloads
   • SUB and DUB options
   • Batch downloads
   • Multiple sites support

Choose an option below to get started!`;

        this.bot.editMessageText(text, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }

    showSiteSelection(chatId, messageId) {
        const keyboard = { inline_keyboard: [] };

        // Add available sites
        for (const [siteName, plugin] of this.plugins) {
            keyboard.inline_keyboard.push([{
                text: `${plugin.icon || '🎬'} ${plugin.displayName || siteName}`,
                callback_data: `anime_site_${siteName}`
            }]);
        }

        if (keyboard.inline_keyboard.length === 0) {
            keyboard.inline_keyboard.push([{
                text: '❌ No Sites Available',
                callback_data: 'anime_back'
            }]);
        }

        keyboard.inline_keyboard.push([{
            text: '🔙 Back to Main Menu',
            callback_data: 'anime_main'
        }]);

        this.bot.editMessageText('🌐 *Select Anime Site*\n\nChoose from the available anime sites below:', {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }

    selectSite(chatId, messageId, userId, siteName) {
        const plugin = this.plugins.get(siteName);
        if (!plugin) {
            this.bot.answerCallbackQuery(userId, {
                text: '❌ Site not available',
                show_alert: true
            });
            return;
        }

        const keyboard = {
            inline_keyboard: [
                [{ text: '🔍 Search Anime', callback_data: `anime_search_${siteName}` }],
                [{ text: '🔥 Popular', callback_data: `anime_popular_${siteName}` }],
                [{ text: '🔙 Back to Sites', callback_data: 'anime_sites' }]
            ]
        };

        const text = `${plugin.icon || '🎬'} *${plugin.displayName || siteName}*

📍 **Site:** ${plugin.baseUrl || 'N/A'}
📝 **Description:** ${plugin.description || 'Anime streaming site'}

What would you like to do?`;

        this.bot.editMessageText(text, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }

    startSearch(chatId, messageId, userId, siteName) {
        const plugin = this.plugins.get(siteName);
        if (!plugin) {
            this.bot.answerCallbackQuery(userId, {
                text: '❌ Site not available'
            });
            return;
        }

        this.botManager.setUserState(userId, {
            commandName: 'anime',
            stage: 'searching',
            siteName: siteName
        });

        const text = `🔍 *Search on ${plugin.displayName || siteName}*

Please type the name of the anime you want to search for:

**Examples:**
• "Attack on Titan"
• "Naruto Shippuden"
• "Demon Slayer"
• "One Piece"

Type your search query now:`;

        this.bot.editMessageText(text, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '❌ Cancel', callback_data: 'cancel' }]
                ]
            }
        });
    }

    async performSearch(chatId, userId, siteName, query) {
        const plugin = this.plugins.get(siteName);
        if (!plugin) {
            this.bot.sendMessage(chatId, '❌ Site plugin not available');
            return;
        }

        this.botManager.clearUserState(userId);

        const searchingMsg = await this.bot.sendMessage(chatId, 
            `🔍 Searching for "${query}" on ${plugin.displayName || siteName}...\n\n⏳ Please wait...`);

        try {
            const results = await plugin.search(query);
            
            if (!results || results.length === 0) {
                this.bot.editMessageText(`❌ No results found for "${query}"`, {
                    chat_id: chatId,
                    message_id: searchingMsg.message_id,
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🔍 Search Again', callback_data: `anime_search_${siteName}` }],
                            [{ text: '🔙 Back', callback_data: `anime_site_${siteName}` }]
                        ]
                    }
                });
                return;
            }

            this.showSearchResults(chatId, searchingMsg.message_id, siteName, query, results);
        } catch (error) {
            console.error(`Search error for ${siteName}:`, error);
            this.bot.editMessageText(`❌ Search failed: ${error.message}`, {
                chat_id: chatId,
                message_id: searchingMsg.message_id,
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔍 Try Again', callback_data: `anime_search_${siteName}` }],
                        [{ text: '🔙 Back', callback_data: `anime_site_${siteName}` }]
                    ]
                }
            });
        }
    }

    showSearchResults(chatId, messageId, siteName, query, results) {
        const plugin = this.plugins.get(siteName);
        const keyboard = { inline_keyboard: [] };

        // Show first 5 results
        const displayResults = results.slice(0, 5);
        
        displayResults.forEach((result, index) => {
            const title = result.title.length > 40 ? 
                result.title.substring(0, 37) + '...' : result.title;
            
            keyboard.inline_keyboard.push([{
                text: `${index + 1}. ${title}`,
                callback_data: `anime_result_${siteName}_${index}`
            }]);
        });

        keyboard.inline_keyboard.push([
            { text: '🔍 New Search', callback_data: `anime_search_${siteName}` },
            { text: '🔙 Back', callback_data: `anime_site_${siteName}` }
        ]);

        const text = `🔍 *Search Results for "${query}"*

Found ${results.length} results on ${plugin.displayName || siteName}:

` + displayResults.map((result, index) => 
    `${index + 1}. **${result.title}**
   📅 ${result.year || 'N/A'} • 📺 ${result.status || 'Unknown'}${result.type ? ' • ' + result.type : ''}`
).join('\n\n');

        this.bot.editMessageText(text, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });

        // Store search results
        this.searchResults.set(`${siteName}_${chatId}`, results);
    }

    selectSearchResult(chatId, messageId, userId, siteName, resultIndex) {
        const results = this.searchResults.get(`${siteName}_${chatId}`);
        if (!results || !results[resultIndex]) {
            this.bot.answerCallbackQuery(userId, {
                text: '❌ Result not found'
            });
            return;
        }

        const selectedAnime = results[resultIndex];
        this.showAnimeDetails(chatId, messageId, siteName, selectedAnime);
    }

    async showAnimeDetails(chatId, messageId, siteName, anime) {
        const plugin = this.plugins.get(siteName);
        
        try {
            const details = await plugin.getAnimeDetails(anime.id || anime.url);
            
            const keyboard = {
                inline_keyboard: [
                    [{ text: '📥 Download Options', callback_data: `anime_quality_${siteName}_${anime.id}` }],
                    [{ text: '🔙 Back to Results', callback_data: `anime_search_${siteName}` }]
                ]
            };

            const text = `🎬 *${anime.title}*

📅 **Year:** ${details.year || 'N/A'}
📺 **Status:** ${details.status || 'Unknown'}
🎭 **Genres:** ${details.genres?.join(', ') || 'N/A'}
📝 **Episodes:** ${details.episodes || 'N/A'}
⭐ **Rating:** ${details.rating || 'N/A'}

**Description:**
${details.description ? details.description.substring(0, 300) + '...' : 'No description available'}`;

            this.bot.editMessageText(text, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });
        } catch (error) {
            console.error('Error getting anime details:', error);
            this.bot.editMessageText('❌ Failed to load anime details', {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔙 Back', callback_data: `anime_search_${siteName}` }]
                    ]
                }
            });
        }
    }

    showQualityOptions(chatId, messageId, siteName, animeId) {
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '🎬 SUB', callback_data: `anime_type_${siteName}_${animeId}_1080p_sub` },
                    { text: '🎤 DUB', callback_data: `anime_type_${siteName}_${animeId}_1080p_dub` }
                ],
                [{ text: '🔙 Back', callback_data: `anime_result_${siteName}_0` }]
            ]
        };

        this.bot.editMessageText('🎬 *Select Audio Type*\n\nChoose your preferred audio type:\n\n🎬 **SUB** - Original Japanese with subtitles\n🎤 **DUB** - English dubbed version', {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }

    showDownloadOptions(chatId, messageId, siteName, animeId, quality, type) {
        const keyboard = {
            inline_keyboard: [
                [{ text: '📺 Full Season', callback_data: `anime_season_${siteName}_${animeId}_${quality}_${type}_full` }],
                [{ text: '📱 Specific Episodes', callback_data: `anime_season_${siteName}_${animeId}_${quality}_${type}_episodes` }],
                [{ text: '🔙 Back', callback_data: `anime_quality_${siteName}_${animeId}` }]
            ]
        };

        const text = `📺 *Download Options*

Quality: **${quality}**
Type: **${type.toUpperCase()}**

Choose what to download:

📺 **Full Season** - Download all available episodes
📱 **Specific Episodes** - Choose specific episodes to download`;

        this.bot.editMessageText(text, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }

    handleSeasonSelection(chatId, messageId, userId, siteName, animeId, quality, type, option) {
        if (option === 'full') {
            this.downloadFullSeason(chatId, messageId, userId, siteName, animeId, quality, type);
        } else if (option === 'episodes') {
            this.startEpisodeSelection(chatId, messageId, userId, siteName, animeId, quality, type);
        }
    }

    async downloadFullSeason(chatId, messageId, userId, siteName, animeId, quality, type) {
        const plugin = this.plugins.get(siteName);
        
        try {
            const text = `📥 *Starting Full Season Download*

Site: ${plugin.displayName}
Quality: ${quality}
Type: ${type.toUpperCase()}

⏳ Preparing download...`;

            this.bot.editMessageText(text, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown'
            });

            const downloadLinks = await plugin.downloadSeason(animeId, quality, type);
            this.sendDownloadInfo(chatId, downloadLinks);
        } catch (error) {
            console.error('Download error:', error);
            this.bot.editMessageText(`❌ Download failed: ${error.message}`, {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔙 Back', callback_data: `anime_type_${siteName}_${animeId}_${quality}_${type}` }]
                    ]
                }
            });
        }
    }

    startEpisodeSelection(chatId, messageId, userId, siteName, animeId, quality, type) {
        this.botManager.setUserState(userId, {
            commandName: 'anime',
            stage: 'episode_selection',
            siteName: siteName,
            animeId: animeId,
            quality: quality,
            type: type
        });

        this.bot.editMessageText('📱 *Select Episodes*\n\nEnter the episode numbers you want to download:\n\n**Examples:**\n• Single episode: `1`\n• Multiple episodes: `1,3,5`\n• Range: `1-10`\n• Mixed: `1,3-5,8`\n\nType your selection now:', {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '❌ Cancel', callback_data: 'cancel' }]
                ]
            }
        });
    }

    async handleEpisodeInput(chatId, userId, userState, input) {
        const plugin = this.plugins.get(userState.siteName);
        if (!plugin) {
            this.bot.sendMessage(chatId, '❌ Site plugin not available');
            return;
        }

        this.botManager.clearUserState(userId);

        try {
            const episodes = this.parseEpisodeInput(input);
            if (episodes.length === 0) {
                this.bot.sendMessage(chatId, '❌ Invalid episode format. Please try again.');
                return;
            }

            const text = `📥 *Starting Episode Download*

Episodes: ${episodes.join(', ')}
Quality: ${userState.quality}
Type: ${userState.type.toUpperCase()}

⏳ Preparing downloads...`;

            const processingMsg = await this.bot.sendMessage(chatId, text, {
                parse_mode: 'Markdown'
            });

            const downloadLinks = await plugin.downloadEpisodes(userState.animeId, episodes, userState.quality, userState.type);
            this.sendDownloadInfo(chatId, downloadLinks);
        } catch (error) {
            console.error('Episode download error:', error);
            this.bot.sendMessage(chatId, `❌ Download failed: ${error.message}`);
        }
    }

    parseEpisodeInput(input) {
        const episodes = [];
        const parts = input.split(',');

        for (const part of parts) {
            const trimmed = part.trim();
            if (trimmed.includes('-')) {
                const [start, end] = trimmed.split('-').map(num => parseInt(num.trim()));
                if (!isNaN(start) && !isNaN(end) && start <= end) {
                    for (let i = start; i <= end; i++) {
                        episodes.push(i);
                    }
                }
            } else {
                const num = parseInt(trimmed);
                if (!isNaN(num)) {
                    episodes.push(num);
                }
            }
        }

        return [...new Set(episodes)].sort((a, b) => a - b);
    }

    async sendDownloadInfo(chatId, downloadLinks) {
        if (!downloadLinks || downloadLinks.length === 0) {
            this.bot.sendMessage(chatId, '❌ No download links available');
            return;
        }

        const text = `✅ *Download Links Ready*

Found ${downloadLinks.length} download link(s):

` + downloadLinks.map((link, index) => 
    `**Episode ${link.episode}:**
🔗 [Download Link](${link.url})
📊 Quality: ${link.quality}
💾 Size: ${link.size || 'Unknown'}
📱 Type: ${link.type || 'N/A'}`
).join('\n\n');

        this.bot.sendMessage(chatId, text, {
            parse_mode: 'Markdown',
            disable_web_page_preview: true
        });
    }

    showDownloadStatus(chatId, messageId, userId) {
        const userDownloads = this.downloadQueue.get(userId) || [];
        
        if (userDownloads.length === 0) {
            this.bot.editMessageText('📊 *Download Status*\n\nNo active downloads found.', {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔙 Back to Main Menu', callback_data: 'anime_main' }]
                    ]
                }
            });
            return;
        }

        const text = `📊 *Download Status*

Active Downloads: ${userDownloads.length}

` + userDownloads.map((dl, index) => 
    `${index + 1}. **${dl.title}**
   📺 Episode: ${dl.episode}
   📊 Progress: ${dl.progress}%
   🔄 Status: ${dl.status}`
).join('\n\n');

        this.bot.editMessageText(text, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔄 Refresh', callback_data: 'anime_status' }],
                    [{ text: '🔙 Back to Main Menu', callback_data: 'anime_main' }]
                ]
            }
        });
    }

    async showPopular(chatId, messageId, siteName) {
        const plugin = this.plugins.get(siteName);
        if (!plugin) {
            this.bot.editMessageText('❌ Site not available', {
                chat_id: chatId,
                message_id: messageId
            });
            return;
        }

        try {
            this.bot.editMessageText('🔥 Loading popular anime...', {
                chat_id: chatId,
                message_id: messageId
            });

            const popular = await plugin.getPopular();
            
            if (!popular || popular.length === 0) {
                this.bot.editMessageText('❌ No popular anime found', {
                    chat_id: chatId,
                    message_id: messageId,
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🔙 Back', callback_data: `anime_site_${siteName}` }]
                        ]
                    }
                });
                return;
            }

            this.showSearchResults(chatId, messageId, siteName, 'Popular Anime', popular);
        } catch (error) {
            console.error('Error loading popular anime:', error);
            this.bot.editMessageText('❌ Failed to load popular anime', {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔙 Back', callback_data: `anime_site_${siteName}` }]
                    ]
                }
            });
        }
    }

    getInfo() {
        return {
            name: 'anime',
            description: 'Download anime from various sites',
            usage: 'Use the anime command to search and download anime',
            version: '2.0.0',
            sites: Array.from(this.plugins.keys())
        };
    }
}

module.exports = AnimeCommand;