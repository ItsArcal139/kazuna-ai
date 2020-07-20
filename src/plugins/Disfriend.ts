import { PluginBase } from "./Plugin";
import { Message, MessageEmbed } from "discord.js";
import fs from "fs";
import util from "util";

export class DisfriendPlugin extends PluginBase {
    private static readonly DATA_FILE = "disfriend_data.json";

    constructor() {
        super();
        this.update(0);
    }

    handleMessage(msg: Message) {
        super.handleMessage(msg);

        var content = msg.content;
        if (msg.author.id == "623502141339861003") {
            var regex = new RegExp(JSON.parse(fs.readFileSync(DisfriendPlugin.DATA_FILE).toString()).regex, "g");
            if (regex.test(content)) {
                (async () => {
                    var oc = content.replace(regex, "___disfriend___").split("___disfriend___").length - 1;
                    var times = await this.update(oc);
                    var date = new Date();

                    msg.channel.send(new MessageEmbed()
                        .setColor(0xf06292)
                        //.setTitle()
                        .addField("絕交次數", `${times} 次`)
                        .setTimestamp(date)
                        .setAuthor(`秋夢再${oc == 1 ? "一" : ` ${oc} `}次的絕交啦！`, "http://play.kakaouo.tk/static/char_disfriend_r.png")
                    );
                })();
            }
        }
    }

    async update(times: number = 0) {
        var dataFile = DisfriendPlugin.DATA_FILE;
        if (!(await util.promisify(fs.exists)(dataFile))) {
            await util.promisify(fs.writeFile)(dataFile, JSON.stringify({
                times: 0,
                regex: "絕交"
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
        return JSON.parse(fs.readFileSync(DisfriendPlugin.DATA_FILE).toString()).times;
    }
}