const AnimeService = require('../plugins/animeService');
const AnimeUI = require('../plugins/animeUI');

class AnimeCommand {
    constructor(bot, botManager) {
        this.bot = bot;
        this.botManager = botManager;
        this.commandName = 'anime';
        
        // Initialize services
        this.animeService = new AnimeService();
        this.animeUI = new AnimeUI(bot, this.animeService);
        
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

    async handleAnimeCommand(msg, query) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;

        if (!query) {
            this.animeUI.showMainMenu(chatId);
            return;
        }

        // If user provided a query directly, search for it
        await this.animeService.searchAnime(chatId, query, userId, this.bot);
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
                    this.animeUI.showMainMenu(chatId, messageId);
                    break;
                    
                case 'search':
                    this.animeUI.promptSearch(chatId, messageId, userId, this.botManager);
                    break;
                    
                case 'popular':
                    await this.animeService.showPopularAnime(chatId, messageId, this.bot);
                    break;
                    
                case 'queue':
                    this.animeUI.showDownloadQueue(chatId, messageId, userId, this.animeService);
                    break;
                    
                case 'result':
                    const animeData = this.animeService.getAnimeFromCache(sessionId);
                    if (animeData) {
                        await this.animeUI.showAnimeGallery(chatId, messageId, animeData, userId);
                    } else {
                        throw new Error('Search session expired');
                    }
                    break;
                    
                case 'gallery':
                    await this.animeUI.handleGalleryNavigation(chatId, messageId, sessionId, userId);
                    break;
                    
                case 'select':
                    await this.animeService.handleAnimeSelection(chatId, messageId, sessionId, userId, this.bot);
                    break;
                    
                case 'episodes':
                    await this.animeUI.showEpisodeList(chatId, messageId, sessionId, userId, this.animeService);
                    break;
                    
                case 'episode':
                    await this.animeService.showEpisodeOptions(chatId, messageId, sessionId, userId, this.bot);
                    break;
                    
                case 'download':
                    await this.animeService.handleDownload(chatId, messageId, sessionId, userId, this.bot);
                    break;
                    
                case 'page':
                    await this.animeService.handlePageNavigation(chatId, messageId, sessionId, userId, this.bot);
                    break;
                    
                case 'back':
                    await this.animeUI.handleBackNavigation(chatId, messageId, sessionId, userId);
                    break;
                    
                case 'cancel':
                    this.animeUI.showMainMenu(chatId, messageId);
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

    async handleTextInput(msg, userState) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const text = msg.text;

        if (userState.action === 'search' && userState.step === 'waiting_query') {
            this.botManager.clearUserState(userId);
            await this.animeService.searchAnime(chatId, text, userId, this.bot);
        }
    }
}

module.exports = AnimeCommand;