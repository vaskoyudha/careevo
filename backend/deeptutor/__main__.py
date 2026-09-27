"""The ``deeptutor`` command-line program was removed from this deployment.

This backend is a website API server, not a terminal client, so the CLI
(``deeptutor_cli/``) and its ``deeptutor`` console entry point are gone. Run the
API directly instead::

    python -m uvicorn deeptutor.api.main:app --host 127.0.0.1 --port 8011
"""

raise SystemExit(
    "The `deeptutor` CLI has been removed. This deployment serves the website "
    "only; start the API with:\n"
    "    python -m uvicorn deeptutor.api.main:app --host 127.0.0.1 --port 8011"
)
