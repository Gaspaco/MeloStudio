import { A, u } from './auth-server-B9Po8mn52.mjs';
import 'file:///Users/gaspaco/Downloads/MeloStudio/node_modules/@neondatabase/serverless/index.mjs';

async function a(e) {
  const s = await A(e.request);
  if (!s) return new Response("unauthorized", { status: 401 });
  const t = await u(s);
  return Response.json(t);
}

export { a as GET };
//# sourceMappingURL=index3.mjs.map
