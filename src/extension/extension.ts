import * as vscode from 'vscode';
import { HookEngine } from '../hooks/hookEngine';
import { OrchestrationManager } from '../orchestration/orchestrationManager';
import { MCPClient } from '../core/mcpClient';

let hookEngine: HookEngine;
let orchestrationManager: OrchestrationManager;
let mcpClient: MCPClient;

export function activate(context: vscode.ExtensionContext) {
    console.log('Agentic IDE Extension activated');

    // Initialize core components
    mcpClient = new MCPClient();
    orchestrationManager = new OrchestrationManager(context);
    hookEngine = new HookEngine(context, orchestrationManager);

    // Register main command to start the agent workflow
    const disposable = vscode.commands.registerCommand('agentic.startSession', async () => {
        vscode.window.showInformationMessage('Starting Agentic Session...');
        await orchestrationManager.initSession();
    });

    context.subscriptions.push(disposable);

    console.log('Agentic IDE Extension setup complete');
}

export function deactivate() {
    console.log('Agentic IDE Extension deactivated');
}
