import { zodToJsonSchema } from 'zod-to-json-schema';
import { Env } from '../../types.js';
import { getTags, putTags } from '../../services/meta.js';
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
  list_tags: async (args: any, env: Env) => {
    const { siteId = env.SITE_ID, ...params } = ListTagsSchema.parse(args);
    const tags = await getTags(env.CONTENT_BUCKET, siteId);
    return {
      content: [{ type: "text", text: JSON.stringify(tags, null, 2) }],
    };
  },
  create_tag: async (args: any, env: Env) => {
    const { siteId = env.SITE_ID, ...data } = CreateTagSchema.parse(args);
    const tags = await getTags(env.CONTENT_BUCKET, siteId);
    
    if (tags.find(t => t.slug === data.slug)) {
      throw new Error(`Tag ${data.slug} already exists`);
    }

    tags.push({
      slug: data.slug || data.name.toLowerCase().replace(/\s+/g, '-'),
      name: data.name,
      description: data.description || '',
      featuredImage: data.featuredImage,
      count: 0,
    });

    await putTags(env.CONTENT_BUCKET, siteId, tags);

    return {
      content: [{ type: "text", text: `Tag created successfully.` }],
    };
  },
  update_tag: async (args: any, env: Env) => {
    const { siteId = env.SITE_ID, slug, ...data } = UpdateTagSchema.parse(args);
    const tags = await getTags(env.CONTENT_BUCKET, siteId);
    
    const idx = tags.findIndex(t => t.slug === slug);
    if (idx < 0) throw new Error(`Tag ${slug} not found`);

    tags[idx] = { ...tags[idx], ...data };
    await putTags(env.CONTENT_BUCKET, siteId, tags);

    return {
      content: [{ type: "text", text: `Tag updated successfully.` }],
    };
  },
  delete_tag: async (args: any, env: Env) => {
    const { siteId = env.SITE_ID, slug } = DeleteTagSchema.parse(args);
    const tags = await getTags(env.CONTENT_BUCKET, siteId);
    
    const idx = tags.findIndex(t => t.slug === slug);
    if (idx < 0) throw new Error(`Tag ${slug} not found`);

    tags.splice(idx, 1);
    await putTags(env.CONTENT_BUCKET, siteId, tags);

    return {
      content: [{ type: "text", text: `Tag deleted successfully.` }],
    };
  },
};
