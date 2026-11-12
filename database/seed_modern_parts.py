from database import get_connection

MODERN_GPUS = [
    # (gpu_name, g3d_mark, g2d_mark, price, tdp, category)
    ("GeForce RTX 4060", 19580, 980, 299.99, 115, "Desktop"),
    ("Radeon RX 7700 XT", 22450, 1020, 399.99, 245, "Desktop"),
    ("Radeon RX 7800 XT", 24350, 1060, 479.99, 263, "Desktop"),
    ("GeForce RTX 4070", 26980, 1120, 549.99, 200, "Desktop"),
    ("GeForce RTX 4070 SUPER", 30150, 1180, 599.99, 220, "Desktop"),
    ("Radeon RX 7900 XT", 29400, 1150, 699.99, 300, "Desktop"),
    ("GeForce RTX 4070 Ti SUPER", 31850, 1210, 799.99, 285, "Desktop"),
    ("Radeon RX 7900 XTX", 31500, 1190, 899.99, 355, "Desktop"),
    ("GeForce RTX 4080 SUPER", 34650, 1260, 999.99, 320, "Desktop"),
    ("GeForce RTX 4090", 38900, 1340, 1599.99, 450, "Desktop"),
]

MODERN_CPUS = [
    # (cpu_name, price, cpu_mark, thread_mark, tdp, cores, socket, category)
    ("Intel Core i7-1260P", 320.00, 17150, 3420, 28, 12, "FCBGA1744", "Laptop"),
    ("Intel Core i7-12700K", 279.99, 34650, 4050, 125, 12, "FCLGA1700", "Desktop"),
    ("AMD Ryzen 7 7800X3D", 389.99, 34280, 3810, 120, 8, "AM5", "Desktop"),
    ("Intel Core i7-13700K", 349.99, 46450, 4360, 125, 16, "FCLGA1700", "Desktop"),
    ("Intel Core i7-14700K", 389.99, 53200, 4510, 125, 20, "FCLGA1700", "Desktop"),
    ("Intel Core i9-14900K", 529.99, 60100, 4780, 125, 24, "FCLGA1700", "Desktop"),
]


def seed():
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'gpu_benchmarks'")
            gpu_cols = {r[0] for r in cur.fetchall()}

            cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'cpu_benchmarks'")
            cpu_cols = {r[0] for r in cur.fetchall()}

            gpu_inserted = 0
            for name, g3d, g2d, price, tdp, cat in MODERN_GPUS:
                cur.execute("SELECT 1 FROM gpu_benchmarks WHERE gpu_name ILIKE %s", (name,))
                if not cur.fetchone():
                    candidates = {
                        "gpu_name": name,
                        "g3d_mark": g3d,
                        "g3d_name": g3d,
                        "g2d_mark": g2d,
                        "price": price,
                        "gpu_value": round(g3d / price, 2),
                        "tdp": tdp,
                        "power_perf": round(g3d / tdp, 2),
                        "test_date": 2024,
                        "category": cat,
                    }
                    row_data = {k: v for k, v in candidates.items() if k in gpu_cols}
                    cols = ", ".join(row_data.keys())
                    placeholders = ", ".join(["%s"] * len(row_data))
                    cur.execute(
                        f"INSERT INTO gpu_benchmarks ({cols}) VALUES ({placeholders})",
                        list(row_data.values()),
                    )
                    gpu_inserted += 1

            cpu_inserted = 0
            for name, price, mark, thread_mark, tdp, cores, socket, cat in MODERN_CPUS:
                cur.execute("SELECT 1 FROM cpu_benchmarks WHERE cpu_name ILIKE %s", (name,))
                if not cur.fetchone():
                    candidates = {
                        "cpu_name": name,
                        "price": price,
                        "cpu_mark": mark,
                        "cpu_value": round(mark / price, 2),
                        "thread_mark": thread_mark,
                        "thread_value": round(thread_mark / price, 2),
                        "tdp": tdp,
                        "power_perf": round(mark / tdp, 2),
                        "cores": cores,
                        "test_date": 2024,
                        "socket": socket,
                        "category": cat,
                    }
                    row_data = {k: v for k, v in candidates.items() if k in cpu_cols}
                    cols = ", ".join(row_data.keys())
                    placeholders = ", ".join(["%s"] * len(row_data))
                    cur.execute(
                        f"INSERT INTO cpu_benchmarks ({cols}) VALUES ({placeholders})",
                        list(row_data.values()),
                    )
                    cpu_inserted += 1

        conn.commit()
    print(f"Seed complete! Inserted {gpu_inserted} modern GPUs and {cpu_inserted} modern CPUs.")


if __name__ == "__main__":
    seed()