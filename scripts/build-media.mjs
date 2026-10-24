import {build} from 'esbuild';
await build({entryPoints:['creative-export.js'],bundle:true,format:'esm',target:'es2022',platform:'browser',minify:true,legalComments:'inline',outfile:'creative-media.bundle.js',banner:{js:'/*! Includes Mediabunny, copyright Vanilagy, MPL-2.0. License: /creative-media-notices.txt */'}});
