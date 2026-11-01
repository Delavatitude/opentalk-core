import {requestContext} from './context.ts';
export function waitUntil(promise: Promise<any>) {
  const context=requestContext.getStore();
  const task=Promise.resolve(promise).catch(()=>console.error('background_task_failed'));
  if(context)context.pending.push(task);
}
