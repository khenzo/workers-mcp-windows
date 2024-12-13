import { WorkerEntrypoint } from 'cloudflare:workers'
import mapValues from 'just-map-values'

export class ProxyToSelf<T extends { SHARED_SECRET: string }> {
  env: T

  constructor(readonly worker: WorkerEntrypoint<T>) {
    // @ts-ignore 'env' is protected but that's just Typescript being nanny-state. I AM THE LAW.
    this.env = worker.env
    // But seriously though there's probably 100 better ways of doing this but this whole shim
    // should be deleted once MCP Remote servers are properly specced so it's fine for now...
  }

  async fetch(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url)

    const authorization = request.headers.get('Authorization')?.replace(/^Bearer /, '') || ''
    if (authorization !== this.env.SHARED_SECRET || this.env.SHARED_SECRET.length !== 64) {
      return new Response('Unauthorized', { status: 401 })
    }

    if (pathname === '/rpc' && request.method === 'POST') {
      const { method, args = [] } = (await request.json()) as { method: keyof WorkerEntrypoint<T>; args?: any[] }

      const methodReference = this.worker[method] as ((...args: any[]) => any) | undefined
      if (!methodReference) {
        return Response.json({
          toolResult: {
            content: [
              { type: 'text', text: `WorkerEntrypoint ${this.worker.constructor.name} has no method '${method}'` },
            ],
            isError: true,
          },
        })
      }

      try {
        const result = await methodReference.call(this.worker, ...args)
        if (result instanceof Response) {
          return result
        } else if (typeof result === 'string') {
          return new Response(result)
        } else {
          return Response.json(result)
        }
      } catch (e) {
        return Response.json({
          content: [
            { type: 'text', text: (e as Error).message },
            { type: 'text', text: JSON.stringify((e as Error).stack) },
          ],
          isError: true,
        })
      }
    }

    if (pathname === '/resources') {
      // @ts-ignore
      const resources = (this.worker.constructor.Resources || {}) as Record<string, string | ((e: T) => string)>
      return Response.json(mapValues(resources, (v) => (typeof v === 'function' ? v(this.env) : v)))
    }

    const resourcePath = pathname.match(/^\/resources\/(\w+)$/)
    if (resourcePath) {
      const [_, resourceName] = resourcePath
      // @ts-ignore
      const resource = (this.worker.constructor.Resources || {})[resourceName]
      if (!resource) {
        return new Response(null, { status: 404 })
      }

      const response = typeof resource === 'function' ? resource(this.env) : resource
      return new Response(response)
    }

    return new Response(null, { status: 404 })
  }
}
