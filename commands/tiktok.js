const TikTokWatermarkPlugin = require('../plugins/wmtiktok.js');
const fs = require('fs');
const path = require('path');

class TikTokCommand {
    constructor(bot, botManager) {
        this.bot = bot;
        this.botManager = botManager;
        this.tikTokPlugin = new TikTokWatermarkPlugin();
        this.tikTokPlugin.init({ command: () => {} }); // Initialize plugin
        
        // Dynamic style loading
        this.styleModules = new Map();
        this.loadStyleModules();
    }

    /**
     * Dynamically load all style modules from ../plugins/styles/
     */
    loadStyleModules() {
        try {
            const stylesDir = path.join(__dirname, '../plugins/styles');
            
            // Check if styles directory exists
            if (!fs.existsSync(stylesDir)) {
                console.warn('Styles directory not found:', stylesDir);
                return;
            }

            const styleFiles = fs.readdirSync(stylesDir)
                .filter(file => file.endsWith('.js'))
                .map(file => file.replace('.js', ''));

            console.log('Loading style modules:', styleFiles);

            for (const styleName of styleFiles) {
                try {
                    const stylePath = path.join(stylesDir, `${styleName}.js`);
                    const StyleClass = require(stylePath);
                    const styleInstance = new StyleClass();
                    
                    // Store the style instance
                    this.styleModules.set(styleName, styleInstance);
                    
                    console.log(`✅ Loaded style module: ${styleName}`);
                } catch (error) {
                    console.error(`❌ Failed to load style module ${styleName}:`, error.message);
                }
            }
        } catch (error) {
            console.error('Error loading style modules:', error.message);
        }
    }

    /**
     * Get all available styles from loaded modules
     */
    getAllStyles() {
        const allStyles = new Map();
        
        for (const [moduleName, moduleInstance] of this.styleModules) {
            try {
                // Try to get preset styles from the module
                if (typeof moduleInstance.getPresetStyles === 'function') {
                    const presetStyles = moduleInstance.getPresetStyles();
                    
                    for (const [styleName, styleConfig] of Object.entries(presetStyles)) {
                        const fullStyleName = `${moduleName}_${styleName}`;
                        allStyles.set(fullStyleName, {
                            ...styleConfig,
                            module: moduleName,
                            styleClass: moduleInstance,
                            originalName: styleName
                        });
                    }
                }
            } catch (error) {
                console.error(`Error getting styles from ${moduleName}:`, error.message);
            }
        }
        
        return allStyles;
    }

    init() {
        console.log('🎬 TikTok Command initialized');
        console.log(`📦 Loaded ${this.styleModules.size} style modules`);
        console.log(`🎨 Available styles: ${this.getAllStyles().size}`);
    }

    // Main button for the commands menu
    getMainButton() {
        return {
            text: '🎬 TikTok Tools',
            callback_data: 'tiktok_main'
        };
    }

    // Handle callback queries for this command
    handleCallback(callbackQuery, botManager) {
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        const data = callbackQuery.data;
        const userId = callbackQuery.from.id;

        // Check if this callback belongs to our command
        if (!data.startsWith('tiktok_')) {
            return false; // Not our callback
        }

        switch (data) {
            case 'tiktok_main':
                this.showCommandMenu(chatId, messageId);
                break;
            case 'tiktok_styles':
                this.showStylesMenu(chatId, messageId);
                break;
            case 'tiktok_setwatermark':
                this.showSetWatermarkMenu(chatId, messageId);
                break;
            case 'tiktok_wmtiktok':
                this.startWmTikTok(chatId, messageId, userId);
                break;
            case 'tiktok_nrmtiktok':
                this.startNrmTikTok(chatId, messageId, userId);
                break;
            case 'tiktok_setcookie':
                this.showSetCookieMenu(chatId, messageId, userId);
                break;
            case 'tiktok_cookiestatus':
                this.showCookieStatus(chatId, messageId);
                break;
            case 'tiktok_set_new_cookie':
                this.startSetCookie(chatId, messageId, userId);
                break;
            case 'tiktok_back_to_main':
                this.showCommandMenu(chatId, messageId);
                break;
            case 'tiktok_back_to_styles':
                this.showStylesMenu(chatId, messageId);
                break;
            case 'tiktok_back_to_setwatermark':
                this.showSetWatermarkMenu(chatId, messageId);
                break;
            default:
                // Handle style module selection
                if (data.startsWith('tiktok_module_')) {
                    const moduleName = data.replace('tiktok_module_', '');
                    this.showModuleStyles(chatId, messageId, moduleName);
                }
                // Handle style selection
                else if (data.startsWith('tiktok_style_')) {
                    const styleName = data.replace('tiktok_style_', '');
                    this.selectStyle(chatId, messageId, userId, styleName);
                }
                // Handle watermark text setting
                else if (data.startsWith('tiktok_set_style_')) {
                    const styleName = data.replace('tiktok_set_style_', '');
                    this.startSetCustomText(chatId, messageId, userId, styleName);
                }
                // Handle confirm style
                else if (data.startsWith('tiktok_confirm_style_')) {
                    const styleName = data.replace('tiktok_confirm_style_', '');
                    this.confirmStyle(chatId, messageId, userId, styleName);
                }
                // Handle custom text for styles
                else if (data.startsWith('tiktok_custom_text_')) {
                    const styleName = data.replace('tiktok_custom_text_', '');
                    this.startCustomTextInput(chatId, messageId, userId, styleName);
                }
                break;
        }

        return true; // We handled this callback
    }

    // Show main TikTok command menu with Set Cookie button
    showCommandMenu(chatId, messageId) {
        const cookieStatus = this.tikTokPlugin.tiktokCookie ? '✅' : '❌';
        const styleCount = this.getAllStyles().size;
        
        const menuMessage = `🎬 *TikTok Tools*

Choose what you'd like to do:

🎨 *Styles* - Browse ${styleCount} watermark styles from ${this.styleModules.size} modules
⚙️ *Set Watermark* - Set custom watermark style and text
🎥 *Wmtiktok* - Download with custom watermark
📱 *Nrmtiktok* - Download without any watermark (clean video)
${cookieStatus} *Set Cookie* - Set TikTok cookie for better downloads
📊 *Cookie Status* - Check current cookie status

📦 **Loaded Modules:** ${Array.from(this.styleModules.keys()).join(', ')}`;

        const keyboard = {
            inline_keyboard: [
                [{ text: '🎨 Styles', callback_data: 'tiktok_styles' }],
                [{ text: '⚙️ Set Watermark', callback_data: 'tiktok_setwatermark' }],
                [
                    { text: '🎥 Wmtiktok', callback_data: 'tiktok_wmtiktok' },
                    { text: '📱 Nrmtiktok', callback_data: 'tiktok_nrmtiktok' }
                ],
                [
                    { text: `${cookieStatus} Set Cookie`, callback_data: 'tiktok_setcookie' },
                    { text: '📊 Cookie Status', callback_data: 'tiktok_cookiestatus' }
                ],
                [{ text: '🔙 Back to Main', callback_data: 'back_to_main' }]
            ]
        };

        this.bot.editMessageText(menuMessage, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }

    // Show styles selection menu (now organized by modules)
    showStylesMenu(chatId, messageId) {
        const stylesMessage = `🎨 *Watermark Style Modules*

Choose a style module to explore:`;

        const keyboard = {
            inline_keyboard: []
        };

        // Add module buttons
        const moduleNames = Array.from(this.styleModules.keys());
        
        // Create rows of 2 buttons each
        for (let i = 0; i < moduleNames.length; i += 2) {
            const row = [];
            const moduleName = moduleNames[i];
            const moduleInstance = this.styleModules.get(moduleName);
            
            // Count styles in this module
            let styleCount = 0;
            try {
                if (typeof moduleInstance.getPresetStyles === 'function') {
                    styleCount = Object.keys(moduleInstance.getPresetStyles()).length;
                }
            } catch (error) {
                styleCount = '?';
            }
            
            row.push({ 
                text: `📦 ${moduleName.toUpperCase()} (${styleCount})`, 
                callback_data: `tiktok_module_${moduleName}` 
            });
            
            if (moduleNames[i + 1]) {
                const moduleName2 = moduleNames[i + 1];
                const moduleInstance2 = this.styleModules.get(moduleName2);
                let styleCount2 = 0;
                try {
                    if (typeof moduleInstance2.getPresetStyles === 'function') {
                        styleCount2 = Object.keys(moduleInstance2.getPresetStyles()).length;
                    }
                } catch (error) {
                    styleCount2 = '?';
                }
                
                row.push({ 
                    text: `📦 ${moduleName2.toUpperCase()} (${styleCount2})`, 
                    callback_data: `tiktok_module_${moduleName2}` 
                });
            }
            keyboard.inline_keyboard.push(row);
        }

        keyboard.inline_keyboard.push([{ text: '🔙 Back', callback_data: 'tiktok_back_to_main' }]);

        this.bot.editMessageText(stylesMessage, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }

    // Show styles from a specific module
    showModuleStyles(chatId, messageId, moduleName) {
        const moduleInstance = this.styleModules.get(moduleName);
        
        if (!moduleInstance) {
            this.bot.answerCallbackQuery(callbackQuery.id, { text: 'Module not found!' });
            return;
        }

        let presetStyles = {};
        try {
            if (typeof moduleInstance.getPresetStyles === 'function') {
                presetStyles = moduleInstance.getPresetStyles();
            }
        } catch (error) {
            console.error(`Error getting styles from ${moduleName}:`, error.message);
        }

        const stylesMessage = `✨ *${moduleName.toUpperCase()} Styles*

Choose a style to preview:`;

        const keyboard = {
            inline_keyboard: []
        };

        // Add style buttons for this module
        const styleNames = Object.keys(presetStyles);
        
        // Create rows of 2 buttons each
        for (let i = 0; i < styleNames.length; i += 2) {
            const row = [];
            const styleName = styleNames[i];
            const fullStyleName = `${moduleName}_${styleName}`;
            
            row.push({ 
                text: `✨ ${styleName.toUpperCase()}`, 
                callback_data: `tiktok_style_${fullStyleName}` 
            });
            
            if (styleNames[i + 1]) {
                const styleName2 = styleNames[i + 1];
                const fullStyleName2 = `${moduleName}_${styleName2}`;
                row.push({ 
                    text: `✨ ${styleName2.toUpperCase()}`, 
                    callback_data: `tiktok_style_${fullStyleName2}` 
                });
            }
            keyboard.inline_keyboard.push(row);
        }

        keyboard.inline_keyboard.push([
            { text: '🔙 Back to Modules', callback_data: 'tiktok_back_to_styles' }
        ]);

        this.bot.editMessageText(stylesMessage, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }

    // Show set watermark menu (organized by modules)
    showSetWatermarkMenu(chatId, messageId) {
        const setWatermarkMessage = `⚙️ *Set Watermark*

Choose a module to customize styles:`;

        const keyboard = {
            inline_keyboard: []
        };

        // Add module buttons for setting
        const moduleNames = Array.from(this.styleModules.keys());
        
        // Create rows of 2 buttons each
        for (let i = 0; i < moduleNames.length; i += 2) {
            const row = [];
            const moduleName = moduleNames[i];
            
            row.push({ 
                text: `⚙️ ${moduleName.toUpperCase()}`, 
                callback_data: `tiktok_setmodule_${moduleName}` 
            });
            
            if (moduleNames[i + 1]) {
                const moduleName2 = moduleNames[i + 1];
                row.push({ 
                    text: `⚙️ ${moduleName2.toUpperCase()}`, 
                    callback_data: `tiktok_setmodule_${moduleName2}` 
                });
            }
            keyboard.inline_keyboard.push(row);
        }

        keyboard.inline_keyboard.push([{ text: '🔙 Back', callback_data: 'tiktok_back_to_main' }]);

        this.bot.editMessageText(setWatermarkMessage, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }

    // Preview and select a style
    selectStyle(chatId, messageId, userId, fullStyleName) {
        const allStyles = this.getAllStyles();
        const style = allStyles.get(fullStyleName);
        
        if (!style) {
            this.bot.answerCallbackQuery(callbackQuery.id, { text: 'Style not found!' });
            return;
        }

        const styleMessage = `✨ *${style.originalName.toUpperCase()} Style Preview*
📦 **Module:** ${style.module}

🏷️ **Text:** ${style.text || 'N/A'}
🔤 **Font:** ${style.font || style.fontFamily || 'Default'}
📏 **Size:** ${style.fontSize || style.size || 'Default'}px
🎨 **Color:** ${style.color || style.textColor || 'Default'}
👻 **Opacity:** ${Math.round((style.opacity || 1) * 100)}%
📍 **Position:** ${style.position || 'Default'}
🔄 **Rotation:** ${style.rotation || 0}°
✨ **Effect:** ${style.effect || style.glassColor || 'Custom'}

This is just a preview. To use this style, go back and use "Set Watermark".`;

        const keyboard = {
            inline_keyboard: [
                [{ text: '🔙 Back to Module', callback_data: `tiktok_module_${style.module}` }],
                [{ text: '🏠 Back to Menu', callback_data: 'tiktok_back_to_main' }]
            ]
        };

        this.bot.editMessageText(styleMessage, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }

    // Start custom text setting for a style
    startSetCustomText(chatId, messageId, userId, fullStyleName) {
        const allStyles = this.getAllStyles();
        const style = allStyles.get(fullStyleName);
        
        if (!style) {
            this.bot.answerCallbackQuery(callbackQuery.id, { text: 'Style not found!' });
            return;
        }

        const setTextMessage = `⚙️ *Set ${style.originalName.toUpperCase()} Style*
📦 **Module:** ${style.module}

**Current settings:**
🏷️ Text: ${style.text || 'Default'}
🔤 Font: ${style.font || style.fontFamily || 'Default'}
📏 Size: ${style.fontSize || style.size || 'Default'}px
🎨 Color: ${style.color || style.textColor || 'Default'}
✨ Effect: ${style.effect || style.glassColor || 'Custom'}

Do you want to use the default text or enter custom text?`;

        const keyboard = {
            inline_keyboard: [
                [{ text: '✅ Use Default Text', callback_data: `tiktok_confirm_style_${fullStyleName}` }],
                [{ text: '✏️ Enter Custom Text', callback_data: `tiktok_custom_text_${fullStyleName}` }],
                [{ text: '🔙 Back', callback_data: 'tiktok_back_to_setwatermark' }]
            ]
        };

        this.bot.editMessageText(setTextMessage, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }

    // Start custom text input
    startCustomTextInput(chatId, messageId, userId, fullStyleName) {
        const allStyles = this.getAllStyles();
        const style = allStyles.get(fullStyleName);
        
        if (!style) {
            this.bot.answerCallbackQuery(callbackQuery.id, { text: 'Style not found!' });
            return;
        }

        const customTextMessage = `✏️ *Enter Custom Text*

Please type the text you want to use for your **${style.originalName.toUpperCase()}** watermark from the **${style.module}** module.

**Examples:**
• Your name: "John Doe"
• Your brand: "@MyBrand"
• Any text: "My Video"

Send your custom text now:`;

        const keyboard = {
            inline_keyboard: [
                [{ text: '❌ Cancel', callback_data: 'tiktok_back_to_setwatermark' }]
            ]
        };

        this.bot.editMessageText(customTextMessage, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });

        // Set user state to expect custom text
        this.botManager.setUserState(userId, {
            commandName: 'tiktok',
            operation: 'custom_text',
            step: 'waiting_for_text',
            styleName: fullStyleName
        });
    }

    // Confirm and set style with default text
    confirmStyle(chatId, messageId, userId, fullStyleName) {
        const allStyles = this.getAllStyles();
        const style = allStyles.get(fullStyleName);
        
        if (!style) {
            this.bot.answerCallbackQuery(callbackQuery.id, { text: 'Style not found!' });
            return;
        }

        // Set the style for the user (store the full style configuration)
        this.tikTokPlugin.watermarkSettings.set(userId, { 
            ...style,
            fullStyleName: fullStyleName
        });

        const confirmMessage = `✅ *Watermark Set Successfully!*

**Module:** ${style.module}
**Style:** ${style.originalName.toUpperCase()}
**Text:** ${style.text || 'Default'}
**Effect:** ${style.effect || style.glassColor || 'Custom'}

Your watermark is now ready to use with Wmtiktok!`;

        const keyboard = {
            inline_keyboard: [
                [{ text: '🎥 Use Wmtiktok Now', callback_data: 'tiktok_wmtiktok' }],
                [{ text: '🏠 Back to Menu', callback_data: 'tiktok_back_to_main' }]
            ]
        };

        this.bot.editMessageText(confirmMessage, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }

    // Handle setmodule callback (missing implementation)
    handleSetModuleCallback(callbackQuery, moduleName) {
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        
        const moduleInstance = this.styleModules.get(moduleName);
        
        if (!moduleInstance) {
            this.bot.answerCallbackQuery(callbackQuery.id, { text: 'Module not found!' });
            return;
        }

        let presetStyles = {};
        try {
            if (typeof moduleInstance.getPresetStyles === 'function') {
                presetStyles = moduleInstance.getPresetStyles();
            }
        } catch (error) {
            console.error(`Error getting styles from ${moduleName}:`, error.message);
        }

        const setModuleMessage = `⚙️ *Set ${moduleName.toUpperCase()} Watermark*

Choose a style to customize:`;

        const keyboard = {
            inline_keyboard: []
        };

        // Add style buttons for setting
        const styleNames = Object.keys(presetStyles);
        
        // Create rows of 2 buttons each
        for (let i = 0; i < styleNames.length; i += 2) {
            const row = [];
            const styleName = styleNames[i];
            const fullStyleName = `${moduleName}_${styleName}`;
            
            row.push({ 
                text: `⚙️ ${styleName.toUpperCase()}`, 
                callback_data: `tiktok_set_style_${fullStyleName}` 
            });
            
            if (styleNames[i + 1]) {
                const styleName2 = styleNames[i + 1];
                const fullStyleName2 = `${moduleName}_${styleName2}`;
                row.push({ 
                    text: `⚙️ ${styleName2.toUpperCase()}`, 
                    callback_data: `tiktok_set_style_${fullStyleName2}` 
                });
            }
            keyboard.inline_keyboard.push(row);
        }

        keyboard.inline_keyboard.push([{ text: '🔙 Back', callback_data: 'tiktok_back_to_setwatermark' }]);

        this.bot.editMessageText(setModuleMessage, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }

    // Update handleCallback to include setmodule handling
    handleCallback(callbackQuery, botManager) {
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        const data = callbackQuery.data;
        const userId = callbackQuery.from.id;

        // Check if this callback belongs to our command
        if (!data.startsWith('tiktok_')) {
            return false; // Not our callback
        }

        // Handle setmodule callbacks
        if (data.startsWith('tiktok_setmodule_')) {
            const moduleName = data.replace('tiktok_setmodule_', '');
            this.handleSetModuleCallback(callbackQuery, moduleName);
            return true;
        }

        // ... rest of the existing switch statement stays the same
        // (previous handleCallback method content)
        
        return true; // We handled this callback
    }

    // Start Wmtiktok (with watermark)
    startWmTikTok(chatId, messageId, userId) {
        const userSettings = this.tikTokPlugin.watermarkSettings.get(userId);
        
        let watermarkInfo = 'Default watermark';
        if (userSettings && userSettings.fullStyleName) {
            const allStyles = this.getAllStyles();
            const style = allStyles.get(userSettings.fullStyleName);
            if (style) {
                watermarkInfo = `${style.originalName.toUpperCase()} from ${style.module} module`;
            }
        }
        
        const wmMessage = `🎥 *Wmtiktok - Download with Watermark*

**Current watermark:** ${watermarkInfo}
**Text:** ${userSettings?.text || 'Default'}

Please send me the TikTok URL you want to download with watermark.

**Example:** https://www.tiktok.com/@username/video/1234567890`;

        const keyboard = {
            inline_keyboard: [
                [{ text: '⚙️ Change Watermark', callback_data: 'tiktok_setwatermark' }],
                [{ text: '❌ Cancel', callback_data: 'tiktok_back_to_main' }]
            ]
        };

        this.bot.editMessageText(wmMessage, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });

        // Set user state to expect TikTok URL for watermarked download
        this.botManager.setUserState(userId, {
            commandName: 'tiktok',
            operation: 'wmtiktok',
            step: 'waiting_for_url'
        });
    }

    // Handle custom text input for watermark
    handleCustomTextInput(msg, userState, botManager) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const customText = msg.text.trim();
        const fullStyleName = userState.styleName;

        if (!customText) {
            this.bot.sendMessage(chatId, '❌ Please provide some text for your watermark');
            return;
        }

        const allStyles = this.getAllStyles();
        const style = allStyles.get(fullStyleName);
        
        if (!style) {
            this.bot.sendMessage(chatId, '❌ Style not found');
            return;
        }

        // Set the style with custom text
        const newSettings = { 
            ...style, 
            text: customText,
            fullStyleName: fullStyleName
        };
        this.tikTokPlugin.watermarkSettings.set(userId, newSettings);

        const confirmMessage = `✅ *Custom Watermark Set!*

**Module:** ${style.module}
**Style:** ${style.originalName.toUpperCase()}
**Your Text:** ${customText}
**Effect:** ${style.effect || style.glassColor || 'Custom'}

Your custom watermark is ready to use!`;

        const keyboard = {
            inline_keyboard: [
                [{ text: '🎥 Use Wmtiktok Now', callback_data: 'tiktok_wmtiktok' }],
                [{ text: '🏠 Back to Menu', callback_data: 'tiktok_back_to_main' }]
            ]
        };

        this.bot.sendMessage(chatId, confirmMessage, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
        
        // Clear user state
        botManager.clearUserState(userId);
    }

    // ... (keep all other existing methods like showSetCookieMenu, showCookieStatus, 
    // startSetCookie, startNrmTikTok, handleTextInput, handleSetCookieInput, 
    // handleWmTikTokInput, handleNrmTikTokInput, etc.)
}

module.exports = TikTokCommand;