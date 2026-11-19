import {z} from 'zod';

// Preserve strict CSP in browsers. Zod's optional JIT probes dynamic code execution.
z.config({jitless:true});

export {z};
