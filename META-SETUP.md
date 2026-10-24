# Facebook connection activation

Activated and verified in production on 2026-10-21. Sites secrets include META_APP_ID, META_APP_SECRET and META_LOGIN_CONFIG_ID alongside the existing n8n configuration. Secret values are never stored in source.

Configure META_APP_ID and META_APP_SECRET through Sites runtime secrets; never paste an app secret into chat or commit it. For Facebook Login for Business also set META_LOGIN_CONFIG_ID for the intended read-only permissions. Register this exact Valid OAuth Redirect URI in the existing COD Pilot Meta app:

https://codpilot-studio.eretbiabd0.chatgpt.site/api/meta/callback

The standard flow requests ads_read, pages_show_list, pages_read_engagement, instagram_basic, business_management. Business Login configurations must include the equivalent permissions. Provider app role, live mode, access level and review requirements must be verified in Meta. The Business Login configuration now grants ads_management, ads_read, business_management, pages_manage_ads, pages_read_engagement and pages_show_list. The application still only reads assets; no Meta write route exists. instagram_basic was not available in its permission picker. The app was published on 2026-10-21 after adding a public privacy policy and deletion instructions. Its permission table still displays Ready for testing; publication alone does not prove access for external users. The external Nawal Farah OAuth attempt showed Feature unavailable / updating app details. This root cause remains unresolved; do not repeat sign-in attempts without a material change. The callback URI is saved and validated in Meta. The real OAuth round-trip succeeded for the app administrator Abdelmoula Eretbi. The deployed runtime rejected redirect:error with TypeError; redirect:manual returns a response while preventing automatic credential forwarding.

After setting secrets, deploy the same saved version to apply the environment. Use Connections > Continue with Facebook. Verify the shown Facebook identity, account list, Page list, account pixels, linked professional Instagram and denial/expired access handling. The code does not request email or infer ownership from an email; user identity comes from the authenticated Meta /me response.

Tokens are encrypted in private R2 storage per authenticated Sites user using AES-GCM with user-bound additional data. Rotating META_APP_SECRET requires reconnection. OAuth state is user/cookie bound, single use and valid for ten minutes. Expired access fails explicitly without falling back to the legacy identity. The existing n8n reader remains available only when no direct connection exists. A connected identity changes asset discovery only; campaign monitoring still uses n8n's existing connection. No ad write or launch is implemented.

Pages reflect user permissions, not proof of selected ad-account eligibility. Pagination caps at ten 100-item pages and labels truncated lists. Real data visibility depends on provider permissions and asset access.

Validation: node tests/meta-auth.mjs; python make.py; bash scripts/build.sh; node scripts/validate-artifact.mjs. Tests use an in-memory bucket and mocked provider responses; they do not assert real Meta connectivity.

Live verification: three ad accounts loaded through direct Facebook login: ABDO — MAIN 01, Beutiva — Backup Ads 01 and Abdelmoula Eretbi. Selecting Backup Ads 01 returned Shoplina-Store as the only permission-visible Page, no pixels and no linked Instagram account for that Page. Empty lists do not prove assets do not exist. No campaign was launched. Temporary public-provider connectivity probe was removed after diagnosis.


## Multiple Facebook profiles (2026-10-21)
Each Sites user retains up to 20 encrypted Facebook profile connections in the existing private R2 owner record. Legacy single connections are read without a destructive migration; adding another identity preserves the original and selects the newly connected profile. Refresh must return the same provider identity. Reconnecting an existing ID updates it without duplication. Status returns only safe profile metadata, never tokens. POST /api/meta/select requires same origin and owner-scoped membership. Asset requests pin connection_id and validate ownership, so concurrent tabs cannot substitute another selected identity. Expired or unknown IDs never fall back to the n8n identity.

Connections and campaign preparation show a Facebook profile selector. Switching clears current asset selections and invalidates pending requests. Saved draft asset IDs are cleared if their connection differs when reopened; draft content, videos and budgets remain. Monitoring still uses the n8n connection. The public policy is linked from Connections. Actual consent for Nawal Farah has not succeeded; multi-profile tests use mocked provider data.


## Direct campaign reporting (2026-10-21)
Connected profiles now use POST /api/monitor with a required pinned connection_id and explicit ad account. Server verifies same-origin, Sites identity, encrypted profile ownership, expiry and current account access. It reads campaigns and campaign-level last_7d insights directly using the existing Meta user token and appsecret_proof; no tokens are sent to n8n. Unconnected legacy users retain the n8n path. The observed n8n webhook authentication failure remains unresolved and may also affect the assistant. No authentication credential or n8n workflow was changed.
Reports preserve missing metrics as null, avoid summing overlapping purchase action types, show partial-list warnings and selected campaign metrics with cautious evidence-based notes. Meta purchases are not confirmed/delivered COD orders. Meta permissions do not guarantee successful reads of every account. No launch, pause, budget write or automatic optimization is implemented.
