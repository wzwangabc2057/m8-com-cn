import { zodToJsonSchema } from 'zod-to-json-schema';
import { api } from '../lib/api.js';
import { DEFAULT_SITE_ID } from '../config.js';
import { ListTagsSchema, CreateTagSchema, UpdateTagSchema, DeleteTagSchema } from '../schemas/tags.js';

export const definitions = [
  {
    name: "list_tags",
    description: "List tags for a site.",
    inputSchema: zodToJsonSchema(ListTagsSchema),
  },
  {
    name: "create_tag",
    description: "Create a new tag.",
    inputSchema: zodToJsonSchema(CreateTagSchema),
  },
  {
    name: "update_tag",
    description: "Update an existing tag.",
    inputSchema: zodToJsonSchema(UpdateTagSchema),
  },
  {
    name: "delete_tag",
    description: "Delete a tag.",
    inputSchema: zodToJsonSchema(DeleteTagSchema),
  },
];

export const handlers = {
  list_tags: async (args: any) => {
    const { siteId = DEFAULT_SITE_ID, ...params } = ListTagsSchema.parse(args);
    const res = await api.get('/tags', { params: { siteId, ...params } });
    return {
      content: [{ type: "text", text: JSON.stringify(res.data.tags || res.data, null, 2) }],
    };
  },
  create_tag: async (args: any) => {
    const { siteId = DEFAULT_SITE_ID, ...data } = CreateTagSchema.parse(args);
    const res = await api.post('/tags', data, { params: { siteId } });
    return {
      content: [{ type: "text", text: `Tag created successfully. Slug: ${res.data.slug || 'unknown'}` }],
    };
  },
  update_tag: async (args: any) => {
    const { siteId = DEFAULT_SITE_ID, slug, ...data } = UpdateTagSchema.parse(args);
    await api.put(`/tags/${slug}`, data, { params: { siteId } });
    return {
      content: [{ type: "text", text: `Tag updated successfully.` }],
    };
  },
  delete_tag: async (args: any) => {
    const { siteId = DEFAULT_SITE_ID, slug } = DeleteTagSchema.parse(args);
    await api.delete(`/tags/${slug}`, { params: { siteId } });
    return {
      content: [{ type: "text", text: `Tag deleted successfully.` }],
    };
  },
};
