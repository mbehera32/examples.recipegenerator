import type { MetaFunction, LoaderFunction, ActionFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useActionData, Form, useSubmit } from "@remix-run/react";
import { getAllImageUrls, getRecipe, uploadToS3 } from "./utils/server"; // Adjust the import path as necessary
import { useState, useRef, useEffect } from "react"; // Import useState for managing the current image index and recipe visibility, and useRef for file input reference
import { useNavigate } from "@remix-run/react";

// Loader function to fetch all image URLs
export const loader: LoaderFunction = async () => {
  try {
    const imageUrls = await getAllImageUrls();

    // Fetch recipes for all image URLs
    const recipeDataPromises = imageUrls.map(url => getRecipe(url));
    const recipeData = await Promise.all(recipeDataPromises);

    return json({ imageUrls, recipeData });
  } catch (error) {
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

function FileUploader({ onUploadSuccess }) {
  const [file, setFile] = useState<File | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const actionData = useActionData();
  const submit = useSubmit(); // Initialize submit function

  useEffect(() => {
    if (actionData?.success) {
      setNotification("File uploaded successfully!");
      onUploadSuccess(); // Call the callback function
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
    <>
      <Form method="post" encType="multipart/form-data" onSubmit={handleSubmit}>
        <input type="file" name="file" onChange={handleFileChange} className="file-input file-input-bordered file-input-primary w-full max-w-xs" />
        <button type="submit" className="btn btn-primary ml-2">
          Upload to S3
        </button>
      </Form>
      {notification && (
        <div className="mt-4 p-2 bg-green-100 text-green-700 rounded">
          {notification}
        </div>
      )}
    </>
  );
}

export default function Index() {
  const { imageUrls, recipeData } = useLoaderData<typeof loader>();
  const [currentIndex, setCurrentIndex] = useState(0); // State to track the current image index
  const [showRecipe, setShowRecipe] = useState(false); // State to control recipe visibility
  const fileInputRef = useRef<HTMLInputElement | null>(null); // Reference for the file input
  const [selectedFile, setSelectedFile] = useState<File | null>(null); // State to store the selected file
  const [localImageUrls, setLocalImageUrls] = useState(imageUrls);
  const [localRecipeData, setLocalRecipeData] = useState(recipeData);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
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

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setSelectedFile(file);
      console.log("Selected file:", file);

      // Create FormData to send the file
      const formData = new FormData();
      formData.append("file", file);

    }
  };

  const handleUploadSuccess = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  // useEffect(() => {
  //   // Fetch updated image URLs and recipe data when refreshTrigger changes
  //   const fetchData = async () => {
  //     const response = await fetch('/?index'); // Update this to the correct route
  //     const data = await response.json();
  //     setLocalImageUrls(data.imageUrls);
  //     setLocalRecipeData(data.recipeData);
  //   };

  //   fetchData();
  // }, [refreshTrigger]);

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
        <FileUploader onUploadSuccess={handleUploadSuccess} />
      </div>
    </div>
  );
}

const RecipeCard = ({ recipe }) => {
  return (
    <div className=" p-4 rounded-lg h-full"> {/* Ensure card takes full height of the box */}
      <h3 className="text-2xl font-bold mb-2">{recipe.title}</h3>
      <div className="mb-4">
        <h4 className="text-lg font-semibold">Ingredients:</h4>
        <ul className="list-disc list-inside">
          {recipe.ingredients.map((ingredient, index) => (
            <li key={index}>{ingredient}</li>
          ))}
        </ul>
      </div>
      <div className="mb-4">
        <h4 className="text-lg font-semibold">Instructions:</h4>
        <ol className="list-decimal list-inside">
          {recipe.instructions.map((instruction, index) => (
            <li key={index}>{instruction}</li>
          ))}
        </ol>
      </div>
      <div className="mb-4">
        <p><strong>Preparation Time:</strong> {recipe.preparationTime} minutes</p>
        <p><strong>Cooking Time:</strong> {recipe.cookingTime} minutes</p>
        <p><strong>Servings:</strong> {recipe.servings}</p>
        <p><strong>Cuisine:</strong> {recipe.cuisine}</p>
      </div>
    </div>
  );
};