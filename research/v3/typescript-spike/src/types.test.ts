import type { Snapshot } from './core.js';
// @ts-expect-error production must stay disabled
const invalid: Snapshot = {value:'hello',production_go:true};
void invalid;
