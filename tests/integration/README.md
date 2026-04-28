- Integration Test Scaffolding
==========================

- Purpose
  - Provide a growth path for end-to-end / integration tests as services come online.
- Structure
  - tests/integration/
    - __init__.py
    - test_placeholder.py
    - README.md
- How to run
  - Run: pytest -q
  - Pytest will discover tests in tests/integration because we placed tests with the pattern test_*.py and added an integration marker.
- How to expand
  - Add new test modules under this directory, e.g. test_<scenario>.py with @pytest.mark.integration.
  - Implement real service clients / fixtures as services come online.

- Scaffolding notes
  - Start with a minimal integration test that exercises a single service using its REST/gRPC/CLI surface.
  - Add service-specific fixtures in conftest.py or in a tests/fixtures/ directory as you add tests.
  - Use pytest markers (e.g., @pytest.mark.integration) to separate integration tests from unit tests.
  - Consider using a lightweight test harness to mock or stub external dependencies during early iterations.
