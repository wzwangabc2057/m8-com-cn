import { GetPromptRequestSchema } from "@modelcontextprotocol/sdk/types.js";

export const writerPrompt = {
  name: "writer",
  description: "Draft a new blog post.",
  arguments: [
    {
      name: "topic",
      description: "Topic of the blog post",
      required: true,
    },
  ],
};

export const getWriterPrompt = (args: any) => {
  const topic = args?.topic || "No topic specified";
  return {
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Please draft a new blog post about: ${topic}.
          
          Follow these steps:
          1. Check existing categories using 'list_categories'.
          2. Ask clarifying questions about the target audience or tone if needed.
          3. Draft the post content in Markdown.
          4. Suggest a title, slug, and excerpt.
          5. Ask for confirmation before creating the post using 'create_post'.`,
        },
      },
    ],
  };
};
