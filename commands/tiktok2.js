const TikTokWatermarkPlugin = require("../plugins/wmtiktok.js");

class TikTokCommand {
    constructor(bot, botManager) {
        this.bot = bot;
        this.botManager = botManager;
        this.tikTokPlugin = new TikTokWatermarkPlugin();
        this.tikTokPlugin.init({ command: () => {} });
    }

    init() {
        console.log("🎬 TikTok Command initialized");
    }

    getMainButton() {
        return {
            text: "🎬 TikTok Tools",
            callback_data: "tiktok_main"
        };
    }

    handleCallback(callbackQuery, botManager) {
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        const data = callbackQuery.data;
        const userId = callbackQuery.from.id;

        if (!data.startsWith("tiktok_")) return false;

        switch (data) {
            case "tiktok_main":
            case "tiktok_back_to_main":
                this.showCommandMenu(chatId, messageId);
                break;
            case "tiktok_styles":
                this.showStylesMenu(chatId, messageId);
                break;
            case "tiktok_setwatermark":
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
                if (data.startsWith("tiktok_style_")) {
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
        return true;
    }

    showCommandMenu(chatId, messageId) {
        const cookieStatus = this.tikTokPlugin.tiktokCookie ? "✅" : "❌";
        const allStyles = this.tikTokPlugin.getAllStyles();
        const moduleCount = this.tikTokPlugin.styleModules.size;
        
        const text = `🎬 *TikTok Tools*

Choose what you'd like to do:

🎨 *Styles* - Browse and preview watermark styles (${allStyles.size} available from ${moduleCount} modules)
⚙️ *Set Watermark* - Set custom watermark style and text
🎥 *Wmtiktok* - Download with custom watermark
📱 *Nrmtiktok* - Download without any watermark (clean video)
${cookieStatus} *Set Cookie* - Set TikTok cookie for better downloads
📊 *Cookie Status* - Check current cookie status`;

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
        });
    }

    showSetCookieMenu(chatId, messageId, userId) {
        const text = `🍪 *Set TikTok Cookie*

${this.tikTokPlugin.tiktokCookie ? "Cookie is currently set ✅" : "No cookie set ❌"}

**Why set a cookie?**
• Bypasses 403 access errors
• Higher download success rate
• Access to better quality videos
• Reduces failed downloads

**How to get your TikTok cookie:**
1. Install Cookie-Editor browser extension
2. Login to TikTok.com in your browser
3. Open Cookie-Editor on TikTok page
4. Copy all cookies (or sessionid cookie)
5. Click "Set New Cookie" below

**Benefits:**
✅ Enhanced download features
✅ Better error handling
✅ Higher success rate`;

        this.bot.editMessageText(text, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "Markdown",
            reply_markup: {
                inline_keyboard: [
                    [{ text: "🆕 Set New Cookie", callback_data: "tiktok_set_new_cookie" }],
                    [{ text: "📊 Check Status", callback_data: "tiktok_cookiestatus" }],
                    [{ text: "🔙 Back to Menu", callback_data: "tiktok_back_to_main" }]
                ]
            }
        });
    }

    showCookieStatus(chatId, messageId) {
        const cookieStatus = this.tikTokPlugin.getCookieStatus();
        const hasCookie = !!this.tikTokPlugin.tiktokCookie;
        
        const text = `📊 *Cookie Status*

🍪 **Status:** ${cookieStatus}

**Features:**
${hasCookie ? 
    "✅ Enhanced downloads enabled\n✅ Better 403 error bypass\n✅ Higher success rate\n✅ Access to HD videos" : 
    "❌ Basic downloads only\n❌ May encounter 403 errors\n❌ Limited success rate\n❌ Lower quality videos"
}

${hasCookie ? 
    "\n🎉 **Great!** Your downloads should work better now!" : 
    "\n💡 **Tip:** Set a cookie to improve download reliability!"
}`;

        const keyboard = {
            inline_keyboard: [
                ...(hasCookie ? [] : [[{ text: "🆕 Set Cookie", callback_data: "tiktok_setcookie" }]]),
                [{ text: "🔙 Back to Menu", callback_data: "tiktok_back_to_main" }]
            ]
        };

        this.bot.editMessageText(text, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "Markdown",
            reply_markup: keyboard
        });
    }

    startSetCookie(chatId, messageId, userId) {
        this.bot.editMessageText(`🍪 *Enter TikTok Cookie*

Please paste your TikTok cookie string here.

**Cookie Examples:**
• Full cookie string from Cookie-Editor
• Just the sessionid: \`sessionid=abc123...\`
• Multiple cookies separated by semicolons

**Getting your cookie:**
1. Go to TikTok.com and login
2. Press F12 (Developer Tools)
3. Go to Application/Storage tab
4. Find Cookies > tiktok.com
5. Copy the sessionid value
6. Send it here

**Security Note:** Only use your own cookie, never share it with others.`, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "Markdown",
            reply_markup: {
                inline_keyboard: [
                    [{ text: "❌ Cancel", callback_data: "tiktok_setcookie" }]
                ]
            }
        });

        this.botManager.setUserState(userId, {
            commandName: "tiktok",
            operation: "set_cookie",
            step: "waiting_for_cookie"
        });
    }

    showStylesMenu(chatId, messageId) {
        const keyboard = { inline_keyboard: [] };
        const allStyles = this.tikTokPlugin.getAllStyles();
        const styleNames = Array.from(allStyles.keys());

        // Group styles by module for better organization
        const stylesByModule = {};
        for (const [styleName, styleData] of allStyles) {
            const moduleName = styleData.module || 'default';
            if (!stylesByModule[moduleName]) {
                stylesByModule[moduleName] = [];
            }
            stylesByModule[moduleName].push({ name: styleName, data: styleData });
        }

        // Create buttons organized by module
        for (const [moduleName, moduleStyles] of Object.entries(stylesByModule)) {
            // Add module header (optional, can be removed if too cluttered)
            if (Object.keys(stylesByModule).length > 1) {
                keyboard.inline_keyboard.push([
                    { text: `📦 ${moduleName.toUpperCase()} MODULE`, callback_data: "tiktok_info_module" }
                ]);
            }

            // Add style buttons for this module (2 per row)
            for (let i = 0; i < moduleStyles.length; i += 2) {
                const row = [];
                const style1 = moduleStyles[i];
                const style2 = moduleStyles[i + 1];
                
                row.push({
                    text: `✨ ${style1.data.originalName || style1.name}`,
                    callback_data: `tiktok_style_${style1.name}`
                });
                
                if (style2) {
                    row.push({
                        text: `✨ ${style2.data.originalName || style2.name}`,
                        callback_data: `tiktok_style_${style2.name}`
                    });
                }
                
                keyboard.inline_keyboard.push(row);
            }
        }

        keyboard.inline_keyboard.push([{ text: "🔙 Back", callback_data: "tiktok_back_to_main" }]);

        const totalStyles = allStyles.size;
        const totalModules = this.tikTokPlugin.styleModules.size;
        
        this.bot.editMessageText(`🎨 *Watermark Styles*

Available styles: ${totalStyles} total from ${totalModules} modules

Choose a style to preview and learn more about it:`, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "Markdown",
            reply_markup: keyboard
        });
    }

    showSetWatermarkMenu(chatId, messageId) {
        const keyboard = { inline_keyboard: [] };
        const allStyles = this.tikTokPlugin.getAllStyles();
        
        // Group styles by module for better organization
        const stylesByModule = {};
        for (const [styleName, styleData] of allStyles) {
            const moduleName = styleData.module || 'default';
            if (!stylesByModule[moduleName]) {
                stylesByModule[moduleName] = [];
            }
            stylesByModule[moduleName].push({ name: styleName, data: styleData });
        }

        // Create buttons organized by module
        for (const [moduleName, moduleStyles] of Object.entries(stylesByModule)) {
            // Add module header (optional)
            if (Object.keys(stylesByModule).length > 1) {
                keyboard.inline_keyboard.push([
                    { text: `⚙️ ${moduleName.toUpperCase()} MODULE`, callback_data: "tiktok_info_module" }
                ]);
            }

            // Add style buttons for this module (2 per row)
            for (let i = 0; i < moduleStyles.length; i += 2) {
                const row = [];
                const style1 = moduleStyles[i];
                const style2 = moduleStyles[i + 1];
                
                row.push({
                    text: `⚙️ ${style1.data.originalName || style1.name}`,
                    callback_data: `tiktok_set_style_${style1.name}`
                });
                
                if (style2) {
                    row.push({
                        text: `⚙️ ${style2.data.originalName || style2.name}`,
                        callback_data: `tiktok_set_style_${style2.name}`
                    });
                }
                
                keyboard.inline_keyboard.push(row);
            }
        }

        keyboard.inline_keyboard.push([{ text: "🔙 Back", callback_data: "tiktok_back_to_main" }]);

        const totalStyles = allStyles.size;
        const totalModules = this.tikTokPlugin.styleModules.size;

        this.bot.editMessageText(`⚙️ *Set Watermark*

Available styles: ${totalStyles} total from ${totalModules} modules

Choose a style to customize with your own text:`, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "Markdown",
            reply_markup: keyboard
        });
    }

    selectStyle(chatId, messageId, userId, styleName) {
        const style = this.tikTokPlugin.getStyleByName(styleName);
        
        if (!style) {
            return this.bot.answerCallbackQuery(callbackQuery.id, { text: "Style not found!" });
        }

        const displayName = style.originalName || styleName;
        const moduleName = style.module || 'default';
        
        const text = `✨ *${displayName.toUpperCase()} Style Preview*

📦 **Module:** ${moduleName}
🏷️ **Text:** ${style.text || 'Default text'}
🔤 **Font:** ${style.font || style.fontFamily || 'Default'}
📏 **Size:** ${style.fontSize || style.size || 'Default'}px
🎨 **Color:** ${style.color || style.textColor || style.fontColor || 'Default'}
👻 **Opacity:** ${Math.round((style.opacity || 0.5) * 100)}%
📍 **Position:** ${style.position || 'Default'}
🔄 **Rotation:** ${style.rotation || 0}°
✨ **Effect:** ${style.effect || 'None'}

This is just a preview. To use this style, go back and use "Set Watermark".`;

        this.bot.editMessageText(text, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "Markdown",
            reply_markup: {
                inline_keyboard: [
                    [{ text: "🔙 Back to Styles", callback_data: "tiktok_styles" }],
                    [{ text: "🏠 Back to Menu", callback_data: "tiktok_back_to_main" }]
                ]
            }
        });
    }

    startSetCustomText(chatId, messageId, userId, styleName) {
        const style = this.tikTokPlugin.getStyleByName(styleName);
        
        if (!style) {
            return this.bot.answerCallbackQuery(callbackQuery.id, { text: "Style not found!" });
        }

        const displayName = style.originalName || styleName;
        const moduleName = style.module || 'default';

        const text = `⚙️ *Set ${displayName.toUpperCase()} Style*

**Current settings:**
📦 Module: ${moduleName}
🏷️ Text: ${style.text || 'Default text'}
🔤 Font: ${style.font || style.fontFamily || 'Default'}
📏 Size: ${style.fontSize || style.size || 'Default'}px
🎨 Color: ${style.color || style.textColor || style.fontColor || 'Default'}
✨ Effect: ${style.effect || 'None'}

Do you want to use the default text or enter custom text?`;

        const keyboard = {
            inline_keyboard: [
                [{ text: "✅ Use Default Text", callback_data: `tiktok_confirm_style_${styleName}` }],
                [{ text: "✏️ Enter Custom Text", callback_data: `tiktok_custom_text_${styleName}` }],
                [{ text: "🔙 Back", callback_data: "tiktok_setwatermark" }]
            ]
        };

        this.bot.editMessageText(text, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "Markdown",
            reply_markup: keyboard
        });
    }

    startCustomTextInput(chatId, messageId, userId, styleName) {
        const style = this.tikTokPlugin.getStyleByName(styleName);
        const displayName = style?.originalName || styleName;

        const text = `✏️ *Enter Custom Text*

Please type the text you want to use for your **${displayName.toUpperCase()}** watermark.

**Examples:**
• Your name: "John Doe"
• Your brand: "@MyBrand"
• Any text: "My Video"

Send your custom text now:`;

        this.bot.editMessageText(text, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "Markdown",
            reply_markup: {
                inline_keyboard: [
                    [{ text: "❌ Cancel", callback_data: "tiktok_setwatermark" }]
                ]
            }
        });

        this.botManager.setUserState(userId, {
            commandName: "tiktok",
            operation: "custom_text",
            step: "waiting_for_text",
            styleName: styleName
        });
    }

    confirmStyle(chatId, messageId, userId, styleName) {
        const style = this.tikTokPlugin.getStyleByName(styleName);
        
        if (!style) {
            return this.bot.answerCallbackQuery(callbackQuery.id, { text: "Style not found!" });
        }

        // Set the watermark using the style's fullStyleName for proper identification
        this.tikTokPlugin.watermarkSettings.set(userId, {
            ...style,
            fullStyleName: styleName  // This is important for wmtiktok.js to identify the style
        });

        const displayName = style.originalName || styleName;
        const moduleName = style.module || 'default';

        const text = `✅ *Watermark Set Successfully!*

**Style:** ${displayName.toUpperCase()}
**Module:** ${moduleName}
**Text:** ${style.text || 'Default text'}
**Effect:** ${style.effect || 'None'}

Your watermark is now ready to use with Wmtiktok!`;

        this.bot.editMessageText(text, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "Markdown",
            reply_markup: {
                inline_keyboard: [
                    [{ text: "🎥 Use Wmtiktok Now", callback_data: "tiktok_wmtiktok" }],
                    [{ text: "🏠 Back to Menu", callback_data: "tiktok_back_to_main" }]
                ]
            }
        });
    }

    startWmTikTok(chatId, messageId, userId) {
        const currentWatermark = this.tikTokPlugin.watermarkSettings.get(userId) || this.tikTokPlugin.defaultWatermark;
        const styleName = currentWatermark.originalName || 'default';
        const effect = currentWatermark.effect || 'default';
        const moduleName = currentWatermark.module || 'built-in';

        const text = `🎥 *Wmtiktok - Download with Watermark*

**Current watermark:** ${currentWatermark.text} 
**Style:** ${styleName} (${effect} from ${moduleName})

Please send me the TikTok URL you want to download with watermark.

**Example:** https://www.tiktok.com/@username/video/1234567890`;

        this.bot.editMessageText(text, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "Markdown",
            reply_markup: {
                inline_keyboard: [
                    [{ text: "⚙️ Change Watermark", callback_data: "tiktok_setwatermark" }],
                    [{ text: "❌ Cancel", callback_data: "tiktok_back_to_main" }]
                ]
            }
        });

        this.botManager.setUserState(userId, {
            commandName: "tiktok",
            operation: "wmtiktok",
            step: "waiting_for_url"
        });
    }

    startNrmTikTok(chatId, messageId, userId) {
        this.bot.editMessageText(`📱 *Nrmtiktok - Clean Download*

Download TikTok videos without any watermark - completely clean!

Please send me the TikTok URL you want to download.

**Example:** https://www.tiktok.com/@username/video/1234567890`, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "Markdown",
            reply_markup: {
                inline_keyboard: [
                    [{ text: "❌ Cancel", callback_data: "tiktok_back_to_main" }]
                ]
            }
        });

        this.botManager.setUserState(userId, {
            commandName: "tiktok",
            operation: "nrmtiktok",
            step: "waiting_for_url"
        });
    }

    handleTextInput(message, state, botManager) {
        const chatId = message.chat.id;
        const userId = message.from.id;
        const text = message.text;

        switch (state.operation) {
            case "wmtiktok":
                this.handleWmTikTokInput(message, state, botManager);
                break;
            case "nrmtiktok":
                this.handleNrmTikTokInput(message, state, botManager);
                break;
            case "custom_text":
                this.handleCustomTextInput(message, state, botManager);
                break;
            case "set_cookie":
                this.handleSetCookieInput(message, state, botManager);
                break;
        }
    }

    async handleSetCookieInput(message, state, botManager) {
        const chatId = message.chat.id;
        const userId = message.from.id;
        const cookieString = message.text.trim();

        if (cookieString) {
            try {
                this.tikTokPlugin.setTikTokCookie(cookieString);
                
                const text = `✅ *Cookie Set Successfully!*

🍪 **TikTok cookie has been set**
🔓 **Enhanced download features enabled**

**Benefits now active:**
✅ Better download success rate
✅ Access to higher quality videos  
✅ Reduced 403 errors
✅ More reliable downloads

Your downloads should work much better now!`;

                const keyboard = {
                    inline_keyboard: [
                        [
                            { text: "🎥 Try Wmtiktok", callback_data: "tiktok_wmtiktok" },
                            { text: "📱 Try Nrmtiktok", callback_data: "tiktok_nrmtiktok" }
                        ],
                        [{ text: "🏠 Back to Menu", callback_data: "tiktok_back_to_main" }]
                    ]
                };

                this.bot.sendMessage(chatId, text, {
                    parse_mode: "Markdown",
                    reply_markup: keyboard
                });

                botManager.clearUserState(userId);
            } catch (error) {
                console.error("Cookie setting error:", error);
                this.bot.sendMessage(chatId, `❌ Error setting cookie: ${error.message}\n\nPlease make sure you copied the correct cookie string.`);
            }
        } else {
            this.bot.sendMessage(chatId, "❌ Please provide a valid cookie string");
        }
    }

    async handleWmTikTokInput(message, state, botManager) {
        const chatId = message.chat.id;
        const userId = message.from.id;
        const url = message.text.trim();

        if (url.includes('tiktok.com')) {
            try {
                const statusMessage = await this.bot.sendMessage(chatId, "⏳ Downloading TikTok video with watermark...");

                // Create a mock message object that wmtiktok.js expects
                const mockMessage = {
                    from: userId,
                    reply: (content, options) => {
                        if (Buffer.isBuffer(content)) {
                            return this.bot.sendVideo(chatId, content, options);
                        } else {
                            return this.bot.editMessageText(content, {
                                chat_id: chatId,
                                message_id: statusMessage.message_id,
                                parse_mode: "Markdown"
                            });
                        }
                    }
                };

                await this.tikTokPlugin.handleWmTikTok(mockMessage, [url]);
                botManager.clearUserState(userId);
            } catch (error) {
                console.error("Wmtiktok error:", error);
                this.bot.sendMessage(chatId, `❌ Error: ${error.message}`);
            }
        } else {
            this.bot.sendMessage(chatId, "❌ Please provide a valid TikTok URL");
        }
    }

    async handleNrmTikTokInput(message, state, botManager) {
        const chatId = message.chat.id;
        const userId = message.from.id;
        const url = message.text.trim();
        const fs = require('fs');

        if (url.includes('tiktok.com')) {
            try {
                const statusMessage = await this.bot.sendMessage(chatId, "⏳ Downloading clean TikTok video...");
                
                const filePath = await this.tikTokPlugin.downloadTikTokVideo(url, Boolean(this.tikTokPlugin.tiktokCookie));
                const videoBuffer = fs.readFileSync(filePath);
                
                await this.bot.sendVideo(chatId, videoBuffer, {
                    caption: "✅ Clean TikTok video downloaded successfully!\n📱 No watermarks added - completely clean!"
                });
                
                // Clean up
                fs.unlinkSync(filePath);
                this.bot.deleteMessage(chatId, statusMessage.message_id);
                botManager.clearUserState(userId);
            } catch (error) {
                console.error("Nrmtiktok error:", error);
                this.bot.sendMessage(chatId, `❌ Error: ${error.message}`);
            }
        } else {
            this.bot.sendMessage(chatId, "❌ Please provide a valid TikTok URL");
        }
    }

    handleCustomTextInput(message, state, botManager) {
        const chatId = message.chat.id;
        const userId = message.from.id;
        const customText = message.text.trim();
        const styleName = state.styleName;

        if (!customText) {
            return this.bot.sendMessage(chatId, "❌ Please provide some text for your watermark");
        }

        const style = this.tikTokPlugin.getStyleByName(styleName);
        if (!style) {
            return this.bot.sendMessage(chatId, "❌ Style not found");
        }

        // Create the custom watermark settings
        const customWatermark = {
            ...style,
            text: customText,
            fullStyleName: styleName  // Important for wmtiktok.js to identify the style
        };

        this.tikTokPlugin.watermarkSettings.set(userId, customWatermark);

        const displayName = style.originalName || styleName;
        const moduleName = style.module || 'default';

        const text = `✅ *Custom Watermark Set!*

**Style:** ${displayName.toUpperCase()}
**Module:** ${moduleName}
**Your Text:** ${customText}
**Effect:** ${style.effect || 'None'}

Your custom watermark is ready to use!`;

        this.bot.sendMessage(chatId, text, {
            parse_mode: "Markdown",
            reply_markup: {
                inline_keyboard: [
                    [{ text: "🎥 Use Wmtiktok Now", callback_data: "tiktok_wmtiktok" }],
                    [{ text: "🏠 Back to Menu", callback_data: "tiktok_back_to_main" }]
                ]
            }
        });

        botManager.clearUserState(userId);
    }
}

module.exports = TikTokCommand;