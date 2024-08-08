import { z } from "zod";

const RecipeSchema = z
  .object({
    title: z.string().describe("The title of the recipe of image"),
    ingredients: z
      .array(z.string())
      .describe("A list of ingredients needed for the recipe of image"),
    instructions: z
      .array(z.string())
      .describe("Step-by-step instructions to prepare the recipe of image"),
    preparationTime: z
      .number()
      .min(0)
      .describe("Estimated preparation time in minutes of image"),
    cookingTime: z
      .number()
      .min(0)
      .describe("Estimated cooking time in minutes of image"),
    servings: z
      .number()
      .min(1)
      .describe("Number of servings the recipe yields of image"),
    cuisine: z
      .enum([
        "Italian",
        "Indian",
        "Mexican",
        "Chinese",
        "American",
        "French",
        "Other",
      ])
      .describe("Type of cuisine the recipe belongs to of image"),
    dietaryRestrictions: z
      .array(
        z.enum([
          "Vegetarian",
          "Vegan",
          "Gluten-Free",
          "Dairy-Free",
          "Nut-Free",
          "None",
        ])
      )
      .optional()
      .describe(
        "Optional: Dietary restrictions associated with the recipe of image"
      ),
  })
  .describe("Provide information on the given image");

export default RecipeSchema;

export const config = {
  path: "recipe",
  public: true,
  cache: "Individual",
  contentType: "image",
  model: "gpt-4o-mini",
};
