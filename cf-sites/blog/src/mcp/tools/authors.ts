import { zodToJsonSchema } from 'zod-to-json-schema';
import { Env } from '../../types.js';
import { getAuthors, putAuthors } from '../../services/meta.js';
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
  list_authors: async (args: any, env: Env) => {
    const { siteId = env.SITE_ID, ...params } = ListAuthorsSchema.parse(args);
    const authors = await getAuthors(env.CONTENT_BUCKET, siteId);
    return {
      content: [{ type: "text", text: JSON.stringify(authors, null, 2) }],
    };
  },
  create_author: async (args: any, env: Env) => {
    const { siteId = env.SITE_ID, ...data } = CreateAuthorSchema.parse(args);
    const authors = await getAuthors(env.CONTENT_BUCKET, siteId);
    
    const id = data.id || data.name.toLowerCase().replace(/\s+/g, '-');
    if (authors.find(a => a.id === id)) {
      throw new Error(`Author ${id} already exists`);
    }

    authors.push({
      id,
      name: data.name,
      bio: data.bio || '',
      avatar: data.avatar,
      email: data.email,
      url: data.url,
      social: [], // TODO: Support social links in schema
      count: 0,
    });

    await putAuthors(env.CONTENT_BUCKET, siteId, authors);

    return {
      content: [{ type: "text", text: `Author created successfully. ID: ${id}` }],
    };
  },
  update_author: async (args: any, env: Env) => {
    const { siteId = env.SITE_ID, id, ...data } = UpdateAuthorSchema.parse(args);
    const authors = await getAuthors(env.CONTENT_BUCKET, siteId);
    
    const idx = authors.findIndex(a => a.id === id);
    if (idx < 0) throw new Error(`Author ${id} not found`);

    authors[idx] = { ...authors[idx], ...data };
    await putAuthors(env.CONTENT_BUCKET, siteId, authors);

    return {
      content: [{ type: "text", text: `Author updated successfully.` }],
    };
  },
  delete_author: async (args: any, env: Env) => {
    const { siteId = env.SITE_ID, id } = DeleteAuthorSchema.parse(args);
    const authors = await getAuthors(env.CONTENT_BUCKET, siteId);
    
    const idx = authors.findIndex(a => a.id === id);
    if (idx < 0) throw new Error(`Author ${id} not found`);

    authors.splice(idx, 1);
    await putAuthors(env.CONTENT_BUCKET, siteId, authors);

    return {
      content: [{ type: "text", text: `Author deleted successfully.` }],
    };
  },
};
