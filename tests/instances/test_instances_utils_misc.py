def test_get_skypilot_status_scrubs_sensitive(monkeypatch):
    import lattice.routes.instances.utils as iu

    monkeypatch.setattr(iu.sky, "status", lambda cluster_names=None, refresh=None: "req-xyz")
    monkeypatch.setattr(
        iu.sky,
        "get",
        lambda req_id: [
            {
                "name": "c1",
                "credentials": {"secret": "x"},
                "last_creation_yaml": "abc",
                "last_update_yaml": "def",
                "handle": "h",
                "other": 1,
            }
        ],
    )

    out = iu.get_skypilot_status()
    assert isinstance(out, list) and out[0]["other"] == 1
    assert out[0]["credentials"] is None
    assert out[0]["last_creation_yaml"] == ""
    assert out[0]["last_update_yaml"] == ""
    assert out[0]["handle"] == ""


def test_generate_cost_report(monkeypatch):
    import lattice.routes.instances.utils as iu

    class DummySDK:
        @staticmethod
        def cost_report():
            return "req-cost"

    class DummyClient:
        sdk = DummySDK()

    monkeypatch.setattr(iu.sky, "client", DummyClient)
    monkeypatch.setattr(iu.sky, "get", lambda req_id: {"total": 1.23})

    report = iu.generate_cost_report()
    assert report == {"total": 1.23}

