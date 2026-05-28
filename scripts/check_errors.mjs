import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const ts = require('typescript');

const opts = ts.getDefaultCompilerOptions();
opts.noEmit = true;
opts.target = ts.ScriptTarget.ES2021;
opts.module = ts.ModuleKind.ESNext;
opts.moduleResolution = ts.ModuleResolutionKind.Bundler;
opts.esModuleInterop = true;
opts.skipLibCheck = true;
opts.types = ['node'];

const files = process.argv.slice(2);
const prog = ts.createProgram(files, opts);
const diags = ts.getPreEmitDiagnostics(prog);

for (const d of diags) {
  const msg = ts.flattenDiagnosticMessageText(d.messageText, '\n');
  const file = d.file
    ? d.file.fileName + '(' + (d.file.getLineAndCharacterOfPosition(d.start).line + 1) + ')'
    : '';
  console.log(file + ': ' + msg);
}
console.log('TOTAL ERRORS: ' + diags.length);