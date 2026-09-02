import wmi
import pythoncom  # We need this to handle Windows threads

def get_local_hardware():
    # 1. Initialize COM for the current FastAPI worker thread
    pythoncom.CoInitialize()
    
    c = wmi.WMI()
    
    # Extract CPU
    cpu = c.Win32_Processor()[0].Name.strip()
    
    # Extract GPU
    gpu = c.Win32_VideoController()[0].Name.strip()
    
    # Extract RAM and convert bytes to Gigabytes
    total_ram_bytes = sum([int(stick.Capacity) for stick in c.Win32_PhysicalMemory()])
    ram_gb = round(total_ram_bytes / (1024**3))
    
    hardware_profile = {
        "cpu": cpu,
        "gpu": gpu,
        "ram_gb": ram_gb
    }
    
    return hardware_profile

if __name__ == "__main__":
    results = get_local_hardware()
    print("\n--- NextSpec Diagnostic Results ---")
    print(f"Detected CPU: {results['cpu']}")
    print(f"Detected GPU: {results['gpu']}")
    print(f"Detected RAM: {results['ram_gb']} GB")
    print("-----------------------------------")