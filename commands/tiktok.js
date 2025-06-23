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
        for (const [moduleName, styleInstance] of this.styleModules) {
            try {
                if (typeof styleInstance.getPresetStyles === "function") {
                    const presetStyles = styleInstance.getPresetStyles();
                    for (const [styleKey, styleConfig] of Object.entries(presetStyles)) {
                        const fullStyleName = `${moduleName}_${styleKey}`;
                        allStyles.set(fullStyleName, {
                            ...styleConfig,
                            module: moduleName,
                            styleClass: styleInstance,
                            originalName: styleKey
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

    // FIXED: This is the main callback handler - was duplicated/conflicting
    handleCallback(callbackQuery, userData) {
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        const data = callbackQuery.data;
        const userId = callbackQuery.from.id;

        console.log(`🔧 TikTok callback received: ${data}`); // Debug log

        if (!data.startsWith("tiktok_")) {
            return false;
        }

        try {
            switch (data) {
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
                    if (data.startsWith("tiktok_module_")) {
                        const moduleName = data.replace("tiktok_module_", "");
                        this.showModuleStyles(chatId, messageId, moduleName);
                    } else if (data.startsWith("tiktok_setmodule_")) {
                        const moduleName = data.replace("tiktok_setmodule_", "");
                        this.handleSetModuleCallback(callbackQuery, moduleName);
                    } else if (data.startsWith("tiktok_style_")) {
                        const styleName = data.replace("tiktok_style_", "");
                        this.selectStyle(chatId, messageId, userId, styleName);
                    } else if (data.startsWith("tiktok_set_style_")) {
                        const styleName = data.replace("tiktok_set_style_", "");
                        this.startSetCustomText(chatId, messageId, userId, styleName);
                    } else if (data.startsWith("tiktok_confirm_style_")) {
                        const styleName = data.replace("tiktok_confirm_style_", "");
                        this.confirmStyle(chatId, messageId, userId, styleName);
                    } else if (data.startsWith("tiktok_custom_text_")) {
                        const styleName = data.replace("tiktok_custom_text_", "");
                        this.startCustomTextInput(chatId, messageId, userId, styleName);
                    }
                    break;
            }
            
            // Answer the callback query to remove loading state
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
        
        const text = `🎬 *TikTok Tools*

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

        this.bot.editMessageText(text, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "Markdown",
            reply_markup: keyboard
        }).catch(error => {
            console.error("Error editing message:", error);
        });
    }

    showStylesMenu(chatId, messageId) {
        const text = `🎨 *Watermark Style Modules*

Choose a style module to explore:`;

        const keyboard = { inline_keyboard: [] };
        const moduleNames = Array.from(this.styleModules.keys());
        
        for (let i = 0; i < moduleNames.length; i += 2) {
            const row = [];
            const moduleName = moduleNames[i];
            const moduleInstance = this.styleModules.get(moduleName);
            let styleCount = 0;
            
            try {
                if (typeof moduleInstance.getPresetStyles === "function") {
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
                    if (typeof nextModuleInstance.getPresetStyles === "function") {
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
        
        keyboard.inline_keyboard.push([
            { text: "🔙 Back", callback_data: "tiktok_back_to_main" }
        ]);

        this.bot.editMessageText(text, {
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
            this.bot.answerCallbackQuery(callbackQuery.id, { text: "Module not found!" });
            return;
        }

        let presetStyles = {};
        try {
            if (typeof moduleInstance.getPresetStyles === "function") {
                presetStyles = moduleInstance.getPresetStyles();
            }
        } catch (error) {
            console.error(`Error getting styles from ${moduleName}:`, error.message);
        }

        const text = `✨ *${moduleName.toUpperCase()} Styles*

Choose a style to preview:`;

        const keyboard = { inline_keyboard: [] };
        const styleKeys = Object.keys(presetStyles);
        
        for (let i = 0; i < styleKeys.length; i += 2) {
            const row = [];
            const styleKey = styleKeys[i];
            const fullStyleName = `${moduleName}_${styleKey}`;
            
            row.push({
                text: `✨ ${styleKey.toUpperCase()}`,
                callback_data: `tiktok_style_${fullStyleName}`
            });
            
            if (styleKeys[i + 1]) {
                const nextStyleKey = styleKeys[i + 1];
                const nextFullStyleName = `${moduleName}_${nextStyleKey}`;
                row.push({
                    text: `✨ ${nextStyleKey.toUpperCase()}`,
                    callback_data: `tiktok_style_${nextFullStyleName}`
                });
            }
            
            keyboard.inline_keyboard.push(row);
        }
        
        keyboard.inline_keyboard.push([
            { text: "🔙 Back to Modules", callback_data: "tiktok_back_to_styles" }
        ]);

        this.bot.editMessageText(text, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "Markdown",
            reply_markup: keyboard
        }).catch(error => {
            console.error("Error editing message:", error);
        });
    }

    showSetWatermarkMenu(chatId, messageId) {
        const text = `⚙️ *Set Watermark*

Choose a module to customize styles:`;

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
        
        keyboard.inline_keyboard.push([
            { text: "🔙 Back", callback_data: "tiktok_back_to_main" }
        ]);

        this.bot.editMessageText(text, {
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
            this.bot.answerCallbackQuery(callbackQuery.id, { text: "Style not found!" });
            return;
        }

        const text = `✨ *${style.originalName.toUpperCase()} Style Preview*
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

        this.bot.editMessageText(text, {
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
            this.bot.answerCallbackQuery(callbackQuery.id, { text: "Style not found!" });
            return;
        }

        const text = `⚙️ *Set ${style.originalName.toUpperCase()} Style*
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

        this.bot.editMessageText(text, {
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
            this.bot.answerCallbackQuery(callbackQuery.id, { text: "Style not found!" });
            return;
        }

        const text = `✏️ *Enter Custom Text*

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

        this.bot.editMessageText(text, {
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
            this.bot.answerCallbackQuery(callbackQuery.id, { text: "Style not found!" });
            return;
        }

        this.tikTokPlugin.watermarkSettings.set(userId, {
            ...style,
            fullStyleName: styleName
        });

        const text = `✅ *Watermark Set Successfully!*

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

        this.bot.editMessageText(text, {
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
            this.bot.answerCallbackQuery(callbackQuery.id, { text: "Module not found!" });
            return;
        }

        let presetStyles = {};
        try {
            if (typeof moduleInstance.getPresetStyles === "function") {
                presetStyles = moduleInstance.getPresetStyles();
            }
        } catch (error) {
            console.error(`Error getting styles from ${moduleName}:`, error.message);
        }

        const text = `⚙️ *Set ${moduleName.toUpperCase()} Watermark*

Choose a style to customize:`;

        const keyboard = { inline_keyboard: [] };
        const styleKeys = Object.keys(presetStyles);
        
        for (let i = 0; i < styleKeys.length; i += 2) {
            const row = [];
            const styleKey = styleKeys[i];
            const fullStyleName = `${moduleName}_${styleKey}`;
            
            row.push({
                text: `⚙️ ${styleKey.toUpperCase()}`,
                callback_data: `tiktok_set_style_${fullStyleName}`
            });
            
            if (styleKeys[i + 1]) {
                const nextStyleKey = styleKeys[i + 1];
                const nextFullStyleName = `${moduleName}_${nextStyleKey}`;
                row.push({
                    text: `⚙️ ${nextStyleKey.toUpperCase()}`,
                    callback_data: `tiktok_set_style_${nextFullStyleName}`
                });
            }
            
            keyboard.inline_keyboard.push(row);
        }
        
        keyboard.inline_keyboard.push([
            { text: "🔙 Back", callback_data: "tiktok_back_to_setwatermark" }
        ]);

        this.bot.editMessageText(text, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "Markdown",
            reply_markup: keyboard
        }).catch(error => {
            console.error("Error editing message:", error);
        });
    }

    startWmTikTok(chatId, messageId, userId) {
        const userSettings = this.tikTokPlugin.watermarkSettings.get(userId);
        let watermarkInfo = "Default watermark";
        
        if (userSettings && userSettings.fullStyleName) {
            const allStyles = this.getAllStyles();
            const style = allStyles.get(userSettings.fullStyleName);
            if (style) {
                watermarkInfo = `${style.originalName.toUpperCase()} from ${style.module} module`;
            }
        }

        const text = `🎥 *Wmtiktok - Download with Watermark*

**Current watermark:** ${watermarkInfo}
**Text:** ${userSettings?.text || "Default"}

Please send me the TikTok URL you want to download with watermark.

**Example:** https://www.tiktok.com/@username/video/1234567890`;

        const keyboard = {
            inline_keyboard: [
                [{ text: "⚙️ Change Watermark", callback_data: "tiktok_setwatermark" }],
                [{ text: "❌ Cancel", callback_data: "tiktok_back_to_main" }]
            ]
        };

        this.bot.editMessageText(text, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "Markdown",
            reply_markup: keyboard
        }).catch(error => {
            console.error("Error editing message:", error);
        });

        this.botManager.setUserState(userId, {
            commandName: "tiktok",
            operation: "wmtiktok",
            step: "waiting_for_url"
        });
    }

    startNrmTikTok(chatId, messageId, userId) {
        const text = `📱 *Nrmtiktok - Download Clean Video*

This will download the video without any watermark (completely clean).

Please send me the TikTok URL you want to download.

**Example:** https://www.tiktok.com/@username/video/1234567890`;

        const keyboard = {
            inline_keyboard: [
                [{ text: "❌ Cancel", callback_data: "tiktok_back_to_main" }]
            ]
        };

        this.bot.editMessageText(text, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "Markdown",
            reply_markup: keyboard
        }).catch(error => {
            console.error("Error editing message:", error);
        });

        this.botManager.setUserState(userId, {
            commandName: "tiktok",
            operation: "nrmtiktok",
            step: "waiting_for_url"
        });
    }

    showSetCookieMenu(chatId, messageId, userId) {
        const text = `🍪 *Set TikTok Cookie*

Setting a TikTok cookie helps bypass download restrictions and improves success rate.

**How to get your cookie:**
1. Install Cookie-Editor browser extension
2. Login to TikTok.com
3. Open Cookie-Editor on TikTok
4. Copy all cookies
5. Send the cookie string here

**Current status:** ${this.tikTokPlugin.tiktokCookie ? "✅ Cookie is set" : "❌ No cookie set"}`;

        const keyboard = {
            inline_keyboard: [
                [{ text: "📝 Enter New Cookie", callback_data: "tiktok_set_new_cookie" }],
                [{ text: "🔙 Back", callback_data: "tiktok_back_to_main" }]
            ]
        };

        this.bot.editMessageText(text, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "Markdown",
            reply_markup: keyboard
        }).catch(error => {
            console.error("Error editing message:", error);
        });
    }

    startSetCookie(chatId, messageId, userId) {
        const text = `📝 *Enter TikTok Cookie*

Please paste your TikTok cookie string here.

**Note:** The cookie should be a long string containing session information from your browser.

Send your cookie now:`;

        const keyboard = {
            inline_keyboard: [
                [{ text: "❌ Cancel", callback_data: "tiktok_setcookie" }]
            ]
        };

        this.bot.editMessageText(text, {
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

    showCookieStatus(chatId, messageId) {
        const status = this.tikTokPlugin.getCookieStatus();
        const features = this.tikTokPlugin.tiktokCookie
            ? "✅ Enhanced downloads enabled\n✅ Better 403 error bypass\n✅ Higher success rate"
            : "❌ Basic downloads only\n❌ May encounter 403 errors\n❌ Limited success rate";

        const text = `📊 *Cookie Status*

**Status:** ${status}

**Features:**
${features}`;

        const keyboard = {
            inline_keyboard: [
                [{ text: "🍪 Set Cookie", callback_data: "tiktok_setcookie" }],
                [{ text: "🔙 Back", callback_data: "tiktok_back_to_main" }]
            ]
        };

        this.bot.editMessageText(text, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "Markdown",
            reply_markup: keyboard
        }).catch(error => {
            console.error("Error editing message:", error);
        });
    }

    handleCustomTextInput(message, userState, botManager) {
        const chatId = message.chat.id;
        const userId = message.from.id;
        const customText = message.text.trim();
        const styleName = userState.styleName;

        if (!customText) {
            this.bot.sendMessage(chatId, "❌ Please provide some text for your watermark");
            return;
        }

        const allStyles = this.getAllStyles();
        const style = allStyles.get(styleName);
        
        if (!style) {
            this.bot.sendMessage(chatId, "❌ Style not found");
            return;
        }

        const customStyle = {
            ...style,
            text: customText,
            fullStyleName: styleName
        };

        this.tikTokPlugin.watermarkSettings.set(userId, customStyle);

        const text = `✅ *Custom Watermark Set!*

**Module:** ${style.module}
**Style:** ${style.originalName.toUpperCase()}
**Your Text:** ${customText}
**Effect:** ${style.effect || style.glassColor || "Custom"}

Your custom watermark is ready to use!`;

        const keyboard = {
            inline_keyboard: [
                [{ text: "🎥 Use Wmtiktok Now", callback_data: "tiktok_wmtiktok" }],
                [{ text: "🏠 Back to Menu", callback_data: "tiktok_back_to_main" }]
            ]
        };

        this.bot.sendMessage(chatId, text, {
            parse_mode: "Markdown",
            reply_markup: keyboard
        });

        botManager.clearUserState(userId);
    }
}

module.exports = TikTokCommand;