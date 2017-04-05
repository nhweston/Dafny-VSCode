"use strict";

import * as vscode from "vscode";
import {Context} from "../Backend/context";
import {DafnyServer} from "../Backend/dafnyServer";
import { DAFNYMODE } from "../Backend/Features/definitionProvider";
import { DafnyDefinitionProvider } from "../Backend/Features/definitionProvider";
import { DafnyReferencesCodeLensProvider } from "../Backend/Features/referenceCodeLensProvider";
import {Config,  EnvironmentConfig } from "../Strings/stringRessources";
import {Statusbar} from "./dafnyStatusbar";

export class DafnyDiagnosticsProvider {
    private diagCol: vscode.DiagnosticCollection = null;

    private docChangeTimers: { [docPathName: string]: NodeJS.Timer } = {};
    private docChangeVerify: boolean = false;
    private docChangeDelay: number = 0;
    private subscriptions: vscode.Disposable[];
    private dafnyStatusbar: Statusbar;
    private dafnyServer: DafnyServer;
    private context: Context;

    constructor(public vsCodeContext: vscode.ExtensionContext, serverVersion: string) {
        this.diagCol = vscode.languages.createDiagnosticCollection(EnvironmentConfig.Dafny);

        const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(EnvironmentConfig.Dafny);
        this.docChangeVerify = config.get<boolean>(Config.AutomaticVerification);
        this.docChangeDelay = config.get<number>(Config.AutomaticVerificationDelay);

        this.context = new Context();
        this.context.serverversion = serverVersion;
        this.dafnyStatusbar = new Statusbar(this.context);
        this.dafnyServer = new DafnyServer(this.dafnyStatusbar, this.context);
    }

    public activate(subs: vscode.Disposable[]): void {
        vscode.window.onDidChangeActiveTextEditor((editor: vscode.TextEditor) => {
            if (editor) {
                this.dafnyStatusbar.update();
            }
        }, this);
        this.subscriptions = subs;
        vscode.workspace.onDidOpenTextDocument(this.doVerify, this);
        vscode.workspace.onDidCloseTextDocument((textDocument) => {
            this.diagCol.delete(textDocument.uri);
        }, this);

        if(this.docChangeVerify) {
            vscode.workspace.onDidChangeTextDocument(this.docChanged, this);
        }
        vscode.workspace.onDidSaveTextDocument(this.doVerify, this);
        vscode.workspace.textDocuments.forEach(this.doVerify, this);

        const definitionProvider = new DafnyDefinitionProvider(this.dafnyServer);
        this.vsCodeContext.subscriptions.push(vscode.languages.registerDefinitionProvider(DAFNYMODE, definitionProvider));
        this.vsCodeContext.subscriptions.push(vscode.languages.registerCodeLensProvider(DAFNYMODE,
        new DafnyReferencesCodeLensProvider(this.dafnyServer)));
        //this.vsCodeContext.subscriptions.push(vscode.languages.registerCodeLensProvider(DAFNYMODE, new DafnyImplementationsCodeLensProvider(this.dafnyServer, definitionProvider)));
        //this.vsCodeContext.subscriptions.push(vscode.languages.registerHoverProvider(DAFNYMODE, new DafnyHoverProvider()));
    }

    public dispose(): void {
        this.dafnyStatusbar.hide();
        this.diagCol.clear();
        this.diagCol.dispose();
        if(this.subscriptions && this.subscriptions.length > 0) {
            for(let i: number = 0; i < this.subscriptions.length; i++) {
                this.subscriptions[i].dispose();
            }
        }
    }

    public resetServer(): void {
        this.dafnyServer.setInactive();
        this.dafnyServer.reset();
        this.doVerify(vscode.window.activeTextEditor.document);
    }

    public stop(): void {
        this.dafnyServer.stop();
    }

    public init(): void {
        this.dafnyServer.init();
    }

    private doVerify(textDocument: vscode.TextDocument): void {
        if (textDocument !== null && textDocument.languageId === EnvironmentConfig.Dafny) {
            this.dafnyServer.addDocument(textDocument, "verify");
        }
    }

    private docChanged(change: vscode.TextDocumentChangeEvent): void {
        if (change !== null && change.document !== null && change.document.languageId === EnvironmentConfig.Dafny) {

            const docName: string = change.document.fileName;

            if (this.docChangeTimers[docName]) {
                clearTimeout(this.docChangeTimers[docName]);
            }

            this.docChangeTimers[docName] = setTimeout(() => {
                this.doVerify(change.document);
            }, this.docChangeDelay);
        }
    }
}
