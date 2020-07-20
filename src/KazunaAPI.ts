import express, { request } from "express";
import { Kazuna, Definition } from "./Kazuna";
import { TextChannel, DMChannel, NewsChannel } from "discord.js";
import { FormatText, LiteralText, TextColor } from "./text/Text";
import * as fs from "fs";
import { Promisified } from "./utils/Promisified";
import path from "path";

export type DefinitionAPIResultSuccess = {
    success: true,
    result: Definition
};

export type KazunaAPIResultFailed = {
    success: false,
    error: string,
    type: string
};

export type DefinitionAPIResult = DefinitionAPIResultSuccess | KazunaAPIResultFailed;

export class KazunaAPI {
    private express: Express.Application

    public constructor() {
        var app = this.express = express();
        var kazuna = Kazuna.getInstance();

        const apiPrefix = "/api/kazuna";
        const clientPrefix = "/client";

        app.get(clientPrefix + "/showdict/:word", async (request, response) => {
            try {
                var list = await this.getWordsList();
                var result = list.find(d => {
                    return d.name == request.params.word;
                });

                if (result == null) {
                    throw new Error(`Word "${request.params.word}" not found.`);
                }

                var clean = (str: string) => {
                    return str
                        .replace(/\[([^\]]+)\]\(\)/g, `<a href="http://play.kakaouo.tk/client/showdict/$1">$1</a>`)
                        .replace(/~~(.*?)~~/g, `<del>$1</del>`)
                        .replace(/__(.*?)__/g, "<u>$1</u>")
                        .replace(/\|\|(.*?)\|\|/g, `<span class="spoiler">$1</span>`)
                        .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>")
                        .replace(/(\*|_)(.*?)\1/g, "<i>$2</i>")
                        .replace(/^> (.*)/gm, "<blockquote>$1</blockquote>")
                        .replace(/\n/g, "<br/>");
                };

                var cleanNoHTML = (str: string) => {
                    return str
                        .replace(/\[([^\]]+)\]\(\)/g, `$1`)
                        .replace(/~~(.*?)~~/g, `$1`)
                        .replace(/__(.*?)__/g, "$1")
                        .replace(/\|\|(.*?)\|\|/g, `<爆雷內容>`)
                        .replace(/\*\*(.*?)\*\*/g, "$1")
                        .replace(/(\*|_)(.*?)\1/g, "$2")
                        .replace(/^> (.*)/gm, "$1")
                };

                var template = (await Promisified.fsReadFile("template/dict.html")).toString();
                template = template
                    .replace(/%name%/g, clean(result.name))
                    .replace(/%pos%/g, clean(result.pos))
                    .replace(/%def%/g, clean(result.definition))
                    .replace(/%nameMeta%/g, cleanNoHTML(result.name))
                    .replace(/%posMeta%/g, cleanNoHTML(result.pos))
                    .replace(/%defMeta%/g, cleanNoHTML(result.definition));
                
                var ex = result.examples ? clean(result.examples[0]) : "";
                if (ex.length > 0) {
                    template = template.replace(/%ex%/g, `
                        <div class="example">
                            ${ex}
                        </div>
                    `);
                }

                if (result.image) {
                    template = template
                        .replace(/%img%/g, `<img src="${result.image}" class="dict-img" />`)
                        .replace(/%imgMeta%/g, `<meta property="og:image" content="${result.image}" />`);
                } else {
                    template = template.replace(/%img%/g, ``).replace(/%imgMeta%/g, ``);
                }

                response.send(template);
            } catch (ex) {
                if (ex instanceof Error) {
                    response.send({
                        success: false,
                        error: ex.message,
                        type: ex.name
                    });
                } else {
                    response.send({
                        success: false,
                        error: ex.toString(),
                        type: "UnknownError"
                    })
                }
            }
        });

        app.get(clientPrefix + "/run/:redirect", async (request, response) => {
            var apiCall = Buffer.from(request.params.redirect, "base64").toString("ascii");
            kazuna.logger.info(
                FormatText.of("%s performed an API call: %s")
                    .addWith(LiteralText.of(request.ip).setColor(TextColor.gold))
                    .addWith(LiteralText.of(apiCall).setColor(TextColor.gold))
            );
            response.send(`
                <html>
                    <script>
                        fetch("${apiCall}").then(() => {
                            close();
                        })
                    </script>
                </html>
            `)
        });

        app.use(apiPrefix, (request, response, next) => {
            response.setHeader("Access-Control-Allow-Origin", "*");
            next();
        });

        app.get(apiPrefix + "/dict/send/:channel/:word/:preserve?", async (request, response) => {
            response.setHeader("Content-Type", "text/json");
            try {
                const { channel: id, word, preserve } = request.params;

                if (preserve != null && preserve != "preserve") {
                    throw new Error(`Invalid parameter ${preserve}.`);
                }

                var channel = await kazuna.bot.channels.resolve(id)?.fetch();
                if (channel instanceof TextChannel || channel instanceof DMChannel || channel instanceof NewsChannel) {
                    channel.startTyping();
                    kazuna.sendDictionary(channel, await kazuna.getDefinition(word), preserve == null);
                    response.status(200);
                    response.send(JSON.stringify({
                        success: true
                    }));
                } else if (channel == null) {
                    response.status(500);
                    response.send(JSON.stringify({
                        success: false,
                        error: `Channel ID #${id} is null.`,
                        type: "TypeError"
                    }));
                } else {
                    response.status(500);
                    response.send(JSON.stringify({
                        success: false,
                        error: `Channel ID #${id} is not a text channel.`,
                        type: "TypeError"
                    }));
                }
            } catch (ex) {
                response.status(500);
                if (ex instanceof Error) {
                    response.send(JSON.stringify({
                        success: false,
                        error: ex.message,
                        type: ex.name
                    }));
                }
            }
        });


        app.get(apiPrefix + "/dict/list", async (request, response) => {
            response.setHeader("Content-Type", "text/json");

            try {
                var list = await this.getWordsList();
                var result = list.map(d => d.name);
                response.send({
                    success: true,
                    words: result
                });
            } catch (ex) {
                if (ex instanceof Error) {
                    response.send({
                        success: false,
                        error: ex.message,
                        type: ex.name
                    });
                } else {
                    response.send({
                        success: false,
                        error: ex.toString(),
                        type: "UnknownError"
                    })
                }
            }
        });

        app.get(apiPrefix + "/dict/query/:word", async (request, response) => {
            response.setHeader("Content-Type", "text/json");

            try {
                var list = await this.getWordsList();
                var result = list.find(d => {
                    return d.name == request.params.word;
                });

                if (result == null) {
                    throw new Error(`Word "${request.params.word}" not found.`);
                }

                response.send({
                    success: true,
                    result
                });
            } catch (ex) {
                if (ex instanceof Error) {
                    response.send({
                        success: false,
                        error: ex.message,
                        type: ex.name
                    });
                } else {
                    response.send({
                        success: false,
                        error: ex.toString(),
                        type: "UnknownError"
                    })
                }
            }
        });

        app.get(apiPrefix + "/dict/random", async (request, response) => {
            response.setHeader("Content-Type", "text/json");

            try {
                var list = await this.getWordsList();
                var result = list[Math.floor(Math.random() * list.length)];

                if (result == null) {
                    throw new Error("No words present in this dictionary.");
                }

                response.send({
                    success: true,
                    result
                });
            } catch (ex) {
                if (ex instanceof Error) {
                    response.send({
                        success: false,
                        error: ex.message,
                        type: ex.name
                    });
                } else {
                    response.send({
                        success: false,
                        error: ex.toString(),
                        type: "UnknownError"
                    })
                }
            }
        });

        app.use("/static", express.static(path.join(__dirname, "../static")));

        const port = 5280;
        app.listen(port, () => {
            kazuna.logger.info(
                FormatText.of("Enabled Kazuna HTTP REST API on port %s.")
                    .addWith(LiteralText.of(port.toString()).setColor(TextColor.gold))
            );
        });
    }

    public getDictionary(): Promise<any> {
        return new Promise((resolve, reject) => {
            const dictFile = "dict.json";
            Promisified.fsReadFile(dictFile).then(buffer => {
                resolve(JSON.parse(buffer.toString()));
            }).catch(ex => {
                reject(ex);
            });
        });
    }

    public getWordsList(): Promise<Definition[]> {
        return new Promise((resolve, reject) => {
            this.getDictionary().then(dict => {
                resolve(dict.words);
            }).catch(ex => {
                reject(ex);
            });
        });
    }
}