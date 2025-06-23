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
        
        this.init();
        this.setupExpress();
    }

    init() {
        // Load all command modules
        this.loadCommands();
        
        // Setup basic handlers
        this.setupBasicHandlers();
        
        console.log('🤖 Telegram Bot initialized successfully!');
        console.log('📁 Commands loaded:', Array.from(this.commands.keys()));
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
                commands_loaded: Array.from(this.commands.keys())
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
                    express_server: 'enabled',
                    commands_loaded: Array.from(this.commands.keys())
                }
            });
        });

        // Start Express server
        this.app.listen(this.port, () => {
            console.log(`🌐 Express server running on port ${this.port}`);
            console.log(`📊 Health check available at: http://localhost:${this.port}/health`);
            console.log(`📈 Status endpoint: http://localhost:${this.port}/status`);
        });
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

        // Initialize any special settings after all commands are loaded
        setTimeout(() => {
            this.initializeCommandSettings();
        }, 1000);
    }

    initializeCommandSettings() {
        // Allow commands to perform any post-initialization setup
        for (const [commandName, commandInstance] of this.commands) {
            if (typeof commandInstance.postInit === 'function') {
                try {
                    commandInstance.postInit(this);
                    console.log(`✅ Post-initialized: ${commandName}`);
                } catch (error) {
                    console.error(`❌ Failed to post-initialize ${commandName}:`, error.message);
                }
            }
        }
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

🎉 A versatile Telegram bot with useful commands and features! 

Click the button below to explore available commands and discover what this bot can do for you.`;

        const keyboard = {
            inline_keyboard: [[
                { text: '🎮 Show Commands', callback_data: 'show_commands' }
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

        // Handle core bot callbacks
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
                    try {
                        const result = commandInstance.handleCallback(callbackQuery, this);
                        if (result) {
                            handled = true;
                            break;
                        }
                    } catch (error) {
                        console.error(`❌ Error in ${commandName} handleCallback:`, error.message);
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

Choose a command to get started:`;

        const keyboard = {
            inline_keyboard: []
        };

        // Dynamically add command buttons
        for (const [commandName, commandInstance] of this.commands) {
            if (typeof commandInstance.getMainButton === 'function') {
                try {
                    const buttonInfo = commandInstance.getMainButton();
                    if (buttonInfo) {
                        keyboard.inline_keyboard.push([buttonInfo]);
                    }
                } catch (error) {
                    console.error(`❌ Error getting main button for ${commandName}:`, error.message);
                }
            }
        }

        // Add placeholder for future commands if no commands are loaded
        if (keyboard.inline_keyboard.length === 0) {
            keyboard.inline_keyboard.push([
                { text: '🔧 No Commands Available', callback_data: 'coming_soon' }
            ]);
        } else {
            // Add a "more features coming soon" button at the end
            keyboard.inline_keyboard.push([
                { text: '🔧 More Tools (Coming Soon)', callback_data: 'coming_soon' }
            ]);
        }

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

        // If user was in a command-specific operation, try to go back to that command's menu
        if (userState && userState.commandName) {
            const command = this.commands.get(userState.commandName);
            if (command && typeof command.showCommandMenu === 'function') {
                try {
                    command.showCommandMenu(chatId, messageId);
                    return;
                } catch (error) {
                    console.error(`❌ Error showing command menu for ${userState.commandName}:`, error.message);
                }
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
            try {
                command.handleTextInput(msg, userState, this);
            } catch (error) {
                console.error(`❌ Error in ${userState.commandName} handleTextInput:`, error.message);
                
                // Clear the user state and inform them of the error
                this.userStates.delete(userId);
                this.bot.sendMessage(chatId, '❌ An error occurred. Please try again.', {
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '🏠 Back to Main Menu', callback_data: 'show_commands' }
                        ]]
                    }
                });
            }
        }

        // Clear user state after handling if it hasn't been updated by the command
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

    // Method for commands to update their settings at runtime
    updateCommandSettings(commandName, settings) {
        const command = this.commands.get(commandName);
        if (command && typeof command.updateSettings === 'function') {
            try {
                command.updateSettings(settings);
                console.log(`✅ Updated settings for ${commandName}`);
                return true;
            } catch (error) {
                console.error(`❌ Failed to update settings for ${commandName}:`, error.message);
                return false;
            }
        }
        return false;
    }

    // Method to get command information
    getCommandInfo(commandName) {
        const command = this.commands.get(commandName);
        if (command && typeof command.getInfo === 'function') {
            try {
                return command.getInfo();
            } catch (error) {
                console.error(`❌ Failed to get info for ${commandName}:`, error.message);
                return null;
            }
        }
        return null;
    }

    // Method to reload a specific command (useful for development)
    reloadCommand(commandName) {
        try {
            // Remove from require cache
            const commandPath = path.join(__dirname, 'commands', `${commandName}.js`);
            delete require.cache[require.resolve(commandPath)];
            
            // Remove old command
            this.commands.delete(commandName);
            
            // Load new command
            const CommandClass = require(commandPath);
            const commandInstance = new CommandClass(this.bot, this);
            
            if (typeof commandInstance.init === 'function') {
                commandInstance.init();
            }
            
            this.commands.set(commandName, commandInstance);
            
            console.log(`✅ Reloaded command: ${commandName}`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to reload command ${commandName}:`, error.message);
            return false;
        }
    }

    // Graceful shutdown
    async shutdown() {
        console.log('🛑 Shutting down gracefully...');
        
        try {
            // Shutdown all commands
            for (const [commandName, commandInstance] of this.commands) {
                if (typeof commandInstance.shutdown === 'function') {
                    try {
                        await commandInstance.shutdown();
                        console.log(`✅ ${commandName} shutdown complete`);
                    } catch (error) {
                        console.error(`❌ Error shutting down ${commandName}:`, error.message);
                    }
                }
            }
            
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

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start the bot
const botManager = new TelegramBotManager();
global.botManager = botManager; // Make available for graceful shutdown

module.exports = TelegramBotManager;