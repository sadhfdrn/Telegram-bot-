const TikTokWatermarkPlugin = require("../plugins/wmtiktok.js"),
    fs = require("fs"),
    path = require("path");

class TikTokCommand {
    constructor(t, e) {
        this.bot = t,
        this.botManager = e,
        this.tikTokPlugin = new TikTokWatermarkPlugin,
        this.tikTokPlugin.init({
            command() {}
        }),
        this.styleModules = new Map,
        this.loadStyleModules()
    }

    loadStyleModules() {
        try {
            const t = path.join(__dirname, "../plugins/styles");
            if (!fs.existsSync(t)) return console.warn("Styles directory not found:", t), void 0;
            const e = fs.readdirSync(t).filter(t => t.endsWith(".js")).map(t => t.replace(".js", ""));
            console.log("Loading style modules:", e);
            for (const o of e) try {
                const e = path.join(t, `${o}.js`),
                    a = require(e),
                    s = new a;
                this.styleModules.set(o, s),
                console.log(`✅ Loaded style module: ${o}`)
            } catch (t) {
                console.error(`❌ Failed to load style module ${o}:`, t.message)
            }
        } catch (t) {
            console.error("Error loading style modules:", t.message)
        }
    }

    getAllStyles() {
        const t = new Map;
        for (const [e, o] of this.styleModules) try {
            if ("function" == typeof o.getPresetStyles) {
                const a = o.getPresetStyles();
                for (const [s, i] of Object.entries(a)) {
                    const a = `${e}_${s}`;
                    t.set(a, {
                        ...i,
                        module: e,
                        styleClass: o,
                        originalName: s
                    })
                }
            }
        } catch (t) {
            console.error(`Error getting styles from ${e}:`, t.message)
        }
        return t
    }

    init() {
        console.log("🎬 TikTok Command initialized"),
        console.log(`📦 Loaded ${this.styleModules.size} style modules`),
        console.log(`🎨 Available styles: ${this.getAllStyles().size}`)
    }

    getMainButton() {
        return {
            text: "🎬 TikTok Tools",
            callback_data: "tiktok_main"
        }
    }

    // ADD THIS NEW METHOD - This is the missing piece!
    handleMessage(message) {
        const chatId = message.chat.id;
        const userId = message.from.id;
        const messageText = message.text;
        const userState = this.botManager.getUserState(userId);

        // Check if user has a TikTok-related state
        if (!userState || userState.commandName !== 'tiktok') {
            return false; // Not handling this message
        }

        console.log(`🎬 TikTok message handler: ${userState.operation} - ${userState.step}`);

        try {
            switch (userState.operation) {
                case 'wmtiktok':
                    if (userState.step === 'waiting_for_url') {
                        this.handleWmTikTokUrl(chatId, userId, messageText);
                        return true;
                    }
                    break;

                case 'nrmtiktok':
                    if (userState.step === 'waiting_for_url') {
                        this.handleNrmTikTokUrl(chatId, userId, messageText);
                        return true;
                    }
                    break;

                case 'set_cookie':
                    if (userState.step === 'waiting_for_cookie') {
                        this.handleSetCookie(chatId, userId, messageText);
                        return true;
                    }
                    break;

                case 'custom_text':
                    if (userState.step === 'waiting_for_text') {
                        this.handleCustomTextInput(message, userState, this.botManager);
                        return true;
                    }
                    break;
            }
        } catch (error) {
            console.error('Error in TikTok message handler:', error);
            this.bot.sendMessage(chatId, "❌ An error occurred. Please try again.");
            this.botManager.clearUserState(userId);
        }

        return false;
    }

    // ADD THESE NEW HANDLER METHODS
    async handleWmTikTokUrl(chatId, userId, url) {
        // Validate TikTok URL
        if (!this.isValidTikTokUrl(url)) {
            this.bot.sendMessage(chatId, "❌ Please send a valid TikTok URL\n\nExample: https://www.tiktok.com/@username/video/1234567890");
            return;
        }

        // Clear user state
        this.botManager.clearUserState(userId);

        // Show processing message
        const processingMsg = await this.bot.sendMessage(chatId, "🔄 Processing your TikTok video with watermark...");

        try {
            // Get user's watermark settings
            const userSettings = this.tikTokPlugin.watermarkSettings.get(userId);
            
            // Call the wmtiktok function from the plugin
            await this.tikTokPlugin.wmtiktok(url, chatId, userId, userSettings);
            
            // Delete processing message
            this.bot.deleteMessage(chatId, processingMsg.message_id).catch(() => {});
            
        } catch (error) {
            console.error('Error processing wmtiktok:', error);
            this.bot.editMessageText("❌ Failed to download video. Please try again or check if the URL is valid.", {
                chat_id: chatId,
                message_id: processingMsg.message_id
            });
        }
    }

    async handleNrmTikTokUrl(chatId, userId, url) {
        // Validate TikTok URL
        if (!this.isValidTikTokUrl(url)) {
            this.bot.sendMessage(chatId, "❌ Please send a valid TikTok URL\n\nExample: https://www.tiktok.com/@username/video/1234567890");
            return;
        }

        // Clear user state
        this.botManager.clearUserState(userId);

        // Show processing message
        const processingMsg = await this.bot.sendMessage(chatId, "🔄 Processing your TikTok video without watermark...");

        try {
            // Call the nrmtiktok function from the plugin
            await this.tikTokPlugin.nrmtiktok(url, chatId, userId);
            
            // Delete processing message
            this.bot.deleteMessage(chatId, processingMsg.message_id).catch(() => {});
            
        } catch (error) {
            console.error('Error processing nrmtiktok:', error);
            this.bot.editMessageText("❌ Failed to download video. Please try again or check if the URL is valid.", {
                chat_id: chatId,
                message_id: processingMsg.message_id
            });
        }
    }

    handleSetCookie(chatId, userId, cookieString) {
        // Clear user state first
        this.botManager.clearUserState(userId);

        try {
            // Set the cookie in the plugin
            this.tikTokPlugin.setCookie(cookieString.trim());
            
            this.bot.sendMessage(chatId, "✅ *Cookie Set Successfully!*\n\nYour TikTok cookie has been saved. Downloads should now work better!", {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[
                        { text: "🏠 Back to Menu", callback_data: "tiktok_back_to_main" }
                    ]]
                }
            });
        } catch (error) {
            console.error('Error setting cookie:', error);
            this.bot.sendMessage(chatId, "❌ Failed to set cookie. Please make sure you copied the complete cookie string.");
        }
    }

    // ADD URL VALIDATION METHOD
    isValidTikTokUrl(url) {
        if (!url || typeof url !== 'string') return false;
        
        const tiktokPatterns = [
            /^https?:\/\/(www\.)?tiktok\.com\/@[\w.-]+\/video\/\d+/,
            /^https?:\/\/vm\.tiktok\.com\/[\w]+/,
            /^https?:\/\/vt\.tiktok\.com\/[\w]+/,
            /^https?:\/\/www\.tiktok\.com\/t\/[\w]+/
        ];
        
        return tiktokPatterns.some(pattern => pattern.test(url.trim()));
    }

    handleCallback(t, e) {
        const o = t.message.chat.id,
            a = t.message.message_id,
            s = t.data,
            i = t.from.id;
        if (console.log(`🔧 TikTok callback received: ${s}`), !s.startsWith("tiktok_")) return !1;
        try {
            switch (s) {
                case "tiktok_main":
                case "tiktok_back_to_main":
                    this.showCommandMenu(o, a);
                    break;
                case "tiktok_styles":
                case "tiktok_back_to_styles":
                    this.showStylesMenu(o, a);
                    break;
                case "tiktok_setwatermark":
                case "tiktok_back_to_setwatermark":
                    this.showSetWatermarkMenu(o, a);
                    break;
                case "tiktok_wmtiktok":
                    this.startWmTikTok(o, a, i);
                    break;
                case "tiktok_nrmtiktok":
                    this.startNrmTikTok(o, a, i);
                    break;
                case "tiktok_setcookie":
                    this.showSetCookieMenu(o, a, i);
                    break;
                case "tiktok_cookiestatus":
                    this.showCookieStatus(o, a);
                    break;
                case "tiktok_set_new_cookie":
                    this.startSetCookie(o, a, i);
                    break;
                default:
                    if (s.startsWith("tiktok_module_")) {
                        const t = s.replace("tiktok_module_", "");
                        this.showModuleStyles(o, a, t)
                    } else if (s.startsWith("tiktok_setmodule_")) {
                        const e = s.replace("tiktok_setmodule_", "");
                        this.handleSetModuleCallback(t, e)
                    } else if (s.startsWith("tiktok_style_")) {
                        const t = s.replace("tiktok_style_", "");
                        this.selectStyle(o, a, i, t)
                    } else if (s.startsWith("tiktok_set_style_")) {
                        const t = s.replace("tiktok_set_style_", "");
                        this.startSetCustomText(o, a, i, t)
                    } else if (s.startsWith("tiktok_confirm_style_")) {
                        const t = s.replace("tiktok_confirm_style_", "");
                        this.confirmStyle(o, a, i, t)
                    } else if (s.startsWith("tiktok_custom_text_")) {
                        const t = s.replace("tiktok_custom_text_", "");
                        this.startCustomTextInput(o, a, i, t)
                    }
                    break
            }
            return this.bot.answerCallbackQuery(t.id), !0
        } catch (e) {
            return console.error("Error handling TikTok callback:", e), this.bot.answerCallbackQuery(t.id, {
                text: "❌ Error occurred. Please try again.",
                show_alert: !1
            }), !0
        }
    }

    showCommandMenu(t, e) {
        const o = this.tikTokPlugin.tiktokCookie ? "✅" : "❌",
            a = this.getAllStyles().size,
            s = `🎬 *TikTok Tools*\n\nChoose what you'd like to do:\n\n🎨 *Styles* - Browse ${a} watermark styles from ${this.styleModules.size} modules\n⚙️ *Set Watermark* - Set custom watermark style and text\n🎥 *Wmtiktok* - Download with custom watermark\n📱 *Nrmtiktok* - Download without any watermark (clean video)\n${o} *Set Cookie* - Set TikTok cookie for better downloads\n📊 *Cookie Status* - Check current cookie status\n\n📦 **Loaded Modules:** ${Array.from(this.styleModules.keys()).join(", ")}`,
            i = {
                inline_keyboard: [
                    [{
                        text: "🎨 Styles",
                        callback_data: "tiktok_styles"
                    }],
                    [{
                        text: "⚙️ Set Watermark",
                        callback_data: "tiktok_setwatermark"
                    }],
                    [{
                        text: "🎥 Wmtiktok",
                        callback_data: "tiktok_wmtiktok"
                    }, {
                        text: "📱 Nrmtiktok",
                        callback_data: "tiktok_nrmtiktok"
                    }],
                    [{
                        text: `${o} Set Cookie`,
                        callback_data: "tiktok_setcookie"
                    }, {
                        text: "📊 Cookie Status",
                        callback_data: "tiktok_cookiestatus"
                    }],
                    [{
                        text: "🔙 Back to Main",
                        callback_data: "back_to_main"
                    }]
                ]
            };
        this.bot.editMessageText(s, {
            chat_id: t,
            message_id: e,
            parse_mode: "Markdown",
            reply_markup: i
        }).catch(t => {
            console.error("Error editing message:", t)
        })
    }

    showStylesMenu(t, e) {
        const o = "🎨 *Watermark Style Modules*\n\nChoose a style module to explore:",
            a = {
                inline_keyboard: []
            },
            s = Array.from(this.styleModules.keys());
        for (let t = 0; t < s.length; t += 2) {
            const e = [],
                o = s[t],
                i = this.styleModules.get(o);
            let r = 0;
            try {
                "function" == typeof i.getPresetStyles && (r = Object.keys(i.getPresetStyles()).length)
            } catch (t) {
                r = "?"
            }
            if (e.push({
                    text: `📦 ${o.toUpperCase()} (${r})`,
                    callback_data: `tiktok_module_${o}`
                }), s[t + 1]) {
                const o = s[t + 1],
                    a = this.styleModules.get(o);
                let i = 0;
                try {
                    "function" == typeof a.getPresetStyles && (i = Object.keys(a.getPresetStyles()).length)
                } catch (t) {
                    i = "?"
                }
                e.push({
                    text: `📦 ${o.toUpperCase()} (${i})`,
                    callback_data: `tiktok_module_${o}`
                })
            }
            a.inline_keyboard.push(e)
        }
        a.inline_keyboard.push([{
            text: "🔙 Back",
            callback_data: "tiktok_back_to_main"
        }]), this.bot.editMessageText(o, {
            chat_id: t,
            message_id: e,
            parse_mode: "Markdown",
            reply_markup: a
        }).catch(t => {
            console.error("Error editing message:", t)
        })
    }

    showModuleStyles(t, e, o) {
        const a = this.styleModules.get(o);
        if (!a) return this.bot.answerCallbackQuery(callbackQuery.id, {
            text: "Module not found!"
        }), void 0;
        let s = {};
        try {
            "function" == typeof a.getPresetStyles && (s = a.getPresetStyles())
        } catch (t) {
            console.error(`Error getting styles from ${o}:`, t.message)
        }
        const i = `✨ *${o.toUpperCase()} Styles*\n\nChoose a style to preview:`,
            r = {
                inline_keyboard: []
            },
            n = Object.keys(s);
        for (let t = 0; t < n.length; t += 2) {
            const e = [],
                a = n[t],
                s = `${o}_${a}`;
            if (e.push({
                    text: `✨ ${a.toUpperCase()}`,
                    callback_data: `tiktok_style_${s}`
                }), n[t + 1]) {
                const a = n[t + 1],
                    s = `${o}_${a}`;
                e.push({
                    text: `✨ ${a.toUpperCase()}`,
                    callback_data: `tiktok_style_${s}`
                })
            }
            r.inline_keyboard.push(e)
        }
        r.inline_keyboard.push([{
            text: "🔙 Back to Modules",
            callback_data: "tiktok_back_to_styles"
        }]), this.bot.editMessageText(i, {
            chat_id: t,
            message_id: e,
            parse_mode: "Markdown",
            reply_markup: r
        }).catch(t => {
            console.error("Error editing message:", t)
        })
    }

    showSetWatermarkMenu(t, e) {
        const o = "⚙️ *Set Watermark*\n\nChoose a module to customize styles:",
            a = {
                inline_keyboard: []
            },
            s = Array.from(this.styleModules.keys());
        for (let t = 0; t < s.length; t += 2) {
            const e = [],
                o = s[t];
            if (e.push({
                    text: `⚙️ ${o.toUpperCase()}`,
                    callback_data: `tiktok_setmodule_${o}`
                }), s[t + 1]) {
                const o = s[t + 1];
                e.push({
                    text: `⚙️ ${o.toUpperCase()}`,
                    callback_data: `tiktok_setmodule_${o}`
                })
            }
            a.inline_keyboard.push(e)
        }
        a.inline_keyboard.push([{
            text: "🔙 Back",
            callback_data: "tiktok_back_to_main"
        }]), this.bot.editMessageText(o, {
            chat_id: t,
            message_id: e,
            parse_mode: "Markdown",
            reply_markup: a
        }).catch(t => {
            console.error("Error editing message:", t)
        })
    }

    selectStyle(t, e, o, a) {
        const s = this.getAllStyles(),
            i = s.get(a);
        if (!i) return this.bot.answerCallbackQuery(callbackQuery.id, {
            text: "Style not found!"
        }), void 0;
        const r = `✨ *${i.originalName.toUpperCase()} Style Preview*\n📦 **Module:** ${i.module}\n\n🏷️ **Text:** ${i.text||"N/A"}\n🔤 **Font:** ${i.font||i.fontFamily||"Default"}\n📏 **Size:** ${i.fontSize||i.size||"Default"}px\n🎨 **Color:** ${i.color||i.textColor||"Default"}\n👻 **Opacity:** ${Math.round(100*(i.opacity||1))}%\n📍 **Position:** ${i.position||"Default"}\n🔄 **Rotation:** ${i.rotation||0}°\n✨ **Effect:** ${i.effect||i.glassColor||"Custom"}\n\nThis is just a preview. To use this style, go back and use "Set Watermark".`,
            n = {
                inline_keyboard: [
                    [{
                        text: "🔙 Back to Module",
                        callback_data: `tiktok_module_${i.module}`
                    }],
                    [{
                        text: "🏠 Back to Menu",
                        callback_data: "tiktok_back_to_main"
                    }]
                ]
            };
        this.bot.editMessageText(r, {
            chat_id: t,
            message_id: e,
            parse_mode: "Markdown",
            reply_markup: n
        }).catch(t => {
            console.error("Error editing message:", t)
        })
    }

    startSetCustomText(t, e, o, a) {
        const s = this.getAllStyles(),
            i = s.get(a);
        if (!i) return this.bot.answerCallbackQuery(callbackQuery.id, {
            text: "Style not found!"
        }), void 0;
        const r = `⚙️ *Set ${i.originalName.toUpperCase()} Style*\n📦 **Module:** ${i.module}\n\n**Current settings:**\n🏷️ Text: ${i.text||"Default"}\n🔤 Font: ${i.font||i.fontFamily||"Default"}\n📏 Size: ${i.fontSize||i.size||"Default"}px\n🎨 Color: ${i.color||i.textColor||"Default"}\n✨ Effect: ${i.effect||i.glassColor||"Custom"}\n\nDo you want to use the default text or enter custom text?`,
            n = {
                inline_keyboard: [
                    [{
                        text: "✅ Use Default Text",
                        callback_data: `tiktok_confirm_style_${a}`
                    }],
                    [{
                        text: "✏️ Enter Custom Text",
                        callback_data: `tiktok_custom_text_${a}`
                    }],
                    [{
                        text: "🔙 Back",
                        callback_data: "tiktok_back_to_setwatermark"
                    }]
                ]
            };
        this.bot.editMessageText(r, {
            chat_id: t,
            message_id: e,
            parse_mode: "Markdown",
            reply_markup: n
        }).catch(t => {
            console.error("Error editing message:", t)
        })
    }

    startCustomTextInput(t, e, o, a) {
        const s = this.getAllStyles(),
            i = s.get(a);
        if (!i) return this.bot.answerCallbackQuery(callbackQuery.id, {
            text: "Style not found!"
        }), void 0;
        const r = `✏️ *Enter Custom Text*\n\nPlease type the text you want to use for your **${i.originalName.toUpperCase()}** watermark from the **${i.module}** module.\n\n**Examples:**\n• Your name: "John Doe"\n• Your brand: "@MyBrand"\n• Any text: "My Video"\n\nSend your custom text now:`,
            n = {
                inline_keyboard: [
                    [{
                        text: "❌ Cancel",
                        callback_data: "tiktok_back_to_setwatermark"
                    }]
                ]
            };
        this.bot.editMessageText(r, {
            chat_id: t,
            message_id: e,
            parse_mode: "Markdown",
            reply_markup: n
        }).catch(t => {
            console.error("Error editing message:", t)
        }), this.botManager.setUserState(o, {
            commandName: "tiktok",
            operation: "custom_text",
            step: "waiting_for_text",
            styleName: a
        })
    }

    confirmStyle(t, e, o, a) {
        const s = this.getAllStyles(),
            i = s.get(a);
        if (!i) return this.bot.answerCallbackQuery(callbackQuery.id, {
            text: "Style not found!"
        }), void 0;
        this.tikTokPlugin.watermarkSettings.set(o, {
            ...i,
            fullStyleName: a
        });
        const r = `✅ *Watermark Set Successfully!*\n\n**Module:** ${i.module}\n**Style:** ${i.originalName.toUpperCase()}\n**Text:** ${i.text||"Default"}\n**Effect:** ${i.effect||i.glassColor||"Custom"}\n\nYour watermark is now ready to use with Wmtiktok!`,
            n = {
                inline_keyboard: [
                    [{
                        text: "🎥 Use Wmtiktok Now",
                        callback_data: "tiktok_wmtiktok"
                    }],
                    [{
                        text: "🏠 Back to Menu",
                        callback_data: "tiktok_back_to_main"
                    }]
                ]
            };
        this.bot.editMessageText(r, {
            chat_id: t,
            message_id: e,
            parse_mode: "Markdown",
            reply_markup: n
        }).catch(t => {
            console.error("Error editing message:", t)
        })
    }

    handleSetModuleCallback(t, e) {
        const o = t.message.chat.id,
            a = t.message.message_id,
            s = this.styleModules.get(e);
        if (!s) return this.bot.answerCallbackQuery(t.id, {
            text: "Module not found!"
        }), void 0;
        let i = {};
        try {
            "function" == typeof s.getPresetStyles && (i = s.getPresetStyles())
        } catch (t) {
            console.error(`Error getting styles from ${e}:`, t.message)
        }
        const r = `⚙️ *Set ${e.toUpperCase()} Watermark*\n\nChoose a style to customize:`,
            n = {
                inline_keyboard: []
            },
            l = Object.keys(i);
        for (let t = 0; t < l.length; t += 2) {
            const o = [],
                a = l[t],
                s = `${e}_${a}`;
            if (o.push({
                    text: `⚙️ ${a.toUpperCase()}`,
                    callback_data: `tiktok_set_style_${s}`
                }), l[t + 1]) {
                const a = l[t + 1],
                    s = `${e}_${a}`;
                o.push({
                    text: `⚙️ ${a.toUpperCase()}`,
                    callback_data: `tiktok_set_style_${s}`
                })
            }
            n.inline_keyboard.push(o)
        }
        n.inline_keyboard.push([{
            text: "🔙 Back",
            callback_data: "tiktok_back_to_setwatermark"
        }]), this.bot.editMessageText(r, {
            chat_id: o,
            message_id: a,
            parse_mode: "Markdown",
            reply_markup: n
        }).catch(t => {
            console.error("Error editing message:", t)
        })
    }

    startWmTikTok(t, e, o) {
        const a = this.tikTokPlugin.watermarkSettings.get(o);
        let s = "Default watermark";
        if (a && a.fullStyleName) {
            const t = this.getAllStyles(),
                e = t.get(a.fullStyleName);
            e && (s = `${e.originalName.toUpperCase()} from ${e.module} module`)
        }
        const i = `🎥 *Wmtiktok - Download with Watermark*\n\n**Current watermark:** ${s}\n**Text:** ${a?.text||"Default"}\n\nPlease send me the TikTok URL you want to download with watermark.\n\n**Example:** https://www.tiktok.com/@username/video/1234567890`,
            r = {
                inline_keyboard: [
                    [{
                        text: "⚙️ Change Watermark",
                        callback_data: "tiktok_setwatermark"
                    }],
                    [{
                        text: "❌ Cancel",
                        callback_data: "tiktok_back_to_main"
                    }]
                ]
            };
        this.bot.editMessageText(i, {
            chat_id: t,
            message_id: e,
            parse_mode: "Markdown",
            reply_markup: r
        }).catch(t => {
            console.error("Error editing message:", t)
        }), this.botManager.setUserState(o, {
            commandName: "tiktok",
            operation: "wmtiktok",
            step: "waiting_for_url"
        })
    }

    startNrmTikTok(t, e, o) {
        const a = "📱 *Nrmtiktok - Download Clean Video*\n\nThis will download the video without any watermark (completely clean).\n\nPlease send me the TikTok URL you want to download.\n\n**Example:** https://www.tiktok.com/@username/video/1234567890",
            s = {
                inline_keyboard: [
                    [{
                        text: "❌ Cancel",
                        callback_data: "tiktok_back_to_main"
                    }]
                ]
            };
        this.bot.editMessageText(a, {
            chat_id: t,
            message_id: e,
            parse_mode: "Markdown",
            reply_markup: s
        }).catch(t => {
            console.error("Error editing message:", t)
        }), this.botManager.setUserState(o, {
            commandName: "tiktok",
            operation: "nrmtiktok",
            step: "waiting_for_url"
        })
    }

    showSetCookieMenu(t, e, o) {
        const a = "🍪 *Set TikTok Cookie*\n\nSetting a TikTok cookie helps bypass download restrictions and improves success rate.\n\n**How to get your cookie:**\n1. Install Cookie-Editor browser extension\n2. Login to TikTok.com\n3. Open Cookie-Editor on TikTok\n4. Copy all cookies\n5. Send the cookie string here\n\n**Current status:** " + (this.tikTokPlugin.tiktokCookie ? "✅ Cookie is set" : "❌ No cookie set"),
            s = {
                inline_keyboard: [
                    [{
                        text: "📝 Enter New Cookie",
                        callback_data: "tiktok_set_new_cookie"
                    }],
                    [{
                        text: "🔙 Back",
                        callback_data: "tiktok_back_to_main"
                    }]
                ]
            };
        this.bot.editMessageText(a, {
            chat_id: t,
            message_id: e,
            parse_mode: "Markdown",
            reply_markup: s
        }).catch(t => {
            console.error("Error editing message:", t)
        })
    }

    startSetCookie(t, e, o) {
        const a = "📝 *Enter TikTok Cookie*\n\nPlease paste your TikTok cookie string here.\n\n**Note:** The cookie should be a long string containing session information from your browser.\n\nSend your cookie now:",
            s = {
                inline_keyboard: [
                    [{
                        text: "❌ Cancel",
                        callback_data: "tiktok_setcookie"
                    }]
                ]
            };
        this.bot.editMessageText(a, {
            chat_id: t,
            message_id: e,
            parse_mode: "Markdown",
            reply_markup: s
        }).catch(t => {
            console.error("Error editing message:", t)
        }), this.botManager.setUserState(o, {
            commandName: "tiktok",
            operation: "set_cookie",
            step: "waiting_for_cookie"
        })
    }

    showCookieStatus(t, e) {
        const o = this.tikTokPlugin.getCookieStatus(),
            a = this.tikTokPlugin.tiktokCookie ? "✅ Enhanced downloads enabled\n✅ Better 403 error bypass\n✅ Higher success rate" : "❌ Basic downloads only\n❌ May encounter 403 errors\n❌ Limited success rate",
            s = `📊 *Cookie Status*\n\n**Status:** ${o}\n\n**Features:**\n${a}`,
            i = {
                inline_keyboard: [
                    [{
                        text: "🍪 Set Cookie",
                        callback_data: "tiktok_setcookie"
                    }],
                    [{
                        text: "🔙 Back",
                        callback_data: "tiktok_back_to_main"
                    }]
                ]
            };
        this.bot.editMessageText(s, {
            chat_id: t,
            message_id: e,
            parse_mode: "Markdown",
            reply_markup: i
        }).catch(t => {
            console.error("Error editing message:", t)
        })
    }

    handleCustomTextInput(t, e, o) {
        const a = t.chat.id,
            s = t.from.id,
            i = t.text.trim(),
            r = e.styleName;
        if (!i) return this.bot.sendMessage(a, "❌ Please provide some text for your watermark"), void 0;
        const n = this.getAllStyles(),
            l = n.get(r);
        if (!l) return this.bot.sendMessage(a, "❌ Style not found"), void 0;
        const k = {
            ...l,
            text: i,
            fullStyleName: r
        };
        this.tikTokPlugin.watermarkSettings.set(s, k);
        const c = `✅ *Custom Watermark Set!*\n\n**Module:** ${l.module}\n**Style:** ${l.originalName.toUpperCase()}\n**Your Text:** ${i}\n**Effect:** ${l.effect||l.glassColor||"Custom"}\n\nYour custom watermark is ready to use!`,
            d = {
                inline_keyboard: [
                    [{
                        text: "🎥 Use Wmtiktok Now",
                        callback_data: "tiktok_wmtiktok"
                    }],
                    [{
                        text: "🏠 Back to Menu",
                        callback_data: "tiktok_back_to_main"
                    }]
                ]
            };
        this.bot.sendMessage(a, c, {
            parse_mode: "Markdown",
            reply_markup: d
        }), o.clearUserState(s)
    }
}

module.exports = TikTokCommand;