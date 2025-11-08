// RESUME_MARKER: CHK_2
/* eslint-disable @typescript-eslint/no-explicit-any */

export class ValidationError extends Error {}

function assertCondition(condition: boolean, message: string): void {
  if (!condition) {
    throw new ValidationError(message);
  }
}

function formatPath(path: string): string {
  return path || '<root>';
}

function validateInternal(instance: any, schema: Record<string, any>, path: string): void {
  const schemaType = schema.type;
  if (schemaType === 'object' || (schemaType == null && schema.properties)) {
    assertCondition(isPlainObject(instance), `${path || '<root>'} must be an object`);
    const required: string[] = Array.isArray(schema.required) ? schema.required : [];
    for (const field of required) {
      const fieldPath = path ? `${path}.${field}` : field;
      assertCondition(Object.prototype.hasOwnProperty.call(instance, field), `Missing required field ${fieldPath}`);
    }
    const properties: Record<string, any> = schema.properties || {};
    for (const [key, value] of Object.entries(instance)) {
      if (properties && Object.prototype.hasOwnProperty.call(properties, key)) {
        const childPath = path ? `${path}.${key}` : key;
        validateInternal(value, properties[key], childPath);
      }
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(instance)) {
        if (!Object.prototype.hasOwnProperty.call(properties, key)) {
          const fieldPath = path ? `${path}.${key}` : key;
          assertCondition(false, `Unexpected field ${fieldPath}`);
        }
      }
    }
    return;
  }
  if (schemaType === 'array') {
    assertCondition(Array.isArray(instance), `${formatPath(path)} must be an array`);
    if (typeof schema.minItems === 'number') {
      assertCondition(
        instance.length >= schema.minItems,
        `${formatPath(path)} must have at least ${schema.minItems} items`
      );
    }
    if (typeof schema.maxItems === 'number') {
      assertCondition(
        instance.length <= schema.maxItems,
        `${formatPath(path)} must have at most ${schema.maxItems} items`
      );
    }
    if (schema.items) {
      instance.forEach((item: any, idx: number) => {
        validateInternal(item, schema.items, `${path}[${idx}]`);
      });
    }
    return;
  }
  if (schemaType === 'boolean') {
    assertCondition(typeof instance === 'boolean', `${formatPath(path)} must be a boolean`);
    return;
  }
  if (schemaType === 'number') {
    assertCondition(typeof instance === 'number', `${formatPath(path)} must be a number`);
    return;
  }
  if (schemaType === 'string') {
    assertCondition(typeof instance === 'string', `${formatPath(path)} must be a string`);
    if (Array.isArray(schema.enum)) {
      assertCondition(schema.enum.includes(instance), `${formatPath(path)} must be one of ${schema.enum}`);
    }
    return;
  }
  if (Array.isArray(schema.enum)) {
    assertCondition(schema.enum.includes(instance), `${formatPath(path)} must be one of ${schema.enum}`);
    return;
  }
}

function isPlainObject(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validate(instance: any, schema: Record<string, any>): void {
  validateInternal(instance, schema, '');
}

export default { validate, ValidationError };
