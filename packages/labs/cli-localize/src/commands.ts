/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */

/**
 * The implementations of our commands exposed in the Lit CLI.
 *
 * These are in their own module so that we can separate out lightweight
 * metadata about the commands (which are used for the --help command,
 * and argument parsing), from their actual implementations here, because
 * loading all of our deps of the implementation takes time, and loading all
 * of the deps of all of the implementations of _every_ command would seriously
 * slow down the CLI.
 */

import {
  readConfigFileAndWriteSchema,
  Config,
  TransformOutputConfig,
  RuntimeOutputConfig,
} from '@lit/localize-tools/lib/config.js';
import {TransformLitLocalizer} from '@lit/localize-tools/lib/modes/transform.js';
import {RuntimeLitLocalizer} from '@lit/localize-tools/lib/modes/runtime.js';
import {KnownError, unreachable} from '@lit/localize-tools/lib/error.js';
import {LitLocalizer} from '@lit/localize-tools/lib/index.js';
import {printDiagnostics} from '@lit/localize-tools/lib/typescript.js';

export const build = async (configPath: string, console: Console) => {
  const config = readConfigFileAndWriteSchema(configPath);
  const localizer = makeLocalizer(config);
  console.log('Building');
  const {errors} = localizer.validateTranslations();
  if (errors.length > 0) {
    // TODO(aomarks) It might be more friendly to replace these invalid
    // localized templates with the source ones, show the errors and return
    // non-zero, but still continue with the rest of the process so that at
    // least some of the app can work during development.
    throw new KnownError(
      'One or more localized templates contain a set of placeholders ' +
        '(HTML or template literal expressions) that do not exactly match ' +
        'the source code, aborting. Details:\n\n' +
        errors.join('\n')
    );
  }
  await localizer.build();
};

export const extract = async (configPath: string, console: Console) => {
  const config = readConfigFileAndWriteSchema(configPath);
  const localizer = makeLocalizer(config);
  // TODO(aomarks) Don't even require the user to have configured their output
  // mode if they're just doing extraction.
  console.log('Extracting messages');
  const {messages, errors} = localizer.extractSourceMessages();
  if (errors.length > 0) {
    printDiagnostics(errors);
    throw new KnownError('Error analyzing program');
  }
  console.log(`Extracted ${messages.length} messages`);
  console.log(`Writing interchange files`);
  await localizer.writeInterchangeFiles();
};

const makeLocalizer = (config: Config): LitLocalizer => {
  switch (config.output.mode) {
    case 'transform':
      return new TransformLitLocalizer(
        // TODO(aomarks) Unfortunate that TypeScript doesn't automatically do
        // this type narrowing. Because the union is on a nested property?
        config as Config & {output: TransformOutputConfig}
      );
    case 'runtime':
      return new RuntimeLitLocalizer(
        config as Config & {output: RuntimeOutputConfig}
      );
    default:
      throw new KnownError(
        `Internal error: unknown mode ${
          (unreachable(config.output) as Config['output']).mode
        }`
      );
  }
};
