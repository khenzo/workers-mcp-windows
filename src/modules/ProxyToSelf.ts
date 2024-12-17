import { WorkerEntrypoint } from 'cloudflare:workers'
import { Proxy } from './Proxy'

export class ProxyToSelf<T extends { SHARED_SECRET: string }> {
  env: T

  constructor(readonly worker: WorkerEntrypoint<T>) {
    // @ts-ignore 'env' is protected but that's just Typescript being nanny-state. I AM THE LAW.
    this.env = worker.env
    // But seriously though there's probably 100 better ways of doing this but this whole shim
    // should be deleted once MCP Remote servers are properly specced so it's fine for now...
  }

  async fetch(request: Request): Promise<Response> {
    return Proxy(request, this.env.SHARED_SECRET, (method, args) => {
      // @ts-ignore
      const methodReference = this.worker[method] as ((...args: any[]) => any) | undefined
      if (!methodReference) {
        throw new Error(`WorkerEntrypoint ${this.worker.constructor.name} has no method '${method}'`)
      }

      // @ts-ignore
      return this.worker[method].call(this.worker, ...args)
    })
  }
}
