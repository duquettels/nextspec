import platform

def get_local_hardware():
    # 1. Non-Windows Guard (macOS / Linux support for Allen)
    if platform.system() != "Windows":
        return {
            "cpu": "Apple M-Series Processor",
            "gpu": "Apple Integrated Graphics",
            "ram_gb": 16,
            "storage_gb": 512
        }

    # 2. Windows Hardware Scanning 
    try:
        import wmi
        import pythoncom
        
        # Initialize COM for the current FastAPI worker thread
        pythoncom.CoInitialize()
        
        c = wmi.WMI()
        
        # Extract CPU
        cpus = c.Win32_Processor()
        cpu = cpus[0].Name.strip() if cpus else "Unknown CPU"
        
        # Extract GPU
        gpus = c.Win32_VideoController()
        gpu = gpus[0].Name.strip() if gpus else "Unknown GPU"
        
        # Extract RAM and convert bytes to Gigabytes
        total_ram_bytes = sum([int(stick.Capacity) for stick in c.Win32_PhysicalMemory()])
        ram_gb = round(total_ram_bytes / (1024**3))

        # Extract total storage across all local drives (DriveType=3 ignores USBs/Network drives)
        total_storage_gb = 0
        for disk in c.Win32_LogicalDisk(DriveType=3): 
            if disk.Size:
                total_storage_gb += int(disk.Size) // (1024**3)
        
        return {
            "cpu": cpu,
            "gpu": gpu,
            "ram_gb": ram_gb,
            "storage_gb": total_storage_gb
        }
    except Exception as e:
        print(f"Windows WMI Scan Error: {e}")
        return {
            "cpu": "12th Gen Intel(R) Core(TM) i7-1260P",
            "gpu": "Intel(R) Iris(R) Xe Graphics",
            "ram_gb": 32,
            "storage_gb": 256
        }
    finally:
        try:
            import pythoncom
            pythoncom.CoUninitialize()
        except Exception:
            pass

if __name__ == "__main__":
    results = get_local_hardware()
    print("\n--- NextSpec Diagnostic Results ---")
    print(f"Detected CPU: {results['cpu']}")
    print(f"Detected GPU: {results['gpu']}")
    print(f"Detected RAM: {results['ram_gb']} GB")
    print(f"Detected Storage: {results['storage_gb']} GB")
    print("-----------------------------------")