import os
from dotenv import load_dotenv
from google import genai

# 1. Load the secret key from your .env file
load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")

# 2. Initialize the new client
client = genai.Client(api_key=api_key)

# 3. Ask it a test question using the new syntax
print("Asking the AI...")
response = client.models.generate_content(
    model='gemini-flash-latest',
    contents='In one sentence, explain what a PC bottleneck is.'
)

# 4. Print the result
print("\nAI Response:")
print(response.text)