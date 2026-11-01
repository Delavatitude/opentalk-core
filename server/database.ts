import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

export const schemas = Object.fromEntries(readdirSync(new URL('./schemas/', import.meta.url)).map(name => {
  const schema = JSON.parse(readFileSync(new URL('./schemas/' + name, import.meta.url), 'utf8'));
  return [schema.name, schema];
}));
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status=status; }
}
const field = (key: string) => {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) throw new HttpError(400, 'invalid_field');
  return `json_extract(data, '$.${key}')`;
};
function where(filter: any, args: any[]): string {
  if (!filter || typeof filter !== 'object' || Array.isArray(filter)) throw new HttpError(400, 'invalid_filter');
  return Object.entries(filter).map(([key, value]: any) => {
    if (key === '$or' || key === '$and') {
      if (!Array.isArray(value) || !value.length || value.length > 50) throw new HttpError(400, 'invalid_filter');
      return '(' + value.map(v => where(v, args)).join(key === '$or' ? ' OR ' : ' AND ') + ')';
    }
    const expression = field(key);
    if (value && typeof value === 'object') {
      return '(' + Object.entries(value).map(([op, v]: any) => {
        if (op === '$in') {
          if (!Array.isArray(v) || v.length > 100) throw new HttpError(400, 'invalid_filter');
          if (!v.length) return '0';
          args.push(...v.map(bind)); return `${expression} IN (${v.map(() => '?').join(',')})`;
        }
        const operators = {$gte:'>=', $lte:'<=', $gt:'>', $lt:'<', $ne:'!='};
        if (!operators[op]) throw new HttpError(400, 'invalid_filter');
        args.push(bind(v)); return `${expression} ${operators[op]} ?`;
      }).join(' AND ') + ')';
    }
    if (value === null) return `${expression} IS NULL`;
    args.push(bind(value)); return `${expression} = ?`;
  }).join(' AND ') || '1';
}
const bind = (v: any) => typeof v === 'boolean' ? Number(v) : v;
function validate(name: string, input: any, create: boolean) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new HttpError(400, 'invalid_record');
  const schema = schemas[name];
  const output: any = {};
  if (create) for (const [key, spec] of Object.entries(schema.properties) as any) if ('default' in spec) output[key] = structuredClone(spec.default);
  for (const [key, value] of Object.entries(input) as any) {
    if (value === undefined || ['id','created_date','updated_date','created_by'].includes(key)) continue;
    const spec = schema.properties[key];
    if (key.startsWith('_')) continue;
    // Historical operational fields are retained, but cannot become SQL identifiers.
    field(key);
    if (key.length > 100) throw new HttpError(400, 'invalid_field');
    if (spec && value !== null) {
      if (spec.type === 'array' ? !Array.isArray(value) : spec.type && typeof value !== spec.type) throw new HttpError(400, 'invalid_' + key);
      if (spec.enum && !spec.enum.includes(value)) throw new HttpError(400, 'invalid_' + key);
      if (typeof value === 'number' && (!Number.isFinite(value) || (spec.minimum !== undefined && value < spec.minimum) || (spec.maximum !== undefined && value > spec.maximum))) throw new HttpError(400, 'invalid_' + key);
    }
    output[key] = value;
  }
  if (name === 'BookingType') {
    for (const key of ['duration','booking_window_days','max_per_day']) if(output[key] !== undefined && (!Number.isInteger(output[key]) || output[key]<1 || output[key]>(key==='duration'?1440:3650))) throw new HttpError(400,'invalid_'+key);
    for (const key of ['buffer_before','buffer_after','minimum_notice_minutes']) if(output[key] !== undefined && (!Number.isFinite(output[key]) || output[key]<0 || output[key]>525600)) throw new HttpError(400,'invalid_'+key);
  }
  return output;
}
export function openDatabase(path = process.env.DATABASE_PATH || './data/opentalk.sqlite') {
  if (path !== ':memory:') mkdirSync(dirname(path), {recursive:true, mode:0o700});
  const sql = new DatabaseSync(path);
  sql.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS records (entity TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL CHECK(json_valid(data)), PRIMARY KEY(entity,id));
    CREATE INDEX IF NOT EXISTS records_entity ON records(entity);
    CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','user')));
    CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, window INTEGER NOT NULL, count INTEGER NOT NULL);
    PRAGMA user_version=1;`);
  // Executed in SQLite's write transaction, shared by all processes using this file.
  // Buffers are frozen per booking; a later type edit does not change accepted reservations.
  for (const operation of ['INSERT','UPDATE']) sql.exec(`
    CREATE TRIGGER IF NOT EXISTS booking_overlap_${operation.toLowerCase()} BEFORE ${operation} ON records
    WHEN NEW.entity='Booking' AND json_extract(NEW.data,'$.status') IN ('confirmed','rescheduled')
    BEGIN
      SELECT CASE WHEN json_extract(NEW.data,'$._busy_start') IS NULL OR json_extract(NEW.data,'$._busy_end') IS NULL
        OR json_extract(NEW.data,'$._busy_start') >= json_extract(NEW.data,'$._busy_end') THEN RAISE(ABORT,'invalid_booking_interval') END;
      SELECT CASE WHEN EXISTS(SELECT 1 FROM records r WHERE r.entity='Booking' AND r.id != NEW.id
        AND json_extract(r.data,'$.status') IN ('confirmed','rescheduled')
        AND json_extract(r.data,'$._busy_start') < json_extract(NEW.data,'$._busy_end')
        AND json_extract(r.data,'$._busy_end') > json_extract(NEW.data,'$._busy_start')) THEN RAISE(ABORT,'booking_conflict') END;
    END;`);
  const get = (entity: string, id: string) => {
    const row = sql.prepare('SELECT data FROM records WHERE entity=? AND id=?').get(entity,id);
    if (!row) throw new HttpError(404, 'record_not_found');
    return JSON.parse(row.data as string);
  };
  const write = (entity: string, data: any, insert: boolean) => {
    if (entity === 'Booking') {
      const start=Date.parse(data.start_at), end=Date.parse(data.end_at);
      if (!Number.isFinite(start) || !Number.isFinite(end) || start>=end) throw new HttpError(400,'invalid_booking_interval');
      const type=get('BookingType',data.booking_type_id);
      data._busy_start=start-(data._buffer_before ?? type.buffer_before ?? 0)*60000;
      data._busy_end=end+(data._buffer_after ?? type.buffer_after ?? 0)*60000;
      data._buffer_before=data._buffer_before ?? type.buffer_before ?? 0;
      data._buffer_after=data._buffer_after ?? type.buffer_after ?? 0;
    }
    try {
      if (insert) sql.prepare('INSERT INTO records(entity,id,data) VALUES(?,?,?)').run(entity,data.id,JSON.stringify(data));
      else sql.prepare('UPDATE records SET data=? WHERE entity=? AND id=?').run(JSON.stringify(data),entity,data.id);
    } catch (error) {
      if (String(error.message).includes('booking_conflict')) throw new HttpError(409,'booking_conflict');
      throw error;
    }
    return data;
  };
  const entities = Object.fromEntries(Object.keys(schemas).filter(n=>n!=='User').map(entity => [entity,{
    get: async (id: string) => get(entity,id),
    filter: async (filter={}, sort='created_date', limit=10000, skip=0) => {
      const args: any[] = [entity]; const condition=where(filter,args);
      if (!Number.isInteger(limit) || limit<1 || limit>10000 || !Number.isInteger(skip) || skip<0) throw new HttpError(400,'invalid_pagination');
      sort=sort || 'created_date';
      const sortField=field(sort.replace(/^-/,''));
      return sql.prepare(`SELECT data FROM records WHERE entity=? AND ${condition} ORDER BY ${sortField} ${sort.startsWith('-')?'DESC':'ASC'}, id LIMIT ? OFFSET ?`).all(...args,limit,skip).map(r=>JSON.parse(r.data as string));
    },
    list: async (sort='created_date', limit=10000, skip=0) => entities[entity].filter({},sort,limit,skip),
    create: async (input: any) => {
      const now=new Date().toISOString();const data={...validate(entity,input,true),id:randomUUID(),created_date:now,updated_date:now};
      for (const key of schemas[entity].required || []) if(data[key]===undefined || data[key]===null || data[key]==='') throw new HttpError(400,'required_'+key);
      return write(entity,data,true);
    },
    update: async (id: string,input: any) => write(entity,{...get(entity,id),...validate(entity,input,false),updated_date:new Date().toISOString()},false),
    updateMany: async (filter: any, patch: any) => {
      const rows=await entities[entity].filter(filter);
      sql.exec('BEGIN IMMEDIATE');
      try {for(const row of rows)write(entity,{...get(entity,row.id),...validate(entity,patch.$set || patch,false),updated_date:new Date().toISOString()},false);sql.exec('COMMIT');return {updated:rows.length};}
      catch(error){sql.exec('ROLLBACK');throw error;}
    },
    delete: async (id: string) => { get(entity,id);sql.prepare('DELETE FROM records WHERE entity=? AND id=?').run(entity,id);return {ok:true}; }
  }]));
  return {sql,entities,close:()=>sql.close()};
}
