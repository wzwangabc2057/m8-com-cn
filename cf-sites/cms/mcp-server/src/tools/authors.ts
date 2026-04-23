import { zodToJsonSchema } from 'zod-to-json-schema';
import { api } from '../lib/api.js';
import { DEFAULT_SITE_ID } from '../config.js';
import { ListAuthorsSchema, CreateAuthorSchema, UpdateAuthorSchema, DeleteAuthorSchema } from '../schemas/authors.js';

export const definitions = [
  {
    name: "list_authors",
    description: "List authors for a site.",
    inputSchema: zodToJsonSchema(ListAuthorsSchema),
  },
  {
    name: "create_author",
    description: "Create a new author.",
    inputSchema: zodToJsonSchema(CreateAuthorSchema),
  },
  {
    name: "update_author",
    description: "Update an existing author.",
    inputSchema: zodToJsonSchema(UpdateAuthorSchema),
  },
  {
    name: "delete_author",
    description: "Delete an author.",
    inputSchema: zodToJsonSchema(DeleteAuthorSchema),
  },
];

export const handlers = {
  list_authors: async (args: any) => {
    const { siteId = DEFAULT_SITE_ID, ...params } = ListAuthorsSchema.parse(args);
    const res = await api.get('/authors', { params: { siteId, ...params } });
    return {
      content: [{ type: "text", text: JSON.stringify(res.data.authors || res.data, null, 2) }],
    };
  },
  create_author: async (args: any) => {
    const { siteId = DEFAULT_SITE_ID, ...data } = CreateAuthorSchema.parse(args);
    const res = await api.post('/authors', data, { params: { siteId } });
    return {
      content: [{ type: "text", text: `Author created successfully. ID: ${res.data.id || 'unknown'}` }],
    };
  },
  update_author: async (args: any) => {
    const { siteId = DEFAULT_SITE_ID, id, ...data } = UpdateAuthorSchema.parse(args);
    await api.put(`/authors/${id}`, data, { params: { siteId } });
    return {
      content: [{ type: "text", text: `Author updated successfully.` }],
    };
  },
  delete_author: async (args: any) => {
    const { siteId = DEFAULT_SITE_ID, id } = DeleteAuthorSchema.parse(args);
    await api.delete(`/authors/${id}`, { params: { siteId } });
    return {
      content: [{ type: "text", text: `Author deleted successfully.` }],
    };
  },
};
