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
    # 1. Initialize COM for the current FastAPI worker thread
    pythoncom.CoInitialize()
    
    c = wmi.WMI()
    
    # Extract CPU
    cpu = c.Win32_Processor()[0].Name.strip()
    
    # Extract GPU
    gpu = pick_best_gpu([v.Name.strip() for v in c.Win32_VideoController() if v.Name])
    
    # Extract RAM and convert bytes to Gigabytes
    sticks = list(c.Win32_PhysicalMemory())
    total_ram_bytes = sum([int(stick.Capacity) for stick in sticks])
    ram_gb = round(total_ram_bytes / (1024**3))
    ram_type, ram_speed, ram_modules = read_ram_details(sticks)

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
        "ram_type": ram_type,
        "ram_speed_mts": ram_speed,
        "ram_modules": ram_modules,
        "storage_gb": total_storage_gb,
        "is_laptop": detect_laptop(c)
    }
    
    return hardware_profile

if __name__ == "__main__":
    results = get_local_hardware()
    print("\n--- NextSpec Diagnostic Results ---")
    print(f"Detected CPU: {results['cpu']}")
    print(f"Detected GPU: {results['gpu']}")
    print(f"Detected RAM: {results['ram_gb']} GB {results['ram_type']} at {results['ram_speed_mts']} MT/s, {results['ram_modules']} stick(s)")
    print(f"Detected Storage: {results['storage_gb']} GB")
    print(f"Laptop: {results['is_laptop']}")
    print("-----------------------------------")