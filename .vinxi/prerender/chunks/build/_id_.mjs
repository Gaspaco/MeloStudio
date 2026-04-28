import { A, $ } from './auth-server-B9Po8mn5.mjs';
import 'file:///Users/gaspaco/Downloads/MeloStudio/node_modules/@neondatabase/serverless/index.mjs';

async function u(e) {
  const r = await A(e.request);
  return r ? (await $(r, e.params.id), new Response(null, { status: 204 })) : new Response("unauthorized", { status: 401 });
}

export { u as DELETE };
//# sourceMappingURL=_id_.mjs.map
