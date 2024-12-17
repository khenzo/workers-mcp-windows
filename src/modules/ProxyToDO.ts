import { WorkerEntrypoint } from 'cloudflare:workers'
import { Proxy } from './Proxy'

type IndexStrategy =
  | {
      prependSessionID: boolean
    }
  | {
      fixedName: string
    }

export class ProxyToDO<T extends { SHARED_SECRET: string }> {
  constructor(
    readonly env: T,
    readonly namespace_key: keyof T,
    readonly index_strategy: IndexStrategy,
  ) {}

  async fetch(request: Request) {
    return Proxy(request, this.env.SHARED_SECRET, (method, args) => {
      const ns = this.env[this.namespace_key] as DurableObjectNamespace
      if ('prependSessionID' in this.index_strategy) {
        const [session_id, ...rest] = args
        const stub = ns.get(ns.idFromName(session_id))
        return stub[method](...rest)
      } else {
        const stub = ns.get(ns.idFromName(this.index_strategy.fixedName))
        return stub[method](...args)
      }
    })
  }
}
