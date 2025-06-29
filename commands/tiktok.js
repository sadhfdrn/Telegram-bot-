const TikTokWatermarkPlugin = require('../plugins/wmtiktok.js');

class TikTokCommand {
    constructor(bot, botManager) {
        this.bot = bot;
        this.botManager = botManager;
        this.tikTokPlugin = new TikTokWatermarkPlugin();
        this.tikTokPlugin.init({ command: () => {} }); // Initialize plugin
    }

    init() {
        console.log('🎬 TikTok Command initialized');
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
            default:
                // Handle style selection
                if (data.startsWith('tiktok_style_')) {
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
        
        const menuMessage = `🎬 *TikTok Tools*

Choose what you'd like to do:

🎨 *Styles* - Browse and preview watermark styles
⚙️ *Set Watermark* - Set custom watermark style and text
🎥 *Wmtiktok* - Download with custom watermark
📱 *Nrmtiktok* - Download without any watermark (clean video)
${cookieStatus} *Set Cookie* - Set TikTok cookie for better downloads
📊 *Cookie Status* - Check current cookie status`;

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

    // Show Set Cookie menu
    showSetCookieMenu(chatId, messageId, userId) {
        const currentStatus = this.tikTokPlugin.tiktokCookie ? 'Cookie is currently set ✅' : 'No cookie set ❌';
        
        const setCookieMessage = `🍪 *Set TikTok Cookie*

${currentStatus}

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

        const keyboard = {
            inline_keyboard: [
                [{ text: '🆕 Set New Cookie', callback_data: 'tiktok_set_new_cookie' }],
                [{ text: '📊 Check Status', callback_data: 'tiktok_cookiestatus' }],
                [{ text: '🔙 Back to Menu', callback_data: 'tiktok_back_to_main' }]
            ]
        };

        this.bot.editMessageText(setCookieMessage, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }

    // Show Cookie Status
    showCookieStatus(chatId, messageId) {
        const status = this.tikTokPlugin.getCookieStatus();
        const isSet = this.tikTokPlugin.tiktokCookie ? true : false;
        
        const features = isSet ? 
            '✅ Enhanced downloads enabled\n✅ Better 403 error bypass\n✅ Higher success rate\n✅ Access to HD videos' : 
            '❌ Basic downloads only\n❌ May encounter 403 errors\n❌ Limited success rate\n❌ Lower quality videos';
        
        const statusMessage = `📊 *Cookie Status*

🍪 **Status:** ${status}

**Features:**
${features}

${!isSet ? '\n💡 **Tip:** Set a cookie to improve download reliability!' : '\n🎉 **Great!** Your downloads should work better now!'}`;

        const keyboard = {
            inline_keyboard: [
                ...(isSet ? [] : [[{ text: '🆕 Set Cookie', callback_data: 'tiktok_setcookie' }]]),
                [{ text: '🔙 Back to Menu', callback_data: 'tiktok_back_to_main' }]
            ]
        };

        this.bot.editMessageText(statusMessage, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }

    // Start cookie setting process
    startSetCookie(chatId, messageId, userId) {
        const setCookieMessage = `🍪 *Enter TikTok Cookie*

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

**Security Note:** Only use your own cookie, never share it with others.`;

        const keyboard = {
            inline_keyboard: [
                [{ text: '❌ Cancel', callback_data: 'tiktok_setcookie' }]
            ]
        };

        this.bot.editMessageText(setCookieMessage, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });

        // Set user state to expect cookie input
        this.botManager.setUserState(userId, {
            commandName: 'tiktok',
            operation: 'set_cookie',
            step: 'waiting_for_cookie'
        });
    }

    // Show styles selection menu
    showStylesMenu(chatId, messageId) {
        const stylesMessage = `🎨 *Watermark Styles*

Choose a style to preview and set:`;

        const keyboard = {
            inline_keyboard: []
        };

        // Add style buttons
        const styles = this.tikTokPlugin.styles;
        const styleNames = Object.keys(styles);
        
        // Create rows of 2 buttons each
        for (let i = 0; i < styleNames.length; i += 2) {
            const row = [];
            row.push({ text: `✨ ${styleNames[i].toUpperCase()}`, callback_data: `tiktok_style_${styleNames[i]}` });
            if (styleNames[i + 1]) {
                row.push({ text: `✨ ${styleNames[i + 1].toUpperCase()}`, callback_data: `tiktok_style_${styleNames[i + 1]}` });
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

    // Show set watermark menu (simplified)
    showSetWatermarkMenu(chatId, messageId) {
        const setWatermarkMessage = `⚙️ *Set Watermark*

Choose a style to customize with your own text:`;

        const keyboard = {
            inline_keyboard: []
        };

        // Add style buttons for setting
        const styles = this.tikTokPlugin.styles;
        const styleNames = Object.keys(styles);
        
        // Create rows of 2 buttons each
        for (let i = 0; i < styleNames.length; i += 2) {
            const row = [];
            row.push({ text: `⚙️ ${styleNames[i].toUpperCase()}`, callback_data: `tiktok_set_style_${styleNames[i]}` });
            if (styleNames[i + 1]) {
                row.push({ text: `⚙️ ${styleNames[i + 1].toUpperCase()}`, callback_data: `tiktok_set_style_${styleNames[i + 1]}` });
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
    selectStyle(chatId, messageId, userId, styleName) {
        const style = this.tikTokPlugin.styles[styleName];
        if (!style) {
            this.bot.answerCallbackQuery(callbackQuery.id, { text: 'Style not found!' });
            return;
        }

        const styleMessage = `✨ *${styleName.toUpperCase()} Style Preview*

🏷️ **Text:** ${style.text}
🔤 **Font:** ${style.font}
📏 **Size:** ${style.fontSize}px
🎨 **Color:** ${style.color}
👻 **Opacity:** ${Math.round(style.opacity * 100)}%
📍 **Position:** ${style.position}
🔄 **Rotation:** ${style.rotation}°
✨ **Effect:** ${style.effect}
📐 **Tilt:** ${style.tilt}

This is just a preview. To use this style, go back and use "Set Watermark".`;

        const keyboard = {
            inline_keyboard: [
                [{ text: '🔙 Back to Styles', callback_data: 'tiktok_styles' }],
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
    startSetCustomText(chatId, messageId, userId, styleName) {
        const style = this.tikTokPlugin.styles[styleName];
        if (!style) {
            this.bot.answerCallbackQuery(callbackQuery.id, { text: 'Style not found!' });
            return;
        }

        const setTextMessage = `⚙️ *Set ${styleName.toUpperCase()} Style*

**Current settings:**
🏷️ Text: ${style.text}
🔤 Font: ${style.font}
📏 Size: ${style.fontSize}px
🎨 Color: ${style.color}
✨ Effect: ${style.effect}

Do you want to use the default text or enter custom text?`;

        const keyboard = {
            inline_keyboard: [
                [{ text: '✅ Use Default Text', callback_data: `tiktok_confirm_style_${styleName}` }],
                [{ text: '✏️ Enter Custom Text', callback_data: `tiktok_custom_text_${styleName}` }],
                [{ text: '🔙 Back', callback_data: 'tiktok_setwatermark' }]
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
    startCustomTextInput(chatId, messageId, userId, styleName) {
        const customTextMessage = `✏️ *Enter Custom Text*

Please type the text you want to use for your **${styleName.toUpperCase()}** watermark.

**Examples:**
• Your name: "John Doe"
• Your brand: "@MyBrand"
• Any text: "My Video"

Send your custom text now:`;

        const keyboard = {
            inline_keyboard: [
                [{ text: '❌ Cancel', callback_data: 'tiktok_setwatermark' }]
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
            styleName: styleName
        });
    }

    // Confirm and set style with default text
    confirmStyle(chatId, messageId, userId, styleName) {
        const style = this.tikTokPlugin.styles[styleName];
        if (!style) {
            this.bot.answerCallbackQuery(callbackQuery.id, { text: 'Style not found!' });
            return;
        }

        // Set the style for the user
        this.tikTokPlugin.watermarkSettings.set(userId, { ...style });

        const confirmMessage = `✅ *Watermark Set Successfully!*

**Style:** ${styleName.toUpperCase()}
**Text:** ${style.text}
**Effect:** ${style.effect}

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

    // Start Wmtiktok (with watermark)
    startWmTikTok(chatId, messageId, userId) {
        const userSettings = this.tikTokPlugin.watermarkSettings.get(userId) || this.tikTokPlugin.defaultWatermark;
        
        const wmMessage = `🎥 *Wmtiktok - Download with Watermark*

**Current watermark:** ${userSettings.text} (${userSettings.effect || 'default'} style)

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

    // Start Nrmtiktok (without watermark)
    startNrmTikTok(chatId, messageId, userId) {
        const nrmMessage = `📱 *Nrmtiktok - Clean Download*

Download TikTok videos without any watermark - completely clean!

Please send me the TikTok URL you want to download.

**Example:** https://www.tiktok.com/@username/video/1234567890`;

        const keyboard = {
            inline_keyboard: [
                [{ text: '❌ Cancel', callback_data: 'tiktok_back_to_main' }]
            ]
        };

        this.bot.editMessageText(nrmMessage, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });

        // Set user state to expect TikTok URL for clean download
        this.botManager.setUserState(userId, {
            commandName: 'tiktok',
            operation: 'nrmtiktok',
            step: 'waiting_for_url'
        });
    }

    // Handle text input from users
    handleTextInput(msg, userState, botManager) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const text = msg.text;

        switch (userState.operation) {
            case 'wmtiktok':
                this.handleWmTikTokInput(msg, userState, botManager);
                break;
            case 'nrmtiktok':
                this.handleNrmTikTokInput(msg, userState, botManager);
                break;
            case 'custom_text':
                this.handleCustomTextInput(msg, userState, botManager);
                break;
            case 'set_cookie':
                this.handleSetCookieInput(msg, userState, botManager);
                break;
        }
    }

    // Handle cookie setting input
    async handleSetCookieInput(msg, userState, botManager) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const cookieString = msg.text.trim();

        if (!cookieString) {
            this.bot.sendMessage(chatId, '❌ Please provide a valid cookie string');
            return;
        }

        try {
            // Set the cookie using the plugin method
            this.tikTokPlugin.setTikTokCookie(cookieString);
            
            const successMessage = `✅ *Cookie Set Successfully!*

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
                [{ text: '🎥 Try Wmtiktok', callback_data: 'tiktok_wmtiktok' },
                 { text: '📱 Try Nrmtiktok', callback_data: 'tiktok_nrmtiktok' }],
                [{ text: '🏠 Back to Menu', callback_data: 'tiktok_back_to_main' }]
            ]
            };

            this.bot.sendMessage(chatId, successMessage, {
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });
            
            // Clear user state
            botManager.clearUserState(userId);
            
        } catch (error) {
            console.error('Cookie setting error:', error);
            this.bot.sendMessage(chatId, `❌ Error setting cookie: ${error.message}\n\nPlease make sure you copied the correct cookie string.`);
        }
    }

    // Handle Wmtiktok download input
    async handleWmTikTokInput(msg, userState, botManager) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const url = msg.text.trim();

        // Validate TikTok URL
        if (!url.includes('tiktok.com')) {
            this.bot.sendMessage(chatId, '❌ Please provide a valid TikTok URL');
            return;
        }

        try {
            const processingMsg = await this.bot.sendMessage(chatId, '⏳ Downloading TikTok video with watermark...');
            
            // Use the plugin's download method with watermark
            const mockMessage = {
                from: userId,
                reply: (content, options) => {
                    if (Buffer.isBuffer(content)) {
                        return this.bot.sendVideo(chatId, content, options);
                    } else {
                        return this.bot.editMessageText(content, {
                            chat_id: chatId,
                            message_id: processingMsg.message_id,
                            parse_mode: 'Markdown'
                        });
                    }
                }
            };

            await this.tikTokPlugin.handleWmTikTok(mockMessage, [url]);
            
            // Clear user state
            botManager.clearUserState(userId);
            
        } catch (error) {
            console.error('Wmtiktok error:', error);
            this.bot.sendMessage(chatId, `❌ Error: ${error.message}`);
        }
    }

    // Handle Nrmtiktok download input (clean download)
    async handleNrmTikTokInput(msg, userState, botManager) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const url = msg.text.trim();
        const fs = require('fs');

        // Validate TikTok URL
        if (!url.includes('tiktok.com')) {
            this.bot.sendMessage(chatId, '❌ Please provide a valid TikTok URL');
            return;
        }

        try {
            const processingMsg = await this.bot.sendMessage(chatId, '⏳ Downloading clean TikTok video...');
            
            // Download video without watermark
            const videoPath = await this.tikTokPlugin.downloadTikTokMedia(url, Boolean(this.tikTokPlugin.tiktokCookie));
            
            // Send the clean video directly (no watermark processing)
            const videoBuffer = fs.readFileSync(videoPath);
            await this.bot.sendVideo(chatId, videoBuffer, { 
                caption: '✅ Clean TikTok video downloaded successfully!\n📱 No watermarks added - completely clean!'
            });

            // Clean up temp file
            fs.unlinkSync(videoPath);
            
            // Delete processing message
            this.bot.deleteMessage(chatId, processingMsg.message_id);
            
            // Clear user state
            botManager.clearUserState(userId);
            
        } catch (error) {
            console.error('Nrmtiktok error:', error);
            this.bot.sendMessage(chatId, `❌ Error: ${error.message}`);
        }
    }

    // Handle custom text input for watermark
    handleCustomTextInput(msg, userState, botManager) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const customText = msg.text.trim();
        const styleName = userState.styleName;

        if (!customText) {
            this.bot.sendMessage(chatId, '❌ Please provide some text for your watermark');
            return;
        }

        const style = this.tikTokPlugin.styles[styleName];
        if (!style) {
            this.bot.sendMessage(chatId, '❌ Style not found');
            return;
        }

        // Set the style with custom text
        const newSettings = { ...style, text: customText };
        this.tikTokPlugin.watermarkSettings.set(userId, newSettings);

        const confirmMessage = `✅ *Custom Watermark Set!*

**Style:** ${styleName.toUpperCase()}
**Your Text:** ${customText}
**Effect:** ${style.effect}

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
}

module.exports = TikTokCommand;
