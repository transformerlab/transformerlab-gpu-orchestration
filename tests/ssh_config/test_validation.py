import pytest


def test_validate_ssh_public_key_accepts_common_types():
    from lattice.routes.ssh_config.utils import validate_ssh_public_key

    # ed25519
    key_type, cleaned = validate_ssh_public_key(
        "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIKZ"  # minimal-ish base64
    )
    assert key_type == "ssh-ed25519"
    assert cleaned.startswith("ssh-ed25519 ")

    # rsa
    key_type, cleaned = validate_ssh_public_key("ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQDb")
    assert key_type == "ssh-rsa"
    assert cleaned.startswith("ssh-rsa ")


def test_validate_ssh_public_key_raises_on_bad_type_or_base64():
    from lattice.routes.ssh_config.utils import validate_ssh_public_key

    with pytest.raises(ValueError):
        validate_ssh_public_key("ssh-unknown AAAA")

    with pytest.raises(ValueError):
        validate_ssh_public_key("ssh-ed25519 not-base64!!")

