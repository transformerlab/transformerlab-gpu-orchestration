from pathlib import Path


def test_save_list_rename_delete_identity_files(tmp_path):
    from lattice.utils.file_utils import (
        save_named_identity_file,
        save_temporary_identity_file,
        get_available_identity_files,
        delete_named_identity_file,
        get_organization_identity_files_dir,
        rename_identity_file,
    )

    org = "org-files-1"
    # Save named identity file
    p1 = save_named_identity_file(b"KEYDATA", "id_rsa", "My Key", organization_id=org)
    assert Path(p1).exists()

    # Save temporary identity file
    p2 = save_temporary_identity_file(b"TEMPKEY", "temp.pem", organization_id=org)
    assert Path(p2).exists()

    # List files includes both
    files = get_available_identity_files(org)
    paths = {f["path"] for f in files}
    assert p1 in paths and p2 in paths

    # Rename is a no-op on filesystem but returns True
    assert rename_identity_file(p1, "Renamed", organization_id=org) is True

    # Delete named
    assert delete_named_identity_file(p1, organization_id=org) is True
    assert not Path(p1).exists()

    # Directory is within HOME/.sky/identity_files/org
    base_dir = get_organization_identity_files_dir(org)
    assert Path(base_dir).exists()

