// Edits the early-resolve.template.json inline and adds the minifed code of early-resolve.js to it

import * as fs from 'fs';
import { minify } from 'minify';

const SOURCE = 'early-resolve.js';
const TARGET = 'early-resolve.template.json';

(async () => {
  const emptyTemplate = JSON.parse(fs.readFileSync(TARGET).toString());
  emptyTemplate.Resources.Transformer.Properties.InlineCode = await minify(SOURCE);
  fs.writeFileSync(TARGET, Buffer.from(JSON.stringify(emptyTemplate, null, 2)));
})()
