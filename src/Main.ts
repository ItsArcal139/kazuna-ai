import { Kazuna } from "./Kazuna";

function MainEntry(target: Function) {
    // @ts-ignore
    target.main();
}

@MainEntry
export class Main {
    public static main(args: string[]) {
        var kazuna = Kazuna.getInstance();
        kazuna.start();
    }
}