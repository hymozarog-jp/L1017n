import {database,rpc,supplier,fieldsSchema,checkFields,scheduleJob} from './supplier.ts';
import {createHandler} from './handler.mjs';
const hash=async(token:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))).map(x=>x.toString(16).padStart(2,'0')).join('');
Deno.serve(createHandler({database,rpc,supplier,fieldsSchema,checkFields,scheduleJob,hash}));
