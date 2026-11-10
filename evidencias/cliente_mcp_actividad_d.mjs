import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const out = process.argv[2];
const memFile = process.argv[3];
const p = spawn('cmd', ['/c', 'npx', '-y', '@modelcontextprotocol/server-memory'], {
  stdio: ['pipe', 'pipe', 'inherit'],
  env: { ...process.env, MEMORY_FILE_PATH: memFile },
});
let buf = '';
const pending = new Map();
p.stdout.on('data', d => {
  buf += d;
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (!line) continue;
    const m = JSON.parse(line);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  }
});
let id = 0;
const send = (method, params) => new Promise(res => {
  const mid = ++id;
  pending.set(mid, res);
  p.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: mid, method, params }) + '\n');
});
const log = [];
const rec = (s) => { log.push(s); console.log(s); };

const init = await send('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'practica1-cliente', version: '1.0' } });
rec('# initialize -> servidor: ' + JSON.stringify(init.result.serverInfo) + ', protocolo ' + init.result.protocolVersion);
p.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

const tools = await send('tools/list', {});
rec('# tools/list -> ' + tools.result.tools.length + ' herramientas: ' + tools.result.tools.map(t => t.name).join(', '));

async function call(name, args) {
  rec('\n## tools/call ' + name + '\nargumentos: ' + JSON.stringify(args));
  const r = await send('tools/call', { name, arguments: args });
  rec('resultado: ' + JSON.stringify(r.result ?? r.error, null, 1).slice(0, 1500));
}
await call('create_entities', { entities: [
  { name: 'Practica 1 MCP', entityType: 'proyecto', observations: ['Conecta servidores MCP a un agente'] },
  { name: 'filesystem', entityType: 'servidor MCP', observations: ['Solo accede a la carpeta de la practica'] },
  { name: 'playwright', entityType: 'servidor MCP', observations: ['Controla un navegador'] },
] });
await call('create_relations', { relations: [
  { from: 'Practica 1 MCP', to: 'filesystem', relationType: 'usa' },
  { from: 'Practica 1 MCP', to: 'playwright', relationType: 'usa' },
] });
await call('add_observations', { observations: [
  { entityName: 'filesystem', contents: ['Rechaza rutas fuera de la carpeta permitida (Access denied)'] },
] });
await call('read_graph', {});
await call('search_nodes', { query: 'servidor' });
writeFileSync(out, log.join('\n') + '\n', 'utf8');
p.kill();
process.exit(0);
