import { Message, MessageReaction, PartialUser, User } from "discord.js";

export type UserResolvable = User | PartialUser;

export interface Plugin {
    handleMessage(msg: Message): void;
    handleReactionAdd(reaction: MessageReaction, user: UserResolvable): void;
}

export abstract class PluginBase implements Plugin {
    handleMessage(msg: Message): void {
        // Do nothing
    }

    handleReactionAdd(reaction: MessageReaction, user: UserResolvable): void {
        // Do nothing
    }
}