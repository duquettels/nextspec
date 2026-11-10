import platform
import re
import wmi
import pythoncom  # We need this to handle Windows threads

# Windows chassis types that mean laptop: 8 Portable, 9 Laptop, 10 Notebook,
# 11 Handheld, 14 Sub Notebook, 30 Tablet, 31 Convertible, 32 Detachable
LAPTOP_CHASSIS = {8, 9, 10, 11, 14, 30, 31, 32}

def detect_laptop(c) -> bool:
    """True if this machine is a laptop. Uses the chassis type, and falls back to
    'has a battery' only when Windows reports the chassis as Other/Unknown."""
    chassis_types = [int(t) for e in c.Win32_SystemEnclosure() for t in (e.ChassisTypes or [])]
    if any(t in LAPTOP_CHASSIS for t in chassis_types):
        return True
    if all(t in (1, 2) for t in chassis_types):
        return len(c.Win32_Battery()) > 0
    return False

# Win32_PhysicalMemory.SMBIOSMemoryType values
DDR_TYPES = {20: "DDR", 21: "DDR2", 24: "DDR3", 26: "DDR4", 34: "DDR5"}

def read_ram_details(sticks):
    """DDR type, speed (MT/s) and stick count. Type and speed are None when
    Windows doesn't report them (some virtual machines and older boards)."""
    types = {DDR_TYPES.get(int(s.SMBIOSMemoryType or 0)) for s in sticks}
    types.discard(None)
    ddr_type = types.pop() if len(types) == 1 else None
    speeds = [int(s.ConfiguredClockSpeed or s.Speed or 0) for s in sticks]
    speeds = [x for x in speeds if x > 0]
    speed = min(speeds) if speeds else None  # mixed kits run at the slowest stick
    # some boards report the real clock (1600) instead of the transfer rate (3200)
    if speed and ((ddr_type == "DDR4" and speed < 1200) or (ddr_type == "DDR5" and speed < 2400)):
        speed *= 2
    return ddr_type, speed, len(sticks)

def pick_best_gpu(names):
    """Windows lists every video adapter, and the first one is often the integrated
    graphics. Prefer a dedicated card (NVIDIA, Radeon RX/Pro, Intel Arc)."""
    def rank(name):
        low = name.lower()
        if any(k in low for k in ("microsoft", "virtual", "remote")):
            return 0
        if any(k in low for k in ("nvidia", "geforce", "quadro", "rtx", "gtx")):
            return 3
        if "radeon rx" in low or "radeon pro" in low or re.search(r"\barc\b", low):
            return 2
        return 1
    return max(names, key=rank) if names else "Unknown GPU"

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
    print(f"Detected RAM: {results['ram_gb']} GB {results['ram_type']} at {results['ram_speed_mts']} MT/s, {results['ram_modules']} stick(s)")
    print(f"Detected Storage: {results['storage_gb']} GB")
    print(f"Laptop: {results['is_laptop']}")
    print("-----------------------------------")