import { WorkerEntrypoint } from 'cloudflare:workers'
import mapValues from 'just-map-values'

export async function Proxy<T>(
  request: Request,
  secret: string,
  sendRPC: (method: string, args: any[]) => Promise<any>,
) {
  const { pathname } = new URL(request.url)

  const authorization = request.headers.get('Authorization')?.replace(/^Bearer /, '') || ''
  if (authorization !== secret || secret.length !== 64) {
    return new Response('Unauthorized', { status: 401 })
  }

  if (pathname === '/rpc' && request.method === 'POST') {
    const { method, args = [] } = (await request.json()) as { method: keyof WorkerEntrypoint<T>; args?: any[] }

    try {
      const result = await sendRPC(method, args)
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
  //
  // if (pathname === '/resources') {
  //   // @ts-ignore
  //   const resources = (this.worker.constructor.Resources || {}) as Record<string, string | ((e: T) => string)>
  //   return Response.json(mapValues(resources, (v) => (typeof v === 'function' ? v(this.env) : v)))
  // }
  //
  // const resourcePath = pathname.match(/^\/resources\/(\w+)$/)
  // if (resourcePath) {
  //   const [_, resourceName] = resourcePath
  //   // @ts-ignore
  //   const resource = (this.worker.constructor.Resources || {})[resourceName]
  //   if (!resource) {
  //     return new Response(null, { status: 404 })
  //   }
  //
  //   const response = typeof resource === 'function' ? resource(this.env) : resource
  //   return new Response(response)
  // }

  return new Response(null, { status: 404 })
}
