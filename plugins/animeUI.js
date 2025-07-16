class AnimeUI {
    constructor(bot, animeService) {
        this.bot = bot;
        this.animeService = animeService;
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

    promptSearch(chatId, messageId, userId, botManager) {
        const searchMessage = `🔍 *Search for Anime*

Please enter the name of the anime you want to search for:

*Examples:*
• Dandadan
• Demon Slayer
• Attack on Titan
• One Piece

Just type the anime name and I'll find it for you!`;

        botManager.setUserState(userId, {
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

    async showAnimeGallery(chatId, messageId, sessionId, userId) {
        const session = this.animeService.getSearchSession(sessionId);
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
            navRow.push({ text: '⬅️ Back', callback_data: this.animeService.generateSafeCallback('gallery', `prev_${sessionId}`) });
        }
        if (currentIndex < totalResults - 1) {
            navRow.push({ text: 'Next ➡️', callback_data: this.animeService.generateSafeCallback('gallery', `next_${sessionId}`) });
        }
        if (navRow.length > 0) {
            keyboard.inline_keyboard.push(navRow);
        }

        // Action buttons
        keyboard.inline_keyboard.push([
            { text: '✅ Select', callback_data: this.animeService.generateSafeCallback('select', sessionId) },
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
        const session = this.animeService.getSearchSession(actualSessionId);
        
        if (!session) {
            throw new Error('Search session not found');
        }

        if (direction === 'prev' && session.currentIndex > 0) {
            session.currentIndex--;
        } else if (direction === 'next' && session.currentIndex < session.results.length - 1) {
            session.currentIndex++;
        } else {
            // Invalid navigation, return without doing anything
            return;
        }

        // Update the gallery display
        await this.showAnimeGallery(chatId, messageId, actualSessionId, userId);
    }

    async showEpisodesList(chatId, messageId, animeId, sessionId, userId) {
        try {
            const episodes = await this.animeService.getEpisodes(animeId);
            
            if (!episodes || episodes.length === 0) {
                const noEpisodesMessage = `❌ *No Episodes Found*

Sorry, no episodes were found for this anime. This might be because:
• The anime is not yet released
• Episodes are not available on the source
• There was an error fetching the data

Please try again later or search for another anime.`;

                this.bot.editMessageText(noEpisodesMessage, {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🔙 Back to Gallery', callback_data: this.animeService.generateSafeCallback('gallery', sessionId) }],
                            [{ text: '❌ Cancel', callback_data: 'a_cancel' }]
                        ]
                    }
                });
                return;
            }

            const session = this.animeService.getSearchSession(sessionId);
            const anime = session ? session.results[session.currentIndex] : null;
            
            let episodesMessage = `📺 *Episodes List*\n`;
            if (anime) {
                episodesMessage += `🎌 *Anime:* ${anime.title}\n`;
            }
            episodesMessage += `📊 *Total Episodes:* ${episodes.length}\n\n`;

            // Create episode buttons (limit to chunks for better UX)
            const keyboard = { inline_keyboard: [] };
            const episodesPerRow = 5;
            const maxEpisodesPerPage = 20;
            
            // Show first batch of episodes
            const displayEpisodes = episodes.slice(0, maxEpisodesPerPage);
            
            for (let i = 0; i < displayEpisodes.length; i += episodesPerRow) {
                const row = [];
                for (let j = i; j < Math.min(i + episodesPerRow, displayEpisodes.length); j++) {
                    const episode = displayEpisodes[j];
                    row.push({
                        text: `Ep ${episode.number}`,
                        callback_data: this.animeService.generateSafeCallback('episode', `${animeId}_${episode.id}_${sessionId}`)
                    });
                }
                keyboard.inline_keyboard.push(row);
            }

            // Add navigation buttons
            if (episodes.length > maxEpisodesPerPage) {
                keyboard.inline_keyboard.push([
                    { text: '➡️ More Episodes', callback_data: this.animeService.generateSafeCallback('episodes_page', `${animeId}_1_${sessionId}`) }
                ]);
            }

            keyboard.inline_keyboard.push([
                { text: '🔙 Back to Gallery', callback_data: this.animeService.generateSafeCallback('gallery', sessionId) },
                { text: '❌ Cancel', callback_data: 'a_cancel' }
            ]);

            this.bot.editMessageText(episodesMessage, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });

        } catch (error) {
            console.error('Error showing episodes list:', error);
            this.bot.editMessageText(`❌ *Error Loading Episodes*

Sorry, there was an error loading the episodes list. Please try again later.

*Error:* ${error.message}`, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔙 Back to Gallery', callback_data: this.animeService.generateSafeCallback('gallery', sessionId) }],
                        [{ text: '❌ Cancel', callback_data: 'a_cancel' }]
                    ]
                }
            });
        }
    }

    async showEpisodeOptions(chatId, messageId, animeId, episodeId, sessionId, userId) {
        try {
            const episodeDetails = await this.animeService.getEpisodeDetails(animeId, episodeId);
            
            if (!episodeDetails) {
                throw new Error('Episode details not found');
            }

            const session = this.animeService.getSearchSession(sessionId);
            const anime = session ? session.results[session.currentIndex] : null;

            let optionsMessage = `🎬 *Episode Options*\n`;
            if (anime) {
                optionsMessage += `🎌 *Anime:* ${anime.title}\n`;
            }
            optionsMessage += `📺 *Episode:* ${episodeDetails.number}\n`;
            if (episodeDetails.title) {
                optionsMessage += `📝 *Title:* ${episodeDetails.title}\n`;
            }
            optionsMessage += `\n🌐 *Available Options:*\n`;

            const keyboard = { inline_keyboard: [] };

            // Add subtitle/dub options
            if (episodeDetails.sub) {
                keyboard.inline_keyboard.push([
                    { text: '🎌 Watch SUB', callback_data: this.animeService.generateSafeCallback('watch', `${animeId}_${episodeId}_sub_${sessionId}`) },
                    { text: '⬇️ Download SUB', callback_data: this.animeService.generateSafeCallback('download', `${animeId}_${episodeId}_sub_${sessionId}`) }
                ]);
            }

            if (episodeDetails.dub) {
                keyboard.inline_keyboard.push([
                    { text: '🎤 Watch DUB', callback_data: this.animeService.generateSafeCallback('watch', `${animeId}_${episodeId}_dub_${sessionId}`) },
                    { text: '⬇️ Download DUB', callback_data: this.animeService.generateSafeCallback('download', `${animeId}_${episodeId}_dub_${sessionId}`) }
                ]);
            }

            // Add navigation buttons
            keyboard.inline_keyboard.push([
                { text: '🔙 Back to Episodes', callback_data: this.animeService.generateSafeCallback('episodes', `${animeId}_${sessionId}`) },
                { text: '❌ Cancel', callback_data: 'a_cancel' }
            ]);

            this.bot.editMessageText(optionsMessage, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });

        } catch (error) {
            console.error('Error showing episode options:', error);
            this.bot.editMessageText(`❌ *Error Loading Episode*

Sorry, there was an error loading the episode options. Please try again later.

*Error:* ${error.message}`, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔙 Back to Episodes', callback_data: this.animeService.generateSafeCallback('episodes', `${animeId}_${sessionId}`) }],
                        [{ text: '❌ Cancel', callback_data: 'a_cancel' }]
                    ]
                }
            });
        }
    }

    handleCancel(chatId, messageId, userId, botManager) {
        if (botManager) {
            botManager.clearUserState(userId);
        }
        
        this.showMainMenu(chatId, messageId);
    }

    showError(chatId, messageId, errorMessage, backCallback = 'a_cancel') {
        const errorText = `❌ *Error*

${errorMessage}

Please try again or contact support if the problem persists.`;

        const keyboard = {
            inline_keyboard: [
                [{ text: '🔙 Back', callback_data: backCallback }],
                [{ text: '🏠 Main Menu', callback_data: 'show_commands' }]
            ]
        };

        if (messageId) {
            this.bot.editMessageText(errorText, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });
        } else {
            this.bot.sendMessage(chatId, errorText, {
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });
        }
    }
}

module.exports = AnimeUI;