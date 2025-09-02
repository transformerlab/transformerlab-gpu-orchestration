from lattice.utils.file_utils import is_valid_identity_file


def test_is_valid_identity_file_accepts_common_key_names_and_exts():
    assert is_valid_identity_file("id_rsa")
    assert is_valid_identity_file("id_ecdsa")
    assert is_valid_identity_file("id_ed25519")
    assert is_valid_identity_file("my-key.pem")
    assert is_valid_identity_file("server.key")
    assert is_valid_identity_file("pubkey.pub")


def test_is_valid_identity_file_rejects_unexpected_extensions():
    assert not is_valid_identity_file("notes.txt")
    assert not is_valid_identity_file("malware.exe")
    assert not is_valid_identity_file("image.jpg")

