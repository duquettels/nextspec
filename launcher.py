import subprocess
import time
import os
import sys
import atexit

def main():
    # Detect the directory the .exe is running from
    if getattr(sys, 'frozen', False):
        base_dir = os.path.dirname(sys.executable)
    else:
        base_dir = os.path.dirname(os.path.abspath(__file__))

    backend_dir = os.path.join(base_dir, "backend")
    frontend_dir = os.path.join(base_dir, "frontend")
    python_exe = os.path.join(backend_dir, "venv", "Scripts", "python.exe")
    
    # Flag to hide the massive walls of text from the React and FastAPI servers
    CREATE_NO_WINDOW = 0x08080000
    
    print("====================================")
    print("      INITIALIZING NEXTSPEC         ")
    print("====================================")
    print("\nBooting Backend & Database...")
    
    # 1. Start FastAPI silently
    backend = subprocess.Popen(
        [python_exe, "-m", "uvicorn", "main:app", "--reload", "--port", "8080"],
        cwd=backend_dir,
        creationflags=CREATE_NO_WINDOW
    )
    
    print("Booting Frontend UI...")
    # 2. Start Vite/React silently
    frontend = subprocess.Popen(
        ["npm.cmd", "run", "dev"],
        cwd=frontend_dir,
        creationflags=CREATE_NO_WINDOW
    )
    
    # 3. Clean-up function to prevent "Port already in use" errors on the next run
    def cleanup():
        print("\nShutting down NextSpec servers...")
        backend.terminate()
        frontend.terminate()
        
    atexit.register(cleanup)
    
    # Wait for Vite to build
    time.sleep(3)
    
    print("Launching Application...")
    # 4. Open Chrome in "App Mode" (No URL bar, no tabs)
    subprocess.Popen(
        "start chrome --app=http://localhost:5173",
        shell=True,
        creationflags=CREATE_NO_WINDOW
    )
    
    # 5. Keep the launcher alive to manage the servers
    input("\n[ NEXTSPEC IS RUNNING ]\n\nDo not close this window while testing.\nPress ENTER here to cleanly shut down the servers and exit...\n\n> ")

if __name__ == "__main__":
    main()