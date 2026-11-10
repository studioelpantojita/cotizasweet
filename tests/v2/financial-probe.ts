// Invoked by run_quality.py; compares TS output with an independent integer oracle.
import {readFileSync} from 'node:fs';
import {totals, createQuoteSchema} from '../../web/lib/quote';
const input=JSON.parse(readFileSync(process.argv[3], 'utf8'));
const result={totals:input.valid.map((q:unknown)=>totals(createQuoteSchema.parse(q))), invalidAccepted:input.invalid.map((q:unknown)=>createQuoteSchema.safeParse(q).success)};
process.stdout.write(JSON.stringify(result));
