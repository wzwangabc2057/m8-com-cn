import { zodToJsonSchema } from 'zod-to-json-schema';
import { api } from '../lib/api.js';
import { DEFAULT_SITE_ID } from '../config.js';
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
  list_collections: async (args: any) => {
    const { siteId = DEFAULT_SITE_ID, ...params } = ListCollectionsSchema.parse(args);
    const res = await api.get('/collections', { params: { siteId, ...params } });
    return {
      content: [{ type: "text", text: JSON.stringify(res.data.collections || res.data, null, 2) }],
    };
  },
  create_collection: async (args: any) => {
    const { siteId = DEFAULT_SITE_ID, ...data } = CreateCollectionSchema.parse(args);
    const res = await api.post('/collections', data, { params: { siteId } });
    return {
      content: [{ type: "text", text: `Collection created successfully. Key: ${res.data.key || 'unknown'}` }],
    };
  },
  update_collection: async (args: any) => {
    const { siteId = DEFAULT_SITE_ID, key, ...data } = UpdateCollectionSchema.parse(args);
    await api.put(`/collections/${key}`, data, { params: { siteId } });
    return {
      content: [{ type: "text", text: `Collection updated successfully.` }],
    };
  },
  delete_collection: async (args: any) => {
    const { siteId = DEFAULT_SITE_ID, key } = DeleteCollectionSchema.parse(args);
    await api.delete(`/collections/${key}`, { params: { siteId } });
    return {
      content: [{ type: "text", text: `Collection deleted successfully.` }],
    };
  },
};
