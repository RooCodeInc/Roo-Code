========================
CODE SNIPPETS
========================
TITLE: Install Dependencies with Bun
DESCRIPTION: Installs all necessary project dependencies using the Bun package manager.

SOURCE: https://github.com/openai/openai-node/blob/master/ecosystem-tests/bun/README.md#_snippet_0

LANGUAGE: bash
CODE:

```
bun install
```

---

TITLE: Running Examples
DESCRIPTION: Demonstrates how to add and run TypeScript examples within the repository. Requires making the example file executable and then running it with 'yarn tsn -T'.

SOURCE: https://github.com/openai/openai-node/blob/master/CONTRIBUTING.md#_snippet_1

LANGUAGE: ts
CODE:

```
// add an example to examples/<your-example>.ts

#!/usr/bin/env -S npm run tsn -T
…
```

LANGUAGE: sh
CODE:

```
$ chmod +x examples/<your-example>.ts
# run the example against your api
$ yarn tsn -T examples/<your-example>.ts
```

---

TITLE: Installing from Git
DESCRIPTION: Installs the openai-node package directly from a Git repository using npm.

SOURCE: https://github.com/openai/openai-node/blob/master/CONTRIBUTING.md#_snippet_2

LANGUAGE: sh
CODE:

```
$ npm install git+ssh://git@github.com:openai/openai-node.git
```

---

TITLE: Project Setup and Build
DESCRIPTION: Installs dependencies and builds the project using yarn. Output files are placed in the 'dist/' directory.

SOURCE: https://github.com/openai/openai-node/blob/master/CONTRIBUTING.md#_snippet_0

LANGUAGE: sh
CODE:

```
$ yarn
$ yarn build
```

---

TITLE: Add UI Generation Example Script to Node.js Documentation
DESCRIPTION: A new example script has been added to the documentation, demonstrating how to use the OpenAI Node.js client for UI generation tasks. This provides a practical guide for developers looking to integrate AI-powered UI creation into their projects.

SOURCE: https://github.com/openai/openai-node/blob/master/CHANGELOG.md#_snippet_109

LANGUAGE: JavaScript
CODE:

```
Documentation: examples/ui_generation.js
Description: This script illustrates how to leverage the OpenAI API to generate user interface components dynamically. It serves as a reference for building applications that can create or modify UI elements based on AI outputs.
```

---

TITLE: Bun package.json Dependencies
DESCRIPTION: Specifies the necessary `devDependencies` for Bun projects. Installing `@types/bun` with a version of 1.2.0 or higher is recommended for optimal TypeScript support.

SOURCE: https://github.com/openai/openai-node/blob/master/MIGRATION.md#_snippet_24

LANGUAGE: json
CODE:

```
{
  "devDependencies": {
    "@types/bun": ">= 1.2.0"
  }
}
```

---

TITLE: Pagination: `for await` Loop Example
DESCRIPTION: Confirms that the `for await` syntax for paginating list results remains unaffected by the recent changes. It provides an example of how to iterate through paginated results.

SOURCE: https://github.com/openai/openai-node/blob/master/MIGRATION.md#_snippet_17

LANGUAGE: typescript
CODE:

```
// Automatically fetches more pages as needed.
for await (const fineTuningJob of client.fineTuning.jobs.list()) {
  console.log(fineTuningJob);
}
```

---

TITLE: File Handling: `fileFromPath` Replacement
DESCRIPTION: Illustrates the removal of the deprecated `fileFromPath` helper and its replacement with native Node.js streams. It provides 'before' and 'after' code examples for file handling.

SOURCE: https://github.com/openai/openai-node/blob/master/MIGRATION.md#_snippet_9

LANGUAGE: typescript
CODE:

```
// Before
OpenAI.fileFromPath('path/to/file');

// After
import fs from 'fs';
fs.createReadStream('path/to/file');
```

---

TITLE: Linting and Formatting
DESCRIPTION: Checks code for style consistency and automatically formats the code using ESLint and Prettier.

SOURCE: https://github.com/openai/openai-node/blob/master/CONTRIBUTING.md#_snippet_7

LANGUAGE: sh
CODE:

```
$ yarn lint
$ yarn fix
```

---

TITLE: Running Tests
DESCRIPTION: Executes the test suite for the openai-node project.

SOURCE: https://github.com/openai/openai-node/blob/master/CONTRIBUTING.md#_snippet_6

LANGUAGE: sh
CODE:

```
$ yarn run test
```

---

TITLE: Install OpenAI Library via JSR
DESCRIPTION: Installs the OpenAI library from JSR for use with Deno or other JavaScript runtimes.

SOURCE: https://github.com/openai/openai-node/blob/master/README.md#_snippet_1

LANGUAGE: sh
CODE:

```
deno add jsr:@openai/openai
npx jsr add @openai/openai
```

---

TITLE: Automated Function Calls with runTools
DESCRIPTION: Demonstrates the usage of `client.chat.completions.runTools` for automating function calls. This example shows how to define tools, specify parsing functions, and handle the asynchronous execution of tool-using models. It includes simulated functions for getting location and weather.

SOURCE: https://github.com/openai/openai-node/blob/master/helpers.md#_snippet_8

LANGUAGE: ts
CODE:

```
import OpenAI from 'openai';

const client = new OpenAI();

async function main() {
  const runner = client.chat.completions
    .runTools({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'How is the weather this week?' }],
      tools: [
        {
          type: 'function',
          function: {
            function: getCurrentLocation,
            parameters: { type: 'object', properties: {} },
          },
        },
        {
          type: 'function',
          function: {
            function: getWeather,
            parse: JSON.parse, // or use a validation library like zod for typesafe parsing.
            parameters: {
              type: 'object',
              properties: {
                location: { type: 'string' },
              },
            },
          },
        },
      ],
    })
    .on('message', (message) => console.log(message));

  const finalContent = await runner.finalContent();
  console.log();
  console.log('Final content:', finalContent);
}

async function getCurrentLocation() {
  return 'Boston'; // Simulate lookup
}

async function getWeather(args: { location: string }) {
  const { location } = args;
  // … do lookup …
  return { temperature: '50degF', precipitation: 'high' };
}

main();

// Example conversation flow:
// {role: "user",      content: "How's the weather this week?"}
// {role: "assistant", tool_calls: [{type: "function", function: {name: "getCurrentLocation", arguments: "{}"}, id: "123"}
// {role: "tool",      name: "getCurrentLocation", content: "Boston", tool_call_id: "123"}
// {role: "assistant", tool_calls: [{type: "function", function: {name: "getWeather", arguments: '{"location": "Boston"}'}, id: "1234"}]}
// {role: "tool",      name: "getWeather", content: '{"temperature": "50degF", "preciptation": "high"}', tool_call_id: "1234"}
// {role: "assistant", content: "It's looking cold and rainy - you might want to wear a jacket!"}
//
// Final content: "It's looking cold and rainy - you might want to wear a jacket!"
```

---

TITLE: Install OpenAI Library via npm
DESCRIPTION: Installs the OpenAI library using npm, making it available for use in your project.

SOURCE: https://github.com/openai/openai-node/blob/master/README.md#_snippet_0

LANGUAGE: sh
CODE:

```
npm install openai
```

---

TITLE: Beta Chat Namespace Removal
DESCRIPTION: Announces the removal of the `beta.chat` namespace and the migration of chat completion methods to the main `chat.completions` namespace. It includes examples for method calls and type imports.

SOURCE: https://github.com/openai/openai-node/blob/master/MIGRATION.md#_snippet_14

LANGUAGE: typescript
CODE:

```
// Before
client.beta.chat.completions.parse()
client.beta.chat.completions.stream()
client.beta.chat.completions.runTools()

// After
client.chat.completions.parse()
client.chat.completions.stream()
client.chat.completions.runTools()
```

LANGUAGE: typescript
CODE:

```
// Before
import { ParsedChatCompletion, ParsedChoice, ParsedFunction } from 'openai/resources/beta/chat/completions';

// After
import { ParsedChatCompletion, ParsedChoice, ParsedFunction } from 'openai/resources/chat/completions';
```

---

TITLE: Run Project with Bun
DESCRIPTION: Executes the main TypeScript file (index.ts) using the Bun runtime.

SOURCE: https://github.com/openai/openai-node/blob/master/ecosystem-tests/bun/README.md#_snippet_1

LANGUAGE: typescript
CODE:

```
bun run index.ts
```

---

TITLE: Improve Node.js CI: Run Example Files for Validation
DESCRIPTION: This chore updates the Continuous Integration (CI) pipeline for the OpenAI Node.js library to include running example files. This ensures that all provided examples are functional and up-to-date with the latest library changes. It helps prevent regressions and provides confidence in the examples' accuracy for users.

SOURCE: https://github.com/openai/openai-node/blob/master/CHANGELOG.md#_snippet_55

LANGUAGE: Node.js
CODE:

```
// CI/CD Configuration Update
// Description: Adds a step to execute example files during CI runs.
// Example (pseudo-code for .github/workflows/ci.yml):
// - name: Run Examples
//   run: npm run test:examples
```

---

TITLE: Zod Helpers: Optional Properties Handling
DESCRIPTION: Addresses a change in Zod helper behavior where previously optional properties now require `.nullable()` to be explicitly marked. It provides code examples demonstrating the warning/error scenario and the corrected approach.

SOURCE: https://github.com/openai/openai-node/blob/master/MIGRATION.md#_snippet_11

LANGUAGE: typescript
CODE:

```
const completion = await client.chat.completions.parse({
  // ...
  response_format:
    zodResponseFormat(
      z.object({
        optional_property: z.string().optional(),
      }),
      'schema',
    ),
});
```

LANGUAGE: typescript
CODE:

```
const completion = await client.chat.completions.parse({
  // ...
  response_format:
    zodResponseFormat(
      z.object({
        optional_property: z.string().optional().nullable(),
      }),
      'schema',
    ),
});
```

---

TITLE: Running Tests with Mock Server
DESCRIPTION: Sets up a mock server using Prism against the OpenAPI specification to run tests. This isolates tests from actual API calls.

SOURCE: https://github.com/openai/openai-node/blob/master/CONTRIBUTING.md#_snippet_5

LANGUAGE: sh
CODE:

```
$ npx prism mock path/to/your/openapi.yml
```

---

TITLE: Manual NPM Publishing
DESCRIPTION: Publishes the package to npm manually by running a script and setting the NPM_TOKEN environment variable.

SOURCE: https://github.com/openai/openai-node/blob/master/CONTRIBUTING.md#_snippet_8

LANGUAGE: sh
CODE:

```
bin/publish-npm
```

---

TITLE: Configuring Proxies for Deno
DESCRIPTION: Provides an example of configuring proxy settings for Deno environments by creating a custom HTTP client with proxy details and passing it to the OpenAI client.

SOURCE: https://github.com/openai/openai-node/blob/master/README.md#_snippet_29

LANGUAGE: typescript
CODE:

```
import OpenAI from 'npm:openai';

const httpClient = Deno.createHttpClient({ proxy: { url: 'http://localhost:8888' } });
const client = new OpenAI({
  fetchOptions: {
    client: httpClient,
  },
});
```

---

TITLE: Update Example Values in OpenAI Node.js Documentation
DESCRIPTION: The documentation examples for the OpenAI Node.js client have been updated with revised values. This ensures that the provided code snippets and usage examples are current and accurate, helping developers follow best practices.

SOURCE: https://github.com/openai/openai-node/blob/master/CHANGELOG.md#_snippet_113

LANGUAGE: APIDOC
CODE:

```
Documentation: Examples
Changes: Updated example values for various API calls.
Impact: Improves the accuracy and relevance of code examples in the official documentation.
```

---

TITLE: Shims Removal and Type Configuration
DESCRIPTION: Describes the removal of `openai/shims` imports. It advises users to configure global types correctly, referencing a section on minimum type requirements, and shows an example of the previous shim import.

SOURCE: https://github.com/openai/openai-node/blob/master/MIGRATION.md#_snippet_10

LANGUAGE: typescript
CODE:

```
// Tell TypeScript and the package to use the global Web fetch instead of node-fetch.
import 'openai/shims/web';
import OpenAI from 'openai';
```

---

TITLE: Import OpenAI Library from JSR
DESCRIPTION: Demonstrates how to import the OpenAI library directly from JSR without an install step, suitable for Deno.

SOURCE: https://github.com/openai/openai-node/blob/master/README.md#_snippet_2

LANGUAGE: typescript
CODE:

```
import OpenAI from 'jsr:@openai/openai';
```

---

TITLE: Updated Uploads Exports
DESCRIPTION: Details the removal of internal exports from `openai/uploads` as part of a core refactor. It highlights that `Uploadable` and `toFile` are still exported and provides an example of their usage.

SOURCE: https://github.com/openai/openai-node/blob/master/MIGRATION.md#_snippet_7

LANGUAGE: typescript
CODE:

```
import { type Uploadable, toFile } from 'openai/core/uploads';
```

---

TITLE: File Handling: Node.js Streams and Bun
DESCRIPTION: Provides context on file handling, noting that `fileFromPath` previously only worked on Node.js. It suggests using native Node.js streams or `Bun.file` for Bun environments.

SOURCE: https://github.com/openai/openai-node/blob/master/MIGRATION.md#_snippet_16

LANGUAGE: javascript
CODE:

```
import fs from 'fs';
fs.createReadStream('path/to/file');

// For Bun:
// Bun.file('path/to/file');
```

---

TITLE: Chore: Enable Building When Git Installed in OpenAI Node.js Internal
DESCRIPTION: This internal chore enables the library to build correctly even when Git is installed. This resolves potential build environment conflicts and improves developer experience.

SOURCE: https://github.com/openai/openai-node/blob/master/CHANGELOG.md#_snippet_145

LANGUAGE: APIDOC
CODE:

```
Enabled building with Git installed.
```

---

TITLE: OpenAI Assistants API Streaming Methods
DESCRIPTION: Provides an overview of the helper methods available for initiating streams with the OpenAI Assistants API. These methods facilitate starting runs and streaming responses based on different scenarios.

SOURCE: https://github.com/openai/openai-node/blob/master/helpers.md#_snippet_3

LANGUAGE: APIDOC
CODE:

```
openai.beta.threads.runs.stream();
  - Starts and streams the response to an existing run with an associated thread.

openai.beta.threads.createAndRunStream();
  - Adds a message to a thread, starts a run, and streams the response.

openai.beta.threads.runs.submitToolOutputsStream();
  - Submits a tool output to a run waiting for it and starts a stream.
```

---

TITLE: Improve OpenAI Node.js Audio Example for Streaming to File
DESCRIPTION: This documentation enhancement updates the audio example in the OpenAI Node.js library to demonstrate how to stream audio output directly to a file. It provides a practical use case for handling audio responses and simplifies integration for developers.

SOURCE: https://github.com/openai/openai-node/blob/master/CHANGELOG.md#_snippet_164

LANGUAGE: JavaScript
CODE:

```
const fs = require('fs');
const OpenAI = require('openai');

const openai = new OpenAI();

async function streamAudioToFile() {
  const speechFile = 'speech.mp3';
  const mp3 = await openai.audio.speech.create({
    model: 'tts-1',
    voice: 'alloy',
    input: 'The quick brown fox jumped over the lazy dog.',
  });
  const buffer = Buffer.from(await mp3.arrayBuffer());
  await fs.promises.writeFile(speechFile, buffer);
  console.log(`Audio saved to ${speechFile}`);
}

streamAudioToFile();
```

---

TITLE: TypeScript Configuration for Bun
DESCRIPTION: Specifies the `tsconfig.json` and `package.json` configurations for using the OpenAI library with Bun, including the necessary type definitions.

SOURCE: https://github.com/openai/openai-node/blob/master/MIGRATION.md#_snippet_23

LANGUAGE: jsonc
CODE:

```
{
  "target": "ES2018" // note: we recommend ES2020 or higher
}
```

LANGUAGE: json
CODE:

```
{
  "devDependencies": {
    "@types/bun": ">= 1.2.0"
  }
}
```

---

TITLE: Linking Local Repository (Yarn)
DESCRIPTION: Links a local clone of the openai-node repository to a project using Yarn. This is useful for development and testing local changes.

SOURCE: https://github.com/openai/openai-node/blob/master/CONTRIBUTING.md#_snippet_3

LANGUAGE: sh
CODE:

```
# Clone
$ git clone https://www.github.com/openai/openai-node
$ cd openai-node

# With yarn
$ yarn link
$ cd ../my-package
$ yarn link openai
```

---

TITLE: Pagination: Simplified `nextPageRequestOptions`
DESCRIPTION: Explains the simplification of the interface for manually paginating through list results. It contrasts the 'before' method calls (`nextPageParams`, `nextPageInfo`) with the new unified `nextPageRequestOptions`.

SOURCE: https://github.com/openai/openai-node/blob/master/MIGRATION.md#_snippet_12

LANGUAGE: typescript
CODE:

```
// Before
page.nextPageParams();
page.nextPageInfo();
// Required manually handling { url } | { params } type

// After
page.nextPageRequestOptions();
```

---

TITLE: TypeScript Configuration for Browsers
DESCRIPTION: Provides the recommended `tsconfig.json` configuration for using the OpenAI library in a browser environment, including target and library settings.

SOURCE: https://github.com/openai/openai-node/blob/master/MIGRATION.md#_snippet_20

LANGUAGE: jsonc
CODE:

```
{
  "target": "ES2018", // note: we recommend ES2020 or higher
  "lib": ["DOM", "DOM.Iterable", "ES2018"]
}
```

---

TITLE: Linking Local Repository (pnpm)
DESCRIPTION: Links a local clone of the openai-node repository to a project using pnpm. This is an alternative to Yarn for managing local package linking.

SOURCE: https://github.com/openai/openai-node/blob/master/CONTRIBUTING.md#_snippet_4

LANGUAGE: sh
CODE:

```
# With pnpm
$ pnpm link --global
$ cd ../my-package
$ pnpm link --global openai
```

---

TITLE: Internal: Support pnpm Git Installs
DESCRIPTION: This internal bug fix adds support for `pnpm` git installations. This ensures that the project can be correctly set up and dependencies resolved when using `pnpm` with git-based dependencies. It improves developer experience for `pnpm` users.

SOURCE: https://github.com/openai/openai-node/blob/master/CHANGELOG.md#_snippet_104

LANGUAGE: APIDOC
CODE:

```
Bug Fix: Dependency Management
Component: pnpm
Change Type: Installation Support
Details: Added support for pnpm git installations.
Impact: Improved compatibility for pnpm users with git dependencies.
```

---

TITLE: Removed Unnecessary Classes: Type Aliases
DESCRIPTION: Details the change where page classes for individual methods are now type aliases. It provides an example showing the 'before' class definition and the 'after' type alias.

SOURCE: https://github.com/openai/openai-node/blob/master/MIGRATION.md#_snippet_13

LANGUAGE: typescript
CODE:

```
// Before
export class FineTuningJobsPage extends CursorPage<FineTuningJob> {}

// After
export type FineTuningJobsPage = CursorPage<FineTuningJob>;
```

---

TITLE: Fix Fine-Tuning Example in OpenAI Node.js
DESCRIPTION: Corrects an issue in the fine-tuning example provided with the OpenAI Node.js client. This ensures that the example code is functional and accurately demonstrates how to perform fine-tuning operations, helping developers implement this feature correctly.

SOURCE: https://github.com/openai/openai-node/blob/master/CHANGELOG.md#_snippet_128

LANGUAGE: JavaScript
CODE:

```
Fix: Fine-tuning example corrected.
```

---

TITLE: Azure OpenAI Integration
DESCRIPTION: Demonstrates how to use the `AzureOpenAI` class for integrating with Azure OpenAI services. It shows the setup with Azure AD token provider and making a chat completion request.

SOURCE: https://github.com/openai/openai-node/blob/master/README.md#_snippet_18

LANGUAGE: ts
CODE:

```
import { AzureOpenAI } from 'openai';
import { getBearerTokenProvider, DefaultAzureCredential } from '@azure/identity';

const credential = new DefaultAzureCredential();
const scope = 'https://cognitiveservices.azure.com/.default';
const azureADTokenProvider = getBearerTokenProvider(credential, scope);

const openai = new AzureOpenAI({
  azureADTokenProvider,
  apiVersion: '<The API version, e.g. 2024-10-01-preview>',
});

const result = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Say hello!' }],
});

console.log(result.choices[0]!.message?.content);
```

---

TITLE: Importing OpenAI from Root Path (TypeScript)
DESCRIPTION: This snippet shows the corrected and recommended way to import the OpenAI library directly from the `openai` package root. This resolves issues related to the removal of the `openai/src` directory.

SOURCE: https://github.com/openai/openai-node/blob/master/MIGRATION.md#_snippet_30

LANGUAGE: TypeScript
CODE:

```
import OpenAI from 'openai';
```

---

TITLE: Making Undocumented Requests
DESCRIPTION: Provides examples of how to make requests to undocumented API endpoints using HTTP verbs like `client.post`.

SOURCE: https://github.com/openai/openai-node/blob/master/README.md#_snippet_22

LANGUAGE: ts
CODE:

```
import OpenAI from 'openai';

const client = new OpenAI();

await client.post('/some/path', {
  body: { some_prop: 'foo' },
  query: { some_query_arg: 'bar' },
});
```

---

TITLE: Removed Deprecated `.runFunctions` Methods
DESCRIPTION: Informs about the removal of the deprecated `client.chat.completions.runFunctions()` method and its associated types. It directs users to use `client.chat.completions.runTools()` instead.

SOURCE: https://github.com/openai/openai-node/blob/master/MIGRATION.md#_snippet_15

LANGUAGE: typescript
CODE:

```
// Instead of client.chat.completions.runFunctions(), use client.chat.completions.runTools()
```

---

TITLE: TypeScript Configuration for Node.js
DESCRIPTION: Details the `tsconfig.json` and `package.json` configurations required for Node.js environments to resolve TypeScript type errors related to private properties and fetch classes.

SOURCE: https://github.com/openai/openai-node/blob/master/MIGRATION.md#_snippet_21

LANGUAGE: jsonc
CODE:

```
{
  "target": "ES2018" // note: we recommend ES2020 or higher
}
```

LANGUAGE: json
CODE:

```
{
  "devDependencies": {
    "@types/node": ">= 20"
  }
}
```

---

TITLE: Fix Node.js Dev Setup: Correct Devcontainers Configuration
DESCRIPTION: This chore addresses a fix in the internal development container setup for the OpenAI Node.js library. A correct `devcontainer` configuration is essential for consistent and reproducible development environments. This ensures that contributors can set up their local environments smoothly, reducing setup friction.

SOURCE: https://github.com/openai/openai-node/blob/master/CHANGELOG.md#_snippet_58

LANGUAGE: Development
CODE:

```
// Development Environment Configuration Fix
// Description: Corrected settings within the .devcontainer configuration files.
// This ensures proper environment setup for contributors.
```

---

TITLE: Recommended runTools Method (After runFunctions Removal) (TypeScript)
DESCRIPTION: This snippet refers to the `client.chat.completions.runTools()` method, which is the recommended replacement for the deprecated and removed `runFunctions()` method. It should be used for executing tools.

SOURCE: https://github.com/openai/openai-node/blob/master/MIGRATION.md#_snippet_26

LANGUAGE: ts
CODE:

```
client.chat.completions.runTools()
```

---

TITLE: Adding Bun Type Definitions to `package.json` (JSON)
DESCRIPTION: This `package.json` snippet shows how to include `@types/bun` as a dev dependency. This package provides type definitions for Bun's runtime APIs, ensuring proper type checking for TypeScript projects using Bun.

SOURCE: https://github.com/openai/openai-node/blob/master/MIGRATION.md#_snippet_37

LANGUAGE: JSON
CODE:

```
{
  "devDependencies": {
    "@types/bun": ">= 1.2.0"
  }
}
```

---

TITLE: Fix Examples: Remove Duplicate Session Update Call
DESCRIPTION: This bug fix corrects an issue in the 'realtime' examples where a 'session.update' call was duplicated. Removing the redundant call streamlines the example code and prevents potential unintended side effects.

SOURCE: https://github.com/openai/openai-node/blob/master/CHANGELOG.md#_snippet_77

LANGUAGE: JavaScript
CODE:

```
Example Code: Removed a redundant 'session.update' call from the 'realtime' examples to ensure correct and efficient execution flow.
```

---

TITLE: OpenAI Realtime API with ws
DESCRIPTION: Example demonstrating how to use the OpenAI Realtime API with the `ws` library for Node.js. It shows how to establish a WebSocket connection, send session updates, create conversation items, and handle various events like session creation, text deltas, and connection closure.

SOURCE: https://github.com/openai/openai-node/blob/master/realtime.md#_snippet_0

LANGUAGE: ts
CODE:

```
import { OpenAIRealtimeWS } from 'openai/beta/realtime/ws';

const rt = new OpenAIRealtimeWS({ model: 'gpt-4o-realtime-preview-2024-12-17' });

// access the underlying `ws.WebSocket` instance
rt.socket.on('open', () => {
  console.log('Connection opened!');
  rt.send({
    type: 'session.update',
    session: {
      modalities: ['text'],
      model: 'gpt-4o-realtime-preview',
    },
  });

  rt.send({
    type: 'conversation.item.create',
    item: {
      type: 'message',
      role: 'user',
      content: [{ type: 'input_text', text: 'Say a couple paragraphs!' }],
    },
  });

  rt.send({ type: 'response.create' });
});

rt.on('error', (err) => {
  // in a real world scenario this should be logged somewhere as you
  // likely want to continue processing events regardless of any errors
  throw err;
});

rt.on('session.created', (event) => {
  console.log('session created!', event.session);
  console.log();
});

rt.on('response.text.delta', (event) => process.stdout.write(event.delta));
rt.on('response.text.done', () => console.log());

rt.on('response.done', () => rt.close());

rt.socket.on('close', () => console.log('\nConnection closed!'));
```

---

TITLE: TypeScript Configuration for Cloudflare Workers
DESCRIPTION: Outlines the necessary `tsconfig.json` and `package.json` settings for Cloudflare Workers, ensuring compatibility with the library and `@cloudflare/workers-types`.

SOURCE: https://github.com/openai/openai-node/blob/master/MIGRATION.md#_snippet_22

LANGUAGE: jsonc
CODE:

```
{
  "target": "ES2018", // note: we recommend ES2020 or higher
  "lib": ["ES2020"], // <- needed by @cloudflare/workers-types
  "types": ["@cloudflare/workers-types"]
}
```

LANGUAGE: json
CODE:

```
{
  "devDependencies": {
    "@cloudflare/workers-types": ">= 0.20221111.0"
  }
}
```

---

TITLE: Port Tests to New Setup in OpenAI Node.js Client
DESCRIPTION: This change involves porting existing tests to a new testing setup, streamlining the test infrastructure and potentially improving performance or maintainability. It reflects an ongoing effort to modernize the client's testing practices.

SOURCE: https://github.com/openai/openai-node/blob/master/CHANGELOG.md#_snippet_27

LANGUAGE: JavaScript
CODE:

```
// Internal test refactoring: Tests are ported to a new setup.
// This improves the overall test infrastructure and maintainability.
// No direct user-facing code change.
```

---

TITLE: Migrating Response Body from node-fetch to Web Fetch API
DESCRIPTION: Demonstrates how to handle the response body when migrating from node-fetch specific properties to the standardized Web ReadableStream. It shows how to convert a Web ReadableStream to a Node.js Readable stream for piping.

SOURCE: https://github.com/openai/openai-node/blob/master/MIGRATION.md#_snippet_0

LANGUAGE: typescript
CODE:

```
import { Readable } from 'node:stream';
const res = await client.example.retrieve('string/with/slash').asResponse();
Readable.fromWeb(res.body).pipe(process.stdout);
```

---

TITLE: OpenAI Realtime API with Browser WebSocket
DESCRIPTION: Example demonstrating how to use the OpenAI Realtime API with the browser's native `WebSocket` API. This involves using `OpenAIRealtimeWebSocket` and attaching event listeners to the underlying socket instance.

SOURCE: https://github.com/openai/openai-node/blob/master/realtime.md#_snippet_1

LANGUAGE: ts
CODE:

```
import { OpenAIRealtimeWebSocket } from 'openai/beta/realtime/websocket';

const rt = new OpenAIRealtimeWebSocket({ model: 'gpt-4o-realtime-preview-2024-12-17' });
// ...
rt.socket.addEventListener('open', () => {
  // ...
});
```

---

TITLE: Integrate with Zod Example
DESCRIPTION: Illustrates integrating the SDK with Zod for schema validation of assistant responses. This ensures that the output conforms to expected structures and can be used to generate JSON schemas for API parameters.

SOURCE: https://github.com/openai/openai-node/blob/master/helpers.md#_snippet_15

LANGUAGE: typescript
CODE:

```
import OpenAI from 'openai';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

const client = new OpenAI();

async function main() {
  const runner = client.chat.completions
    .runTools({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: "How's the weather this week in Los Angeles?" }],
      tools: [
        {
          type: 'function',
          function: {
            function: getWeather,
            parse: GetWeatherParameters.parse,
            parameters: zodToJsonSchema(GetWeatherParameters),
          },
        },
      ],
    })
    .on('message', (message) => console.log(message));

  const finalContent = await runner.finalContent();
  console.log('Final content:', finalContent);
}

const GetWeatherParameters = z.object({
  location: z.enum(['Boston', 'New York City', 'Los Angeles', 'San Francisco']),
});

async function getWeather(args: z.infer<typeof GetWeatherParameters>) {
  const { location } = args;
  // … do lookup …
  return { temperature, precipitation };
}

main();
```

---

TITLE: Importing OpenAI from `openai/src` (TypeScript)
DESCRIPTION: This snippet illustrates the old way of importing the OpenAI library, which incorrectly referenced the internal `openai/src` directory. This import path is deprecated and should be updated.

SOURCE: https://github.com/openai/openai-node/blob/master/MIGRATION.md#_snippet_29

LANGUAGE: TypeScript
CODE:

```
import OpenAI from 'openai/src';
```

---

TITLE: APIClient Base Class Removal
DESCRIPTION: Explains the removal of the `APIClient` base class and instructs users to import the main client class (`OpenAI`) instead. It shows the 'before' and 'after' import statements.

SOURCE: https://github.com/openai/openai-node/blob/master/MIGRATION.md#_snippet_8

LANGUAGE: typescript
CODE:

```
// Before
import { APIClient } from 'openai/core';

// After
import { OpenAI } from 'openai';
```

---

TITLE: Removed httpAgent in favor of fetchOptions
DESCRIPTION: The `httpAgent` client option has been removed and replaced by a platform-specific `fetchOptions` property. This change is due to `httpAgent`'s reliance on `node:http` agents, which are not compatible with built-in fetch implementations across different runtimes. For proxy support, refer to the new proxy documentation.

SOURCE: https://github.com/openai/openai-node/blob/master/MIGRATION.md#_snippet_5

LANGUAGE: javascript
CODE:

```
import OpenAI from 'openai';
import http from 'http';
import { HttpsProxyAgent } from 'https-proxy-agent';

// Configure the default for all requests:
const client = new OpenAI({
  httpAgent: new HttpsProxyAgent(process.env.PROXY_URL),
});
```

LANGUAGE: javascript
CODE:

```
import OpenAI from 'openai';
import * as undici from 'undici';

const proxyAgent = new undici.ProxyAgent(process.env.PROXY_URL);
const client = new OpenAI({
  fetchOptions: {
    dispatcher: proxyAgent,
  },
});
```

---

TITLE: Deprecated runFunctions Method (Before Removal) (TypeScript)
DESCRIPTION: This snippet refers to the `client.chat.completions.runFunctions()` method, which has been deprecated and subsequently removed from the library. Users should migrate to the `runTools()` method for similar functionality.

SOURCE: https://github.com/openai/openai-node/blob/master/MIGRATION.md#_snippet_25

LANGUAGE: ts
CODE:

```
client.chat.completions.runFunctions()
```

---

TITLE: Import Path Change: openai/src to openai
DESCRIPTION: Illustrates the necessary change in import statements when the `openai/src` directory is removed. Imports should now directly reference the `openai` package.

SOURCE: https://github.com/openai/openai-node/blob/master/MIGRATION.md#_snippet_19

LANGUAGE: ts
CODE:

```
// Before
import OpenAI from 'openai/src';

// After
import OpenAI from 'openai';
```

---

TITLE: Configuring `tsconfig.json` for Bun (JSON)
DESCRIPTION: This `tsconfig.json` configuration is for TypeScript projects running with Bun. It sets the ECMAScript target version, which is generally sufficient when using Bun's built-in type support or specific `@types/bun` definitions.

SOURCE: https://github.com/openai/openai-node/blob/master/MIGRATION.md#_snippet_36

LANGUAGE: JSON
CODE:

```
{
  "target": "ES2018"
}
```

---

TITLE: Update Azure Entra ID Example in OpenAI Node.js Docs
DESCRIPTION: Updates the Azure example and README documentation to reflect the use of Entra ID (formerly Azure AD). This change provides clearer guidance for authenticating with Azure services when using the OpenAI Node.js client, ensuring users follow current best practices.

SOURCE: https://github.com/openai/openai-node/blob/master/CHANGELOG.md#_snippet_116

LANGUAGE: Markdown
CODE:

```
Documentation: Azure example and README updated to use Entra ID for authentication.
```

---

TITLE: Handling OpenAI Chat Completions with Old `functionCall` Events (TypeScript)
DESCRIPTION: This snippet demonstrates how to listen for `functionCall` related events using the `ChatCompletionRunner`'s `.runTools()` method before the event names were updated. It logs the `functionCall` and `functionCallResult` at various stages.

SOURCE: https://github.com/openai/openai-node/blob/master/MIGRATION.md#_snippet_27

LANGUAGE: TypeScript
CODE:

```
openai.chat.completions
  .runTools({
    // ..
  })
  .on('functionCall', (functionCall) => console.log('functionCall', functionCall))
  .on('functionCallResult', (functionCallResult) => console.log('functionCallResult', functionCallResult))
  .on('finalFunctionCall', (functionCall) => console.log('finalFunctionCall', functionCall))
  .on('finalFunctionCallResult', (result) => console.log('finalFunctionCallResult', result));
```

---

TITLE: Refactored Exports and File Structure
DESCRIPTION: Key internal files like `openai/core`, `error`, `pagination`, `resource`, `streaming`, and `uploads` have been refactored. Public-facing code has been moved to a new `core` folder, while internal code resides in an `internal` folder. This improves clarity and organization. Previously, some resource classes like `Completions` could be imported directly from the package root, but now they must be referenced as static properties or imported from their specific files.

SOURCE: https://github.com/openai/openai-node/blob/master/MIGRATION.md#_snippet_6

LANGUAGE: typescript
CODE:

```
// Before
import 'openai/error';
import 'openai/pagination';
import 'openai/resource';
import 'openai/streaming';
import 'openai/uploads';

// After
import 'openai/core/error';
import 'openai/core/pagination';
import 'openai/core/resource';
import 'openai/core/streaming';
import 'openai/core/uploads';
```

LANGUAGE: typescript
CODE:

```
// Before
const { Completions } = require('openai');

// After
const { OpenAI } = require('openai');
OpenAI.Completions; // or import directly from openai/resources/completions
```

---

TITLE: Updating Positional to Named Path Parameters
DESCRIPTION: Illustrates the change in how path parameters are passed to SDK methods. Previously positional, now multiple path parameters (except the last) require named arguments for clarity and safety.

SOURCE: https://github.com/openai/openai-node/blob/master/MIGRATION.md#_snippet_1

LANGUAGE: typescript
CODE:

```
// Before
client.parents.children.retrieve('p_123', 'c_456');

// After
client.parents.children.retrieve('c_456', { parent_id: 'p_123' });
```

---

TITLE: Feature API: Update Enum Values, Comments, and Examples
DESCRIPTION: This feature updates various enum values, comments, and examples within the API definitions. It reflects the latest API specifications, providing more accurate and helpful guidance for developers.

SOURCE: https://github.com/openai/openai-node/blob/master/CHANGELOG.md#_snippet_84

LANGUAGE: APIDOC
CODE:

```
API.Definitions: Updated existing enum values, inline comments, and example usage snippets across various API endpoints to align with the latest API specifications and improve clarity.
```

---

TITLE: Handling OpenAI Chat Completions with New `functionToolCall` Events (TypeScript)
DESCRIPTION: This snippet shows the updated event names for listening to `functionToolCall` related events with the `ChatCompletionRunner`'s `.runTools()` method. It reflects the changes made to better align with the tool-based API.

SOURCE: https://github.com/openai/openai-node/blob/master/MIGRATION.md#_snippet_28

LANGUAGE: TypeScript
CODE:

```
openai.chat.completions
  .runTools({
    // ..
  })
  .on('functionToolCall', (functionCall) => console.log('functionCall', functionCall))
  .on('functionToolCallResult', (functionCallResult) => console.log('functionCallResult', functionCallResult))
  .on('finalFunctionToolCall', (functionCall) => console.log('finalFunctionCall', functionCall))
  .on('finalFunctionToolCallResult', (result) => console.log('finalFunctionCallResult', result));
```

---

TITLE: Handling Request Options Without Body
DESCRIPTION: When making requests that do not require a body, query, or header parameters, you must now explicitly pass `null`, `undefined`, or an empty object `{}` to the params argument to customize request options. This change affects methods like `client.example.list()`.

SOURCE: https://github.com/openai/openai-node/blob/master/MIGRATION.md#_snippet_3

LANGUAGE: diff
CODE:

```
client.example.list();
client.example.list({}, { headers: { ... } });
client.example.list(null, { headers: { ... } });
client.example.list(undefined, { headers: { ... } });
- client.example.list({ headers: { ... } });
+ client.example.list({}, { headers: { ... } });
```

---

TITLE: OpenAI Node.js Chat Completion Example: Integrate with Zod
DESCRIPTION: Illustrates integrating the OpenAI Node.js SDK with Zod for schema validation of assistant responses. It uses `zod-to-json-schema` to generate JSON schema for API parameters, ensuring data integrity.

SOURCE: https://github.com/openai/openai-node/blob/master/helpers.md#_snippet_34

LANGUAGE: ts
CODE:

```
import OpenAI from 'openai';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

const client = new OpenAI();

async function main() {
  const runner = client.chat.completions
    .runTools({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: "How's the weather this week in Los Angeles?" }],
      tools: [
        {
          type: 'function',
          function: {
            function: getWeather,
            parse: GetWeatherParameters.parse,
            parameters: zodToJsonSchema(GetWeatherParameters),
          },
        },
      ],
    })
    .on('message', (message) => console.log(message));

  const finalContent = await runner.finalContent();
  console.log('Final content:', finalContent);
}

const GetWeatherParameters = z.object({
  location: z.enum(['Boston', 'New York City', 'Los Angeles', 'San Francisco']),
});

async function getWeather(args: z.infer<typeof GetWeatherParameters>) {
  const { location } = args;
  // … do lookup …
  return { temperature, precipitation };
}

main();
```

---

TITLE: OpenAI Node.js Chat Completion Example: Abort on Function Call
DESCRIPTION: Demonstrates how to use the runner's `abort()` method within a tool function to terminate the chat completion process based on specific conditions, such as ending with a particular function call.

SOURCE: https://github.com/openai/openai-node/blob/master/helpers.md#_snippet_33

LANGUAGE: ts
CODE:

```
import OpenAI from 'openai';

const client = new OpenAI();

async function main() {
  const runner = client.chat.completions
    .runTools({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: "How's the weather this week in Los Angeles?" }],
      tools: [
        {
          type: 'function',
          function: {
            function: function updateDatabase(props, runner) {
              runner.abort()
            },
            // ... other function properties
          }
        },
      ],
    })
    .on('message', (message) => console.log(message));

  const finalFunctionCall = await runner.finalFunctionCall();
  console.log('Final function call:', finalFunctionCall);
}

main();
```

---

TITLE: Configuring `tsconfig.json` for Node.js (JSON)
DESCRIPTION: This `tsconfig.json` configuration is for TypeScript projects running in Node.js environments. It specifies the ECMAScript target version, which helps resolve type errors related to Node.js features.

SOURCE: https://github.com/openai/openai-node/blob/master/MIGRATION.md#_snippet_32

LANGUAGE: JSON
CODE:

```
{
  "target": "ES2018"
}
```

---

TITLE: Adding Cloudflare Workers Type Definitions to `package.json` (JSON)
DESCRIPTION: This `package.json` snippet demonstrates adding `@cloudflare/workers-types` as a dev dependency. This package provides essential type definitions for Cloudflare Workers APIs, resolving type errors in TypeScript projects.

SOURCE: https://github.com/openai/openai-node/blob/master/MIGRATION.md#_snippet_35

LANGUAGE: JSON
CODE:

```
{
  "devDependencies": {
    "@cloudflare/workers-types": ">= 0.20221111.0"
  }
}
```

---

TITLE: Adding Node.js Type Definitions to `package.json` (JSON)
DESCRIPTION: This `package.json` snippet shows how to add the `@types/node` package as a dev dependency. This is crucial for providing correct type definitions for Node.js APIs, preventing type errors in TypeScript projects.

SOURCE: https://github.com/openai/openai-node/blob/master/MIGRATION.md#_snippet_33

LANGUAGE: JSON
CODE:

```
{
  "devDependencies": {
    "@types/node": ">= 20"
  }
}
```

---

TITLE: Abort on a Function Call Example
DESCRIPTION: Demonstrates how to abort a chat completion process when a specific function call is encountered. This is useful for controlling the flow of tool-use interactions.

SOURCE: https://github.com/openai/openai-node/blob/master/helpers.md#_snippet_14

LANGUAGE: typescript
CODE:

```
import OpenAI from 'openai';

const client = new OpenAI();

async function main() {
  const runner = client.chat.completions
    .runTools({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: "How's the weather this week in Los Angeles?" }],
      tools: [
        {
          type: 'function',
          function: {
            function: function updateDatabase(props, runner) {
              runner.abort()
            },
            ...
          }
        },
      ],
    })
    .on('message', (message) => console.log(message));

  const finalFunctionCall = await runner.finalFunctionCall();
  console.log('Final function call:', finalFunctionCall);
}

main();
```

---

TITLE: Configuring Proxies for Bun
DESCRIPTION: Shows how to set proxy configurations for Bun environments directly via the `fetchOptions.proxy` property.

SOURCE: https://github.com/openai/openai-node/blob/master/README.md#_snippet_28

LANGUAGE: typescript
CODE:

```
import OpenAI from 'openai';

const client = new OpenAI({
  fetchOptions: {
    proxy: 'http://localhost:8888',
  },
});
```

---

TITLE: Handling URI Encoding for Path Parameters
DESCRIPTION: Explains the change in URI encoding for path parameters. Path parameters are now properly encoded by default, so manual encoding should be removed.

SOURCE: https://github.com/openai/openai-node/blob/master/MIGRATION.md#_snippet_2

LANGUAGE: typescript
CODE:

```
import { Readable } from 'node:stream';
const res = await client.example.retrieve('string/with/slash').asResponse();
Readable.fromWeb(res.body).pipe(process.stdout);
```

---

TITLE: Configuring `tsconfig.json` for Cloudflare Workers (JSON)
DESCRIPTION: This `tsconfig.json` configuration is tailored for TypeScript projects deployed on Cloudflare Workers. It includes specific `lib` and `types` settings to ensure compatibility and correct type checking for the Workers environment.

SOURCE: https://github.com/openai/openai-node/blob/master/MIGRATION.md#_snippet_34

LANGUAGE: JSON
CODE:

```
{
  "target": "ES2018",
  "lib": ["ES2020"],
  "types": ["@cloudflare/workers-types"]
}
```

---

TITLE: Renamed Event Names for runTools()
DESCRIPTION: Demonstrates the renaming of event names in the ChatCompletionRunner to align with the tool-based API. This includes changes from `functionCall` to `functionToolCall` and related result events.

SOURCE: https://github.com/openai/openai-node/blob/master/MIGRATION.md#_snippet_18

LANGUAGE: ts
CODE:

```
openai.chat.completions
  .runTools({
    // ..
  })
  .on('functionCall', (functionCall) => console.log('functionCall', functionCall))
  .on('functionCallResult', (functionCallResult) => console.log('functionCallResult', functionCallResult))
  .on('finalFunctionCall', (functionCall) => console.log('finalFunctionCall', functionCall))
  .on('finalFunctionCallResult', (result) => console.log('finalFunctionCallResult', result));

// After
openai.chat.completions
  .runTools({
    // ..
  })
  .on('functionToolCall', (functionCall) => console.log('functionCall', functionCall))
  .on('functionToolCallResult', (functionCallResult) => console.log('functionCallResult', functionCallResult))
  .on('finalFunctionToolCall', (functionCall) => console.log('finalFunctionCall', functionCall))
  .on('finalFunctionToolCallResult', (result) => console.log('finalFunctionCallResult', result));
```

---

TITLE: Configuring `tsconfig.json` for Browsers (JSON)
DESCRIPTION: This `tsconfig.json` configuration is recommended for TypeScript projects targeting browser environments. It sets the compilation target and includes necessary DOM and iterable libraries to resolve type errors related to browser-specific features.

SOURCE: https://github.com/openai/openai-node/blob/master/MIGRATION.md#_snippet_31

LANGUAGE: JSON
CODE:

```
{
  "target": "ES2018",
  "lib": ["DOM", "DOM.Iterable", "ES2018"]
}
```

---

TITLE: Automatically Fixing Linting Issues
DESCRIPTION: Runs the formatting and lint-fixing process using Yarn. This command automatically corrects many code style and linting issues, ensuring adherence to project standards.

SOURCE: https://github.com/openai/openai-node/blob/master/CONTRIBUTING.md#_snippet_9

LANGUAGE: sh
CODE:

```
$ yarn fix
```

---

TITLE: Accessing Raw Response Data
DESCRIPTION: Illustrates how to access the raw `Response` object from API calls using `.asResponse()` and how to get both parsed data and the raw response using `.withResponse()`.

SOURCE: https://github.com/openai/openai-node/blob/master/README.md#_snippet_19

LANGUAGE: ts
CODE:

```
import OpenAI from 'openai';

const client = new OpenAI();

const httpResponse = await client.responses
  .create({ model: 'gpt-4o', input: 'say this is a test.' })
  .asResponse();

// access the underlying web standard Response object
console.log(httpResponse.headers.get('X-My-Header'));
console.log(httpResponse.statusText);

const { data: modelResponse, response: raw } = await client.responses
  .create({ model: 'gpt-4o', input: 'say this is a test.' })
  .withResponse();
console.log(raw.headers.get('X-My-Header'));
console.log(modelResponse);
```

---

TITLE: OpenAI Run Steps API
DESCRIPTION: Provides methods for retrieving and listing the steps associated with an assistant run. This includes fetching details of a specific run step or listing all steps for a given run, with support for pagination.

SOURCE: https://github.com/openai/openai-node/blob/master/api.md#_snippet_26

LANGUAGE: APIDOC
CODE:

```
client.beta.threads.runs.steps.retrieve(stepID, { ...params })
  - GET /threads/{thread_id}/runs/{run_id}/steps/{step_id}
  - Retrieves a specific run step.
  - Parameters:
    - stepID: The ID of the run step to retrieve.
    - params: Optional parameters.
  - Returns: RunStep object.

client.beta.threads.runs.steps.list(runID, { ...params })
  - GET /threads/{thread_id}/runs/{run_id}/steps
  - Lists all run steps for a given run.
  - Parameters:
    - runID: The ID of the run whose steps to list.
    - params: Optional parameters for pagination and filtering.
  - Returns: RunStepsPage object.
```

---

TITLE: Handling Undocumented Request Parameters
DESCRIPTION: Demonstrates how to use `// @ts-expect-error` to include undocumented parameters in requests to the OpenAI API. Extra parameters are sent in the query for GET requests and in the body for other methods.

SOURCE: https://github.com/openai/openai-node/blob/master/README.md#_snippet_23

LANGUAGE: typescript
CODE:

```
import OpenAI from 'openai';

const client = new OpenAI();

client.chat.completions.create({
  // ... other parameters
  // @ts-expect-error baz is not yet public
  baz: 'undocumented option',
});
```

---

TITLE: Integrating Zod for Schema Validation in OpenAI Chat Completions (TypeScript)
DESCRIPTION: This example illustrates how to integrate `zod` for robust schema validation of tool parameters and assistant responses in OpenAI chat completions. By using `zod` schemas with `zod-to-json-schema`, the API automatically receives the correct JSON Schema for tool parameters, ensuring type safety and data integrity for function calls.

SOURCE: https://github.com/openai/openai-node/blob/master/helpers.md#_snippet_40

LANGUAGE: typescript
CODE:

```
import OpenAI from 'openai';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

const client = new OpenAI();

async function main() {
  const runner = client.chat.completions
    .runTools({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: "How's the weather this week in Los Angeles?" }],
      tools: [
        {
          type: 'function',
          function: {
            function: getWeather,
            parse: GetWeatherParameters.parse,
            parameters: zodToJsonSchema(GetWeatherParameters),
          },
        },
      ],
    })
    .on('message', (message) => console.log(message));

  const finalContent = await runner.finalContent();
  console.log('Final content:', finalContent);
}

const GetWeatherParameters = z.object({
  location: z.enum(['Boston', 'New York City', 'Los Angeles', 'San Francisco']),
});

async function getWeather(args: z.infer<typeof GetWeatherParameters>) {
  const { location } = args;
  // … do lookup …
  return { temperature, precipitation };
}

main();
```

---

TITLE: Configuring Proxies for Node.js
DESCRIPTION: Demonstrates how to configure proxy settings for Node.js environments using `undici.ProxyAgent` within `fetchOptions`.

SOURCE: https://github.com/openai/openai-node/blob/master/README.md#_snippet_27

LANGUAGE: typescript
CODE:

```
import OpenAI from 'openai';
import * as undici from 'undici';

const proxyAgent = new undici.ProxyAgent('http://localhost:8888');
const client = new OpenAI({
  fetchOptions: {
    dispatcher: proxyAgent,
  },
});
```

---

TITLE: HTTP Method Naming Convention Update
DESCRIPTION: Internal naming conflicts previously prevented intuitive naming for some methods. This has been resolved, and affected methods are now correctly named, changing from `.del()` to `.delete()` for clarity and consistency.

SOURCE: https://github.com/openai/openai-node/blob/master/MIGRATION.md#_snippet_4

LANGUAGE: typescript
CODE:

```
// Before
client.chat.completions.del();
client.files.del();
client.models.del();
client.fineTuning.checkpoints.permissions.del();
client.vectorStores.del();
client.vectorStores.files.del();
client.beta.assistants.del();
client.beta.threads.del();
client.beta.threads.messages.del();
client.responses.del();
client.evals.del();
client.evals.runs.del();
client.containers.del();
client.containers.files.del();

// After
client.chat.completions.delete();
client.files.delete();
client.models.delete();
client.fineTuning.checkpoints.permissions.delete();
client.vectorStores.delete();
client.vectorStores.files.delete();
client.beta.assistants.delete();
client.beta.threads.delete();
client.beta.threads.messages.delete();
client.responses.delete();
client.evals.delete();
client.evals.runs.delete();
client.containers.delete();
client.containers.files.delete();
```

---

TITLE: Streaming Run Creation and Event Handling
DESCRIPTION: Demonstrates creating a run with streaming enabled and subscribing to various events such as text creation, delta updates, and tool calls. It shows how to process different types of content and tool outputs.

SOURCE: https://github.com/openai/openai-node/blob/master/helpers.md#_snippet_2

LANGUAGE: ts
CODE:

```
const run = openai.beta.threads.runs
  .stream(thread.id, { assistant_id: assistant.id })
  .on('textCreated', (text) => process.stdout.write('\nassistant > '))
  .on('textDelta', (textDelta, snapshot) => process.stdout.write(textDelta.value))
  .on('toolCallCreated', (toolCall) => process.stdout.write(`\nassistant > ${toolCall.type}\n\n`))
  .on('toolCallDelta', (toolCallDelta, snapshot) => {
    if (toolCallDelta.type === 'code_interpreter') {
      if (toolCallDelta.code_interpreter.input) {
        process.stdout.write(toolCallDelta.code_interpreter.input);
      }
      if (toolCallDelta.code_interpreter.outputs) {
        process.stdout.write('\noutput >\n');
        toolCallDelta.code_interpreter.outputs.forEach((output) => {
          if (output.type === 'logs') {
            process.stdout.write(`\n${output.logs}\n`);
          }
        });
      }
    }
  });
```

---

TITLE: OpenAI Node.js: Manual Shims Import Support
DESCRIPTION: The client now supports manual importing of Node.js or web shims. This feature provides greater control over the environment setup, allowing developers to explicitly choose the appropriate shims for their specific deployment target (e.g., Node.js, browser, or edge environments). This can be useful for bundler configurations or specific runtime requirements.

SOURCE: https://github.com/openai/openai-node/blob/master/CHANGELOG.md#_snippet_184

LANGUAGE: TypeScript
CODE:

```
// For Node.js environment
import '@openai/openai-node/shims/node';
import OpenAI from 'openai';

// For Web/Edge environment
// import '@openai/openai-node/shims/web';
// import OpenAI from 'openai';

const openai = new OpenAI();
// ... use client
```

---

TITLE: Internal: Update OpenAI Node.js Project Structure and License
DESCRIPTION: This chore includes minor internal updates such as adding '.keep' files to ensure empty example and custom code directories are preserved in version control, and updating the project's license information. These changes contribute to better project organization and compliance.

SOURCE: https://github.com/openai/openai-node/blob/master/CHANGELOG.md#_snippet_169

LANGUAGE: Other
CODE:

```
// Project structure updates:
// - Added .keep files to 'examples/' and 'custom_code/' directories.
// - Updated LICENSE file.
```

---

TITLE: Remove Deno Requirement for Build-Deno Script
DESCRIPTION: This bug fix modifies the `build-deno` script to no longer require Deno to be installed. This simplifies the build process for developers and CI environments that might not have Deno pre-installed. It improves build flexibility.

SOURCE: https://github.com/openai/openai-node/blob/master/CHANGELOG.md#_snippet_99

LANGUAGE: APIDOC
CODE:

```
Bug Fix: Build Process
Component: Build Scripts (build-deno)
Change Type: Dependency Removal
Details: Removed the Deno installation requirement for running build-deno.
Impact: Streamlined build process for Deno targets.
```

---

TITLE: Decouple Tests from OPENAI_API_KEY Environment Variable (Node.js)
DESCRIPTION: This change modifies tests to no longer rely directly on the `OPENAI_API_KEY` environment variable. It makes the test suite more flexible and easier to run in various CI/CD environments or local setups without requiring a live API key.

SOURCE: https://github.com/openai/openai-node/blob/master/CHANGELOG.md#_snippet_25

LANGUAGE: JavaScript
CODE:

```
// Internal test setup change: Tests no longer strictly require OPENAI_API_KEY.
// This allows for more flexible testing environments (e.g., using mock keys).
// No direct user-facing code change.
```

---

TITLE: Fix Streaming Helper Imports to Be Relative
DESCRIPTION: This bug fix corrects the import paths for streaming helper utilities to be relative. This resolves potential issues with module resolution, especially in different environments or build setups. It ensures the streaming functionality works reliably.

SOURCE: https://github.com/openai/openai-node/blob/master/CHANGELOG.md#_snippet_96

LANGUAGE: APIDOC
CODE:

```
Bug Fix: Module Imports
Component: Streaming Helpers
Change Type: Path Correction
Details: Changed streaming helper imports to use relative paths.
Impact: Improved module resolution and streaming reliability.
```

---

TITLE: Customizing the Fetch Client
DESCRIPTION: Shows two methods for using a custom `fetch` implementation: polyfilling the global `fetch` or passing a custom `fetch` function directly to the OpenAI client constructor.

SOURCE: https://github.com/openai/openai-node/blob/master/README.md#_snippet_25

LANGUAGE: typescript
CODE:

```
import fetch from 'my-fetch';

// Method 1: Polyfill global fetch
globalThis.fetch = fetch;
```

LANGUAGE: typescript
CODE:

```
import OpenAI from 'openai';
import fetch from 'my-fetch';

// Method 2: Pass fetch to the client
const client = new OpenAI({ fetch });
```

---

TITLE: Fix pnpm Git Imports in OpenAI Node.js
DESCRIPTION: Addresses a bug that prevented the use of Git imports when managing dependencies with pnpm. This fix ensures that developers using pnpm can correctly install and utilize the OpenAI Node.js library from Git repositories, improving build reliability.

SOURCE: https://github.com/openai/openai-node/blob/master/CHANGELOG.md#_snippet_115

LANGUAGE: JavaScript
CODE:

```
Fix: pnpm git import compatibility.
```

---

TITLE: Aborting OpenAI Chat Completion on Function Call (TypeScript)
DESCRIPTION: This example demonstrates how to prematurely abort an OpenAI chat completion run when a specific function call is triggered. By calling `runner.abort()` within the tool's function implementation, the process is stopped, and the final function call can be retrieved, useful for workflows that conclude upon a certain tool invocation.

SOURCE: https://github.com/openai/openai-node/blob/master/helpers.md#_snippet_39

LANGUAGE: typescript
CODE:

```
import OpenAI from 'openai';

const client = new OpenAI();

async function main() {
  const runner = client.chat.completions
    .runTools({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: "How's the weather this week in Los Angeles?" }],
      tools: [
        {
          type: 'function',
          function: {
            function: function updateDatabase(props, runner) {
              runner.abort()
            },
            …
          }
        },
      ],
    })
    .on('message', (message) => console.log(message));

  const finalFunctionCall = await runner.finalFunctionCall();
  console.log('Final function call:', finalFunctionCall);
}

main();
```

---

TITLE: Add Case-Insensitive Get Header Function (Node.js)
DESCRIPTION: This chore introduces an internal utility function to retrieve HTTP headers without sensitivity to casing. It enhances the library's ability to parse headers consistently, improving internal data handling.

SOURCE: https://github.com/openai/openai-node/blob/master/CHANGELOG.md#_snippet_191

LANGUAGE: APIDOC
CODE:

```
Type: Utility Function
Name: getHeader(headers: Record<string, string>, key: string)
Description: Retrieves a header value from a record of headers, performing a case-insensitive lookup.
Parameters:
  - headers: Record<string, string> - The object containing HTTP headers.
  - key: string - The header name to look up.
Returns: string | undefined - The header value if found, otherwise undefined.
```

---

TITLE: OpenAI Node.js Client: Introduce withOptions Helper
DESCRIPTION: A new `withOptions` helper has been added to the OpenAI Node.js client. This utility simplifies the process of applying common options or configurations across multiple API calls without repeating them. It enhances code readability and reduces boilerplate when making a series of related requests.

SOURCE: https://github.com/openai/openai-node/blob/master/CHANGELOG.md#_snippet_2

LANGUAGE: APIDOC
CODE:

```
{
  "type": "Method",
  "name": "client.withOptions",
  "description": "Creates a new client instance with default options applied, allowing for chained configurations.",
  "parameters": [
    {"name": "options", "type": "object", "description": "An object containing default options to apply, such as 'timeout', 'maxRetries', 'headers', etc."}
  ],
  "returns": {"type": "OpenAI", "description": "A new OpenAI client instance pre-configured with the specified options."}
}
```

LANGUAGE: JavaScript
CODE:

```
const OpenAI = require('openai');
const client = new OpenAI();

const configuredClient = client.withOptions({
  timeout: 60000, // 60 seconds
  maxRetries: 3,
  headers: { 'X-Custom-Header': 'Value' }
});

async function makeCalls() {
  const chatCompletion = await configuredClient.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: "Hello world" }]
  });
  // ... other calls using configuredClient
}
```

---

TITLE: Retrieve OpenAI Response by ID (Node.js Client)
DESCRIPTION: This method retrieves a specific response resource using its unique ID through the OpenAI Node.js client. It sends a GET request to the `/responses/{response_id}` endpoint. This is useful for fetching details of a previously created or existing response, returning a `Response` object if found.

SOURCE: https://github.com/openai/openai-node/blob/master/api.md#_snippet_48

LANGUAGE: TypeScript
CODE:

```
client.responses.retrieve(responseID: string, params?: RequestOptions): Promise<Response>
```

LANGUAGE: APIDOC
CODE:

```
Method: client.responses.retrieve
Endpoint: GET /responses/{response_id}
Description: Retrieves a specific response resource by its ID.
Parameters:
  responseID: string (required) - The unique identifier of the response.
  params: object (optional) - Additional request parameters.
Returns:
  Response: The retrieved response object.
```

---

TITLE: Setting Custom Fetch Options
DESCRIPTION: Illustrates how to provide custom `fetch` options, such as headers or other `RequestInit` properties, either during client instantiation or on a per-request basis. Request-specific options take precedence.

SOURCE: https://github.com/openai/openai-node/blob/master/README.md#_snippet_26

LANGUAGE: typescript
CODE:

```
import OpenAI from 'openai';

const client = new OpenAI({
  fetchOptions: {
    // `RequestInit` options like headers, etc.
    headers: {
      'X-Custom-Header': 'value',
    },
  },
});
```

---

TITLE: OpenAI Node.js Library Versioning
DESCRIPTION: Explains the semantic versioning (SemVer) approach used by the OpenAI Node.js library, including exceptions for static type changes, internal changes, and minor changes unlikely to impact most users.

SOURCE: https://github.com/openai/openai-node/blob/master/README.md#_snippet_30

LANGUAGE: APIDOC
CODE:

```
OpenAI Node.js Library Versioning:
  - Follows SemVer conventions.
  - Exceptions for backwards-incompatible changes in minor versions:
    1. Static type changes only.
    2. Internal library changes not intended for public use.
    3. Changes unlikely to impact most users.
  - Commitment to backward-compatibility and smooth upgrades.
  - Encourages user feedback via GitHub issues.
```

---

TITLE: Using a Custom Logger
DESCRIPTION: Demonstrates how to provide a custom logger instance (e.g., from pino) to the OpenAI client for more advanced logging control.

SOURCE: https://github.com/openai/openai-node/blob/master/README.md#_snippet_21

LANGUAGE: ts
CODE:

```
import OpenAI from 'openai';
import pino from 'pino';

const logger = pino();

const client = new OpenAI({
  logger: logger.child({ name: 'OpenAI' }),
  logLevel: 'debug', // Send all messages to pino, allowing it to filter
});
```

---

TITLE: OpenAI Chat Completions Streaming
DESCRIPTION: Details on streaming chat completions using the OpenAI Node.js library. It covers the `ChatCompletionStreamingRunner` and alternative async iterable approaches.

SOURCE: https://github.com/openai/openai-node/blob/master/helpers.md#_snippet_7

LANGUAGE: ts
CODE:

```
openai.chat.completions.stream({ stream?: false, … }, options?): ChatCompletionStreamingRunner

openai.chat.completions.create({ stream: true, … }): AsyncIterable<ChatCompletionChunk>

// To cancel a stream:
stream.abort()
// or break from a for await loop.
```

---

TITLE: Bug Fix: Avoid Type Error in Node.js Environments
DESCRIPTION: This bug fix addresses a type error that could occur in specific Node.js environments, ensuring broader compatibility and stability for the library. It prevents unexpected runtime issues related to type mismatches, making the client more robust across different setups. This is a critical fix for environment-specific stability.

SOURCE: https://github.com/openai/openai-node/blob/master/CHANGELOG.md#_snippet_39

LANGUAGE: APIDOC
CODE:

```
// API Change: Bug Fix
Affected Component: Core Library
Description: Resolved an intermittent type error that manifested in certain Node.js environments.
Impact: Improves library stability and broadens compatibility across diverse runtime setups.
Reference: Issue #1413
```

---

TITLE: OpenAI Node.js Client: Completions API Promoted to GA
DESCRIPTION: The beta methods for the Completions API in the OpenAI Node.js client have been promoted to General Availability (GA). This signifies their stability and readiness for production use. Developers can now confidently integrate these methods, knowing they are fully supported and mature.

SOURCE: https://github.com/openai/openai-node/blob/master/CHANGELOG.md#_snippet_4

LANGUAGE: APIDOC
CODE:

```
{
  "type": "API_Status_Update",
  "name": "Completions API (GA)",
  "description": "The OpenAI Completions API methods previously in beta are now generally available (GA).",
  "details": {
    "status": "General Availability (GA)",
    "impact": "Production-ready, stable API for text completions.",
    "example_usage": "const completion = await client.completions.create({\n  model: \"gpt-3.5-turbo-instruct\",\n  prompt: \"Say this is a test\",\n  max_tokens: 7,\n  temperature: 0,\n});\nconsole.log(completion.choices[0].text);"
  }
}
```

---

TITLE: Manage Containers with OpenAI Node.js Client
DESCRIPTION: This section details the API for interacting with container resources. It covers operations such as creating new containers, retrieving specific container details, listing all available containers, and deleting containers. Dependencies include the OpenAI Node.js client library.

SOURCE: https://github.com/openai/openai-node/blob/master/api.md#_snippet_68

LANGUAGE: APIDOC
CODE:

```
Types:
  - ContainerCreateResponse
  - ContainerRetrieveResponse
  - ContainerListResponse
```

LANGUAGE: APIDOC
CODE:

```
client.containers.create({ ...params }) -> ContainerCreateResponse
  Method: POST /containers
  Description: Creates a new container.

client.containers.retrieve(containerID) -> ContainerRetrieveResponse
  Method: GET /containers/{container_id}
  Description: Retrieves details for a specific container.
  Parameters:
    - containerID: string (ID of the container to retrieve)

client.containers.list({ ...params }) -> ContainerListResponsesPage
  Method: GET /containers
  Description: Lists all containers.

client.containers.delete(containerID) -> void
  Method: DELETE /containers/{container_id}
  Description: Deletes a specific container.
  Parameters:
    - containerID: string (ID of the container to delete)
```

---

TITLE: Auto-pagination for List Operations
DESCRIPTION: Illustrates how to use the `for await...of` syntax to iterate through all items across paginated API lists, or manually paginate using convenience methods.

SOURCE: https://github.com/openai/openai-node/blob/master/README.md#_snippet_17

LANGUAGE: ts
CODE:

```
async function fetchAllFineTuningJobs(params) {
  const allFineTuningJobs = [];
  // Automatically fetches more pages as needed.
  for await (const fineTuningJob of client.fineTuning.jobs.list({ limit: 20 })) {
    allFineTuningJobs.push(fineTuningJob);
  }
  return allFineTuningJobs;
}
```

LANGUAGE: ts
CODE:

```
let page = await client.fineTuning.jobs.list({ limit: 20 });
for (const fineTuningJob of page.data) {
  console.log(fineTuningJob);
}

// Convenience methods are provided for manually paginating:
while (page.hasNextPage()) {
  page = await page.getNextPage();
  // ...
}
```

---

TITLE: Realtime Sessions API
DESCRIPTION: API methods for creating and managing realtime sessions. This includes creating a new session and returning a SessionCreateResponse.

SOURCE: https://github.com/openai/openai-node/blob/master/api.md#_snippet_21

LANGUAGE: APIDOC
CODE:

```
POST /realtime/sessions

client.beta.realtime.sessions.create({ ...params }) -> SessionCreateResponse

Description:
  Creates a new realtime session.

Parameters:
  ...params: An object containing parameters for session creation.

Returns:
  SessionCreateResponse: An object representing the created session.
```

---

TITLE: Upload Files to OpenAI API
DESCRIPTION: Demonstrates various methods for uploading files to the OpenAI API, including using Node.js streams, web File API, fetch Responses, and a helper function.

SOURCE: https://github.com/openai/openai-node/blob/master/README.md#_snippet_6

LANGUAGE: typescript
CODE:

```
import fs from 'fs';
import OpenAI, { toFile } from 'openai';

const client = new OpenAI();

// If you have access to Node `fs` we recommend using `fs.createReadStream()`:
await client.files.create({ file: fs.createReadStream('input.jsonl'), purpose: 'fine-tune' });

// Or if you have the web `File` API you can pass a `File` instance:
await client.files.create({ file: new File(['my bytes'], 'input.jsonl'), purpose: 'fine-tune' });

// You can also pass a `fetch` `Response`:
await client.files.create({ file: await fetch('https://somesite/input.jsonl'), purpose: 'fine-tune' });

// Finally, if none of the above are convenient, you can use our `toFile` helper:
await client.files.create({
  file: await toFile(Buffer.from('my bytes'), 'input.jsonl'),
  purpose: 'fine-tune',
});
await client.files.create({
  file: await toFile(new Uint8Array([0, 1, 2]), 'input.jsonl'),
  purpose: 'fine-tune',
});
```

---

TITLE: OpenAI Completions API - Create
DESCRIPTION: This method is used to create a completion request to the OpenAI API. It requires parameters such as the model to use and the prompt. The response is a Completion object.

SOURCE: https://github.com/openai/openai-node/blob/master/api.md#_snippet_0

LANGUAGE: APIDOC
CODE:

```
client.completions.create({ ...params })
  - Creates a completion request.
  - Parameters: Requires parameters like model and prompt.
  - Returns: Completion object.
```

---

TITLE: Query String Parsing and Stringifying
DESCRIPTION: This snippet demonstrates the core functionality of the qs library for parsing query strings into JavaScript objects and stringifying JavaScript objects back into query strings. It is useful for handling URL parameters and configuration objects.

SOURCE: https://github.com/openai/openai-node/blob/master/src/internal/qs/README.md#_snippet_0

LANGUAGE: javascript
CODE:

```
const qs = require('qs');

// Stringify an object
const queryString = qs.stringify({ a: 1, b: 2 });
console.log(queryString); // Output: 'a=1&b=2'

// Parse a query string
const params = qs.parse('a=1&b=2');
console.log(params); // Output: { a: '1', b: '2' }
```

LANGUAGE: typescript
CODE:

```
import qs from 'qs';

// Stringify an object
const queryString: string = qs.stringify({ a: 1, b: 2 });
console.log(queryString); // Output: 'a=1&b=2'

// Parse a query string
const params: qs.ParsedQuery = qs.parse('a=1&b=2');
console.log(params); // Output: { a: '1', b: '2' }
```

---

TITLE: Doc Readme: Cleanup into Multiple Files
DESCRIPTION: This documentation update reorganizes the project's README content by splitting it into multiple, more manageable files. This improves readability and navigability for users seeking specific information.

SOURCE: https://github.com/openai/openai-node/blob/master/CHANGELOG.md#_snippet_72

LANGUAGE: Markdown
CODE:

```
Documentation Structure: README content refactored and distributed into multiple dedicated markdown files for better organization and user experience.
```

---

TITLE: Configuring Log Level
DESCRIPTION: Shows how to configure the logging level for the OpenAI client, either via the `OPENAI_LOG` environment variable or the `logLevel` client option.

SOURCE: https://github.com/openai/openai-node/blob/master/README.md#_snippet_20

LANGUAGE: ts
CODE:

```
import OpenAI from 'openai';

const client = new OpenAI({
  logLevel: 'debug', // Show all log messages
});
```

---

TITLE: Bulk Uploading Files to OpenAI Vector Store (TypeScript)
DESCRIPTION: This snippet demonstrates how to use the `uploadAndPoll` helper function from the OpenAI Node.js library to upload multiple files to a specified vector store. It takes an array of file streams and the vector store ID, then initiates the upload and polls for its completion.

SOURCE: https://github.com/openai/openai-node/blob/master/helpers.md#_snippet_42

LANGUAGE: TypeScript
CODE:

```
const fileList = [
  createReadStream('/home/data/example.pdf'),
  ...
];

const batch = await openai.vectorStores.fileBatches.uploadAndPoll(vectorStore.id, {files: fileList});
```

---

TITLE: Chore: Support Pre-release Versioning in OpenAI Node.js Internal
DESCRIPTION: This internal chore adds support for pre-release versioning. This allows for better management and testing of development versions before official releases.

SOURCE: https://github.com/openai/openai-node/blob/master/CHANGELOG.md#_snippet_147

LANGUAGE: APIDOC
CODE:

```
Added support for pre-release versioning.
```

---

TITLE: OpenAI Webhook Client Methods
DESCRIPTION: Provides methods for interacting with OpenAI webhooks. The `unwrap` method processes incoming webhook payloads, and `verifySignature` ensures the authenticity of the webhook request.

SOURCE: https://github.com/openai/openai-node/blob/master/api.md#_snippet_19

LANGUAGE: APIDOC
CODE:

```
client.webhooks:
  unwrap(payload: object, headers: object, secret?: string, tolerance?: number) -> UnwrapWebhookEvent
    Processes an incoming webhook payload and returns the unwrapped event object.
    Parameters:
      payload: The raw webhook payload received.
      headers: The HTTP headers of the webhook request.
      secret: (Optional) The webhook signing secret for signature verification.
      tolerance: (Optional) The time tolerance in seconds for signature verification.
    Returns: An object representing the unwrapped webhook event.

  verifySignature(payload: object, headers: object, secret?: string, tolerance?: number) -> void
    Verifies the signature of an incoming webhook request to ensure its authenticity.
    Parameters:
      payload: The raw webhook payload received.
      headers: The HTTP headers of the webhook request.
      secret: The webhook signing secret required for verification.
      tolerance: (Optional) The time tolerance in seconds for signature verification.
    Returns: void. Throws an error if the signature is invalid.
```

---

TITLE: Realtime API Client Events Reference
DESCRIPTION: Provides a reference for client-sent and server-sent events used with the Realtime API. This includes session management, conversation updates, and response handling.

SOURCE: https://github.com/openai/openai-node/blob/master/realtime.md#_snippet_3

LANGUAGE: APIDOC
CODE:

```
Realtime API Events:

Client-Sent Events:
  - session.update: Updates the current session configuration (e.g., modalities, model).
    Parameters:
      - session: Object containing session configuration.
        - modalities: Array of supported modalities (e.g., ['text'], ['audio']).
        - model: The model to use for the session.
  - conversation.item.create: Adds an item to the conversation history.
    Parameters:
      - item: The conversation item to add.
        - type: Type of item (e.g., 'message').
        - role: Role of the participant (e.g., 'user', 'assistant').
        - content: Array of content parts (e.g., [{ type: 'input_text', text: '...' }]).
  - response.create: Requests a response from the model.

Server-Sent Events:
  - session.created: Confirms that a session has been successfully created.
    Parameters:
      - session: Object containing the created session details.
  - response.text.delta: Provides a partial text response (streaming).
    Parameters:
      - delta: The text chunk received.
  - response.text.done: Indicates the end of a text response stream.
  - response.done: Signals the completion of the overall response.
  - error: Reports an error encountered by the API.
    Parameters:
      - err: Error object or message.
```

---

TITLE: Azure OpenAI Integration
DESCRIPTION: Demonstrates how to use the AzureOpenAI class to connect with Azure OpenAI services. It utilizes Azure AD token providers for authentication.

SOURCE: https://github.com/openai/openai-node/blob/master/README.md#_snippet_13

LANGUAGE: ts
CODE:

```
import { AzureOpenAI } from 'openai';
import { getBearerTokenProvider, DefaultAzureCredential } from '@azure/identity';

const credential = new DefaultAzureCredential();
const scope = 'https://cognitiveservices.azure.com/.default';
const azureADTokenProvider = getBearerTokenProvider(credential, scope);

const openai = new AzureOpenAI({ azureADTokenProvider });

const result = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Say hello!' }],
});

console.log(result.choices[0]!.message?.content);
```

---

TITLE: OpenAI Assistant API Event Subscriptions
DESCRIPTION: Details the various events that can be subscribed to when using the OpenAI Assistant API for streaming. This includes general events and specific events related to run steps, messages, text content, image files, and tool calls.

SOURCE: https://github.com/openai/openai-node/blob/master/helpers.md#_snippet_4

LANGUAGE: APIDOC
CODE:

```
.on('event', (event: AssistantStreamEvent) => ...)
  - Subscribes to all possible raw events sent by the OpenAI streaming API.

.on('runStepCreated', (runStep: RunStep) => ...)
.on('runStepDelta', (delta: RunStepDelta, snapshot: RunStep) => ...)
.on('runStepDone', (runStep: RunStep) => ...)
  - Subscribes to the creation, delta, and completion of a RunStep.

.on('messageCreated', (message: Message) => ...)
.on('messageDelta', (delta: MessageDelta, snapshot: Message) => ...)
.on('messageDone', (message: Message) => ...)
  - Subscribes to Message creation, delta, and completion events. Handles different content types within messages.

.on('textCreated', (content: Text) => ...)
.on('textDelta', (delta: TextDelta, snapshot: Text) => ...)
.on('textDone', (content: Text, snapshot: Message) => ...)
  - Subscribes to the creation, delta, and completion of Text content within messages.

.on('imageFileDone', (content: ImageFile, snapshot: Message) => ...)
  - Provides an event for when an image file is available, as image files are not sent incrementally.

.on('toolCallCreated', (toolCall: ToolCall) => ...)
.on('toolCallDelta', (delta: RunStepDelta, snapshot: ToolCall) => ...)
.on('toolCallDone', (toolCall: ToolCall) => ...)
  - Subscribes to events for the creation, delta, and completion of a ToolCall.

.on('end', () => ...)
  - The final event sent when a stream concludes.
```

---

TITLE: Fine-Tuning Checkpoint Permissions API
DESCRIPTION: Manages permissions for fine-tuning checkpoints. Includes methods to create, retrieve, and delete permissions associated with a specific fine-tuned model checkpoint.

SOURCE: https://github.com/openai/openai-node/blob/master/api.md#_snippet_12

LANGUAGE: APIDOC
CODE:

```
Permissions API:

Types:
  PermissionCreateResponse
  PermissionRetrieveResponse
  PermissionDeleteResponse

Methods:
  create(fineTunedModelCheckpoint: string, params: object): PermissionCreateResponse
    POST /fine_tuning/checkpoints/{fine_tuned_model_checkpoint}/permissions
    Creates a permission for a fine-tuning checkpoint.

  retrieve(fineTunedModelCheckpoint: string, params: object): PermissionRetrieveResponse
    GET /fine_tuning/checkpoints/{fine_tuned_model_checkpoint}/permissions
    Retrieves permissions for a fine-tuning checkpoint.

  delete(permissionID: string, params: object): PermissionDeleteResponse
    DELETE /fine_tuning/checkpoints/{fine_tuned_model_checkpoint}/permissions/{permission_id}
    Deletes a specific permission for a fine-tuning checkpoint.
```

---

TITLE: Upload and Poll Vector Store Files
DESCRIPTION: Uploads multiple files to an OpenAI vector store and polls for the completion of the operation. Requires the `openai` library and streamable file objects.

SOURCE: https://github.com/openai/openai-node/blob/master/helpers.md#_snippet_36

LANGUAGE: typescript
CODE:

```
const fileList = [
  createReadStream('/home/data/example.pdf'),
  ...
];

const batch = await openai.vectorStores.fileBatches.uploadAndPoll(vectorStore.id, {files: fileList});
```

---

TITLE: OpenAI Chat Completions API Reference
DESCRIPTION: This section provides a comprehensive reference for the OpenAI Chat Completions API as implemented in the Node.js client. It covers the various data types used for messages, parameters, and responses, along with the available methods for interacting with the API.

SOURCE: https://github.com/openai/openai-node/blob/master/api.md#_snippet_1

LANGUAGE: APIDOC
CODE:

```
OpenAI Chat Completions API:

Types:
  ChatCompletion
  ChatCompletionAllowedToolChoice
  ChatCompletionAssistantMessageParam
  ChatCompletionAudio
  ChatCompletionAudioParam
  ChatCompletionChunk
  ChatCompletionContentPart
  ChatCompletionContentPartImage
  ChatCompletionContentPartInputAudio
  ChatCompletionContentPartRefusal
  ChatCompletionContentPartText
  ChatCompletionCustomTool
  ChatCompletionDeleted
  ChatCompletionDeveloperMessageParam
  ChatCompletionFunctionCallOption
  ChatCompletionFunctionMessageParam
  ChatCompletionFunctionTool
  ChatCompletionMessage
  ChatCompletionMessageCustomToolCall
  ChatCompletionMessageFunctionToolCall
  ChatCompletionMessageParam
  ChatCompletionMessageToolCall
  ChatCompletionModality
  ChatCompletionNamedToolChoice
  ChatCompletionNamedToolChoiceCustom
  ChatCompletionPredictionContent
  ChatCompletionRole
  ChatCompletionStoreMessage
  ChatCompletionStreamOptions
  ChatCompletionSystemMessageParam
  ChatCompletionTokenLogprob
  ChatCompletionTool
  ChatCompletionToolChoiceOption
  ChatCompletionToolMessageParam
  ChatCompletionUserMessageParam
  ChatCompletionAllowedTools
  ChatCompletionReasoningEffort

Methods:

1. create(params: object) -> ChatCompletion
   - POST /chat/completions
   - Description: Creates a chat completion request.
   - Parameters: Accepts an object with various parameters like `model`, `messages`, `temperature`, etc.
   - Returns: A ChatCompletion object representing the model's response.

2. retrieve(completionID: string) -> ChatCompletion
   - GET /chat/completions/{completion_id}
   - Description: Retrieves a specific chat completion by its ID.
   - Parameters:
     - completionID: The unique identifier of the completion.
   - Returns: A ChatCompletion object.

3. update(completionID: string, params: object) -> ChatCompletion
   - POST /chat/completions/{completion_id}
   - Description: Updates an existing chat completion (e.g., for streaming or modifications).
   - Parameters:
     - completionID: The unique identifier of the completion to update.
     - params: An object containing update parameters.
   - Returns: An updated ChatCompletion object.

4. list(params: object) -> ChatCompletionsPage
   - GET /chat/completions
   - Description: Retrieves a list of chat completions, with support for filtering and pagination.
   - Parameters: Accepts an object with parameters like `limit`, `order`, `before`, `after`.
   - Returns: A ChatCompletionsPage object containing a list of completions.

5. delete(completionID: string) -> ChatCompletionDeleted
   - DELETE /chat/completions/{completion_id}
   - Description: Deletes a chat completion by its ID.
   - Parameters:
     - completionID: The unique identifier of the completion to delete.
   - Returns: A ChatCompletionDeleted object indicating the result of the deletion.
```

---

TITLE: OpenAI Realtime API Error Handling
DESCRIPTION: Demonstrates best practices for handling errors in the OpenAI Realtime API. It emphasizes the importance of registering an `error` event listener to catch both client-side and server-side errors, preventing unhandled Promise rejections.

SOURCE: https://github.com/openai/openai-node/blob/master/realtime.md#_snippet_2

LANGUAGE: ts
CODE:

```
const rt = new OpenAIRealtimeWS({ model: 'gpt-4o-realtime-preview-2024-12-17' });
rt.on('error', (err) => {
  // in a real world scenario this should be logged somewhere as you
  // likely want to continue processing events regardless of any errors
  throw err;
});
```

---

TITLE: Handle Refusal Log Probabilities Completion
DESCRIPTION: Fired when all refusal log probabilities have been received. The `props` object contains the full list of token log probabilities for the refusal.

SOURCE: https://github.com/openai/openai-node/blob/master/helpers.md#_snippet_20

LANGUAGE: typescript
CODE:

```
runner.on('logprobs.refusal.done', (props: LogProbsRefusalDoneEvent) => {
  // Handle all refusal log probabilities
  console.log(props.refusal);
});
```

---

TITLE: OpenAI Audio Transcriptions API
DESCRIPTION: Handles audio transcription tasks. The `create` method transcribes audio files into text, supporting various parameters for customization.

SOURCE: https://github.com/openai/openai-node/blob/master/api.md#_snippet_6

LANGUAGE: APIDOC
CODE:

```
client.audio.transcriptions.create({ ...params }) -> TranscriptionCreateResponse
  - Transcribes an audio file into text.
  - Parameters:
    - params: An object containing transcription parameters, such as the audio file, model, and language.
```

---

TITLE: Vector Store Files API
DESCRIPTION: Provides methods for creating, retrieving, updating, listing, and deleting files within a vector store. It also includes methods for retrieving file content and handling file uploads with polling.

SOURCE: https://github.com/openai/openai-node/blob/master/api.md#_snippet_16

LANGUAGE: APIDOC
CODE:

```
client.vectorStores.files.create(vectorStoreId, { ...params }) -> VectorStoreFile
  POST /vector_stores/{vector_store_id}/files
  Adds a file to a vector store.
  Parameters:
    - vectorStoreId: The ID of the vector store.
    - params: An object containing file-related parameters.
  Returns: A VectorStoreFile object.

client.vectorStores.files.retrieve(vectorStoreId, fileId) -> VectorStoreFile
  GET /vector_stores/{vector_store_id}/files/{file_id}
  Retrieves a specific file from a vector store.
  Parameters:
    - vectorStoreId: The ID of the vector store.
    - fileId: The ID of the file to retrieve.
  Returns: A VectorStoreFile object.

client.vectorStores.files.update(vectorStoreId, fileId, { ...params }) -> VectorStoreFile
  POST /vector_stores/{vector_store_id}/files/{file_id}
  Updates a file in a vector store.
  Parameters:
    - vectorStoreId: The ID of the vector store.
    - fileId: The ID of the file to update.
    - params: An object containing update parameters.
  Returns: An updated VectorStoreFile object.

client.vectorStores.files.list(vectorStoreId, { ...params }) -> VectorStoreFilesPage
  GET /vector_stores/{vector_store_id}/files
  Lists all files associated with a vector store.
  Parameters:
    - vectorStoreId: The ID of the vector store.
    - params: An object for pagination and filtering.
  Returns: A VectorStoreFilesPage object.

client.vectorStores.files.del(vectorStoreId, fileId) -> VectorStoreFileDeleted
  DELETE /vector_stores/{vector_store_id}/files/{file_id}
  Deletes a file from a vector store.
  Parameters:
    - vectorStoreId: The ID of the vector store.
    - fileId: The ID of the file to delete.
  Returns: A VectorStoreFileDeleted object.

client.vectorStores.files.content(vectorStoreId, fileId) -> FileContentResponsesPage
  GET /vector_stores/{vector_store_id}/files/{file_id}/content
  Retrieves the content of a file from a vector store.
  Parameters:
    - vectorStoreId: The ID of the vector store.
    - fileId: The ID of the file whose content to retrieve.
  Returns: A FileContentResponsesPage object.

client.vectorStores.files.createAndPoll(vectorStoreId, body, options?) -> Promise<VectorStoreFile>
  Handles file creation and polls for completion.

client.vectorStores.files.poll(vectorStoreId, fileId, options?) -> Promise<VectorStoreFile>
  Polls for the status of a file operation.

client.vectorStores.files.upload(vectorStoreId, file, options?) -> Promise<VectorStoreFile>
  Uploads a file to a vector store.

client.vectorStores.files.uploadAndPoll(vectorStoreId, file, options?) -> Promise<VectorStoreFile>
  Uploads a file and polls for completion.
```

---

TITLE: Realtime API WebSocket Connection
DESCRIPTION: Establishes a WebSocket connection for the Realtime API to build low-latency, multi-modal conversational experiences. It supports text and audio input/output and function calling.

SOURCE: https://github.com/openai/openai-node/blob/master/README.md#_snippet_12

LANGUAGE: ts
CODE:

```
import { OpenAIRealtimeWebSocket } from 'openai/beta/realtime/websocket';

const rt = new OpenAIRealtimeWebSocket({ model: 'gpt-4o-realtime-preview-2024-12-17' });

rt.on('response.text.delta', (event) => process.stdout.write(event.delta));
```

---

TITLE: OpenAI Fine-Tuning Jobs API
DESCRIPTION: Manages fine-tuning jobs for custom model training. This includes creating, retrieving, listing, canceling, pausing, and resuming fine-tuning jobs, as well as managing job events and checkpoints.

SOURCE: https://github.com/openai/openai-node/blob/master/api.md#_snippet_11

LANGUAGE: APIDOC
CODE:

```
DpoHyperparameters:
  - Hyperparameters specific to Direct Preference Optimization (DPO).

DpoMethod:
  - Configuration for DPO fine-tuning.

ReinforcementHyperparameters:
  - Hyperparameters for reinforcement learning-based fine-tuning.

ReinforcementMethod:
  - Configuration for reinforcement learning fine-tuning.

SupervisedHyperparameters:
  - Hyperparameters for supervised fine-tuning.

SupervisedMethod:
  - Configuration for supervised fine-tuning.

FineTuningJob:
  - Represents a fine-tuning job.

FineTuningJobEvent:
  - Represents an event in the lifecycle of a fine-tuning job.

FineTuningJobWandbIntegration:
  - Configuration for Weights & Biases integration.

FineTuningJobWandbIntegrationObject:
  - Object for Wandb integration details.

FineTuningJobIntegration:
  - General integration settings for fine-tuning jobs.

FineTuningJobsPage:
  - Paginated response for listing fine-tuning jobs.

FineTuningJobCheckpointsPage:
  - Paginated response for listing fine-tuning job checkpoints.

client.fineTuning.jobs.create({ ...params }) -> FineTuningJob
  - Method: POST
  - Endpoint: /fine_tuning/jobs
  - Description: Creates a new fine-tuning job.
  - Parameters:
    - params: An object containing the fine-tuning job configuration.
  - Returns: A FineTuningJob object representing the created job.

client.fineTuning.jobs.retrieve(fineTuningJobID) -> FineTuningJob
  - Method: GET
  - Endpoint: /fine_tuning/jobs/{fine_tuning_job_id}
  - Description: Retrieves a specific fine-tuning job by its ID.
  - Parameters:
    - fineTuningJobID: The ID of the fine-tuning job to retrieve.
  - Returns: A FineTuningJob object.

client.fineTuning.jobs.list({ ...params }) -> FineTuningJobsPage
  - Method: GET
  - Endpoint: /fine_tuning/jobs
  - Description: Retrieves a list of fine-tuning jobs.
  - Parameters:
    - params: Optional parameters for filtering and pagination.
  - Returns: A FineTuningJobsPage object.

client.fineTuning.jobs.cancel(fineTuningJobID) -> FineTuningJob
  - Method: POST
  - Endpoint: /fine_tuning/jobs/{fine_tuning_job_id}/cancel
  - Description: Cancels a fine-tuning job.
  - Parameters:
    - fineTuningJobID: The ID of the fine-tuning job to cancel.
  - Returns: A FineTuningJob object reflecting the canceled state.

client.fineTuning.jobs.listEvents(fineTuningJobID, { ...params }) -> FineTuningJobEventsPage
  - Method: GET
  - Endpoint: /fine_tuning/jobs/{fine_tuning_job_id}/events
  - Description: Retrieves events for a specific fine-tuning job.
  - Parameters:
    - fineTuningJobID: The ID of the fine-tuning job.
    - params: Optional parameters for filtering and pagination.
  - Returns: A FineTuningJobEventsPage object.

client.fineTuning.jobs.pause(fineTuningJobID) -> FineTuningJob
  - Method: POST
  - Endpoint: /fine_tuning/jobs/{fine_tuning_job_id}/pause
  - Description: Pauses a fine-tuning job.
  - Parameters:
    - fineTuningJobID: The ID of the fine-tuning job to pause.
  - Returns: A FineTuningJob object reflecting the paused state.

client.fineTuning.jobs.resume(fineTuningJobID) -> FineTuningJob
  - Method: POST
  - Endpoint: /fine_tuning/jobs/{fine_tuning_job_id}/resume
  - Description: Resumes a paused fine-tuning job.
  - Parameters:
    - fineTuningJobID: The ID of the fine-tuning job to resume.
  - Returns: A FineTuningJob object reflecting the resumed state.

client.fineTuning.jobs.checkpoints.list(fineTuningJobID, { ...params }) -> FineTuningJobCheckpointsPage
  - Method: GET
  - Endpoint: /fine_tuning/jobs/{fine_tuning_job_id}/checkpoints
  - Description: Retrieves checkpoints for a specific fine-tuning job.
  - Parameters:
    - fineTuningJobID: The ID of the fine-tuning job.
    - params: Optional parameters for filtering and pagination.
  - Returns: A FineTuningJobCheckpointsPage object.
```

---

TITLE: Containers API
DESCRIPTION: Provides methods for managing containers. This includes creating new containers, retrieving details of a specific container, listing all containers, and deleting containers. Each method corresponds to a specific HTTP request to the /containers endpoint.

SOURCE: https://github.com/openai/openai-node/blob/master/api.md#_snippet_41

LANGUAGE: APIDOC
CODE:

```
Containers API:

Types:
  ContainerCreateResponse
  ContainerRetrieveResponse
  ContainerListResponse

Methods:
  create(params: object): ContainerCreateResponse
    Description: Creates a new container.
    Endpoint: POST /containers
    Parameters: params - Object containing parameters for container creation.
    Returns: ContainerCreateResponse - The response object for container creation.

  retrieve(containerID: string): ContainerRetrieveResponse
    Description: Retrieves details of a specific container.
    Endpoint: GET /containers/{container_id}
    Parameters:
      containerID: The ID of the container to retrieve.
    Returns: ContainerRetrieveResponse - The response object for container retrieval.

  list(params: object): ContainerListResponse
    Description: Lists all containers.
    Endpoint: GET /containers
    Parameters: params - Object containing parameters for listing containers.
    Returns: ContainerListResponse - The response object containing a list of containers.

  delete(containerID: string): void
    Description: Deletes a specific container.
    Endpoint: DELETE /containers/{container_id}
    Parameters:
      containerID: The ID of the container to delete.
    Returns: void
```

---

TITLE: OpenAI Audio Translations API
DESCRIPTION: Provides functionality for translating audio into English text. The `create` method takes audio data and returns the translated text.

SOURCE: https://github.com/openai/openai-node/blob/master/api.md#_snippet_7

LANGUAGE: APIDOC
CODE:

```
client.audio.translations.create({ ...params }) -> TranslationCreateResponse
  - Translates an audio file into English text.
  - Parameters:
    - params: An object containing translation parameters, such as the audio file and model.
```

---

TITLE: Handle Content Log Probabilities Completion
DESCRIPTION: Fired when all content log probabilities have been received. The `props` object contains the full list of token log probabilities for the content.

SOURCE: https://github.com/openai/openai-node/blob/master/helpers.md#_snippet_18

LANGUAGE: typescript
CODE:

```
runner.on('logprobs.content.done', (props: LogProbsContentDoneEvent) => {
  // Handle all content log probabilities
  console.log(props.content);
});
```

---

TITLE: Assistants API
DESCRIPTION: API methods for managing Assistants, including creation, retrieval, update, listing, and deletion. Supports various Assistant types and stream events.

SOURCE: https://github.com/openai/openai-node/blob/master/api.md#_snippet_23

LANGUAGE: APIDOC
CODE:

```
POST /assistants

client.beta.assistants.create({ ...params }) -> Assistant

Description:
  Creates a new Assistant.

Parameters:
  ...params: An object containing parameters for Assistant creation.

Returns:
  Assistant: An object representing the created Assistant.
```

LANGUAGE: APIDOC
CODE:

```
GET /assistants/{assistant_id}

client.beta.assistants.retrieve(assistantID) -> Assistant

Description:
  Retrieves an existing Assistant.

Parameters:
  assistantID: The ID of the Assistant to retrieve.

Returns:
  Assistant: An object representing the retrieved Assistant.
```

LANGUAGE: APIDOC
CODE:

```
POST /assistants/{assistant_id}

client.beta.assistants.update(assistantID, { ...params }) -> Assistant

Description:
  Updates an existing Assistant.

Parameters:
  assistantID: The ID of the Assistant to update.
  ...params: An object containing parameters to update the Assistant.

Returns:
  Assistant: An object representing the updated Assistant.
```

LANGUAGE: APIDOC
CODE:

```
GET /assistants

client.beta.assistants.list({ ...params }) -> AssistantsPage

Description:
  Lists existing Assistants.

Parameters:
  ...params: An object containing parameters for filtering the list.

Returns:
  AssistantsPage: An object containing a list of Assistants.
```

LANGUAGE: APIDOC
CODE:

```
DELETE /assistants/{assistant_id}

client.beta.assistants.delete(assistantID) -> AssistantDeleted

Description:
  Deletes an existing Assistant.

Parameters:
  assistantID: The ID of the Assistant to delete.

Returns:
  AssistantDeleted: An object indicating the deletion status.
```

---

TITLE: Vector Store File Batches API
DESCRIPTION: Manages batches of files within a vector store, allowing for creation, retrieval, cancellation, and listing of files within a batch.

SOURCE: https://github.com/openai/openai-node/blob/master/api.md#_snippet_17

LANGUAGE: APIDOC
CODE:

```
client.vectorStores.fileBatches.create(vectorStoreID, { ...params }) -> VectorStoreFileBatch
  POST /vector_stores/{vector_store_id}/file_batches
  Creates a new batch of files for a vector store.
  Parameters:
    - vectorStoreID: The ID of the vector store.
    - params: An object containing batch creation parameters.
  Returns: A VectorStoreFileBatch object.

client.vectorStores.fileBatches.retrieve(batchID, { ...params }) -> VectorStoreFileBatch
  GET /vector_stores/{vector_store_id}/file_batches/{batch_id}
  Retrieves a specific file batch.
  Parameters:
    - batchID: The ID of the file batch to retrieve.
    - params: An object for retrieving batch details.
  Returns: A VectorStoreFileBatch object.

client.vectorStores.fileBatches.cancel(batchID, { ...params }) -> VectorStoreFileBatch
  POST /vector_stores/{vector_store_id}/file_batches/{batch_id}/cancel
  Cancels a file batch.
  Parameters:
    - batchID: The ID of the file batch to cancel.
    - params: An object for cancellation parameters.
  Returns: The updated VectorStoreFileBatch object.

client.vectorStores.fileBatches.listFiles(batchID, { ...params }) -> VectorStoreFilesPage
  GET /vector_stores/{vector_store_id}/file_batches/{batch_id}/files
  Lists all files within a specific file batch.
  Parameters:
    - batchID: The ID of the file batch.
    - params: An object for pagination and filtering.
  Returns: A VectorStoreFilesPage object.
```

---

TITLE: Generate Text using Chat Completions API
DESCRIPTION: Generates text using the OpenAI API's Chat Completions API, a standard method for text generation. Requires an API key and defines messages for the conversation.

SOURCE: https://github.com/openai/openai-node/blob/master/README.md#_snippet_4

LANGUAGE: typescript
CODE:

```
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env['OPENAI_API_KEY'], // This is the default and can be omitted
});

const completion = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [
    { role: 'developer', content: 'Talk like a pirate.' },
    { role: 'user', content: 'Are semicolons optional in JavaScript?' },
  ],
});

console.log(completion.choices[0].message.content);
```

---

TITLE: OpenAI Batches API
DESCRIPTION: Enables the creation and management of batches of requests to OpenAI. Allows for asynchronous processing of multiple tasks.

SOURCE: https://github.com/openai/openai-node/blob/master/api.md#_snippet_28

LANGUAGE: APIDOC
CODE:

```
Batches API:

Types:
  Batch
  BatchError
  BatchRequestCounts

Methods:
  create(params) -> Batch
    POST /batches
    Creates a new batch of requests.

  retrieve(batchID) -> Batch
    GET /batches/{batch_id}
    Retrieves a specific batch by its ID.

  list(params) -> BatchesPage
    GET /batches
    Lists all available batches.

  cancel(batchID) -> Batch
    POST /batches/{batch_id}/cancel
    Cancels a running batch.
```

---

TITLE: OpenAI Runs API
DESCRIPTION: Provides methods for managing assistant runs within threads. This includes creating new runs, retrieving run details, updating run configurations, listing all runs for a thread, canceling active runs, and submitting tool outputs. It also offers convenience methods for polling and streaming run statuses.

SOURCE: https://github.com/openai/openai-node/blob/master/api.md#_snippet_25

LANGUAGE: APIDOC
CODE:

```
client.beta.threads.runs.create(threadID, { ...params })
  - POST /threads/{thread_id}/runs
  - Creates a new run for a thread.
  - Parameters:
    - threadID: The ID of the thread to create the run for.
    - params: An object containing run creation parameters (e.g., assistant_id, model, instructions).
  - Returns: Run object.

client.beta.threads.runs.retrieve(runID, { ...params })
  - GET /threads/{thread_id}/runs/{run_id}
  - Retrieves a specific run by its ID.
  - Parameters:
    - runID: The ID of the run to retrieve.
    - params: Optional parameters.
  - Returns: Run object.

client.beta.threads.runs.update(runID, { ...params })
  - POST /threads/{thread_id}/runs/{run_id}
  - Updates a run.
  - Parameters:
    - runID: The ID of the run to update.
    - params: An object containing parameters to update (e.g., metadata).
  - Returns: Run object.

client.beta.threads.runs.list(threadID, { ...params })
  - GET /threads/{thread_id}/runs
  - Lists runs for a thread.
  - Parameters:
    - threadID: The ID of the thread whose runs to list.
    - params: Optional parameters for pagination and filtering.
  - Returns: RunsPage object.

client.beta.threads.runs.cancel(runID, { ...params })
  - POST /threads/{thread_id}/runs/{run_id}/cancel
  - Cancels a run that is currently in progress.
  - Parameters:
    - runID: The ID of the run to cancel.
    - params: Optional parameters.
  - Returns: Run object.

client.beta.threads.runs.submitToolOutputs(runID, { ...params })
  - POST /threads/{thread_id}/runs/{run_id}/submit_tool_outputs
  - Submits tool outputs to a run.
  - Parameters:
    - runID: The ID of the run to submit outputs to.
    - params: An object containing tool_outputs.
  - Returns: Run object.

client.beta.threads.runs.createAndPoll(threadId, body, options?)
  - Creates a run and polls for its completion.
  - Parameters:
    - threadId: The ID of the thread.
    - body: The run creation body.
    - options: Optional polling configurations.
  - Returns: Promise<Run>.

client.beta.threads.runs.createAndStream(threadId, body, options?)
  - Creates a run and streams its events.
  - Parameters:
    - threadId: The ID of the thread.
    - body: The run creation body.
    - options: Optional streaming configurations.
  - Returns: AssistantStream.

client.beta.threads.runs.poll(threadId, runId, options?)
  - Polls for the completion of a run.
  - Parameters:
    - threadId: The ID of the thread.
    - runId: The ID of the run.
    - options: Optional polling configurations.
  - Returns: Promise<Run>.

client.beta.threads.runs.stream(threadId, body, options?)
  - Streams events for a run.
  - Parameters:
    - threadId: The ID of the thread.
    - body: The run creation body.
    - options: Optional streaming configurations.
  - Returns: AssistantStream.

client.beta.threads.runs.submitToolOutputsAndPoll(threadId, runId, body, options?)
  - Submits tool outputs and polls for run completion.
  - Parameters:
    - threadId: The ID of the thread.
    - runId: The ID of the run.
    - body: The tool outputs body.
    - options: Optional polling configurations.
  - Returns: Promise<Run>.

client.beta.threads.runs.submitToolOutputsStream(threadId, runId, body, options?)
  - Submits tool outputs and streams run events.
  - Parameters:
    - threadId: The ID of the thread.
    - runId: The ID of the run.
    - body: The tool outputs body.
    - options: Optional streaming configurations.
  - Returns: AssistantStream.
```

---

TITLE: Auto-parsing function tool calls with Zod
DESCRIPTION: Illustrates how to automatically parse function tool calls using the `client.chat.completions.parse()` method with the `zodFunction()` helper. This requires defining Zod schemas for the function parameters and marking the tool schema with `"strict": True`.

SOURCE: https://github.com/openai/openai-node/blob/master/helpers.md#_snippet_1

LANGUAGE: typescript
CODE:

```
import { zodFunction } from 'openai/helpers/zod';
import OpenAI from 'openai/index';
import { z } from 'zod';

const Table = z.enum(['orders', 'customers', 'products']);

const Column = z.enum([
  'id',
  'status',
  'expected_delivery_date',
  'delivered_at',
  'shipped_at',
  'ordered_at',
  'canceled_at',
]);

const Operator = z.enum(['=', '>', '<', '<=', '>=', '!=']);

const OrderBy = z.enum(['asc', 'desc']);

const DynamicValue = z.object({
  column_name: z.string(),
});

const Condition = z.object({
  column: z.string(),
  operator: Operator,
  value: z.union([z.string(), z.number(), DynamicValue]),
});

const Query = z.object({
  table_name: Table,
  columns: z.array(Column),
  conditions: z.array(Condition),
  order_by: OrderBy,
});

const client = new OpenAI();
const completion = await client.chat.completions.parse({
  model: 'gpt-4o-2024-08-06',
  messages: [
    {
      role: 'system',
      content:
        'You are a helpful assistant. The current date is August 6, 2024. You help users query for the data they are looking for by calling the query function.',
    },
    {
      role: 'user',
      content: 'look up all my orders in november of last year that were fulfilled but not delivered on time',
    },
  ],
  tools: [zodFunction({ name: 'query', parameters: Query })],
});
console.dir(completion, { depth: 10 });

const toolCall = completion.choices[0]?.message.tool_calls?.[0];
if (toolCall) {
  const args = toolCall.function.parsed_arguments as z.infer<typeof Query>;
  console.log(args);
  console.log(args.table_name);
}

main();
```

---

TITLE: OpenAI Audio Speech API
DESCRIPTION: Converts text into spoken audio. The `create` method takes text and other parameters to generate audio output.

SOURCE: https://github.com/openai/openai-node/blob/master/api.md#_snippet_8

LANGUAGE: APIDOC
CODE:

```
client.audio.speech.create({ ...params }) -> Response
  - Converts text to speech.
  - Parameters:
    - params: An object containing speech synthesis parameters, such as the input text, model, and voice.
```

---

TITLE: Manage Container Files with OpenAI Node.js Client
DESCRIPTION: This section outlines the API for managing files within specific containers. It includes methods for uploading new files, retrieving file details, listing files in a container, and deleting files. Dependencies include the OpenAI Node.js client library.

SOURCE: https://github.com/openai/openai-node/blob/master/api.md#_snippet_69

LANGUAGE: APIDOC
CODE:

```
Types:
  - FileCreateResponse
  - FileRetrieveResponse
  - FileListResponse
```

LANGUAGE: APIDOC
CODE:

```
client.containers.files.create(containerID, { ...params }) -> FileCreateResponse
  Method: POST /containers/{container_id}/files
  Description: Uploads a new file to a container.
  Parameters:
    - containerID: string (ID of the container)

client.containers.files.retrieve(fileID, { ...params }) -> FileRetrieveResponse
  Method: GET /containers/{container_id}/files/{file_id}
  Description: Retrieves details for a specific file within a container.
  Parameters:
    - fileID: string (ID of the file to retrieve)

client.containers.files.list(containerID, { ...params }) -> FileListResponsesPage
  Method: GET /containers/{container_id}/files
  Description: Lists all files within a container.
  Parameters:
    - containerID: string (ID of the container)

client.containers.files.delete(fileID, { ...params }) -> void
  Method: DELETE /containers/{container_id}/files/{file_id}
  Description: Deletes a specific file from a container.
  Parameters:
    - fileID: string (ID of the file to delete)
```

---

TITLE: Assistant Stream Helper Methods
DESCRIPTION: Provides convenient methods to access additional context from assistant stream events. These methods might return undefined if no relevant context is available.

SOURCE: https://github.com/openai/openai-node/blob/master/helpers.md#_snippet_5

LANGUAGE: ts
CODE:

```
await .currentEvent(): AssistantStreamEvent | undefined

await .currentRun(): Run | undefined

await .currentMessageSnapshot(): Message

await .currentRunStepSnapshot(): Runs.RunStep
```

---

TITLE: Bulk File Upload and Polling
DESCRIPTION: Uploads multiple files to a vector store in bulk and polls for the completion status of the operation. This helper simplifies the process of managing multiple file uploads simultaneously.

SOURCE: https://github.com/openai/openai-node/blob/master/helpers.md#_snippet_17

LANGUAGE: ts
CODE:

```
const fileList = [
  createReadStream('/home/data/example.pdf'),
  ...
];

const batch = await openai.vectorStores.fileBatches.uploadAndPoll(vectorStore.id, {files: fileList});
```

---

TITLE: Add Node.js API: Support for `gpt-4.5-preview` Model
DESCRIPTION: This feature introduces support for the new `gpt-4.5-preview` model within the OpenAI Node.js client. Developers can now specify and utilize this advanced model for their AI applications, leveraging its capabilities for improved performance or specific tasks. This expands the range of available models for chat completions and other AI operations.

SOURCE: https://github.com/openai/openai-node/blob/master/CHANGELOG.md#_snippet_57

LANGUAGE: APIDOC
CODE:

```
// API Model Support: gpt-4.5-preview
// Description: New model available for use with OpenAI API calls.
// Usage Example (Node.js):
// const completion = await openai.chat.completions.create({
//   model: "gpt-4.5-preview",
//   messages: [{ role: "user", content: "Hello world" }],
// });
```

---

TITLE: Publish OpenAI Node.js Client to JSR
DESCRIPTION: This significant feature enables publishing the OpenAI Node.js client library to JSR (JavaScript Registry). This makes the library more accessible and discoverable for Deno and other JavaScript environments. It expands the distribution channels for the client.

SOURCE: https://github.com/openai/openai-node/blob/master/CHANGELOG.md#_snippet_100

LANGUAGE: APIDOC
CODE:

```
Feature: Distribution
Component: Publishing
Target: JSR (JavaScript Registry)
Change Type: New Distribution Channel
Details: Enabled publishing of the client library to JSR.
Impact: Increased accessibility and discoverability for Deno users.
```

---

TITLE: Initialize AzureOpenAI Client
DESCRIPTION: Demonstrates how to initialize the AzureOpenAI client using Azure AD token provider for authentication with Azure OpenAI services. It requires the `@azure/identity` package for credential management.

SOURCE: https://github.com/openai/openai-node/blob/master/azure.md#_snippet_0

LANGUAGE: ts
CODE:

```
import { AzureOpenAI } from 'openai';
import { getBearerTokenProvider, DefaultAzureCredential } from '@azure/identity';

const credential = new DefaultAzureCredential();
const scope = 'https://cognitiveservices.azure.com/.default';
const azureADTokenProvider = getBearerTokenProvider(credential, scope);

const openai = new AzureOpenAI({
  azureADTokenProvider,
  apiVersion: '<The API version, e.g. 2024-10-01-preview>',
});

const result = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Say hello!' }],
});

console.log(result.choices[0]!.message?.content);
```

---

TITLE: Transcription Sessions API
DESCRIPTION: API methods for creating and managing transcription sessions. This includes creating a new transcription session and returning a TranscriptionSession.

SOURCE: https://github.com/openai/openai-node/blob/master/api.md#_snippet_22

LANGUAGE: APIDOC
CODE:

```
POST /realtime/transcription_sessions

client.beta.realtime.transcriptionSessions.create({ ...params }) -> TranscriptionSession

Description:
  Creates a new transcription session.

Parameters:
  ...params: An object containing parameters for transcription session creation.

Returns:
  TranscriptionSession: An object representing the created transcription session.
```

---

TITLE: Chore: Move GitHub Release Logic to GitHub App in OpenAI Node.js CI
DESCRIPTION: This chore migrates the GitHub release logic to a dedicated GitHub App. This improves the automation and security of the release process within the Continuous Integration pipeline.

SOURCE: https://github.com/openai/openai-node/blob/master/CHANGELOG.md#_snippet_139

LANGUAGE: APIDOC
CODE:

```
Moved GitHub release logic to GitHub App.
```

---

TITLE: Enable Binary Returns for OpenAI Node.js Client
DESCRIPTION: Allows the OpenAI Node.js client to correctly handle and return binary data from API responses. This feature is crucial for endpoints that deliver non-textual content, such as audio or image files.

SOURCE: https://github.com/openai/openai-node/blob/master/CHANGELOG.md#_snippet_175

LANGUAGE: APIDOC
CODE:

```
The client now supports binary data in API responses. Specific methods or configurations may be available to access or process these binary streams.

Example (conceptual):
const audioResponse = await openai.audio.speech.create({
  model: 'tts-1',
  voice: 'alloy',
  input: 'Hello world',
});

const audioBuffer = await audioResponse.arrayBuffer();
```

---

TITLE: Create OpenAI Response (Node.js Client)
DESCRIPTION: This method allows you to create a new response resource via the OpenAI Node.js client. It sends a POST request to the `/responses` endpoint. The method requires specific parameters to define the response content and behavior, returning a `Response` object upon successful creation.

SOURCE: https://github.com/openai/openai-node/blob/master/api.md#_snippet_47

LANGUAGE: TypeScript
CODE:

```
client.responses.create({ ...params }): Promise<Response>
```

LANGUAGE: APIDOC
CODE:

```
Method: client.responses.create
Endpoint: POST /responses
Description: Creates a new response resource.
Parameters:
  params: object (required) - Configuration for the response.
Returns:
  Response: The created response object.
```

---

TITLE: Documentation: Add CONTRIBUTING.md to OpenAI Node.js Project
DESCRIPTION: This documentation update adds a `CONTRIBUTING.md` file to the project. This file provides guidelines for developers who wish to contribute to the OpenAI Node.js library.

SOURCE: https://github.com/openai/openai-node/blob/master/CHANGELOG.md#_snippet_149

LANGUAGE: APIDOC
CODE:

```
Added `CONTRIBUTING.md` file.
```

---

TITLE: OpenAI Node.js Client Chat Methods
DESCRIPTION: This section documents the core chat methods available on the OpenAI Node.js client for managing chat interactions and streaming requests.

SOURCE: https://github.com/openai/openai-node/blob/master/helpers.md#_snippet_11

LANGUAGE: APIDOC
CODE:

```
abort()
  - Aborts the runner and the streaming request, equivalent to `.controller.abort()`.
  - Calling `.abort()` on a `ChatCompletionStreamingRunner` will also abort any in-flight network requests.

done(): Promise<void>
  - An empty promise which resolves when the stream is done.
```

---

TITLE: Generate Text using Responses API
DESCRIPTION: Generates text using the OpenAI API's Responses API. Requires an API key and specifies the model and instructions.

SOURCE: https://github.com/openai/openai-node/blob/master/README.md#_snippet_3

LANGUAGE: typescript
CODE:

```
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env['OPENAI_API_KEY'], // This is the default and can be omitted
});

const response = await client.responses.create({
  model: 'gpt-4o',
  instructions: 'You are a coding assistant that talks like a pirate',
  input: 'Are semicolons optional in JavaScript?',
});

console.log(response.output_text);
```

---

TITLE: OpenAI Tool and Tool Choice Definitions
DESCRIPTION: Defines the structures for tools and tool choices within the OpenAI API. This includes the general 'Tool' definition and specific types for tool choices like 'allowed', 'custom', 'function', 'mcp', and 'options'.

SOURCE: https://github.com/openai/openai-node/blob/master/api.md#_snippet_35

LANGUAGE: typescript
CODE:

```
Tool
ToolChoiceAllowed
ToolChoiceCustom
ToolChoiceFunction
ToolChoiceMcp
ToolChoiceOptions
ToolChoiceTypes
WebSearchTool
```

---

TITLE: Doc Readme: Fix Realtime Errors Docs Link
DESCRIPTION: This documentation fix updates an incorrect link to the realtime errors documentation within the README. It ensures users can easily navigate to the correct resource for troubleshooting realtime API issues.

SOURCE: https://github.com/openai/openai-node/blob/master/CHANGELOG.md#_snippet_83

LANGUAGE: Markdown
CODE:

```
Documentation: Updated the broken link to the 'realtime errors' documentation within the README file, ensuring users can access the correct resource.
```

---

TITLE: Vector Stores API
DESCRIPTION: Manages vector stores for semantic search and retrieval. Includes operations for creating, retrieving, updating, listing, deleting, and searching vector stores.

SOURCE: https://github.com/openai/openai-node/blob/master/api.md#_snippet_15

LANGUAGE: APIDOC
CODE:

```
Vector Stores API:

Types:
  AutoFileChunkingStrategyParam
  FileChunkingStrategy
  FileChunkingStrategyParam
  OtherFileChunkingStrategyObject
  StaticFileChunkingStrategy
  StaticFileChunkingStrategyObject
  StaticFileChunkingStrategyObjectParam
  VectorStore
  VectorStoreDeleted
  VectorStoreSearchResponse

Methods:
  create(params: object): VectorStore
    POST /vector_stores
    Creates a new vector store.

  retrieve(vectorStoreID: string): VectorStore
    GET /vector_stores/{vector_store_id}
    Retrieves a specific vector store by its ID.

  update(vectorStoreID: string, params: object): VectorStore
    POST /vector_stores/{vector_store_id}
    Updates an existing vector store.

  list(params: object): VectorStoresPage
    GET /vector_stores
    Lists all available vector stores.

  delete(vectorStoreID: string): VectorStoreDeleted
    DELETE /vector_stores/{vector_store_id}
    Deletes a vector store by its ID.

  search(vectorStoreID: string, params: object): VectorStoreSearchResponsesPage
    POST /vector_stores/{vector_store_id}/search
    Searches within a specific vector store.
```

---

TITLE: Configuring Request Timeouts
DESCRIPTION: Demonstrates how to set a default timeout for all requests or override it for individual requests. Requests that time out are retried twice by default.

SOURCE: https://github.com/openai/openai-node/blob/master/README.md#_snippet_15

LANGUAGE: ts
CODE:

```
// Configure the default for all requests:
const client = new OpenAI({
  timeout: 20 * 1000, // 20 seconds (default is 10 minutes)
});

// Override per-request:
await client.chat.completions.create({ messages: [{ role: 'user', content: 'How can I list all files in a directory using Python?' }], model: 'gpt-4o' }, {
  timeout: 5 * 1000,
});
```

---

TITLE: Chore: Add Internal Helpers and Improve Build Scripts in OpenAI Node.js
DESCRIPTION: This internal chore introduces new helper functions and enhances existing build scripts. These improvements streamline the development workflow and build process.

SOURCE: https://github.com/openai/openai-node/blob/master/CHANGELOG.md#_snippet_151

LANGUAGE: APIDOC
CODE:

```
Added internal helpers and improved build scripts.
```

---

TITLE: Enable Browser Support in OpenAI Node.js
DESCRIPTION: This snippet demonstrates how to enable browser support for the OpenAI Node.js library, which is disabled by default to protect API credentials. It highlights the `dangerouslyAllowBrowser` option and provides context on its security implications.

SOURCE: https://github.com/openai/openai-node/blob/master/README.md#_snippet_31

LANGUAGE: JavaScript
CODE:

```
import OpenAI from 'openai';

const openai = new OpenAI({
  // ... other options
  dangerouslyAllowBrowser: true
});
```

---

TITLE: Configuring Request Retries
DESCRIPTION: Shows how to configure the default number of retries for requests or override it on a per-request basis. Certain errors are automatically retried by default.

SOURCE: https://github.com/openai/openai-node/blob/master/README.md#_snippet_14

LANGUAGE: js
CODE:

```
// Configure the default for all requests:
const client = new OpenAI({
  maxRetries: 0, // default is 2
});

// Or, configure per-request:
await client.chat.completions.create({ messages: [{ role: 'user', content: 'How can I get the name of the current day in JavaScript?' }], model: 'gpt-4o' }, {
  maxRetries: 5,
});
```

---

TITLE: OpenAI Models API
DESCRIPTION: Provides methods for retrieving and listing available models, as well as deleting specific models. This allows users to manage and query the models available through the OpenAI API.

SOURCE: https://github.com/openai/openai-node/blob/master/api.md#_snippet_10

LANGUAGE: APIDOC
CODE:

```
Model:
  - Represents a single OpenAI model.

ModelDeleted:
  - Represents the response when a model is successfully deleted.

ModelsPage:
  - Represents a paginated list of models.

client.models.retrieve(model) -> Model
  - Method: GET
  - Endpoint: /models/{model}
  - Description: Retrieves a specific model by its ID.
  - Parameters:
    - model: The ID of the model to retrieve.
  - Returns: A Model object.

client.models.list() -> ModelsPage
  - Method: GET
  - Endpoint: /models
  - Description: Retrieves a list of available models.
  - Parameters: None.
  - Returns: A ModelsPage object containing a list of Model objects.

client.models.delete(model) -> ModelDeleted
  - Method: DELETE
  - Endpoint: /models/{model}
  - Description: Deletes a specific model by its ID.
  - Parameters:
    - model: The ID of the model to delete.
  - Returns: A ModelDeleted object indicating success.
```

---

TITLE: Add gpt-3.5-turbo-1106 Model to OpenAI API
DESCRIPTION: Documents the addition of the new `gpt-3.5-turbo-1106` model, expanding the range of available models for chat completions within the OpenAI API.

SOURCE: https://github.com/openai/openai-node/blob/master/CHANGELOG.md#_snippet_171

LANGUAGE: APIDOC
CODE:

```
Model Name: gpt-3.5-turbo-1106
Category: Chat Completion
Status: Newly Added
```

---

TITLE: Real-time Streaming with Azure OpenAI
DESCRIPTION: Shows how to set up real-time streaming capabilities for Azure OpenAI by passing a configured AzureOpenAI client to OpenAIRealtimeWS.azure. This enables receiving streaming responses in real time.

SOURCE: https://github.com/openai/openai-node/blob/master/azure.md#_snippet_1

LANGUAGE: ts
CODE:

```
const cred = new DefaultAzureCredential();
const scope = 'https://cognitiveservices.azure.com/.default';
const deploymentName = 'gpt-4o-realtime-preview-1001';
const azureADTokenProvider = getBearerTokenProvider(cred, scope);
const client = new AzureOpenAI({
  azureADTokenProvider,
  apiVersion: '2024-10-01-preview',
  deployment: deploymentName,
});
const rt = await OpenAIRealtimeWS.azure(client);
```

---

TITLE: Chore: Refactor Release Environment Script in OpenAI Node.js Internal
DESCRIPTION: This internal chore refactors the release environment script. This aims to improve the maintainability and efficiency of the release preparation process.

SOURCE: https://github.com/openai/openai-node/blob/master/CHANGELOG.md#_snippet_140

LANGUAGE: APIDOC
CODE:

```
Refactored internal release environment script.
```

---

TITLE: Chore: Pin Deno Version in OpenAI Node.js Internal
DESCRIPTION: This internal chore pins the Deno version used in the project. This ensures consistent build and test environments by preventing unexpected changes from newer Deno versions.

SOURCE: https://github.com/openai/openai-node/blob/master/CHANGELOG.md#_snippet_156

LANGUAGE: APIDOC
CODE:

```
Pinned Deno version for consistency.
```

---

TITLE: List Output Items for Eval Run in OpenAI Node.js Client
DESCRIPTION: This snippet shows how to retrieve a paginated list of output items for an evaluation run using the OpenAI Node.js client. It requires the `runID` and accepts optional parameters for filtering or pagination. The method returns an `OutputItemListResponsesPage` object.

SOURCE: https://github.com/openai/openai-node/blob/master/api.md#_snippet_67

LANGUAGE: TypeScript
CODE:

```
client.evals.runs.outputItems.list(runID, { ...params }) -> OutputItemListResponsesPage
```

---

TITLE: OpenAI Response Input Types
DESCRIPTION: Defines the various input structures for OpenAI API requests, including audio, content, files, images, messages, prompts, and text configurations. These types are crucial for formatting data sent to the API.

SOURCE: https://github.com/openai/openai-node/blob/master/api.md#_snippet_32

LANGUAGE: typescript
CODE:

```
ResponseInputAudio
ResponseInputContent
ResponseInputFile
ResponseInputImage
ResponseInputItem
ResponseInputMessageContentList
ResponseInputMessageItem
ResponseInputText
ResponsePrompt
ResponseTextConfig
```

---

TITLE: Create an Eval Run in OpenAI Node.js Client
DESCRIPTION: This snippet demonstrates how to create a new run for a specific evaluation using the OpenAI Node.js client. It requires the `evalID` and a set of parameters defining the run's configuration. The method returns a `RunCreateResponse` object upon successful creation.

SOURCE: https://github.com/openai/openai-node/blob/master/api.md#_snippet_60

LANGUAGE: TypeScript
CODE:

```
client.evals.runs.create(evalID, { ...params }) -> RunCreateResponse
```

---

TITLE: Alpha Graders API
DESCRIPTION: Provides access to alpha features related to graders, including running and validating grader configurations. These methods are experimental and may change.

SOURCE: https://github.com/openai/openai-node/blob/master/api.md#_snippet_13

LANGUAGE: APIDOC
CODE:

```
Alpha Graders API:

Types:
  GraderRunResponse
  GraderValidateResponse

Methods:
  run(params: object): GraderRunResponse
    POST /fine_tuning/alpha/graders/run
    Runs a grader configuration.

  validate(params: object): GraderValidateResponse
    POST /fine_tuning/alpha/graders/validate
    Validates a grader configuration.
```

---

TITLE: Chat Completion Methods
DESCRIPTION: Provides methods to retrieve various aspects of a chat completion, such as the final response, all responses, content, messages, function calls, and usage statistics. Some methods may throw errors if the expected data is not found.

SOURCE: https://github.com/openai/openai-node/blob/master/helpers.md#_snippet_12

LANGUAGE: APIDOC
CODE:

```
finalChatCompletion()
  - Returns a promise that resolves with the final chat completion.
  - Throws if the request ends before a complete chat completion is returned.

allChatCompletions()
  - Returns a promise that resolves with an array of all chat completions received from the API.

finalContent()
  - Returns a promise that resolves with the content of the last 'role: "assistant"' message.
  - Throws if no such message is found.

finalMessage()
  - Returns a promise that resolves with the last message.

finalFunctionCall()
  - Returns a promise that resolves with the last message that has a defined 'function_call'.
  - Throws if no such message is found.

finalFunctionCallResult()
  - Returns a promise that resolves with the last message with 'role: "function"'.
  - Throws if no such message is found.

totalUsage()
  - Returns a promise that resolves with the total usage.
  - Note: Usage is not reported with 'stream'.
```

---

TITLE: OpenAI Embeddings API
DESCRIPTION: Handles the creation of embeddings for text. The `create` method takes an object with parameters to generate embeddings and returns a `CreateEmbeddingResponse`.

SOURCE: https://github.com/openai/openai-node/blob/master/api.md#_snippet_3

LANGUAGE: APIDOC
CODE:

```
client.embeddings.create({ ...params }) -> CreateEmbeddingResponse
  - Creates embeddings for the provided text.
  - Parameters:
    - params: An object containing embedding parameters, such as input text and model.
```

---

TITLE: OpenAI Node.js: Add gpt-3.5-turbo-instruct Model & Refine Error Objects
DESCRIPTION: This update introduces the new 'gpt-3.5-turbo-instruct' model for text completion tasks. It also includes refinements to error objects, providing more detailed information upon API failures. Users should update their client to access the new model and benefit from improved error handling.

SOURCE: https://github.com/openai/openai-node/blob/master/CHANGELOG.md#_snippet_183

LANGUAGE: APIDOC
CODE:

```
// New Model Availability
Model: "gpt-3.5-turbo-instruct"
Description: "A new model for text completion, optimized for instruction-following tasks."

// Conceptual Error Object Refinements (based on common API error structures)
interface OpenAIAPIError {
  message: string;
  type?: string;
  param?: string;
  code?: string;
  // Note: 'status' field is explicitly added in a later feature (4.8.0)
  // but conceptually part of error object refinement.
}
```

---

TITLE: OpenAI Files API
DESCRIPTION: Manages file uploads and retrieval. Supports creating, retrieving, listing, deleting files, and accessing their content. Includes a utility method `waitForProcessing` to poll for file processing status.

SOURCE: https://github.com/openai/openai-node/blob/master/api.md#_snippet_4

LANGUAGE: APIDOC
CODE:

```
client.files.create({ ...params }) -> FileObject
  - Uploads a file to OpenAI.
  - Parameters:
    - params: An object containing file details, including the file data and purpose.
```

LANGUAGE: APIDOC
CODE:

```
client.files.retrieve(fileID) -> FileObject
  - Retrieves a specific file by its ID.
  - Parameters:
    - fileID: The ID of the file to retrieve.
```

LANGUAGE: APIDOC
CODE:

```
client.files.list({ ...params }) -> FileObjectsPage
  - Lists all files associated with the account.
  - Parameters:
    - params: Optional parameters for filtering or pagination.
```

LANGUAGE: APIDOC
CODE:

```
client.files.delete(fileID) -> FileDeleted
  - Deletes a file by its ID.
  - Parameters:
    - fileID: The ID of the file to delete.
```

LANGUAGE: APIDOC
CODE:

```
client.files.content(fileID) -> Response
  - Retrieves the content of a specific file.
  - Parameters:
    - fileID: The ID of the file whose content is to be retrieved.
```

LANGUAGE: APIDOC
CODE:

```
client.files.waitForProcessing(id, { pollInterval = 5000, maxWait = 30 * 60 * 1000 }) -> Promise<FileObject>
  - Polls for the processing status of a file.
  - Parameters:
    - id: The ID of the file.
    - pollInterval: The interval in milliseconds to check the status (defaults to 5000ms).
    - maxWait: The maximum time in milliseconds to wait for processing (defaults to 30 minutes).
```

---

TITLE: Fix Release Please Configuration for JSR.json
DESCRIPTION: This bug fix addresses an issue with the release-please configuration specifically for the `jsr.json` file. Correcting this configuration ensures proper versioning and publishing to JSR (JavaScript Registry). This is crucial for consistent releases.

SOURCE: https://github.com/openai/openai-node/blob/master/CHANGELOG.md#_snippet_94

LANGUAGE: APIDOC
CODE:

```
Bug Fix: Build/Release Configuration
Component: Release Please
File: jsr.json
Change Type: Configuration Adjustment
Details: Corrected release-please configuration for jsr.json.
Impact: Ensures correct publishing to JSR.
```

---

TITLE: Polling Helper Functions
DESCRIPTION: Details the SDK's polling helper functions designed for asynchronous operations that require monitoring status until a terminal state is reached. These functions append `_AndPoll` to the original method names and allow configuration of polling intervals.

SOURCE: https://github.com/openai/openai-node/blob/master/helpers.md#_snippet_16

LANGUAGE: APIDOC
CODE:

```
client.beta.threads.createAndRunPoll(...)
client.beta.threads.runs.createAndPoll(...)
client.beta.threads.runs.submitToolOutputsAndPoll(...)
client.beta.vectorStores.files.uploadAndPoll(...)
client.beta.vectorStores.files.createAndPoll(...)
client.beta.vectorStores.fileBatches.createAndPoll(...)
client.beta.vectorStores.fileBatches.uploadAndPoll(...)

All polling methods accept an optional `pollIntervalMs` argument to configure the polling frequency.
```

---

TITLE: OpenAI Input Items API
DESCRIPTION: Provides methods for listing input items associated with a response. This interacts with the /responses/{response_id}/input_items endpoint.

SOURCE: https://github.com/openai/openai-node/blob/master/api.md#_snippet_37

LANGUAGE: APIDOC
CODE:

```
GET /responses/{response_id}/input_items
  client.responses.inputItems.list(responseID, { ...params })
  Lists input items for a given response.
  Parameters:
    - responseID: The ID of the response.
    - params: Object containing parameters for listing input items.
  Returns:
    - ResponseItemsPage: A page of input items.
```

---

TITLE: Handle 204 No Content Gracefully (Node.js)
DESCRIPTION: The client now gracefully handles HTTP 204 No Content responses from the API. This ensures that operations resulting in no content are processed without errors, improving robustness.

SOURCE: https://github.com/openai/openai-node/blob/master/CHANGELOG.md#_snippet_179

LANGUAGE: APIDOC
CODE:

```
The client now correctly processes API responses with a 204 No Content status code, preventing errors when an operation successfully completes without returning a body.
```

---

TITLE: Handle Refusal Log Probabilities Deltas
DESCRIPTION: Fired when a chunk contains new log probabilities for a refusal. The `props` object includes `refusal` (new log probabilities) and `snapshot` (accumulated log probabilities).

SOURCE: https://github.com/openai/openai-node/blob/master/helpers.md#_snippet_19

LANGUAGE: typescript
CODE:

```
runner.on('logprobs.refusal.delta', (props: LogProbsRefusalDeltaEvent) => {
  // Process new log probabilities for refusal
  console.log(props.refusal);
});
```

---

TITLE: Fix Assistants: Handle Incomplete Thread Run Event
DESCRIPTION: This fix ensures the client library correctly processes and handles the 'thread.run.incomplete' event within the Assistants API. It improves the robustness of event handling for assistant runs that do not complete successfully.

SOURCE: https://github.com/openai/openai-node/blob/master/CHANGELOG.md#_snippet_69

LANGUAGE: TypeScript
CODE:

```
Assistants API: Implemented specific handling for the 'thread.run.incomplete' event to ensure proper state management and error reporting when an assistant run does not reach a terminal success state.
```

---

TITLE: OpenAI Node.js Client Event Listeners
DESCRIPTION: This section documents the event listeners available on the OpenAI Node.js client for handling streaming responses. It covers events for function call results, content deltas and completion, refusal deltas and completion, tool call arguments, log probabilities, and final completion details.

SOURCE: https://github.com/openai/openai-node/blob/master/helpers.md#_snippet_10

LANGUAGE: APIDOC
CODE:

```
functionCallResult(content: string)
  - Fired when the function runner responds to a function call with `role: "function"`.
  - `content`: The content of the response.

content.delta(props: ContentDeltaEvent)
  - Fired for every chunk containing new content.
  - `props.delta`: The new content string received in this chunk.
  - `props.snapshot`: The accumulated content so far.
  - `props.parsed`: The partially parsed content (if applicable).

content.done(props: ContentDoneEvent<ParsedT>)
  - Fired when the content generation is complete.
  - `props.content`: The full generated content.
  - `props.parsed`: The fully parsed content (if applicable).

refusal.delta(props: RefusalDeltaEvent)
  - Fired when a chunk contains part of a content refusal.
  - `props.delta`: The new refusal content string received in this chunk.
  - `props.snapshot`: The accumulated refusal content string so far.

refusal.done(props: RefusalDoneEvent)
  - Fired when the refusal content is complete.
  - `props.refusal`: The full refusal content.

tool_calls.function.arguments.delta(props: FunctionToolCallArgumentsDeltaEvent)
  - Fired when a chunk contains part of a function tool call's arguments.
  - `props.name`: The name of the function being called.
  - `props.index`: The index of the tool call.
  - `props.arguments`: The accumulated raw JSON string of arguments.
  - `props.parsed_arguments`: The partially parsed arguments object.
  - `props.arguments_delta`: The new JSON string fragment received in this chunk.

tool_calls.function.arguments.done(props: FunctionToolCallArgumentsDoneEvent)
  - Fired when a function tool call's arguments are complete.
  - `props.name`: The name of the function being called.
  - `props.index`: The index of the tool call.
  - `props.arguments`: The full raw JSON string of arguments.
  - `props.parsed_arguments`: The fully parsed arguments object.

logprobs.content.delta(props: LogProbsContentDeltaEvent)
  - Fired when a chunk contains new content log probabilities.
  - `props.content`: A list of the new log probabilities received in this chunk.
  - `props.snapshot`: A list of the accumulated log probabilities so far.

logprobs.content.done(props: LogProbsContentDoneEvent)
  - Fired when all content log probabilities have been received.
  - `props.content`: The full list of token log probabilities for the content.

logprobs.refusal.delta(props: LogProbsRefusalDeltaEvent)
  - Fired when a chunk contains new refusal log probabilities.
  - `props.refusal`: A list of the new log probabilities received in this chunk.
  - `props.snapshot`: A list of the accumulated log probabilities so far.

logprobs.refusal.done(props: LogProbsRefusalDoneEvent)
  - Fired when all refusal log probabilities have been received.
  - `props.refusal`: The full list of token log probabilities for the refusal.

finalChatCompletion(completion: ChatCompletion)
  - Fired for the final chat completion. If the function call runner exceeds `maxChatCompletions`, the last completion is given.

finalContent(contentSnapshot: string)
  - Fired for the `content` of the last `role: "assistant"` message. Not fired if there is no `assistant` message.

finalMessage(message: ChatCompletionMessage)
  - Fired for the last message.

finalFunctionCall(functionCall: ChatCompletionMessage.FunctionCall)
  - Fired for the last message with a defined `function_call`.

finalFunctionCallResult(content: string)
  - Fired for the last message with a `role: "function"`.

error(error: OpenAIError)
  - Fired when an error is encountered outside of a `parse` function or an abort.

abort(error: APIUserAbortError)
  - Fired when the stream receives a signal to abort.

totalUsage(usage: CompletionUsage)
  - Fired at the end, returning the total usage of the call. (Usage is not reported with `stream` without `totalUsage` enabled).

end()
  - The last event fired in the stream.
```

---

TITLE: Add Bundle Size Badge to OpenAI Node.js README
DESCRIPTION: Adds a bundle size badge to the project's README file. This provides a quick visual indicator of the library's size, helping developers assess its impact on their application's bundle, especially for web-based projects.

SOURCE: https://github.com/openai/openai-node/blob/master/CHANGELOG.md#_snippet_117

LANGUAGE: Markdown
CODE:

```
Documentation: README now includes a bundle size badge.
```

---

TITLE: Add SECURITY.md to OpenAI Node.js Repository
DESCRIPTION: Adds a SECURITY.md file to the repository. This document outlines the project's security policy, including how to report vulnerabilities and what steps are taken to ensure the security of the OpenAI Node.js library, enhancing transparency and trust.

SOURCE: https://github.com/openai/openai-node/blob/master/CHANGELOG.md#_snippet_124

LANGUAGE: Markdown
CODE:

```
Documentation: SECURITY.md added to repository.
```

---

TITLE: Chore: Fix Binary Files in OpenAI Node.js Internal
DESCRIPTION: This internal chore addresses and fixes issues related to binary files within the project. This ensures proper handling and integrity of non-text assets.

SOURCE: https://github.com/openai/openai-node/blob/master/CHANGELOG.md#_snippet_154

LANGUAGE: APIDOC
CODE:

```
Fixed issues with internal binary files.
```

---

TITLE: OpenAI Uploads API
DESCRIPTION: Handles file uploads to OpenAI, including creating, canceling, and completing uploads. Used for providing files for processing.

SOURCE: https://github.com/openai/openai-node/blob/master/api.md#_snippet_29

LANGUAGE: APIDOC
CODE:

```
Uploads API:

Types:
  Upload

Methods:
  create(params) -> Upload
    POST /uploads
    Initiates a file upload.

  cancel(uploadID) -> Upload
    POST /uploads/{upload_id}/cancel
    Cancels an ongoing file upload.

  complete(uploadID, params) -> Upload
    POST /uploads/{upload_id}/complete
    Marks a file upload as complete.
```

---

TITLE: Auto-parsing response content with Zod schemas
DESCRIPTION: Demonstrates how to use the `client.chat.completions.parse()` method with Zod schemas to automatically parse model responses into structured TypeScript objects. This involves defining Zod schemas for the expected output and passing them to the `response_format` parameter.

SOURCE: https://github.com/openai/openai-node/blob/master/helpers.md#_snippet_0

LANGUAGE: typescript
CODE:

```
import { zodResponseFormat } from 'openai/helpers/zod';
import OpenAI from 'openai/index';
import { z } from 'zod';

const Step = z.object({
  explanation: z.string(),
  output: z.string(),
});

const MathResponse = z.object({
  steps: z.array(Step),
  final_answer: z.string(),
});

const client = new OpenAI();

const completion = await client.chat.completions.parse({
  model: 'gpt-4o-2024-08-06',
  messages: [
    { role: 'system', content: 'You are a helpful math tutor.' },
    { role: 'user', content: 'solve 8x + 31 = 2' },
  ],
  response_format: zodResponseFormat(MathResponse, 'math_response'),
});

console.dir(completion, { depth: 5 });

const message = completion.choices[0]?.message;
if (message?.parsed) {
  console.log(message.parsed.steps);
  console.log(`answer: ${message.parsed.final_answer}`);
}
```

---

TITLE: Add Streaming and Function Calling Helpers (Node.js)
DESCRIPTION: Introduces new helper functions within the OpenAI Node.js client to facilitate streaming responses and simplify the process of making function calls. This enhancement improves real-time interaction capabilities with AI models.

SOURCE: https://github.com/openai/openai-node/blob/master/CHANGELOG.md#_snippet_174

LANGUAGE: APIDOC
CODE:

```
New beta helper methods are available for streaming and function calling. Refer to the library's beta documentation for specific usage patterns and method signatures.

Example (conceptual):
const stream = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Say this is a test' }],
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content || '');
}
```

---

TITLE: OpenAI Node.js Polling Helper Methods
DESCRIPTION: Provides methods that poll API endpoints for status updates until a terminal state is reached. These helpers simplify handling asynchronous operations like creating runs or uploading files.

SOURCE: https://github.com/openai/openai-node/blob/master/helpers.md#_snippet_35

LANGUAGE: APIDOC
CODE:

````
OpenAI Node.js Polling Helpers:

These methods poll API endpoints for status updates until a terminal state is reached, returning the final result.

Polling can be configured with `pollIntervalMs` to set the frequency of status checks.

Available Polling Methods:

- `client.beta.threads.createAndRunPoll(...)`
- `client.beta.threads.runs.createAndPoll(...)`
- `client.beta.threads.runs.submitToolOutputsAndPoll(...)`
- `client.beta.vectorStores.files.uploadAndPoll(...)`
- `client.beta.vectorStores.files.createAndPoll(...)`
- `client.beta.vectorStores.fileBatches.createAndPoll(...)`
- `client.beta.vectorStores.fileBatches.uploadAndPoll(...)`

Usage Example:

```ts
// Example for creating and polling a run
const run = await client.beta.threads.runs.createAndPoll(
  threadId,
  {
    assistant_id: assistantId,
    // other run creation options
  },
  { pollIntervalMs: 1000 } // Poll every 1 second
);

// The 'run' object will contain the final state after polling completes.
console.log('Run completed with status:', run.status);
````

```

----------------------------------------

TITLE: Feature Azure: Realtime API Support
DESCRIPTION: This significant feature adds comprehensive support for the Realtime API when using Azure deployments. It enables developers to leverage real-time capabilities with their Azure-hosted OpenAI models.

SOURCE: https://github.com/openai/openai-node/blob/master/CHANGELOG.md#_snippet_79

LANGUAGE: TypeScript
CODE:
```

Azure API Integration: Introduced full support for the Realtime API, allowing real-time interactions and streaming capabilities when deployed on Azure.

Conceptual Usage:
const client = new AzureOpenAI({
// Azure specific configuration
});
const realtimeSession = client.realtime.createSession();

```

----------------------------------------

TITLE: Fix: Handle System Fingerprint in OpenAI Node.js Streaming
DESCRIPTION: This fix ensures that the 'system_fingerprint' field is correctly processed and handled by the streaming helper utilities in the OpenAI Node.js library. It improves the robustness of streaming operations by properly managing this metadata.

SOURCE: https://github.com/openai/openai-node/blob/master/CHANGELOG.md#_snippet_159

LANGUAGE: JavaScript
CODE:
```

// Internal streaming helper logic updated to process 'system_fingerprint' field.
// This ensures proper handling of metadata during streaming operations.
// No direct user-facing code change, internal library improvement.

```

----------------------------------------

TITLE: Add New GPT-4o-mini Models to OpenAI Node.js API
DESCRIPTION: Integrates the new `gpt-4o-mini` models into the OpenAI Node.js client. Developers can now access these models for their applications, offering potentially more cost-effective or faster inference options for various tasks.

SOURCE: https://github.com/openai/openai-node/blob/master/CHANGELOG.md#_snippet_111

LANGUAGE: APIDOC
CODE:
```

API: Models
New Models: `gpt-4o-mini`
Usage:
const chatCompletion = await openai.chat.completions.create({
model: "gpt-4o-mini",
messages: [{ role: "user", content: "Hello, gpt-4o-mini!" }]
});

```

----------------------------------------

TITLE: OpenAI SDK Asynchronous Operation Polling Methods (TypeScript)
DESCRIPTION: This snippet lists the `_AndPoll` helper methods available in the OpenAI Node.js SDK for managing asynchronous API operations. These methods automatically poll the API until a terminal state is reached for tasks like creating and running threads, submitting tool outputs, or uploading files to vector stores, simplifying the handling of long-running processes.

SOURCE: https://github.com/openai/openai-node/blob/master/helpers.md#_snippet_41

LANGUAGE: typescript
CODE:
```

client.beta.threads.createAndRunPoll(...)
client.beta.threads.runs.createAndPoll((...)
client.beta.threads.runs.submitToolOutputsAndPoll((...)
client.beta.vectorStores.files.uploadAndPoll((...)
client.beta.vectorStores.files.createAndPoll((...)
client.beta.vectorStores.fileBatches.createAndPoll((...)
client.beta.vectorStores.fileBatches.uploadAndPoll((...)

```

----------------------------------------

TITLE: Add Node.js API: New `/v1/responses` Endpoint and Built-in Tools
DESCRIPTION: This feature introduces a new `/v1/responses` API endpoint and support for built-in tools within the OpenAI Node.js client. Developers can now interact with this new endpoint for specific response handling and leverage integrated tools to extend application capabilities. This expands the range of interactions possible with the OpenAI API.

SOURCE: https://github.com/openai/openai-node/blob/master/CHANGELOG.md#_snippet_54

LANGUAGE: APIDOC
CODE:
```

// API Endpoint: POST /v1/responses
// Description: Handles specific response processing.
// Parameters: (Varies based on specific use case)
// Returns: Processed API response data.

// Feature: Built-in Tools Support
// Description: Integrates new built-in tools for enhanced functionality.
// Usage: Tools can be invoked via specific API calls or configurations.

```

----------------------------------------

TITLE: Fix: Accept Undefined for Optional OpenAI Node.js Client Options
DESCRIPTION: This type-related bug fix allows optional client configuration parameters to correctly accept 'undefined' as a valid value. It resolves type strictness issues, making the client initialization more flexible and aligned with common JavaScript/TypeScript patterns for optional properties.

SOURCE: https://github.com/openai/openai-node/blob/master/CHANGELOG.md#_snippet_160

LANGUAGE: TypeScript
CODE:
```

// Before:
// interface ClientOptions {
// apiKey?: string;
// }

// After:
interface ClientOptions {
apiKey?: string | undefined;
// ... other optional properties now correctly accept undefined
}

```

----------------------------------------

TITLE: OpenAI Evals Runs Output Items API
DESCRIPTION: Provides methods for retrieving and listing output items associated with an evaluation run. These operations interact with the /evals/{eval_id}/runs/{run_id}/output_items endpoint.

SOURCE: https://github.com/openai/openai-node/blob/master/api.md#_snippet_40

LANGUAGE: APIDOC
CODE:
```

GET /evals/{eval_id}/runs/{run_id}/output_items/{output_item_id}
client.evals.runs.outputItems.retrieve(outputItemID, { ...params })
Retrieves a specific output item by its ID.
Parameters: - outputItemID: The ID of the output item to retrieve. - params: Object containing parameters for retrieval.
Returns: - OutputItemRetrieveResponse: Details of the retrieved output item.

GET /evals/{eval_id}/runs/{run_id}/output_items
client.evals.runs.outputItems.list(runID, { ...params })
Lists all output items for a run.
Parameters: - runID: The ID of the run. - params: Object containing parameters for listing output items.
Returns: - OutputItemListResponsesPage: A page of output items.

```

----------------------------------------

TITLE: Stream Responses from OpenAI API
DESCRIPTION: Handles streaming responses from the OpenAI API using Server Sent Events (SSE). This allows for real-time processing of generated text.

SOURCE: https://github.com/openai/openai-node/blob/master/README.md#_snippet_5

LANGUAGE: typescript
CODE:
```

import OpenAI from 'openai';

const client = new OpenAI();

const stream = await client.responses.create({
model: 'gpt-4o',
input: 'Say "Sheep sleep deep" ten times fast!',
stream: true,
});

for await (const event of stream) {
console.log(event);
}

```

----------------------------------------

TITLE: OpenAI Chat Completions Messages API
DESCRIPTION: Provides methods for interacting with chat completion messages. The primary method is `list` which retrieves messages for a given completion ID. It accepts optional parameters for further filtering or customization.

SOURCE: https://github.com/openai/openai-node/blob/master/api.md#_snippet_2

LANGUAGE: APIDOC
CODE:
```

client.chat.completions.messages.list(completionID, { ...params }) -> ChatCompletionStoreMessagesPage

- Retrieves messages associated with a specific chat completion.
- Parameters:
    - completionID: The ID of the chat completion.
    - params: Optional parameters for filtering or pagination.

```

----------------------------------------

TITLE: OpenAI Node.js Azure: Implement Batch API Support
DESCRIPTION: Introduces support for the Azure Batch API within the OpenAI Node.js client. This allows users to submit multiple API requests as a single batch operation, improving efficiency and reducing overhead for large-scale processing on Azure.

SOURCE: https://github.com/openai/openai-node/blob/master/CHANGELOG.md#_snippet_122

LANGUAGE: APIDOC
CODE:
```

API Feature: Azure Batch API support.

Example (conceptual):
const batch = await openai.azure.batch.create({
input: "batch_input_file_id",
endpoint: "/v1/chat/completions"
});

```

----------------------------------------

TITLE: OpenAI Node.js Create Upload Part Method
DESCRIPTION: This method facilitates the creation of a new part for an existing file upload using the OpenAI Node.js client. It requires a unique `uploadID` to specify the parent upload and an object of `params` to configure the new part. The method returns an `UploadPart` object, representing the successfully added part, upon completion.

SOURCE: https://github.com/openai/openai-node/blob/master/api.md#_snippet_44

LANGUAGE: APIDOC
CODE:
```

client.uploads.parts.create(uploadID, { ...params }) -> UploadPart

```

----------------------------------------

TITLE: Create an Eval in OpenAI Node.js Client
DESCRIPTION: This snippet demonstrates how to create a new evaluation (Eval) using the OpenAI Node.js client. It requires a set of parameters defining the evaluation's configuration. The method returns an `EvalCreateResponse` object upon successful creation.

SOURCE: https://github.com/openai/openai-node/blob/master/api.md#_snippet_54

LANGUAGE: TypeScript
CODE:
```

client.evals.create({ ...params }) -> EvalCreateResponse

```

----------------------------------------

TITLE: Simplify Resource Imports in OpenAI Node.js Client
DESCRIPTION: This update streamlines resource imports, allowing direct imports without needing to specify '/index'. It simplifies module paths and improves the overall import experience for developers using the library.

SOURCE: https://github.com/openai/openai-node/blob/master/CHANGELOG.md#_snippet_7

LANGUAGE: TypeScript
CODE:
```

// Before (might require /index):
// import { ChatCompletions } from 'openai/resources/chat/completions/index';

// After (simplified import path):
import { ChatCompletions } from 'openai/resources/chat/completions';

const chat = new ChatCompletions();

```

----------------------------------------

TITLE: Feature API: Add o3-mini Model
DESCRIPTION: This feature introduces support for the new 'o3-mini' model within the API. Developers can now specify and utilize this model for their OpenAI API calls.

SOURCE: https://github.com/openai/openai-node/blob/master/CHANGELOG.md#_snippet_76

LANGUAGE: APIDOC
CODE:
```

API.Models: Added 'o3-mini' as a supported model.

Conceptual API Usage:
const completion = await openai.chat.completions.create({
model: 'o3-mini',
messages: [{ role: 'user', content: 'Hello' }],
});

```

----------------------------------------

TITLE: OpenAI Response Output Types
DESCRIPTION: Details the output structures returned by the OpenAI API, encompassing audio, general items, messages, refusals, and text. These types represent the data received from the API after a request.

SOURCE: https://github.com/openai/openai-node/blob/master/api.md#_snippet_33

LANGUAGE: typescript
CODE:
```

ResponseOutputAudio
ResponseOutputItem
ResponseOutputMessage
ResponseOutputRefusal
ResponseOutputText

```

----------------------------------------

TITLE: Add Usage Data to OpenAI Node.js Runs and Run Steps
DESCRIPTION: This feature introduces the capability to include usage information within run and run step objects in the OpenAI Node.js API. It allows developers to track token consumption and other usage metrics directly from these objects, providing better insights into API call costs and resource utilization.

SOURCE: https://github.com/openai/openai-node/blob/master/CHANGELOG.md#_snippet_157

LANGUAGE: APIDOC
CODE:
```

// API Reference Update:
// OpenAI.beta.threads.runs.retrieve(runId).usage: object
// OpenAI.beta.threads.runs.steps.retrieve(stepId).usage: object

// Properties of 'usage' object:
// prompt_tokens: number - Number of tokens in the prompt.
// completion_tokens: number - Number of tokens in the completion.
// total_tokens: number - Total number of tokens used.

```

----------------------------------------

TITLE: Fix: Use Default Base URL if OpenAI Node.js ENV Var is Blank
DESCRIPTION: This bug fix ensures that the OpenAI Node.js client correctly falls back to its default base URL if the 'BASE_URL' environment variable is present but empty or blank. It prevents configuration errors and improves robustness when environment variables are not fully set.

SOURCE: https://github.com/openai/openai-node/blob/master/CHANGELOG.md#_snippet_161

LANGUAGE: JavaScript
CODE:
```

// Internal client initialization logic:
// if (process.env.BASE_URL === '' || process.env.BASE_URL === null) {
// this.baseURL = DEFAULT_BASE_URL;
// } else {
// this.baseURL = process.env.BASE_URL;
// }

```

----------------------------------------

TITLE: Assistant Stream Final Data Collection
DESCRIPTION: Convenience methods to collect final data from an assistant stream. Calling these methods consumes the stream until completion.

SOURCE: https://github.com/openai/openai-node/blob/master/helpers.md#_snippet_6

LANGUAGE: ts
CODE:
```

await .finalMessages() : Promise<Message[]>

await .finalRunSteps(): Promise<RunStep[]>

```

----------------------------------------

TITLE: Update Node.js Docs: Change URLs to stainless.com
DESCRIPTION: This documentation update changes all references from `stainlessapi.com` to `stainless.com` within the OpenAI Node.js library's documentation. This ensures that users are directed to the correct and current domain for related resources. It's a maintenance update to keep documentation accurate.

SOURCE: https://github.com/openai/openai-node/blob/master/CHANGELOG.md#_snippet_56

LANGUAGE: Documentation
CODE:
```

// Documentation Update
// Description: Replaced 'stainlessapi.com' with 'stainless.com' in all documentation files.
// Example (conceptual change):
// - Old URL: https://docs.stainlessapi.com/...
// - New URL: https://docs.stainless.com/...

```

----------------------------------------

TITLE: Extract Image, Audio, and Speech Models in OpenAI Node.js Client
DESCRIPTION: Refactors the OpenAI Node.js client to extract `ImageModel`, `AudioModel`, and `SpeechModel` into separate, more explicit types. This improves type clarity and organization within the API, making it easier for developers to work with specific media-related models.

SOURCE: https://github.com/openai/openai-node/blob/master/CHANGELOG.md#_snippet_107

LANGUAGE: APIDOC
CODE:
```

API: Model Definitions
Changes: `ImageModel`, `AudioModel`, `SpeechModel` are now distinct types.
Impact: Improved type safety and clarity when referencing specific model categories.
Example (Conceptual):
import { ImageModel } from 'openai';
const model: ImageModel = 'dall-e-3';

```

----------------------------------------

TITLE: Retrieve File Content with OpenAI Node.js Client
DESCRIPTION: This section provides the API for retrieving the raw content of a specific file within a container. Dependencies include the OpenAI Node.js client library.

SOURCE: https://github.com/openai/openai-node/blob/master/api.md#_snippet_70

LANGUAGE: APIDOC
CODE:
```

client.containers.files.content.retrieve(fileID, { ...params }) -> Response
Method: GET /containers/{container_id}/files/{file_id}/content
Description: Retrieves the raw content of a specific file.
Parameters: - fileID: string (ID of the file to retrieve content from)

```

----------------------------------------

TITLE: OpenAI Response Stream Event Types
DESCRIPTION: Documents the various event types used for streaming responses from the OpenAI API. This includes deltas, done events, and specific events for different content types like audio, text, and refusals, as well as reasoning and item additions.

SOURCE: https://github.com/openai/openai-node/blob/master/api.md#_snippet_34

LANGUAGE: typescript
CODE:
```

ResponseStreamEvent
ResponseQueuedEvent
ResponseMcpCallArgumentsDeltaEvent
ResponseMcpCallArgumentsDoneEvent
ResponseMcpCallCompletedEvent
ResponseMcpCallFailedEvent
ResponseMcpCallInProgressEvent
ResponseMcpListToolsCompletedEvent
ResponseMcpListToolsFailedEvent
ResponseMcpListToolsInProgressEvent
ResponseOutputItemAddedEvent
ResponseOutputItemDoneEvent
ResponseOutputTextAnnotationAddedEvent
ResponseReasoningItem
ResponseReasoningSummaryPartAddedEvent
ResponseReasoningSummaryPartDoneEvent
ResponseReasoningSummaryTextDeltaEvent
ResponseReasoningSummaryTextDoneEvent
ResponseReasoningTextDeltaEvent
ResponseReasoningTextDoneEvent
ResponseRefusalDeltaEvent
ResponseRefusalDoneEvent
ResponseStatus
ResponseTextDeltaEvent
ResponseTextDoneEvent
ResponseUsage
ResponseWebSearchCallCompletedEvent
ResponseWebSearchCallInProgressEvent
ResponseWebSearchCallSearchingEvent

```

----------------------------------------

TITLE: Chore: Respect `application/vnd.api+json` Content-Type Header in OpenAI Node.js
DESCRIPTION: This chore ensures the OpenAI Node.js library correctly respects the `application/vnd.api+json` content-type header. This improves compatibility and adherence to API standards.

SOURCE: https://github.com/openai/openai-node/blob/master/CHANGELOG.md#_snippet_144

LANGUAGE: APIDOC
CODE:
```

Implemented support for `application/vnd.api+json` content-type header.

```

----------------------------------------

TITLE: Feature: Add Audio Helpers to OpenAI Node.js Library
DESCRIPTION: This feature introduces new helper utilities specifically designed for audio processing within the OpenAI Node.js library. These helpers simplify common audio-related tasks, making it easier to integrate audio functionalities such as text-to-speech (TTS) and speech-to-text (STT). They provide convenient abstractions for interacting with audio APIs.

SOURCE: https://github.com/openai/openai-node/blob/master/CHANGELOG.md#_snippet_42

LANGUAGE: APIDOC
CODE:
```

// API Change: New Feature
Component: Audio Module
Method/Function: New audio helper utilities
Description: Provides simplified interfaces for common audio operations.
Usage: Facilitates easier integration of audio features like TTS and STT.

```

----------------------------------------

TITLE: Waiting for Stream Completion - OpenAI Node.js
DESCRIPTION: This method returns an empty promise that resolves when the streaming operation is fully complete. It provides a convenient way to await the entire stream's conclusion without needing to listen for the 'end' event.

SOURCE: https://github.com/openai/openai-node/blob/master/helpers.md#_snippet_38

LANGUAGE: TypeScript
CODE:
```

await .done()

```

----------------------------------------

TITLE: Container Files API
DESCRIPTION: Manages files within a specific container. This includes creating, retrieving, listing, and deleting files associated with a container. These operations interact with the /containers/{container_id}/files endpoint.

SOURCE: https://github.com/openai/openai-node/blob/master/api.md#_snippet_42

LANGUAGE: APIDOC
CODE:
```

Container Files API:

Types:
FileCreateResponse
FileRetrieveResponse
FileListResponse

Methods:
create(containerID: string, params: object): FileCreateResponse
Description: Creates a new file within a container.
Endpoint: POST /containers/{container_id}/files
Parameters:
containerID: The ID of the container to which the file will be added.
params: Object containing parameters for file creation.
Returns: FileCreateResponse - The response object for file creation.

retrieve(fileID: string, params: object): FileRetrieveResponse
Description: Retrieves details of a specific file within a container.
Endpoint: GET /containers/{container_id}/files/{file_id}
Parameters:
fileID: The ID of the file to retrieve.
params: Object containing parameters for file retrieval.
Returns: FileRetrieveResponse - The response object for file retrieval.

list(containerID: string, params: object): FileListResponse
Description: Lists all files within a specific container.
Endpoint: GET /containers/{container_id}/files
Parameters:
containerID: The ID of the container whose files are to be listed.
params: Object containing parameters for listing files.
Returns: FileListResponse - The response object containing a list of files.

delete(fileID: string, params: object): void
Description: Deletes a specific file from a container.
Endpoint: DELETE /containers/{container_id}/files/{file_id}
Parameters:
fileID: The ID of the file to delete.
params: Object containing parameters for file deletion.
Returns: void

```

----------------------------------------

TITLE: Add Required tool_choice Parameter to OpenAI Node.js API
DESCRIPTION: This feature updates the API to include `tool_choice` as a required parameter in certain contexts. This ensures that tool usage is explicitly defined when interacting with models that support tool calling. Developers must now specify how tools should be used in their API requests.

SOURCE: https://github.com/openai/openai-node/blob/master/CHANGELOG.md#_snippet_134

LANGUAGE: APIDOC
CODE:
```

Parameter Update: tool_choice
Affected API: Chat Completions API (e.g., client.chat.completions.create)
Description: The 'tool_choice' parameter is now required in specific scenarios when using models capable of tool calling.
Type: 'none' | 'auto' | { type: 'function', function: { name: string } }
Usage:
client.chat.completions.create({
messages: [...],
model: "gpt-4o",
tool_choice: "auto", // or { type: "function", function: { name: "my_function" } }
tools: [...]
});

```

----------------------------------------

TITLE: Feature: O1-Pro Model Now Available via OpenAI Node.js API
DESCRIPTION: This feature makes the 'o1-pro' model accessible through the OpenAI Node.js API. Developers can now integrate and utilize this specific model for their AI applications, expanding the range of available models for various tasks. This provides access to advanced capabilities offered by the 'o1-pro' model.

SOURCE: https://github.com/openai/openai-node/blob/master/CHANGELOG.md#_snippet_44

LANGUAGE: APIDOC
CODE:
```

// API Change: New Feature
Component: Models API
Model: o1-pro
Description: The 'o1-pro' model is now available for use via the API.
Impact: Expands the range of accessible AI models for applications.
Reference: Issue #1398

```

----------------------------------------

TITLE: Transition Tests Away from Node:Stream (Node.js)
DESCRIPTION: This update modifies tests to stop using `node:stream`, likely in favor of more modern or efficient alternatives. It aligns the test suite with current best practices and reduces reliance on older Node.js stream APIs.

SOURCE: https://github.com/openai/openai-node/blob/master/CHANGELOG.md#_snippet_28

LANGUAGE: JavaScript
CODE:
```

// Internal test refactoring: Tests no longer use `node:stream`.
// This modernizes the test suite and aligns with current best practices.
// No direct user-facing code change.

```

----------------------------------------

TITLE: OpenAI Node.js Chat Completion Retrieval Methods
DESCRIPTION: Provides methods to retrieve specific parts of a chat completion response, such as the final message content, function calls, or total usage. These methods are part of the streaming runner interface.

SOURCE: https://github.com/openai/openai-node/blob/master/helpers.md#_snippet_32

LANGUAGE: APIDOC
CODE:
```

OpenAI Chat Completion Runner Methods:

.finalChatCompletion()

- Returns a promise that resolves with the final, complete chat completion object received from the API. Throws an error if the request ends before a complete response is obtained.

.allChatCompletions()

- Returns a promise that resolves with an array containing all chat completion chunks received from the API.

.finalContent()

- Returns a promise that resolves with the content of the last message where the role is 'assistant'. Throws an error if no such message is found.

.finalMessage()

- Returns a promise that resolves with the last message object in the conversation.

.finalFunctionCall()

- Returns a promise that resolves with the last message that includes a defined 'function_call'. Throws an error if no such message is found.

.finalFunctionCallResult()

- Returns a promise that resolves with the last message where the role is 'function'. Throws an error if no such message is found.

.totalUsage()

- Returns a promise that resolves with the total token usage for the completion. Note: Usage is not reported when 'stream' is enabled.

Chat Fields:

.messages

- A mutable array holding all messages exchanged in the conversation.

.controller

- The underlying AbortController instance used to manage the request lifecycle.

````

```Create a model response
post

https://api.openai.com/v1/responses
Creates a model response. Provide text or image inputs to generate text or JSON outputs. Have the model call your own custom code or use built-in tools like web search or file search to use your own data as input for the model's response.

Request body
background
boolean or null

Optional
Defaults to false
Whether to run the model response in the background. Learn more.

include
array or null

Optional
Specify additional output data to include in the model response. Currently supported values are:

code_interpreter_call.outputs: Includes the outputs of python code execution in code interpreter tool call items.
computer_call_output.output.image_url: Include image urls from the computer call output.
file_search_call.results: Include the search results of the file search tool call.
message.input_image.image_url: Include image urls from the input message.
message.output_text.logprobs: Include logprobs with assistant messages.
reasoning.encrypted_content: Includes an encrypted version of reasoning tokens in reasoning item outputs. This enables reasoning items to be used in multi-turn conversations when using the Responses API statelessly (like when the store parameter is set to false, or when an organization is enrolled in the zero data retention program).
input
string or array

Optional
Text, image, or file inputs to the model, used to generate a response.

Learn more:

Text inputs and outputs
Image inputs
File inputs
Conversation state
Function calling

Show possible types
instructions
string or null

Optional
A system (or developer) message inserted into the model's context.

When using along with previous_response_id, the instructions from a previous response will not be carried over to the next response. This makes it simple to swap out system (or developer) messages in new responses.

max_output_tokens
integer or null

Optional
An upper bound for the number of tokens that can be generated for a response, including visible output tokens and reasoning tokens.

max_tool_calls
integer or null

Optional
The maximum number of total calls to built-in tools that can be processed in a response. This maximum number applies across all built-in tool calls, not per individual tool. Any further attempts to call a tool by the model will be ignored.

metadata
map

Optional
Set of 16 key-value pairs that can be attached to an object. This can be useful for storing additional information about the object in a structured format, and querying for objects via API or the dashboard.

Keys are strings with a maximum length of 64 characters. Values are strings with a maximum length of 512 characters.

model
string

Optional
Model ID used to generate the response, like gpt-4o or o3. OpenAI offers a wide range of models with different capabilities, performance characteristics, and price points. Refer to the model guide to browse and compare available models.

parallel_tool_calls
boolean or null

Optional
Defaults to true
Whether to allow the model to run tool calls in parallel.

previous_response_id
string or null

Optional
The unique ID of the previous response to the model. Use this to create multi-turn conversations. Learn more about conversation state.

prompt
object or null

Optional
Reference to a prompt template and its variables. Learn more.


Show properties
prompt_cache_key
string

Optional
Used by OpenAI to cache responses for similar requests to optimize your cache hit rates. Replaces the user field. Learn more.

reasoning
object or null

Optional
o-series models only

Configuration options for reasoning models.


Show properties
safety_identifier
string

Optional
A stable identifier used to help detect users of your application that may be violating OpenAI's usage policies. The IDs should be a string that uniquely identifies each user. We recommend hashing their username or email address, in order to avoid sending us any identifying information. Learn more.

service_tier
string or null

Optional
Defaults to auto
Specifies the processing type used for serving the request.

If set to 'auto', then the request will be processed with the service tier configured in the Project settings. Unless otherwise configured, the Project will use 'default'.
If set to 'default', then the request will be processed with the standard pricing and performance for the selected model.
If set to 'flex' or 'priority', then the request will be processed with the corresponding service tier. Contact sales to learn more about Priority processing.
When not set, the default behavior is 'auto'.
When the service_tier parameter is set, the response body will include the service_tier value based on the processing mode actually used to serve the request. This response value may be different from the value set in the parameter.

store
boolean or null

Optional
Defaults to true
Whether to store the generated model response for later retrieval via API.

stream
boolean or null

Optional
Defaults to false
If set to true, the model response data will be streamed to the client as it is generated using server-sent events. See the Streaming section below for more information.

stream_options
object or null

Optional
Defaults to null
Options for streaming responses. Only set this when you set stream: true.


Show properties
temperature
number or null

Optional
Defaults to 1
What sampling temperature to use, between 0 and 2. Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic. We generally recommend altering this or top_p but not both.

text
object

Optional
Configuration options for a text response from the model. Can be plain text or structured JSON data. Learn more:

Text inputs and outputs
Structured Outputs

Show properties
tool_choice
string or object

Optional
How the model should select which tool (or tools) to use when generating a response. See the tools parameter to see how to specify which tools the model can call.


Show possible types
tools
array

Optional
An array of tools the model may call while generating a response. You can specify which tool to use by setting the tool_choice parameter.

The two categories of tools you can provide the model are:

Built-in tools: Tools that are provided by OpenAI that extend the model's capabilities, like web search or file search. Learn more about built-in tools.
Function calls (custom tools): Functions that are defined by you, enabling the model to call your own code with strongly typed arguments and outputs. Learn more about function calling. You can also use custom tools to call your own code.

Show possible types
top_logprobs
integer or null

Optional
An integer between 0 and 20 specifying the number of most likely tokens to return at each token position, each with an associated log probability.

top_p
number or null

Optional
Defaults to 1
An alternative to sampling with temperature, called nucleus sampling, where the model considers the results of the tokens with top_p probability mass. So 0.1 means only the tokens comprising the top 10% probability mass are considered.

We generally recommend altering this or temperature but not both.

truncation
string or null

Optional
Defaults to disabled
The truncation strategy to use for the model response.

auto: If the context of this response and previous ones exceeds the model's context window size, the model will truncate the response to fit the context window by dropping input items in the middle of the conversation.
disabled (default): If a model response will exceed the context window size for a model, the request will fail with a 400 error.
user
Deprecated
string

Optional
This field is being replaced by safety_identifier and prompt_cache_key. Use prompt_cache_key instead to maintain caching optimizations. A stable identifier for your end-users. Used to boost cache hit rates by better bucketing similar requests and to help OpenAI detect and prevent abuse. Learn more.

verbosity
string or null

Optional
Defaults to medium
Constrains the verbosity of the model's response. Lower values will result in more concise responses, while higher values will result in more verbose responses. Currently supported values are low, medium, and high.

Returns
Returns a Response object.```


```#!/usr/bin/env python
# coding: utf-8

# #  GPT-5 New Params and Tools
#
# We’re introducing new developer controls in the GPT-5 series that give you greater control over model responses—from shaping output length and style to enforcing strict formatting. Below is a quick overview of the latest features:
#
#
# | #  | Feature | Overview | Values / Usage |
# |----|---------|----------|----------------|
# | 1. | **Verbosity Parameter** | Lets you hint the model to be more or less expansive in its replies. Keep prompts stable and use the parameter instead of re-writing. | • **low** → terse UX, minimal prose.<br>• **medium** *(default)* → balanced detail.<br>• **high** → verbose, great for audits, teaching, or hand-offs. |
# | 2. | **Freeform Function Calling** | Generate raw text payloads—anything from Python scripts to SQL queries—directly to your custom tool without JSON wrapping. Offers greater flexibility for external runtimes like:<br>• Code sandboxes (Python, C++, Java, …)<br>• SQL databases<br>• Shell environments<br>• Config generators | Use when structured JSON isn’t needed and raw text is more natural for the target tool. |
# | 3. | **Context-Free Grammar (CFG)** | A set of production rules defining valid strings in a language. Each rule rewrites a non-terminal into terminals and/or other non-terminals, independent of surrounding context. Useful for constraining output to match the syntax of programming languages or custom formats in OpenAI tools. | Use as a contract to ensure the model emits only valid strings accepted by the grammar. |
# | 4. | **Minimal Reasoning** | Runs GPT-5 with few or no reasoning tokens to minimize latency and speed time-to-first-token. Ideal for deterministic, lightweight tasks (extraction, formatting, short rewrites, simple classification) where explanations aren’t needed. If not specified, effort defaults to medium. | Set reasoning effort: "minimal". Avoid for multi-step planning or tool-heavy workflows. |
#
#
# **Supported Models:**
# - gpt-5
# - gpt-5-mini
# - gpt-5-nano
#
# **Supported API Endpoints**
# - Responses API
# - Chat Completions API
#
# Note: We recommend to use Responses API with GPT-5 series of model to get the most performance out of the models.
#

# ## Prerequisites
#
# Let's begin with updating your OpenAI SDK that supports the new params and tools for GPT-5. Make sure you've set OPENAI_API_KEY as an environment variable.

# In[2]:


get_ipython().system('pip install --quiet --upgrade openai pandas &&  echo -n "openai " && pip show openai | grep \'^Version:\' | cut -d\' \' -f2 &&  echo -n "pandas " && pip show pandas | grep \'^Version:\' | cut -d\' \' -f2')


# ## 1. Verbosity Parameter
#
# ### 1.1 Overview
# The verbosity parameter lets you hint the model to be more or less expansive in its replies.
#
# **Values:** "low", "medium", "high"
#
# - low → terse UX, minimal prose.
# - medium (default) → balanced detail.
# - high → verbose, great for audits, teaching, or hand-offs.
#
# Keep prompts stable and use the param rather than re-writing.
#

# In[3]:


from openai import OpenAI
import pandas as pd
from IPython.display import display

client = OpenAI()

question = "Write a poem about a boy and his first pet dog."

data = []

for verbosity in ["low", "medium", "high"]:
    response = client.responses.create(
        model="gpt-5-mini",
        input=question,
        text={"verbosity": verbosity}
    )

    # Extract text
    output_text = ""
    for item in response.output:
        if hasattr(item, "content"):
            for content in item.content:
                if hasattr(content, "text"):
                    output_text += content.text

    usage = response.usage
    data.append({
        "Verbosity": verbosity,
        "Sample Output": output_text,
        "Output Tokens": usage.output_tokens
    })

# Create DataFrame
df = pd.DataFrame(data)

# Display nicely with centered headers
pd.set_option('display.max_colwidth', None)
styled_df = df.style.set_table_styles(
    [
        {'selector': 'th', 'props': [('text-align', 'center')]},  # Center column headers
        {'selector': 'td', 'props': [('text-align', 'left')]}     # Left-align table cells
    ]
)

display(styled_df)


# The output tokens scale roughly linearly with verbosity: low (560) → medium (849) → high (1288).

# ### 2.3 Using Verbosity for Coding Use Cases
#
# The verbosity parameter also influences the length and complexity of generated code, as well as the depth of accompanying explanations. Here's an example, wherein we use various verboisty levels for a task to generate a Python program that sorts an array of 1000000 random numbers.

# In[4]:


from openai import OpenAI

client = OpenAI()

prompt = "Output a Python program that sorts an array of 1000000 random numbers"

def ask_with_verbosity(verbosity: str, question: str):
    response = client.responses.create(
        model="gpt-5-mini",
        input=question,
        text={
            "verbosity": verbosity
        }
    )

    # Extract assistant's text output
    output_text = ""
    for item in response.output:
        if hasattr(item, "content"):
            for content in item.content:
                if hasattr(content, "text"):
                    output_text += content.text

    # Token usage details
    usage = response.usage

    print("--------------------------------")
    print(f"Verbosity: {verbosity}")
    print("Output:")
    print(output_text)
    print("Tokens => input: {} | output: {}".format(
        usage.input_tokens, usage.output_tokens
    ))


# Example usage:
ask_with_verbosity("low", prompt)


# Notice that the code output is a plain script. Now, lets run with 'medium'

# In[5]:


ask_with_verbosity("medium", prompt)


# Medium verboisty, generated richer code with additioanl explanations. Let's do the same with high.

# In[6]:


ask_with_verbosity("high", prompt)


# High verbosity yielded additional details and explanations.
#
# ### 1.3 Takeaways
#
# The new verbosity parameter reliably scales both the length and depth of the model’s output while preserving correctness and reasoning quality - **without changing the underlying prompt**.
# In this example:
#
# - **Low verbosity** produces a minimal, functional script with no extra comments or structure.
# - **Medium verbosity** adds explanatory comments, function structure, and reproducibility controls.
# - **High verbosity** yields a comprehensive, production-ready script with argument parsing, multiple sorting methods, timing/verification, usage notes, and best-practice tips.

# ## 2. Free‑Form Function Calling
#
# ### 2.1 Overview
# GPT‑5 can now send raw text payloads - anything from Python scripts to SQL queries - to your custom tool without wrapping the data in JSON using the new tool `"type": "custom"`. This differs from classic structured function calls, giving you greater flexibility when interacting with external runtimes such as:
#
# - code_exec with sandboxes (Python, C++, Java, …)
# - SQL databases
# - Shell environments
# - Configuration generators
#
# **Note that custom tool type does NOT support parallel tool calling.**
#
# ### 2.2 Quick Start Example - Compute the Area of a Circle

# The code below produces a simple python code to calculate area of a circle, and instruct the model to use the freeform tool call to output the result.

# In[7]:


from openai import OpenAI

client = OpenAI()

response = client.responses.create(
    model="gpt-5-mini",
    input="Please use the code_exec tool to calculate the area of a circle with radius equal to the number of 'r's in strawberry",
    text={"format": {"type": "text"}},
    tools=[
        {
            "type": "custom",
            "name": "code_exec",
            "description": "Executes arbitrary python code",
        }
    ]
)
print(response.output)


# The model emits a `tool call` containing raw Python. You execute that code server‑side, capture the printed result, and send it back in a follow‑up responses.create call.

# ### 2.3 Mini‑Benchmark – Sorting an Array in Three Languages
# To illustrate the use of free form tool calling, we will ask GPT‑5 to:
# - Generate Python, C++, and Java code that sorts a fixed array 10 times.
# - Print only the time (in ms) taken for each iteration in the code.
# - Call all three functions, and then stop

# In[8]:


from openai import OpenAI
from typing import List, Optional

MODEL_NAME = "gpt-5"

# Tools that will be passed to every model invocation. They are defined once so
# that the configuration lives in a single place.
TOOLS = [
    {
        "type": "custom",
        "name": "code_exec_python",
        "description": "Executes python code",
    },
    {
        "type": "custom",
        "name": "code_exec_cpp",
        "description": "Executes c++ code",
    },
    {
        "type": "custom",
        "name": "code_exec_java",
        "description": "Executes java code",
    },
]

client = OpenAI()

def create_response(
    input_messages: List[dict],
    previous_response_id: Optional[str] = None,
):
    """Wrapper around ``client.responses.create``.

    Parameters
    ----------
    input_messages: List[dict]
        The running conversation history to feed to the model.
    previous_response_id: str | None
        Pass the ``response.id`` from the *previous* call so the model can keep
        the thread of the conversation.  Omit on the very first request.
    """
    kwargs = {
        "model": MODEL_NAME,
        "input": input_messages,
        "text": {"format": {"type": "text"}},
        "tools": TOOLS,
    }
    if previous_response_id:
        kwargs["previous_response_id"] = previous_response_id

    return client.responses.create(**kwargs)

# Recursive
def run_conversation(
    input_messages: List[dict],
    previous_response_id: Optional[str] = None,
):

    response = create_response(input_messages, previous_response_id)

    # ``response.output`` is expected to be a list where element 0 is the model
    # message.  Element 1 (if present) denotes a tool call.  When the model is
    # done with tool calls, that element is omitted.
    tool_call = response.output[1] if len(response.output) > 1 else None

    if tool_call and tool_call.type == "custom_tool_call":
        print("--- tool name ---")
        print(tool_call.name)
        print("--- tool call argument (generated code) ---")
        print(tool_call.input)

        # Add a synthetic *tool result* so the model can continue the thread.

        input_messages.append(
            {
                "type": "function_call_output",
                "call_id": tool_call.call_id,
                "output": "done", # <-- replace with the result of the tool call
            }
        )

        # Recurse with updated conversation and track the response id so the
        # model is aware of the prior turn.
        return run_conversation(input_messages, previous_response_id=response.id)
    else:
        # Base-case: no further tool call - return.
        return


prompt = """
Write code to sort the array of numbers in three languages: C++, Python and Java (10 times each)using code_exec functions.

ALWAYS CALL THESE THREE FUNCTIONS EXACTLY ONCE: code_exec_python, code_exec_cpp and code_exec_java tools to sort the array in each language. Stop once you've called these three functions in each language once.

Print only the time it takes to sort the array in milliseconds.

[448, 986, 255, 884, 632, 623, 246, 439, 936, 925, 644, 159, 777, 986, 706, 723, 534, 862, 195, 686, 846, 880, 970, 276, 613, 736, 329, 622, 870, 284, 945, 708, 267, 327, 678, 807, 687, 890, 907, 645, 364, 333, 385, 262, 730, 603, 945, 358, 923, 930, 761, 504, 870, 561, 517, 928, 994, 949, 233, 137, 670, 555, 149, 870, 997, 809, 180, 498, 914, 508, 411, 378, 394, 368, 766, 486, 757, 319, 338, 159, 585, 934, 654, 194, 542, 188, 934, 163, 889, 736, 792, 737, 667, 772, 198, 971, 459, 402, 989, 949]
"""

# Initial developer message.
messages = [
    {
        "role": "developer",
        "content": prompt,
    }
]

run_conversation(messages)


# The model output three code blocks in Python, C++ and Java for the same algorithm. The output of the function call was chained back into the model as input to allow model to keep going until all the functions have been called exactly once.

# ### 2.4 Takeaways
#
# Freeform tool calling in GPT-5 lets you send raw text payloads—such as Python scripts, SQL queries, or config files—directly to custom tools without JSON wrapping. This provides greater flexibility for interacting with external runtimes and allows the model to generate code or text in the exact format your tool expects. It’s ideal when structured JSON is unnecessary and natural text output improves usability.

# ## 3. Context‑Free Grammar (CFG)
#
# ### 3.1 Overview
# A context‑free grammar is a collection of production rules that define which strings belong to a language. Each rule rewrites a non‑terminal symbol into a sequence of terminals (literal tokens) and/or other non‑terminals, independent of surrounding context—hence context‑free. CFGs can capture the syntax of most programming languages and, in OpenAI custom tools, serve as contracts that force the model to emit only strings that the grammar accepts.
#
# ### 3.2 Grammar Fundamentals
#
# **Supported Grammar Syntax**
# - Lark - https://lark-parser.readthedocs.io/en/stable/
# - Regex - https://docs.rs/regex/latest/regex/#syntax
#
# We use LLGuidance under the hood to constrain model sampling: https://github.com/guidance-ai/llguidance.
#
# **Unsupported Lark Features**
# - Lookaround in regexes (`(?=...)`, `(?!...)`, etc.)
# - Lazy modifier (`*?`, `+?`, `??`) in regexes.
# - Terminal priorities, templates, %declares, %import (except %import common).
#
#
# **Terminals vs Rules & Greedy Lexing**
#
# | Concept          | Take-away                                                                    |
# |------------------|------------------------------------------------------------------------------|
# | Terminals (UPPER)| Matched first by the lexer – longest match wins.                             |
# | Rules (lower)    | Combine terminals; cannot influence how text is tokenised.                   |
# | Greedy lexer     | Never try to “shape” free text across multiple terminals – you’ll lose control. |
#
# ** Correct vs Incorrect Pattern Design
#
# ✅ **One bounded terminal handles free‑text between anchors**
# start: SENTENCE
# SENTENCE: /[A-Za-z, ]*(the hero|a dragon)[A-Za-z, ]*(fought|saved)[A-Za-z, ]*(a treasure|the kingdom)[A-Za-z, ]*\./
#
# ❌ **Don’t split free‑text across multiple terminals/rules**
# start: sentence
# sentence: /[A-Za-z, ]+/ subject /[A-Za-z, ]+/ verb /[A-Za-z, ]+/ object /[A-Za-z, ]+/
#
#
# ### 3.3 Example - SQL Dialect — MS SQL vs PostgreSQL
#
# The following code example is now the canonical reference for building multi‑dialect SQL tools with CFGs. It demonstrates:
#
# - Two isolated grammar definitions (`mssql_grammar_definition`, `postgres_grammar_definition`) encoding TOP vs LIMIT semantics.
# - How to prompt, invoke, and inspect tool calls in a single script.
# - A side‑by‑side inspection of the assistant’s responses.

# Define the LARK grammars for different SQL dialects

# In[9]:


import textwrap

# ----------------- grammars for MS SQL dialect -----------------
mssql_grammar = textwrap.dedent(r"""
            // ---------- Punctuation & operators ----------
            SP: " "
            COMMA: ","
            GT: ">"
            EQ: "="
            SEMI: ";"

            // ---------- Start ----------
            start: "SELECT" SP "TOP" SP NUMBER SP select_list SP "FROM" SP table SP "WHERE" SP amount_filter SP "AND" SP date_filter SP "ORDER" SP "BY" SP sort_cols SEMI

            // ---------- Projections ----------
            select_list: column (COMMA SP column)*
            column: IDENTIFIER

            // ---------- Tables ----------
            table: IDENTIFIER

            // ---------- Filters ----------
            amount_filter: "total_amount" SP GT SP NUMBER
            date_filter: "order_date" SP GT SP DATE

            // ---------- Sorting ----------
            sort_cols: "order_date" SP "DESC"

            // ---------- Terminals ----------
            IDENTIFIER: /[A-Za-z_][A-Za-z0-9_]*/
            NUMBER: /[0-9]+/
            DATE: /'[0-9]{4}-[0-9]{2}-[0-9]{2}'/
    """)

# ----------------- grammars for PostgreSQL dialect -----------------
postgres_grammar = textwrap.dedent(r"""
            // ---------- Punctuation & operators ----------
            SP: " "
            COMMA: ","
            GT: ">"
            EQ: "="
            SEMI: ";"

            // ---------- Start ----------
            start: "SELECT" SP select_list SP "FROM" SP table SP "WHERE" SP amount_filter SP "AND" SP date_filter SP "ORDER" SP "BY" SP sort_cols SP "LIMIT" SP NUMBER SEMI

            // ---------- Projections ----------
            select_list: column (COMMA SP column)*
            column: IDENTIFIER

            // ---------- Tables ----------
            table: IDENTIFIER

            // ---------- Filters ----------
            amount_filter: "total_amount" SP GT SP NUMBER
            date_filter: "order_date" SP GT SP DATE

            // ---------- Sorting ----------
            sort_cols: "order_date" SP "DESC"

            // ---------- Terminals ----------
            IDENTIFIER: /[A-Za-z_][A-Za-z0-9_]*/
            NUMBER: /[0-9]+/
            DATE: /'[0-9]{4}-[0-9]{2}-[0-9]{2}'/
    """)


# ### 3.4 Generate specific SQL dialect
# Let's define the prompt, and call the function to produce MS SQL dialect

# In[10]:


from openai import OpenAI
client = OpenAI()

sql_prompt_mssql = (
    "Call the mssql_grammar to generate a query for Microsoft SQL Server that retrieve the "
    "five most recent orders per customer, showing customer_id, order_id, order_date, and total_amount, "
    "where total_amount > 500 and order_date is after '2025-01-01'. "
)

response_mssql = client.responses.create(
    model="gpt-5",
    input=sql_prompt_mssql,
    text={"format": {"type": "text"}},
    tools=[
        {
            "type": "custom",
            "name": "mssql_grammar",
            "description": "Executes read-only Microsoft SQL Server queries limited to SELECT statements with TOP and basic WHERE/ORDER BY. YOU MUST REASON HEAVILY ABOUT THE QUERY AND MAKE SURE IT OBEYS THE GRAMMAR.",
            "format": {
                "type": "grammar",
                "syntax": "lark",
                "definition": mssql_grammar
            }
        },
    ],
    parallel_tool_calls=False
)

print("--- MS SQL Query ---")
print(response_mssql.output[1].input)


# The output SQL accurately uses "SELECT TOP" construct.

# In[11]:


sql_prompt_pg = (
    "Call the postgres_grammar to generate a query for PostgreSQL that retrieve the "
    "five most recent orders per customer, showing customer_id, order_id, order_date, and total_amount, "
    "where total_amount > 500 and order_date is after '2025-01-01'. "
)

response_pg = client.responses.create(
    model="gpt-5",
    input=sql_prompt_pg,
    text={"format": {"type": "text"}},
    tools=[
        {
            "type": "custom",
            "name": "postgres_grammar",
            "description": "Executes read-only PostgreSQL queries limited to SELECT statements with LIMIT and basic WHERE/ORDER BY. YOU MUST REASON HEAVILY ABOUT THE QUERY AND MAKE SURE IT OBEYS THE GRAMMAR.",
            "format": {
                "type": "grammar",
                "syntax": "lark",
                "definition": postgres_grammar
            }
        },
    ],
    parallel_tool_calls=False,
)

print("--- PG SQL Query ---")
print(response_pg.output[1].input)


# Output highlights the same logical query - different physical syntax. Supply distinct grammars so the model can only produce valid statements for the chosen dialect.
#
# | Dialect       | Generated Query                                              | Key Difference                          |
# |---------------|--------------------------------------------------------------|------------------------------------------|
# | MS SQL Server | SELECT TOP 5 customer_id, … ORDER BY order_date DESC;         | Uses `TOP N` clause before column list.  |
# | PostgreSQL    | SELECT customer_id, … ORDER BY order_date DESC LIMIT 5;       | Uses `LIMIT N` after `ORDER BY`.         |
#
#

# ### 3.5 Example - Regex CFG Syntax
#
# The following code example demonstrates using the Regex CFG syntax to constrain the freeform tool call to a certain timestamp pattern.

# In[12]:


from openai import OpenAI
client = OpenAI()

timestamp_grammar_definition = r"^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01]) (?:[01]\d|2[0-3]):[0-5]\d$"

timestamp_prompt = (
        "Call the timestamp_grammar to save a timestamp for August 7th 2025 at 10AM."
)

response_mssql = client.responses.create(
    model="gpt-5",
    input=timestamp_prompt,
    text={"format": {"type": "text"}},
    tools=[
        {
            "type": "custom",
            "name": "timestamp_grammar",
            "description": "Saves a timestamp in date + time in 24-hr format.",
            "format": {
                "type": "grammar",
                "syntax": "regex",
                "definition": timestamp_grammar_definition
            }
        },
    ],
    parallel_tool_calls=False
)

print("--- Timestamp ---")
print(response_mssql.output[1].input)


# ### 3.5 Best Practices
#
# Lark grammars can be tricky to perfect. While simple grammars perform most reliably, complex grammars often require iteration on the grammar definition itself, the prompt, and the tool description to ensure that the model does not go out of distribution.
#
# - Keep terminals bounded – use `/[^.\n]{0,10}*\./` rather than `/.*\./`. Limit matches both by content (negated character class) and by length (`{M,N}` quantifier).
# - Prefer explicit char‑classes over `.` wildcards.
# - Thread whitespace explicitly, e.g. using `SP = " "`, instead of a global `%ignore`.
# - Describe your tool: tell the model exactly what the CFG accepts and instruct it to reason heavily about compliance.
#
# **Troubleshooting**
# - API rejects the grammar because it is too complex ➜ Simplify rules and terminals, remove `%ignore.*`.
# - Unexpected tokens ➜ Confirm terminals aren’t overlapping; check greedy lexer.
# - When the model drifts "out‑of‑distribution" (shows up as the model producing excessively long or repetitive outputs, it is syntactically valid but is semantically wrong):
#     - Tighten the grammar.
#     - Iterate on the prompt (add few-shot examples) and tool description (explain the grammar and instruct the model to reason to conform to it).
#     - Experiment with a higher reasoning effort (e.g, bump from medium to high).
#
# **Resources:**
# - Lark Docs – https://lark-parser.readthedocs.io/en/stable/
# - Lark IDE – https://www.lark-parser.org/ide/
# - LLGuidance Syntax – https://github.com/guidance-ai/llguidance/blob/main/docs/syntax.md
# - Regex (Rust crate) – https://docs.rs/regex/latest/regex/#syntax

# ### 3.6 Takeaways
#
# Context-Free Grammar (CFG) support in GPT-5 lets you strictly constrain model output to match predefined syntax, ensuring only valid strings are generated. This is especially useful for enforcing programming language rules or custom formats, reducing post-processing and errors. By providing a precise grammar and clear tool description, you can make the model reliably stay within your target output structure.

# ## 4. Minimal Reasoning
#
# ### 4.1 Overview
#
# GPT-5 now support for a new minimal reasoning effort. When using minimal reasoning effort, the model will output very few or no reasoning tokens. This is designed for use cases where developers want a very fast time-to-first-user-visible token. Note: If no reasoning effort is supplied, the default value is medium.

# In[13]:


from openai import OpenAI

client = OpenAI()

prompt = "Classify sentiment of the review as positive|neutral|negative. Return one word only."


response = client.responses.create(
    model="gpt-5",
    input= [{ 'role': 'developer', 'content': prompt },
            { 'role': 'user', 'content': 'The food that the restaurant was great! I recommend it to everyone.' }],
    reasoning = {
        "effort": "minimal"
    },
)

# Extract model's text output
output_text = ""
for item in response.output:
    if hasattr(item, "content"):
        for content in item.content:
            if hasattr(content, "text"):
                output_text += content.text

# Token usage details
usage = response.usage

print("--------------------------------")
print("Output:")
print(output_text)


# ### 4.2 Takeaways
#
# Minimal reasoning runs GPT-5 with few or no reasoning tokens to minimize latency and speed up time-to-first-token. Use it for deterministic, lightweight tasks (extraction, formatting, short rewrites, simple classification) where explanations aren’t needed. If you don’t specify effort, it defaults to medium—set minimal explicitly when you want speed over deliberation.```

#!/usr/bin/env python
# coding: utf-8

# ## Better performance from reasoning models using the Responses API
#
# ### Overview
#
# By leveraging the Responses API with OpenAI’s latest reasoning models, you can unlock higher intelligence, lower costs, and more efficient token usage in your applications. The API also enables access to reasoning summaries, supports features like hosted-tool use, and is designed to accommodate upcoming enhancements for even greater flexibility and performance.
#

#
# We've recently released two new state-of-the-art reasoning models, o3 and o4-mini, that excel at combining reasoning capabilities with agentic tool use. What many folks don't know is that you can improve their performance by fully leveraging our (relatively) new Responses API. This cookbook shows how to get the most out of these models and explores how reasoning and function calling work behind the scenes. By giving the model access to previous reasoning items, we can ensure it operates at maximum intelligence and lowest cost.

# We introduced the Responses API with a separate [cookbook](https://cookbook.openai.com/examples/responses_api/responses_example) and [API reference](https://platform.openai.com/docs/api-reference/responses). The main takeaway: the Responses API is similar to the Completions API, but with improvements and added features. We've also rolled out encrypted content for Responses, making it even more useful for those who can't use the API in a stateful way!

# ## How Reasoning Models work
#
# Before we dive into how the Responses API can help, let's quickly review how [reasoning models](https://platform.openai.com/docs/guides/reasoning?api-mode=responses) work. Models like o3 and o4-mini break problems down step by step, producing an internal chain of thought that encodes their reasoning. For safety, these reasoning tokens are only exposed to users in summarized form.

# In a multistep conversation, the reasoning tokens are discarded after each turn while input and output tokens from each step are fed into the next
#
# ![reasoning-context](../../images/reasoning-turns.png)
# Diagram borrowed from our [doc](https://platform.openai.com/docs/guides/reasoning?api-mode=responses#how-reasoning-works)

# Let us examine the response object being returned:

# In[3]:


from openai import OpenAI
import os
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


# In[3]:


response = client.responses.create(
    model="o4-mini",
    input="tell me a joke",
)


# In[9]:


import json

print(json.dumps(response.model_dump(), indent=2))


# From the JSON dump of the response object, you can see that in addition to the `output_text`, the model also produces a reasoning item. This item represents the model's internal reasoning tokens and is exposed as an ID—here, for example, `rs_6820f383d7c08191846711c5df8233bc0ac5ba57aafcbac7`. Because the Responses API is stateful, these reasoning tokens persist: just include their IDs in subsequent messages to give future responses access to the same reasoning items. If you use `previous_response_id` for multi-turn conversations, the model will automatically have access to all previously produced reasoning items.
#
# You can also see how many reasoning tokens the model generated. For example, with 10 input tokens, the response included 148 output tokens—128 of which are reasoning tokens not shown in the final assistant message.

# Wait—didn’t the diagram show that reasoning from previous turns is discarded? So why bother passing it back in later turns?
#
# Great question! In typical multi-turn conversations, you don’t need to include reasoning items or tokens—the model is trained to produce the best output without them. However, things change when tool use is involved. If a turn includes a function call (which may require an extra round trip outside the API), you do need to include the reasoning items—either via `previous_response_id` or by explicitly adding the reasoning item to `input`. Let’s see how this works with a quick function-calling example.

# In[14]:


import requests

def get_weather(latitude, longitude):
    response = requests.get(f"https://api.open-meteo.com/v1/forecast?latitude={latitude}&longitude={longitude}&current=temperature_2m,wind_speed_10m&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m")
    data = response.json()
    return data['current']['temperature_2m']


tools = [{
    "type": "function",
    "name": "get_weather",
    "description": "Get current temperature for provided coordinates in celsius.",
    "parameters": {
        "type": "object",
        "properties": {
            "latitude": {"type": "number"},
            "longitude": {"type": "number"}
        },
        "required": ["latitude", "longitude"],
        "additionalProperties": False
    },
    "strict": True
}]

context = [{"role": "user", "content": "What's the weather like in Paris today?"}]

response = client.responses.create(
    model="o4-mini",
    input=context,
    tools=tools,
)


response.output


# After some reasoning, the o4-mini model determines it needs more information and calls a function to get it. We can call the function and return its output to the model. Crucially, to maximize the model’s intelligence, we should include the reasoning item by simply adding all of the output back into the context for the next turn.

# In[15]:


context += response.output # Add the response to the context (including the reasoning item)

tool_call = response.output[1]
args = json.loads(tool_call.arguments)


# calling the function
result = get_weather(args["latitude"], args["longitude"])

context.append({
    "type": "function_call_output",
    "call_id": tool_call.call_id,
    "output": str(result)
})

# we are calling the api again with the added function call output. Note that while this is another API call, we consider this as a single turn in the conversation.
response_2 = client.responses.create(
    model="o4-mini",
    input=context,
    tools=tools,
)

print(response_2.output_text)


# While this toy example may not clearly show the benefits—since the model will likely perform well with or without the reasoning item—our own tests found otherwise. On a more rigorous benchmark like SWE-bench, including reasoning items led to about a **3% improvement** for the same prompt and setup.

# ## Caching
#
# As shown above, reasoning models generate both reasoning tokens and completion tokens, which the API handles differently. This distinction affects how caching works and impacts both performance and latency. The following diagram illustrates these concepts:
#
# ![reasoning-context](../../images/responses-diagram.png)

# In turn 2, any reasoning items from turn 1 are ignored and removed, since the model does not reuse reasoning items from previous turns. As a result, the fourth API call in the diagram cannot achieve a full cache hit, because those reasoning items are missing from the prompt. However, including them is harmless—the API will simply discard any reasoning items that aren’t relevant for the current turn. Keep in mind that caching only impacts prompts longer than 1024 tokens. In our tests, switching from the Completions API to the Responses API boosted cache utilization from 40% to 80%. Higher cache utilization leads to lower costs (for example, cached input tokens for `o4-mini` are 75% cheaper than uncached ones) and improved latency.

# ## Encrypted Reasoning Items
#
# Some organizations—such as those with [Zero Data Retention (ZDR)](https://openai.com/enterprise-privacy/) requirements—cannot use the Responses API in a stateful way due to compliance or data retention policies. To support these cases, OpenAI offers [encrypted reasoning items](https://platform.openai.com/docs/guides/reasoning?api-mode=responses#encrypted-reasoning-items), allowing you to keep your workflow stateless while still benefiting from reasoning items.
#
# To use encrypted reasoning items:
# - Add `["reasoning.encrypted_content"]` to the `include` field in your API call.
# - The API will return an encrypted version of the reasoning tokens, which you can pass back in future requests just like regular reasoning items.
#
# For ZDR organizations, OpenAI enforces `store=false` automatically. When a request includes `encrypted_content`, it is decrypted in-memory (never written to disk), used for generating the next response, and then securely discarded. Any new reasoning tokens are immediately encrypted and returned to you, ensuring no intermediate state is ever persisted.
#
# Here’s a quick code update to show how this works:

# In[39]:


context = [{"role": "user", "content": "What's the weather like in Paris today?"}]

response = client.responses.create(
    model="o3",
    input=context,
    tools=tools,
    store=False, #store=false, just like how ZDR is enforced
    include=["reasoning.encrypted_content"] # Encrypted chain of thought is passed back in the response
)


# In[34]:


# take a look at the encrypted reasoning item
print(response.output[0])


# With `include=["reasoning.encrypted_content"]` set, we now see an `encrypted_content` field in the reasoning item being passed back. This encrypted content represents the model's reasoning state, persisted entirely on the client side with OpenAI retaining no data. We can then pass this back just as we did with the reasoning item before.

# In[40]:


context += response.output # Add the response to the context (including the encrypted chain of thought)
tool_call = response.output[1]
args = json.loads(tool_call.arguments)



result = 20 #mocking the result of the function call

context.append({
    "type": "function_call_output",
    "call_id": tool_call.call_id,
    "output": str(result)
})

response_2 = client.responses.create(
    model="o3",
    input=context,
    tools=tools,
    store=False,
    include=["reasoning.encrypted_content"]
)

print(response_2.output_text)


# With a simple change to the `include` field, we can now pass back the encrypted reasoning item and use it to improve the model's performance in intelligence, cost, and latency.
#
# Now you should be fully equipped with the knowledge to fully utilize our latest reasoning models!

# ## Reasoning Summaries
#
# Another useful feature in the Responses API is that it supports reasoning summaries. While we do not expose the raw chain of thought tokens, users can access their [summaries](https://platform.openai.com/docs/guides/reasoning?api-mode=responses#reasoning-summaries).

# In[9]:


# Make a hard call to o3 with reasoning summary included

response = client.responses.create(
    model="o3",
    input="What are the main differences between photosynthesis and cellular respiration?",
    reasoning={"summary": "auto"},


)

# Extract the first reasoning summary text from the response object
first_reasoning_item = response.output[0]  # Should be a ResponseReasoningItem
first_summary_text = first_reasoning_item.summary[0].text if first_reasoning_item.summary else None
print("First reasoning summary text:\n", first_summary_text)



# Reasoning summary text lets you give users a window into the model’s thought process. For example, during conversations with multiple function calls, users can see both which functions were called and the reasoning behind each call—without waiting for the final assistant message. This adds transparency and interactivity to your application’s user experience.

# ## Conclusion
#
# By leveraging the OpenAI Responses API and the latest reasoning models, you can unlock higher intelligence, improved transparency, and greater efficiency in your applications. Whether you’re utilizing reasoning summaries, encrypted reasoning items for compliance, or optimizing for cost and latency, these tools empower you to build more robust and interactive AI experiences.
#
# Happy building!
````
