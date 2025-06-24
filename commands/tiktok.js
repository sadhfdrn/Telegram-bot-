const TikTokWatermarkPlugin = require("../plugins/wmtiktok.js");
const fs = require("fs");
const path = require("path");

class TikTokCommand {
    constructor(bot, botManager) {
        this.bot = bot;
        this.botManager = botManager;
        this.tikTokPlugin = new TikTokWatermarkPlugin();
        this.tikTokPlugin.init({ command() {} });
        this.styleModules = new Map();
        this.loadStyleModules();
    }

    loadStyleModules() {
        try {
            const stylesDir = path.join(__dirname, "../plugins/styles");
            if (!fs.existsSync(stylesDir)) {
                console.warn("Styles directory not found:", stylesDir);
                return;
            }

            const styleFiles = fs.readdirSync(stylesDir)
                .filter(file => file.endsWith(".js"))
                .map(file => file.replace(".js", ""));

            console.log("Loading style modules:", styleFiles);

            for (const styleName of styleFiles) {
                try {
                    const stylePath = path.join(stylesDir, `${styleName}.js`);
                    const StyleClass = require(stylePath);
                    const styleInstance = new StyleClass();
                    this.styleModules.set(styleName, styleInstance);
                    console.log(`✅ Loaded style module: ${styleName}`);
                } catch (error) {
                    console.error(`❌ Failed to load style module ${styleName}:`, error.message);
                }
            }
        } catch (error) {
            console.error("Error loading style modules:", error.message);
        }
    }

    getAllStyles() {
        const allStyles = new Map();
        for (const [moduleName, moduleInstance] of this.styleModules) {
            try {
                if (typeof moduleInstance.getPresetStyles === 'function') {
                    const presets = moduleInstance.getPresetStyles();
                    for (const [presetName, presetConfig] of Object.entries(presets)) {
                        const fullStyleName = `${moduleName}_${presetName}`;
                        allStyles.set(fullStyleName, {
                            ...presetConfig,
                            module: moduleName,
                            styleClass: moduleInstance,
                            originalName: presetName
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
        console.log("🎬 TikTok Command initialized");
        console.log(`📦 Loaded ${this.styleModules.size} style modules`);
        console.log(`🎨 Available styles: ${this.getAllStyles().size}`);
    }

    getMainButton() {
        return {
            text: "🎬 TikTok Tools",
            callback_data: "tiktok_main"
        };
    }

    // NEW METHOD: Handle text messages when user is in a state
    async handleMessage(message) {
        const userId = message.from.id;
        const chatId = message.chat.id;
        const text = message.text;
        
        const userState = this.botManager.getUserState(userId);
        
        if (!userState || userState.commandName !== 'tiktok') {
            return false; // Not handling this message
        }

        try {
            switch (userState.operation) {
                case 'wmtiktok':
                    if (userState.step === 'waiting_for_url') {
                        await this.handleWmTikTokUrl(message, text);
                        return true;
                    }
                    break;

                case 'nrmtiktok':
                    if (userState.step === 'waiting_for_url') {
                        await this.handleNrmTikTokUrl(message, text);
                        return true;
                    }
                    break;

                case 'custom_text':
                    if (userState.step === 'waiting_for_text') {
                        await this.handleCustomTextInput(message, userState, this.botManager);
                        return true;
                    }
                    break;

                case 'set_cookie':
                    if (userState.step === 'waiting_for_cookie') {
                        await this.handleSetCookieInput(message, text);
                        return true;
                    }
                    break;
            }
        } catch (error) {
            console.error("Error handling TikTok message:", error);
            await this.bot.sendMessage(chatId, `❌ Error: ${error.message}`);
            this.botManager.clearUserState(userId);
        }

        return false;
    }

    // Handle wmtiktok URL input
    async handleWmTikTokUrl(message, url) {
        const userId = message.from.id;
        const chatId = message.chat.id;

        // Validate TikTok URL
        if (!this.isValidTikTokUrl(url)) {
            await this.bot.sendMessage(chatId, "❌ Please provide a valid TikTok URL.\n\nExample: https://www.tiktok.com/@username/video/1234567890");
            return;
        }

        try {
            // Clear user state
            this.botManager.clearUserState(userId);

            // Create mock message object for the plugin
            const mockMessage = {
                reply: async (content, options = {}) => {
                    if (Buffer.isBuffer(content)) {
                        await this.bot.sendVideo(chatId, content, options);
                    } else {
                        await this.bot.sendMessage(chatId, content, { parse_mode: 'Markdown' });
                    }
                },
                from: message.from,
                chat: message.chat
            };

            // Call the plugin's wmtiktok handler
            await this.tikTokPlugin.handleWmTikTok(mockMessage, [url]);

        } catch (error) {
            console.error("Error processing wmtiktok:", error);
            await this.bot.sendMessage(chatId, `❌ Error processing video: ${error.message}`);
        }
    }

    // Handle nrmtiktok URL input
    async handleNrmTikTokUrl(message, url) {
        const userId = message.from.id;
        const chatId = message.chat.id;

        // Validate TikTok URL
        if (!this.isValidTikTokUrl(url)) {
            await this.bot.sendMessage(chatId, "❌ Please provide a valid TikTok URL.\n\nExample: https://www.tiktok.com/@username/video/1234567890");
            return;
        }

        try {
            // Clear user state
            this.botManager.clearUserState(userId);

            // Create mock message object for the plugin
            const mockMessage = {
                reply: async (content, options = {}) => {
                    if (Buffer.isBuffer(content)) {
                        await this.bot.sendVideo(chatId, content, options);
                    } else {
                        await this.bot.sendMessage(chatId, content, { parse_mode: 'Markdown' });
                    }
                },
                from: message.from,
                chat: message.chat
            };

            // Call the plugin's nrmtiktok handler
            await this.tikTokPlugin.handleNrmTikTok(mockMessage, [url]);

        } catch (error) {
            console.error("Error processing nrmtiktok:", error);
            await this.bot.sendMessage(chatId, `❌ Error processing video: ${error.message}`);
        }
    }

    // Handle cookie input
    async handleSetCookieInput(message, cookie) {
        const userId = message.from.id;
        const chatId = message.chat.id;

        try {
            // Clear user state
            this.botManager.clearUserState(userId);

            if (!cookie || cookie.trim().length < 10) {
                await this.bot.sendMessage(chatId, "❌ Please provide a valid cookie string.");
                return;
            }

            this.tikTokPlugin.setTikTokCookie(cookie.trim());
            await this.bot.sendMessage(chatId, "✅ TikTok cookie set successfully!\n🔓 Enhanced download features enabled.");

        } catch (error) {
            console.error("Error setting cookie:", error);
            await this.bot.sendMessage(chatId, `❌ Error setting cookie: ${error.message}`);
        }
    }

    // Validate TikTok URL
    isValidTikTokUrl(url) {
        const tiktokPatterns = [
            /^https?:\/\/(www\.)?(tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com)/i,
            /tiktok\.com\/@[\w.-]+\/video\/\d+/i,
            /vm\.tiktok\.com\/[\w]+/i,
            /vt\.tiktok\.com\/[\w]+/i
        ];

        return tiktokPatterns.some(pattern => pattern.test(url));
    }

    handleCallback(callbackQuery, data) {
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        const callbackData = callbackQuery.data;
        const userId = callbackQuery.from.id;

        console.log(`🔧 TikTok callback received: ${callbackData}`);

        if (!callbackData.startsWith("tiktok_")) {
            return false;
        }

        try {
            switch (callbackData) {
                case "tiktok_main":
                case "tiktok_back_to_main":
                    this.showCommandMenu(chatId, messageId);
                    break;

                case "tiktok_styles":
                case "tiktok_back_to_styles":
                    this.showStylesMenu(chatId, messageId);
                    break;

                case "tiktok_setwatermark":
                case "tiktok_back_to_setwatermark":
                    this.showSetWatermarkMenu(chatId, messageId);
                    break;

                case "tiktok_wmtiktok":
                    this.startWmTikTok(chatId, messageId, userId);
                    break;

                case "tiktok_nrmtiktok":
                    this.startNrmTikTok(chatId, messageId, userId);
                    break;

                case "tiktok_setcookie":
                    this.showSetCookieMenu(chatId, messageId, userId);
                    break;

                case "tiktok_cookiestatus":
                    this.showCookieStatus(chatId, messageId);
                    break;

                case "tiktok_set_new_cookie":
                    this.startSetCookie(chatId, messageId, userId);
                    break;

                default:
                    if (callbackData.startsWith("tiktok_module_")) {
                        const moduleName = callbackData.replace("tiktok_module_", "");
                        this.showModuleStyles(chatId, messageId, moduleName);
                    } else if (callbackData.startsWith("tiktok_setmodule_")) {
                        const moduleName = callbackData.replace("tiktok_setmodule_", "");
                        this.handleSetModuleCallback(callbackQuery, moduleName);
                    } else if (callbackData.startsWith("tiktok_style_")) {
                        const styleName = callbackData.replace("tiktok_style_", "");
                        this.selectStyle(chatId, messageId, userId, styleName);
                    } else if (callbackData.startsWith("tiktok_set_style_")) {
                        const styleName = callbackData.replace("tiktok_set_style_", "");
                        this.startSetCustomText(chatId, messageId, userId, styleName);
                    } else if (callbackData.startsWith("tiktok_confirm_style_")) {
                        const styleName = callbackData.replace("tiktok_confirm_style_", "");
                        this.confirmStyle(chatId, messageId, userId, styleName);
                    } else if (callbackData.startsWith("tiktok_custom_text_")) {
                        const styleName = callbackData.replace("tiktok_custom_text_", "");
                        this.startCustomTextInput(chatId, messageId, userId, styleName);
                    }
                    break;
            }

            this.bot.answerCallbackQuery(callbackQuery.id);
            return true;

        } catch (error) {
            console.error("Error handling TikTok callback:", error);
            this.bot.answerCallbackQuery(callbackQuery.id, {
                text: "❌ Error occurred. Please try again.",
                show_alert: false
            });
            return true;
        }
    }

    showCommandMenu(chatId, messageId) {
        const cookieStatus = this.tikTokPlugin.tiktokCookie ? "✅" : "❌";
        const totalStyles = this.getAllStyles().size;
        
        const menuText = `🎬 *TikTok Tools*

Choose what you'd like to do:

🎨 *Styles* - Browse ${totalStyles} watermark styles from ${this.styleModules.size} modules
⚙️ *Set Watermark* - Set custom watermark style and text
🎥 *Wmtiktok* - Download with custom watermark
📱 *Nrmtiktok* - Download without any watermark (clean video)
${cookieStatus} *Set Cookie* - Set TikTok cookie for better downloads
📊 *Cookie Status* - Check current cookie status

📦 **Loaded Modules:** ${Array.from(this.styleModules.keys()).join(", ")}`;

        const keyboard = {
            inline_keyboard: [
                [{ text: "🎨 Styles", callback_data: "tiktok_styles" }],
                [{ text: "⚙️ Set Watermark", callback_data: "tiktok_setwatermark" }],
                [
                    { text: "🎥 Wmtiktok", callback_data: "tiktok_wmtiktok" },
                    { text: "📱 Nrmtiktok", callback_data: "tiktok_nrmtiktok" }
                ],
                [
                    { text: `${cookieStatus} Set Cookie`, callback_data: "tiktok_setcookie" },
                    { text: "📊 Cookie Status", callback_data: "tiktok_cookiestatus" }
                ],
                [{ text: "🔙 Back to Main", callback_data: "back_to_main" }]
            ]
        };

        this.bot.editMessageText(menuText, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "Markdown",
            reply_markup: keyboard
        }).catch(error => {
            console.error("Error editing message:", error);
        });
    }

    showStylesMenu(chatId, messageId) {
        const menuText = "🎨 *Watermark Style Modules*\n\nChoose a style module to explore:";
        const keyboard = { inline_keyboard: [] };
        
        const moduleNames = Array.from(this.styleModules.keys());
        
        for (let i = 0; i < moduleNames.length; i += 2) {
            const row = [];
            const moduleName = moduleNames[i];
            const moduleInstance = this.styleModules.get(moduleName);
            
            let styleCount = 0;
            try {
                if (typeof moduleInstance.getPresetStyles === 'function') {
                    styleCount = Object.keys(moduleInstance.getPresetStyles()).length;
                }
            } catch (error) {
                styleCount = "?";
            }
            
            row.push({
                text: `📦 ${moduleName.toUpperCase()} (${styleCount})`,
                callback_data: `tiktok_module_${moduleName}`
            });
            
            if (moduleNames[i + 1]) {
                const nextModuleName = moduleNames[i + 1];
                const nextModuleInstance = this.styleModules.get(nextModuleName);
                
                let nextStyleCount = 0;
                try {
                    if (typeof nextModuleInstance.getPresetStyles === 'function') {
                        nextStyleCount = Object.keys(nextModuleInstance.getPresetStyles()).length;
                    }
                } catch (error) {
                    nextStyleCount = "?";
                }
                
                row.push({
                    text: `📦 ${nextModuleName.toUpperCase()} (${nextStyleCount})`,
                    callback_data: `tiktok_module_${nextModuleName}`
                });
            }
            
            keyboard.inline_keyboard.push(row);
        }
        
        keyboard.inline_keyboard.push([{ text: "🔙 Back", callback_data: "tiktok_back_to_main" }]);

        this.bot.editMessageText(menuText, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "Markdown",
            reply_markup: keyboard
        }).catch(error => {
            console.error("Error editing message:", error);
        });
    }

    showModuleStyles(chatId, messageId, moduleName) {
        const moduleInstance = this.styleModules.get(moduleName);
        if (!moduleInstance) {
            return this.bot.answerCallbackQuery(callbackQuery.id, { text: "Module not found!" });
        }

        let styles = {};
        try {
            if (typeof moduleInstance.getPresetStyles === 'function') {
                styles = moduleInstance.getPresetStyles();
            }
        } catch (error) {
            console.error(`Error getting styles from ${moduleName}:`, error.message);
        }

        const menuText = `✨ *${moduleName.toUpperCase()} Styles*\n\nChoose a style to preview:`;
        const keyboard = { inline_keyboard: [] };
        
        const styleNames = Object.keys(styles);
        
        for (let i = 0; i < styleNames.length; i += 2) {
            const row = [];
            const styleName = styleNames[i];
            const fullStyleName = `${moduleName}_${styleName}`;
            
            row.push({
                text: `✨ ${styleName.toUpperCase()}`,
                callback_data: `tiktok_style_${fullStyleName}`
            });
            
            if (styleNames[i + 1]) {
                const nextStyleName = styleNames[i + 1];
                const nextFullStyleName = `${moduleName}_${nextStyleName}`;
                
                row.push({
                    text: `✨ ${nextStyleName.toUpperCase()}`,
                    callback_data: `tiktok_style_${nextFullStyleName}`
                });
            }
            
            keyboard.inline_keyboard.push(row);
        }
        
        keyboard.inline_keyboard.push([{ text: "🔙 Back to Modules", callback_data: "tiktok_back_to_styles" }]);

        this.bot.editMessageText(menuText, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "Markdown",
            reply_markup: keyboard
        }).catch(error => {
            console.error("Error editing message:", error);
        });
    }

    showSetWatermarkMenu(chatId, messageId) {
        const menuText = "⚙️ *Set Watermark*\n\nChoose a module to customize styles:";
        const keyboard = { inline_keyboard: [] };
        
        const moduleNames = Array.from(this.styleModules.keys());
        
        for (let i = 0; i < moduleNames.length; i += 2) {
            const row = [];
            const moduleName = moduleNames[i];
            
            row.push({
                text: `⚙️ ${moduleName.toUpperCase()}`,
                callback_data: `tiktok_setmodule_${moduleName}`
            });
            
            if (moduleNames[i + 1]) {
                const nextModuleName = moduleNames[i + 1];
                row.push({
                    text: `⚙️ ${nextModuleName.toUpperCase()}`,
                    callback_data: `tiktok_setmodule_${nextModuleName}`
                });
            }
            
            keyboard.inline_keyboard.push(row);
        }
        
        keyboard.inline_keyboard.push([{ text: "🔙 Back", callback_data: "tiktok_back_to_main" }]);

        this.bot.editMessageText(menuText, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "Markdown",
            reply_markup: keyboard
        }).catch(error => {
            console.error("Error editing message:", error);
        });
    }

    selectStyle(chatId, messageId, userId, styleName) {
        const allStyles = this.getAllStyles();
        const style = allStyles.get(styleName);
        
        if (!style) {
            return this.bot.answerCallbackQuery(callbackQuery.id, { text: "Style not found!" });
        }

        const previewText = `✨ *${style.originalName.toUpperCase()} Style Preview*
📦 **Module:** ${style.module}

🏷️ **Text:** ${style.text || "N/A"}
🔤 **Font:** ${style.font || style.fontFamily || "Default"}
📏 **Size:** ${style.fontSize || style.size || "Default"}px
🎨 **Color:** ${style.color || style.textColor || "Default"}
👻 **Opacity:** ${Math.round(100 * (style.opacity || 1))}%
📍 **Position:** ${style.position || "Default"}
🔄 **Rotation:** ${style.rotation || 0}°
✨ **Effect:** ${style.effect || style.glassColor || "Custom"}

This is just a preview. To use this style, go back and use "Set Watermark".`;

        const keyboard = {
            inline_keyboard: [
                [{ text: "🔙 Back to Module", callback_data: `tiktok_module_${style.module}` }],
                [{ text: "🏠 Back to Menu", callback_data: "tiktok_back_to_main" }]
            ]
        };

        this.bot.editMessageText(previewText, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "Markdown",
            reply_markup: keyboard
        }).catch(error => {
            console.error("Error editing message:", error);
        });
    }

    startSetCustomText(chatId, messageId, userId, styleName) {
        const allStyles = this.getAllStyles();
        const style = allStyles.get(styleName);
        
        if (!style) {
            return this.bot.answerCallbackQuery(callbackQuery.id, { text: "Style not found!" });
        }

        const menuText = `⚙️ *Set ${style.originalName.toUpperCase()} Style*
📦 **Module:** ${style.module}

**Current settings:**
🏷️ Text: ${style.text || "Default"}
🔤 Font: ${style.font || style.fontFamily || "Default"}
📏 Size: ${style.fontSize || style.size || "Default"}px
🎨 Color: ${style.color || style.textColor || "Default"}
✨ Effect: ${style.effect || style.glassColor || "Custom"}

Do you want to use the default text or enter custom text?`;

        const keyboard = {
            inline_keyboard: [
                [{ text: "✅ Use Default Text", callback_data: `tiktok_confirm_style_${styleName}` }],
                [{ text: "✏️ Enter Custom Text", callback_data: `tiktok_custom_text_${styleName}` }],
                [{ text: "🔙 Back", callback_data: "tiktok_back_to_setwatermark" }]
            ]
        };

        this.bot.editMessageText(menuText, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "Markdown",
            reply_markup: keyboard
        }).catch(error => {
            console.error("Error editing message:", error);
        });
    }

    startCustomTextInput(chatId, messageId, userId, styleName) {
        const allStyles = this.getAllStyles();
        const style = allStyles.get(styleName);
        
        if (!style) {
            return this.bot.answerCallbackQuery(callbackQuery.id, { text: "Style not found!" });
        }

        const menuText = `✏️ *Enter Custom Text*

Please type the text you want to use for your **${style.originalName.toUpperCase()}** watermark from the **${style.module}** module.

**Examples:**
• Your name: "John Doe"
• Your brand: "@MyBrand"  
• Any text: "My Video"

Send your custom text now:`;

        const keyboard = {
            inline_keyboard: [
                [{ text: "❌ Cancel", callback_data: "tiktok_back_to_setwatermark" }]
            ]
        };

        this.bot.editMessageText(menuText, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "Markdown",
            reply_markup: keyboard
        }).catch(error => {
            console.error("Error editing message:", error);
        });

        this.botManager.setUserState(userId, {
            commandName: "tiktok",
            operation: "custom_text",
            step: "waiting_for_text",
            styleName: styleName
        });
    }

    confirmStyle(chatId, messageId, userId, styleName) {
        const allStyles = this.getAllStyles();
        const style = allStyles.get(styleName);
        
        if (!style) {
            return this.bot.answerCallbackQuery(callbackQuery.id, { text: "Style not found!" });
        }

        this.tikTokPlugin.watermarkSettings.set(userId, {
            ...style,
            fullStyleName: styleName
        });

        const confirmText = `✅ *Watermark Set Successfully!*

**Module:** ${style.module}
**Style:** ${style.originalName.toUpperCase()}
**Text:** ${style.text || "Default"}
**Effect:** ${style.effect || style.glassColor || "Custom"}

Your watermark is now ready to use with Wmtiktok!`;

        const keyboard = {
            inline_keyboard: [
                [{ text: "🎥 Use Wmtiktok Now", callback_data: "tiktok_wmtiktok" }],
                [{ text: "🏠 Back to Menu", callback_data: "tiktok_back_to_main" }]
            ]
        };

        this.bot.editMessageText(confirmText, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "Markdown",
            reply_markup: keyboard
        }).catch(error => {
            console.error("Error editing message:", error);
        });
    }

    handleSetModuleCallback(callbackQuery, moduleName) {
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        
        const moduleInstance = this.styleModules.get(moduleName);
        if (!moduleInstance) {
            return this.bot.answerCallbackQuery(callbackQuery.id, { text: "Module not found!" });
        }

        let styles = {};
        try {
            if (typeof moduleInstance.getPresetStyles === 'function') {
                styles = moduleInstance.getPresetStyles();
            }
        } catch (error) {
            console.error(`Error getting styles from ${moduleName}:`, error.message);
        }

        const menuText = `⚙️ *Set ${moduleName.toUpperCase()} Watermark*\n\nChoose a style to customize:`;
        const keyboard = { inline_keyboard: [] };
        
        const styleNames = Object.keys(styles);
        
        for (let i = 0; i < styleNames.length; i += 2) {
            const row = [];
            const styleName = styleNames[i];
            const fullStyleName = `${moduleName}_${styleName}`;
            
            row.push({
                text: `⚙️ ${styleName.toUpperCase()}`,
                callback_data: `tiktok_set_style_${fullStyleName}`
            });
            
            if (styleNames[i + 1]) {
                const nextStyleName = styleNames[i + 1];
                const nextFullStyleName = `${moduleName}_${nextStyleName}`;
                
                row.push({
                    text: `⚙️ ${nextStyleName.toUpperCase()}`,
                    callback_data: `tiktok_set_style_${nextFullStyleName}`
                });
            }
            
            keyboard.inline_keyboard.push(row);
        }
        
        keyboard.inline_keyboard.push([{ text: "🔙 Back", callback_data: "tiktok_back_to_setwatermark" }]);

        this.bot.editMessageText(menuText, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "Markdown",
            reply_markup: keyboard
        }).catch(error => {
            console.error("Error editing message:", error);
        });

        // Set user state to wait for URL input
        this.botManager.setUserState(userId, {
            commandName: "tiktok",
            operation: "wmtiktok",
            step: "waiting_for_url"
        });
    }

    startNrmTikTok(chatId, messageId, userId) {
        const menuText = `📱 *Nrmtiktok - Download Clean Video*

Download TikTok videos without any watermarks or effects.

Please send me the TikTok URL you want to download.

**Example:** https://www.tiktok.com/@username/video/1234567890`;

        const keyboard = {
            inline_keyboard: [
                [{ text: "❌ Cancel", callback_data: "tiktok_back_to_main" }]
            ]
        };

        this.bot.editMessageText(menuText, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "Markdown",
            reply_markup: keyboard
        }).catch(error => {
            console.error("Error editing message:", error);
        });

        // Set user state to wait for URL input
        this.botManager.setUserState(userId, {
            commandName: "tiktok",
            operation: "nrmtiktok",
            step: "waiting_for_url"
        });
    }

    showSetCookieMenu(chatId, messageId, userId) {
        const cookieStatus = this.tikTokPlugin.tiktokCookie ? "✅ Set" : "❌ Not Set";
        
        const menuText = `🍪 *TikTok Cookie Management*

**Current Status:** ${cookieStatus}

Setting a TikTok cookie enables:
• Better download quality
• Access to some restricted content
• Reduced rate limiting

**Warning:** Only use your own TikTok cookie. Never share cookies with others.`;

        const keyboard = {
            inline_keyboard: [
                [{ text: "🔧 Set New Cookie", callback_data: "tiktok_set_new_cookie" }],
                [{ text: "🔙 Back", callback_data: "tiktok_back_to_main" }]
            ]
        };

        this.bot.editMessageText(menuText, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "Markdown",
            reply_markup: keyboard
        }).catch(error => {
            console.error("Error editing message:", error);
        });
    }

    showCookieStatus(chatId, messageId) {
        const hasCookie = this.tikTokPlugin.tiktokCookie;
        const status = hasCookie ? "✅ Active" : "❌ Not Set";
        const cookieLength = hasCookie ? this.tikTokPlugin.tiktokCookie.length : 0;
        
        const menuText = `📊 *Cookie Status*

**Status:** ${status}
**Length:** ${cookieLength} characters
**Features:** ${hasCookie ? "Enhanced downloads enabled" : "Basic downloads only"}

${hasCookie ? "🔒 Your cookie is securely stored for this session." : "💡 Set a cookie to unlock enhanced features."}`;

        const keyboard = {
            inline_keyboard: [
                [{ text: "🔧 Set Cookie", callback_data: "tiktok_setcookie" }],
                [{ text: "🔙 Back", callback_data: "tiktok_back_to_main" }]
            ]
        };

        this.bot.editMessageText(menuText, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "Markdown",
            reply_markup: keyboard
        }).catch(error => {
            console.error("Error editing message:", error);
        });
    }

    startSetCookie(chatId, messageId, userId) {
        const menuText = `🔧 *Set TikTok Cookie*

Please send your TikTok cookie string.

**How to get your cookie:**
1. Open TikTok in your browser
2. Open Developer Tools (F12)
3. Go to Application/Storage → Cookies
4. Copy the entire cookie string

**Security Note:** Only use your own cookie. Never share it with others.

Send your cookie now:`;

        const keyboard = {
            inline_keyboard: [
                [{ text: "❌ Cancel", callback_data: "tiktok_setcookie" }]
            ]
        };

        this.bot.editMessageText(menuText, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "Markdown",
            reply_markup: keyboard
        }).catch(error => {
            console.error("Error editing message:", error);
        });

        this.botManager.setUserState(userId, {
            commandName: "tiktok",
            operation: "set_cookie",
            step: "waiting_for_cookie"
        });
    }

    // Handle custom text input for watermark styles
    async handleCustomTextInput(message, userState, botManager) {
        const userId = message.from.id;
        const chatId = message.chat.id;
        const customText = message.text;
        const styleName = userState.styleName;

        try {
            const allStyles = this.getAllStyles();
            const style = allStyles.get(styleName);
            
            if (!style) {
                await this.bot.sendMessage(chatId, "❌ Style not found. Please try again.");
                botManager.clearUserState(userId);
                return;
            }

            // Create updated style with custom text
            const updatedStyle = {
                ...style,
                text: customText,
                fullStyleName: styleName
            };

            // Save to user's watermark settings
            this.tikTokPlugin.watermarkSettings.set(userId, updatedStyle);

            const confirmText = `✅ *Custom Watermark Set!*

**Module:** ${style.module}
**Style:** ${style.originalName.toUpperCase()}
**Custom Text:** "${customText}"
**Effect:** ${style.effect || style.glassColor || "Custom"}

Your custom watermark is ready to use!`;

            const keyboard = {
                inline_keyboard: [
                    [{ text: "🎥 Use Wmtiktok Now", callback_data: "tiktok_wmtiktok" }],
                    [{ text: "🏠 Back to Menu", callback_data: "tiktok_back_to_main" }]
                ]
            };

            await this.bot.sendMessage(chatId, confirmText, {
                parse_mode: "Markdown",
                reply_markup: keyboard
            });

            // Clear user state
            botManager.clearUserState(userId);

        } catch (error) {
            console.error("Error handling custom text input:", error);
            await this.bot.sendMessage(chatId, `❌ Error setting custom text: ${error.message}`);
            botManager.clearUserState(userId);
        }
    }
}

module.exports = TikTokCommand;
