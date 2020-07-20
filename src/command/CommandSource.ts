import { Message } from "discord.js";

export abstract class CommandSource {
    public abstract getName(): string
}

export class ConsoleCommandSource extends CommandSource {
    public getName() {
        return "Console";
    }
}

export class DiscordCommandSource extends CommandSource {
    public message: Message;

    public constructor(message: Message) {
        super();
        this.message = message;
    }

    public getName() {
        return this.getAuthor().tag;
    }

    public getAuthor() {
        return this.message.author;
    }

    public getMentionName() {
        return `<@!${this.getAuthor().id}>`
    }
}