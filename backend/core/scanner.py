import json
import platform
import re
import subprocess


def run_command(command):
    result = subprocess.run(
        command,
        capture_output=True,
        text=True,
        check=False,
    )
    return result.stdout.strip()


def get_macos_hardware():
    cpu = run_command(["sysctl", "-n", "machdep.cpu.brand_string"])
    if not cpu:
        cpu = run_command(["sysctl", "-n", "hw.model"])

    memory_bytes = run_command(["sysctl", "-n", "hw.memsize"])
    ram_gb = round(int(memory_bytes) / (1024 ** 3)) if memory_bytes.isdigit() else 0

    gpu = "Unknown GPU"
    display_info = run_command(
        ["system_profiler", "SPDisplaysDataType", "-json"]
    )

    try:
        displays = json.loads(display_info).get("SPDisplaysDataType", [])
        if displays:
            gpu = (
                displays[0].get("sppci_model")
                or displays[0].get("spdisplays_chipset-model")
                or displays[0].get("Chipset Model")
                or gpu
            )
    except json.JSONDecodeError:
        pass

    storage_gb = 0
    disk_info = run_command(["df", "-k", "/"])
    lines = disk_info.splitlines()

    if len(lines) >= 2:
        columns = lines[-1].split()
        if len(columns) >= 2 and columns[1].isdigit():
            storage_gb = round(int(columns[1]) * 1024 / (1024 ** 3))

    return {
        "cpu": cpu or "Unknown CPU",
        "gpu": gpu,
        "ram_gb": ram_gb,
        "storage_gb": storage_gb,
    }


def get_local_hardware():
    if platform.system() == "Darwin":
        return get_macos_hardware()

    raise RuntimeError(
        "This local scanner supports macOS only. "
        "Use the original WMI scanner on Windows."
    )


if __name__ == "__main__":
    print(get_local_hardware())



















# import wmi
# import pythoncom  # We need this to handle Windows threads

# def get_local_hardware():
#     # 1. Initialize COM for the current FastAPI worker thread
#     pythoncom.CoInitialize()
    
#     c = wmi.WMI()
    
#     # Extract CPU
#     cpu = c.Win32_Processor()[0].Name.strip()
    
#     # Extract GPU
#     gpu = c.Win32_VideoController()[0].Name.strip()
    
#     # Extract RAM and convert bytes to Gigabytes
#     total_ram_bytes = sum([int(stick.Capacity) for stick in c.Win32_PhysicalMemory()])
#     ram_gb = round(total_ram_bytes / (1024**3))

#     # Extract total storage across all local drives
#     total_storage_gb = 0
#     # DriveType=3 ensures we only scan local hard drives, ignoring USBs/Network drives
#     for disk in c.Win32_LogicalDisk(DriveType=3): 
#         if disk.Size:
#             # Convert raw bytes to GB
#             total_storage_gb += int(disk.Size) // (1024**3)
    
#     hardware_profile = {
#         "cpu": cpu,
#         "gpu": gpu,
#         "ram_gb": ram_gb,
#         "storage_gb": total_storage_gb
#     }
    
#     return hardware_profile

# if __name__ == "__main__":
#     results = get_local_hardware()
#     print("\n--- NextSpec Diagnostic Results ---")
#     print(f"Detected CPU: {results['cpu']}")
#     print(f"Detected GPU: {results['gpu']}")
#     print(f"Detected RAM: {results['ram_gb']} GB")
#     print(f"Detected Storage: {results['storage_gb']} GB")
#     print("-----------------------------------")