import { zodToJsonSchema } from 'zod-to-json-schema';
import { Env } from '../../types.js';
import { getCollections, putCollections } from '../../services/meta.js';
import { ListCollectionsSchema, CreateCollectionSchema, UpdateCollectionSchema, DeleteCollectionSchema } from '../schemas/collections.js';

export const definitions = [
  {
    name: "list_collections",
    description: "List collections for a site.",
    inputSchema: zodToJsonSchema(ListCollectionsSchema),
  },
  {
    name: "create_collection",
    description: "Create a new collection.",
    inputSchema: zodToJsonSchema(CreateCollectionSchema),
  },
  {
    name: "update_collection",
    description: "Update an existing collection.",
    inputSchema: zodToJsonSchema(UpdateCollectionSchema),
  },
  {
    name: "delete_collection",
    description: "Delete a collection.",
    inputSchema: zodToJsonSchema(DeleteCollectionSchema),
  },
];

export const handlers = {
  list_collections: async (args: any, env: Env) => {
    const { siteId = env.SITE_ID, ...params } = ListCollectionsSchema.parse(args);
    const collections = await getCollections(env.CONTENT_BUCKET, siteId);
    return {
      content: [{ type: "text", text: JSON.stringify(collections, null, 2) }],
    };
  },
  create_collection: async (args: any, env: Env) => {
    const { siteId = env.SITE_ID, ...data } = CreateCollectionSchema.parse(args);
    const collections = await getCollections(env.CONTENT_BUCKET, siteId);
    
    const key = data.key || data.name.toLowerCase().replace(/\s+/g, '-');
    if (collections.find(c => c.key === key)) {
      throw new Error(`Collection ${key} already exists`);
    }

    collections.push({
      key,
      name: data.name,
      description: data.description || '',
      coverImage: data.coverImage,
      order: data.order || 0,
    });

    await putCollections(env.CONTENT_BUCKET, siteId, collections);

    return {
      content: [{ type: "text", text: `Collection created successfully. Key: ${key}` }],
    };
  },
  update_collection: async (args: any, env: Env) => {
    const { siteId = env.SITE_ID, key, ...data } = UpdateCollectionSchema.parse(args);
    const collections = await getCollections(env.CONTENT_BUCKET, siteId);
    
    const idx = collections.findIndex(c => c.key === key);
    if (idx < 0) throw new Error(`Collection ${key} not found`);

    collections[idx] = { ...collections[idx], ...data };
    await putCollections(env.CONTENT_BUCKET, siteId, collections);

    return {
      content: [{ type: "text", text: `Collection updated successfully.` }],
    };
  },
  delete_collection: async (args: any, env: Env) => {
    const { siteId = env.SITE_ID, key } = DeleteCollectionSchema.parse(args);
    const collections = await getCollections(env.CONTENT_BUCKET, siteId);
    
    const idx = collections.findIndex(c => c.key === key);
    if (idx < 0) throw new Error(`Collection ${key} not found`);

    collections.splice(idx, 1);
    await putCollections(env.CONTENT_BUCKET, siteId, collections);

    return {
      content: [{ type: "text", text: `Collection deleted successfully.` }],
    };
  },
};
