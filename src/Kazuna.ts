import { Client, Message, MessageReaction, User, PartialUser, Emoji, GuildEmoji, DMChannel, TextChannel, MessageEmbed, Channel, NewsChannel } from "discord.js"
import { KazunaConfig } from "./KazunaConfig"
import * as readline from "readline"
import { Logger } from "./utils/Logger"
import { FormatText, LiteralText, TextColor } from "./text/Text"
import { CommandNode, CommandDispatcher, Command, RootCommandNode, LiteralCommandNode, ArgumentCommandNode, CommandResult, CommandContext, ParseResults } from "./command/dispatcher"
import { CommandSource, ConsoleCommandSource, DiscordCommandSource } from "./command/CommandSource"
import { Typer } from "./utils/Typer"
import { Task } from "./utils/Task"
import * as fs from "fs"
import fetch from "node-fetch";
import * as querystring from "querystring";
import { isRegExp } from "util"
import express, { request } from "express";
import { KazunaAPI, KazunaAPIResultFailed, DefinitionAPIResult } from "./KazunaAPI"
import { DisfriendPlugin } from "./plugins/Disfriend"
import { VinegarPlugin } from "./plugins/Vinegar"

export type Definition = {
    name: string,
    pos: string,
    definition: string,
    examples?: string[],
    image?: string
}

export class Kazuna {
    public config: KazunaConfig
    private in: readline.Interface
    public logger: Logger

    public bot: Client;

    public disfriend: DisfriendPlugin;
    public vinegar: VinegarPlugin;

    private static _instance: Kazuna
    public api: KazunaAPI;

    private dispatcher = new CommandDispatcher<CommandSource>();
    private commandQueue: ParseResults<CommandSource>[] = [];

    private queueInterval: NodeJS.Timeout;

    private constructor() {
        Kazuna._instance = this;
        this.logger = new Logger();
        this.logger.info("Kazuna v1.0 is starting....");

        // Setup readline interface.
        this.in = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        var prompt = () => {
            this.in.question(">", answer => {
                try {
                    this.commandQueue.push(this.dispatcher.parse(answer, new ConsoleCommandSource()));
                } catch(ex) {
                    if(ex instanceof Error) {
                        this.logger.error(ex.message);
                    }
                }
                prompt();
            });
        };
        prompt();

        this.queueInterval = setInterval(() => {
            var item = this.commandQueue.shift();
            if(item == null) return;

            var { command, node, context } = item;
            this.logger.info(
                FormatText.of("%s issued a command: %s")
                    .addWith(LiteralText.of(context.source.getName()).setColor(TextColor.gold))
                    .addWith(LiteralText.of(command).setColor(TextColor.gold))
            );
            var result = node?.run(context);
            if(result.error != null) {
                this.logger.error(result.error.message);
            }
        }, 10);

        this.registerCommands();

        this.config = new KazunaConfig();

        // Setup Discord bot client.
        var token = this.config.getBotToken();
        if(token == "<insert token here>") {
            this.logger.error("The token is not set! Terminating the process...");
            process.exit(0);
        }

        this.bot = new Client({
            partials: [
                "MESSAGE", "CHANNEL", "REACTION"
            ]
        });

        // Plugins
        this.disfriend = new DisfriendPlugin();
        this.vinegar = new VinegarPlugin();

        this.initBotHandlers();

        this.api = new KazunaAPI();

        try {
            this.bot.login(token);
        } catch(ex) {
            this.logger.error("Could not login with the given token! Terminating the process...");
            process.exit(0);
        }
    }

    public registerCommands() {
        var d = this.dispatcher;
        d.register(Command.of<CommandSource>("echo", RootCommandNode.create<CommandSource>()
            .addChild(
                LiteralCommandNode.of<CommandSource>("ping")
                    .addChild(
                        ArgumentCommandNode.of<CommandSource>("message").executes(c => {
                            this.logger.info(c.args.message);
                            return CommandResult.success();
                        })
                    ).executes(c => {
                        this.logger.info("Pong!");
                        return CommandResult.success();
                    })
            )
        ));

        d.register(Command.of<CommandSource>("exit", RootCommandNode.create<CommandSource>()
            .executes(c => {
                if(c.source instanceof ConsoleCommandSource) {
                    this.stop();
                    return CommandResult.success();
                }
                return CommandResult.error(new Error("Not permitted"));
            })
        ));

        d.register(Command.of<CommandSource>("reload", RootCommandNode.create<CommandSource>()
            .executes(c => {
                if(c.source instanceof ConsoleCommandSource) {
                    this.config.load();
                    this.updateActivity();

                    this.logger.info(
                        LiteralText.of("Configuration reloaded!").setColor(TextColor.green)
                    );
                    return CommandResult.success();
                }
                return CommandResult.error(new Error("Not permitted"));
            })
        ));

        d.register(Command.of<CommandSource>("help", RootCommandNode.create<CommandSource>()
            .executes(c => {
                if(c.source instanceof ConsoleCommandSource) {
                    d.registry.forEach(cmd => {
                        var usages = cmd.rootNode.toUsage();
                        this.logger.info("/" + cmd.name);

                        usages.forEach(u => {
                            this.logger.info("/" + cmd.name + " " + u);
                        });
                    });
                    return CommandResult.success();
                }
                return CommandResult.error(new Error("Not permitted"));
            })
        ));

        this.registerHumanCommands(d);
    }

    private registerHumanCommands(d: CommandDispatcher<CommandSource>) {
        d.register(Command.of<CommandSource>("大佬", RootCommandNode.create<CommandSource>()
            .executes(c => {
                if(c.source instanceof DiscordCommandSource) {
                    var src: DiscordCommandSource = c.source;
                    Typer.typeText({
                        channel: src.message.channel,
                        text: "咩你才大佬QAQ"
                    });
                    return CommandResult.success();
                }
                return CommandResult.error(new Error("Not supported"));
            })
        , ["大佬啦", "就大佬"] ));

        d.register(Command.of<CommandSource>("走開", RootCommandNode.create<CommandSource>()
            .executes(c => {
                if(c.source instanceof DiscordCommandSource) {
                    var src: DiscordCommandSource = c.source;
                    Typer.typeText({
                        channel: src.message.channel,
                        text: "咩QAQ"
                    });
                    return CommandResult.success();
                }
                return CommandResult.error(new Error("Not supported"));
            })
        , ["滾", "滾啦", "起飛"] ));

        d.register(Command.of<CommandSource>("咩", RootCommandNode.create<CommandSource>()
            .executes(c => {
                if(c.source instanceof DiscordCommandSource) {
                    var src: DiscordCommandSource = c.source;
                    Typer.typeText({
                        channel: src.message.channel,
                        text: "咩你不要學我qwq"
                    });
                    return CommandResult.success();
                }
                return CommandResult.error(new Error("Not supported"));
            })
        ));
        
        d.register(Command.of<CommandSource>("名言", RootCommandNode.create<CommandSource>()
            .executes(c => {
                if(c.source instanceof DiscordCommandSource) {
                    var src: DiscordCommandSource = c.source;

                    var author = src.getAuthor();
                    var mention = src.getMentionName();

                    var quote = this.config.getRandomQuote();
                    var resolved = this.config.resolveQuote(quote);

                    var sendWithMentionReplaced = async (quote: string) => {
                        var text = quote;
                        text = text.replace(/{mention}/g, mention);
                        await Typer.typeText({
                            channel: src.message.channel,
                            text: text
                        });
                    };

                    Task.run(async () => {
                        for(var i=0; i<resolved.length; i++) {
                            var q = resolved[i];
                            await sendWithMentionReplaced(q);
                        }
                    });

                    return CommandResult.success();
                }
                return CommandResult.error(new Error("Not supported"));
            })
        ));

        var dictSend = (src: DiscordCommandSource, def: Definition) => {
            Task.run(async () => {
                var channel = src.message.channel;
                this.sendDictionary(channel, def);
            });
        };

        d.register(Command.of<CommandSource>("說文解字", RootCommandNode.create<CommandSource>()
            .executes(c => {
                if(c.source instanceof DiscordCommandSource) {
                    var src: DiscordCommandSource = c.source;

                    Task.run(async () => {
                        var channel = src.message.channel;
                        channel.startTyping();
                        this.sendDictionary(channel, await this.getDefinition(src.message.content.substring(7)));
                    });

                    return CommandResult.success();
                }
                return CommandResult.error(new Error("Not supported"));
            })
        ));

        d.register(Command.of<CommandSource>("說", RootCommandNode.create<CommandSource>()
            .executes(c => {
                if(c.source instanceof DiscordCommandSource) {
                    var src: DiscordCommandSource = c.source;

                    var rand = Math.random();
                    var echo = src.message.content.substring(3).trim();

                    if(echo.length == 0) {
                        var author = src.getAuthor();
                        var mention = src.getMentionName();

                        var quote = this.config.getRandomEmptyReply();

                        var str = async (quote: string) => {
                            var text = quote;
                            text = text.replace(/{mention}/g, mention);
                            await Typer.typeText({
                                channel: src.message.channel,
                                text: text
                            });
                        };
                        
                        if(quote instanceof Array) {
                            (async () => {
                                for(var i=0; i<quote.length; i++) {
                                    var q = quote[i];
                                    if(typeof q == "string") {
                                        var qq = q;
                                        if(i == 0) {
                                            qq = "> " + src.message.content + "\n" + qq;
                                        }
                                        await str(qq);
                                    }
                                }
                            })();
                        } else {
                            if(typeof quote == "string") {
                                str("> " + src.message.content + "\n" + quote);
                            }
                        }
                        return CommandResult.success();
                    }

                    var chance = this.config.getRefuseChance(src.getAuthor().id);
                    var channel = src.message.channel;
                    var nsfw = (channel instanceof TextChannel && channel.nsfw);
                    if(nsfw) {
                        var old = chance;
                        chance = 1 - Math.pow(1 - chance, 2);

                        this.logger.info(
                            FormatText.of("Refuse chance increased from %s to %s because it is in NSFW channel.")
                                .addWith(
                                    LiteralText.of((old * 100).toString() + "%")
                                        .setColor(TextColor.gold)
                                )
                                .addWith(
                                    LiteralText.of((chance * 100).toString() + "%")
                                        .setColor(TextColor.gold)
                                )
                        );
                    }

                    this.logger.info(
                        FormatText.of("Refuse chance for %s is %s")
                            .addWith(LiteralText.of(src.getName()).setColor(TextColor.gold))
                            .addWith(
                                LiteralText.of((chance * 100).toString() + "%")
                                    .setColor(TextColor.gold)
                            )
                    );

                    if(rand < chance) {
                        var refuse = "咩我就不要啊030";
                        if(echo == refuse) {
                            // To refuse the refusal.
                            echo = "咩那我就偏要030";
                        } else {
                            echo = refuse;
                        }
                    }
                    this.logger.info(
                        FormatText.of("Giving echo back: %s")
                            .addWith(LiteralText.of(echo).setColor(TextColor.gold))
                            );

                    Typer.typeText({
                        channel: src.message.channel,
                        text: echo
                    });
                    return CommandResult.success();
                }
                return CommandResult.error(new Error("Not supported"));
            })
        ));

        d.register(Command.of<CommandSource>("刪掉", RootCommandNode.create<CommandSource>()
            .executes(c => {
                if(c.source instanceof DiscordCommandSource) {
                    var src: DiscordCommandSource = c.source;
                    var chn = src.message.channel;

                    setTimeout(() => {
                        src.message.delete();
                    }, 750);

                    var author = src.getAuthor();
                    var mention = src.getMentionName();

                    chn.send(mention + " 咩 幫你手速刪除啦>w<");
                    return CommandResult.success();
                }
                return CommandResult.error(new Error("Not supported"));
            })
        ));

        d.register(Command.of<CommandSource>("統計", RootCommandNode.create<CommandSource>()
            .addChild(new ArgumentCommandNode<CommandSource>("statName")
                .executes(c => {
                    if (c.source instanceof DiscordCommandSource) {
                        var src: DiscordCommandSource = c.source;
                        var stat: string = c.args.statName;
                        var times = 0;
                        switch (stat) {
                            case "秋夢絕交":
                                times = this.disfriend.times();
                                break;
                            case "阿咔醋爆":
                                times = this.vinegar.times();
                                break;
                            default:
                                return CommandResult.error(new Error("Not supported"));
                        }

                        var msg = src.message;
                        msg.channel.startTyping();
                        setTimeout(() => {
                            msg.channel.stopTyping();
                            msg.channel.send(new MessageEmbed()
                                .setColor(0xf06292)
                                .setAuthor("咔子統計", this.bot.user?.avatarURL() ?? undefined)
                                .setDescription("統計資訊如下：")
                                .addField("項目", stat, true)
                                .addField("次數", times, true)
                                .setTimestamp(new Date())
                            );
                        }, 1500);
                    }
                    return CommandResult.success();
                })
            )
        ));
    }

    public getDefinition(word?: string): Promise<Definition> {
        return new Promise(async (resolve, _) => {
            var route = "http://play.kakaouo.tk/api/kazuna/dict/";
            var content = word ?? "";

            if(content.length > 0) {
                route += "query/" + encodeURIComponent(content)
            } else {
                route += "random/";
            }

            try {
                var result: DefinitionAPIResult = await (await fetch(route)).json();
                var def: Definition;
                // @ts-ignore
                if(!result.success) {
                    def = {
                        name: content,
                        pos: "",
                        definition: "目前未收錄這個詞！"
                    };
                } else {
                    // @ts-ignore
                    def = result.result;
                }

                resolve(def);
            } catch(ex) {
                resolve({
                    name: "錯誤",
                    pos: "",
                    definition: "說文解字目前無法使用，請稍後再試！"
                });
            }
        });
    }

    public async sendDictionary(channel: TextChannel | DMChannel | NewsChannel, def: Definition, scheduleRemove?: boolean) {
        if(!channel.typing) channel.startTyping();
        await Task.delay(1500);
        channel.stopTyping();

        var embed = new MessageEmbed();
        embed.setColor(0xf06292)
            .setAuthor("說文解字", this.bot.user?.avatarURL() ?? undefined)
            .setTitle(def.name)
            .setURL(`http://play.kakaouo.tk/client/showdict/${def.name}`)
            .setDescription((def.pos.length > 0 ? `[${def.pos}] ` : "") + def.definition);

        if(def.examples) {
            var examples = def.examples;
            var ex = examples[Math.floor(Math.random() * examples.length)];

            var _ex = ex;
            var iterator = _ex.matchAll(/\[([^\]]+)\]\(\)/g);
            var n = null;
            var operations: { index: number, length: number, insert: string }[] = [];
            while(!(n = iterator.next()).done) {
                var value = n.value;
                var text = value[1];
                operations.push({
                    index: value.index,
                    length: value[0].length,
                    insert: `[${text}](http://play.kakaouo.tk/client/showdict/${text})`
                });
            }
            operations.reverse().forEach(o => {
                var result = _ex.substring(0, o.index);
                result += o.insert;
                result += _ex.substring(o.index + o.length);
                _ex = result;
            });

            embed.addField("例句", _ex);
        }

        if(def.image) {
            var image = def.image;
            embed.setImage(image);
        }

        var msg = await channel.send(embed);
        if (scheduleRemove) {
            setTimeout(() => {
                msg.delete();
            }, 5000);
        }
    }

    public updateActivity() {
        this.bot.user?.setPresence({
            activity: {
                type: "PLAYING",
                name: this.config.getStatus()
            }
        });
    }

    public initBotHandlers() {
        this.bot.on("ready", () => {
            this.logger.info(
                FormatText.of("Logged into the Discord API as bot %s.")
                    .addWith(LiteralText.of(this.bot.user?.tag ?? "(unknown)").setColor(TextColor.gold))
            );
            this.updateActivity();
        });

        this.bot.on("message", msg => {
            this.handleMessage(msg);
            this.disfriend.handleMessage(msg);
        });
        this.bot.on("messageReactionAdd", (reaction, user) => {
            this.handleReactionAdd(reaction, user);
            this.vinegar.handleReactionAdd(reaction, user);
        });
    }

    public handleMessage(msg: Message) {
        if(msg.channel instanceof DMChannel) {
            var author = msg.author;
            if(author.id == this.bot.user?.id) return;
            var mention = `<@!${author.id}>`;

            var quote = this.config.getRandomDMReply();

            var str = async (quote: string) => {
                var text = quote;
                text = text.replace(/{mention}/g, mention);
                await Typer.typeText({
                    channel: msg.channel,
                    text: text
                });
            };
            
            if(quote instanceof Array) {
                var arr = quote;
                Task.run(async () => {
                    for(var i=0; i<arr.length; i++) {
                        var q = arr[i];
                        if(typeof q == "string") {
                            await str(q);
                        }
                    }
                });
            } else {
                if(typeof quote == "string") {
                    str(quote);
                }
            }
            return;
        }

        if(msg.author.id == this.bot.user?.id && !this.config.isSelfInvokeAllowed()) return;

        // I hate Backpack.
        if (msg.author.id == "617013114117947517") {
            msg.react("691314784473186324");   // char_fly
        }

        if(msg.content.startsWith("咔子")) {
            try {
                this.commandQueue.push(this.dispatcher.parse(msg.content.substring(2), new DiscordCommandSource(msg)));
            } catch(ex) {
                if(ex instanceof Error) {
                    this.logger.warn("Exception occurred: " + ex.message);
                }
            }
        }

        // Add 3 reactions if the keyword is detected in specific channel.
        if(msg.channel.id == "721291165315498014") {
            if(msg.content.indexOf("大佬") != -1) {
                Task.run(async () => {
                    await msg.react("691320106659217438");  // char_big
                    await msg.react("691320125038526466");  // char_kami
                    await msg.react("691330080441630740");  // char_la
                });
            }
        }

    }

    public async handleReactionAdd(reaction: MessageReaction, user: User | PartialUser) {
        var msg = reaction.message;
        if(msg.partial) msg = await msg.fetch();
        
        var channel = await msg.channel.fetch();
        
        /** 
        if(msg.author.id == "617013114117947517" && reaction.emoji.id == "691314784473186324") {
            reaction = await reaction.fetch();
            if((reaction.count ?? 0) == 1) {
                msg.react("691314784473186324");
                Typer.typeText({
                    channel,
                    text: "喔耶喔耶背包趕快起飛>w<!!"
                });
            }
        } // */
    }

    public start() {
        
    }

    public stop() {
        this.logger.info("Stopping Kazuna...");
        this.bot.destroy();
        this.in.close();
        clearInterval(this.queueInterval);
        process.exit();
    }

    public static getInstance(): Kazuna {
        if(Kazuna._instance == null) {
            Kazuna._instance = new Kazuna();
        }
        return Kazuna._instance;
    }
}