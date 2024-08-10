import type { LoaderFunction, ActionFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useActionData, Form, useSubmit } from "@remix-run/react";
import { getAllImageUrls, getRecipe, uploadToS3 } from "./utils/server"; // Adjust the import path as necessary
import { useState, useEffect } from "react"; // Import useState for managing the current image index and recipe visibility, and useRef for file input reference

// Loader function to fetch all image URLs
export const loader: LoaderFunction = async () => {
  try {
    const imageUrls = await getAllImageUrls();

    // Fetch recipes for all image URLs
    const recipeDataPromises = imageUrls.map(url => getRecipe(url));
    const recipeData = await Promise.all(recipeDataPromises);

    return json({ imageUrls, recipeData });
  } catch (error) {
    console.error("Loader error:", error);
    return json({ error: "Failed to load data" }, { status: 500 });
  }
};


export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  const file = formData.get("file") as File;



  if (!file) {
    return json({ error: "No file uploaded" }, { status: 400 });
  }

  try {
    const key = `uploads/${Date.now()}-${file.name}`;
    const fileUrl = await uploadToS3(file, key);
    if (fileUrl) {
      const recipeData = await getRecipe(fileUrl);
      return json({ success: true, fileUrl, recipeData });
    }
    return json({ error: "Failed to upload file" }, { status: 500 });
  } catch (error) {
    console.error("Error uploading file:", error);
    return json({ error: "Failed to upload file" }, { status: 500 });
  }
};

function FileUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const actionData = useActionData();
  const submit = useSubmit(); // Initialize submit function

  useEffect(() => {
    if (actionData?.success) {
      setNotification("File uploaded successfully!");
      const timer = setTimeout(() => {
        setNotification(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [actionData]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setFile(event.target.files[0]);
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (file) {
      const formData = new FormData();
      formData.append("file", file);
      submit(formData, { method: "post", encType: "multipart/form-data" });
    }
  };

  return (
    <div className="flex flex-col items-center relative">
      <Form method="post" encType="multipart/form-data" onSubmit={handleSubmit} className="flex items-center">
        <input type="file" name="file" onChange={handleFileChange} className="file-input file-input-bordered file-input-primary w-full max-w-xs" />
        <button type="submit" className="btn btn-primary ml-2">
          Upload to S3
        </button>
      </Form>
      {notification && (
        <div className="absolute bottom-[-40px] left-0 right-0 mt-2 p-2 bg-pink-100 text-pink-700 rounded w-full max-w-xs text-center">
          {notification}
        </div>
      )}
    </div>
  );
}

export default function Index() {
  const { imageUrls, recipeData } = useLoaderData<typeof loader>();
  const [currentIndex, setCurrentIndex] = useState(0); // State to track the current image index
  const [showRecipe, setShowRecipe] = useState(false); // State to control recipe visibility
  const [localImageUrls, setLocalImageUrls] = useState(imageUrls);
  const [localRecipeData, setLocalRecipeData] = useState(recipeData);
  const actionData = useActionData<typeof action>();


  useEffect(() => {

    if (actionData?.success) {
      setLocalImageUrls([actionData.fileUrl, ...localImageUrls]);
      setLocalRecipeData([actionData.recipeData, ...localRecipeData]);
    }
  }, [actionData]);

  const handleNext = () => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % imageUrls.length); // Move to the next image
    setShowRecipe(false); // Reset recipe visibility when changing images
  };

  const handlePrev = () => {
    setCurrentIndex((prevIndex) => (prevIndex - 1 + imageUrls.length) % imageUrls.length); // Move to the previous image
    setShowRecipe(false); // Reset recipe visibility when changing images
  };

  const handleGenerateRecipe = () => {
    setShowRecipe(true); // Show the recipe when the button is pressed
    console.log("Generating recipe for:", localImageUrls[currentIndex]);
  };

  return (
    <div className="flex flex-col items-center justify-center w-full h-screen">
      <div className="flex w-full p-4 h-3/4">
        <div className="w-full h-full p-4 border border-gray-300 shadow-2xl rounded-lg flex flex-col"> {/* Fixed height for left box */}
          <h2 className="text-xl mb-2 text-center">Images</h2>
          <div className="flex-grow flex items-center justify-center"> {/* Flex-grow to fill space */}
            <img src={localImageUrls[currentIndex]} alt="Recipe Image" className="w-96 h-96 object-cover" /> {/* Increased standardized size */}
          </div>
          <div className="flex justify-between mt-4"> {/* Buttons at the bottom */}
            <button onClick={handlePrev} className="btn">Previous</button>
            <button onClick={handleNext} className="btn">Next</button>
          </div>
        </div>
        <div className="w-full h-full p-4 border border-gray-300 shadow-2xl rounded-lg flex flex-col items-center"> {/* Fixed height for right box */}
          <h2 className="text-xl mb-2">Generate Recipe</h2>
          <button onClick={handleGenerateRecipe} className="btn btn-primary mt-4">Generate Recipe</button>
          {showRecipe && localRecipeData[currentIndex] && ( // Display recipe data only if showRecipe is true
            <div className="mt-4 w-full h-full overflow-auto"> {/* Ensure recipe box fits and scrolls if necessary */}
              <RecipeCard recipe={localRecipeData[currentIndex]} />
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-row items-center justify-center w-full h-1/4">
        <FileUploader />
      </div>
    </div>
  );
}

const RecipeCard = ({ recipe }) => {
  return (
    <div className="bg-base-100 p-2 rounded-lg shadow-lg h-full flex flex-col text-sm">
      <h3 className="text-lg font-bold mb-1 text-primary">{recipe.title}</h3>
      <div className="flex flex-row gap-2 flex-grow">
        <div className="w-1/2 flex flex-col">
          <h4 className="text-base font-semibold mb-1 text-base-content">Ingredients</h4>
          <ul className="space-y-0.5 flex-grow overflow-auto">
            {recipe.ingredients.map((ingredient, index) => (
              <li key={index} className="flex items-center">
                <span className="mr-1 text-primary">•</span>
                <span className="text-base-content">{ingredient}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="w-1/2 flex flex-col">
          <div className="bg-base-200 p-1 rounded-lg mb-1">
            <h4 className="text-base font-semibold mb-0.5 text-base-content">Recipe Details</h4>
            <div className="space-y-0.5">
              <p><span className="font-medium text-primary">Prep:</span> <span className="text-base-content">{recipe.preparationTime} min</span></p>
              <p><span className="font-medium text-primary">Cook:</span> <span className="text-base-content">{recipe.cookingTime} min</span></p>
              <p><span className="font-medium text-primary">Servings:</span> <span className="text-base-content">{recipe.servings}</span></p>
              <p><span className="font-medium text-primary">Cuisine:</span> <span className="text-base-content">{recipe.cuisine}</span></p>
            </div>
          </div>
          <h4 className="text-base font-semibold mb-0.5 text-base-content">Instructions</h4>
          <ol className="space-y-0.5 flex-grow overflow-auto">
            {recipe.instructions.map((instruction, index) => (
              <li key={index} className="flex">
                <span className="font-bold text-primary mr-1">{index + 1}.</span>
                <span className="text-base-content">{instruction}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
};