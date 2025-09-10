import pytest


def test_delete_cluster_not_found_raises_404():
    from lattice.routes.node_pools.utils import delete_cluster_in_pools
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as ei:
        delete_cluster_in_pools("does-not-exist")
    assert ei.value.status_code == 404

