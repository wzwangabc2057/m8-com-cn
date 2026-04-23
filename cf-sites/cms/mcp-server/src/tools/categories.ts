import { zodToJsonSchema } from 'zod-to-json-schema';
import { api } from '../lib/api.js';
import { DEFAULT_SITE_ID } from '../config.js';
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
  list_categories: async (args: any) => {
    const { siteId = DEFAULT_SITE_ID, ...params } = ListCategoriesSchema.parse(args);
    const res = await api.get('/categories', { params: { siteId, ...params } });
    return {
      content: [{ type: "text", text: JSON.stringify(res.data.categories || res.data, null, 2) }],
    };
  },
  create_category: async (args: any) => {
    const { siteId = DEFAULT_SITE_ID, ...data } = CreateCategorySchema.parse(args);
    const res = await api.post('/categories', data, { params: { siteId } });
    return {
      content: [{ type: "text", text: `Category created successfully. Slug: ${res.data.slug || 'unknown'}` }],
    };
  },
  update_category: async (args: any) => {
    const { siteId = DEFAULT_SITE_ID, slug, ...data } = UpdateCategorySchema.parse(args);
    await api.put(`/categories/${slug}`, data, { params: { siteId } });
    return {
      content: [{ type: "text", text: `Category updated successfully.` }],
    };
  },
  delete_category: async (args: any) => {
    const { siteId = DEFAULT_SITE_ID, slug } = DeleteCategorySchema.parse(args);
    await api.delete(`/categories/${slug}`, { params: { siteId } });
    return {
      content: [{ type: "text", text: `Category deleted successfully.` }],
    };
  },
};
