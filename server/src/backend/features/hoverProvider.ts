"use strict";

import { Hover, Position, TextDocument } from "vscode-languageserver";
import { DocumentDecorator } from "../../vscodeFunctions/documentDecorator";
import { DafnyServer } from "../dafnyServer";
import { DafnyDefinitionInformation } from "./DafnyDefinitionInformation";
import { DafnySymbol, SymbolType } from "./symbols";

export class DafnyHoverProvider {

    public constructor(public server: DafnyServer) {}

    public async provideHover(document: TextDocument, position: Position): Promise<Hover> {
        const symbol = await this.provideDefinition(document, position);
        console.log(JSON.stringify(symbol, null, 4));
        if (symbol) {
            const { doc } = symbol;
            if (doc !== null) {
                return {
                    contents: {
                        language: "dafny",
                        value: doc,
                    },
                    range: undefined,
                };
            }
        }
        return {
            contents: {
                language: "dafny",
                value: "no internal definition",
            },
            range: undefined,
        };
    }

    public async provideDefinition(document: TextDocument, position: Position): Promise<DafnySymbol | null> {
        try {
            const definitionInfo = await this.provideDefinitionInternal(document, position);
            if (definitionInfo == null || definitionInfo.symbol == null) {
                return null;
            }
            return definitionInfo.symbol;
        } catch (err) {
            console.error(err);
            return null;
        }
    }

    public provideDefinitionInternal(document: TextDocument, position: Position): Promise<DafnyDefinitionInformation | null> {
        const documentDecorator: DocumentDecorator = new DocumentDecorator(document);
        if (documentDecorator.isMethodCall(position)) {
            return this.findExactDefinition(position, documentDecorator);
        }
        return this.findPossibleDefinition(position, documentDecorator);
    }

    private async findPossibleDefinition(position: Position, documentDecorator: DocumentDecorator): Promise<DafnyDefinitionInformation | null> {
        const word = documentDecorator.getValidIdentifierOrNull(position);
        console.log(JSON.stringify(word));
        if (!word) {
            return null;
        }
        return this.findDefinition(documentDecorator.document, word);
    }

    private async findExactDefinition(position: Position, documentDecorator: DocumentDecorator): Promise<DafnyDefinitionInformation | null>  {
        const call = documentDecorator.getFullyQualifiedNameOfCalledMethod(position);
        try {
            const symbolTables = await this.server.symbolService.getSymbols(documentDecorator.document);
            for (const symbolTable of symbolTables) {
                for (const symb of symbolTable.symbols.filter((s: DafnySymbol) => s.isOfType([SymbolType.Call]) && s.call === call)) {
                    const definitionSymbol = symbolTable.symbols.find((s: DafnySymbol) => s.isFuzzyDefinitionForSymbol(symb));
                    if (definitionSymbol) {
                        return new DafnyDefinitionInformation(definitionSymbol);
                    }
                }
            }
            return null;
        } catch (err) {
            return err;
        }
    }

    private findDefinition(document: TextDocument, symbolName: string): Promise<DafnyDefinitionInformation> {
        return this.server.symbolService.getAllSymbols(document).then((symbols: DafnySymbol[]) => {
            const definingSymbol = symbols.find((symbol: DafnySymbol) => symbol.name === symbolName);
            if (definingSymbol) {
                return new DafnyDefinitionInformation(definingSymbol);
            }
            return null;
        }).catch((err: any) => err);
    }

}
