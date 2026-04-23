import { zodToJsonSchema } from 'zod-to-json-schema';
import { Env } from '../../types.js';
import { getCategories, putCategories } from '../../services/meta.js';
import { ListCategoriesSchema, CreateCategorySchema, UpdateCategorySchema, DeleteCategorySchema } from '../schemas/categories.js';

export const definitions = [
  {
    name: "list_categories",
    description: "List categories for a site.",
    inputSchema: zodToJsonSchema(ListCategoriesSchema),
  },
  {
    name: "create_category",
    description: "Create a new category.",
    inputSchema: zodToJsonSchema(CreateCategorySchema),
  },
  {
    name: "update_category",
    description: "Update an existing category.",
    inputSchema: zodToJsonSchema(UpdateCategorySchema),
  },
  {
    name: "delete_category",
    description: "Delete a category.",
    inputSchema: zodToJsonSchema(DeleteCategorySchema),
  },
];

export const handlers = {
  list_categories: async (args: any, env: Env) => {
    const { siteId = env.SITE_ID, ...params } = ListCategoriesSchema.parse(args);
    const categories = await getCategories(env.CONTENT_BUCKET, siteId);
    return {
      content: [{ type: "text", text: JSON.stringify(categories, null, 2) }],
    };
  },
  create_category: async (args: any, env: Env) => {
    const { siteId = env.SITE_ID, ...data } = CreateCategorySchema.parse(args);
    const categories = await getCategories(env.CONTENT_BUCKET, siteId);
    
    if (categories.find(c => c.slug === data.slug)) {
      throw new Error(`Category ${data.slug} already exists`);
    }

    categories.push({
      slug: data.slug || data.name.toLowerCase().replace(/\s+/g, '-'),
      name: data.name,
      description: data.description || '',
      featuredImage: data.featuredImage,
      count: 0,
    });

    await putCategories(env.CONTENT_BUCKET, siteId, categories);

    return {
      content: [{ type: "text", text: `Category created successfully.` }],
    };
  },
  update_category: async (args: any, env: Env) => {
    const { siteId = env.SITE_ID, slug, ...data } = UpdateCategorySchema.parse(args);
    const categories = await getCategories(env.CONTENT_BUCKET, siteId);
    
    const idx = categories.findIndex(c => c.slug === slug);
    if (idx < 0) throw new Error(`Category ${slug} not found`);

    categories[idx] = { ...categories[idx], ...data };
    await putCategories(env.CONTENT_BUCKET, siteId, categories);

    return {
      content: [{ type: "text", text: `Category updated successfully.` }],
    };
  },
  delete_category: async (args: any, env: Env) => {
    const { siteId = env.SITE_ID, slug } = DeleteCategorySchema.parse(args);
    const categories = await getCategories(env.CONTENT_BUCKET, siteId);
    
    const idx = categories.findIndex(c => c.slug === slug);
    if (idx < 0) throw new Error(`Category ${slug} not found`);

    categories.splice(idx, 1);
    await putCategories(env.CONTENT_BUCKET, siteId, categories);

    return {
      content: [{ type: "text", text: `Category deleted successfully.` }],
    };
  },
};
