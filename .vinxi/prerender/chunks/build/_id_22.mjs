import { A, p } from './auth-server-B9Po8mn52.mjs';
import 'file:///Users/gaspaco/Downloads/MeloStudio/node_modules/@neondatabase/serverless/index.mjs';

async function i(s) {
  const t = await A(s.request);
  if (!t) return new Response("unauthorized", { status: 401 });
  const r = s.params.id, e = await p(t, r);
  return e ? Response.json(e) : new Response("not found", { status: 404 });
}

export { i as GET };
//# sourceMappingURL=_id_22.mjs.map
