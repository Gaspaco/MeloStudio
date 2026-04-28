import { A, p, S } from './auth-server-B9Po8mn5.mjs';
import 'file:///Users/gaspaco/Downloads/MeloStudio/node_modules/@neondatabase/serverless/index.mjs';

async function d(s) {
  const t = await A(s.request);
  if (!t) return new Response("unauthorized", { status: 401 });
  const a = s.params.id, n = await s.request.json(), e = await p(t, a);
  return e ? (n.name !== void 0 && (e.name = n.name), await S(t, a, e), new Response(null, { status: 204 })) : new Response("not found", { status: 404 });
}

export { d as PATCH };
//# sourceMappingURL=_id_3.mjs.map
