import * as fs from "fs"
import { DataUpgrader } from "./utils/DataUpgrader";
import { Kazuna } from "./Kazuna";

const CONFIG_FILE = "config.json";

type Condition = {
    dateExact: string
}

type ConditionQuote = {
    type: "condition"
    condition: Condition,
    true: SingleQuote,
    false: SingleQuote
}

type DateSwitchQuote = {
    type: "dateSwitch",
    [key: string]: Quote,
    defaultQuote: Quote
};

type ComplexQuote = ConditionQuote | DateSwitchQuote;

type SingleQuote = string | ComplexQuote

type Quote = SingleQuote | SingleQuote[]

type RefuseChance = {
    id: string,
    refuse: number | Quote
}

type KazunaConfigData = {
    version: number,
    botToken: string,
    status: string,
    quotes: Quote[],
    deleteDuration: number,
    enableTypeDelay: boolean,
    chanceOverride: RefuseChance[],
    defaultRefuseChance: number,
    dmReplies: Quote[],
    emptyReplies: Quote[],
    allowSelfInvoke: boolean
    [key: string]: any
};

export class KazunaConfigUpgrader extends DataUpgrader<KazunaConfigData> {
    public constructor() {
        super();

        // For invalid files.
        this.addVersion(0, _ => {});

        this.addVersion(1, data => {
            data.version = 1;
            data.botToken = "<insert token here>";
        });

        this.addVersion(2, data => {
            data.version = 2;
            data.status = "咩我咔子AI啦>w<";
        });

        this.addVersion(3, data => {
            data.version = 3;
            data.quotes = [
                "咩030?"
            ];
        });

        this.addVersion(4, data => {
            data.version = 4;
            data.deleteDuration = 750;
            data.enableTypeDelay = true;
        });

        this.addVersion(5, data => {
            data.version = 5;
            data.chanceOverride = [];
            data.defaultRefuseChance = 0.4;
            data.dmReplies = [
                "咩你密我幹嘛030"
            ],
            data.emptyReplies = [
                "咩030?"
            ],
            data.allowSelfInvoke = false
        });
    }
}

export class KazunaConfig {
    public static readonly DEFAULT: KazunaConfigData = {
        version: 5,
        botToken: "<insert token here>",
        status: "咩我咔子AI啦>w<",
        quotes: [
            "咩030?"
        ],
        deleteDuration: 750,
        chanceOverride: [],
        defaultRefuseChance: 0.4,
        enableTypeDelay: true,
        dmReplies: [
            "咩你密我幹嘛030"
        ],
        emptyReplies: [
            "咩030?"
        ],
        allowSelfInvoke: false
    }

    public data: KazunaConfigData = KazunaConfig.DEFAULT;
    
    public constructor() {
        this.load();
    }

    public load() {
        var upgrader = new KazunaConfigUpgrader();

        if(!fs.existsSync(CONFIG_FILE)) {
            this.save();
        }
        var buffer = fs.readFileSync(CONFIG_FILE);
        this.data = JSON.parse(buffer.toString("utf8"));

        var currentVersion = upgrader.getVersion(this.data.version);
        if(currentVersion == null) {
            throw new Error(`This configuration version (${this.data.version}) is not supported.`);
        }
        upgrader.upgrade(this.data, currentVersion, upgrader.getNewestVersion());
        this.save();
    }

    public getBotToken(): string {
        return this.data.botToken;
    }

    public getStatus(): string {
        return this.data.status;
    }

    public getQuotes(): Quote[] {
        return this.data.quotes;
    }

    public getRandomQuote(): Quote {
        var index = Math.floor(Math.random() * this.data.quotes.length);
        return this.getQuotes()[index];
    }

    public getDeleteDuration(): number {
        return this.data.deleteDuration;
    }

    public isTypeDelayEnabled(): boolean {
        return this.data.enableTypeDelay;
    }

    public getChanceOverrides(): RefuseChance[] {
        return this.data.chanceOverride;
    }

    public getDefaultRefuseChance(): number {
        return this.data.defaultRefuseChance;
    }

    public getRefuseChance(id: string): number {
        var chance = this.data.defaultRefuseChance;
        this.data.chanceOverride.forEach(c => {
            if(c.id == id) {
                if(typeof c.refuse == "number") {
                    chance = c.refuse;
                } else {
                    var r = this.resolveQuote(c.refuse)[0];
                    var cc = this.getDefaultRefuseChance();
                    if(r != "default") cc = parseFloat(r);
                    chance = cc;
                }
            }
        });
        return chance;
    }

    public getDMReplies(): Quote[] {
        return this.data.dmReplies;
    }

    public getRandomDMReply(): Quote {
        var index = Math.floor(Math.random() * this.data.dmReplies.length);
        return this.getDMReplies()[index];
    }

    public getEmptyReplies(): Quote[] {
        return this.data.emptyReplies;
    }

    public getRandomEmptyReply(): Quote {
        var index = Math.floor(Math.random() * this.data.emptyReplies.length);
        return this.getEmptyReplies()[index];
    }

    public resolveQuote(quote: Quote): string[] {
        if(typeof quote == "string") return [quote];
        if(!(quote instanceof Array)) {
            // Condition
            if(quote.type == "condition") {
                var d = new Date(quote.condition.dateExact);
                var c = new Date();
                c.setHours(8, 0, 0, 0);
                return (d == c) ? this.resolveQuote(quote.true) : this.resolveQuote(quote.false);
            } else if(quote.type == "dateSwitch") {
                var c = new Date();
                c.setHours(8, 0, 0, 0);
                return this.resolveQuote(quote[c.toISOString().substring(5, 10)] ?? quote.defaultQuote);
            }
        } else {
            var result: string[] = [];
            quote.forEach(q => {
                var r = this.resolveQuote(q);
                result.push.apply(result, r);
            });
            return result;
        }

        return [];
    }

    public isSelfInvokeAllowed(): boolean {
        return this.data.allowSelfInvoke;
    }

    public save() {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(this.data, null, 4));
    }
}