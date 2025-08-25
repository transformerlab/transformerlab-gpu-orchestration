def validate_ssh_public_key(public_key: str) -> tuple[str, str]:
    """
    Validate SSH public key format and extract key type.
    Returns (key_type, cleaned_key)
    """
    # Remove extra whitespace and newlines
    key = public_key.strip()

    # Check basic format: key_type key_data [comment]
    parts = key.split()
    if len(parts) < 2:
        raise ValueError(
            "Invalid SSH public key format. Expected: key_type key_data [comment]"
        )

    key_type = parts[0]
    key_data = parts[1]

    # Validate key type
    valid_key_types = [
        "ssh-rsa",
        "ssh-dss",
        "ssh-ed25519",
        "ecdsa-sha2-nistp256",
        "ecdsa-sha2-nistp384",
        "ecdsa-sha2-nistp521",
        "sk-ssh-ed25519@openssh.com",
        "sk-ecdsa-sha2-nistp256@openssh.com",
    ]

    if key_type not in valid_key_types:
        raise ValueError(f"Unsupported key type: {key_type}")

    # Validate base64 key data
    try:
        import base64

        base64.b64decode(key_data)
    except Exception:
        raise ValueError("Invalid base64 encoded key data")

    return key_type, key
