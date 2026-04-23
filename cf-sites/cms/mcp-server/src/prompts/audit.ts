import { GetPromptRequestSchema } from "@modelcontextprotocol/sdk/types.js";

export const auditPrompt = {
  name: "audit",
  description: "Perform a site content and SEO audit.",
  arguments: [],
};

export const getAuditPrompt = () => {
  return {
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Please perform a site audit.
          
          1. Call 'get_site_config' to check SEO settings.
          2. Call 'list_posts' to review recent posts.
          3. Identify posts missing excerpts or featured images.
          4. Call 'get_analytics' for traffic trends.
          5. Provide a summary report with recommendations.`,
        },
      },
    ],
  };
};
