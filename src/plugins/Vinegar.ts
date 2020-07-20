import { PluginBase, UserResolvable } from "./Plugin";
import { Message, MessageReaction, MessageEmbed } from "discord.js";
import fs from "fs";
import util from "util";

export class VinegarPlugin extends PluginBase {
    private static readonly DATA_FILE = "vinegar_data.json";
    
    constructor() {
        super();
        this.update(0);
    }

    handleReactionAdd(reaction: MessageReaction, user: UserResolvable) {
        super.handleReactionAdd(reaction, user);

        if (user.id == "217238973246865408" && reaction.emoji.id == "692014215438925884") {
            (async () => {
                var times = await this.update(1);
                var date = new Date();

                reaction.message.channel.send(new MessageEmbed()
                    .setColor(0xf06292)
                    //.setTitle()
                    .addField("醋爆次數", `${times} 次`)
                    .setTimestamp(date)
                    .setAuthor("阿咔再一次的醋爆啦！", "http://play.kakaouo.tk/static/char_vinegar_r.png")
                );
                
                await reaction.message.react("692014215438925884"); // char_vinegar
                await reaction.message.react("691329436330491914"); // char_boom
                await reaction.message.react("691330080441630740"); // char_la
                await reaction.message.react("668860239788900385"); // kaka_ya
            })();
        }
    }

    async update(times: number = 0) {
        var dataFile = VinegarPlugin.DATA_FILE;
        if (!(await util.promisify(fs.exists)(dataFile))) {
            await util.promisify(fs.writeFile)(dataFile, JSON.stringify({
                times: 0
            }));
        }
        await util.promisify(fs.chown)(dataFile, 501, 20);

        var data = JSON.parse((await util.promisify(fs.readFile)(dataFile)).toString());
        if (times > 0) {
            data.times += times;
        }
        await util.promisify(fs.writeFile)(dataFile, JSON.stringify(data));
        return data.times;
    }

    times() {
        return JSON.parse(fs.readFileSync(VinegarPlugin.DATA_FILE).toString()).times;
    }
}