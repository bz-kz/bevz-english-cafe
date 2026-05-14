"""Cloud Function: disable project billing when the monthly budget is exceeded.

Triggered by Pub/Sub messages from the budget's all_updates_rule. The message
body is a base64-encoded JSON containing costAmount, budgetAmount, and other
fields documented at:

  https://cloud.google.com/billing/docs/how-to/budgets-programmatic-notifications

The function is idempotent: if billing is already disabled, it logs and exits
cleanly. It only acts when cost has actually crossed the budget threshold;
the budget's lower thresholds (50/90 %) generate informational messages that
the function ignores.
"""

from __future__ import annotations

import base64
import json
import os
from typing import Any

import functions_framework
from google.cloud import billing_v1

PROJECT_ID = os.environ["TARGET_PROJECT_ID"]


@functions_framework.cloud_event
def handle_budget_alert(cloud_event: Any) -> None:
    msg = cloud_event.data.get("message", {})
    raw = msg.get("data")
    if not raw:
        print("No data in Pub/Sub message; ignoring")
        return

    try:
        payload = json.loads(base64.b64decode(raw).decode("utf-8"))
    except (ValueError, json.JSONDecodeError) as exc:
        print(f"Failed to decode budget payload: {exc}")
        return

    cost = float(payload.get("costAmount", 0))
    budget = float(payload.get("budgetAmount", 0))
    print(f"Budget alert: project={PROJECT_ID} cost={cost} budget={budget}")

    if budget <= 0 or cost < budget:
        return

    name = f"projects/{PROJECT_ID}"
    client = billing_v1.CloudBillingClient()
    info = client.get_project_billing_info(name=name)

    if not info.billing_enabled:
        print(f"Billing already disabled for {name}; no-op")
        return

    info.billing_account_name = ""
    client.update_project_billing_info(name=name, project_billing_info=info)
    print(f"BILLING DISABLED for {name} (cost {cost} >= budget {budget})")
