import os
from dotenv import load_dotenv
from google import genai

# Load your key
load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")

client = genai.Client(api_key=api_key)

print("Active Models available to your key:")
print("-" * 40)

# Ask the API for a list of all models it currently supports
for model in client.models.list():
    # Only print models that support text generation
    if "generateContent" in model.supported_actions:
        print(model.name)