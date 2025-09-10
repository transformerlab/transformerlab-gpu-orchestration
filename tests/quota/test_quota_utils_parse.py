from lattice.routes.quota.utils import parse_resources_string


def test_parse_resources_string_handles_invalid_inputs():
    for inval in (None, "", "not-a-format", "2x(cpu=, mem=)"):
        out = parse_resources_string(inval)  # type: ignore[arg-type]
        assert out["gpu_count"] == 0
        assert out["gpu_type"] is None
        assert out["cpus"] == 0
        assert out["memory"] == 0


def test_parse_resources_string_parses_gpu_variants():
    out = parse_resources_string("1x(cpus=2, mem=4, gpu=V100:2, disk=10)")
    assert out["gpu_type"] == "V100"
    assert out["gpu_count"] == 2
    assert out["cpus"] == 2
    assert out["memory"] == 4

    out = parse_resources_string("3x(cpus=8, mem=32, gpus=A100:1)")
    assert out["gpu_type"] == "A100"
    assert out["gpu_count"] == 3  # 1 gpu per node * 3 nodes
