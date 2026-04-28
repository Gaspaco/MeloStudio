import{neon as c}from"@neondatabase/serverless";const i=process.env.DATABASE_URL;if(!i)throw new Error("DATABASE_URL env var is required");const s=c(i),r=1;function d(a,t){const e=new Date().toISOString();return{schemaVersion:r,id:a,name:t,createdAt:e,updatedAt:e,transport:{bpm:120,timeSig:[4,4],playheadSec:0},master:{gainDb:0},tracks:[],assets:[]}}async function u(a){return(await s`
    SELECT id, name, bpm, updated_at
    FROM projects
    WHERE user_id = ${a}
    ORDER BY updated_at DESC
    LIMIT 200
  `).map(e=>({id:e.id,name:e.name,bpm:e.bpm,updatedAt:e.updated_at}))}async function p(a,t){return(await s`
    SELECT data FROM projects
    WHERE id = ${t} AND user_id = ${a}
    LIMIT 1
  `)[0]?.data??null}async function m(a,t){const n=(await s`
    INSERT INTO projects (user_id, name, bpm, data, schema_ver)
    VALUES (${a}, ${t}, 120, '{}'::jsonb, ${r})
    RETURNING id
  `)[0].id,o=d(n,t);return await s`
    UPDATE projects SET data = ${JSON.stringify(o)}::jsonb
    WHERE id = ${n}
  `,o}async function S(a,t,e){if(e.id!==t)throw new Error("doc.id must match projectId");const n=JSON.stringify({...e,schemaVersion:r,updatedAt:new Date().toISOString()});await s.transaction([s`
      UPDATE projects
      SET data = ${n}::jsonb,
          name = ${e.name},
          bpm = ${e.transport.bpm},
          schema_ver = ${r}
      WHERE id = ${t} AND user_id = ${a}
    `,s`
      INSERT INTO project_versions (project_id, data, schema_ver)
      VALUES (${t}, ${n}::jsonb, ${r})
    `])}async function $(a,t){await s`
    DELETE FROM projects
    WHERE id = ${t} AND user_id = ${a}
  `}async function A(a){const t=a.headers.get("x-user-id");return t&&t.length>0&&t.length<200?t:null}export{m as c,$ as d,p as g,u as l,A as r,S as s};
