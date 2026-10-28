# Sending new orders to n8n

Every order placed on a landing page is saved in COD Pilot as before. When
`N8N_WEBHOOK_URL` is set, the shop also posts it to your n8n webhook as JSON:

```json
{"id":"…","date":"2026-10-27T19:40:00.000Z","product":"…","page":"slug","offer":"2 حبات + توصيل فابور",
 "qty":2,"price":349,"currency":"MAD","name":"…","phone":"0612345678","city":"…","address":"","status":"new","country":"MA"}
```

The request carries the header `x-cod-pilot-secret` with your secret word, so
nobody else can push fake orders into n8n. If n8n is down, the order is still
saved in COD Pilot.

## Setup

1. In n8n: **Workflows > Import from file** and pick `n8n/cod-pilot-orders.json`.
2. Open **Check secret** and replace `CHANGE_ME` with a long secret word of your own.
3. Open **Save order** and choose your Data Table. Its columns must be named like
   the JSON fields above (`date`, `product`, `offer`, `qty`, `price`, `currency`,
   `name`, `phone`, `city`, `address`, `status`…); matching columns are filled automatically.
4. Open **New order**, copy the **Production URL**, then **Activate** the workflow.
5. In GitHub, repo Settings > Secrets and variables > Actions, add
   `N8N_WEBHOOK_URL` (the Production URL) and `N8N_WEBHOOK_SECRET` (your secret word).
   Never paste the secret word in a chat.
6. Re-run the "Test and deploy" workflow (Actions tab) so the shop gets the new secrets.
