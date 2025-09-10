import pytest


@pytest.fixture()
def db_session():
    from lattice.config import SessionLocal

    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def test_generate_unique_cluster_name_shape():
    from lattice.utils.cluster_utils import generate_unique_cluster_name

    name = generate_unique_cluster_name("my-cluster")
    # Should be 8+ chars and alnum/-. characters, and start/end with letters
    assert len(name) >= 8
    assert name[0].isalpha()
    assert name[-1].isalpha()


def test_cluster_platform_crud_and_unique_display_names(db_session):
    from lattice.utils.cluster_utils import (
        create_cluster_platform_entry,
        get_actual_cluster_name,
        get_display_name_from_actual,
        get_cluster_platform_info,
        update_cluster_platform,
        delete_cluster_platform_entry,
    )

    user_id = "u_cu"
    org_id = "o_cu"

    # Create first with given display name
    cn1 = create_cluster_platform_entry(
        display_name="demo",
        platform="runpod",
        user_id=user_id,
        organization_id=org_id,
        db=db_session,
    )
    # Create second with same display name -> should become demo-2
    cn2 = create_cluster_platform_entry(
        display_name="demo",
        platform="azure",
        user_id=user_id,
        organization_id=org_id,
        db=db_session,
    )

    assert cn1 != cn2
    # Actual->display and display->actual mapping work
    d1 = get_display_name_from_actual(cn1, db=db_session)
    d2 = get_display_name_from_actual(cn2, db=db_session)
    assert d1 == "demo"
    assert d2 == "demo-2"
    assert get_actual_cluster_name("demo", user_id, org_id, db=db_session) == cn1

    # Update platform and read info
    assert update_cluster_platform(cn1, "ssh", db=db_session) is True
    info = get_cluster_platform_info(cn1, db=db_session)
    assert info and info["platform"] == "ssh"

    # Delete
    assert delete_cluster_platform_entry(cn1, db=db_session) is True
    assert get_cluster_platform_info(cn1, db=db_session) is None

