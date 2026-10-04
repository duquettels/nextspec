CREATE TABLE cpu_benchmarks (
    id BIGSERIAL PRIMARY KEY,
    cpu_name TEXT NOT NULL,
    price NUMERIC(10, 2),
    cpu_mark INTEGER NOT NULL,
    cpu_value NUMERIC(10, 2),
    thread_mark INTEGER NOT NULL,
    thread_value NUMERIC(10, 2),
    tdp NUMERIC(10, 2),
    power_perf NUMERIC(10, 2),
    cores INTEGER NOT NULL,
    test_date INTEGER NOT NULL,
    socket TEXT,
    category TEXT
);

CREATE TABLE gpu_benchmarks (
    id BIGSERIAL PRIMARY KEY,
    gpu_name TEXT NOT NULL,
    g3d_name INTEGER NOT NULL,
    g2d_mark INTEGER NOT NULL,
    price NUMERIC(10, 2),
    gpu_value NUMERIC(10, 2),
    tdp NUMERIC(10, 2),
    power_perf NUMERIC(10, 2),
    test_date INTEGER NOT NULL,
    category TEXT
);