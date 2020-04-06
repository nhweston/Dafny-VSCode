"use strict";

import { Hover, TextDocumentPositionParams } from "vscode-languageserver";
import { DafnyServer } from "../dafnyServer";

export class DafnyHoverProvider {

    public constructor(public server: DafnyServer) {}

    public async provideHover(_: TextDocumentPositionParams): Promise<Hover> {
        return {
            contents: {
                language: "dafny",
                value: "Hello, world!",
            },
            range: undefined,
        };
    }

}
