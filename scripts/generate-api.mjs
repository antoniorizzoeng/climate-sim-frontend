import { writeFile } from 'node:fs/promises';
import openapiTS, { astToString } from 'openapi-typescript';
import ts from 'typescript';
import prettier from 'prettier';

const target = new URL('../src/lib/schema.ts', import.meta.url);
const schema = await openapiTS(new URL('../api/openapi.yaml', import.meta.url), {
  defaultNonNullable: false,
  transform(node) {
    if (node.type === 'string' && node.format === 'binary')
      return ts.factory.createTypeReferenceNode('Blob');
  },
});
await writeFile(
  target,
  await prettier.format(
    '// Generated from api/openapi.yaml by npm run api:generate.\n' +
      astToString(schema),
    { ...(await prettier.resolveConfig(target.pathname)), parser: 'typescript' },
  ),
);
