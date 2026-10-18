import {z} from 'zod';

// Only the bounded JSON types used by the extraction contract are supported.
// Fail closed if that contract introduces an unsupported Zod type.
export function extractionSchemaJson(schema:z.ZodTypeAny):Record<string,unknown>{
  if(schema instanceof z.ZodNullable){const inner=extractionSchemaJson(schema.unwrap());return {...inner,type:[inner.type,'null']};}
  if(schema instanceof z.ZodBoolean)return {type:'boolean'};
  if(schema instanceof z.ZodEnum)return {type:'string',enum:schema.options};
  if(schema instanceof z.ZodString){
    const result:Record<string,unknown>={type:'string'},rules:string[]=[];
    // Gemini documents these string constraints as guidance rather than enforced keywords.
    for(const check of schema._def.checks){if(check.kind==='min')rules.push(`At least ${check.value} characters`);if(check.kind==='max')rules.push(`At most ${check.value} characters`);if(check.kind==='regex')rules.push(`Match ${check.regex.source}`);}
    if(rules.length)result.description=rules.join('. ');
    return result;
  }
  if(schema instanceof z.ZodNumber){
    const result:Record<string,unknown>={type:'number'};
    for(const check of schema._def.checks){if(check.kind==='int')result.type='integer';if(check.kind==='min'){result.minimum=check.value;if(!check.inclusive)result.description=`Strictly greater than ${check.value}`;}if(check.kind==='max')result.maximum=check.value;}
    return result;
  }
  if(schema instanceof z.ZodArray)return {type:'array',items:extractionSchemaJson(schema.element),...(schema._def.minLength?{minItems:schema._def.minLength.value}:{}),...(schema._def.maxLength?{maxItems:schema._def.maxLength.value}:{})};
  if(schema instanceof z.ZodObject){const shape=schema.shape as Record<string,z.ZodTypeAny>;return {type:'object',properties:Object.fromEntries(Object.entries(shape).map(([key,value])=>[key,extractionSchemaJson(value)])),required:Object.keys(shape),additionalProperties:false};}
  throw new Error('Unsupported extraction schema type');
}
