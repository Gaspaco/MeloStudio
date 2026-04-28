import { A, m } from './auth-server-B9Po8mn52.mjs';
import 'file:///Users/gaspaco/Downloads/MeloStudio/node_modules/@neondatabase/serverless/index.mjs';

async function u(t) {
  var _a, _b;
  const e = await A(t.request);
  if (!e) return new Response("unauthorized", { status: 401 });
  const s = ((_b = (_a = await t.request.json().catch(() => ({}))) == null ? void 0 : _a.name) != null ? _b : "Untitled Project").toString().slice(0, 100), o = await m(e, s);
  return Response.json(o, { status: 201 });
}

export { u as POST };
//# sourceMappingURL=index22.mjs.map
