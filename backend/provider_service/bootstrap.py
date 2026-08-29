"""CLI for recording the first real bounded provider transaction.

Usage (from ``backend``):

    python -m provider_service.bootstrap

The target and calldata are deliberately supplied by the provider through
environment variables. The command never guesses a protocol call and never
prints the private key.
"""

from .app import _provider_address, send_configured_asset


def main() -> None:
    tx_hash = send_configured_asset(kind="bootstrap")
    print(f"provider={_provider_address()}")
    print(f"bootstrap_receipt={tx_hash}")
    print("Add this confirmed hash to the capability document automatically served at /mandate/capability.")


if __name__ == "__main__":
    main()

