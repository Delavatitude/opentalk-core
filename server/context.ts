import {AsyncLocalStorage} from 'node:async_hooks';
export const requestContext = new AsyncLocalStorage<any>();
export function createClientFromRequest(_req: Request) {
  const context=requestContext.getStore();
  if(!context)throw new Error('request_context_required');
  return context;
}
