import * as fs from 'fs';
import * as yaml from 'js-yaml'; // You may need to npm install js-yaml
import * as path from 'path';

export async function selectActiveIntent(intentId: string, workspaceRoot: string) {
    const configPath = path.join(workspaceRoot, '.orchestration', 'active_intents.yaml');
    
    // 1. Read the Intent File
    const fileContents = fs.readFileSync(configPath, 'utf8');
    const data = yaml.load(fileContents) as any;

    // 2. Find the specific Intent
    const intent = data.active_intents.find((i: any) => i.id === intentId);

    if (!intent) {
        throw new Error(`Intent ID ${intentId} not found in .orchestration/active_intents.yaml`);
    }

    // 3. Return the XML Context (This is what the AI sees)
    return `
<intent_context>
  <id>${intent.id}</id>
  <name>${intent.name}</name>
  <owned_scope>${intent.owned_scope.join(', ')}</owned_scope>
  <constraints>
    ${intent.constraints.map((c: string) => `- ${c}`).join('\n    ')}
  </constraints>
</intent_context>
    `;
}