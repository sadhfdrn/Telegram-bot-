const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

class TelegramBotManager {
    constructor() {
        this.bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
        this.commands = new Map();
        this.userStates = new Map(); // Track user interaction states
        this.app = express(); // Express app for health checks
        this.port = process.env.PORT || 3000;
        
        // Initialize cookie from environment if available
        this.tiktokCookie = process.env.TIKTOK_COOKIE || null;
        
        this.init();
        this.setupExpress();
    }

    init() {
        // Load all command modules
        this.loadCommands();
        
        // Setup basic handlers
        this.setupBasicHandlers();
        
        // Pass cookie to TikTok command if available
        this.initializeCookieForCommands();
        
        console.log('🤖 Telegram Bot initialized successfully!');
        console.log('📁 Commands loaded:', Array.from(this.commands.keys()));
        console.log('🍪 TikTok Cookie:', this.tiktokCookie ? 'Loaded from .env ✅' : 'Not set ❌');
    }

    setupExpress() {
        // Basic middleware
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));

        // Health check endpoint
        this.app.get('/', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                bot_status: 'running',
                commands_loaded: Array.from(this.commands.keys()),
                cookie_status: this.tiktokCookie ? 'set' : 'not_set'
            });
        });

        // Health endpoint for monitoring services
        this.app.get('/health', (req, res) => {
            res.status(200).json({
                status: 'ok',
                service: 'telegram-bot',
                timestamp: new Date().toISOString()
            });
        });

        // Status endpoint with more details
        this.app.get('/status', (req, res) => {
            const activeUsers = this.userStates.size;
            const memoryUsage = process.memoryUsage();
            
            res.json({
                bot: {
                    status: 'running',
                    uptime_seconds: Math.floor(process.uptime()),
                    active_users: activeUsers,
                    commands_available: Array.from(this.commands.keys())
                },
                system: {
                    memory_usage: {
                        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
                        heap_used: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
                        heap_total: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`
                    },
                    node_version: process.version,
                    platform: process.platform
                },
                features: {
                    tiktok_cookie: this.tiktokCookie ? 'enabled' : 'disabled',
                    express_server: 'enabled'
                }
            });
        });

        // Cookie management endpoint (for debugging - remove in production)
        if (process.env.NODE_ENV !== 'production') {
            this.app.get('/debug/cookie', (req, res) => {
                res.json({
                    cookie_set: !!this.tiktokCookie,
                    cookie_length: this.tiktokCookie ? this.tiktokCookie.length : 0,
                    cookie_preview: this.tiktokCookie ? 
                        this.tiktokCookie.substring(0, 50) + '...' : null
                });
            });
        }

        // Start Express server
        this.app.listen(this.port, () => {
            console.log(`🌐 Express server running on port ${this.port}`);
            console.log(`📊 Health check available at: http://localhost:${this.port}/health`);
            console.log(`📈 Status endpoint: http://localhost:${this.port}/status`);
        });
    }

    initializeCookieForCommands() {
        // Pass the cookie to TikTok command if it exists
        const tiktokCommand = this.commands.get('tiktok');
        if (tiktokCommand && this.tiktokCookie) {
            try {
                // Set the cookie in the TikTok plugin
                if (tiktokCommand.tikTokPlugin && typeof tiktokCommand.tikTokPlugin.setTikTokCookie === 'function') {
                    tiktokCommand.tikTokPlugin.setTikTokCookie(this.tiktokCookie);
                    console.log('✅ TikTok cookie initialized from .env');
                }
            } catch (error) {
                console.error('❌ Failed to initialize TikTok cookie:', error.message);
            }
        }
    }

    loadCommands() {
        const commandsDir = path.join(__dirname, 'commands');
        
        if (!fs.existsSync(commandsDir)) {
            fs.mkdirSync(commandsDir, { recursive: true });
            console.log('📁 Created commands directory');
        }

        const commandFiles = fs.readdirSync(commandsDir).filter(file => file.endsWith('.js'));
        
        for (const file of commandFiles) {
            try {
                const CommandClass = require(path.join(commandsDir, file));
                const commandInstance = new CommandClass(this.bot, this);
                
                // Initialize the command if it has an init method
                if (typeof commandInstance.init === 'function') {
                    commandInstance.init();
                }
                
                // Store command instance
                const commandName = file.replace('.js', '');
                this.commands.set(commandName, commandInstance);
                
                console.log(`✅ Loaded command: ${commandName}`);
            } catch (error) {
                console.error(`❌ Failed to load command ${file}:`, error.message);
            }
        }

        // Initialize cookies after all commands are loaded
        setTimeout(() => {
            this.initializeCookieForCommands();
        }, 1000);
    }

    setupBasicHandlers() {
        // Handle /start command
        this.bot.onText(/\/start/, (msg) => {
            this.handleStart(msg);
        });

        // Handle callback queries (button presses)
        this.bot.on('callback_query', (callbackQuery) => {
            this.handleCallbackQuery(callbackQuery);
        });

        // Handle text messages
        this.bot.on('message', (msg) => {
            if (!msg.text || msg.text.startsWith('/')) return;
            this.handleTextMessage(msg);
        });

        // Handle errors
        this.bot.on('polling_error', (error) => {
            console.error('❌ Polling error:', error);
        });

        // Handle webhook errors if using webhooks
        this.bot.on('webhook_error', (error) => {
            console.error('❌ Webhook error:', error);
        });

        // Log successful start
        console.log('📡 Bot handlers initialized');
    }

    handleStart(msg) {
        const chatId = msg.chat.id;
        const userName = msg.from.first_name || 'User';
        
        const welcomeMessage = `🤖 *Welcome ${userName} to the Telegram Bot for Fun & Automation!*

📥 *Nrmtiktok* - Download TikTok video without custom watermark or TikTok watermark
🎨 *Wmtiktok* - Download TikTok video with custom watermark
🍪 *Cookie Status* - ${this.tiktokCookie ? 'Enhanced features enabled ✅' : 'Basic features only ❌'}

🎉 A fun and useful Telegram bot with great functions! 😬

Click the button below to explore available commands.`;

        const keyboard = {
            inline_keyboard: [[
                { text: '🎮 Commands', callback_data: 'show_commands' }
            ]]
        };

        this.bot.sendMessage(chatId, welcomeMessage, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }

    handleCallbackQuery(callbackQuery) {
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        const data = callbackQuery.data;
        const userId = callbackQuery.from.id;

        // Answer the callback query to remove loading state
        this.bot.answerCallbackQuery(callbackQuery.id);

        // Handle different callback data
        if (data === 'show_commands') {
            this.showMainCommands(chatId, messageId);
        } else if (data === 'back_to_main') {
            this.showMainCommands(chatId, messageId);
        } else if (data === 'cancel') {
            this.cancelCurrentOperation(chatId, messageId, userId);
        } else if (data === 'coming_soon') {
            this.bot.answerCallbackQuery(callbackQuery.id, { 
                text: '🚧 More awesome features coming soon!', 
                show_alert: true 
            });
        } else {
            // Check if any command can handle this callback
            let handled = false;
            for (const [commandName, commandInstance] of this.commands) {
                if (typeof commandInstance.handleCallback === 'function') {
                    const result = commandInstance.handleCallback(callbackQuery, this);
                    if (result) {
                        handled = true;
                        break;
                    }
                }
            }
            
            if (!handled) {
                console.log(`⚠️ Unhandled callback data: ${data}`);
                this.bot.answerCallbackQuery(callbackQuery.id, { 
                    text: '❌ Unknown command', 
                    show_alert: false 
                });
            }
        }
    }

    showMainCommands(chatId, messageId) {
        const commandsMessage = `🎮 *Available Commands*

Choose a category to explore:

🍪 **Cookie Status:** ${this.tiktokCookie ? 'Enhanced features enabled ✅' : 'Basic features only ❌'}`;

        const keyboard = {
            inline_keyboard: []
        };

        // Dynamically add command buttons
        for (const [commandName, commandInstance] of this.commands) {
            if (typeof commandInstance.getMainButton === 'function') {
                const buttonInfo = commandInstance.getMainButton();
                if (buttonInfo) {
                    keyboard.inline_keyboard.push([buttonInfo]);
                }
            }
        }

        // Add placeholder for future commands
        keyboard.inline_keyboard.push([
            { text: '🔧 More Tools (Coming Soon)', callback_data: 'coming_soon' }
        ]);

        this.bot.editMessageText(commandsMessage, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }

    cancelCurrentOperation(chatId, messageId, userId) {
        // Clear user state
        const userState = this.userStates.get(userId);
        this.userStates.delete(userId);

        // If user was in a command-specific operation, go back to that command's menu
        if (userState && userState.commandName) {
            const command = this.commands.get(userState.commandName);
            if (command && typeof command.showCommandMenu === 'function') {
                command.showCommandMenu(chatId, messageId);
                return;
            }
        }

        // Otherwise go back to main commands menu
        this.showMainCommands(chatId, messageId);
    }

    handleTextMessage(msg) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const text = msg.text;

        // Check if user has an active operation
        const userState = this.userStates.get(userId);
        if (!userState) return;

        // Find the command that should handle this
        const command = this.commands.get(userState.commandName);
        if (command && typeof command.handleTextInput === 'function') {
            command.handleTextInput(msg, userState, this);
        }

        // Clear user state after handling (commands can override this by setting a new state)
        if (this.userStates.get(userId) === userState) {
            this.userStates.delete(userId);
        }
    }

    // Helper methods for commands to use
    setUserState(userId, state) {
        this.userStates.set(userId, state);
    }

    getUserState(userId) {
        return this.userStates.get(userId);
    }

    clearUserState(userId) {
        this.userStates.delete(userId);
    }

    // Method to update cookie at runtime
    updateTikTokCookie(newCookie) {
        this.tiktokCookie = newCookie;
        this.initializeCookieForCommands();
        console.log('✅ TikTok cookie updated at runtime');
    }

    // Graceful shutdown
    async shutdown() {
        console.log('🛑 Shutting down gracefully...');
        
        try {
            await this.bot.stopPolling();
            console.log('✅ Bot polling stopped');
        } catch (error) {
            console.error('❌ Error stopping bot polling:', error);
        }

        // Close express server
        return new Promise((resolve) => {
            if (this.server) {
                this.server.close(() => {
                    console.log('✅ Express server closed');
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }
}

// Handle process termination
process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    if (global.botManager) {
        await global.botManager.shutdown();
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    if (global.botManager) {
        await global.botManager.shutdown();
    }
    process.exit(0);
});

// Start the bot
const botManager = new TelegramBotManager();
global.botManager = botManager; // Make available for graceful shutdown

module.exports = TelegramBotManager;