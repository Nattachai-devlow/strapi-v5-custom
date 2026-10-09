const PREFIX = 'b64:';

type Where = Record<string, any>;

const ENCODE_OPS = new Set(['$eq', '$ne']);
const ARRAY_ENCODE_OPS = new Set(['$in', '$nin']);

const getStrapi = (): any => (globalThis as any).strapi;

const encodeValue = (v: unknown): unknown => {
  if (typeof v !== 'string' || v.startsWith(PREFIX)) return v;
  return PREFIX + Buffer.from(v, 'utf8').toString('base64');
};

const decodeValue = (v: unknown): unknown => {
  if (typeof v !== 'string' || !v.startsWith(PREFIX)) return v;
  return Buffer.from(v.slice(PREFIX.length), 'base64').toString('utf8');
};

const isPlainObject = (v: unknown): v is Record<string, any> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const maskValue = (v: unknown, keep: number): unknown => {
  if (typeof v !== 'string' || keep < 1) return v;
  if (v.length <= keep) return 'x'.repeat(v.length);
  return v.slice(0, v.length - keep) + 'x'.repeat(keep);
};

type SecurityContext = {
  fields: Set<string>;
  getRelationContext: (relKey: string) => SecurityContext | undefined;
};

const createSecurityContext = (uid: string): SecurityContext => {
  const fields = new Set(secureFieldsRegistry[uid] ?? []);
  const getRelationContext = (relKey: string): SecurityContext | undefined => {
    const attr = getStrapi()?.contentTypes?.[uid]?.attributes?.[relKey];
    if (!attr || attr.type !== 'relation' || typeof attr.target !== 'string') return undefined;
    const targetUid = attr.target as string;
    if (!secureFieldsRegistry[targetUid]) return undefined;
    return createSecurityContext(targetUid);
  };
  return { fields, getRelationContext };
};

const transformWhereValue = (
  value: any,
  ctx: SecurityContext
): any => {
  if (value === null || value === undefined) return value;

  if (typeof value !== 'object') return encodeValue(value);

  if (Array.isArray(value)) {
    return value.map((v) => transformWhereValue(v, ctx));
  }

  const out: Where = {};
  for (const [op, opVal] of Object.entries(value)) {
    if (ENCODE_OPS.has(op)) {
      out[op] = opVal === null || opVal === undefined ? opVal : encodeValue(opVal);
    } else if (ARRAY_ENCODE_OPS.has(op)) {
      out[op] = Array.isArray(opVal) ? opVal.map((v) => (v === null ? v : encodeValue(v))) : encodeValue(opVal);
    } else if (op === '$not' && isPlainObject(opVal)) {
      out[op] = transformWhereValue(opVal, ctx);
    } else if (op === '$and' || op === '$or') {
      out[op] = Array.isArray(opVal)
        ? opVal.map((v) => transformWhere(v, ctx))
        : transformWhere(opVal, ctx);
    } else {
      out[op] = opVal;
    }
  }
  return out;
};

const transformWhere = (where: any, ctx: SecurityContext): any => {
  if (!where || !isPlainObject(where)) return where;

  const out: Where = {};
  for (const [key, value] of Object.entries(where)) {
    if (key === '$and' || key === '$or') {
      out[key] = Array.isArray(value)
        ? value.map((v) => transformWhere(v, ctx))
        : transformWhere(value, ctx);
    } else if (key === '$not') {
      out[key] = transformWhere(value, ctx);
    } else if (ctx.fields.has(key)) {
      out[key] = transformWhereValue(value, ctx);
    } else if (isPlainObject(value)) {
      const relCtx = ctx.getRelationContext(key);
      out[key] = relCtx ? transformWhere(value, relCtx) : value;
    } else {
      out[key] = value;
    }
  }
  return out;
};

const encodeDataObj = (data: Record<string, any>, fields: Set<string>): Record<string, any> => {
  const out: Record<string, any> = { ...data };
  for (const f of fields) {
    if (f in out) out[f] = encodeValue(out[f]);
  }
  return out;
};

const decodeInPlace = (obj: Record<string, any>, uid: string): void => {
  const fields = secureFieldsRegistry[uid];
  if (fields) {
    for (const f of fields) {
      if (f in obj) obj[f] = decodeValue(obj[f]);
    }
  }
  const masks = maskRegistry[uid];
  if (masks) {
    for (const [f, keep] of Object.entries(masks)) {
      if (f in obj) obj[f] = maskValue(obj[f], keep);
    }
  }
  const attrs = getStrapi()?.contentTypes?.[uid]?.attributes;
  if (!attrs) return;
  for (const [key, attr] of Object.entries(attrs)) {
    if (attr && (attr as any).type === 'relation' && (attr as any).target && obj[key] != null) {
      const targetUid = (attr as any).target as string;
      if (!secureFieldsRegistry[targetUid]) continue;
      if (Array.isArray(obj[key])) {
        for (const item of obj[key]) {
          if (isPlainObject(item)) decodeInPlace(item, targetUid);
        }
      } else if (isPlainObject(obj[key])) {
        decodeInPlace(obj[key] as Record<string, any>, targetUid);
      }
    }
  }
};

const secureFieldsRegistry: Record<string, string[]> = {};
const maskRegistry: Record<string, Record<string, number>> = {};

const looksMasked = (v: unknown, keep: number): boolean => {
  if (typeof v !== 'string' || !keep || v.length < keep + 1) return false;
  return [...v.slice(-keep)].every((ch) => ch === 'x');
};

const sameDocWhere = (where: any) => {
  if (!where) return {};
  if (Array.isArray(where)) {
    const first = where[0];
    if (first && typeof first === 'object') return first;
  }
  return where;
};

type RawKey = { id?: any; documentId?: any };

const rawKeyFromWhere = (where: any): RawKey | null => {
  const w = sameDocWhere(where);
  if (!w || typeof w !== 'object') return null;
  const key: RawKey = {};
  if (w.id !== undefined) key.id = w.id;
  if (w.documentId !== undefined) key.documentId = w.documentId;
  return key.id !== undefined || key.documentId !== undefined ? key : null;
};

const readRawRows = async (uid: string, key: RawKey): Promise<Record<string, any>[]> => {
  const strapi = getStrapi();
  if (!strapi?.db?.queryBuilder) return [];
  const w: Record<string, any> = {};
  if (key.id !== undefined) w.id = key.id;
  if (key.documentId !== undefined) w.documentId = key.documentId;
  if (!Object.keys(w).length) return [];
  try {
    // queryBuilder bypasses lifecycle hooks (returns raw encoded values) while
    // still participating in the ongoing transaction, so it can see the draft
    // value that was just written earlier in the same update+publish transaction.
    const res = await strapi.db.queryBuilder(uid).where(w).execute();
    return Array.isArray(res) ? res : res ? [res] : [];
  } catch {
    return [];
  }
};

/**
 * Detects masked display values (e.g. "095362xxxx") being written back to the DB
 * and restores the real stored value. This covers both the Content Manager
 * write-back flow (beforeUpdate) and Strapi's internal read-modify-write publish
 * flow, which reads the draft through the decode+mask lifecycle and then creates
 * the published entry from that masked value (beforeCreate).
 */
const resolveMaskedWriteBack = async (
  uid: string,
  masks: Record<string, number>,
  key: RawKey,
  data: Record<string, any>
): Promise<void> => {
  const pending = Object.entries(masks).filter(([f, keep]) => data[f] != null && looksMasked(data[f], keep));
  if (!pending.length) return;
  const strapi = getStrapi();
  if (!strapi?.db?.queryBuilder) return;

  let rows = await readRawRows(uid, key);
  const docIds = [...new Set(rows.map((r) => r.documentId).filter((v) => v != null))];
  for (const documentId of docIds) {
    rows = rows.concat(await readRawRows(uid, { documentId }));
  }
  if (!rows.length) return;

  for (const [field, keep] of pending) {
    const target = data[field];
    let chosen: string | undefined;
    for (const row of rows) {
      const real = decodeValue(row[field]);
      if (typeof real !== 'string' || maskValue(real, keep) !== target) continue;
      if (chosen === undefined || looksMasked(chosen, keep)) chosen = real;
      if (!looksMasked(real, keep)) break;
    }
    if (chosen !== undefined) data[field] = chosen;
  }
};

export const createSecureLifecycle = (uid: string, fields: string[], masks: Record<string, number> = {}) => {
  secureFieldsRegistry[uid] = fields;
  maskRegistry[uid] = masks;
  const ctx = createSecurityContext(uid);

  const encWhere = (where: any) => transformWhere(where, ctx);
  const encData = (data: any) =>
    Array.isArray(data)
      ? data.map((d) => (isPlainObject(d) ? encodeDataObj(d, ctx.fields) : d))
      : isPlainObject(data) && data
        ? encodeDataObj(data, ctx.fields)
        : data;

  const decResult = (result: any, isMany: boolean) => {
    if (isMany) {
      if (Array.isArray(result)) {
        for (const item of result) {
          if (isPlainObject(item)) decodeInPlace(item, uid);
        }
      }
    } else if (isPlainObject(result)) {
      decodeInPlace(result, uid);
    }
  };

  return {
    async beforeCreate(event: any) {
      const data = event.params?.data;
      if (data && typeof data === 'object' && data.documentId !== undefined) {
        await resolveMaskedWriteBack(uid, masks, { documentId: data.documentId }, data);
      }
      if (event.params?.data) event.params.data = encData(event.params.data);
    },
    async beforeCreateMany(event: any) {
      const data = event.params?.data;
      if (Array.isArray(data)) {
        for (const item of data) {
          if (isPlainObject(item) && item.documentId !== undefined) {
            await resolveMaskedWriteBack(uid, masks, { documentId: item.documentId }, item);
          }
        }
      }
      if (event.params?.data) event.params.data = encData(event.params.data);
    },
    async beforeUpdate(event: any) {
      const where = event.params?.where;
      const data = event.params?.data;
      if (data && typeof data === 'object') {
        const key = rawKeyFromWhere(where);
        if (key) await resolveMaskedWriteBack(uid, masks, key, data);
      }
      if (event.params?.data) event.params.data = encData(event.params.data);
      if (event.params?.where) event.params.where = encWhere(event.params.where);
    },
    async beforeUpdateMany(event: any) {
      const where = event.params?.where;
      const data = event.params?.data;
      if (data && typeof data === 'object') {
        const key = rawKeyFromWhere(where);
        if (key) await resolveMaskedWriteBack(uid, masks, key, data);
      }
      if (event.params?.data) event.params.data = encData(event.params.data);
      if (event.params?.where) event.params.where = encWhere(event.params.where);
    },
    beforeDelete(event: any) {
      if (event.params?.where) event.params.where = encWhere(event.params.where);
    },
    beforeDeleteMany(event: any) {
      if (event.params?.where) event.params.where = encWhere(event.params.where);
    },
    beforeFindOne(event: any) {
      if (event.params?.where) event.params.where = encWhere(event.params.where);
    },
    beforeFindMany(event: any) {
      if (event.params?.where) event.params.where = encWhere(event.params.where);
    },
    beforeCount(event: any) {
      if (event.params?.where) event.params.where = encWhere(event.params.where);
    },
    afterFindOne(event: any) {
      decResult(event.result, false);
    },
    afterFindMany(event: any) {
      decResult(event.result, true);
    },
    afterCreate(event: any) {
      decResult(event.result, false);
    },
    afterCreateMany(event: any) {
      decResult(event.result, true);
    },
    afterUpdate(event: any) {
      decResult(event.result, false);
    },
    afterUpdateMany(event: any) {
      decResult(event.result, true);
    },
    afterCount() {},
  };
};