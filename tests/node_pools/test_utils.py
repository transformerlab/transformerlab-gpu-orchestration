import pytest


@pytest.fixture()
def db_session():
    from lattice.config import SessionLocal

    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def test_create_add_update_and_delete_cluster(monkeypatch, db_session, tmp_path):
    from lattice.routes.node_pools import utils as np
    from lattice.models import SSHNode
    from lattice.db.db_models import SSHNodePool

    # Avoid background GPU update threads
    monkeypatch.setattr(np, "_schedule_gpu_resources_update", lambda *args, **kwargs: None)

    cluster = np.create_cluster_in_pools(
        cluster_name="poolA",
        user="ubuntu",
        identity_file=str(tmp_path / "id_rsa"),
        resources={"vcpus": "2", "memory_gb": "8"},
        user_id="u1",
        organization_id="org1",
    )
    assert cluster["hosts"] == []

    # DB row created
    row = db_session.query(SSHNodePool).filter(SSHNodePool.name == "poolA").first()
    assert row is not None and row.name == "poolA"

    # Add two nodes with resources and verify DB aggregation updates
    np.add_node_to_cluster("poolA", SSHNode(ip="10.0.0.1", user="ubuntu", resources={"vcpus": "2", "memory_gb": "4"}))
    np.add_node_to_cluster("poolA", SSHNode(ip="10.0.0.2", user="ubuntu", resources={"vcpus": "3", "memory_gb": "6"}))

    row = db_session.query(SSHNodePool).filter(SSHNodePool.name == "poolA").first()
    # Aggregated vcpus=5, memory=10
    assert row.resources.get("vcpus") == "5"
    assert row.resources.get("memory_gb") == "10"

    # Duplicate IP is rejected
    with pytest.raises(Exception):
        np.add_node_to_cluster("poolA", SSHNode(ip="10.0.0.1", user="ubuntu"))

    # is_down_only_cluster short-circuits for SSH cluster
    assert np.is_down_only_cluster("poolA") is True

    # Remove node then delete cluster
    np.delete_ssh_node("poolA", "10.0.0.2")
    np.delete_cluster_in_pools("poolA")
    assert db_session.query(SSHNodePool).filter(SSHNodePool.name == "poolA").first() is None

