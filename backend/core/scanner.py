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

    # Extract total storage across all local drives
    total_storage_gb = 0
    # DriveType=3 ensures we only scan local hard drives, ignoring USBs/Network drives
    for disk in c.Win32_LogicalDisk(DriveType=3): 
        if disk.Size:
            # Convert raw bytes to GB
            total_storage_gb += int(disk.Size) // (1024**3)
    
    hardware_profile = {
        "cpu": cpu,
        "gpu": gpu,
        "ram_gb": ram_gb,
        "storage_gb": total_storage_gb
    }
    
    return hardware_profile

if __name__ == "__main__":
    results = get_local_hardware()
    print("\n--- NextSpec Diagnostic Results ---")
    print(f"Detected CPU: {results['cpu']}")
    print(f"Detected GPU: {results['gpu']}")
    print(f"Detected RAM: {results['ram_gb']} GB")
    print("-----------------------------------")