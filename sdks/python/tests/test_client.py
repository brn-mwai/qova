"""Tests for the Qova Python SDK."""

import pytest
from qova import Qova, QovaOptions, QovaConfigError, QovaAuthError, QovaApiError


class TestQovaConstructor:
    def test_rejects_empty_key(self):
        with pytest.raises(QovaConfigError):
            Qova("")

    def test_rejects_invalid_prefix(self):
        with pytest.raises(QovaConfigError, match="qova_"):
            Qova("sk_live_abc123")

    def test_creates_with_valid_key(self):
        client = Qova("qova_test_abc123def456")
        assert client.agents is not None
        assert client.scores is not None
        assert client.transactions is not None
        assert client.budgets is not None
        assert client.keys is not None
        assert client.webhooks is not None

    def test_accepts_custom_options(self):
        client = Qova("qova_test_abc123def456", QovaOptions(
            base_url="http://localhost:3000",
            timeout=5.0,
            max_retries=0,
        ))
        assert client is not None

    def test_context_manager(self):
        with Qova("qova_test_abc123def456") as client:
            assert client.agents is not None


class TestResources:
    def test_agents_methods(self):
        client = Qova("qova_test_abc123def456")
        assert callable(client.agents.list)
        assert callable(client.agents.list_all)
        assert callable(client.agents.get)
        assert callable(client.agents.score)
        assert callable(client.agents.is_registered)
        assert callable(client.agents.register)
        assert callable(client.agents.update_score)
        assert callable(client.agents.batch_update_scores)

    def test_scores_methods(self):
        client = Qova("qova_test_abc123def456")
        assert callable(client.scores.breakdown)
        assert callable(client.scores.compute)
        assert callable(client.scores.enrich)
        assert callable(client.scores.anomaly_check)

    def test_webhooks_methods(self):
        client = Qova("qova_test_abc123def456")
        assert callable(client.webhooks.create)
        assert callable(client.webhooks.list)
        assert callable(client.webhooks.get)
        assert callable(client.webhooks.update)
        assert callable(client.webhooks.delete)
        assert callable(client.webhooks.deliveries)
        assert callable(client.webhooks.test)
        assert callable(client.webhooks.rotate_secret)


class TestErrors:
    def test_api_error_fields(self):
        e = QovaApiError("bad request", 400, "BAD_REQUEST", {"detail": "x"})
        assert e.status == 400
        assert e.code == "BAD_REQUEST"
        assert e.body == {"detail": "x"}
        assert str(e) == "bad request"

    def test_auth_error_defaults(self):
        e = QovaAuthError()
        assert e.status == 401
        assert e.code == "UNAUTHORIZED"

    def test_config_error(self):
        e = QovaConfigError("missing key")
        assert str(e) == "missing key"
        assert e.code == "CONFIG_ERROR"
