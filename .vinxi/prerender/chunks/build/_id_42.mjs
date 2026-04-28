import { A, S } from './auth-server-B9Po8mn52.mjs';
import 'file:///Users/gaspaco/Downloads/MeloStudio/node_modules/@neondatabase/serverless/index.mjs';

async function i(t) {
  const e = await A(t.request);
  if (!e) return new Response("unauthorized", { status: 401 });
  const r = t.params.id, s = await t.request.json();
  return !s || typeof s != "object" || s.id !== r ? new Response("bad payload", { status: 400 }) : (await S(e, r, s), new Response(null, { status: 204 }));
}

export { i as PUT };
//# sourceMappingURL=_id_42.mjs.map
